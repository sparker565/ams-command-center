import { ROLES } from "./constants";

function timestamp(offsetHours = 0) {
  return new Date(Date.now() + offsetHours * 60 * 60 * 1000).toISOString();
}

function createSiteAddress(streetAddress, city, state, zip = "") {
  return `${streetAddress}, ${city}, ${state}${zip ? ` ${zip}` : ""}`;
}

export function createSeedData() {
  const now = timestamp();

  const users = [
    {
      id: "user-owner-1",
      name: "Spark Owner",
      email: "sparker565@gmail.com",
      password: "Tyson5655",
      phone: "508-555-0101",
      jobTitle: "Platform Owner",
      companyName: "SparkCommand Systems",
      streetAddress: "19B North Street",
      city: "Foxboro",
      state: "MA",
      zip: "02035",
      role: ROLES.OWNER,
      active: true,
      accessStatus: "Active",
      authStatus: "Active",
      internalNotes: "Platform owner account. Hidden from AMS users.",
    },
    {
      id: "user-admin-1",
      name: "Shawn P",
      email: "shawnp@advancedmtnc.com",
      password: "AMS123",
      phone: "508-555-0110",
      jobTitle: "Operations Administrator",
      companyName: "Advanced Maintenance Services",
      streetAddress: "19B North Street",
      city: "Foxboro",
      state: "MA",
      zip: "02035",
      role: ROLES.AMS_ADMIN,
      active: true,
      accessStatus: "Active",
      authStatus: "Active",
    },
    {
      id: "user-admin-2",
      name: "Jeff R",
      email: "jeffr@advancedmtnc.com",
      password: "AMS123",
      phone: "508-555-0111",
      jobTitle: "Finance Administrator",
      companyName: "Advanced Maintenance Services",
      streetAddress: "19B North Street",
      city: "Foxboro",
      state: "MA",
      zip: "02035",
      role: ROLES.AMS_ADMIN,
      active: true,
      accessStatus: "Active",
      authStatus: "Active",
    },
    {
      id: "user-admin-3",
      name: "Tim R",
      email: "timr@advancedmtnc.com",
      password: "AMS123",
      phone: "508-555-0112",
      jobTitle: "Field Administrator",
      companyName: "Advanced Maintenance Services",
      streetAddress: "19B North Street",
      city: "Foxboro",
      state: "MA",
      zip: "02035",
      role: ROLES.AMS_ADMIN,
      active: true,
      accessStatus: "Active",
      authStatus: "Active",
    },
    {
      id: "user-admin-4",
      name: "Jeannie Z",
      email: "jeanniez@advancedmtnc.com",
      password: "AMS123",
      phone: "508-555-0113",
      jobTitle: "Customer Accounts Administrator",
      companyName: "Advanced Maintenance Services",
      streetAddress: "19B North Street",
      city: "Foxboro",
      state: "MA",
      zip: "02035",
      role: ROLES.AMS_ADMIN,
      active: true,
      accessStatus: "Active",
      authStatus: "Active",
    },
    {
      id: "user-demo-ams",
      name: "AMS Demo Admin",
      email: "amsdemo@amsdemo.local",
      password: "DemoAMS123",
      phone: "508-555-0102",
      jobTitle: "Demo Administrator",
      companyName: "Advanced Maintenance Services",
      streetAddress: "19B North Street",
      city: "Foxboro",
      state: "MA",
      zip: "02035",
      role: ROLES.AMS_ADMIN,
      active: true,
      accessStatus: "Active",
      authStatus: "Active",
      internalNotes: "Dedicated demo account. Do not use for live workflow testing.",
    },
    {
      id: "user-crew-1",
      name: "Abby Quinn",
      email: "abbyquinn@rocketmail.com",
      password: "Pumpkin",
      phone: "508-555-0140",
      jobTitle: "Crew Lead",
      companyName: "NorthEast Snow Management",
      streetAddress: "42 Mill Road",
      city: "Brockton",
      state: "MA",
      zip: "02301",
      role: ROLES.CREW,
      active: true,
      accessStatus: "Active",
      authStatus: "Active",
    },
    {
      id: "user-demo-crew",
      name: "Crew Demo User",
      email: "crewdemo@amsdemo.local",
      password: "DemoCrew123",
      phone: "508-555-0144",
      jobTitle: "Demo Crew Lead",
      companyName: "AMS Demo Crew Company",
      streetAddress: "19B North Street",
      city: "Foxboro",
      state: "MA",
      zip: "02035",
      role: ROLES.CREW,
      active: true,
      accessStatus: "Active",
      authStatus: "Active",
      internalNotes: "Dedicated crew demo account. Separated from live vendor users.",
    },
    {
      id: "user-crew-2",
      name: "Craig Carew",
      email: "craigcarew@gmail.com",
      password: "Craig123",
      phone: "401-555-0190",
      jobTitle: "Crew Supervisor",
      companyName: "Bay State Landscaping Group",
      streetAddress: "78 Industrial Drive",
      city: "Providence",
      state: "RI",
      zip: "02908",
      role: ROLES.CREW,
      active: true,
      accessStatus: "Active",
      authStatus: "Active",
    },
  ];

  const vendors = [
    {
      id: "vendor-1",
      userId: "user-crew-1",
      name: "NorthEast Snow Management",
      companyName: "NorthEast Snow Management",
      streetAddress: "42 Mill Road",
      city: "Brockton",
      state: "MA",
      zip: "02301",
      contactName: "Abby Quinn",
      phone: "508-555-0140",
      email: "abbyquinn@rocketmail.com",
      password: "Pumpkin",
      serviceType: "Snow",
      serviceTypes: ["Snow", "Lot Sweeping"],
      states: ["MA", "RI"],
      active: true,
      accessStatus: "Active",
      authStatus: "Active",
      internalNotes: "Primary overnight snow and salt partner.",
    },
    {
      id: "vendor-2",
      userId: "user-crew-2",
      name: "Bay State Landscaping Group",
      companyName: "Bay State Landscaping Group",
      streetAddress: "78 Industrial Drive",
      city: "Providence",
      state: "RI",
      zip: "02908",
      contactName: "Craig Carew",
      phone: "401-555-0190",
      email: "craigcarew@gmail.com",
      password: "Craig123",
      serviceType: "Pre-Landscaping",
      serviceTypes: ["Pre-Landscaping", "Lot Sweeping"],
      states: ["MA", "RI"],
      active: true,
      accessStatus: "Active",
      authStatus: "Active",
      internalNotes: "Proposal and spring cleanup coverage.",
    },
    {
      id: "vendor-3",
      userId: "",
      name: "Ocean State Sweepers",
      companyName: "Ocean State Sweepers",
      streetAddress: "12 Commerce Way",
      city: "Warwick",
      state: "RI",
      zip: "02886",
      contactName: "Melissa Hart",
      phone: "401-555-0155",
      email: "dispatch@oceansweeper.com",
      password: "",
      serviceType: "Lot Sweeping",
      serviceTypes: ["Lot Sweeping"],
      states: ["MA", "RI"],
      active: true,
      accessStatus: "Active",
      authStatus: "Pending",
      internalNotes: "Open opportunity coverage for lot sweeping proposals.",
    },
    {
      id: "vendor-demo-crew",
      userId: "user-demo-crew",
      name: "AMS Demo Crew Company",
      companyName: "AMS Demo Crew Company",
      streetAddress: "19B North Street",
      city: "Foxboro",
      state: "MA",
      zip: "02035",
      contactName: "Crew Demo User",
      phone: "508-555-0144",
      email: "crewdemo@amsdemo.local",
      password: "DemoCrew123",
      serviceType: "Snow",
      serviceTypes: ["Snow", "Pre-Landscaping", "Lot Sweeping"],
      states: ["MA", "RI"],
      active: true,
      accessStatus: "Active",
      authStatus: "Active",
      internalNotes: "Dedicated demo vendor account for isolated crew testing.",
    },
    {
      id: "vendor-4",
      userId: "",
      name: "Granite City Property Services",
      companyName: "Granite City Property Services",
      streetAddress: "220 North Main Street",
      city: "Attleboro",
      state: "MA",
      zip: "02703",
      contactName: "Derek Moss",
      phone: "508-555-0166",
      email: "ops@granitecityps.com",
      password: "",
      serviceType: "Snow",
      serviceTypes: ["Snow", "Pre-Landscaping"],
      states: ["MA"],
      active: true,
      accessStatus: "Active",
      authStatus: "Pending",
      internalNotes: "Back-up snow coverage for metro sites.",
    },
    {
      id: "vendor-5",
      userId: "",
      name: "Harbor Lot Services",
      companyName: "Harbor Lot Services",
      streetAddress: "5 Dock Lane",
      city: "New Bedford",
      state: "MA",
      zip: "02740",
      contactName: "Lena Ortiz",
      phone: "508-555-0177",
      email: "service@harborlot.com",
      password: "",
      serviceType: "Lot Sweeping",
      serviceTypes: ["Lot Sweeping", "Snow"],
      states: ["MA"],
      active: true,
      accessStatus: "Active",
      authStatus: "Pending",
      internalNotes: "South coast sweeping vendor.",
    },
    {
      id: "vendor-6",
      userId: "",
      name: "Providence Facility Group",
      companyName: "Providence Facility Group",
      streetAddress: "91 Exchange Terrace",
      city: "Providence",
      state: "RI",
      zip: "02903",
      contactName: "Paul Marino",
      phone: "401-555-0188",
      email: "dispatch@provfacility.com",
      password: "",
      serviceType: "Pre-Landscaping",
      serviceTypes: ["Pre-Landscaping", "Snow"],
      states: ["RI", "MA"],
      active: true,
      accessStatus: "Active",
      authStatus: "Pending",
      internalNotes: "Providence district standby vendor.",
    },
    {
      id: "vendor-7",
      userId: "",
      name: "Cape Grounds and Snow",
      companyName: "Cape Grounds and Snow",
      streetAddress: "144 Cranberry Highway",
      city: "Hyannis",
      state: "MA",
      zip: "02601",
      contactName: "Jon Keller",
      phone: "508-555-0138",
      email: "coverage@capegrounds.com",
      password: "",
      serviceType: "Snow",
      serviceTypes: ["Snow", "Pre-Landscaping", "Lot Sweeping"],
      states: ["MA"],
      active: true,
      accessStatus: "Active",
      authStatus: "Pending",
      internalNotes: "Cape Cod surge support vendor.",
    },
  ];

  const siteRows = [
    ["Allston", "3588", "Star Market Allston", "1065 Commonwealth Ave.", "MA", "02134"],
    ["Boston", "2576", "Star Market Fenway", "33 Kilmarnock St.", "MA", "02215"],
    ["Brookline", "3566", "Shaw's Brookline", "1717 Beacon St.", "MA", "02445"],
    ["Cambridge", "2565", "Star Market Cambridge", "699 Mt. Auburn St.", "MA", "02138"],
    ["Cedarville", "2585", "Shaw's Cedarville", "2260 State Rd.", "MA", "02360"],
    ["Dorchester", "604", "Star Market Dorchester", "4 River St.", "MA", "02126"],
    ["Hanover", "440", "Shaw's Hanover", "35 Columbia Rd.", "MA", "02339"],
    ["Harwich", "4596", "Shaw's Harwich", "18 Sisson Rd.", "MA", "02645"],
    ["Hyannis", "4595", "Shaw's Hyannis", "625 West Main St.", "MA", "02601"],
    ["Hyde Park", "2579", "Shaw's Hyde Park", "1377 Hyde Park Ave.", "MA", "02136"],
    ["New Bedford", "7412", "Church Group New Bedford", "1331 Cove Rd.", "MA", "02744"],
    ["North Attleboro", "1412", "Shaw's North Attleboro", "125 Robert Toner Blvd.", "MA", "02760"],
    ["North Dartmouth", "619", "Shaw's North Dartmouth", "15 State Rd.", "MA", "02747"],
    ["Peabody", "2478", "Shaw's Peabody", "Essex St. RT 114 & 128", "MA", "01960"],
    ["Somerville", "2575", "Star Market Somerville", "275 Beacon St.", "MA", "02143"],
    ["Quincy", "2573", "Star Market Quincy", "130 Granite St.", "MA", "02169"],
    ["Providence", "SDX-1", "Sodexo Providence", "1 Hoppin St.", "RI", "02903"],
  ];

  const managerNames = [
    "Megan Reese",
    "Jordan Pike",
    "Alyssa Dean",
    "Kevin Bauer",
    "Janel Ortiz",
    "Chris Velez",
    "Dana Morse",
  ];
  const vendorAssignments = ["vendor-1", "vendor-4", "vendor-2", "vendor-5", "vendor-7", "vendor-6", "vendor-3"];

  const sites = siteRows.map(([city, storeNumber, name, streetAddress, state, zip], index) => {
    const vendorId = vendorAssignments[index % vendorAssignments.length];
    const vendor = vendors.find((entry) => entry.id === vendorId);
    const manager = managerNames[index % managerNames.length];

    return {
      id: `site-${index + 1}`,
      siteNumber: storeNumber,
      name,
      address: createSiteAddress(streetAddress, city, state, zip),
      streetAddress,
      city,
      state,
      zip,
      manager,
      contact: `${manager.split(" ")[0]} | ${vendor.phone}`,
      vendor: vendor.companyName,
      assignedVendorId: vendor.id,
      assignedVendorName: vendor.companyName,
      assignedCrewContactId: vendor.userId || "",
      assignedCrewContactName: vendor.contactName,
      internalNotes:
        index === 16
          ? "Sodexo Providence RI coverage site with mixed seasonal demand."
          : `${name} operating site for Albertsons service coverage.`,
      siteMapStatus: "Operational Map Pending Upload",
      geoFenceStatus: "Geo Fence Queue Ready",
    };
  });

  const snowStatuses = [
    "Needs Review",
    "Assigned",
    "In Progress",
    "Completed",
    "Ready for Invoice",
    "Needs Attention",
  ];
  const landscapingStatuses = [
    "Needs Vendor",
    "Proposal Needed",
    "Scheduled",
    "In Progress",
    "Completed",
  ];
  const proposalStatuses = ["submitted", "revision_requested", "approved"];

  const workOrders = [];
  const jobs = [];
  const proposals = [];
  const invoices = [];

  let workOrderIndex = 1;
  let jobIndex = 1;
  let proposalIndex = 1;
  let invoiceIndex = 1;

  const buildJob = (workOrder, vendor, jobStatus, vendorCost, sellPrice, offset) => ({
    id: `job-${jobIndex++}`,
    workOrderId: workOrder.id,
    siteId: workOrder.siteId,
    siteName: workOrder.siteName,
    vendorId: vendor.id,
    vendorName: vendor.companyName,
    serviceType: workOrder.serviceType,
    description: workOrder.description,
    workType: workOrder.workType,
    price: String(vendorCost),
    sellPrice: String(sellPrice),
    sell: String(sellPrice),
    pricingStatus: "set",
    sellSetBy: "user-admin-1",
    sellSetAt: timestamp(-offset + 1),
    status: jobStatus,
    startTime: jobStatus !== "Assigned" ? timestamp(-offset) : "",
    completedTime: jobStatus === "Completed" ? timestamp(-offset + 2) : "",
    completedAt: jobStatus === "Completed" ? timestamp(-offset + 2) : "",
    serviceDate: timestamp(-offset + 2),
    servicePerformed: workOrder.serviceType,
    scope: workOrder.description,
    notes: `${workOrder.serviceType} service tracking record.`,
  });

  sites.forEach((site, index) => {
    const vendor = vendors.find((entry) => entry.id === site.assignedVendorId) || vendors[0];
    const snowStatus = snowStatuses[index % snowStatuses.length];
    const landscapingStatus = landscapingStatuses[index % landscapingStatuses.length];
    const lotStatus = "Open Opportunity";
    const baseOffset = 120 - index * 3;

    const snowWorkOrder = {
      id: `wo-${workOrderIndex++}`,
      amsWorkOrderNumber: `AMS-WO-${String(workOrderIndex + 1000).padStart(4, "0")}`,
      externalWorkOrderNumber: site.state === "RI" ? `SDX-${site.siteNumber}` : "",
      siteId: site.id,
      siteName: site.name,
      description: `Snow response for ${site.name}: plow drive lanes, clear storefront walk, and apply de-icer.`,
      serviceType: "Snow",
      status: snowStatus,
      proposalRequired: false,
      proposalRequestedAt: "",
      proposalAwardedAt: "",
      assignedVendorId: vendor.id,
      assignedVendorName: vendor.companyName,
      jobId: "",
      workType: "seasonal",
      seasonStart: "2025-11-01",
      seasonEnd: "2026-03-31",
      seasonalServiceType: "Snow",
      requireBeforeAfterPhotos: true,
      createdAt: timestamp(-baseOffset),
    };

    if (["Assigned", "In Progress", "Completed", "Ready for Invoice"].includes(snowStatus)) {
      const snowJobStatus = ["Assigned", "In Progress"].includes(snowStatus) ? snowStatus : "Completed";
      const snowJob = buildJob(snowWorkOrder, vendor, snowJobStatus, 275 + index * 8, 425 + index * 10, baseOffset);
      snowWorkOrder.jobId = snowJob.id;
      jobs.push(snowJob);
    }
    workOrders.push(snowWorkOrder);

    const landscapingWorkOrder = {
      id: `wo-${workOrderIndex++}`,
      amsWorkOrderNumber: `AMS-WO-${String(workOrderIndex + 1000).padStart(4, "0")}`,
      externalWorkOrderNumber: "",
      siteId: site.id,
      siteName: site.name,
      description: `Pre-landscaping scope for ${site.name}: spring cleanup, edging, mulch review, and proposal alignment.`,
      serviceType: "Pre-Landscaping",
      status: landscapingStatus,
      proposalRequired: ["Needs Vendor", "Proposal Needed"].includes(landscapingStatus),
      proposalRequestedAt: ["Needs Vendor", "Proposal Needed"].includes(landscapingStatus) ? timestamp(-baseOffset + 4) : "",
      proposalAwardedAt: landscapingStatus === "Completed" ? timestamp(-baseOffset + 8) : "",
      assignedVendorId: ["Needs Vendor", "Proposal Needed"].includes(landscapingStatus) ? "" : vendor.id,
      assignedVendorName: ["Needs Vendor", "Proposal Needed"].includes(landscapingStatus) ? "" : vendor.companyName,
      jobId: "",
      workType: "one_time",
      requireBeforeAfterPhotos: false,
      createdAt: timestamp(-baseOffset + 3),
    };

    if (["Needs Vendor", "Proposal Needed"].includes(landscapingStatus)) {
      proposals.push({
        id: `proposal-${proposalIndex++}`,
        workOrderId: landscapingWorkOrder.id,
        vendorId: vendor.id,
        vendorCompanyName: vendor.companyName,
        submittedPrice: String(780 + index * 15),
        submittedNotes: `Initial proposal package for ${site.name}.`,
        submittedAt: timestamp(-baseOffset + 5),
        reviewedPrice: landscapingStatus === "Proposal Needed" ? "" : String(800 + index * 15),
        amsNotes: landscapingStatus === "Proposal Needed" ? "Awaiting review." : "Ready for award decision.",
        lastReviewedAt: timestamp(-baseOffset + 6),
        status: proposalStatuses[index % proposalStatuses.length],
        revisionCount: landscapingStatus === "Proposal Needed" ? 0 : 1,
        supersedesProposalId: null,
        isActivePath: true,
        rejectedAt: "",
        approvedAt: proposalStatuses[index % proposalStatuses.length] === "approved" ? timestamp(-baseOffset + 7) : "",
        requestedRevisionAt:
          proposalStatuses[index % proposalStatuses.length] === "revision_requested"
            ? timestamp(-baseOffset + 7)
            : "",
      });
    }

    if (["In Progress", "Completed"].includes(landscapingStatus)) {
      const landJob = buildJob(
        landscapingWorkOrder,
        vendor,
        landscapingStatus === "Completed" ? "Completed" : "In Progress",
        610 + index * 11,
        980 + index * 13,
        baseOffset - 2
      );
      landscapingWorkOrder.jobId = landJob.id;
      jobs.push(landJob);
    }
    workOrders.push(landscapingWorkOrder);

    workOrders.push({
      id: `wo-${workOrderIndex++}`,
      amsWorkOrderNumber: `AMS-WO-${String(workOrderIndex + 1000).padStart(4, "0")}`,
      externalWorkOrderNumber: "",
      siteId: site.id,
      siteName: site.name,
      description: `Lot sweeping opportunity for ${site.name}: sweeping, debris removal, and curbing refresh review.`,
      serviceType: "Lot Sweeping",
      status: lotStatus,
      proposalRequired: true,
      proposalRequestedAt: timestamp(-baseOffset + 1),
      proposalAwardedAt: "",
      assignedVendorId: "",
      assignedVendorName: "",
      jobId: "",
      workType: "one_time",
      requireBeforeAfterPhotos: false,
      createdAt: timestamp(-baseOffset + 1),
    });
  });

  const completedJobs = jobs.filter((job) => job.status === "Completed");
  const invoiceStatuses = [
    "Not Invoiced",
    "Invoice Submitted",
    "Under Review",
    "Approved",
    "Paid",
    "Rejected",
  ];

  completedJobs.slice(0, 12).forEach((job, index) => {
    const workOrder = workOrders.find((entry) => entry.id === job.workOrderId);
    const vendor = vendors.find((entry) => entry.id === job.vendorId);
    const status = invoiceStatuses[index % invoiceStatuses.length];
    invoices.push({
      id: `invoice-${invoiceIndex++}`,
      jobId: job.id,
      workOrderId: workOrder.id,
      siteId: job.siteId,
      siteName: job.siteName,
      vendorId: vendor.id,
      vendorName: vendor.companyName,
      serviceType: job.serviceType,
      jobStatus: job.status,
      amount: job.price,
      total: job.price,
      invoiceNumber: status === "Not Invoiced" ? "" : `INV-${1000 + index}`,
      invoiceDate: status === "Not Invoiced" ? "" : timestamp(-24 + index),
      dueDate: status === "Not Invoiced" ? "" : timestamp(24 + index),
      terms: "Net 30",
      submittedAt: status === "Not Invoiced" ? "" : timestamp(-24 + index),
      submittedBy: "Shawn P",
      status,
      notes:
        status === "Rejected"
          ? "Rejected pending corrected backup."
          : status === "Not Invoiced"
            ? "Ready for accounting team review."
            : "Operational accounting seed record.",
      completedAt: job.completedAt,
      vendorCompany: {
        companyName: vendor.companyName,
        contactName: vendor.contactName,
        phone: vendor.phone,
        email: vendor.email,
        address: vendor.streetAddress,
        city: vendor.city,
        state: vendor.state,
        zip: vendor.zip,
        billingDetails: `Remit to ${vendor.companyName}.`,
      },
      lineItems: [
        {
          id: `line-${index + 1}`,
          service: job.serviceType,
          description: job.description,
          qty: "1",
          rate: job.price,
          amount: job.price,
        },
      ],
    });
  });

  const companyProfiles = {
    ams: {
      companyName: "Advanced Maintenance Services",
      contactName: "Shawn P",
      phone: "508-555-0110",
      email: "ops@advancedmtnc.com",
      address: "19B North Street",
      city: "Foxboro",
      state: "MA",
      zip: "02035",
      billingDetails: "Bill To: Advanced Maintenance Services",
    },
    vendors: Object.fromEntries(
      vendors.map((vendor) => [
        vendor.id,
        {
          companyName: vendor.companyName,
          contactName: vendor.contactName,
          phone: vendor.phone,
          email: vendor.email,
          address: vendor.streetAddress,
          city: vendor.city,
          state: vendor.state,
          zip: vendor.zip,
          billingDetails: `Remit to ${vendor.companyName}.`,
        },
      ])
    ),
  };

  return {
    users,
    sites,
    vendors,
    workOrders,
    jobs,
    proposals,
    invoices,
    companyProfiles,
    ui: {
      currentUserId: null,
      selectedSiteId: sites[0]?.id || null,
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
