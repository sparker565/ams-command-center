import { ROLES } from "./constants";

function timestamp() {
  return new Date().toISOString();
}

export function createSeedData() {
  const now = timestamp();

  const users = [
    {
      id: "user-owner-1",
      name: "AMS Owner",
      email: "owner@amsdemo.local",
      password: "Owner123",
      role: ROLES.OWNER,
      active: true,
    },
    {
      id: "user-admin-1",
      name: "Taylor Admin",
      email: "admin@amsdemo.local",
      password: "Admin123",
      role: ROLES.AMS_ADMIN,
      active: true,
    },
    {
      id: "user-manager-1",
      name: "Jordan Manager",
      email: "manager@amsdemo.local",
      password: "Manager123",
      role: ROLES.AMS_MANAGER,
      active: true,
    },
    {
      id: "user-vendor-1",
      name: "North Star Field Services",
      email: "vendor@amsdemo.local",
      password: "Vendor123",
      role: ROLES.VENDOR,
      active: true,
    },
    {
      id: "user-operator-1",
      name: "Field Operator",
      email: "operator@amsdemo.local",
      password: "Operator123",
      role: ROLES.OPERATOR,
      active: true,
    },
  ];

  const sites = [
    {
      id: "site-1",
      name: "Foxboro Plaza",
      address: "19 North Street, Foxboro, MA 02035",
      state: "MA",
      internalNotes: "Primary regional site. High visibility account.",
    },
    {
      id: "site-2",
      name: "Cedar Industrial",
      address: "240 Commerce Way, Providence, RI 02904",
      state: "RI",
      internalNotes: "Loading dock access behind building B.",
    },
    {
      id: "site-3",
      name: "Riverside Commons",
      address: "88 Riverside Ave, Hartford, CT 06103",
      state: "CT",
      internalNotes: "Morning dispatch window is preferred.",
    },
  ];

  const vendors = [
    {
      id: "vendor-1",
      userId: "user-vendor-1",
      name: "North Star Field Services",
      serviceType: "Snow Removal",
      serviceTypes: ["Snow Removal", "Landscaping"],
      states: ["MA", "RI"],
      active: true,
    },
    {
      id: "vendor-2",
      name: "Summit Site Works",
      serviceType: "Landscaping",
      serviceTypes: ["Landscaping", "General Maintenance"],
      states: ["RI", "CT"],
      active: true,
    },
    {
      id: "vendor-3",
      name: "Atlas Facility Response",
      serviceType: "Electrical",
      serviceTypes: ["Electrical", "Emergency Service"],
      states: ["CT"],
      active: true,
    },
  ];

  const workOrders = [
    {
      id: "wo-1",
      siteId: "site-1",
      siteName: "Foxboro Plaza",
      description: "Clear front lot and salt walkways before 7 AM.",
      serviceType: "Snow Removal",
      status: "Assigned",
      proposalRequired: false,
      proposalState: "none",
      proposalRequestedAt: "",
      proposalAwardedAt: "",
      assignedVendorId: "vendor-1",
      assignedVendorName: "North Star Field Services",
      jobId: "job-1",
      createdAt: now,
    },
    {
      id: "wo-2",
      siteId: "site-2",
      siteName: "Cedar Industrial",
      description: "Trim overgrowth along the loading area perimeter.",
      serviceType: "Landscaping",
      status: "Open",
      proposalRequired: true,
      proposalState: "opportunity",
      proposalRequestedAt: now,
      proposalAwardedAt: "",
      assignedVendorId: "",
      assignedVendorName: "",
      jobId: "",
      createdAt: now,
    },
    {
      id: "wo-3",
      siteId: "site-3",
      siteName: "Riverside Commons",
      description: "Restore parking lot pole light near entrance lane.",
      serviceType: "Electrical",
      status: "Open",
      proposalRequired: true,
      proposalState: "opportunity",
      proposalRequestedAt: now,
      proposalAwardedAt: "",
      assignedVendorId: "",
      assignedVendorName: "",
      jobId: "",
      createdAt: now,
    },
  ];

  const jobs = [
    {
      id: "job-1",
      workOrderId: "wo-1",
      siteId: "site-1",
      siteName: "Foxboro Plaza",
      vendorId: "vendor-1",
      vendorName: "North Star Field Services",
      serviceType: "Snow Removal",
      description: "Clear front lot and salt walkways before 7 AM.",
      price: "",
      status: "Assigned",
    },
  ];

  const proposals = [];

  return {
    users,
    sites,
    vendors,
    workOrders,
    jobs,
    proposals,
    ui: {
      currentUserId: null,
      selectedSiteId: "site-1",
      activeScreenByRole: {
        [ROLES.OWNER]: "dashboard",
        [ROLES.AMS_ADMIN]: "dashboard",
        [ROLES.AMS_MANAGER]: "dashboard",
        [ROLES.VENDOR]: "dashboard",
        [ROLES.OPERATOR]: "dashboard",
      },
    },
  };
}
