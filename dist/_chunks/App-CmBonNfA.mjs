import { jsx, jsxs } from "react/jsx-runtime";
import { Page } from "@strapi/strapi/admin";
import { useNotifyAT, Loader, Box, Typography, Alert, Table, Thead, Tr, Th, Tbody, Td, SingleSelect, SingleSelectOption, Flex, Button, DesignSystemProvider } from "@strapi/design-system";
import { Routes, Route } from "react-router-dom";
import { useReducer, useState, useEffect } from "react";
import axios from "axios";
import { Collapse, Check } from "@strapi/icons";
const initialState = {
  keycloakRoles: [],
  strapiRoles: [],
  roleMappings: {},
  loading: true,
  error: null,
  success: false
};
const reducer = (state, action) => {
  switch (action.type) {
    case "SET_DATA":
      return { ...state, ...action.payload, loading: false };
    case "SET_ROLE_MAPPING":
      return {
        ...state,
        roleMappings: { ...state.roleMappings, [action.keycloakRole]: action.strapiRole }
      };
    case "SET_ERROR":
      return { ...state, error: action.error, loading: false };
    case "SET_SUCCESS":
      return { ...state, success: true };
    case "RESET_SUCCESS":
      return { ...state, success: false };
    default:
      return state;
  }
};
const HomePage = () => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [isSaving, setIsSaving] = useState(false);
  useNotifyAT();
  useEffect(() => {
    async function fetchRoles() {
      try {
        const [rolesResponse, mappingsResponse] = await Promise.all([
          axios.get("/strapi-keycloak-passport/keycloak-roles"),
          axios.get("/strapi-keycloak-passport/get-keycloak-role-mappings")
        ]);
        dispatch({
          type: "SET_DATA",
          payload: {
            keycloakRoles: rolesResponse.data.keycloakRoles,
            strapiRoles: rolesResponse.data.strapiRoles,
            roleMappings: mappingsResponse.data
          }
        });
      } catch (err) {
        dispatch({ type: "SET_ERROR", error: "Failed to fetch roles. Please check Keycloak settings." });
      }
    }
    fetchRoles();
  }, []);
  const handleRoleMappingChange = (keycloakRole, strapiRole) => {
    dispatch({ type: "SET_ROLE_MAPPING", keycloakRole, strapiRole });
  };
  const saveMappings = async () => {
    setIsSaving(true);
    try {
      await axios.post("/strapi-keycloak-passport/save-keycloak-role-mappings", { mappings: state.roleMappings });
      dispatch({ type: "SET_SUCCESS" });
      setTimeout(() => dispatch({ type: "RESET_SUCCESS" }), 3e3);
    } catch (error) {
      dispatch({ type: "SET_ERROR", error: "Failed to save mappings. Try again." });
    } finally {
      setIsSaving(false);
    }
  };
  if (state.loading) return /* @__PURE__ */ jsx(Loader, { children: "Loading roles..." });
  return /* @__PURE__ */ jsxs(Box, { padding: 10, background: "neutral0", shadow: "filterShadow", borderRadius: "12px", children: [
    /* @__PURE__ */ jsx(Typography, { variant: "alpha", as: "h1", fontWeight: "bold", children: "Passport Role Mapping" }),
    /* @__PURE__ */ jsx(Box, { paddingTop: 2, paddingBottom: 4, children: /* @__PURE__ */ jsx(Typography, { variant: "epsilon", textColor: "neutral600", paddingTop: 2, paddingBottom: 4, children: "Map Keycloak roles to Strapi admin roles." }) }),
    state.error && /* @__PURE__ */ jsx(Box, { paddingBottom: 4, children: /* @__PURE__ */ jsx(Alert, { title: "Error", variant: "danger", startIcon: /* @__PURE__ */ jsx(Collapse, {}), children: state.error }) }),
    state.success && /* @__PURE__ */ jsx(Box, { paddingBottom: 4, children: /* @__PURE__ */ jsx(Alert, { title: "Success", variant: "success", startIcon: /* @__PURE__ */ jsx(Check, {}), children: "Role mappings saved successfully!" }) }),
    /* @__PURE__ */ jsxs(Box, { background: "transparent", children: [
      /* @__PURE__ */ jsxs(Table, { colCount: 2, rowCount: state.keycloakRoles.length + 1, children: [
        /* @__PURE__ */ jsx(Thead, { children: /* @__PURE__ */ jsxs(Tr, { children: [
          /* @__PURE__ */ jsx(Th, { children: "Keycloak Role" }),
          /* @__PURE__ */ jsx(Th, { children: "Strapi Role" })
        ] }) }),
        /* @__PURE__ */ jsx(Tbody, { children: state.keycloakRoles.map((kcRole) => /* @__PURE__ */ jsxs(Tr, { children: [
          /* @__PURE__ */ jsx(Td, { children: /* @__PURE__ */ jsx(Typography, { textColor: "neutral800", children: kcRole.name }) }),
          /* @__PURE__ */ jsx(Td, { children: /* @__PURE__ */ jsx(
            SingleSelect,
            {
              label: "Select Strapi Role",
              placeholder: "Assign role",
              value: String(state.roleMappings[kcRole.name] || ""),
              onChange: (roleId) => handleRoleMappingChange(kcRole.name, roleId),
              children: state.strapiRoles.map((strapiRole) => /* @__PURE__ */ jsx(
                SingleSelectOption,
                {
                  value: String(strapiRole.id),
                  children: strapiRole.name
                },
                strapiRole.id
              ))
            }
          ) })
        ] }, kcRole.id)) })
      ] }),
      /* @__PURE__ */ jsx(Box, { padding: 4, paddingRight: 8, children: /* @__PURE__ */ jsx(Flex, { justifyContent: "flex-end", children: /* @__PURE__ */ jsx(
        Button,
        {
          onClick: saveMappings,
          variant: "default",
          loading: isSaving,
          disabled: isSaving,
          children: isSaving ? "Saving..." : "Save Mappings"
        }
      ) }) })
    ] })
  ] });
};
const App = () => {
  return /* @__PURE__ */ jsx(DesignSystemProvider, { children: /* @__PURE__ */ jsxs(Routes, { children: [
    /* @__PURE__ */ jsx(Route, { index: true, element: /* @__PURE__ */ jsx(HomePage, {}) }),
    /* @__PURE__ */ jsx(Route, { path: "*", element: /* @__PURE__ */ jsx(Page.Error, {}) })
  ] }) });
};
export {
  App
};
