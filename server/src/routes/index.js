import checkAdminPermission from '../middlewares/checkAdminPermission';

/**
 * Strapi Keycloak Passport Plugin Routes (Strapi v5)
 *
 * @module Routes
 */
const routes = [
  // ✅ Keycloak Authorization Code Flow – initiate redirect
  {
    method: 'GET',
    path: '/auth/keycloak',
    handler: 'keycloakAuthController.initiate',
    config: {
      auth: false,
    },
  },

  // ✅ Keycloak Authorization Code Flow – callback (code exchange)
  {
    method: 'GET',
    path: '/auth/keycloak/callback',
    handler: 'keycloakAuthController.callback',
    config: {
      auth: false,
    },
  },

  // ✅ Override Admin Login with Keycloak (password grant – backward compat)
  {
    method: 'POST',
    path: '/admin/login',
    handler: 'authOverrideController.login',
    config: {
      auth: false, // No auth required for login
    },
  },

  // ✅ Get Keycloak Roles (Admin Permission Required)
  {
    method: 'GET',
    path: '/keycloak-roles',
    handler: 'authController.getRoles',
    config: {
      auth: false,
      policies: [],
      middlewares: [checkAdminPermission('plugin::strapi-keycloak-passport.access')],
    },
  },

  // ✅ Get Role Mappings (Admin Permission Required)
  {
    method: 'GET',
    path: '/get-keycloak-role-mappings',
    handler: 'authController.getRoleMappings',
    config: {
      auth: false, // ✅ Required for admin data access
      policies: [],
      middlewares: [checkAdminPermission('plugin::strapi-keycloak-passport.view-role-mappings')],
    },
  },

  // ✅ Save Role Mappings (Requires Manage Permission)
  {
    method: 'POST',
    path: '/save-keycloak-role-mappings',
    handler: 'authController.saveRoleMappings',
    config: {
      auth: false, // ✅ Ensures only admins can perform this action
      policies: [],
      middlewares: [checkAdminPermission('plugin::strapi-keycloak-passport.manage-role-mappings')],
    },
  },
];

export default routes;