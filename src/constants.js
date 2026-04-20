export const STORAGE_KEY = "ams-command-center-v0-5-data";
export const SESSION_STORAGE_KEY = "ams-command-center-v0-5-session";
export const APP_VERSION = "0.5.6";

export const ROLES = {
  OWNER: "Owner",
  AMS_ADMIN: "AMS Admin",
  AMS_MANAGER: "AMS Manager",
  CREW: "Crew",
  CUSTOMER: "Customer",
  OPERATOR: "Operator",
};

export const WORK_ORDER_STATUS = [
  "Needs Review",
  "Assigned",
  "In Progress",
  "Completed",
  "Ready for Invoice",
  "Needs Attention",
  "Needs Vendor",
  "Proposal Needed",
  "Scheduled",
  "Open Opportunity",
];

export const JOB_STATUS = ["Assigned", "In Progress", "Completed", "Need Help", "Canceled"];
export const WORK_ORDER_FILTERS = ["All", "Open", "Assigned", "Closed"];
export const JOB_FILTERS = ["All", "Pending", "In Progress", "Completed", "Need Help"];
export const PROPOSAL_STATUS = ["submitted", "revision_requested", "rejected", "approved"];
export const PROPOSAL_STATE = ["none", "opportunity", "under_review", "awarded", "closed"];

export const SERVICE_TYPES = ["Snow", "Pre-Landscaping", "Lot Sweeping"];

export const AMS_ROLES = [ROLES.AMS_ADMIN, ROLES.AMS_MANAGER];

export const UNDER_CONSTRUCTION_SCREENS = new Set(["settings", "customer", "operatorPortal", "auditLog"]);

export const DRAWER_MENUS = {
  [ROLES.OWNER]: [
    "dashboard",
    "companies",
    "users",
    "platformStatus",
    "internalNotes",
    "systemControls",
    "auditLog",
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
    "amsTeam",
    "weather",
    "reports",
    "settings",
  ],
  [ROLES.AMS_MANAGER]: [
    "dashboard",
    "workOrders",
    "proposals",
    "jobs",
    "sites",
    "vendors",
    "weather",
    "reports",
    "settings",
  ],
  [ROLES.CREW]: ["dashboard", "myJobs", "completedJobs", "myInvoices", "profile"],
  [ROLES.OPERATOR]: ["dashboard", "settings"],
  [ROLES.CUSTOMER]: ["dashboard", "settings"],
};

export const SCREEN_LABELS = {
  dashboard: "Dashboard",
  companies: "Companies",
  users: "Users",
  platformStatus: "Platform Status",
  internalNotes: "Internal Notes",
  systemControls: "System Controls",
  auditLog: "Audit Log",
  workOrders: "Work Orders",
  proposals: "Proposals",
  jobs: "Jobs",
  accounting: "Accounting",
  sites: "Sites",
  vendors: "Vendors",
  amsTeam: "AMS Team",
  weather: "Weather",
  reports: "Reports",
  settings: "Settings",
  logout: "Logout",
  myJobs: "My Jobs",
  completedJobs: "Completed Jobs",
  profile: "Profile",
  availableWork: "Available Work",
  myProposals: "My Proposals",
  myInvoices: "My Invoices",
  mySites: "My Sites",
  customer: "Customer",
  operatorPortal: "Operator Portal",
};

export const INVOICE_STATUS = [
  "Not Invoiced",
  "Invoice Submitted",
  "Under Review",
  "Approved",
  "Paid",
  "Rejected",
];
