'use strict';

import crypto from 'crypto';

/**
 * @module KeycloakAuthController
 * @description Handles the Keycloak Authorization Code Flow (OAuth2 / OIDC).
 *
 * Flow:
 *   1. `initiate`  – redirects the browser to Keycloak's authorization endpoint.
 *   2. `callback`  – receives the authorization code, exchanges it for tokens,
 *                    finds/creates the Strapi admin user, generates a Strapi JWT,
 *                    and returns an HTML page that stores the JWT in localStorage
 *                    and redirects to /admin.
 */
export default {
  /**
   * Initiates the Authorization Code Flow.
   * Generates a CSRF state token, stores it in an httpOnly cookie, and
   * redirects the browser to Keycloak's authorization endpoint.
   *
   * @param {Object} ctx - Koa context.
   */
  async initiate(ctx) {
    const config = strapi.config.get('plugin::strapi-keycloak-passport');

    if (!config.STRAPI_PUBLIC_URL) {
      strapi.log.warn('⚠️ STRAPI_PUBLIC_URL is not set in plugin config. Defaulting to http://localhost:1337');
    }

    const strapiPublicUrl = config.STRAPI_PUBLIC_URL || 'http://localhost:1337';
    const state = crypto.randomUUID();

    // Store CSRF state in httpOnly cookie (5-minute TTL)
    ctx.cookies.set('kc_state', state, {
      httpOnly: true,
      maxAge: 5 * 60 * 1000,
      overwrite: true,
      sameSite: 'lax',
    });

    const redirectUri = `${strapiPublicUrl}/strapi-keycloak-passport/auth/keycloak/callback`;

    const authUrl = new URL(
      `${config.KEYCLOAK_AUTH_URL}/realms/${config.KEYCLOAK_REALM}/protocol/openid-connect/auth`
    );
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', config.KEYCLOAK_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', 'openid');
    authUrl.searchParams.set('state', state);

    strapi.log.info(`🔵 Initiating Keycloak Authorization Code Flow → ${authUrl.origin}`);
    return ctx.redirect(authUrl.toString());
  },

  /**
   * Handles the Keycloak callback after the user authenticates.
   * Validates the CSRF state, exchanges the authorization code for tokens,
   * syncs the Strapi admin user, and returns an HTML page that logs the user in.
   *
   * @param {Object} ctx - Koa context.
   */
  async callback(ctx) {
    try {
      const config = strapi.config.get('plugin::strapi-keycloak-passport');
      const { code, state } = ctx.query;

      // --- CSRF state validation ---
      const savedState = ctx.cookies.get('kc_state');
      if (!state || !savedState || state !== savedState) {
        strapi.log.warn('⚠️ Keycloak callback: state mismatch (possible CSRF)');
        return ctx.badRequest('Invalid state parameter');
      }
      // Clear state cookie immediately after validation
      ctx.cookies.set('kc_state', null, { maxAge: 0, overwrite: true });

      if (!code) {
        return ctx.badRequest('Missing authorization code');
      }

      // --- Exchange authorization code for tokens ---
      const strapiPublicUrl = config.STRAPI_PUBLIC_URL || 'http://localhost:1337';
      const redirectUri = `${strapiPublicUrl}/strapi-keycloak-passport/auth/keycloak/callback`;
      const tokenUrl = `${config.KEYCLOAK_AUTH_URL}/realms/${config.KEYCLOAK_REALM}/protocol/openid-connect/token`;

      const tokenResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: config.KEYCLOAK_CLIENT_ID,
          client_secret: config.KEYCLOAK_CLIENT_SECRET,
          code,
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        const body = await tokenResponse.text();
        throw new Error(`Keycloak token exchange failed (${tokenResponse.status}): ${body}`);
      }

      const tokens = await tokenResponse.json();

      // --- Decode access_token JWT payload (base64url) ---
      const payloadB64 = tokens.access_token.split('.')[1];
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));

      const userInfo = {
        sub: payload.sub,
        email: payload.email,
        preferred_username: payload.preferred_username,
        given_name: payload.given_name,
        family_name: payload.family_name,
      };

      // Fallback: fetch userinfo endpoint if essential claims are missing
      if (!userInfo.sub || !userInfo.email) {
        const userinfoUrl = `${config.KEYCLOAK_AUTH_URL}/realms/${config.KEYCLOAK_REALM}/protocol/openid-connect/userinfo`;
        const userinfoRes = await fetch(userinfoUrl, {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (!userinfoRes.ok) {
          throw new Error(`Keycloak userinfo endpoint error: ${userinfoRes.status}`);
        }
        Object.assign(userInfo, await userinfoRes.json());
      }

      strapi.log.info(`✅ Keycloak code flow: user ${userInfo.email || userInfo.sub} authenticated`);

      // --- Find or create Strapi admin user (reuses existing service) ---
      const adminUser = await strapi
        .service('plugin::strapi-keycloak-passport.adminUserService')
        .findOrCreate(userInfo);

      // --- Generate Strapi JWT ---
      const jwt = await strapi.admin.services.token.createJwtToken(adminUser);

      // --- Return HTML that stores JWT in localStorage and redirects to /admin ---
      ctx.type = 'text/html';
      ctx.body = `<!DOCTYPE html>
<html>
  <head>
    <title>Logging in…</title>
    <meta charset="utf-8" />
  </head>
  <body>
    <script>
      try {
        localStorage.setItem('jwtToken', ${JSON.stringify(jwt)});
        window.location.replace('/admin');
      } catch (e) {
        window.location.replace('/admin');
      }
    </script>
  </body>
</html>`;
    } catch (error) {
      strapi.log.error('🔴 Keycloak Authorization Code Flow callback error:', error.message);
      return ctx.badRequest('Authentication failed', {
        error: {
          status: error?.status ?? 400,
          name: error?.name ?? 'ApplicationError',
          message: error?.message ?? 'Authentication failed',
        },
      });
    }
  },
};
