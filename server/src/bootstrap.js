'use strict';

import authController from './controllers/authOverrideController';

/**
 * Inline script injected into every Strapi admin HTML response.
 * Uses a MutationObserver to detect when the login form renders and appends
 * a "Login with Keycloak" anchor tag after the form element.
 * Handles SPA navigation via the popstate event.
 */
const KEYCLOAK_BUTTON_SCRIPT = `<script>
(function () {
  function inject() {
    if (!window.location.pathname.includes('/auth/login')) return;
    if (document.getElementById('kc-sso-btn')) return;
    var form = document.querySelector('form');
    if (!form) return;
    var a = document.createElement('a');
    a.id = 'kc-sso-btn';
    a.href = '/strapi-keycloak-passport/auth/keycloak';
    a.textContent = 'Login with Keycloak';
    a.style = [
      'display:block',
      'width:100%',
      'text-align:center',
      'padding:8px 16px',
      'margin-top:12px',
      'border:1px solid #dcdce4',
      'border-radius:4px',
      'text-decoration:none',
      'color:#32324d',
      'font-weight:600',
      'background:#fff',
      'cursor:pointer',
      'box-sizing:border-box'
    ].join(';');
    form.insertAdjacentElement('afterend', a);
  }
  var obs = new MutationObserver(inject);
  document.addEventListener('DOMContentLoaded', function () {
    obs.observe(document.body, { childList: true, subtree: true });
    inject();
  });
  window.addEventListener('popstate', inject);
}());
</script>`;

/**
 * @module StrapiKeycloakBootstrap
 * @description Bootstraps the Strapi Keycloak Passport Plugin and overrides admin authentication routes.
 * @async
 * @function
 * @param {Object} strapi - The Strapi instance.
 */
const bootstrap = async ({ strapi }) => {
  strapi.log.info('🚀 Strapi Keycloak Passport Plugin Bootstrapped');

  try {
    strapi.log.info('🔍 Registering Keycloak Plugin Permissions...');

    const actions = [
      {
        section: 'plugins',
        displayName: 'Access Keycloak Plugin',
        uid: 'access',
        pluginName: 'strapi-keycloak-passport',
      },
      {
        section: 'plugins',
        displayName: 'View Role Mappings',
        uid: 'view-role-mappings',
        pluginName: 'strapi-keycloak-passport',
      },
      {
        section: 'plugins',
        displayName: 'Manage Role Mappings',
        uid: 'manage-role-mappings',
        pluginName: 'strapi-keycloak-passport',
      },
    ];

    await strapi.admin.services.permission.actionProvider.registerMany(actions);
    strapi.log.info('✅ Keycloak Plugin permissions successfully registered.');
  } catch (error) {
    strapi.log.error('❌ Failed to register Keycloak Plugin permissions:', error);
  }

  // ✅ Ensure Default Role Mapping Exists
  await ensureDefaultRoleMapping(strapi);

  // ✅ Inject "Login with Keycloak" button into the admin panel HTML
  injectKeycloakButton(strapi);

  // ✅ Apply Middleware to Intercept `/admin/login` Before Strapi Handles It
  overrideAdminRoutes(strapi);

  strapi.log.info('🔒 Passport Keycloak Strategy Initialized');
};

/**
 * Registers a Koa middleware that injects a "Login with Keycloak" button script
 * into admin HTML responses.  Handles stream bodies produced by koa-static by
 * reading them into a string, modifying the HTML, and resetting ctx.body.
 *
 * @function injectKeycloakButton
 * @param {Object} strapi - The Strapi instance.
 */
function injectKeycloakButton(strapi) {
  strapi.server.use(async (ctx, next) => {
    await next();

    // Only process HTML responses
    if (!ctx.response.type?.includes('text/html')) return;

    // Read body regardless of type (stream, Buffer, or string)
    let body = ctx.body;
    if (body && typeof body.pipe === 'function') {
      // koa-static serves files as a ReadStream – drain it
      const chunks = [];
      for await (const chunk of body) {
        chunks.push(chunk);
      }
      body = Buffer.concat(chunks).toString('utf8');
    } else if (Buffer.isBuffer(body)) {
      body = body.toString('utf8');
    }

    if (typeof body !== 'string' || !body.includes('</body>')) return;

    // Remove Content-Length set by koa-static (now incorrect after modification)
    ctx.response.remove('Content-Length');

    ctx.body = body.replace('</body>', KEYCLOAK_BUTTON_SCRIPT + '</body>');
  });
}

/**
 * Overrides admin authentication routes to use Keycloak.
 *
 * @function overrideAdminRoutes
 * @param {Object} strapi - The Strapi instance.
 */
function overrideAdminRoutes(strapi) {
  try {
    strapi.log.info('🛠 Applying Keycloak Authentication Middleware...');

    strapi.server.use(async (ctx, next) => {
      /** @type {string} */
      const requestPath = ctx.request.path;
      /** @type {string} */
      const requestMethod = ctx.request.method;

      if (requestPath === '/admin/login' && requestMethod === 'POST') {
        await authController.login(ctx);
      } else if (
        (
          requestPath.includes('auth/reset-password') ||
          requestPath.includes('auth/forgot-password') ||
          requestPath.includes('auth/register')) &&
        requestMethod === 'GET'
      ) {
        return ctx.redirect('/admin/login');
      } else {
        await next();
      }
    });

    strapi.log.info(`

    ╔════════════════════════════════╗
    ║      🛡️ PASSPORT APPLIED 🛡️      ║
    ╚════════════════════════════════╝
    `);
    strapi.log.info('🚴 Admin login request rerouted to passport.');
    strapi.log.info('📒 Registration route blocked. 🚫');
    strapi.log.info('🕵️‍♂️ Reset password route blocked. 🚫');
  } catch (error) {
    strapi.log.error('❌ Failed to register Keycloak Middleware:', error);
  }
}

/**
 * Ensures a default role mapping (SUPER_ADMIN -> Role ID 1) is created in the database.
 *
 * @async
 * @function ensureDefaultRoleMapping
 * @param {Object} strapi - The Strapi instance.
 */
async function ensureDefaultRoleMapping(strapi) {
  try {
    /** @type {Object} */
    const superAdminRole = await strapi.db
      .query('admin::role')
      .findOne({ where: { code: 'strapi-super-admin' } });

    if (!superAdminRole) {
      strapi.log.warn('⚠️ Super Admin role not found. Skipping default role mapping.');
      return;
    }

    /** @type {Object} */
    const DEFAULT_MAPPING = {
      keycloakRole: 'ROLE_ADMIN',
      strapiRole: superAdminRole.id, // 🔹 Fetch role ID dynamically
    };

    /** @type {Object} */
    const existingMapping = await strapi.db
      .query('plugin::strapi-keycloak-passport.role-mapping')
      .findOne({ where: { keycloakRole: DEFAULT_MAPPING.keycloakRole } });

    if (!existingMapping) {
      await strapi.db
        .query('plugin::strapi-keycloak-passport.role-mapping')
        .create({ data: DEFAULT_MAPPING });

      strapi.log.info(`✅ Default Role Mapping Created: ${DEFAULT_MAPPING.keycloakRole} -> ${DEFAULT_MAPPING.strapiRole} (mapped to Super Admin Role)`);
    } else {
      strapi.log.info(`✅ Default Role Mapping Already Exists: ${existingMapping.keycloakRole} -> ${existingMapping.strapiRole} (mapping to Super Admin Role)`);
    }
  } catch (error) {
    strapi.log.error('❌ Failed to create default role mapping:', error);
  }
}

export default bootstrap;
