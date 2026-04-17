export const STORAGE_KEY = "ams-command-center-v0-4";

export const ROLES = {
  OWNER: "Owner",
  AMS_ADMIN: "AMS Admin",
  AMS_MANAGER: "AMS Manager",
  CUSTOMER: "Customer",
  CREW: "Crew",
  OPERATOR: "Operator",
};

export const WORK_ORDER_STATUS = ["Open", "Assigned", "In Progress", "Completed", "Canceled"];
export const JOB_STATUS = ["Assigned", "In Progress", "Completed", "Need Help"];
export const WORK_ORDER_FILTERS = ["All", "Open", "Assigned", "Closed"];
export const JOB_FILTERS = ["All", "Pending", "In Progress", "Completed", "Need Help"];
export const PROPOSAL_STATUS = [
  "submitted",
  "revision_requested",
  "rejected",
  "approved",
];
export const PROPOSAL_STATE = ["none", "opportunity", "under_review", "awarded", "closed"];

export const SERVICE_TYPES = [
  "Snow Removal",
  "Landscaping",
  "Janitorial",
  "Electrical",
  "General Maintenance",
  "Emergency Service",
];

export const AMS_ROLES = [ROLES.AMS_ADMIN, ROLES.AMS_MANAGER];

export const UNDER_CONSTRUCTION_SCREENS = new Set([
  "weather",
  "settings",
  "customer",
  "operatorPortal",
]);

export const DRAWER_MENUS = {
  [ROLES.OWNER]: [
    "dashboard",
    "users",
    "sites",
    "vendors",
    "workOrders",
    "jobs",
    "settings",
  ],
  [ROLES.AMS_ADMIN]: [
    "dashboard",
    "workOrders",
    "proposals",
    "jobs",
    "accounting",
    "sites",
    "vendors",
    "weather",
    "settings",
  ],
  [ROLES.AMS_MANAGER]: [
    "dashboard",
    "workOrders",
    "proposals",
    "jobs",
    "accounting",
    "sites",
    "vendors",
    "weather",
    "settings",
  ],
  [ROLES.CREW]: [
    "dashboard",
    "myJobs",
    "availableWork",
    "myProposals",
    "myInvoices",
    "mySites",
    "settings",
  ],
  [ROLES.OPERATOR]: ["dashboard", "settings"],
  [ROLES.CUSTOMER]: ["dashboard", "settings"],
};

export const SCREEN_LABELS = {
  dashboard: "Dashboard",
  users: "Users",
  sites: "Sites",
  vendors: "Crews",
  workOrders: "Work Orders",
  proposals: "Proposals",
  jobs: "Jobs",
  weather: "Weather",
  accounting: "Accounting",
  operators: "Operators",
  settings: "Settings",
  logout: "Logout",
  myJobs: "My Jobs",
  availableWork: "Available Work",
  myProposals: "My Proposals",
  myInvoices: "My Invoices",
  mySites: "My Sites",
  profile: "Profile",
  customer: "Customer",
  operatorPortal: "Operator Portal",
};

export const INVOICE_STATUS = [
  "Not Submitted",
  "Ready for Invoice",
  "Submitted",
  "Under Review",
  "Approved",
  "Rejected",
  "Paid",
];
