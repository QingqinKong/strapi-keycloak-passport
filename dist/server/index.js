"use strict";
const Keycloak = require("keycloak-connect");
const _interopDefault = (e) => e && e.__esModule ? e : { default: e };
const Keycloak__default = /* @__PURE__ */ _interopDefault(Keycloak);
let keycloakInstance = null;
function buildKcConfig(config2) {
  return {
    realm: config2.KEYCLOAK_REALM,
    "auth-server-url": config2.KEYCLOAK_AUTH_URL,
    resource: config2.KEYCLOAK_CLIENT_ID,
    credentials: {
      secret: config2.KEYCLOAK_CLIENT_SECRET
    },
    "ssl-required": "external"
  };
}
function getKeycloakInstance(strapi2) {
  if (!keycloakInstance) {
    const config2 = strapi2.config.get("plugin::strapi-keycloak-passport");
    const kcConfig = buildKcConfig(config2);
    keycloakInstance = new Keycloak__default.default({}, kcConfig);
  }
  return keycloakInstance;
}
function getGrantManager(strapi2) {
  return getKeycloakInstance(strapi2).grantManager;
}
const authOverrideController = {
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
      const email = ctx.request.body?.email;
      const password = ctx.request.body?.password;
      if (!email || !password) {
        return ctx.badRequest("Missing email or password");
      }
      strapi.log.info(`🔵 Authenticating ${email} via Keycloak Passport...`);
      const grantManager = getGrantManager(strapi);
      const grant = await grantManager.obtainDirectly(email, password);
      strapi.log.info(`✅ ${email} successfully authenticated via Keycloak.`);
      const tokenContent = grant.access_token?.content || grant.id_token?.content || {};
      const userInfo = {
        sub: tokenContent.sub,
        email: tokenContent.email || email,
        preferred_username: tokenContent.preferred_username,
        given_name: tokenContent.given_name,
        family_name: tokenContent.family_name
      };
      if (!userInfo.sub) {
        const config2 = strapi.config.get("plugin::strapi-keycloak-passport");
        const userinfoUrl = `${config2.KEYCLOAK_AUTH_URL}/realms/${config2.KEYCLOAK_REALM}/protocol/openid-connect/userinfo`;
        const response = await fetch(userinfoUrl, {
          headers: { Authorization: `Bearer ${grant.access_token.token}` }
        });
        if (!response.ok) {
          throw new Error(`Keycloak userinfo endpoint error: ${response.status}`);
        }
        const data = await response.json();
        Object.assign(userInfo, data);
      }
      const adminUser = await strapi.service("plugin::strapi-keycloak-passport.adminUserService").findOrCreate(userInfo);
      const jwt = await strapi.admin.services.token.createJwtToken(adminUser);
      ctx.session = {
        ...ctx.session,
        user: adminUser
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
            updatedAt: adminUser.updatedAt
          }
        }
      });
    } catch (error) {
      strapi.log.error(
        `🔴 Authentication Failed for ${ctx.request.body?.email || "unknown user"}:`,
        error.message
      );
      return ctx.badRequest("Invalid credentials", {
        error: {
          status: error?.status ?? 400,
          name: error?.name ?? "ApplicationError",
          message: error?.message ?? "Invalid credentials",
          details: error?.details ?? {}
        }
      });
    }
  }
};
const bootstrap = async ({ strapi: strapi2 }) => {
  strapi2.log.info("🚀 Strapi Keycloak Passport Plugin Bootstrapped");
  try {
    strapi2.log.info("🔍 Registering Keycloak Plugin Permissions...");
    const actions = [
      {
        section: "plugins",
        displayName: "Access Keycloak Plugin",
        uid: "access",
        pluginName: "strapi-keycloak-passport"
      },
      {
        section: "plugins",
        displayName: "View Role Mappings",
        uid: "view-role-mappings",
        pluginName: "strapi-keycloak-passport"
      },
      {
        section: "plugins",
        displayName: "Manage Role Mappings",
        uid: "manage-role-mappings",
        pluginName: "strapi-keycloak-passport"
      }
    ];
    await strapi2.admin.services.permission.actionProvider.registerMany(actions);
    strapi2.log.info("✅ Keycloak Plugin permissions successfully registered.");
  } catch (error) {
    strapi2.log.error("❌ Failed to register Keycloak Plugin permissions:", error);
  }
  await ensureDefaultRoleMapping(strapi2);
  overrideAdminRoutes(strapi2);
  strapi2.log.info("🔒 Passport Keycloak Strategy Initialized");
};
function overrideAdminRoutes(strapi2) {
  try {
    strapi2.log.info("🛠 Applying Keycloak Authentication Middleware...");
    strapi2.server.use(async (ctx, next) => {
      const requestPath = ctx.request.path;
      const requestMethod = ctx.request.method;
      if (requestPath === "/admin/login" && requestMethod === "POST") {
        await authOverrideController.login(ctx);
      } else if ((requestPath.includes("auth/reset-password") || requestPath.includes("auth/forgot-password") || requestPath.includes("auth/register")) && requestMethod === "GET") {
        return ctx.redirect("/admin/login");
      } else {
        await next();
      }
    });
    strapi2.log.info(`

    ╔════════════════════════════════╗
    ║      🛡️ PASSPORT APPLIED 🛡️      ║
    ╚════════════════════════════════╝
    `);
    strapi2.log.info("🚴 Admin login request rerouted to passport.");
    strapi2.log.info("📒 Registration route blocked. 🚫");
    strapi2.log.info("🕵️‍♂️ Reset password route blocked. 🚫");
  } catch (error) {
    strapi2.log.error("❌ Failed to register Keycloak Middleware:", error);
  }
}
async function ensureDefaultRoleMapping(strapi2) {
  try {
    const superAdminRole = await strapi2.db.query("admin::role").findOne({ where: { code: "strapi-super-admin" } });
    if (!superAdminRole) {
      strapi2.log.warn("⚠️ Super Admin role not found. Skipping default role mapping.");
      return;
    }
    const DEFAULT_MAPPING = {
      keycloakRole: "ROLE_ADMIN",
      strapiRole: superAdminRole.id
      // 🔹 Fetch role ID dynamically
    };
    const existingMapping = await strapi2.db.query("plugin::strapi-keycloak-passport.role-mapping").findOne({ where: { keycloakRole: DEFAULT_MAPPING.keycloakRole } });
    if (!existingMapping) {
      await strapi2.db.query("plugin::strapi-keycloak-passport.role-mapping").create({ data: DEFAULT_MAPPING });
      strapi2.log.info(`✅ Default Role Mapping Created: ${DEFAULT_MAPPING.keycloakRole} -> ${DEFAULT_MAPPING.strapiRole} (mapped to Super Admin Role)`);
    } else {
      strapi2.log.info(`✅ Default Role Mapping Already Exists: ${existingMapping.keycloakRole} -> ${existingMapping.strapiRole} (mapping to Super Admin Role)`);
    }
  } catch (error) {
    strapi2.log.error("❌ Failed to create default role mapping:", error);
  }
}
const destroy = ({ strapi: strapi2 }) => {
};
const register = ({ strapi: strapi2 }) => {
  strapi2.log.info("🔄 Registering Strapi Keycloak Passport Plugin...");
};
const config = {
  default: {
    KEYCLOAK_AUTH_URL: "",
    KEYCLOAK_REALM: "",
    KEYCLOAK_CLIENT_ID: "",
    KEYCLOAK_CLIENT_SECRET: "",
    // Deprecated: keycloak-connect auto-derives these from KEYCLOAK_AUTH_URL + KEYCLOAK_REALM.
    // Kept for backward compatibility with existing user configs.
    KEYCLOAK_TOKEN_URL: "",
    KEYCLOAK_USERINFO_URL: "",
    roleConfigs: {
      defaultRoleId: 5,
      excludedRoles: []
    }
  },
  validator(config2) {
    if (!config2.KEYCLOAK_AUTH_URL) {
      throw new Error("Missing KEYCLOAK_AUTH_URL in plugin config.");
    }
    if (!config2.KEYCLOAK_REALM) {
      throw new Error("Missing KEYCLOAK_REALM in plugin config.");
    }
    if (!config2.KEYCLOAK_CLIENT_ID) {
      throw new Error("Missing KEYCLOAK_CLIENT_ID in plugin config.");
    }
    if (!config2.KEYCLOAK_CLIENT_SECRET) {
      throw new Error("Missing KEYCLOAK_CLIENT_SECRET in plugin config.");
    }
  }
};
const kind = "collectionType";
const uid = "plugin::strapi-keycloak-passport.role-mapping";
const info = {
  singularName: "role-mapping",
  pluralName: "role-mappings",
  displayName: "Role Mapping",
  description: "Maps Keycloak roles to Strapi roles."
};
const attributes = {
  keycloakRole: {
    type: "string",
    minLength: 3,
    maxLength: 100,
    required: true
  },
  strapiRole: {
    type: "integer",
    required: true
  }
};
const schema = {
  kind,
  uid,
  info,
  attributes
};
const roleMapping = {
  schema
};
const contentTypes = {
  "role-mapping": roleMapping
};
const authController = {
  /**
   * Fetches all Keycloak roles and Strapi admin roles.
   *
   * @async
   * @function getRoles
   * @param {Object} ctx - Koa context.
   * @returns {Promise<Object>} - Object containing Keycloak roles and Strapi roles.
   * @throws {Error} If fetching roles fails.
   */
  async getRoles(ctx) {
    try {
      const config2 = strapi.config.get("plugin::strapi-keycloak-passport");
      const accessToken = await strapi.plugin("strapi-keycloak-passport").service("keycloakService").fetchAdminToken();
      const url = `${config2.KEYCLOAK_AUTH_URL}/admin/realms/${config2.KEYCLOAK_REALM}/roles`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch roles: ${response.status}`);
      }
      const data = await response.json();
      const keycloakRoles = data.filter(
        (role) => !config2.roleConfigs.excludedRoles.includes(role.name)
      );
      const strapiRoles = await strapi.entityService.findMany("admin::role", {});
      return ctx.send({ keycloakRoles, strapiRoles });
    } catch (error) {
      strapi.log.error(
        '❌ Failed to fetch Keycloak roles: Have you tried giving the role "MANAGE-REALM" and "MANAGE-USERS"?',
        error.message
      );
      return ctx.badRequest("Failed to fetch Keycloak roles");
    }
  },
  /**
   * Retrieves Keycloak-to-Strapi role mappings.
   *
   * @async
   * @function getRoleMappings
   * @param {Object} ctx - Koa context.
   * @returns {Promise<Object>} - Object mapping Keycloak roles to Strapi roles.
   * @throws {Error} If retrieval fails.
   */
  async getRoleMappings(ctx) {
    try {
      const mappings = await strapi.service("plugin::strapi-keycloak-passport.roleMappingService").getMappings();
      const formattedMappings = mappings.reduce((acc, mapping) => {
        acc[mapping.keycloakRole] = mapping.strapiRole;
        return acc;
      }, {});
      return ctx.send(formattedMappings);
    } catch (error) {
      strapi.log.error("❌ Failed to retrieve role mappings:", error.message);
      return ctx.badRequest("Failed to retrieve role mappings");
    }
  },
  /**
   * Saves Keycloak-to-Strapi role mappings.
   *
   * @async
   * @function saveRoleMappings
   * @param {Object} ctx - Koa context.
   * @param {Object} ctx.request - Request object.
   * @param {Object} ctx.request.body - Request body containing role mappings.
   * @param {Object<string, number>} ctx.request.body.mappings - Object mapping Keycloak roles to Strapi roles.
   * @returns {Promise<Object>} - Confirmation message.
   * @throws {Error} If saving fails.
   */
  async saveRoleMappings(ctx) {
    try {
      const { mappings } = ctx.request.body;
      await strapi.plugin("strapi-keycloak-passport").service("roleMappingService").saveMappings(mappings);
      return ctx.send({ message: "Mappings saved successfully." });
    } catch (error) {
      strapi.log.error("❌ Failed to save role mappings:", error.message);
      return ctx.badRequest("Failed to save role mappings");
    }
  }
};
const controllers = {
  authController,
  authOverrideController
};
const checkAdminPermission = (requiredPermission) => async (ctx, next) => {
  try {
    const adminUser = ctx.session.user;
    if (!adminUser) {
      return ctx.unauthorized("User is not authenticated.");
    }
    const [roleId] = adminUser.roles.map((role) => role.id);
    const adminPermissions = await strapi.admin.services.permission.findMany({
      where: {
        role: roleId,
        action: requiredPermission
      }
    });
    if (adminPermissions.length === 0) {
      return ctx.forbidden(`Access denied. Missing permission: ${requiredPermission}`);
    }
    await next();
  } catch (error) {
    strapi.log.error("🔴 Error checking admin permission:", error);
    return ctx.internalServerError("Failed to verify permissions.");
  }
};
const middlewares = {
  checkAdminPermission
  // authMiddleware,
};
const policies = {};
const routes = [
  // ✅ Override Admin Login with Keycloak
  {
    method: "POST",
    path: "/admin/login",
    handler: "authOverrideController.login",
    config: {
      auth: false
      // No auth required for login
    }
  },
  // ✅ Get Keycloak Roles (Admin Permission Required)
  {
    method: "GET",
    path: "/keycloak-roles",
    handler: "authController.getRoles",
    config: {
      auth: false,
      policies: [],
      middlewares: [checkAdminPermission("plugin::strapi-keycloak-passport.access")]
    }
  },
  // ✅ Get Role Mappings (Admin Permission Required)
  {
    method: "GET",
    path: "/get-keycloak-role-mappings",
    handler: "authController.getRoleMappings",
    config: {
      auth: false,
      // ✅ Required for admin data access
      policies: [],
      middlewares: [checkAdminPermission("plugin::strapi-keycloak-passport.view-role-mappings")]
    }
  },
  // ✅ Save Role Mappings (Requires Manage Permission)
  {
    method: "POST",
    path: "/save-keycloak-role-mappings",
    handler: "authController.saveRoleMappings",
    config: {
      auth: false,
      // ✅ Ensures only admins can perform this action
      policies: [],
      middlewares: [checkAdminPermission("plugin::strapi-keycloak-passport.manage-role-mappings")]
    }
  }
];
const adminUserService = ({ strapi: strapi2 }) => ({
  /**
   * Finds or creates an admin user in Strapi and assigns the correct role.
   *
   * @async
   * @function findOrCreate
   * @param {Object} userInfo - The user data from Keycloak.
   * @param {string} userInfo.email - User's email.
   * @param {string} [userInfo.preferred_username] - Preferred username.
   * @param {string} [userInfo.given_name] - First name.
   * @param {string} [userInfo.family_name] - Last name.
   * @param {string} userInfo.sub - Unique Keycloak user ID.
   * @returns {Promise<Object>} The created or updated Strapi admin user.
   */
  async findOrCreate(userInfo) {
    try {
      const email = userInfo.email;
      const username = userInfo.preferred_username || "";
      const firstname = userInfo.given_name || "";
      const lastname = userInfo.family_name || "";
      const keycloakUserId = userInfo.sub;
      const [adminUser] = await strapi2.entityService.findMany("admin::user", {
        filters: { email },
        populate: { roles: true },
        limit: 1
      });
      const roleMappings = await strapi2.service("plugin::strapi-keycloak-passport.roleMappingService").getMappings();
      const DEFAULT_ROLE_ID = strapi2.config.get("plugin::strapi-keycloak-passport").roleConfigs.defaultRoleId;
      let appliedRoles = /* @__PURE__ */ new Set();
      try {
        const keycloakRoles = await fetchKeycloakUserRoles(keycloakUserId, strapi2);
        keycloakRoles.forEach((role) => {
          const mappedRole = roleMappings.find((mapped) => mapped.keycloakRole === role);
          if (mappedRole) appliedRoles.add(mappedRole.strapiRole);
        });
      } catch (error) {
        strapi2.log.error("❌ Failed to fetch user roles from Keycloak:", error.message);
        throw new Error("Failed to fetch user permission.");
      }
      if (!appliedRoles.size) {
        strapi2.log.warn(`⚠️ No roles found for user:${email} in Keycloak.`);
        throw new Error("No permission found.");
      }
      const userRoles = appliedRoles.size ? Array.from(appliedRoles) : [DEFAULT_ROLE_ID];
      if (!adminUser) {
        await strapi2.entityService.create("admin::user", {
          data: {
            email,
            firstname,
            lastname,
            username,
            isActive: true,
            roles: userRoles
          }
        });
      }
      if (JSON.stringify(adminUser.roles) !== JSON.stringify(userRoles)) {
        await strapi2.documents("admin::user").update({
          documentId: adminUser.documentId,
          data: {
            firstname,
            lastname,
            roles: userRoles
          }
        });
      }
      return adminUser;
    } catch (error) {
      strapi2.log.error("❌ Failed to create/update user:", error.message);
      throw new Error("Failed to create/update user.");
    }
  }
});
async function fetchKeycloakUserRoles(keycloakUserId, strapi2) {
  if (!keycloakUserId) throw new Error("❌ Keycloak user ID is missing!");
  const config2 = strapi2.config.get("plugin::strapi-keycloak-passport");
  try {
    const accessToken = await strapi2.plugin("strapi-keycloak-passport").service("keycloakService").fetchAdminToken();
    const url = `${config2.KEYCLOAK_AUTH_URL}/admin/realms/${config2.KEYCLOAK_REALM}/users/${keycloakUserId}/role-mappings/realm`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok) {
      throw new Error(`Keycloak admin API error: ${response.status}`);
    }
    const data = await response.json();
    return data.map((role) => role.name);
  } catch (error) {
    strapi2.log.error("❌ Failed to fetch Keycloak user roles:", error.message);
    throw new Error("Failed to fetch Keycloak user roles.");
  }
}
const roleMappingService = ({ strapi: strapi2 }) => ({
  /**
   * Saves the given role mappings to the database.
   *
   * @async
   * @function saveMappings
   * @param {Object<string, number>} mappings - The role mappings.
   * @returns {Promise<void>} - Resolves when role mappings are saved.
   */
  async saveMappings(mappings) {
    try {
      await strapi2.db.query("plugin::strapi-keycloak-passport.role-mapping").deleteMany({
        where: {
          id: {
            $notNull: true
          }
        }
      });
      for (const [keycloakRole, strapiRole] of Object.entries(mappings)) {
        await strapi2.entityService.create("plugin::strapi-keycloak-passport.role-mapping", {
          data: { keycloakRole, strapiRole }
        });
      }
      strapi2.log.info("✅ Role mappings saved successfully.");
    } catch (error) {
      strapi2.log.error("❌ Failed to save role mappings:", error);
      throw new Error("Failed to save role mappings.");
    }
  },
  /**
   * Retrieves all role mappings from the database.
   *
   * @async
   * @function getMappings
   * @returns {Promise<RoleMapping[]>} - List of role mappings.
   */
  async getMappings() {
    try {
      const roleMappings = await strapi2.entityService.findMany("plugin::strapi-keycloak-passport.role-mapping", {});
      return roleMappings;
    } catch (error) {
      strapi2.log.error("❌ Failed to retrieve role mappings:", error);
      throw new Error("Failed to retrieve role mappings.");
    }
  }
});
const keycloakService = ({ strapi: strapi2 }) => ({
  /**
   * Fetches an admin access token from Keycloak using client credentials grant.
   *
   * @async
   * @function fetchAdminToken
   * @returns {Promise<string>} The Keycloak access token.
   * @throws {Error} If authentication fails.
   */
  async fetchAdminToken() {
    try {
      const grantManager = getGrantManager(strapi2);
      const grant = await grantManager.obtainFromClientCredentials();
      const accessToken = grant.access_token?.token;
      if (!accessToken) {
        throw new Error("Keycloak returned an empty access token");
      }
      strapi2.log.info("✅ Successfully fetched Keycloak admin token.");
      return accessToken;
    } catch (error) {
      strapi2.log.error("❌ Keycloak Admin Token Fetch Error:", error.message);
      throw new Error("Failed to fetch Keycloak admin token");
    }
  }
});
const services = {
  adminUserService,
  roleMappingService,
  keycloakService
};
const index = {
  bootstrap,
  destroy,
  register,
  config,
  controllers,
  contentTypes,
  middlewares,
  policies,
  routes,
  services
};
module.exports = index;
