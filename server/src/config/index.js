export default {
  default: {
    KEYCLOAK_AUTH_URL: '',
    KEYCLOAK_REALM: '',
    KEYCLOAK_CLIENT_ID: '',
    KEYCLOAK_CLIENT_SECRET: '',
    // Deprecated: keycloak-connect auto-derives these from KEYCLOAK_AUTH_URL + KEYCLOAK_REALM.
    // Kept for backward compatibility with existing user configs.
    KEYCLOAK_TOKEN_URL: '',
    KEYCLOAK_USERINFO_URL: '',
    roleConfigs: {
      defaultRoleId: 5,
      excludedRoles: [],
    },
  },
  validator(config) {
    if (!config.KEYCLOAK_AUTH_URL) {
      throw new Error('Missing KEYCLOAK_AUTH_URL in plugin config.');
    }
    if (!config.KEYCLOAK_REALM) {
      throw new Error('Missing KEYCLOAK_REALM in plugin config.');
    }
    if (!config.KEYCLOAK_CLIENT_ID) {
      throw new Error('Missing KEYCLOAK_CLIENT_ID in plugin config.');
    }
    if (!config.KEYCLOAK_CLIENT_SECRET) {
      throw new Error('Missing KEYCLOAK_CLIENT_SECRET in plugin config.');
    }
  },
};
