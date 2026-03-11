import { getGrantManager } from './keycloakConnectFactory';

/**
 * @module KeycloakService
 * @description Handles Keycloak authentication and provides utility functions.
 * @param {Object} strapi - Strapi instance.
 * @returns {Object} - Keycloak service methods.
 */
const keycloakService = ({ strapi }) => ({
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
      const grantManager = getGrantManager(strapi);
      const grant = await grantManager.obtainFromClientCredentials();

      /** @type {string | undefined} */
      const accessToken = grant.access_token?.token;

      if (!accessToken) {
        throw new Error('Keycloak returned an empty access token');
      }

      strapi.log.info('✅ Successfully fetched Keycloak admin token.');
      return accessToken;
    } catch (error) {
      strapi.log.error('❌ Keycloak Admin Token Fetch Error:', error.message);
      throw new Error('Failed to fetch Keycloak admin token');
    }
  },
});

export default keycloakService;
