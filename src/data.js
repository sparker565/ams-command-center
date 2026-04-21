import { ROLES } from "./constants";

export function createSeedData() {
  return {
    users: [],
    sites: [],
    vendors: [],
    workOrders: [],
    jobs: [],
    proposals: [],
    invoices: [],
    customers: [],
    operators: [],
    companyProfiles: {
      vendors: {},
    },
    ui: {
      currentUserId: null,
      selectedSiteId: null,
      activeScreenByRole: {
        [ROLES.OWNER]: "dashboard",
        [ROLES.AMS_ADMIN]: "dashboard",
        [ROLES.AMS_MANAGER]: "dashboard",
        [ROLES.CUSTOMER]: "dashboard",
        [ROLES.CREW]: "dashboard",
        [ROLES.VENDOR]: "dashboard",
        [ROLES.OPERATOR]: "dashboard",
      },
    },
  };
}
