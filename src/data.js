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
      name: "AMS Demo Admin",
      email: "admin@amsdemo.local",
      password: "Admin123",
      role: ROLES.AMS_ADMIN,
      active: true,
    },
    {
      id: "user-manager-1",
      name: "AMS Demo Manager",
      email: "manager@amsdemo.local",
      password: "Manager123",
      role: ROLES.AMS_MANAGER,
      active: false,
    },
    {
      id: "user-customer-1",
      name: "AMS Demo Customer",
      email: "customer@amsdemo.local",
      password: "Customer123",
      role: ROLES.CUSTOMER,
      active: false,
    },
    {
      id: "user-crew-1",
      name: "AMS Demo Crew",
      email: "crew@amsdemo.local",
      password: "Vendor123",
      role: ROLES.CREW,
      active: true,
    },
    {
      id: "user-operator-1",
      name: "AMS Demo Operator",
      email: "operator@amsdemo.local",
      password: "Operator123",
      role: ROLES.OPERATOR,
      active: false,
    },
  ];

  const sites = [
    {
      id: "site-1",
      name: "Foxboro AMS Office",
      address: "19B North Street, Foxboro, MA 02035",
      state: "MA",
      internalNotes: "Primary AMS demo site for 0.4 workflow testing.",
    },
  ];

  const vendors = [
    {
      id: "vendor-1",
      userId: "user-crew-1",
      name: "AMS Demo Crew",
      serviceType: "General Maintenance",
      serviceTypes: ["General Maintenance", "Snow Removal", "Landscaping"],
      states: ["MA"],
      active: true,
    },
  ];

  const workOrders = [
    {
      id: "wo-1",
      amsWorkOrderNumber: "AMS-WO-0001",
      externalWorkOrderNumber: "",
      siteId: "site-1",
      siteName: "Foxboro AMS Office",
      description: "Clear the front entrance and salt the primary walkway before opening.",
      serviceType: "Snow Removal",
      status: "Completed",
      proposalRequired: false,
      proposalState: "none",
      proposalRequestedAt: "",
      proposalAwardedAt: "",
      assignedVendorId: "vendor-1",
      assignedVendorName: "AMS Demo Crew",
      jobId: "job-1",
      requireBeforeAfterPhotos: true,
      createdAt: now,
    },
    {
      id: "wo-2",
      amsWorkOrderNumber: "AMS-WO-0002",
      externalWorkOrderNumber: "EXT-2045",
      siteId: "site-1",
      siteName: "Foxboro AMS Office",
      description: "Repair the west entry lighting and confirm safe night visibility.",
      serviceType: "Electrical",
      status: "Completed",
      proposalRequired: false,
      proposalState: "none",
      proposalRequestedAt: "",
      proposalAwardedAt: "",
      assignedVendorId: "vendor-1",
      assignedVendorName: "AMS Demo Crew",
      jobId: "job-2",
      requireBeforeAfterPhotos: false,
      createdAt: now,
    },
    {
      id: "wo-3",
      amsWorkOrderNumber: "AMS-WO-0003",
      externalWorkOrderNumber: "",
      siteId: "site-1",
      siteName: "Foxboro AMS Office",
      description: "Provide a proposal to refresh the exterior planter beds at the main entrance.",
      serviceType: "Landscaping",
      status: "Open",
      proposalRequired: true,
      proposalState: "under_review",
      proposalRequestedAt: now,
      proposalAwardedAt: "",
      assignedVendorId: "",
      assignedVendorName: "",
      jobId: "",
      requireBeforeAfterPhotos: false,
      createdAt: now,
    },
  ];

  const jobs = [
    {
      id: "job-1",
      workOrderId: "wo-1",
      siteId: "site-1",
      siteName: "Foxboro AMS Office",
      vendorId: "vendor-1",
      vendorName: "AMS Demo Crew",
      serviceType: "Snow Removal",
      description: "Clear the front entrance and salt the primary walkway before opening.",
      price: "325",
      status: "Completed",
      completedAt: now,
    },
    {
      id: "job-2",
      workOrderId: "wo-2",
      siteId: "site-1",
      siteName: "Foxboro AMS Office",
      vendorId: "vendor-1",
      vendorName: "AMS Demo Crew",
      serviceType: "Electrical",
      description: "Repair the west entry lighting and confirm safe night visibility.",
      price: "480",
      status: "Completed",
      completedAt: now,
    },
  ];

  const proposals = [
    {
      id: "proposal-1",
      workOrderId: "wo-3",
      vendorId: "vendor-1",
      vendorCompanyName: "AMS Demo Crew",
      submittedPrice: "850",
      submittedNotes: "Includes spring cleanup, fresh mulch, and bed edging.",
      submittedAt: now,
      reviewedPrice: "",
      amsNotes: "",
      lastReviewedAt: "",
      status: "submitted",
      revisionCount: 1,
      supersedesProposalId: null,
      isActivePath: true,
      rejectedAt: "",
      approvedAt: "",
      requestedRevisionAt: "",
    },
  ];

  const invoices = [
    {
      id: "invoice-1",
      jobId: "job-2",
      workOrderId: "wo-2",
      siteId: "site-1",
      siteName: "Foxboro AMS Office",
      vendorId: "vendor-1",
      vendorName: "AMS Demo Crew",
      serviceType: "Electrical",
      jobStatus: "Completed",
      amount: "480",
      invoiceNumber: "INV-1002",
      submittedAt: now,
      submittedBy: "AMS Demo Admin",
      status: "Submitted",
      notes: "Waiting on internal review for April cycle.",
      completedAt: now,
    },
  ];

  return {
    users,
    sites,
    vendors,
    workOrders,
    jobs,
    proposals,
    invoices,
    ui: {
      currentUserId: null,
      selectedSiteId: "site-1",
      activeScreenByRole: {
        [ROLES.OWNER]: "dashboard",
        [ROLES.AMS_ADMIN]: "dashboard",
        [ROLES.AMS_MANAGER]: "dashboard",
        [ROLES.CUSTOMER]: "dashboard",
        [ROLES.CREW]: "dashboard",
        [ROLES.OPERATOR]: "dashboard",
      },
    },
  };
}
