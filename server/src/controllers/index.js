'use strict';

/**
 * @module Controllers
 * @description Registers all controllers for the Strapi Keycloak Passport Plugin.
 */

import authController from './authController';
import authOverrideController from './authOverrideController';
import keycloakAuthController from './keycloakAuthController';

export default {
  authController,
  authOverrideController,
  keycloakAuthController,
};