"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const jsxRuntime = require("react/jsx-runtime");
const admin = require("@strapi/strapi/admin");
const designSystem = require("@strapi/design-system");
const reactRouterDom = require("react-router-dom");
const react = require("react");
const axios = require("axios");
const icons = require("@strapi/icons");
const _interopDefault = (e) => e && e.__esModule ? e : { default: e };
const axios__default = /* @__PURE__ */ _interopDefault(axios);
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
  const [state, dispatch] = react.useReducer(reducer, initialState);
  const [isSaving, setIsSaving] = react.useState(false);
  designSystem.useNotifyAT();
  react.useEffect(() => {
    async function fetchRoles() {
      try {
        const [rolesResponse, mappingsResponse] = await Promise.all([
          axios__default.default.get("/strapi-keycloak-passport/keycloak-roles"),
          axios__default.default.get("/strapi-keycloak-passport/get-keycloak-role-mappings")
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
      await axios__default.default.post("/strapi-keycloak-passport/save-keycloak-role-mappings", { mappings: state.roleMappings });
      dispatch({ type: "SET_SUCCESS" });
      setTimeout(() => dispatch({ type: "RESET_SUCCESS" }), 3e3);
    } catch (error) {
      dispatch({ type: "SET_ERROR", error: "Failed to save mappings. Try again." });
    } finally {
      setIsSaving(false);
    }
  };
  if (state.loading) return /* @__PURE__ */ jsxRuntime.jsx(designSystem.Loader, { children: "Loading roles..." });
  return /* @__PURE__ */ jsxRuntime.jsxs(designSystem.Box, { padding: 10, background: "neutral0", shadow: "filterShadow", borderRadius: "12px", children: [
    /* @__PURE__ */ jsxRuntime.jsx(designSystem.Typography, { variant: "alpha", as: "h1", fontWeight: "bold", children: "Passport Role Mapping" }),
    /* @__PURE__ */ jsxRuntime.jsx(designSystem.Box, { paddingTop: 2, paddingBottom: 4, children: /* @__PURE__ */ jsxRuntime.jsx(designSystem.Typography, { variant: "epsilon", textColor: "neutral600", paddingTop: 2, paddingBottom: 4, children: "Map Keycloak roles to Strapi admin roles." }) }),
    state.error && /* @__PURE__ */ jsxRuntime.jsx(designSystem.Box, { paddingBottom: 4, children: /* @__PURE__ */ jsxRuntime.jsx(designSystem.Alert, { title: "Error", variant: "danger", startIcon: /* @__PURE__ */ jsxRuntime.jsx(icons.Collapse, {}), children: state.error }) }),
    state.success && /* @__PURE__ */ jsxRuntime.jsx(designSystem.Box, { paddingBottom: 4, children: /* @__PURE__ */ jsxRuntime.jsx(designSystem.Alert, { title: "Success", variant: "success", startIcon: /* @__PURE__ */ jsxRuntime.jsx(icons.Check, {}), children: "Role mappings saved successfully!" }) }),
    /* @__PURE__ */ jsxRuntime.jsxs(designSystem.Box, { background: "transparent", children: [
      /* @__PURE__ */ jsxRuntime.jsxs(designSystem.Table, { colCount: 2, rowCount: state.keycloakRoles.length + 1, children: [
        /* @__PURE__ */ jsxRuntime.jsx(designSystem.Thead, { children: /* @__PURE__ */ jsxRuntime.jsxs(designSystem.Tr, { children: [
          /* @__PURE__ */ jsxRuntime.jsx(designSystem.Th, { children: "Keycloak Role" }),
          /* @__PURE__ */ jsxRuntime.jsx(designSystem.Th, { children: "Strapi Role" })
        ] }) }),
        /* @__PURE__ */ jsxRuntime.jsx(designSystem.Tbody, { children: state.keycloakRoles.map((kcRole) => /* @__PURE__ */ jsxRuntime.jsxs(designSystem.Tr, { children: [
          /* @__PURE__ */ jsxRuntime.jsx(designSystem.Td, { children: /* @__PURE__ */ jsxRuntime.jsx(designSystem.Typography, { textColor: "neutral800", children: kcRole.name }) }),
          /* @__PURE__ */ jsxRuntime.jsx(designSystem.Td, { children: /* @__PURE__ */ jsxRuntime.jsx(
            designSystem.SingleSelect,
            {
              label: "Select Strapi Role",
              placeholder: "Assign role",
              value: String(state.roleMappings[kcRole.name] || ""),
              onChange: (roleId) => handleRoleMappingChange(kcRole.name, roleId),
              children: state.strapiRoles.map((strapiRole) => /* @__PURE__ */ jsxRuntime.jsx(
                designSystem.SingleSelectOption,
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
      /* @__PURE__ */ jsxRuntime.jsx(designSystem.Box, { padding: 4, paddingRight: 8, children: /* @__PURE__ */ jsxRuntime.jsx(designSystem.Flex, { justifyContent: "flex-end", children: /* @__PURE__ */ jsxRuntime.jsx(
        designSystem.Button,
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
  return /* @__PURE__ */ jsxRuntime.jsx(designSystem.DesignSystemProvider, { children: /* @__PURE__ */ jsxRuntime.jsxs(reactRouterDom.Routes, { children: [
    /* @__PURE__ */ jsxRuntime.jsx(reactRouterDom.Route, { index: true, element: /* @__PURE__ */ jsxRuntime.jsx(HomePage, {}) }),
    /* @__PURE__ */ jsxRuntime.jsx(reactRouterDom.Route, { path: "*", element: /* @__PURE__ */ jsxRuntime.jsx(admin.Page.Error, {}) })
  ] }) });
};
exports.App = App;
