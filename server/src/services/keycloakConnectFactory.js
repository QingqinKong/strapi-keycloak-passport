import Keycloak from 'keycloak-connect';

/**
 * @module KeycloakConnectFactory
 * @description Singleton factory for keycloak-connect instances.
 * Provides a GrantManager for OAuth2/OIDC token operations.
 * Admin REST API calls must use native fetch (not covered by keycloak-connect).
 */

/** @type {Keycloak|null} */
let keycloakInstance = null;

/**
 * Builds the keycloak-connect config from plugin config.
 *
 * @param {Object} config - Plugin config from strapi.config.get(...)
 * @returns {Object} keycloak-connect config object
 */
function buildKcConfig(config) {
  return {
    realm: config.KEYCLOAK_REALM,
    'auth-server-url': config.KEYCLOAK_AUTH_URL,
    resource: config.KEYCLOAK_CLIENT_ID,
    credentials: {
      secret: config.KEYCLOAK_CLIENT_SECRET,
    },
    'ssl-required': 'external',
  };
}

/**
 * Returns the cached Keycloak instance, creating it if needed.
 * Passing {} as the store disables session middleware (we only use GrantManager).
 *
 * @param {Object} strapi - Strapi instance
 * @returns {Keycloak} keycloak-connect Keycloak instance
 */
function getKeycloakInstance(strapi) {
  if (!keycloakInstance) {
    const config = strapi.config.get('plugin::strapi-keycloak-passport');
    const kcConfig = buildKcConfig(config);
    keycloakInstance = new Keycloak({}, kcConfig);
  }
  return keycloakInstance;
}

/**
 * Returns the GrantManager for performing OAuth2/OIDC token operations.
 *
 * @param {Object} strapi - Strapi instance
 * @returns {import('keycloak-connect').GrantManager} Grant manager instance
 */
export function getGrantManager(strapi) {
  return getKeycloakInstance(strapi).grantManager;
}

/**
 * Returns the raw keycloak-connect config (useful for constructing admin API URLs).
 *
 * @param {Object} strapi - Strapi instance
 * @returns {Object} keycloak-connect config
 */
export function getKeycloakConfig(strapi) {
  const config = strapi.config.get('plugin::strapi-keycloak-passport');
  return buildKcConfig(config);
}
