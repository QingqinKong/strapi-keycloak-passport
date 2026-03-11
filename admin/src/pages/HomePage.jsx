/*
 * HomePage Component
 *
 * @module HomePage
 * @description UI for mapping Keycloak roles to Strapi roles in Strapi Admin panel.
 */

import React, { useReducer, useEffect, useState } from 'react';
import {
  Box,
  Flex,
  Typography,
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  SingleSelect,
  SingleSelectOption,
  Loader,
  Alert,
  useNotifyAT,
} from '@strapi/design-system';
import { Check, Collapse } from '@strapi/icons';

/**
 * @typedef {Object} HomePageState
 * @property {Object[]} keycloakRoles - Array of Keycloak roles.
 * @property {Object[]} strapiRoles - Array of Strapi roles.
 * @property {Object<string, number>} roleMappings - Mapping of Keycloak roles to Strapi role IDs.
 * @property {boolean} loading - Indicates if data is being fetched.
 * @property {string|null} error - Error message (if any).
 * @property {boolean} success - Indicates if mappings were saved successfully.
 */

/**
 * Initial state for the HomePage reducer.
 * @type {HomePageState}
 */
const initialState = {
  keycloakRoles: [],
  strapiRoles: [],
  roleMappings: {},
  loading: true,
  error: null,
  success: false,
};

/**
 * Reducer function to manage HomePage state.
 *
 * @param {HomePageState} state - Current state.
 * @param {Object} action - Dispatched action.
 * @returns {HomePageState} - Updated state.
 */
const reducer = (state, action) => {
  switch (action.type) {
    case 'SET_DATA':
      return { ...state, ...action.payload, loading: false };
    case 'SET_ROLE_MAPPING':
      return {
        ...state,
        roleMappings: { ...state.roleMappings, [action.keycloakRole]: action.strapiRole },
      };
    case 'SET_ERROR':
      return { ...state, error: action.error, loading: false };
    case 'SET_SUCCESS':
      return { ...state, success: true };
    case 'RESET_SUCCESS':
      return { ...state, success: false };
    default:
      return state;
  }
};

/**
 * HomePage Component
 *
 * @returns {JSX.Element} Component for managing role mappings between Keycloak and Strapi.
 */
const HomePage = () => {
  /** @type {HomePageState, React.Dispatch<{ type: string, payload?: any }>}} */
  const [state, dispatch] = useReducer(reducer, initialState);
  const [isSaving, setIsSaving] = useState(false);
  const notifyAT = useNotifyAT();

  useEffect(() => {
    /**
     * Fetches roles from Keycloak and Strapi, and retrieves saved mappings.
     *
     * @async
     * @function fetchRoles
     */
    async function fetchRoles() {
      try {
        const [rolesResponse, mappingsResponse] = await Promise.all([
          fetch('/strapi-keycloak-passport/keycloak-roles'),
          fetch('/strapi-keycloak-passport/get-keycloak-role-mappings'),
        ]);

        if (!rolesResponse.ok || !mappingsResponse.ok) {
          throw new Error('Failed to fetch roles');
        }

        const [rolesData, mappingsData] = await Promise.all([
          rolesResponse.json(),
          mappingsResponse.json(),
        ]);

        dispatch({
          type: 'SET_DATA',
          payload: {
            keycloakRoles: rolesData.keycloakRoles,
            strapiRoles: rolesData.strapiRoles,
            roleMappings: mappingsData,
          },
        });
      } catch (err) {
        dispatch({ type: 'SET_ERROR', error: 'Failed to fetch roles. Please check Keycloak settings.' });
      }
    }

    fetchRoles();
  }, []);

  /**
   * Updates the role mapping state when a role is selected.
   *
   * @param {string} keycloakRole - The Keycloak role name.
   * @param {number} strapiRole - The selected Strapi role ID.
   */
  const handleRoleMappingChange = (keycloakRole, strapiRole) => {
    dispatch({ type: 'SET_ROLE_MAPPING', keycloakRole, strapiRole });
  };

  /**
   * Saves the current role mappings to Strapi.
   *
   * @async
   * @function saveMappings
   */
  const saveMappings = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/strapi-keycloak-passport/save-keycloak-role-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings: state.roleMappings }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save mappings: ${response.status}`);
      }

      dispatch({ type: 'SET_SUCCESS' });

      // Notify screen readers
      // notifyAT('Role mappings saved successfully.');

      setTimeout(() => dispatch({ type: 'RESET_SUCCESS' }), 3000);
    } catch (error) {
      dispatch({ type: 'SET_ERROR', error: 'Failed to save mappings. Try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (state.loading) return <Loader>Loading roles...</Loader>;

  return (
    <Box padding={10} background="neutral0" shadow="filterShadow" borderRadius="12px">
      <Typography variant="alpha" as="h1" fontWeight="bold">
        Passport Role Mapping
      </Typography>

      <Box paddingTop={2} paddingBottom={4}>
        <Typography variant="epsilon" textColor="neutral600" paddingTop={2} paddingBottom={4}>
          Map Keycloak roles to Strapi admin roles.
        </Typography>
      </Box>

      {state.error && (
        <Box paddingBottom={4}>
          <Alert title="Error" variant="danger" startIcon={<Collapse />}>
            {state.error}
          </Alert>
        </Box>
      )}

      {state.success && (
        <Box paddingBottom={4}>
          <Alert title="Success" variant="success" startIcon={<Check />}>
            Role mappings saved successfully!
          </Alert>
        </Box>
      )}

      <Box background="transparent">
        <Table colCount={2} rowCount={state.keycloakRoles.length + 1}>
          <Thead>
            <Tr>
              <Th>Keycloak Role</Th>
              <Th>Strapi Role</Th>
            </Tr>
          </Thead>
          <Tbody>
            {state.keycloakRoles.map((kcRole) => (
              <Tr key={kcRole.id}>
                <Td>
                  <Typography textColor="neutral800">{kcRole.name}</Typography>
                </Td>
                <Td>
                  <SingleSelect
                    label="Select Strapi Role"
                    placeholder="Assign role"
                    value={String(state.roleMappings[kcRole.name] || '')}
                    onChange={(roleId) => handleRoleMappingChange(kcRole.name, roleId)}
                  >
                    {state.strapiRoles.map((strapiRole) => (
                      <SingleSelectOption
                        key={strapiRole.id}
                        value={String(strapiRole.id)}>
                        {strapiRole.name}
                      </SingleSelectOption>
                    ))}
                  </SingleSelect>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>

        <Box padding={4} paddingRight={8}>
          <Flex justifyContent="flex-end">
            <Button
              onClick={saveMappings}
              variant="default"
              loading={isSaving}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Mappings'}
            </Button>
          </Flex>
        </Box>
      </Box>
    </Box>
  );
};

export { HomePage };
