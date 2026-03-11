'use strict';

import { getGrantManager } from '../services/keycloakConnectFactory';

/**
 * @module AuthOverrideController
 * @description Handles Keycloak authentication and synchronizes users with Strapi.
 */
export default {
  /**
   * Handles Keycloak login and synchronizes the user with Strapi.
   *
   * @async
   * @function login
   * @param {Object} ctx - Koa context.
   * @param {Object} ctx.request - Request object containing body data.
   * @param {Object} ctx.request.body - Request body data.
   * @param {string} ctx.request.body.email - The email address of the user attempting to log in.
   * @param {string} ctx.request.body.password - The password of the user attempting to log in.
   * @returns {Promise<Object>} The response containing JWT and user details.
   * @throws {Error} If authentication fails or credentials are invalid.
   */
  async login(ctx) {
    try {
      /** @type {string} */
      const email = ctx.request.body?.email;
      /** @type {string} */
      const password = ctx.request.body?.password;

      if (!email || !password) {
        return ctx.badRequest('Missing email or password');
      }

      strapi.log.info(`🔵 Authenticating ${email} via Keycloak Passport...`);

      // 🔑 Authenticate with Keycloak using password grant
      const grantManager = getGrantManager(strapi);
      const grant = await grantManager.obtainDirectly(email, password);

      strapi.log.info(`✅ ${email} successfully authenticated via Keycloak.`);

      // 🔍 Extract user info from decoded JWT payload
      const tokenContent = grant.access_token?.content || grant.id_token?.content || {};

      /** @type {Object} */
      const userInfo = {
        sub: tokenContent.sub,
        email: tokenContent.email || email,
        preferred_username: tokenContent.preferred_username,
        given_name: tokenContent.given_name,
        family_name: tokenContent.family_name,
      };

      // If claims are missing from token, fall back to native fetch for userinfo endpoint
      if (!userInfo.sub) {
        const config = strapi.config.get('plugin::strapi-keycloak-passport');
        const userinfoUrl = `${config.KEYCLOAK_AUTH_URL}/realms/${config.KEYCLOAK_REALM}/protocol/openid-connect/userinfo`;
        const response = await fetch(userinfoUrl, {
          headers: { Authorization: `Bearer ${grant.access_token.token}` },
        });
        if (!response.ok) {
          throw new Error(`Keycloak userinfo endpoint error: ${response.status}`);
        }
        const data = await response.json();
        Object.assign(userInfo, data);
      }

      // 🔄 Find or create Strapi admin user
      /** @type {Object} */
      const adminUser = await strapi
        .service('plugin::strapi-keycloak-passport.adminUserService')
        .findOrCreate(userInfo);

      // 🔥 Generate Strapi JWT
      /** @type {string} */
      const jwt = await strapi.admin.services.token.createJwtToken(adminUser);

      // ✅ Store authenticated user in `ctx.state.user`
      ctx.session = {
        ...ctx.session,
        user: adminUser,
      };

      return ctx.send({
        data: {
          token: jwt,
          user: {
            id: adminUser.id,
            firstname: adminUser.firstname,
            lastname: adminUser.lastname,
            username: adminUser.username || null,
            email: adminUser.email,
            isActive: adminUser.isActive,
            blocked: adminUser.blocked || false,
            createdAt: adminUser.createdAt,
            updatedAt: adminUser.updatedAt,
          },
        },
      });
    } catch (error) {
      strapi.log.error(
        `🔴 Authentication Failed for ${ctx.request.body?.email || 'unknown user'}:`,
        error.message
      );

      return ctx.badRequest('Invalid credentials', {
        error: {
          status: error?.status ?? 400,
          name: error?.name ?? 'ApplicationError',
          message: error?.message ?? 'Invalid credentials',
          details: error?.details ?? {},
        },
      });
    }
  },
};
