import React, { useEffect, useState } from "react";
import {
  APP_VERSION,
  AMS_ROLES,
  DRAWER_MENUS,
  INVOICE_STATUS,
  JOB_FILTERS,
  JOB_STATUS,
  ROLES,
  SCREEN_LABELS,
  SERVICE_TYPES,
  UNDER_CONSTRUCTION_SCREENS,
  WORK_ORDER_FILTERS,
  WORK_ORDER_STATUS,
} from "./constants";
import { loadAppState, saveAppState } from "./storage";
import {
  AvailableWorkCard,
  CommandMap,
  DataTable,
  Drawer,
  EmptyState,
  Field,
  FilterRow,
  Header,
  InputRow,
  JobCard,
  LoginScreen,
  Modal,
  PageSection,
  SearchBar,
  SiteDetailsCard,
  SplashScreen,
  SplitView,
  StatGrid,
  TopActionBar,
  UnderConstruction,
} from "./components";
import { signIn, signOutUser } from "./firebaseAuth";

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

const FIREBASE_ROLE_BRIDGE = {
  "sparker565@gmail.com": {
    name: "Spark Owner",
    role: ROLES.OWNER,
  },
  "shawnp@advancedmtnc.com": {
    name: "Shawn P",
    role: ROLES.AMS_ADMIN,
  },
  "jeffr@advancedmtnc.com": {
    name: "Jeff R",
    role: ROLES.AMS_ADMIN,
  },
  "timr@advancedmtnc.com": {
    name: "Tim R",
    role: ROLES.AMS_ADMIN,
  },
  "jeanniez@advancedmtnc.com": {
    name: "Jeannie Z",
    role: ROLES.AMS_ADMIN,
  },
  "abbyquinn@rocketmail.com": {
    name: "Abby Quinn",
    role: ROLES.CREW,
  },
  "craigcarew@gmail.com": {
    name: "Craig Carew",
    role: ROLES.CREW,
  },
};

function formatDate(value) {
  if (!value) return "Not available";
  return new Date(value).toLocaleString();
}

function formatMoney(value) {
  if (!value && value !== 0) return "Not set";
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return value;
  return parsed.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function buildAddressLine({ streetAddress, city, state, zip, fallbackAddress }) {
  const parts = [streetAddress, city, state, zip].filter(Boolean);
  if (parts.length) {
    if (streetAddress && (city || state || zip)) {
      return `${streetAddress}, ${[city, state, zip].filter(Boolean).join(" ")}`.trim();
    }
    return parts.join(", ");
  }
  return fallbackAddress || "";
}

function parseLegacyAddress(address = "") {
  const [streetAddress = "", city = "", stateZip = ""] = String(address).split(",").map((part) => part.trim());
  const stateZipMatch = stateZip.match(/^([A-Za-z]{2})\s*(\d{5}(?:-\d{4})?)?$/);
  return {
    streetAddress,
    city,
    state: stateZipMatch?.[1]?.toUpperCase() || "",
    zip: stateZipMatch?.[2] || "",
  };
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function calculateInvoiceTotal(lineItems = []) {
  return lineItems.reduce((sum, item) => sum + toNumber(item.amount), 0).toFixed(2);
}

function getAllUserPool(state) {
  return [
    ...(state.users || []),
    ...(state.vendors || []),
    ...(state.operators || []),
    ...(state.customers || []),
  ];
}

function findCurrentUser(state) {
  return getAllUserPool(state).find((user) => user.id === state.ui?.currentUserId) || null;
}

function getActiveScreen(state, user) {
  if (!user?.role) return "dashboard";
  return state.ui?.activeScreenByRole?.[user.role] || "dashboard";
}

function normalizeVendor(vendor) {
  const legacyAddress = parseLegacyAddress(vendor.address || "");
  return {
    ...vendor,
    userId: vendor.userId || "",
    companyName: vendor.companyName || vendor.name || "",
    streetAddress: vendor.streetAddress || legacyAddress.streetAddress,
    city: vendor.city || legacyAddress.city,
    state: vendor.state || legacyAddress.state,
    zip: vendor.zip || legacyAddress.zip,
    contactName: vendor.contactName || "",
    phone: vendor.phone || "",
    email: vendor.email || "",
    password: vendor.password || "",
    internalNotes: vendor.internalNotes || "",
    states: vendor.states || [],
    serviceTypes: vendor.serviceTypes || (vendor.serviceType ? [vendor.serviceType] : []),
    address: buildAddressLine({
      streetAddress: vendor.streetAddress || legacyAddress.streetAddress,
      city: vendor.city || legacyAddress.city,
      state: vendor.state || legacyAddress.state,
      zip: vendor.zip || legacyAddress.zip,
      fallbackAddress: vendor.address || "",
    }),
  };
}

function normalizeSite(site) {
  const legacyAddress = parseLegacyAddress(site.address || "");
  const streetAddress = site.streetAddress || legacyAddress.streetAddress;
  const city = site.city || legacyAddress.city;
  const state = site.state || legacyAddress.state;
  const zip = site.zip || legacyAddress.zip;
  return {
    ...site,
    streetAddress,
    city,
    state,
    zip,
    address: buildAddressLine({ streetAddress, city, state, zip, fallbackAddress: site.address || "" }),
    internalNotes: site.internalNotes || "",
    assignedVendorId: site.assignedVendorId || "",
    assignedVendorName: site.assignedVendorName || "",
    assignedCrewContactId: site.assignedCrewContactId || "",
    assignedCrewContactName: site.assignedCrewContactName || "",
    siteMapStatus: site.siteMapStatus || "Upload Coming Soon",
    geoFenceStatus: site.geoFenceStatus || "Geo Fence Setup Coming Soon",
  };
}

function normalizeUser(user) {
  const legacyAddress = parseLegacyAddress(user.address || "");
  return {
    ...user,
    active: user.active ?? (user.accessStatus || "Active") === "Active",
    accessStatus: user.accessStatus || (user.active === false ? "Inactive" : "Active"),
    authStatus: user.authStatus || (user.active === false ? "Disabled" : "Active"),
    phone: user.phone || "",
    jobTitle: user.jobTitle || "",
    companyName: user.companyName || "",
    streetAddress: user.streetAddress || legacyAddress.streetAddress,
    city: user.city || legacyAddress.city,
    state: user.state || legacyAddress.state,
    zip: user.zip || legacyAddress.zip,
    internalNotes: user.internalNotes || "",
    profilePhotoStatus: user.profilePhotoStatus || "Photo Upload Coming Soon",
    address: buildAddressLine({
      streetAddress: user.streetAddress || legacyAddress.streetAddress,
      city: user.city || legacyAddress.city,
      state: user.state || legacyAddress.state,
      zip: user.zip || legacyAddress.zip,
      fallbackAddress: user.address || "",
    }),
  };
}

function normalizeProposal(proposal) {
  return {
    ...proposal,
    reviewedPrice: proposal.reviewedPrice ?? "",
    amsNotes: proposal.amsNotes || "",
    lastReviewedAt: proposal.lastReviewedAt || "",
    revisionCount: proposal.revisionCount || 1,
    supersedesProposalId: proposal.supersedesProposalId || null,
    isActivePath: proposal.isActivePath ?? proposal.status !== "rejected",
    rejectedAt: proposal.rejectedAt || "",
    approvedAt: proposal.approvedAt || "",
    requestedRevisionAt: proposal.requestedRevisionAt || "",
  };
}

function normalizeJob(job) {
  const normalizedSell = String(job.sellPrice ?? job.sell ?? "").trim();
  const startTime = job.startTime || "";
  const completedTime = job.completedTime || job.completedAt || "";
  return {
    ...job,
    description: job.description || "",
    price: job.price ?? "",
    sell: normalizedSell || null,
    sellPrice: normalizedSell,
    pricingStatus: job.pricingStatus || (normalizedSell ? "set" : "not_set"),
    sellSetBy: job.sellSetBy || null,
    sellSetAt: job.sellSetAt || "",
    startTime,
    completedTime,
    completedAt: completedTime,
    serviceDate: job.serviceDate || completedTime || "",
    servicePerformed: job.servicePerformed || job.serviceType || "",
    scope: job.scope || job.description || "",
    notes: job.notes || "",
  };
}

function normalizeInvoice(invoice) {
  const lineItems = (invoice.lineItems || []).map((lineItem, index) => ({
    id: lineItem.id || `line-${index + 1}`,
    service: lineItem.service || "",
    description: lineItem.description || "",
    qty: lineItem.qty ?? "1",
    rate: lineItem.rate ?? "",
    amount: lineItem.amount ?? "",
  }));
  const total = invoice.total ?? invoice.amount ?? calculateInvoiceTotal(lineItems);
  return {
    ...invoice,
    invoiceNumber: invoice.invoiceNumber || "",
    amount: invoice.amount ?? "",
    total,
    invoiceDate: invoice.invoiceDate || "",
    dueDate: invoice.dueDate || "",
    terms: invoice.terms || "Net 30",
    submittedAt: invoice.submittedAt || "",
    submittedBy: invoice.submittedBy || "",
    status: invoice.status || "Invoice Submitted",
    notes: invoice.notes || "",
    completedAt: invoice.completedAt || "",
    vendorCompany: {
      companyName: invoice.vendorCompany?.companyName || "",
      contactName: invoice.vendorCompany?.contactName || "",
      phone: invoice.vendorCompany?.phone || "",
      email: invoice.vendorCompany?.email || "",
      address: invoice.vendorCompany?.address || "",
      city: invoice.vendorCompany?.city || "",
      state: invoice.vendorCompany?.state || "",
      zip: invoice.vendorCompany?.zip || "",
      billingDetails: invoice.vendorCompany?.billingDetails || "",
    },
    lineItems,
  };
}

function isCanceledWorkOrder(status) {
  return String(status).toLowerCase() === "canceled";
}

function isClosedWorkOrder(status) {
  return ["Completed", "Canceled"].includes(status);
}

function getWorkOrderProposalState(workOrder, proposals) {
  if (isCanceledWorkOrder(workOrder.status)) return "closed";
  if (workOrder.proposalAwardedAt || workOrder.assignedVendorId || workOrder.jobId) return "awarded";

  const relatedProposals = proposals.filter((proposal) => proposal.workOrderId === workOrder.id);
  const hasApprovedProposal = relatedProposals.some((proposal) => proposal.status === "approved");
  const hasActiveProposal = relatedProposals.some((proposal) => proposal.isActivePath);

  if (hasApprovedProposal) return "awarded";
  if (hasActiveProposal) return "under_review";
  if (workOrder.proposalRequired) return "opportunity";
  return "none";
}

function getNextAmsWorkOrderNumber(workOrders) {
  const highest = workOrders.reduce((max, workOrder) => {
    const match = String(workOrder.amsWorkOrderNumber || "").match(/(\d+)$/);
    return Math.max(max, match ? Number(match[1]) : 0);
  }, 0);

  return `AMS-WO-${String(highest + 1).padStart(4, "0")}`;
}

function normalizeWorkOrder(workOrder, proposals, jobs) {
  const linkedJob = jobs.find((job) => job.workOrderId === workOrder.id);
  const normalized = {
    ...workOrder,
    amsWorkOrderNumber: workOrder.amsWorkOrderNumber || getNextAmsWorkOrderNumber([workOrder]),
    externalWorkOrderNumber: workOrder.externalWorkOrderNumber || "",
    proposalRequired: Boolean(workOrder.proposalRequired),
    proposalRequestedAt: workOrder.proposalRequestedAt || "",
    proposalAwardedAt: workOrder.proposalAwardedAt || "",
    assignedVendorId: workOrder.assignedVendorId || "",
    assignedVendorName: workOrder.assignedVendorName || "",
    jobId: workOrder.jobId || linkedJob?.id || "",
    requireBeforeAfterPhotos: Boolean(workOrder.requireBeforeAfterPhotos),
    workType: workOrder.workType || "one_time",
    recurringFrequency: workOrder.recurringFrequency || "",
    recurringVendorCost: workOrder.recurringVendorCost ?? "",
    recurringPricingNotes: workOrder.recurringPricingNotes || "",
    seasonStart: workOrder.seasonStart || "",
    seasonEnd: workOrder.seasonEnd || "",
    seasonalServiceType: workOrder.seasonalServiceType || "",
  };

  return {
    ...normalized,
    proposalState: getWorkOrderProposalState(normalized, proposals),
  };
}

function normalizeStateData(state) {
  const users = (state.users || []).map(normalizeUser);
  const sites = (state.sites || []).map(normalizeSite);
  const vendors = (state.vendors || []).map(normalizeVendor);
  const proposals = (state.proposals || []).map(normalizeProposal);
  const jobs = (state.jobs || []).map(normalizeJob);
  const invoices = (state.invoices || []).map(normalizeInvoice);
  const workOrders = (state.workOrders || []).map((workOrder) =>
    normalizeWorkOrder(workOrder, proposals, jobs)
  );
  const selectedSiteId =
    state.ui?.selectedSiteId && sites.some((site) => site.id === state.ui.selectedSiteId)
      ? state.ui.selectedSiteId
      : sites[0]?.id || null;
  const currentUserExists = getAllUserPool({ ...state, users, vendors }).some(
    (user) => user.id === state.ui?.currentUserId
  );

  return {
    ...state,
    users,
    sites,
    vendors,
    proposals,
    jobs,
    invoices,
    workOrders,
    ui: {
      currentUserId: currentUserExists ? state.ui?.currentUserId || null : null,
      selectedSiteId,
      activeScreenByRole: {
        [ROLES.OWNER]: "dashboard",
        [ROLES.AMS_ADMIN]: "dashboard",
        [ROLES.AMS_MANAGER]: "dashboard",
        [ROLES.CUSTOMER]: "dashboard",
        [ROLES.CREW]: "dashboard",
        [ROLES.OPERATOR]: "dashboard",
        ...(state.ui?.activeScreenByRole || {}),
      },
    },
  };
}

function getWorkOrderFilterMatch(workOrder, filter) {
  if (filter === "All") return true;
  if (filter === "Open") {
    return ["Needs Review", "Needs Attention", "Needs Vendor", "Proposal Needed", "Scheduled", "Open Opportunity"].includes(workOrder.status);
  }
  if (filter === "Assigned") return ["Assigned", "In Progress"].includes(workOrder.status);
  if (filter === "Closed") return ["Completed", "Ready for Invoice"].includes(workOrder.status) || isClosedWorkOrder(workOrder.status);
  return true;
}

function getJobFilterMatch(job, filter) {
  if (filter === "All") return true;
  if (filter === "Pending") return job.status === "Assigned";
  return job.status === filter;
}

function sortByNewest(items, key) {
  return [...items].sort((a, b) => {
    const aTime = a[key] ? new Date(a[key]).getTime() : 0;
    const bTime = b[key] ? new Date(b[key]).getTime() : 0;
    return bTime - aTime;
  });
}

function searchMatches(values, query) {
  if (!query.trim()) return true;
  const normalizedQuery = query.trim().toLowerCase();
  return values.some((value) => String(value || "").toLowerCase().includes(normalizedQuery));
}

function findCrewForUser(vendors, currentUser) {
  if (!currentUser || currentUser.role !== ROLES.CREW) return null;

  return (
    vendors.find((vendor) => vendor.userId && vendor.userId === currentUser.id) ||
    vendors.find((vendor) => vendor.name === currentUser.name) ||
    null
  );
}

function getCrewWorkOrderProposals(proposals, workOrderId, vendorId) {
  return sortByNewest(
    proposals.filter(
      (proposal) => proposal.workOrderId === workOrderId && proposal.vendorId === vendorId
    ),
    "submittedAt"
  );
}

function getLatestCrewProposal(proposals, workOrderId, vendorId) {
  return getCrewWorkOrderProposals(proposals, workOrderId, vendorId)[0] || null;
}

function isCrewEligibleForWorkOrder({ workOrder, site, vendor, proposals, jobs }) {
  if (!workOrder || !site || !vendor?.active) return false;
  if (workOrder.status !== "Open") return false;
  if (!workOrder.proposalRequired) return false;
  if (!["opportunity", "under_review"].includes(workOrder.proposalState)) return false;
  if (workOrder.assignedVendorId || workOrder.jobId) return false;
  if (jobs.some((job) => job.workOrderId === workOrder.id)) return false;
  if (proposals.some((proposal) => proposal.workOrderId === workOrder.id && proposal.status === "approved")) {
    return false;
  }
  if (!vendor.states.includes(site.state)) return false;
  if (workOrder.serviceType && vendor.serviceTypes.length) {
    return vendor.serviceTypes.includes(workOrder.serviceType);
  }
  return true;
}

function canCrewSubmitProposal({ workOrder, site, vendor, proposals, jobs }) {
  if (!isCrewEligibleForWorkOrder({ workOrder, site, vendor, proposals, jobs })) return false;
  const latestProposal = getLatestCrewProposal(proposals, workOrder.id, vendor.id);
  if (!latestProposal) return true;
  return ["rejected", "revision_requested"].includes(latestProposal.status);
}

function getJobSellValue(job) {
  return String(job?.sellPrice ?? job?.sell ?? "").trim();
}

function getPricingStatus(job) {
  return job?.pricingStatus || (getJobSellValue(job) ? "set" : "not_set");
}

function getWorkTypeLabel(workType) {
  const labels = {
    one_time: "One-Time",
    recurring: "Recurring",
    seasonal: "Seasonal / Triggered",
  };
  return labels[workType] || "One-Time";
}

function buildPricingFields({ sell, currentUser, existingJob }) {
  const normalizedSell = String(sell ?? "").trim();
  const existingSell = getJobSellValue(existingJob);
  const hasSell = Boolean(normalizedSell);
  const changed = normalizedSell !== existingSell;
  const timestamp = new Date().toISOString();

  return {
    sell: hasSell ? normalizedSell : null,
    sellPrice: normalizedSell,
    pricingStatus: hasSell ? "set" : "not_set",
    sellSetBy: hasSell ? currentUser?.id || existingJob?.sellSetBy || null : null,
    sellSetAt: hasSell
      ? changed
        ? timestamp
        : existingJob?.sellSetAt || timestamp
      : "",
  };
}

function getInheritedJobCost(workOrder, explicitPrice) {
  if (explicitPrice !== undefined && explicitPrice !== null && String(explicitPrice).trim() !== "") {
    return explicitPrice;
  }

  if (workOrder?.workType === "recurring") {
    return workOrder.recurringVendorCost ?? "";
  }

  return "";
}

function buildJobRecord({ workOrder, vendor, price, sell, currentUser }) {
  return {
    id: createId("job"),
    workOrderId: workOrder.id,
    siteId: workOrder.siteId,
    siteName: workOrder.siteName,
    vendorId: vendor.id,
    vendorName: vendor.name,
    serviceType: workOrder.serviceType,
    description: workOrder.description,
    price: getInheritedJobCost(workOrder, price),
    ...buildPricingFields({ sell, currentUser }),
    status: "Assigned",
    startTime: "",
    completedTime: "",
    serviceDate: "",
    servicePerformed: workOrder.serviceType,
    scope: workOrder.description,
    notes: "",
    completedAt: "",
    workType: workOrder.workType || "one_time",
    recurringFrequency: workOrder.recurringFrequency || "",
    recurringVendorCost: workOrder.recurringVendorCost ?? "",
    recurringPricingNotes: workOrder.recurringPricingNotes || "",
    seasonStart: workOrder.seasonStart || "",
    seasonEnd: workOrder.seasonEnd || "",
    seasonalServiceType: workOrder.seasonalServiceType || "",
  };
}

function buildInvoiceRecord({ job, workOrder, currentUser }) {
  const amount = job.price || "";
  return {
    id: createId("invoice"),
    jobId: job.id,
    workOrderId: job.workOrderId,
    siteId: job.siteId,
    siteName: job.siteName,
    vendorId: job.vendorId,
    vendorName: job.vendorName,
    serviceType: job.serviceType,
    jobStatus: job.status,
    amount,
    total: amount,
    invoiceNumber: "",
    invoiceDate: new Date().toISOString(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    terms: "Net 30",
    submittedAt: "",
    submittedBy: currentUser?.name || "",
    status: "Invoice Submitted",
    notes: "",
    completedAt: job.completedAt || workOrder?.proposalAwardedAt || "",
    vendorCompany: {
      companyName: "",
      contactName: "",
      phone: "",
      email: "",
      address: "",
      city: "",
      state: "",
      zip: "",
      billingDetails: "",
    },
    lineItems: [
      {
        id: createId("line"),
        service: job.serviceType || "",
        description: job.description || "",
        qty: "1",
        rate: amount,
        amount,
      },
    ],
  };
}

function getInvoiceForJob(invoices, jobId) {
  return invoices.find((invoice) => invoice.jobId === jobId) || null;
}

function getCompanyProfileForRole(state, user, vendorRecord) {
  if (!user) return null;
  if (user.role === ROLES.CREW && vendorRecord) {
    return state.companyProfiles?.vendors?.[vendorRecord.id] || null;
  }
  return state.companyProfiles?.ams || null;
}

function isAmsUser(user) {
  return AMS_ROLES.includes(user?.role) || user?.role === ROLES.OWNER;
}

function canViewExternalWorkOrder(user) {
  return user?.role !== ROLES.CREW && user?.role !== "Vendor";
}

function canEditCrewIdentity(user) {
  return user?.role === ROLES.OWNER || user?.role === ROLES.AMS_ADMIN;
}

function getPortalPathForUser(user) {
  if (user?.role === ROLES.OWNER) return "/owner";
  if (AMS_ROLES.includes(user?.role)) return "/ams";
  if (user?.role === ROLES.CREW) return "/crew";
  return "/";
}

function getPortalEyebrow(user) {
  if (user?.role === ROLES.OWNER) return "SparkCommand Systems";
  if (AMS_ROLES.includes(user?.role)) return `AMS Portal • Version ${APP_VERSION}`;
  if (user?.role === ROLES.CREW) return `Crew Portal • Version ${APP_VERSION}`;
  return `Version ${APP_VERSION}`;
}

function userCanManageUser(actor, target) {
  if (!actor || !target) return false;
  if (actor.role === ROLES.OWNER) return true;
  if (actor.role !== ROLES.AMS_ADMIN) return false;
  return target.role !== ROLES.OWNER;
}

function getCrewPasswordValue(user) {
  return user?.password || "Crew123";
}

function buildWeatherThreatSnapshot(sites = []) {
  const statuses = ["active", "watch_24", "watch_48", "watch_72", "inactive"];
  return sites.map((site, index) => ({
    siteId: site.id,
    siteName: site.name,
    state: site.state,
    serviceType: index % 2 === 0 ? "Snow / Ice" : "Rain / Wind",
    status: statuses[index % statuses.length],
    summary:
      statuses[index % statuses.length] === "active"
        ? "Crews should treat this site as currently impacted."
        : statuses[index % statuses.length] === "watch_24"
        ? "Weather risk is expected inside the next 24 hours."
        : statuses[index % statuses.length] === "watch_48"
        ? "Weather risk is expected inside the next 48 hours."
        : statuses[index % statuses.length] === "watch_72"
        ? "Weather risk is expected inside the next 72 hours."
        : "No active weather threat is currently projected.",
  }));
}

function buildInvoiceDownloadMarkup(invoice, amsProfile, workOrder, currentUser) {
  const amsWorkOrderNumber = workOrder?.amsWorkOrderNumber || "N/A";
  const externalWorkOrderNumber = workOrder?.externalWorkOrderNumber || "N/A";
  const externalWorkOrderMarkup = canViewExternalWorkOrder(currentUser)
    ? `<p class="meta"><strong>External Work Order Number:</strong> ${externalWorkOrderNumber}</p>`
    : "";
  const rows = (invoice.lineItems || [])
    .map(
      (item) => `
        <tr>
          <td>${item.service || ""}</td>
          <td>${item.description || ""}</td>
          <td>${item.qty || ""}</td>
          <td>${formatMoney(item.rate || 0)}</td>
          <td>${formatMoney(item.amount || 0)}</td>
        </tr>`
    )
    .join("");

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${invoice.invoiceNumber || "Invoice"}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
        h1, h2, p { margin: 0 0 12px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
        table { width: 100%; border-collapse: collapse; margin: 24px 0; }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
        th { background: #f4f4f4; }
        .meta { margin-bottom: 8px; }
      </style>
    </head>
    <body>
      <h1>${invoice.vendorCompany?.companyName || invoice.vendorName}</h1>
      <div class="grid">
        <div>
          <h2>Vendor</h2>
          <p>${invoice.vendorCompany?.contactName || ""}</p>
          <p>${invoice.vendorCompany?.email || ""}</p>
          <p>${invoice.vendorCompany?.phone || ""}</p>
          <p>${invoice.vendorCompany?.address || ""}</p>
          <p>${invoice.vendorCompany?.city || ""} ${invoice.vendorCompany?.state || ""} ${invoice.vendorCompany?.zip || ""}</p>
        </div>
        <div>
          <h2>Bill To: AMS</h2>
          <p>${amsProfile?.companyName || "Advanced Maintenance Services"}</p>
          <p>${amsProfile?.contactName || ""}</p>
          <p>${amsProfile?.email || ""}</p>
          <p>${amsProfile?.phone || ""}</p>
          <p>${amsProfile?.address || ""}</p>
          <p>${amsProfile?.city || ""} ${amsProfile?.state || ""} ${amsProfile?.zip || ""}</p>
        </div>
      </div>
      <p class="meta"><strong>Invoice Number:</strong> ${invoice.invoiceNumber || "Not set"}</p>
      <p class="meta"><strong>Invoice Date:</strong> ${formatDate(invoice.invoiceDate)}</p>
      <p class="meta"><strong>Due Date:</strong> ${formatDate(invoice.dueDate)}</p>
      <p class="meta"><strong>Terms:</strong> ${invoice.terms || "Net 30"}</p>
      <p class="meta"><strong>AMS Work Order Number:</strong> ${amsWorkOrderNumber}</p>
      ${externalWorkOrderMarkup}
      <table>
        <thead>
          <tr>
            <th>Service</th>
            <th>Description</th>
            <th>Qty</th>
            <th>Rate</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p><strong>Total:</strong> ${formatMoney(invoice.total || invoice.amount || 0)}</p>
      <p><strong>Notes:</strong> ${invoice.notes || "None"}</p>
      <p><strong>Remit:</strong> ${invoice.vendorCompany?.billingDetails || "Remit details pending."}</p>
    </body>
  </html>`;
}

function statusClassName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "-");
}

function StatusBadge({ value, label }) {
  return <span className={`status-pill ${statusClassName(value)}`}>{label || value}</span>;
}

function ProposalStateBadge({ value }) {
  const labels = {
    none: "None",
    opportunity: "Opportunity",
    under_review: "Under Review",
    awarded: "Awarded",
    closed: "Closed",
  };
  return <StatusBadge value={value} label={labels[value] || value} />;
}

function ProposalStatusBadge({ value }) {
  const labels = {
    submitted: "Submitted",
    revision_requested: "Revision Requested",
    rejected: "Rejected",
    approved: "Approved",
  };
  return <StatusBadge value={value} label={labels[value] || value} />;
}

function InvoiceStatusBadge({ value }) {
  return <StatusBadge value={value} label={value} />;
}

function SellControl({
  sellValue,
  pricingStatus,
  editing,
  onStartEdit,
  onChange,
  onSave,
  disabled = false,
}) {
  const isSet = pricingStatus === "set";

  if (isSet && !editing) {
    return (
      <div className="detail-card sell-lock-card">
        <div className="proposal-summary-grid">
          <div>
            <span className="detail-label">Sell Price</span>
            <p>{formatMoney(sellValue)}</p>
          </div>
          <div>
            <span className="detail-label">Status</span>
            <p>
              <StatusBadge value="set" label="Sell Set" />
            </p>
          </div>
        </div>
        {!disabled ? (
          <div className="form-actions">
            <button className="secondary-button" onClick={onStartEdit}>
              Edit Sell
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="detail-stack">
      <InputRow>
        <Field label="AMS Sell Price (Optional)">
          <input
            value={sellValue}
            onChange={(event) => onChange(event.target.value)}
            disabled={disabled}
            placeholder="Enter internal sell"
          />
        </Field>
      </InputRow>
      {!disabled ? (
        <div className="form-actions">
          <button className="secondary-button" onClick={onSave}>
            Save Sell
          </button>
        </div>
      ) : null}
    </div>
  );
}

function AppBuild03() {
  const [appState, setAppState] = useState(() => normalizeStateData(loadAppState()));
  const [showSplash, setShowSplash] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [activeModal, setActiveModal] = useState(null);
  const [workOrderFilter, setWorkOrderFilter] = useState("All");
  const [jobFilter, setJobFilter] = useState("All");
  const [workOrderSearch, setWorkOrderSearch] = useState("");
  const [jobSearch, setJobSearch] = useState("");
  const [siteSearch, setSiteSearch] = useState("");
  const [crewSearch, setCrewSearch] = useState("");
  const [proposalSearch, setProposalSearch] = useState("");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState(null);
  const [selectedProposalId, setSelectedProposalId] = useState(null);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [selectedCrewId, setSelectedCrewId] = useState(null);
  const [selectedCrewSiteId, setSelectedCrewSiteId] = useState(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [selectedTeamMemberId, setSelectedTeamMemberId] = useState(null);
  const [reviewForm, setReviewForm] = useState({ reviewedPrice: "", amsNotes: "", sellPrice: "" });
  const [workOrderDetailForm, setWorkOrderDetailForm] = useState({
    externalWorkOrderNumber: "",
    requireBeforeAfterPhotos: false,
    recurringVendorCost: "",
    recurringPricingNotes: "",
  });
  const [vendorProposalDrafts, setVendorProposalDrafts] = useState({});
  const [invoiceForm, setInvoiceForm] = useState({
    invoiceNumber: "",
    amount: "",
    total: "",
    invoiceDate: "",
    dueDate: "",
    terms: "Net 30",
    notes: "",
    status: "Invoice Submitted",
    lineItems: [{ id: "line-1", service: "", description: "", qty: "1", rate: "", amount: "" }],
  });
  const [jobSellForm, setJobSellForm] = useState("");
  const [accountingSellForm, setAccountingSellForm] = useState("");
  const [editingJobSellId, setEditingJobSellId] = useState(null);
  const [editingAccountingSellJobId, setEditingAccountingSellJobId] = useState(null);
  const [weatherCommandState, setWeatherCommandState] = useState([]);
  const [weatherLoaded, setWeatherLoaded] = useState(false);
  const [crewCompletedJobSearch, setCrewCompletedJobSearch] = useState("");
  const [crewSiteSearch, setCrewSiteSearch] = useState("");
  const [jobConfirmation, setJobConfirmation] = useState(null);
  const [siteForm, setSiteForm] = useState({
    name: "",
    streetAddress: "",
    city: "",
    state: "",
    zip: "",
    internalNotes: "",
    assignedVendorId: "",
    assignedCrewContactId: "",
  });
  const [vendorForm, setVendorForm] = useState({
    companyName: "",
    streetAddress: "",
    city: "",
    state: "",
    zip: "",
    contactName: "",
    phone: "",
    email: "",
    password: "",
    serviceType: "",
    serviceTypes: "",
    states: "",
    internalNotes: "",
  });
  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    jobTitle: "",
    companyName: "",
    streetAddress: "",
    city: "",
    state: "",
    zip: "",
    internalNotes: "",
    role: ROLES.AMS_ADMIN,
    accessStatus: "Active",
    authStatus: "Active",
  });
  const [workOrderForm, setWorkOrderForm] = useState({
    siteId: "",
    description: "",
    serviceType: "",
    workflowType: "direct",
    workType: "one_time",
    recurringFrequency: "",
    recurringVendorCost: "",
    recurringPricingNotes: "",
    seasonStart: "",
    seasonEnd: "",
    seasonalServiceType: "",
    directVendorId: "",
    externalWorkOrderNumber: "",
    requireBeforeAfterPhotos: false,
  });
  const [jobCreateForm, setJobCreateForm] = useState({ workOrderId: "", vendorId: "", price: "" });
  const [jobAssignment, setJobAssignment] = useState({});
  const [editingSiteId, setEditingSiteId] = useState(null);
  const [editingVendorId, setEditingVendorId] = useState(null);
  const [editingUserId, setEditingUserId] = useState(null);
  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    jobTitle: "",
    companyName: "",
    streetAddress: "",
    city: "",
    state: "",
    zip: "",
    internalNotes: "",
    profilePhotoStatus: "Photo Upload Coming Soon",
  });
  const [companyProfileForm, setCompanyProfileForm] = useState({
    companyName: "",
    contactName: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    billingDetails: "",
  });

  const updateAppState = (updater) => {
    // Future Firebase Auth + Firestore wiring can swap in here without changing screen logic.
    setAppState((current) => normalizeStateData(updater(current)));
  };

  useEffect(() => {
    // Future Firestore persistence would replace this local storage sync after backend approval.
    saveAppState(normalizeStateData(appState));
  }, [appState]);

  useEffect(() => {
    const splashTimer = window.setTimeout(() => setShowSplash(false), 180);
    return () => window.clearTimeout(splashTimer);
  }, []);

  useEffect(() => {
    const currentUserId = appState.ui?.currentUserId;
    if (!currentUserId) return;
    const savedUser = getAllUserPool(appState).find((user) => user.id === currentUserId) || null;
    if (!savedUser?.role) return;
    if (appState.ui?.activeScreenByRole?.[savedUser.role]) return;

    setAppState((current) =>
      normalizeStateData({
        ...current,
        ui: {
          ...current.ui,
          activeScreenByRole: {
            ...(current.ui?.activeScreenByRole || {}),
            [savedUser.role]: "dashboard",
          },
        },
      })
    );
  }, [appState]);

  useEffect(() => {
    const currentPath = window.location.pathname;
    const nextPath = getPortalPathForUser(findCurrentUser(appState));
    if (currentPath !== nextPath) {
      window.history.replaceState({}, "", nextPath);
    }
  }, [appState]);

  const currentUser = findCurrentUser(appState);
  const activeScreen = getActiveScreen(appState, currentUser);
  const showExternalWorkOrder = canViewExternalWorkOrder(currentUser);
  const isAmsViewer = isAmsUser(currentUser);
  const normalizedVendors = appState.vendors || [];
  const selectedSite =
    appState.sites.find((site) => site.id === appState.ui.selectedSiteId) || appState.sites[0] || null;
  const currentCrewRecord = findCrewForUser(normalizedVendors, currentUser);
  const currentCompanyProfile = getCompanyProfileForRole(appState, currentUser, currentCrewRecord);
  const selectedTeamMember =
    appState.users.find((user) => user.id === selectedTeamMemberId) || null;
  const nextWorkOrderNumber = getNextAmsWorkOrderNumber(appState.workOrders || []);

  const openScreen = (screen) => {
    if (!currentUser || screen === "logout") return;
    if (!DRAWER_MENUS[currentUser.role]?.includes(screen) && screen !== "profile") return;
    updateAppState((current) => ({
      ...current,
      ui: {
        ...current.ui,
        activeScreenByRole: {
          ...(current.ui?.activeScreenByRole || {}),
          [currentUser.role]: screen,
        },
      },
    }));
    setDrawerOpen(false);
    setProfileMenuOpen(false);
  };

  const openModal = (type) => {
    setActiveModal(type);
    if (type === "workOrder") {
      setWorkOrderForm({
        siteId: selectedSite?.id || appState.sites[0]?.id || "",
        description: "",
        serviceType: "",
        workflowType: "direct",
        workType: "one_time",
        recurringFrequency: "",
        recurringVendorCost: "",
        recurringPricingNotes: "",
        seasonStart: "",
        seasonEnd: "",
        seasonalServiceType: "",
        directVendorId: "",
        externalWorkOrderNumber: "",
        requireBeforeAfterPhotos: false,
      });
    }
    if (type === "job") {
      setJobCreateForm({ workOrderId: "", vendorId: "", price: "" });
    }
    if (type === "site") {
      setEditingSiteId(null);
      setSiteForm({
        name: "",
        streetAddress: "",
        city: "",
        state: "",
        zip: "",
        internalNotes: "",
        assignedVendorId: "",
        assignedCrewContactId: "",
      });
    }
    if (type === "vendor") {
      setEditingVendorId(null);
      setVendorForm({
        companyName: "",
        streetAddress: "",
        city: "",
        state: "",
        zip: "",
        contactName: "",
        phone: "",
        email: "",
        password: "",
        serviceType: "",
        serviceTypes: "",
        states: "",
        internalNotes: "",
      });
    }
    if (type === "amsTeammate") {
      setEditingUserId(null);
      setUserForm({
        name: "",
        email: "",
        password: "",
        phone: "",
        jobTitle: "",
        companyName: "Advanced Maintenance Services",
        streetAddress: "",
        city: "",
        state: "",
        zip: "",
        internalNotes: "",
        role: ROLES.AMS_MANAGER,
        accessStatus: "Active",
        authStatus: "Active",
      });
    }
  };

  const closeModal = () => setActiveModal(null);

  const setSelectedSite = (siteId) => {
    updateAppState((current) => ({
      ...current,
      ui: {
        ...current.ui,
        selectedSiteId: siteId,
      },
    }));
  };

  const showPlaceholder = (message) => window.alert(message);

  const completeLocalLogin = (match) => {
    if (!match) return false;

    updateAppState((current) => ({
      ...current,
      ui: {
        ...current.ui,
        currentUserId: match.id,
        activeScreenByRole: {
          ...(current.ui?.activeScreenByRole || {}),
          [match.role]: "dashboard",
        },
      },
    }));
    setLoginForm({ email: "", password: "" });
    return true;
  };

  const getFirebaseBridgeUser = (email) => {
    const normalizedEmail = email.trim().toLowerCase();
    const bridgeConfig = FIREBASE_ROLE_BRIDGE[normalizedEmail];
    if (!bridgeConfig) return null;

    const existingUser =
      getAllUserPool(appState).find(
        (user) => user.email?.toLowerCase() === normalizedEmail && user.role === bridgeConfig.role
      ) || null;

    if (existingUser) {
      return {
        ...existingUser,
        email: normalizedEmail,
        active: existingUser.active ?? true,
      };
    }

    return {
      id: createId("firebase-user"),
      name: bridgeConfig.name,
      email: normalizedEmail,
      password: "",
      role: bridgeConfig.role,
      active: true,
      accessStatus: "Active",
      authStatus: "Active",
      phone: "",
      jobTitle: bridgeConfig.role,
      companyName: bridgeConfig.role === ROLES.CREW ? "Crew Company" : "Advanced Maintenance Services",
      streetAddress: "",
      city: "",
      state: "",
      zip: "",
      internalNotes: "Firebase role bridge user",
    };
  };

  const completeFirebaseLogin = (firebaseUser) => {
    if (!firebaseUser) return false;

    updateAppState((current) => {
      const upsertedUsers = current.users.some((user) => user.id === firebaseUser.id)
        ? current.users.map((user) => (user.id === firebaseUser.id ? { ...user, ...firebaseUser } : user))
        : [firebaseUser, ...current.users];

      return {
        ...current,
        users: upsertedUsers,
        ui: {
          ...current.ui,
          currentUserId: firebaseUser.id,
          activeScreenByRole: {
            ...(current.ui?.activeScreenByRole || {}),
            [firebaseUser.role]: current.ui?.activeScreenByRole?.[firebaseUser.role] || "dashboard",
          },
        },
      };
    });
    setLoginForm({ email: "", password: "" });
    return true;
  };

  const findLocalLoginMatch = (email, password) =>
    getAllUserPool(appState).find((user) => {
      const expectedPassword =
        user.password || (user.role === ROLES.CREW ? "Crew123" : "");
      return (
        user.email.toLowerCase() === email.trim().toLowerCase() &&
        expectedPassword === password &&
        user.active
      );
    }) || null;

  const handleLogin = async (email, password) => {
    const match = (appState.users || []).find(
      (user) => user.email.toLowerCase() === email.trim().toLowerCase() && user.active
    );

    const firebaseResult = await signIn(email.trim(), password);
    if (firebaseResult.user) {
      const firebaseMappedUser = getFirebaseBridgeUser(email);
      if (firebaseMappedUser) {
        completeFirebaseLogin(firebaseMappedUser);
        return;
      }
    }

    if (firebaseResult.user && match) {
      completeLocalLogin(match);
      return;
    }

    const localMatch = findLocalLoginMatch(email, password);
    if (localMatch) {
      completeLocalLogin(localMatch);
      return;
    }

    if (firebaseResult.user && !match) {
      await signOutUser();
    }

    if (!match && !firebaseResult.user) {
      window.alert("Invalid email or password.");
      return;
    }
    window.alert("This account is authenticated but is not mapped to a local AMS role yet.");
  };

  const handleDemoLogin = (type) => {
    const demoMatch =
      type === "ams"
        ? findLocalLoginMatch("shawnp@advancedmtnc.com", "AMS123")
        : findLocalLoginMatch("abbyquinn@rocketmail.com", "Pumpkin");

    if (!demoMatch) {
      window.alert("Demo login is unavailable.");
      return;
    }

    completeLocalLogin(demoMatch);
  };

  const logout = async () => {
    await signOutUser();
    updateAppState((current) => ({
      ...current,
      ui: {
        ...current.ui,
        currentUserId: null,
      },
    }));
    setDrawerOpen(false);
    setProfileMenuOpen(false);
  };

  const updateLoginField = (key, value) => {
    setLoginForm((current) => ({ ...current, [key]: value }));
  };

  const saveSite = () => {
    if (!siteForm.name.trim() || !siteForm.streetAddress.trim() || !siteForm.city.trim() || !siteForm.state.trim()) {
      window.alert("Site name, street address, city, and state are required.");
      return;
    }

    const assignedVendor = normalizedVendors.find((vendor) => vendor.id === siteForm.assignedVendorId);
    const assignedCrewContact =
      appState.users.find(
        (user) => user.id === siteForm.assignedCrewContactId && user.role === ROLES.CREW
      ) || null;
    const siteRecord = {
      ...siteForm,
      state: siteForm.state.toUpperCase(),
      assignedVendorId: siteForm.assignedVendorId || "",
      assignedVendorName: assignedVendor?.name || "",
      assignedCrewContactId: siteForm.assignedCrewContactId || "",
      assignedCrewContactName: assignedCrewContact?.name || "",
      address: buildAddressLine(siteForm),
      siteMapStatus: "Upload Coming Soon",
      geoFenceStatus: "Geo Fence Setup Coming Soon",
    };

    if (editingSiteId) {
      updateAppState((current) => ({
        ...current,
        sites: current.sites.map((site) =>
          site.id === editingSiteId ? { ...site, ...siteRecord } : site
        ),
      }));
    } else {
      updateAppState((current) => ({
        ...current,
        sites: [{ id: createId("site"), ...siteRecord }, ...current.sites],
      }));
    }

    setSiteForm({
      name: "",
      streetAddress: "",
      city: "",
      state: "",
      zip: "",
      internalNotes: "",
      assignedVendorId: "",
      assignedCrewContactId: "",
    });
    setEditingSiteId(null);
    closeModal();
  };

  const startEditSite = (site) => {
    setSiteForm({
      name: site.name,
      streetAddress: site.streetAddress || "",
      city: site.city || "",
      state: site.state || "",
      zip: site.zip || "",
      internalNotes: site.internalNotes || "",
      assignedVendorId: site.assignedVendorId || "",
      assignedCrewContactId: site.assignedCrewContactId || "",
    });
    setEditingSiteId(site.id);
    setActiveModal("site");
  };

  const removeSite = (siteId) => {
    const relatedWorkOrderIds = appState.workOrders
      .filter((workOrder) => workOrder.siteId === siteId)
      .map((workOrder) => workOrder.id);

    updateAppState((current) => ({
      ...current,
      sites: current.sites.filter((site) => site.id !== siteId),
      workOrders: current.workOrders.filter((workOrder) => workOrder.siteId !== siteId),
      jobs: current.jobs.filter((job) => job.siteId !== siteId),
      proposals: current.proposals.filter(
        (proposal) => !relatedWorkOrderIds.includes(proposal.workOrderId)
      ),
      invoices: current.invoices.filter((invoice) => invoice.siteId !== siteId),
      ui: {
        ...current.ui,
        selectedSiteId:
          current.ui.selectedSiteId === siteId
            ? current.sites.find((site) => site.id !== siteId)?.id || null
            : current.ui.selectedSiteId,
      },
    }));
  };

  const saveVendor = () => {
    if (!vendorForm.companyName.trim() || !vendorForm.email.trim() || !vendorForm.serviceType) {
      window.alert("Company name, email, and primary service type are required.");
      return;
    }

    const parsedServiceTypes = vendorForm.serviceTypes
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const parsedStates = vendorForm.states
      .split(",")
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean);
    const existingVendor = normalizedVendors.find((vendor) => vendor.id === editingVendorId);
    const existingCrewUser =
      appState.users.find((user) => user.id === existingVendor?.userId) || null;
    const password = vendorForm.password || existingCrewUser?.password || "Crew123";

    const vendorRecord = {
      name: vendorForm.companyName.trim(),
      companyName: vendorForm.companyName.trim(),
      streetAddress: vendorForm.streetAddress.trim(),
      city: vendorForm.city.trim(),
      state: vendorForm.state.trim().toUpperCase(),
      zip: vendorForm.zip.trim(),
      contactName: vendorForm.contactName.trim(),
      phone: vendorForm.phone.trim(),
      email: vendorForm.email.trim(),
      password,
      serviceType: vendorForm.serviceType,
      serviceTypes: parsedServiceTypes.length ? parsedServiceTypes : [vendorForm.serviceType],
      states: parsedStates,
      userId: existingVendor?.userId || "",
      internalNotes: vendorForm.internalNotes.trim(),
      address: buildAddressLine({
        streetAddress: vendorForm.streetAddress.trim(),
        city: vendorForm.city.trim(),
        state: vendorForm.state.trim().toUpperCase(),
        zip: vendorForm.zip.trim(),
      }),
    };

    const upsertCrewUser = (users, vendorUserId) => {
      const nextUserId = vendorUserId || createId("user");
      const linkedUser = {
        id: nextUserId,
        active: true,
        role: ROLES.CREW,
        name: vendorRecord.contactName || vendorRecord.companyName,
        email: vendorRecord.email,
        password,
        phone: vendorRecord.phone,
        jobTitle: "Crew Contact",
        companyName: vendorRecord.companyName,
        streetAddress: vendorRecord.streetAddress,
        city: vendorRecord.city,
        state: vendorRecord.state,
        zip: vendorRecord.zip,
        internalNotes: vendorRecord.internalNotes,
        profilePhotoStatus: "Photo Upload Coming Soon",
        address: vendorRecord.address,
      };

      if (vendorUserId && users.some((user) => user.id === vendorUserId)) {
        return {
          userId: vendorUserId,
          users: users.map((user) => (user.id === vendorUserId ? { ...user, ...linkedUser } : user)),
        };
      }

      return {
        userId: nextUserId,
        users: [{ ...linkedUser }, ...users],
      };
    };

    if (editingVendorId) {
      updateAppState((current) => {
        const linkedUserUpdate = upsertCrewUser(current.users, existingVendor?.userId);
        return {
          ...current,
          users: linkedUserUpdate.users,
          vendors: current.vendors.map((vendor) =>
            vendor.id === editingVendorId
              ? { ...vendor, ...vendorRecord, userId: linkedUserUpdate.userId }
              : vendor
          ),
          companyProfiles: {
            ...(current.companyProfiles || {}),
            vendors: {
              ...(current.companyProfiles?.vendors || {}),
              [editingVendorId]: {
                ...(current.companyProfiles?.vendors?.[editingVendorId] || {}),
                companyName: vendorRecord.companyName,
                contactName: vendorRecord.contactName,
                phone: vendorRecord.phone,
                email: vendorRecord.email,
                address: vendorRecord.streetAddress,
                city: vendorRecord.city,
                state: vendorRecord.state,
                zip: vendorRecord.zip,
              },
            },
          },
        };
      });
    } else {
      const newVendorId = createId("vendor");
      updateAppState((current) => {
        const linkedUserUpdate = upsertCrewUser(current.users, null);
        return {
          ...current,
          users: linkedUserUpdate.users,
          vendors: [
            { id: newVendorId, active: true, ...vendorRecord, userId: linkedUserUpdate.userId },
            ...current.vendors,
          ],
          companyProfiles: {
            ...(current.companyProfiles || {}),
            vendors: {
              ...(current.companyProfiles?.vendors || {}),
              [newVendorId]: {
                companyName: vendorRecord.companyName,
                contactName: vendorRecord.contactName,
                phone: vendorRecord.phone,
                email: vendorRecord.email,
                address: vendorRecord.streetAddress,
                city: vendorRecord.city,
                state: vendorRecord.state,
                zip: vendorRecord.zip,
                billingDetails: "",
              },
            },
          },
        };
      });
    }

    setVendorForm({
      companyName: "",
      streetAddress: "",
      city: "",
      state: "",
      zip: "",
      contactName: "",
      phone: "",
      email: "",
      password: "",
      serviceType: "",
      serviceTypes: "",
      states: "",
      internalNotes: "",
    });
    setEditingVendorId(null);
    closeModal();
  };

  const startEditVendor = (vendor) => {
    const normalizedVendor = normalizeVendor(vendor);
    const linkedUser = appState.users.find((user) => user.id === normalizedVendor.userId) || null;
    setVendorForm({
      companyName: normalizedVendor.companyName || "",
      streetAddress: normalizedVendor.streetAddress || "",
      city: normalizedVendor.city || "",
      state: normalizedVendor.state || "",
      zip: normalizedVendor.zip || "",
      contactName: normalizedVendor.contactName || "",
      phone: normalizedVendor.phone || "",
      email: normalizedVendor.email || "",
      password: linkedUser?.password || normalizedVendor.password || "",
      serviceType: normalizedVendor.serviceType,
      serviceTypes: normalizedVendor.serviceTypes.join(", "),
      states: normalizedVendor.states.join(", "),
      internalNotes: normalizedVendor.internalNotes || "",
    });
    setEditingVendorId(vendor.id);
    setActiveModal("vendor");
  };

  const toggleVendorActive = (vendorId) => {
    updateAppState((current) => ({
      ...current,
      vendors: current.vendors.map((vendor) =>
        vendor.id === vendorId ? { ...vendor, active: !vendor.active } : vendor
      ),
    }));
  };

  const saveUser = () => {
    if (!userForm.name.trim() || !userForm.email.trim() || !userForm.password.trim()) {
      window.alert("Name, email, and password are required.");
      return;
    }

    const userRecord = {
      ...userForm,
      phone: userForm.phone.trim(),
      jobTitle: userForm.jobTitle.trim(),
      companyName: userForm.companyName.trim(),
      streetAddress: userForm.streetAddress.trim(),
      city: userForm.city.trim(),
      state: userForm.state.trim().toUpperCase(),
      zip: userForm.zip.trim(),
      internalNotes: userForm.internalNotes.trim(),
      address: buildAddressLine({
        streetAddress: userForm.streetAddress.trim(),
        city: userForm.city.trim(),
        state: userForm.state.trim().toUpperCase(),
        zip: userForm.zip.trim(),
      }),
      profilePhotoStatus: "Photo Upload Coming Soon",
      accessStatus: userForm.accessStatus || "Active",
      authStatus: userForm.authStatus || "Active",
      active: (userForm.accessStatus || "Active") === "Active",
    };

    const nextUserId = editingUserId || createId("user");

    if (editingUserId) {
      updateAppState((current) => ({
        ...current,
        users: current.users.map((user) =>
          user.id === editingUserId ? { ...user, ...userRecord } : user
        ),
      }));
    } else {
      updateAppState((current) => ({
        ...current,
        users: [{ id: nextUserId, active: true, ...userRecord }, ...current.users],
      }));
    }

    setUserForm({
      name: "",
      email: "",
      password: "",
      phone: "",
      jobTitle: "",
      companyName: "",
      streetAddress: "",
      city: "",
      state: "",
      zip: "",
      internalNotes: "",
      role: ROLES.AMS_ADMIN,
      accessStatus: "Active",
      authStatus: "Active",
    });
    setSelectedTeamMemberId(nextUserId);
    setEditingUserId(null);
    closeModal();
  };

  const startEditUser = (user) => {
    setUserForm({
      name: user.name,
      email: user.email,
      password: user.password,
      phone: user.phone || "",
      jobTitle: user.jobTitle || "",
      companyName: user.companyName || "",
      streetAddress: user.streetAddress || "",
      city: user.city || "",
      state: user.state || "",
      zip: user.zip || "",
      internalNotes: user.internalNotes || "",
      role: user.role,
      accessStatus: user.accessStatus || (user.active ? "Active" : "Inactive"),
      authStatus: user.authStatus || (user.active ? "Active" : "Disabled"),
    });
    setEditingUserId(user.id);
  };

  const toggleUserActive = (userId) => {
    const targetUser = appState.users.find((user) => user.id === userId);
    if (!userCanManageUser(currentUser, targetUser)) return;
    updateAppState((current) => ({
      ...current,
      users: current.users.map((user) =>
        user.id === userId
          ? {
              ...user,
              active: !user.active,
              accessStatus: user.active ? "Inactive" : "Active",
              authStatus: user.active ? "Disabled" : "Active",
            }
          : user
      ),
    }));
  };

  const archiveUser = (userId) => {
    const targetUser = appState.users.find((user) => user.id === userId);
    if (!userCanManageUser(currentUser, targetUser)) return;
    updateAppState((current) => ({
      ...current,
      users: current.users.map((user) =>
        user.id === userId
          ? {
              ...user,
              active: false,
              accessStatus: "Inactive",
              authStatus: "Disabled",
              archivedAt: new Date().toISOString(),
            }
          : user
      ),
    }));
  };

  const deleteUser = (userId) => {
    const targetUser = appState.users.find((user) => user.id === userId);
    if (!userCanManageUser(currentUser, targetUser)) return;
    const confirmed = window.confirm(
      `Delete ${targetUser?.name || "this user"}? This will remove the local operational record and should only be used when you are sure.`
    );
    if (!confirmed) return;

    updateAppState((current) => ({
      ...current,
      users: current.users.filter((user) => user.id !== userId),
      ui: {
        ...current.ui,
        currentUserId: current.ui?.currentUserId === userId ? null : current.ui?.currentUserId || null,
      },
    }));
  };
  const createWorkOrder = () => {
    if (!workOrderForm.siteId || !workOrderForm.description.trim()) {
      window.alert("Site and description are required.");
      return;
    }
    if (workOrderForm.workType === "recurring" && !workOrderForm.recurringFrequency) {
      window.alert("Select a recurring frequency before creating this work order.");
      return;
    }
    if (
      workOrderForm.workType === "seasonal" &&
      (!workOrderForm.seasonStart || !workOrderForm.seasonEnd || !workOrderForm.seasonalServiceType)
    ) {
      window.alert("Seasonal work orders need a season start, season end, and service type.");
      return;
    }

    const site = appState.sites.find((entry) => entry.id === workOrderForm.siteId);
    if (!site) {
      window.alert("Selected site was not found.");
      return;
    }

    const directVendor =
      workOrderForm.workflowType === "direct" && workOrderForm.directVendorId
        ? normalizedVendors.find((vendor) => vendor.id === workOrderForm.directVendorId)
        : null;

    if (workOrderForm.workflowType === "direct" && workOrderForm.directVendorId && !directVendor) {
      window.alert("Selected crew was not found.");
      return;
    }

    const createdAt = new Date().toISOString();
    const proposalRequired = workOrderForm.workflowType === "proposal";
    const workType = workOrderForm.workType || "one_time";
    const record = {
      id: createId("wo"),
      amsWorkOrderNumber: nextWorkOrderNumber,
      externalWorkOrderNumber: workOrderForm.externalWorkOrderNumber.trim(),
      siteId: site.id,
      siteName: site.name,
      description: workOrderForm.description.trim(),
      serviceType: workOrderForm.serviceType || "General Maintenance",
      status: directVendor ? "Assigned" : "Open",
      proposalRequired,
      proposalState: proposalRequired ? "opportunity" : "none",
      proposalRequestedAt: proposalRequired ? createdAt : "",
      proposalAwardedAt: "",
      assignedVendorId: directVendor?.id || "",
      assignedVendorName: directVendor?.name || "",
      jobId: "",
      requireBeforeAfterPhotos: Boolean(workOrderForm.requireBeforeAfterPhotos),
      workType,
      recurringFrequency: workType === "recurring" ? workOrderForm.recurringFrequency : "",
      recurringVendorCost:
        workType === "recurring" ? String(workOrderForm.recurringVendorCost || "").trim() : "",
      recurringPricingNotes:
        workType === "recurring" ? String(workOrderForm.recurringPricingNotes || "").trim() : "",
      seasonStart: workType === "seasonal" ? workOrderForm.seasonStart : "",
      seasonEnd: workType === "seasonal" ? workOrderForm.seasonEnd : "",
      seasonalServiceType: workType === "seasonal" ? workOrderForm.seasonalServiceType : "",
      createdAt,
    };

      const createdJob = directVendor
        ? buildJobRecord({ workOrder: record, vendor: directVendor, price: "", currentUser })
        : null;

    updateAppState((current) => ({
      ...current,
      workOrders: [{ ...record, jobId: createdJob?.id || "" }, ...current.workOrders],
      jobs: createdJob ? [createdJob, ...current.jobs] : current.jobs,
    }));

    setWorkOrderForm({
      siteId: selectedSite?.id || "",
      description: "",
      serviceType: "",
      workflowType: "direct",
      workType: "one_time",
      recurringFrequency: "",
      seasonStart: "",
      seasonEnd: "",
      seasonalServiceType: "",
      directVendorId: "",
      externalWorkOrderNumber: "",
      requireBeforeAfterPhotos: false,
      recurringVendorCost: "",
      recurringPricingNotes: "",
    });
    closeModal();
  };

  const saveWorkOrderDetail = () => {
    if (!selectedWorkOrderId) return;
    updateAppState((current) => ({
      ...current,
      workOrders: current.workOrders.map((workOrder) =>
        workOrder.id === selectedWorkOrderId
          ? {
              ...workOrder,
              externalWorkOrderNumber: workOrderDetailForm.externalWorkOrderNumber,
              requireBeforeAfterPhotos: workOrderDetailForm.requireBeforeAfterPhotos,
              recurringVendorCost:
                workOrder.workType === "recurring"
                  ? String(workOrderDetailForm.recurringVendorCost || "").trim()
                  : workOrder.recurringVendorCost ?? "",
              recurringPricingNotes:
                workOrder.workType === "recurring"
                  ? String(workOrderDetailForm.recurringPricingNotes || "").trim()
                  : workOrder.recurringPricingNotes || "",
            }
          : workOrder
      ),
    }));
  };

  const assignVendorToWorkOrder = (workOrderId) => {
    const vendorId = jobAssignment[workOrderId];
    if (!vendorId) {
      window.alert("Choose a crew before assigning a job.");
      return;
    }

    const workOrder = appState.workOrders.find((entry) => entry.id === workOrderId);
    const vendor = normalizedVendors.find((entry) => entry.id === vendorId);
    if (!workOrder || !vendor) return;

    if (workOrder.proposalRequired) {
      window.alert("Proposal work orders must be awarded through proposal review.");
      return;
    }

    if (appState.jobs.find((job) => job.workOrderId === workOrderId)) {
      window.alert("A job already exists for this work order.");
      return;
    }

    const newJob = buildJobRecord({ workOrder, vendor, price: "", currentUser });

    updateAppState((current) => ({
      ...current,
      jobs: [newJob, ...current.jobs],
      workOrders: current.workOrders.map((entry) =>
        entry.id === workOrderId
          ? {
              ...entry,
              status: "Assigned",
              assignedVendorId: vendor.id,
              assignedVendorName: vendor.name,
              jobId: newJob.id,
              proposalRequired: false,
            }
          : entry
      ),
    }));
  };

  const createManualJob = () => {
    const workOrder = appState.workOrders.find((entry) => entry.id === jobCreateForm.workOrderId);
    const vendor = normalizedVendors.find((entry) => entry.id === jobCreateForm.vendorId);
    if (!workOrder || !vendor) {
      window.alert("Choose a work order and crew.");
      return;
    }
    if (appState.jobs.some((job) => job.workOrderId === workOrder.id)) {
      window.alert("This work order already has a job.");
      return;
    }

    const newJob = buildJobRecord({ workOrder, vendor, price: jobCreateForm.price, currentUser });
    updateAppState((current) => ({
      ...current,
      jobs: [newJob, ...current.jobs],
      workOrders: current.workOrders.map((entry) =>
        entry.id === workOrder.id
          ? {
              ...entry,
              status: "Assigned",
              assignedVendorId: vendor.id,
              assignedVendorName: vendor.name,
              jobId: newJob.id,
            }
          : entry
      ),
    }));
    closeModal();
  };

  const updateInvoiceLineItem = (lineItemId, key, value) => {
    setInvoiceForm((current) => {
      const lineItems = current.lineItems.map((lineItem) => {
        if (lineItem.id !== lineItemId) return lineItem;
        const updated = { ...lineItem, [key]: value };
        if (key === "qty" || key === "rate") {
          updated.amount = (toNumber(updated.qty) * toNumber(updated.rate)).toFixed(2);
        }
        return updated;
      });
      return {
        ...current,
        lineItems,
        amount: calculateInvoiceTotal(lineItems),
        total: calculateInvoiceTotal(lineItems),
      };
    });
  };

  const addInvoiceLineItem = () => {
    setInvoiceForm((current) => ({
      ...current,
      lineItems: [
        ...current.lineItems,
        { id: createId("line"), service: "", description: "", qty: "1", rate: "", amount: "" },
      ],
    }));
  };

  const saveProfile = () => {
    if (!currentUser) return;
    updateAppState((current) => {
      const nextUsers = current.users.map((user) =>
        user.id === currentUser.id
          ? {
              ...user,
              name: profileForm.name.trim(),
              email: currentUser.role === ROLES.CREW ? user.email : profileForm.email.trim(),
              password: profileForm.password || user.password || "Crew123",
              phone: profileForm.phone.trim(),
              jobTitle: profileForm.jobTitle.trim(),
              companyName:
                currentUser.role === ROLES.CREW ? user.companyName : profileForm.companyName.trim(),
              streetAddress: profileForm.streetAddress.trim(),
              city: profileForm.city.trim(),
              state: profileForm.state.trim().toUpperCase(),
              zip: profileForm.zip.trim(),
              internalNotes: profileForm.internalNotes.trim(),
              profilePhotoStatus: profileForm.profilePhotoStatus || "Photo Upload Coming Soon",
              address: buildAddressLine({
                streetAddress: profileForm.streetAddress.trim(),
                city: profileForm.city.trim(),
                state: profileForm.state.trim().toUpperCase(),
                zip: profileForm.zip.trim(),
              }),
            }
          : user
      );

      if (currentUser.role === ROLES.CREW && currentCrewRecord) {
        return {
          ...current,
          users: nextUsers,
          vendors: current.vendors.map((vendor) =>
            vendor.id === currentCrewRecord.id
              ? {
                  ...vendor,
                  contactName: profileForm.name.trim(),
                  phone: profileForm.phone.trim(),
                  password: profileForm.password || vendor.password || "Crew123",
                }
              : vendor
          ),
          companyProfiles: {
            ...(current.companyProfiles || {}),
            vendors: {
              ...(current.companyProfiles?.vendors || {}),
              [currentCrewRecord.id]: {
                ...(current.companyProfiles?.vendors?.[currentCrewRecord.id] || {}),
                contactName: profileForm.name.trim(),
                phone: profileForm.phone.trim(),
              },
            },
          },
        };
      }

      return {
        ...current,
        users: nextUsers,
      };
    });
  };

  const saveCompanyProfile = () => {
    if (!currentUser) return;
    updateAppState((current) => {
      if (currentUser.role === ROLES.CREW && currentCrewRecord) {
        return {
          ...current,
          vendors: current.vendors.map((vendor) =>
            vendor.id === currentCrewRecord.id
              ? {
                  ...vendor,
                  companyName: companyProfileForm.companyName,
                  contactName: companyProfileForm.contactName,
                  phone: companyProfileForm.phone,
                  email: companyProfileForm.email,
                  streetAddress: companyProfileForm.address,
                  city: companyProfileForm.city,
                  state: companyProfileForm.state,
                  zip: companyProfileForm.zip,
                  address: buildAddressLine({
                    streetAddress: companyProfileForm.address,
                    city: companyProfileForm.city,
                    state: companyProfileForm.state,
                    zip: companyProfileForm.zip,
                  }),
                }
              : vendor
          ),
          companyProfiles: {
            ...(current.companyProfiles || {}),
            vendors: {
              ...(current.companyProfiles?.vendors || {}),
              [currentCrewRecord.id]: { ...companyProfileForm },
            },
          },
        };
      }

      return {
        ...current,
        companyProfiles: {
          ...(current.companyProfiles || {}),
          ams: { ...companyProfileForm },
          vendors: { ...(current.companyProfiles?.vendors || {}) },
        },
      };
    });
  };

  const downloadInvoice = (invoice) => {
    if (!invoice) return;
    const linkedWorkOrder =
      appState.workOrders.find((workOrder) => workOrder.id === invoice.workOrderId) || null;
    const markup = buildInvoiceDownloadMarkup(
      invoice,
      appState.companyProfiles?.ams,
      linkedWorkOrder,
      currentUser
    );
    const blob = new Blob([markup], { type: "text/html;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${invoice.invoiceNumber || invoice.id}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const updateWorkOrderStatus = (workOrderId, status) => {
    updateAppState((current) => ({
      ...current,
      workOrders: current.workOrders.map((workOrder) =>
        workOrder.id === workOrderId ? { ...workOrder, status } : workOrder
      ),
    }));
  };

  const updateJobStatus = (jobId, status) => {
    updateAppState((current) => ({
      ...current,
      jobs: current.jobs.map((job) => {
        if (job.id !== jobId) return job;
        const timestamp = new Date().toISOString();
        const nextStartTime =
          status === "In Progress" ? job.startTime || timestamp : job.startTime || "";
        const nextCompletedTime =
          status === "Completed" ? job.completedTime || timestamp : job.completedTime || "";
        return {
          ...job,
          status,
          startTime: nextStartTime,
          completedTime: nextCompletedTime,
          completedAt: nextCompletedTime,
          serviceDate: job.serviceDate || nextCompletedTime || nextStartTime || "",
          servicePerformed: job.servicePerformed || job.serviceType,
          scope: job.scope || job.description || "",
          notes: job.notes || "",
        };
      }),
      workOrders: current.workOrders.map((workOrder) => {
        const linkedJob = current.jobs.find((job) => job.id === jobId);
        if (!linkedJob || workOrder.id !== linkedJob.workOrderId) return workOrder;
        return {
          ...workOrder,
          status:
            status === "Completed"
              ? "Completed"
              : status === "In Progress"
              ? "In Progress"
              : status === "Assigned"
              ? "Assigned"
              : workOrder.status,
        };
      }),
    }));
  };

  const persistProposalReviewEdits = (proposalId, updates) => {
    updateAppState((current) => ({
      ...current,
      proposals: current.proposals.map((proposal) =>
        proposal.id === proposalId ? { ...proposal, ...updates } : proposal
      ),
    }));
  };

  const handleEditProposal = () => {
    if (!selectedProposal) return;
    persistProposalReviewEdits(selectedProposal.id, {
      reviewedPrice: reviewForm.reviewedPrice,
      amsNotes: reviewForm.amsNotes,
      lastReviewedAt: new Date().toISOString(),
    });
  };

  const handleRequestRevision = () => {
    if (!selectedProposal) return;
    persistProposalReviewEdits(selectedProposal.id, {
      status: "revision_requested",
      reviewedPrice: reviewForm.reviewedPrice,
      amsNotes: reviewForm.amsNotes,
      requestedRevisionAt: new Date().toISOString(),
      lastReviewedAt: new Date().toISOString(),
    });
  };

  const handleRejectProposal = () => {
    if (!selectedProposal) return;
    persistProposalReviewEdits(selectedProposal.id, {
      status: "rejected",
      reviewedPrice: reviewForm.reviewedPrice,
      amsNotes: reviewForm.amsNotes,
      rejectedAt: new Date().toISOString(),
      isActivePath: false,
      lastReviewedAt: new Date().toISOString(),
    });
  };

  const handleApproveProposal = () => {
    if (!selectedProposal || !selectedWorkOrder) return;
    const vendor = normalizedVendors.find((entry) => entry.id === selectedProposal.vendorId);
    if (!vendor) {
      window.alert("The proposal crew could not be found.");
      return;
    }
    if (appState.jobs.find((job) => job.workOrderId === selectedWorkOrder.id)) {
      window.alert("A job already exists for this work order.");
      return;
    }

    const approvedAt = new Date().toISOString();
    const approvedPrice = reviewForm.reviewedPrice || selectedProposal.reviewedPrice || selectedProposal.submittedPrice;
      const newJob = buildJobRecord({
        workOrder: selectedWorkOrder,
        vendor,
        price: approvedPrice,
        sell: reviewForm.sellPrice,
        currentUser,
      });

    updateAppState((current) => ({
      ...current,
      proposals: current.proposals
        .map((proposal) => {
          if (proposal.workOrderId !== selectedWorkOrder.id) return proposal;
          if (proposal.id === selectedProposal.id) {
            return {
              ...proposal,
              status: "approved",
              reviewedPrice: approvedPrice,
              amsNotes: reviewForm.amsNotes,
              approvedAt,
              isActivePath: false,
              lastReviewedAt: approvedAt,
            };
          }
          if (proposal.isActivePath) {
            return {
              ...proposal,
              status: "rejected",
              rejectedAt: proposal.rejectedAt || approvedAt,
              isActivePath: false,
              lastReviewedAt: approvedAt,
            };
          }
          return proposal;
        })
        .filter((proposal) => proposal.id !== selectedProposal.id),
      workOrders: current.workOrders.map((workOrder) =>
        workOrder.id === selectedWorkOrder.id
          ? {
              ...workOrder,
              status: "Assigned",
              assignedVendorId: vendor.id,
              assignedVendorName: vendor.name,
              jobId: newJob.id,
              proposalAwardedAt: approvedAt,
            }
          : workOrder
      ),
      jobs: [newJob, ...current.jobs],
    }));
  };

  const updateVendorProposalDraft = (workOrderId, key, value) => {
    setVendorProposalDrafts((current) => ({
      ...current,
      [workOrderId]: {
        submittedPrice: "",
        submittedNotes: "",
        ...(current[workOrderId] || {}),
        [key]: value,
      },
    }));
  };

  const prepareResubmissionDraft = (proposal) => {
    setVendorProposalDrafts((current) => ({
      ...current,
      [proposal.workOrderId]: {
        submittedPrice: proposal.reviewedPrice || proposal.submittedPrice || "",
        submittedNotes: proposal.amsNotes || proposal.submittedNotes || "",
      },
    }));
  };

  const handleCrewProposalSubmit = (workOrder) => {
    if (!currentCrewRecord) return;
    const site = appState.sites.find((entry) => entry.id === workOrder.siteId);
    if (!canCrewSubmitProposal({
      workOrder,
      site,
      vendor: currentCrewRecord,
      proposals: appState.proposals,
      jobs: appState.jobs,
    })) {
      window.alert("This proposal opportunity is not available for submission.");
      return;
    }

    const draft = vendorProposalDrafts[workOrder.id] || {};
    if (!String(draft.submittedPrice || "").trim()) {
      window.alert("Proposal price is required.");
      return;
    }

    const latestProposal = getLatestCrewProposal(appState.proposals, workOrder.id, currentCrewRecord.id);
    const submittedAt = new Date().toISOString();
    const newProposal = {
      id: createId("proposal"),
      workOrderId: workOrder.id,
      vendorId: currentCrewRecord.id,
      vendorCompanyName: currentCrewRecord.name,
      submittedPrice: draft.submittedPrice,
      submittedNotes: draft.submittedNotes || "",
      submittedAt,
      reviewedPrice: "",
      amsNotes: "",
      lastReviewedAt: "",
      status: "submitted",
      revisionCount: latestProposal ? (latestProposal.revisionCount || 1) + 1 : 1,
      supersedesProposalId: latestProposal?.id || null,
      isActivePath: true,
      rejectedAt: "",
      approvedAt: "",
      requestedRevisionAt: "",
    };

    updateAppState((current) => ({
      ...current,
      proposals: [
        newProposal,
        ...current.proposals.map((proposal) =>
          latestProposal && proposal.id === latestProposal.id
            ? { ...proposal, isActivePath: false }
            : proposal
        ),
      ],
    }));

    setVendorProposalDrafts((current) => ({
      ...current,
      [workOrder.id]: { submittedPrice: "", submittedNotes: "" },
    }));
  };

  const createInvoiceForJob = (job) => {
    if (!currentUser) return;
    if (getInvoiceForJob(appState.invoices, job.id)) {
      window.alert("An invoice already exists for this job.");
      return;
    }
    const workOrder = appState.workOrders.find((entry) => entry.id === job.workOrderId);
    const companyProfile = appState.companyProfiles?.vendors?.[job.vendorId] || {};
    const invoice = {
      ...buildInvoiceRecord({ job, workOrder, currentUser }),
      vendorCompany: { ...companyProfile },
      amount: calculateInvoiceTotal(
        buildInvoiceRecord({ job, workOrder, currentUser }).lineItems
      ),
      total: calculateInvoiceTotal(
        buildInvoiceRecord({ job, workOrder, currentUser }).lineItems
      ),
    };
    updateAppState((current) => ({ ...current, invoices: [invoice, ...current.invoices] }));
    setSelectedInvoiceId(invoice.id);
  };

  const openJobConfirmation = (type, jobId) => {
    const job = appState.jobs.find((entry) => entry.id === jobId);
    if (!job) return;
    if (type === "start" && job.startTime) return;
    if (type === "complete" && job.completedTime) return;
    setJobConfirmation({ type, jobId });
  };

  const confirmJobStatusChange = () => {
    if (!jobConfirmation?.jobId) return;
    const nextStatus = jobConfirmation.type === "start" ? "In Progress" : "Completed";
    updateJobStatus(jobConfirmation.jobId, nextStatus);
    setJobConfirmation(null);
  };

  const saveJobSell = (jobId, sellValue) => {
    if (!jobId || !(AMS_ROLES.includes(currentUser?.role) || currentUser?.role === ROLES.OWNER)) return;
    updateAppState((current) => ({
      ...current,
      jobs: current.jobs.map((job) =>
        job.id === jobId
          ? {
              ...job,
              ...buildPricingFields({ sell: sellValue, currentUser, existingJob: job }),
            }
          : job
      ),
    }));
  };

  const saveSelectedJobSell = () => {
    const targetJobId = editingJobSellId || selectedWorkOrderJob?.id || selectedJob?.id;
    if (!targetJobId) return;
    saveJobSell(targetJobId, jobSellForm);
    setEditingJobSellId(null);
  };

  const saveAccountingSell = () => {
    if (!selectedInvoiceJob) return;
    saveJobSell(selectedInvoiceJob.id, accountingSellForm);
    setEditingAccountingSellJobId(null);
  };

  const saveInvoice = () => {
    if (!selectedInvoiceId) return;
    const locked = selectedInvoice?.status === "Paid";
    if (locked) return;
    const total = calculateInvoiceTotal(invoiceForm.lineItems);
    updateAppState((current) => ({
      ...current,
      invoices: current.invoices.map((invoice) =>
        invoice.id === selectedInvoiceId
          ? {
              ...invoice,
              ...invoiceForm,
              amount: total,
              total,
            }
          : invoice
      ),
    }));
  };

  const updateInvoiceStatus = (status) => {
    if (!selectedInvoiceId) return;
    if (selectedInvoice?.status === "Paid") return;
    const timestamp = new Date().toISOString();
    updateAppState((current) => ({
      ...current,
      invoices: current.invoices.map((invoice) =>
        invoice.id === selectedInvoiceId
          ? {
              ...invoice,
              ...invoiceForm,
              status,
              submittedAt:
                status === "Invoice Submitted" && !invoice.submittedAt ? timestamp : invoice.submittedAt,
              amount: calculateInvoiceTotal(invoiceForm.lineItems),
              total: calculateInvoiceTotal(invoiceForm.lineItems),
            }
          : invoice
      ),
    }));
  };

  const openWorkOrders = appState.workOrders.filter((entry) =>
    ["Needs Review", "Needs Attention", "Needs Vendor", "Proposal Needed", "Scheduled", "Open Opportunity"].includes(entry.status)
  );
  const proposalOpportunities = appState.workOrders.filter(
    (entry) => entry.proposalRequired && entry.proposalState === "opportunity"
  );
  const proposalsAwaitingDecision = appState.proposals.filter(
    (proposal) => proposal.isActivePath && proposal.status === "submitted"
  );
  const invoicesAwaitingReview = appState.invoices.filter((invoice) => invoice.status === "Under Review");
  const paidInvoices = appState.invoices.filter((invoice) => invoice.status === "Paid");

  const visibleCrewJobs =
    currentUser && currentCrewRecord
      ? appState.jobs.filter((job) => job.vendorId === currentCrewRecord.id)
      : [];
  const crewInvoices =
    currentCrewRecord && currentUser?.role === ROLES.CREW
      ? appState.jobs
          .filter((job) => job.vendorId === currentCrewRecord.id && job.status === "Completed")
          .map((job) => ({ job, invoice: getInvoiceForJob(appState.invoices, job.id) }))
      : [];
  const crewOpenInvoices = crewInvoices.filter(({ invoice }) => invoice && invoice.status !== "Paid");
  const crewPaidInvoices = crewInvoices.filter(({ invoice }) => invoice?.status === "Paid");

  const vendorSites =
    currentUser && currentCrewRecord
      ? appState.sites.filter(
          (site) =>
            site.assignedVendorId === currentCrewRecord.id ||
            visibleCrewJobs.some((job) => job.siteId === site.id)
        )
      : [];
  const availableCrewWork =
    currentUser && currentUser.role === ROLES.CREW && currentCrewRecord
      ? appState.workOrders.filter((workOrder) => {
          const site = appState.sites.find((entry) => entry.id === workOrder.siteId);
          return canCrewSubmitProposal({
            workOrder,
            site,
            vendor: currentCrewRecord,
            proposals: appState.proposals,
            jobs: appState.jobs,
          });
        })
      : [];
  const activeCrewJobs = visibleCrewJobs.filter((job) => job.status !== "Completed");
  const completedCrewJobs = sortByNewest(
    visibleCrewJobs.filter((job) => job.status === "Completed"),
    "completedTime"
  );
  const filteredCrewSites = vendorSites.filter((site) =>
    searchMatches(
      [site.name, site.address, site.streetAddress, site.city, site.state, site.zip, site.assignedVendorName],
      crewSiteSearch
    )
  );
  const selectedCrewSite =
    filteredCrewSites.find((site) => site.id === selectedCrewSiteId) || filteredCrewSites[0] || null;
  const selectedCrewSiteServiceLog = selectedCrewSite
    ? sortByNewest(
        completedCrewJobs
          .filter(
            (job) =>
              job.siteId === selectedCrewSite.id &&
              job.vendorId === currentCrewRecord?.id
          )
          .map((job) => ({
            ...job,
            invoice: getInvoiceForJob(appState.invoices, job.id) || null,
            workOrder: appState.workOrders.find((workOrder) => workOrder.id === job.workOrderId) || null,
          })),
        "completedTime"
      )
    : [];
  const filteredCompletedCrewJobs = completedCrewJobs.filter((job) =>
    searchMatches(
      [
        job.siteName,
        job.servicePerformed,
        job.scope,
        job.notes,
        job.description,
        appState.workOrders.find((workOrder) => workOrder.id === job.workOrderId)?.amsWorkOrderNumber,
        getInvoiceForJob(appState.invoices, job.id)?.status,
      ],
      crewCompletedJobSearch
    )
  );

  const filteredWorkOrders = appState.workOrders.filter(
    (workOrder) =>
      getWorkOrderFilterMatch(workOrder, workOrderFilter) &&
      searchMatches(
        [
          workOrder.amsWorkOrderNumber,
          workOrder.externalWorkOrderNumber,
          workOrder.id,
          workOrder.siteName,
          workOrder.description,
          workOrder.assignedVendorName,
          workOrder.serviceType,
        ],
        workOrderSearch
      )
  );
  const filteredJobs = appState.jobs.filter(
    (job) =>
      getJobFilterMatch(job, jobFilter) &&
      searchMatches(
        [job.id, job.siteName, job.description, job.vendorName, job.serviceType, job.workOrderId],
        jobSearch
      )
  );
  const filteredSites = appState.sites.filter((site) =>
      searchMatches([site.name, site.address, site.streetAddress, site.city, site.state, site.zip, site.assignedVendorName, site.internalNotes], siteSearch)
    );
  const filteredCrews = normalizedVendors.filter((vendor) =>
      searchMatches(
        [vendor.name, vendor.companyName, vendor.contactName, vendor.phone, vendor.email, vendor.address, vendor.serviceType, vendor.serviceTypes.join(", "), vendor.states.join(", ")],
        crewSearch
      )
    );
  const filteredProposals = sortByNewest(
    appState.proposals.filter((proposal) => {
      const workOrder = appState.workOrders.find((entry) => entry.id === proposal.workOrderId);
      return searchMatches(
        [
          proposal.vendorCompanyName,
          proposal.status,
          proposal.submittedPrice,
          proposal.submittedNotes,
          workOrder?.siteName,
          workOrder?.amsWorkOrderNumber,
        ],
        proposalSearch
      );
    }),
    "submittedAt"
  );
  const filteredInvoices = sortByNewest(
    appState.invoices.filter((invoice) =>
      searchMatches(
        [
          invoice.invoiceNumber,
          invoice.siteName,
          invoice.vendorName,
          invoice.amount,
          invoice.status,
          invoice.notes,
        ],
        invoiceSearch
      )
    ),
    "submittedAt"
  );
  const readyForInvoiceJobs = appState.jobs.filter(
    (job) => job.status === "Completed" && !getInvoiceForJob(appState.invoices, job.id)
  );
  const jobsMissingSell = appState.jobs.filter((job) => getPricingStatus(job) === "not_set");
  const selectedSiteServiceLog = selectedSite
    ? sortByNewest(
        appState.jobs
          .filter((job) => job.siteId === selectedSite.id && job.status === "Completed")
          .map((job) => ({
            ...job,
            workOrder: appState.workOrders.find((workOrder) => workOrder.id === job.workOrderId) || null,
            invoice: getInvoiceForJob(appState.invoices, job.id) || null,
          })),
        "completedAt"
      )
    : [];

  const selectedWorkOrder =
    appState.workOrders.find((workOrder) => workOrder.id === selectedWorkOrderId) || filteredWorkOrders[0] || null;
  const selectedWorkOrderJob = selectedWorkOrder
    ? appState.jobs.find((job) => job.workOrderId === selectedWorkOrder.id) || null
    : null;
  const selectedJob = appState.jobs.find((job) => job.id === selectedJobId) || filteredJobs[0] || null;
  const selectedCrew = normalizedVendors.find((vendor) => vendor.id === selectedCrewId) || filteredCrews[0] || null;
  const selectedProposal = appState.proposals.find((proposal) => proposal.id === selectedProposalId) || filteredProposals[0] || null;
  const selectedInvoice = appState.invoices.find((invoice) => invoice.id === selectedInvoiceId) || filteredInvoices[0] || null;
  const selectedInvoiceJob = selectedInvoice ? appState.jobs.find((job) => job.id === selectedInvoice.jobId) || null : null;
  const amsTeamMembers = sortByNewest(
    appState.users.filter((user) => AMS_ROLES.includes(user.role)),
    "name"
  );
  const ownerVisibleUsers = sortByNewest(
    appState.users.filter((user) => user.role !== ROLES.OWNER),
    "name"
  );
  const platformCompanies = [
    {
      id: "company-scs",
      name: "SparkCommand Systems",
      type: "Platform",
      users: appState.users.filter((user) => user.role === ROLES.OWNER).length,
      sites: 0,
    },
    {
      id: "company-ams",
      name: "Advanced Maintenance Services",
      type: "Customer",
      users: appState.users.filter((user) => AMS_ROLES.includes(user.role)).length,
      sites: appState.sites.length,
    },
  ];
  const weatherSummaryConfig = [
    { key: "active", label: "Active Event" },
    { key: "watch_24", label: "24 Hour Watch" },
    { key: "watch_48", label: "48 Hour Watch" },
    { key: "watch_72", label: "72 Hour Watch" },
    { key: "inactive", label: "Inactive / No Threat" },
  ];
  const selectedWorkOrderProposals = selectedWorkOrder
    ? sortByNewest(appState.proposals.filter((proposal) => proposal.workOrderId === selectedWorkOrder.id), "submittedAt")
    : [];

  useEffect(() => {
    if (!filteredWorkOrders.some((workOrder) => workOrder.id === selectedWorkOrderId)) {
      setSelectedWorkOrderId(filteredWorkOrders[0]?.id || null);
    }
  }, [filteredWorkOrders, selectedWorkOrderId]);

  useEffect(() => {
    if (!filteredJobs.some((job) => job.id === selectedJobId)) {
      setSelectedJobId(filteredJobs[0]?.id || null);
    }
  }, [filteredJobs, selectedJobId]);

  useEffect(() => {
    if (!filteredSites.some((site) => site.id === appState.ui.selectedSiteId) && filteredSites[0]?.id) {
      setSelectedSite(filteredSites[0].id);
    }
  }, [filteredSites]);

  useEffect(() => {
    if (!filteredCrewSites.some((site) => site.id === selectedCrewSiteId)) {
      setSelectedCrewSiteId(filteredCrewSites[0]?.id || null);
    }
  }, [filteredCrewSites, selectedCrewSiteId]);

  useEffect(() => {
    if (!filteredCrews.some((vendor) => vendor.id === selectedCrewId)) {
      setSelectedCrewId(filteredCrews[0]?.id || null);
    }
  }, [filteredCrews, selectedCrewId]);

  useEffect(() => {
    if (!filteredProposals.some((proposal) => proposal.id === selectedProposalId)) {
      setSelectedProposalId(filteredProposals[0]?.id || null);
    }
  }, [filteredProposals, selectedProposalId]);

  useEffect(() => {
    if (!filteredInvoices.some((invoice) => invoice.id === selectedInvoiceId)) {
      setSelectedInvoiceId(filteredInvoices[0]?.id || null);
    }
  }, [filteredInvoices, selectedInvoiceId]);

  useEffect(() => {
    if (!selectedProposal) {
      setReviewForm({ reviewedPrice: "", amsNotes: "", sellPrice: "" });
      return;
    }
    setReviewForm({
      reviewedPrice: selectedProposal.reviewedPrice || selectedProposal.submittedPrice || "",
      amsNotes: selectedProposal.amsNotes || "",
      sellPrice: "",
    });
    if (selectedProposal.workOrderId !== selectedWorkOrderId) {
      setSelectedWorkOrderId(selectedProposal.workOrderId);
    }
  }, [selectedProposal]);

  useEffect(() => {
    if (!selectedWorkOrder) {
      setWorkOrderDetailForm({
        externalWorkOrderNumber: "",
        requireBeforeAfterPhotos: false,
        recurringVendorCost: "",
        recurringPricingNotes: "",
      });
      return;
    }
    setWorkOrderDetailForm({
      externalWorkOrderNumber: selectedWorkOrder.externalWorkOrderNumber || "",
      requireBeforeAfterPhotos: Boolean(selectedWorkOrder.requireBeforeAfterPhotos),
      recurringVendorCost: selectedWorkOrder.recurringVendorCost ?? "",
      recurringPricingNotes: selectedWorkOrder.recurringPricingNotes || "",
    });
  }, [selectedWorkOrder]);

  useEffect(() => {
    if (!selectedWorkOrderJob) return;
    setJobSellForm(getJobSellValue(selectedWorkOrderJob));
  }, [selectedWorkOrderJob]);

  useEffect(() => {
    if (!selectedInvoice) {
      setInvoiceForm({
        invoiceNumber: "",
        amount: "",
        total: "",
        invoiceDate: "",
        dueDate: "",
        terms: "Net 30",
        notes: "",
        status: "Invoice Submitted",
        lineItems: [{ id: "line-1", service: "", description: "", qty: "1", rate: "", amount: "" }],
      });
      return;
    }
    setInvoiceForm({
      invoiceNumber: selectedInvoice.invoiceNumber || "",
      amount: selectedInvoice.amount || "",
      total: selectedInvoice.total || selectedInvoice.amount || "",
      invoiceDate: selectedInvoice.invoiceDate || "",
      dueDate: selectedInvoice.dueDate || "",
      terms: selectedInvoice.terms || "Net 30",
      notes: selectedInvoice.notes || "",
      status: selectedInvoice.status || "Invoice Submitted",
      lineItems: selectedInvoice.lineItems?.length
        ? selectedInvoice.lineItems
        : [{ id: "line-1", service: "", description: "", qty: "1", rate: "", amount: "" }],
      });
    }, [selectedInvoice]);

  useEffect(() => {
    setJobSellForm(getJobSellValue(selectedJob));
  }, [selectedJob]);

  useEffect(() => {
    setAccountingSellForm(getJobSellValue(selectedInvoiceJob));
  }, [selectedInvoiceJob]);

  useEffect(() => {
    if (activeScreen !== "weather") return;
    setWeatherCommandState(buildWeatherThreatSnapshot(appState.sites || []));
    setWeatherLoaded(true);
  }, [activeScreen, appState.sites]);

  useEffect(() => {
    if (!currentUser) return;
    setProfileForm({
      name: currentUser.name || "",
      email: currentUser.email || "",
      password: currentUser.password || "",
      phone: currentUser.phone || "",
      jobTitle: currentUser.jobTitle || "",
      companyName: currentUser.companyName || "",
      streetAddress: currentUser.streetAddress || "",
      city: currentUser.city || "",
      state: currentUser.state || "",
      zip: currentUser.zip || "",
      internalNotes: currentUser.internalNotes || "",
      profilePhotoStatus: currentUser.profilePhotoStatus || "Photo Upload Coming Soon",
    });
  }, [currentUser]);

  useEffect(() => {
    setCompanyProfileForm({
      companyName: currentCompanyProfile?.companyName || "",
      contactName: currentCompanyProfile?.contactName || "",
      phone: currentCompanyProfile?.phone || "",
      email: currentCompanyProfile?.email || "",
      address: currentCompanyProfile?.address || "",
      city: currentCompanyProfile?.city || "",
      state: currentCompanyProfile?.state || "",
      zip: currentCompanyProfile?.zip || "",
      billingDetails: currentCompanyProfile?.billingDetails || "",
    });
  }, [currentCompanyProfile]);

  const topActions = [
    { key: "createWorkOrder", label: "Create Work Order", onClick: () => openModal("workOrder"), featured: true },
    { key: "workOrders", label: "Work Orders", onClick: () => openScreen("workOrders") },
    { key: "jobs", label: "Jobs", onClick: () => openScreen("jobs") },
    { key: "sites", label: "Sites", onClick: () => openScreen("sites") },
    { key: "vendors", label: SCREEN_LABELS.vendors, onClick: () => openScreen("vendors") },
    { key: "proposals", label: "Proposals", onClick: () => openScreen("proposals") },
  ];
  const weatherSummary = weatherSummaryConfig.map((item) => ({
    ...item,
    value: weatherCommandState.filter((site) => site.status === item.key).length,
  }));

  const renderProposalDecision = (proposal, workOrder) => {
    if (!proposal) {
      return <EmptyState title="No proposal selected" text="Select a proposal to review." />;
    }

    return (
      <div className="proposal-decision-card">
        <div className="proposal-decision-header">
          <div>
            <strong>{proposal.vendorCompanyName}</strong>
            <p>Submitted {formatDate(proposal.submittedAt)} � Revision {proposal.revisionCount}</p>
          </div>
          <ProposalStatusBadge value={proposal.status} />
        </div>
        <div className="proposal-summary-grid">
          <div><span className="detail-label">AMS Work Order</span><p>{workOrder?.amsWorkOrderNumber || "Not available"}</p></div>
          <div><span className="detail-label">Site</span><p>{workOrder?.siteName || "Unknown site"}</p></div>
          <div><span className="detail-label">Submitted Price</span><p>{formatMoney(proposal.submittedPrice)}</p></div>
          <div><span className="detail-label">Submitted Notes</span><p>{proposal.submittedNotes || "No submitted notes."}</p></div>
        </div>
        <InputRow>
          <Field label="Reviewed Price"><input value={reviewForm.reviewedPrice} onChange={(event) => setReviewForm((current) => ({ ...current, reviewedPrice: event.target.value }))} /></Field>
          {(AMS_ROLES.includes(currentUser?.role) || currentUser?.role === ROLES.OWNER) ? <Field label="AMS Sell Price (Optional)"><input value={reviewForm.sellPrice} onChange={(event) => setReviewForm((current) => ({ ...current, sellPrice: event.target.value }))} placeholder="Enter internal sell if known" /></Field> : null}
          <Field label="AMS Notes"><textarea rows="4" value={reviewForm.amsNotes} onChange={(event) => setReviewForm((current) => ({ ...current, amsNotes: event.target.value }))} /></Field>
        </InputRow>
        <div className="decision-actions">
          <button className="secondary-button" onClick={handleEditProposal}>Edit Proposal</button>
          <button className="secondary-button" onClick={handleRequestRevision}>Request Revision</button>
          <button className="secondary-button danger-button" onClick={handleRejectProposal}>Reject</button>
          <button className="primary-button" onClick={handleApproveProposal}>Approve</button>
        </div>
      </div>
    );
  };

  const ownerDashboard = (
    <div className="screen-grid">
      <PageSection title="Owner Overview">
        <StatGrid items={[
          { label: "Companies", value: platformCompanies.length, onClick: () => openScreen("companies") },
          { label: "Managed Users", value: ownerVisibleUsers.length, onClick: () => openScreen("users") },
          { label: "Operational Sites", value: appState.sites.length, onClick: () => openScreen("companies") },
          { label: "Platform Alerts", value: appState.invoices.filter((invoice) => invoice.status === "Rejected").length, onClick: () => openScreen("platformStatus") },
        ]} />
      </PageSection>
      <PageSection title="Platform Snapshot">
        <div className="proposal-summary-grid">
          <div><span className="detail-label">Brand Layer</span><p>SparkCommand Systems</p></div>
          <div><span className="detail-label">Customer Layer</span><p>Advanced Maintenance Services</p></div>
          <div><span className="detail-label">Seeded Records</span><p>{appState.workOrders.length} work orders / {appState.jobs.length} jobs / {appState.invoices.length} invoices</p></div>
          <div><span className="detail-label">Owner Visibility</span><p>Hidden from AMS and Crew menus</p></div>
        </div>
      </PageSection>
    </div>
  );

  const amsDashboard = (
    <div className="screen-grid">
      <TopActionBar actions={topActions} />
      <div className="ams-dashboard-grid">
        <PageSection title="Operations Snapshot">
          <StatGrid items={[
            { label: "Open Work Orders", value: openWorkOrders.length, onClick: () => openScreen("workOrders") },
            { label: "Proposal Opportunities", value: proposalOpportunities.length, onClick: () => openScreen("proposals") },
            { label: "Active Jobs", value: appState.jobs.filter((entry) => entry.status !== "Completed").length, onClick: () => openScreen("jobs") },
            { label: "Proposals Awaiting Review", value: proposalsAwaitingDecision.length, onClick: () => openScreen("proposals") },
            { label: "Invoices Awaiting Review", value: invoicesAwaitingReview.length, onClick: () => openScreen("accounting") },
            { label: "Paid Invoices", value: paidInvoices.length, onClick: () => openScreen("accounting") },
          ]} />
        </PageSection>
        <PageSection title="Command Map">
          <CommandMap sites={appState.sites} selectedSiteId={selectedSite?.id} onSelectSite={setSelectedSite} />
          <SiteDetailsCard site={selectedSite} relatedWorkOrderCount={selectedSite ? appState.workOrders.filter((workOrder) => workOrder.siteId === selectedSite.id).length : 0} />
        </PageSection>
      </div>
    </div>
  );

  const crewAvailableWorkSection = (
    <PageSection title="Available Work">
      {availableCrewWork.length ? (
        <div className="available-work-grid">
          {availableCrewWork.map((workOrder) => {
            const site = appState.sites.find((entry) => entry.id === workOrder.siteId);
            const draft = vendorProposalDrafts[workOrder.id] || { submittedPrice: "", submittedNotes: "" };
            const latestProposal = currentCrewRecord ? getLatestCrewProposal(appState.proposals, workOrder.id, currentCrewRecord.id) : null;
            return (
              <AvailableWorkCard key={workOrder.id} workOrder={workOrder} site={site}>
                <div className="proposal-card-meta">
                  <div className="proposal-card-badges"><ProposalStateBadge value={workOrder.proposalState} />{latestProposal ? <ProposalStatusBadge value={latestProposal.status} /> : null}</div>
                  <div className="proposal-card-form">
                    <label className="field compact-field"><span>Proposal Price</span><input value={draft.submittedPrice} onChange={(event) => updateVendorProposalDraft(workOrder.id, "submittedPrice", event.target.value)} placeholder="Enter price" /></label>
                    <label className="field compact-field"><span>Proposal Notes</span><textarea rows="3" value={draft.submittedNotes} onChange={(event) => updateVendorProposalDraft(workOrder.id, "submittedNotes", event.target.value)} placeholder="Add scope notes or crew comments" /></label>
                  </div>
                  <div className="proposal-card-actions"><button className="primary-button" onClick={() => handleCrewProposalSubmit(workOrder)}>{latestProposal ? "Resubmit Proposal" : "Submit Proposal"}</button></div>
                </div>
              </AvailableWorkCard>
            );
          })}
        </div>
      ) : <EmptyState title="No available work" text="New matching proposal opportunities will appear here." />}
    </PageSection>
  );

  const crewJobsSection = (
      <PageSection title="My Jobs">
        <div className="detail-stack">
          <PageSection title="Active Jobs">
            {activeCrewJobs.length ? <div className="job-card-grid">{activeCrewJobs.map((job) => <JobCard key={job.id} job={job} onStart={(jobId) => openJobConfirmation("start", jobId)} onComplete={(jobId) => openJobConfirmation("complete", jobId)} onHelp={(jobId) => updateJobStatus(jobId, "Need Help")} />)}</div> : <EmptyState title="No active jobs" text="Assigned active jobs will appear here." />}
          </PageSection>
          <PageSection title="Completed Jobs">
            <div className="list-stack">
              <SearchBar value={crewCompletedJobSearch} onChange={setCrewCompletedJobSearch} placeholder="Search completed jobs" />
              <div className="list-scroll compact-scroll contained-scroll">
                <DataTable
                  columns={[
                    { key: "site", label: "Site Name", render: (row) => row.siteName },
                    { key: "serviceDate", label: "Service Date", render: (row) => formatDate(row.serviceDate || row.completedTime) },
                    { key: "start", label: "Start Time", render: (row) => formatDate(row.startTime) },
                    { key: "end", label: "Completion Time", render: (row) => formatDate(row.completedTime) },
                    { key: "service", label: "Service Performed", render: (row) => row.servicePerformed || row.serviceType }, { key: "workType", label: "Work Type", render: (row) => getWorkTypeLabel(row.workType) },
                    { key: "scope", label: "Scope", render: (row) => row.scope || row.description || "No scope notes" },
                    { key: "notes", label: "Notes", render: (row) => row.notes || "No notes" },
                    { key: "wo", label: "AMS Work Order", render: (row) => appState.workOrders.find((workOrder) => workOrder.id === row.workOrderId)?.amsWorkOrderNumber || "Not available" },
                    { key: "invoice", label: "Invoice Status", render: (row) => getInvoiceForJob(appState.invoices, row.id)?.status || "No invoice" },
                  ]}
                  rows={filteredCompletedCrewJobs}
                  stickyHeader
                  emptyTitle="No completed jobs"
                  emptyText="Completed crew work will appear here."
                />
              </div>
            </div>
          </PageSection>
        </div>
      </PageSection>
    );

  const crewSitesSection = (
      <PageSection title="My Sites">
        <SplitView
          list={<div className="list-stack"><SearchBar value={crewSiteSearch} onChange={setCrewSiteSearch} placeholder="Search my sites" /><div className="list-scroll"><DataTable columns={[{ key: "name", label: "Site", render: (row) => row.name }, { key: "address", label: "Address", render: (row) => row.address }, { key: "visibility", label: "Visibility", render: (row) => row.assignedVendorId === currentCrewRecord?.id ? "Assigned site" : "Visible through job history" }]} rows={filteredCrewSites} selectedRowId={selectedCrewSite?.id} onRowClick={(row) => setSelectedCrewSiteId(row.id)} emptyTitle="No sites available" emptyText="Assigned site information will appear here." /></div></div>}
          detail={selectedCrewSite ? <div className="detail-stack"><div className="detail-card"><div className="proposal-summary-top"><div><strong>{selectedCrewSite.name}</strong><p>{selectedCrewSite.address}</p></div><span className="site-state-tag">{selectedCrewSite.state}</span></div><div className="proposal-summary-grid"><div><span className="detail-label">Street Address</span><p>{selectedCrewSite.streetAddress || "Not set"}</p></div><div><span className="detail-label">City</span><p>{selectedCrewSite.city || "Not set"}</p></div><div><span className="detail-label">State</span><p>{selectedCrewSite.state || "Not set"}</p></div><div><span className="detail-label">ZIP Code</span><p>{selectedCrewSite.zip || "Not set"}</p></div></div></div><PageSection title="Site Service Report"><div className="list-scroll compact-scroll contained-scroll"><DataTable columns={[{ key: "date", label: "Date of Service", render: (row) => formatDate(row.serviceDate || row.completedTime) }, { key: "service", label: "Service Performed", render: (row) => row.servicePerformed || row.serviceType }, { key: "workType", label: "Work Type", render: (row) => getWorkTypeLabel(row.workType) }, { key: "start", label: "Start Time", render: (row) => formatDate(row.startTime) }, { key: "end", label: "Completion Time", render: (row) => formatDate(row.completedTime) }, { key: "scope", label: "Scope", render: (row) => row.scope || row.description || "No scope notes" }, { key: "notes", label: "Notes", render: (row) => row.notes || "No notes" }, { key: "wo", label: "AMS Work Order Number", render: (row) => row.workOrder?.amsWorkOrderNumber || "Not available" }, { key: "invoice", label: "Invoice Status", render: (row) => row.invoice?.status || "No invoice" }]} rows={selectedCrewSiteServiceLog} stickyHeader emptyTitle="No services recorded yet" emptyText="No services recorded yet" /></div></PageSection></div> : <EmptyState title="No site selected" text="Select a site to view details." />}
        />
      </PageSection>
    );

  const crewProposalStatusSection = (
    <PageSection title="My Proposals">
      {currentCrewRecord ? <div className="proposal-history-grid">{sortByNewest(appState.proposals.filter((proposal) => proposal.vendorId === currentCrewRecord.id), "submittedAt").map((proposal) => {
        const workOrder = appState.workOrders.find((entry) => entry.id === proposal.workOrderId);
        const site = workOrder ? appState.sites.find((entry) => entry.id === workOrder.siteId) : null;
        const canResubmit = currentCrewRecord && workOrder && canCrewSubmitProposal({ workOrder, site, vendor: currentCrewRecord, proposals: appState.proposals, jobs: appState.jobs }) && ["rejected", "revision_requested"].includes(proposal.status);
        return <article key={proposal.id} className="proposal-history-card"><div className="proposal-history-top"><div><strong>{workOrder?.siteName || "Work Order"}</strong><p>{workOrder?.description || "Reference unavailable"}</p></div><ProposalStatusBadge value={proposal.status} /></div><div className="proposal-history-grid-inner"><div><span className="detail-label">Submitted Price</span><p>{formatMoney(proposal.submittedPrice)}</p></div><div><span className="detail-label">Reviewed Price</span><p>{formatMoney(proposal.reviewedPrice)}</p></div><div><span className="detail-label">Submitted At</span><p>{formatDate(proposal.submittedAt)}</p></div><div><span className="detail-label">Revision Count</span><p>{proposal.revisionCount}</p></div></div><div className="proposal-history-notes"><div><span className="detail-label">AMS Notes</span><p>{proposal.amsNotes || "No AMS notes yet."}</p></div></div>{canResubmit ? <div className="proposal-history-actions"><button className="secondary-button" onClick={() => prepareResubmissionDraft(proposal)}>Load Resubmission Draft</button></div> : null}</article>;
      })}</div> : <EmptyState title="No proposals yet" text="Your submitted proposal history will appear here." />}
    </PageSection>
  );

  const crewInvoicesSection = (
    <PageSection title="My Invoices">
      {crewInvoices.length ? (
        <DataTable
          columns={[
            { key: "site", label: "Site", render: (row) => row.job.siteName },
            { key: "service", label: "Service Type", render: (row) => row.job.serviceType },
            {
              key: "invoice",
              label: "Invoice Number",
              render: (row) => row.invoice?.invoiceNumber || "Awaiting submission",
            },
            {
              key: "amount",
              label: "Amount",
              render: (row) => formatMoney(row.invoice?.amount || row.job.price),
            },
            {
              key: "status",
              label: "Status",
              render: (row) => <InvoiceStatusBadge value={row.invoice?.status || "Awaiting Submission"} />,
            },
            { key: "notes", label: "Notes", render: (row) => row.invoice?.notes || "No notes yet." },
            {
              key: "action",
              label: "Action",
              render: (row) =>
                !row.invoice ? (
                  <button
                    className="secondary-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      createInvoiceForJob(row.job);
                    }}
                  >
                    Submit Invoice
                  </button>
                ) : (
                  <button className="secondary-button" disabled>
                    View Only
                  </button>
                ),
            },
          ]}
          rows={crewInvoices.map(({ job, invoice }) => ({ id: job.id, job, invoice }))}
          emptyTitle="No invoices"
          emptyText="Completed job invoice tracking will appear here."
        />
      ) : (
        <EmptyState title="No invoices yet" text="Completed job invoice tracking will appear here." />
      )}
    </PageSection>
  );

  const crewDashboard = (
    <div className="screen-grid vendor-screen">
      <PageSection title="Crew Snapshot">
        <StatGrid items={[
          { label: "Available Work", value: availableCrewWork.length, onClick: () => openScreen("availableWork") },
          { label: "My Jobs", value: visibleCrewJobs.length, onClick: () => openScreen("myJobs") },
          { label: "My Open Invoices", value: crewOpenInvoices.length, onClick: () => openScreen("myInvoices") },
          { label: "Paid Invoices", value: crewPaidInvoices.length, onClick: () => openScreen("myInvoices") },
        ]} />
      </PageSection>
      {crewAvailableWorkSection}
      {crewJobsSection}
    </div>
  );

  const companiesScreen = (
    <div className="screen-grid">
      <PageSection title="Companies">
        <DataTable
          columns={[
            { key: "name", label: "Company", render: (row) => row.name },
            { key: "type", label: "Type", render: (row) => row.type },
            { key: "users", label: "Users", render: (row) => row.users },
            { key: "sites", label: "Sites", render: (row) => row.sites },
          ]}
          rows={platformCompanies}
          emptyTitle="No companies"
          emptyText="Company records will appear here."
        />
      </PageSection>
      <PageSection title="Vendor Footprint">
        <DataTable
          columns={[
            { key: "vendor", label: "Vendor", render: (row) => row.companyName },
            { key: "contact", label: "Contact", render: (row) => row.contactName },
            { key: "phone", label: "Phone", render: (row) => <a href={`tel:${row.phone}`}>{row.phone}</a> },
            { key: "sites", label: "Assigned Sites", render: (row) => appState.sites.filter((site) => site.assignedVendorId === row.id).length },
          ]}
          rows={normalizedVendors}
          emptyTitle="No vendors"
          emptyText="Vendor records will appear here."
        />
      </PageSection>
    </div>
  );

  const platformStatusScreen = (
    <div className="screen-grid">
      <PageSection title="Platform Status">
        <StatGrid items={[
          { label: "Firebase Auth Mapping", value: Object.keys(FIREBASE_ROLE_BRIDGE).length },
          { label: "Active Users", value: appState.users.filter((user) => user.active).length },
          { label: "Pending Vendor Auth", value: normalizedVendors.filter((vendor) => vendor.authStatus === "Pending").length },
          { label: "Invoices Rejected", value: appState.invoices.filter((invoice) => invoice.status === "Rejected").length },
        ]} />
      </PageSection>
    </div>
  );

  const internalNotesScreen = (
    <div className="screen-grid">
      <PageSection title="Internal Notes">
        <div className="detail-stack">
          <div className="detail-card"><span className="detail-label">Owner Note</span><p>Owner portal remains hidden and only opens for the mapped platform account.</p></div>
          <div className="detail-card"><span className="detail-label">Operational Note</span><p>Cold starts return to splash and login, while in-session navigation is preserved until the app is fully closed.</p></div>
          <div className="detail-card"><span className="detail-label">Data Note</span><p>Seeded operational coverage includes 17 sites, 7 vendors, and 51 work orders.</p></div>
        </div>
      </PageSection>
    </div>
  );

  const systemControlsScreen = (
    <div className="screen-grid">
      <PageSection title="System Controls">
        <div className="form-actions">
          <button className="secondary-button" onClick={() => window.alert("Firebase Auth is active. Firestore sync remains intentionally disabled in this build.")}>Auth Status</button>
          <button className="secondary-button" onClick={() => window.alert("Operational seed data persists locally. Session state clears on full close.")}>Session Policy</button>
          <button className="secondary-button" onClick={() => window.alert("Audit log is reserved as a placeholder for the next controlled release.")}>Audit Queue</button>
        </div>
      </PageSection>
    </div>
  );

  const reportsScreen = (
    <div className="screen-grid">
      <PageSection title="Reports">
        <StatGrid items={[
          { label: "Completed Jobs", value: appState.jobs.filter((job) => job.status === "Completed").length },
          { label: "Ready for Invoice", value: readyForInvoiceJobs.length },
          { label: "Needs Attention", value: appState.workOrders.filter((workOrder) => workOrder.status === "Needs Attention").length },
          { label: "Open Opportunities", value: appState.workOrders.filter((workOrder) => workOrder.status === "Open Opportunity").length },
        ]} />
      </PageSection>
    </div>
  );

  const completedJobsScreen = (
    <div className="screen-grid vendor-screen">
      <PageSection title="Completed Jobs">
        <div className="list-scroll compact-scroll contained-scroll">
          <DataTable
            columns={[
              { key: "site", label: "Site", render: (row) => row.siteName },
              { key: "service", label: "Service", render: (row) => row.servicePerformed || row.serviceType },
              { key: "start", label: "Start Time", render: (row) => formatDate(row.startTime) },
              { key: "end", label: "Completion Time", render: (row) => formatDate(row.completedTime) },
              { key: "invoice", label: "Invoice", render: (row) => getInvoiceForJob(appState.invoices, row.id)?.status || "Not Invoiced" },
            ]}
            rows={completedCrewJobs}
            emptyTitle="No completed jobs"
            emptyText="Completed crew jobs will appear here."
          />
        </div>
      </PageSection>
    </div>
  );

  const usersScreen = (
    <div className="screen-grid">
      <PageSection title="User Management">
        <InputRow>
          <Field label="Full Name"><input value={userForm.name} onChange={(event) => setUserForm((current) => ({ ...current, name: event.target.value }))} /></Field>
          <Field label="Email"><input value={userForm.email} onChange={(event) => setUserForm((current) => ({ ...current, email: event.target.value }))} /></Field>
          <Field label="Password"><input type="password" value={userForm.password} onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))} /></Field>
          <Field label="Phone Number"><input value={userForm.phone} onChange={(event) => setUserForm((current) => ({ ...current, phone: event.target.value }))} /></Field>
          <Field label="Job Title"><input value={userForm.jobTitle} onChange={(event) => setUserForm((current) => ({ ...current, jobTitle: event.target.value }))} /></Field>
          <Field label="Company Name"><input value={userForm.companyName} onChange={(event) => setUserForm((current) => ({ ...current, companyName: event.target.value }))} /></Field>
          <Field label="Street Address"><input value={userForm.streetAddress} onChange={(event) => setUserForm((current) => ({ ...current, streetAddress: event.target.value }))} /></Field>
          <Field label="City"><input value={userForm.city} onChange={(event) => setUserForm((current) => ({ ...current, city: event.target.value }))} /></Field>
          <Field label="State"><input value={userForm.state} onChange={(event) => setUserForm((current) => ({ ...current, state: event.target.value.toUpperCase() }))} /></Field>
          <Field label="ZIP"><input value={userForm.zip} onChange={(event) => setUserForm((current) => ({ ...current, zip: event.target.value }))} /></Field>
          <Field label="Access Status"><select value={userForm.accessStatus} onChange={(event) => setUserForm((current) => ({ ...current, accessStatus: event.target.value }))}><option value="Active">Active</option><option value="Inactive">Inactive</option></select></Field>
          <Field label="Auth Status"><select value={userForm.authStatus} onChange={(event) => setUserForm((current) => ({ ...current, authStatus: event.target.value }))}><option value="Active">Active</option><option value="Pending">Pending</option><option value="Disabled">Disabled</option></select></Field>
          <Field label="Internal Notes"><textarea rows="4" value={userForm.internalNotes} onChange={(event) => setUserForm((current) => ({ ...current, internalNotes: event.target.value }))} /></Field>
          <Field label="Role"><select value={userForm.role} onChange={(event) => setUserForm((current) => ({ ...current, role: event.target.value }))}>{Object.values(ROLES).map((role) => <option key={role} value={role}>{role}</option>)}</select></Field>
        </InputRow>
        <div className="form-actions"><button className="primary-button" onClick={saveUser}>{editingUserId ? "Update User" : "Add User"}</button></div>
      </PageSection>
      <PageSection title="Current Users"><DataTable columns={[{ key: "name", label: "Name", render: (row) => row.name }, { key: "email", label: "Email", render: (row) => row.email }, { key: "phone", label: "Phone", render: (row) => row.phone || "Not set" }, { key: "role", label: "Role", render: (row) => row.role }, { key: "access", label: "Access Status", render: (row) => row.accessStatus || (row.active ? "Active" : "Inactive") }, { key: "auth", label: "Auth Status", render: (row) => row.authStatus || "Active" }, { key: "actions", label: "Actions", render: (row) => <div className="table-actions"><button className="secondary-button" onClick={(event) => { event.stopPropagation(); startEditUser(row); }}>Edit</button><button className="secondary-button" onClick={(event) => { event.stopPropagation(); toggleUserActive(row.id); }}>{row.active ? "Deactivate" : "Activate"}</button><button className="secondary-button" onClick={(event) => { event.stopPropagation(); archiveUser(row.id); }}>Archive</button><button className="secondary-button danger-button" onClick={(event) => { event.stopPropagation(); deleteUser(row.id); }}>Delete</button></div> }]} rows={ownerVisibleUsers} emptyTitle="No users" emptyText="Users added here will persist locally." /></PageSection>
    </div>
  );

  const sitesScreen = (
    <div className="screen-grid">
      <PageSection title="Sites" action={<button className="primary-button" onClick={() => openModal("site")}>Create Site</button>}>
        <SplitView
          list={<div className="list-stack"><SearchBar value={siteSearch} onChange={setSiteSearch} placeholder="Search sites" /><div className="list-scroll"><DataTable columns={[{ key: "name", label: "Name", render: (row) => row.name }, { key: "address", label: "Address", render: (row) => row.address }, { key: "assigned", label: "Primary Assigned Vendor", render: (row) => row.assignedVendorName || "Unassigned" }, { key: "state", label: "State", render: (row) => row.state }]} rows={filteredSites} selectedRowId={appState.ui.selectedSiteId} onRowClick={(row) => setSelectedSite(row.id)} emptyTitle="No sites" emptyText="Add a site to start routing work orders." /></div></div>}
          detail={selectedSite ? <div className="detail-stack"><SiteDetailsCard site={selectedSite} relatedWorkOrderCount={appState.workOrders.filter((workOrder) => workOrder.siteId === selectedSite.id).length} /><div className="detail-card"><div className="proposal-summary-grid"><div><span className="detail-label">Street Address</span><p>{selectedSite.streetAddress || "Not set"}</p></div><div><span className="detail-label">City</span><p>{selectedSite.city || "Not set"}</p></div><div><span className="detail-label">State</span><p>{selectedSite.state || "Not set"}</p></div><div><span className="detail-label">ZIP Code</span><p>{selectedSite.zip || "Not set"}</p></div><div><span className="detail-label">Manager</span><p>{selectedSite.manager || "Not set"}</p></div><div><span className="detail-label">Contact</span><p>{selectedSite.contact || "Not set"}</p></div><div><span className="detail-label">Primary Assigned Vendor</span><p>{selectedSite.assignedVendorName || "Unassigned"}</p></div><div><span className="detail-label">Vendor Contact</span><p>{selectedSite.assignedCrewContactName || normalizedVendors.find((vendor) => vendor.id === selectedSite.assignedVendorId)?.contactName || "Not set"}</p></div><div><span className="detail-label">Vendor Phone</span><p>{normalizedVendors.find((vendor) => vendor.id === selectedSite.assignedVendorId)?.phone ? <a href={`tel:${normalizedVendors.find((vendor) => vendor.id === selectedSite.assignedVendorId)?.phone}`}>{normalizedVendors.find((vendor) => vendor.id === selectedSite.assignedVendorId)?.phone}</a> : "Not set"}</p></div><div><span className="detail-label">Vendor Email</span><p>{normalizedVendors.find((vendor) => vendor.id === selectedSite.assignedVendorId)?.email || "Not set"}</p></div></div></div><div className="proposal-summary-grid"><article className="detail-card"><span className="detail-label">Site Map</span><p>{selectedSite.siteMapStatus}</p></article><article className="detail-card"><span className="detail-label">Geo Fence</span><p>{selectedSite.geoFenceStatus}</p></article></div><PageSection title="Site Service Log"><div className="list-scroll compact-scroll contained-scroll"><DataTable columns={[{ key: "date", label: "Date of Service", render: (row) => formatDate(row.completedAt) }, { key: "service", label: "Service Performed", render: (row) => row.serviceType }, { key: "workType", label: "Work Type", render: (row) => getWorkTypeLabel(row.workType) }, { key: "vendor", label: "Vendor", render: (row) => row.vendorName }, { key: "start", label: "Start Time", render: (row) => formatDate(row.startTime) }, { key: "end", label: "Completion Time", render: (row) => formatDate(row.completedAt) }, { key: "scope", label: "Scope", render: (row) => row.scope || row.description || "No scope notes" }, { key: "wo", label: "AMS Work Order", render: (row) => row.workOrder?.amsWorkOrderNumber || "Not available" }, { key: "invoice", label: "Invoice Status", render: (row) => row.invoice?.status || "Not Invoiced" }]} rows={selectedSiteServiceLog} emptyTitle="No site service history" emptyText="Completed services for this site will appear here." /></div></PageSection><div className="form-actions"><button className="secondary-button" onClick={() => startEditSite(selectedSite)}>Edit Site</button><button className="secondary-button danger-button" onClick={() => removeSite(selectedSite.id)}>Remove Site</button></div></div> : <EmptyState title="No site selected" text="Select a site to view details." />}
        />
      </PageSection>
    </div>
  );

  const crewsScreen = (
    <div className="screen-grid">
      <PageSection title="Vendors" action={<button className="primary-button" onClick={() => openModal("vendor")}>Add Vendor</button>}>
        <SplitView
          list={<div className="list-stack"><SearchBar value={crewSearch} onChange={setCrewSearch} placeholder="Search vendors" /><div className="list-scroll"><DataTable columns={[{ key: "company", label: "Vendor Company", render: (row) => row.companyName || row.name }, { key: "contact", label: "Vendor Contact", render: (row) => row.contactName || "Not set" }, { key: "serviceType", label: "Primary Service", render: (row) => row.serviceType }, { key: "states", label: "States", render: (row) => row.states.join(", ") }, { key: "status", label: "Status", render: (row) => (row.active ? "Active" : "Inactive") }]} rows={filteredCrews} selectedRowId={selectedCrew?.id} onRowClick={(row) => setSelectedCrewId(row.id)} emptyTitle="No vendors" emptyText="Add a vendor before assigning jobs." /></div></div>}
          detail={selectedCrew ? <div className="detail-card"><div className="proposal-summary-top"><div><strong>{selectedCrew.companyName || selectedCrew.name}</strong><p>{selectedCrew.serviceType}</p></div><StatusBadge value={selectedCrew.active ? "active" : "inactive"} label={selectedCrew.active ? "Active" : "Inactive"} /></div><div className="proposal-summary-grid"><div><span className="detail-label">Vendor Company</span><p>{selectedCrew.companyName || "Not set"}</p></div><div><span className="detail-label">Vendor Contact</span><p>{selectedCrew.contactName || "Not set"}</p></div><div><span className="detail-label">Phone</span><p>{selectedCrew.phone ? <a href={`tel:${selectedCrew.phone}`}>{selectedCrew.phone}</a> : "Not set"}</p></div><div><span className="detail-label">Email</span><p>{selectedCrew.email || "Not set"}</p></div><div><span className="detail-label">Address</span><p>{selectedCrew.address || "Not set"}</p></div><div><span className="detail-label">Service Types</span><p>{selectedCrew.serviceTypes.join(", ")}</p></div><div><span className="detail-label">Coverage</span><p>{selectedCrew.states.join(", ") || "Not set"}</p></div><div><span className="detail-label">Linked Login</span><p>{selectedCrew.email || "Not linked"}</p></div><div><span className="detail-label">Internal Notes</span><p>{selectedCrew.internalNotes || "No internal notes"}</p></div></div><div className="form-actions"><button className="secondary-button" onClick={() => startEditVendor(selectedCrew)}>Edit Vendor</button><button className="secondary-button" onClick={() => toggleVendorActive(selectedCrew.id)}>{selectedCrew.active ? "Deactivate" : "Activate"}</button></div></div> : <EmptyState title="No vendor selected" text="Select a vendor to view details." />}
        />
      </PageSection>
    </div>
  );

  const jobsScreen = (
    <div className="screen-grid">
      <PageSection title="Jobs" action={<button className="primary-button" onClick={() => openModal("job")}>Create Job</button>}>
        <SplitView
          list={<div className="list-stack"><div className="list-toolbar"><SearchBar value={jobSearch} onChange={setJobSearch} placeholder="Search jobs" /><FilterRow label="Filter" value={jobFilter} options={JOB_FILTERS} onChange={setJobFilter} /></div><div className="list-scroll"><DataTable columns={[{ key: "siteName", label: "Site", render: (row) => row.siteName }, { key: "vendorName", label: "Crew", render: (row) => row.vendorName || "Unassigned" }, { key: "serviceType", label: "Service Type", render: (row) => row.serviceType }, ...(AMS_ROLES.includes(currentUser?.role) || currentUser?.role === ROLES.OWNER ? [{ key: "pricingStatus", label: "Pricing", render: (row) => <StatusBadge value={getPricingStatus(row)} label={getPricingStatus(row) === "set" ? "Sell Set" : "Sell Not Set"} /> }] : []), { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> }]} rows={filteredJobs} selectedRowId={selectedJob?.id} onRowClick={(row) => setSelectedJobId(row.id)} emptyTitle="No jobs" emptyText="Assign crews from work orders or approve a proposal to create jobs." /></div></div>}
          detail={selectedJob ? <div className="detail-card"><div className="proposal-summary-top"><div><strong>{selectedJob.siteName}</strong><p>{selectedJob.description}</p></div><StatusBadge value={selectedJob.status} /></div><div className="proposal-summary-grid"><div><span className="detail-label">Crew</span><p>{selectedJob.vendorName || "Unassigned"}</p></div><div><span className="detail-label">Service Type</span><p>{selectedJob.serviceType}</p></div><div><span className="detail-label">Work Type</span><p>{getWorkTypeLabel(selectedJob.workType)}</p></div><div><span className="detail-label">Cost</span><p>{formatMoney(selectedJob.price)}</p></div>{selectedJob.workType === "recurring" && isAmsViewer ? <div><span className="detail-label">Recurring Vendor Cost</span><p>{formatMoney(selectedJob.recurringVendorCost)}</p></div> : null}{AMS_ROLES.includes(currentUser?.role) || currentUser?.role === ROLES.OWNER ? <><div><span className="detail-label">Sell</span><p>{formatMoney(getJobSellValue(selectedJob))}</p></div><div><span className="detail-label">Pricing Status</span><p><StatusBadge value={getPricingStatus(selectedJob)} label={getPricingStatus(selectedJob) === "set" ? "Sell Set" : "Sell Not Set"} /></p></div><div><span className="detail-label">Sell Set By</span><p>{appState.users.find((user) => user.id === selectedJob.sellSetBy)?.name || "Not set"}</p></div><div><span className="detail-label">Sell Set At</span><p>{selectedJob.sellSetAt ? formatDate(selectedJob.sellSetAt) : "Not set"}</p></div></> : null}<div><span className="detail-label">Invoice</span><p>{getInvoiceForJob(appState.invoices, selectedJob.id)?.invoiceNumber || "Not created"}</p></div></div><Field label="Job Status"><select value={selectedJob.status} onChange={(event) => updateJobStatus(selectedJob.id, event.target.value)}>{JOB_STATUS.map((status) => <option key={status} value={status}>{status}</option>)}</select></Field>{isAmsViewer ? <SellControl sellValue={jobSellForm} pricingStatus={getPricingStatus(selectedJob)} editing={editingJobSellId === selectedJob.id || getPricingStatus(selectedJob) !== "set"} onStartEdit={() => setEditingJobSellId(selectedJob.id)} onChange={setJobSellForm} onSave={saveSelectedJobSell} /> : null}</div> : <EmptyState title="No job selected" text="Select a job to view details." />}
        />
      </PageSection>
    </div>
  );

  const workOrdersScreen = (
    <div className="screen-grid">
      <PageSection title="Work Orders" action={<button className="primary-button" onClick={() => openModal("workOrder")}>Create Work Order</button>}>
          <SplitView
            list={<div className="list-stack"><div className="list-toolbar"><SearchBar value={workOrderSearch} onChange={setWorkOrderSearch} placeholder="Search work orders" /><FilterRow label="Filter" value={workOrderFilter} options={WORK_ORDER_FILTERS} onChange={setWorkOrderFilter} /></div><div className="list-scroll"><DataTable columns={[{ key: "reference", label: "AMS Ref", render: (row) => row.amsWorkOrderNumber }, ...(showExternalWorkOrder ? [{ key: "external", label: "External Ref", render: (row) => row.externalWorkOrderNumber || "Not set" }] : []), { key: "siteName", label: "Site", render: (row) => row.siteName }, { key: "serviceType", label: "Service Type", render: (row) => row.serviceType }, { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> }]} rows={filteredWorkOrders} selectedRowId={selectedWorkOrder?.id} onRowClick={(row) => setSelectedWorkOrderId(row.id)} emptyTitle="No work orders" emptyText="New work orders will appear here." /></div></div>}
            detail={selectedWorkOrder ? <div className="detail-stack"><div className="proposal-review-summary"><div className="proposal-summary-top"><div><strong>{selectedWorkOrder.siteName}</strong><p>{selectedWorkOrder.description}</p></div><div className="proposal-summary-badges"><ProposalStateBadge value={selectedWorkOrder.proposalState} /><StatusBadge value={selectedWorkOrder.status} /></div></div><div className="proposal-summary-grid"><div><span className="detail-label">AMS Work Order</span><p>{selectedWorkOrder.amsWorkOrderNumber}</p></div><div><span className="detail-label">Service Type</span><p>{selectedWorkOrder.serviceType}</p></div><div><span className="detail-label">Work Type</span><p>{getWorkTypeLabel(selectedWorkOrder.workType)}</p></div><div><span className="detail-label">Primary Assigned Vendor</span><p>{selectedWorkOrder.assignedVendorName || "Not assigned"}</p></div>{selectedWorkOrder.workType === "recurring" && isAmsViewer ? <div><span className="detail-label">Recurring Vendor Cost</span><p>{formatMoney(selectedWorkOrder.recurringVendorCost)}</p></div> : null}<div><span className="detail-label">Job Link</span><p>{selectedWorkOrder.jobId || "No job created yet"}</p></div><div><span className="detail-label">Proposal Requested</span><p>{formatDate(selectedWorkOrder.proposalRequestedAt)}</p></div><div><span className="detail-label">Proposal Awarded</span><p>{formatDate(selectedWorkOrder.proposalAwardedAt)}</p></div></div><InputRow>{showExternalWorkOrder ? <Field label="External Work Order Number"><input value={workOrderDetailForm.externalWorkOrderNumber} onChange={(event) => setWorkOrderDetailForm((current) => ({ ...current, externalWorkOrderNumber: event.target.value }))} /></Field> : null}<Field label="Before / After Photos Required"><select value={workOrderDetailForm.requireBeforeAfterPhotos ? "yes" : "no"} onChange={(event) => setWorkOrderDetailForm((current) => ({ ...current, requireBeforeAfterPhotos: event.target.value === "yes" }))}><option value="no">No</option><option value="yes">Yes</option></select></Field>{selectedWorkOrder.workType === "recurring" && isAmsViewer ? <Field label="Vendor Cost"><input value={workOrderDetailForm.recurringVendorCost} onChange={(event) => setWorkOrderDetailForm((current) => ({ ...current, recurringVendorCost: event.target.value }))} placeholder="Enter recurring vendor cost" /></Field> : null}</InputRow><div className="form-actions"><button className="secondary-button" onClick={saveWorkOrderDetail}>Save Detail Updates</button><button className="secondary-button" onClick={() => showPlaceholder("File and image uploads require backend support and will be added in a later build.")}>Attach File / Upload Picture</button>{selectedWorkOrder.proposalRequired ? <button className="primary-button" onClick={() => openScreen("proposals")}>Open Proposal Review</button> : null}</div></div>{isAmsViewer && selectedWorkOrderJob ? <div className="detail-card"><SellControl sellValue={jobSellForm} pricingStatus={getPricingStatus(selectedWorkOrderJob)} editing={editingJobSellId === selectedWorkOrderJob.id || getPricingStatus(selectedWorkOrderJob) !== "set"} onStartEdit={() => setEditingJobSellId(selectedWorkOrderJob.id)} onChange={setJobSellForm} onSave={saveSelectedJobSell} /></div> : null}{selectedWorkOrder.proposalRequired ? <><PageSection title="Proposal Review List"><DataTable columns={[{ key: "vendor", label: "Crew", render: (row) => row.vendorCompanyName }, { key: "submittedPrice", label: "Submitted Price", render: (row) => formatMoney(row.submittedPrice) }, { key: "status", label: "Status", render: (row) => <ProposalStatusBadge value={row.status} /> }, { key: "submittedAt", label: "Submitted At", render: (row) => formatDate(row.submittedAt) }]} rows={selectedWorkOrderProposals} selectedRowId={selectedProposal?.id} onRowClick={(row) => setSelectedProposalId(row.id)} emptyTitle="No proposals" emptyText="Crew proposals will appear here." /></PageSection><PageSection title="Proposal Decision Panel">{renderProposalDecision(selectedProposal, selectedWorkOrder)}</PageSection></> : <div className="detail-card"><div className="proposal-summary-grid"><div><span className="detail-label">Assignment</span><div className="assignment-cell"><select value={jobAssignment[selectedWorkOrder.id] || selectedWorkOrder.assignedVendorId || ""} disabled={Boolean(appState.jobs.find((job) => job.workOrderId === selectedWorkOrder.id))} onChange={(event) => setJobAssignment((current) => ({ ...current, [selectedWorkOrder.id]: event.target.value }))}><option value="">Select vendor</option>{normalizedVendors.filter((vendor) => vendor.active).map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.companyName || vendor.name}</option>)}</select><button className="secondary-button" disabled={Boolean(appState.jobs.find((job) => job.workOrderId === selectedWorkOrder.id))} onClick={() => assignVendorToWorkOrder(selectedWorkOrder.id)}>Assign + Create Job</button></div></div><div><span className="detail-label">Work Order Status</span><select value={selectedWorkOrder.status} onChange={(event) => updateWorkOrderStatus(selectedWorkOrder.id, event.target.value)}>{WORK_ORDER_STATUS.map((status) => <option key={status} value={status}>{status}</option>)}</select></div></div></div>}</div> : <EmptyState title="No work order selected" text="Select a work order to review details." />}
        />
      </PageSection>
    </div>
  );

  const proposalsScreen = (
    <div className="screen-grid">
      <PageSection title="Proposals">
        <SplitView
          list={<div className="list-stack"><SearchBar value={proposalSearch} onChange={setProposalSearch} placeholder="Search proposals" /><div className="list-scroll"><DataTable columns={[{ key: "crew", label: "Crew", render: (row) => row.vendorCompanyName }, { key: "site", label: "Site", render: (row) => appState.workOrders.find((entry) => entry.id === row.workOrderId)?.siteName || "Unknown" }, { key: "price", label: "Submitted Price", render: (row) => formatMoney(row.submittedPrice) }, { key: "status", label: "Status", render: (row) => <ProposalStatusBadge value={row.status} /> }]} rows={filteredProposals} selectedRowId={selectedProposal?.id} onRowClick={(row) => setSelectedProposalId(row.id)} emptyTitle="No proposals" emptyText="Proposal submissions will appear here." /></div></div>}
            detail={<div className="detail-stack"><PageSection title="Work Order Summary">{selectedProposal ? (() => { const workOrder = appState.workOrders.find((entry) => entry.id === selectedProposal.workOrderId); return workOrder ? <div className="proposal-review-summary"><div className="proposal-summary-top"><div><strong>{workOrder.siteName}</strong><p>{workOrder.description}</p></div><div className="proposal-summary-badges"><ProposalStateBadge value={workOrder.proposalState} /><StatusBadge value={workOrder.status} /></div></div><div className="proposal-summary-grid"><div><span className="detail-label">AMS Work Order</span><p>{workOrder.amsWorkOrderNumber}</p></div><div><span className="detail-label">Service Type</span><p>{workOrder.serviceType}</p></div>{showExternalWorkOrder ? <div><span className="detail-label">External Ref</span><p>{workOrder.externalWorkOrderNumber || "Not set"}</p></div> : null}<div><span className="detail-label">Photos Required</span><p>{workOrder.requireBeforeAfterPhotos ? "Yes" : "No"}</p></div></div></div> : <EmptyState title="No work order found" text="This proposal is missing its work order reference." />; })() : <EmptyState title="No proposal selected" text="Choose a proposal to review." />}</PageSection><PageSection title="Proposal Decision Panel">{renderProposalDecision(selectedProposal, selectedProposal ? appState.workOrders.find((entry) => entry.id === selectedProposal.workOrderId) : null)}</PageSection></div>}
        />
      </PageSection>
    </div>
  );

  const accountingScreen = (
    <div className="screen-grid accounting-screen">
      <PageSection title="Accounting Snapshot"><StatGrid items={[{ label: "Ready for Invoice", value: readyForInvoiceJobs.length }, { label: "Sell Missing", value: jobsMissingSell.length }, { label: "Invoice Submitted", value: appState.invoices.filter((invoice) => invoice.status === "Invoice Submitted").length }, { label: "Under Review", value: appState.invoices.filter((invoice) => invoice.status === "Under Review").length }, { label: "Approved", value: appState.invoices.filter((invoice) => invoice.status === "Approved").length }, { label: "Paid", value: appState.invoices.filter((invoice) => invoice.status === "Paid").length }]} /></PageSection>
      <SplitView
        list={<div className="detail-stack"><PageSection title="Ready for Invoice Queue"><div className="list-scroll compact-scroll contained-scroll"><DataTable columns={[{ key: "site", label: "Site", render: (row) => row.siteName }, { key: "crew", label: "Crew", render: (row) => row.vendorName }, { key: "service", label: "Service Type", render: (row) => row.serviceType }, { key: "status", label: "Job Status", render: (row) => row.status }, { key: "cost", label: "Cost", render: (row) => formatMoney(row.price) }, { key: "sell", label: "Sell", render: (row) => formatMoney(getJobSellValue(row)) }, { key: "pricing", label: "Pricing", render: (row) => <StatusBadge value={getPricingStatus(row)} label={getPricingStatus(row) === "set" ? "Sell Set" : "Sell Not Set"} /> }, { key: "action", label: "Action", render: () => <span className="detail-muted">Awaiting crew submission</span> }]} rows={readyForInvoiceJobs} emptyTitle="No jobs ready" emptyText="Completed jobs without invoices will appear here." /></div></PageSection><PageSection title="Invoice Tracker"><div className="list-stack"><SearchBar value={invoiceSearch} onChange={setInvoiceSearch} placeholder="Search invoices" /><div className="list-scroll compact-scroll contained-scroll"><DataTable columns={[{ key: "invoiceNumber", label: "Invoice Number", render: (row) => row.invoiceNumber || "Not set" }, { key: "site", label: "Site", render: (row) => row.siteName }, { key: "crew", label: "Crew", render: (row) => row.vendorName }, { key: "amount", label: "Cost", render: (row) => formatMoney(row.amount) }, { key: "submittedAt", label: "Submitted At", render: (row) => formatDate(row.submittedAt) }, { key: "status", label: "Status", render: (row) => <InvoiceStatusBadge value={row.status} /> }, { key: "download", label: "Download", render: (row) => <button className="secondary-button" disabled={!["Approved", "Paid"].includes(row.status)} onClick={(event) => { event.stopPropagation(); downloadInvoice(row); }}>Download Invoice</button> }]} rows={filteredInvoices} selectedRowId={selectedInvoice?.id} onRowClick={(row) => setSelectedInvoiceId(row.id)} emptyTitle="No invoices" emptyText="Invoice records will appear here." /></div></div></PageSection></div>}
        detail={<PageSection title="Invoice Editor Panel">{selectedInvoice ? <div className="detail-stack"><div className="proposal-summary-grid"><div><span className="detail-label">Site</span><p>{selectedInvoice.siteName}</p></div><div><span className="detail-label">Crew</span><p>{selectedInvoice.vendorName}</p></div><div><span className="detail-label">Service Type</span><p>{selectedInvoice.serviceType}</p></div><div><span className="detail-label">Job Status</span><p>{selectedInvoice.jobStatus}</p></div><div><span className="detail-label">Cost</span><p>{formatMoney(selectedInvoice.amount)}</p></div><div><span className="detail-label">Sell</span><p>{formatMoney(getJobSellValue(selectedInvoiceJob))}</p></div><div><span className="detail-label">Pricing Status</span><p><StatusBadge value={getPricingStatus(selectedInvoiceJob)} label={getPricingStatus(selectedInvoiceJob) === "set" ? "Sell Set" : "Sell Not Set"} /></p></div><div><span className="detail-label">Sell Set At</span><p>{selectedInvoiceJob?.sellSetAt ? formatDate(selectedInvoiceJob.sellSetAt) : "Not set"}</p></div></div><InputRow><Field label="Invoice Number"><input value={invoiceForm.invoiceNumber} onChange={(event) => setInvoiceForm((current) => ({ ...current, invoiceNumber: event.target.value }))} disabled={selectedInvoice.status === "Paid"} /></Field><Field label="Invoice Date"><input type="date" value={invoiceForm.invoiceDate ? invoiceForm.invoiceDate.slice(0, 10) : ""} onChange={(event) => setInvoiceForm((current) => ({ ...current, invoiceDate: event.target.value }))} disabled={selectedInvoice.status === "Paid"} /></Field><Field label="Due Date"><input type="date" value={invoiceForm.dueDate ? invoiceForm.dueDate.slice(0, 10) : ""} onChange={(event) => setInvoiceForm((current) => ({ ...current, dueDate: event.target.value }))} disabled={selectedInvoice.status === "Paid"} /></Field><Field label="Terms"><input value={invoiceForm.terms} onChange={(event) => setInvoiceForm((current) => ({ ...current, terms: event.target.value }))} disabled={selectedInvoice.status === "Paid"} /></Field><Field label="Status"><select value={invoiceForm.status} onChange={(event) => setInvoiceForm((current) => ({ ...current, status: event.target.value }))} disabled={selectedInvoice.status === "Paid"}>{INVOICE_STATUS.map((status) => <option key={status} value={status}>{status}</option>)}</select></Field><Field label="Notes"><textarea rows="5" value={invoiceForm.notes} onChange={(event) => setInvoiceForm((current) => ({ ...current, notes: event.target.value }))} disabled={selectedInvoice.status === "Paid"} /></Field></InputRow><div className="invoice-line-items">{invoiceForm.lineItems.map((lineItem) => <div key={lineItem.id} className="invoice-line-item"><input value={lineItem.service} onChange={(event) => updateInvoiceLineItem(lineItem.id, "service", event.target.value)} placeholder="Service" disabled={selectedInvoice.status === "Paid"} /><input value={lineItem.description} onChange={(event) => updateInvoiceLineItem(lineItem.id, "description", event.target.value)} placeholder="Description" disabled={selectedInvoice.status === "Paid"} /><input value={lineItem.qty} onChange={(event) => updateInvoiceLineItem(lineItem.id, "qty", event.target.value)} placeholder="Qty" disabled={selectedInvoice.status === "Paid"} /><input value={lineItem.rate} onChange={(event) => updateInvoiceLineItem(lineItem.id, "rate", event.target.value)} placeholder="Rate" disabled={selectedInvoice.status === "Paid"} /><input value={lineItem.amount} readOnly placeholder="Amount" /></div>)}{selectedInvoice.status !== "Paid" ? <button className="secondary-button" onClick={addInvoiceLineItem}>Add Line Item</button> : null}</div>{selectedInvoiceJob ? <SellControl sellValue={accountingSellForm} pricingStatus={getPricingStatus(selectedInvoiceJob)} editing={editingAccountingSellJobId === selectedInvoiceJob.id || getPricingStatus(selectedInvoiceJob) !== "set"} onStartEdit={() => setEditingAccountingSellJobId(selectedInvoiceJob.id)} onChange={setAccountingSellForm} onSave={saveAccountingSell} disabled={selectedInvoice.status === "Paid"} /> : null}<div className="proposal-summary-grid"><div><span className="detail-label">Invoice Total</span><p>{formatMoney(invoiceForm.total)}</p></div></div><div className="decision-actions"><button className="secondary-button" onClick={saveInvoice} disabled={selectedInvoice.status === "Paid"}>Save Invoice</button><button className="secondary-button" onClick={() => updateInvoiceStatus("Under Review")} disabled={selectedInvoice.status === "Paid"}>Mark Under Review</button><button className="secondary-button" onClick={() => updateInvoiceStatus("Approved")} disabled={selectedInvoice.status === "Paid"}>Mark Approved</button><button className="primary-button" onClick={() => updateInvoiceStatus("Paid")} disabled={selectedInvoice.status === "Paid"}>Mark Paid</button></div></div> : <EmptyState title="No invoice selected" text="Select an invoice to edit." />}</PageSection>}
      />
    </div>
  );

  const amsTeamScreen = (
    <div className="screen-grid">
      <PageSection
        title="AMS Team"
        action={
          canEditCrewIdentity(currentUser) ? (
            <button className="primary-button" onClick={() => openModal("amsTeammate")}>
              Add AMS Teammate
            </button>
          ) : null
        }
      >
        <SplitView
          list={
            <div className="list-stack">
              <div className="list-scroll">
                <DataTable
                  columns={[
                    { key: "name", label: "Full Name", render: (row) => row.name },
                    { key: "title", label: "Job Title", render: (row) => row.jobTitle || "Not set" },
                    { key: "email", label: "Email", render: (row) => row.email },
                    { key: "phone", label: "Phone", render: (row) => row.phone || "Not set" },
                    { key: "role", label: "Role", render: (row) => row.role },
                  ]}
                  rows={amsTeamMembers}
                  selectedRowId={selectedTeamMember?.id}
                  onRowClick={(row) => {
                    setSelectedTeamMemberId(row.id);
                    setActiveModal("teamProfile");
                  }}
                  emptyTitle="No team members"
                  emptyText="AMS teammates added here will appear in the directory."
                />
              </div>
            </div>
          }
          detail={
            <div className="detail-stack">
              <div className="detail-card">
                <span className="detail-label">AMS Team Chat</span>
                <strong>AMS Team Chat Coming Soon</strong>
                <p className="detail-muted">
                  Direct team messaging will be added later with backend support.
                </p>
              </div>
              <div className="detail-card">
                <span className="detail-label">Directory</span>
                <p className="detail-muted">
                  Click a teammate row to open the profile card with direct contact details.
                </p>
              </div>
            </div>
          }
        />
      </PageSection>
    </div>
  );

  const weatherScreen = (
    <div className="screen-grid weather-screen">
      <PageSection title="Weather Command">
        <div className="weather-threat-strip">
          {weatherSummary.map((item) => (
            <article key={item.key} className={`weather-threat-card ${item.key}`}>
              <span className="detail-label">{item.label}</span>
              <strong>{item.value}</strong>
            </article>
          ))}
        </div>
      </PageSection>
      <div className="weather-layout">
        <PageSection title="Threat Map">
          <div className="weather-map">
            {weatherCommandState.map((site, index) => (
              <button
                key={site.siteId}
                className={`weather-ping marker-${(index % 5) + 1} ${site.status}`}
                type="button"
              >
                <span>{site.siteName}</span>
              </button>
            ))}
          </div>
        </PageSection>
        <PageSection title="Weather Detail">
          <div className="detail-stack">
            {weatherCommandState.map((site) => (
              <article key={site.siteId} className="detail-card">
                <div className="proposal-summary-top">
                  <div>
                    <strong>{site.siteName}</strong>
                    <p>{site.serviceType}</p>
                  </div>
                  <StatusBadge
                    value={site.status}
                    label={
                      site.status === "active"
                        ? "Active Event"
                        : site.status === "watch_24"
                        ? "24 Hour Watch"
                        : site.status === "watch_48"
                        ? "48 Hour Watch"
                        : site.status === "watch_72"
                        ? "72 Hour Watch"
                        : "No Threat"
                    }
                  />
                </div>
                <p className="detail-muted">{site.summary}</p>
              </article>
            ))}
          </div>
        </PageSection>
      </div>
    </div>
  );

  const profileScreen = currentUser ? (
    <div className="screen-grid">
      <PageSection title="Profile">
        <div className="detail-stack">
          <div className="profile-summary"><div><strong>{currentUser.name}</strong><p>{currentUser.email}</p></div><div className="status-pill active">{currentUser.role}</div></div>
          <article className="detail-card profile-photo-card"><span className="detail-label">Profile Photo</span><strong>Future Profile Picture</strong><p>{profileForm.profilePhotoStatus}</p><button className="secondary-button" onClick={() => showPlaceholder("Profile photo upload will be added in a later build.")}>Photo Upload Coming Soon</button></article>
          <InputRow><Field label={currentUser.role === ROLES.CREW ? "Point of Contact Name" : "Name"}><input value={profileForm.name} onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))} /></Field><Field label="Email / Login"><input value={profileForm.email} readOnly={currentUser.role === ROLES.CREW} onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))} /></Field><Field label="Password"><input type="password" value={profileForm.password} onChange={(event) => setProfileForm((current) => ({ ...current, password: event.target.value }))} /></Field><Field label="Phone"><input value={profileForm.phone} onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))} /></Field><Field label="Job Title"><input value={profileForm.jobTitle} onChange={(event) => setProfileForm((current) => ({ ...current, jobTitle: event.target.value }))} /></Field><Field label="Company Name"><input value={profileForm.companyName} readOnly={currentUser.role === ROLES.CREW} onChange={(event) => setProfileForm((current) => ({ ...current, companyName: event.target.value }))} /></Field><Field label="Street Address"><input value={profileForm.streetAddress} onChange={(event) => setProfileForm((current) => ({ ...current, streetAddress: event.target.value }))} /></Field><Field label="City"><input value={profileForm.city} onChange={(event) => setProfileForm((current) => ({ ...current, city: event.target.value }))} /></Field><Field label="State"><input value={profileForm.state} onChange={(event) => setProfileForm((current) => ({ ...current, state: event.target.value.toUpperCase() }))} /></Field><Field label="ZIP"><input value={profileForm.zip} onChange={(event) => setProfileForm((current) => ({ ...current, zip: event.target.value }))} /></Field><Field label="Internal Notes"><textarea rows="4" value={profileForm.internalNotes} onChange={(event) => setProfileForm((current) => ({ ...current, internalNotes: event.target.value }))} /></Field></InputRow>
          <div className="form-actions"><button className="primary-button" onClick={saveProfile}>Save Profile</button></div>
        </div>
      </PageSection>
      <PageSection title="Company Profile">
        <InputRow><Field label="Company Name"><input value={companyProfileForm.companyName} disabled={currentUser.role === ROLES.CREW} onChange={(event) => setCompanyProfileForm((current) => ({ ...current, companyName: event.target.value }))} /></Field><Field label="Contact Name"><input value={companyProfileForm.contactName} disabled={currentUser.role === ROLES.CREW} onChange={(event) => setCompanyProfileForm((current) => ({ ...current, contactName: event.target.value }))} /></Field><Field label="Phone"><input value={companyProfileForm.phone} disabled={currentUser.role === ROLES.CREW} onChange={(event) => setCompanyProfileForm((current) => ({ ...current, phone: event.target.value }))} /></Field><Field label="Email"><input value={companyProfileForm.email} disabled={currentUser.role === ROLES.CREW} onChange={(event) => setCompanyProfileForm((current) => ({ ...current, email: event.target.value }))} /></Field><Field label="Address"><input value={companyProfileForm.address} disabled={currentUser.role === ROLES.CREW} onChange={(event) => setCompanyProfileForm((current) => ({ ...current, address: event.target.value }))} /></Field><Field label="City"><input value={companyProfileForm.city} disabled={currentUser.role === ROLES.CREW} onChange={(event) => setCompanyProfileForm((current) => ({ ...current, city: event.target.value }))} /></Field><Field label="State"><input value={companyProfileForm.state} disabled={currentUser.role === ROLES.CREW} onChange={(event) => setCompanyProfileForm((current) => ({ ...current, state: event.target.value.toUpperCase() }))} /></Field><Field label="ZIP"><input value={companyProfileForm.zip} disabled={currentUser.role === ROLES.CREW} onChange={(event) => setCompanyProfileForm((current) => ({ ...current, zip: event.target.value }))} /></Field><Field label="Billing / Remit Details"><textarea rows="4" value={companyProfileForm.billingDetails} disabled={currentUser.role === ROLES.CREW} onChange={(event) => setCompanyProfileForm((current) => ({ ...current, billingDetails: event.target.value }))} /></Field></InputRow>
        {currentUser.role === ROLES.CREW ? <p className="detail-muted">Company identity fields are read-only for Crew users in this build.</p> : <div className="form-actions"><button className="primary-button" onClick={saveCompanyProfile}>Save Company Profile</button></div>}
      </PageSection>
    </div>
  ) : null;

  function renderScreen() {
    if (!currentUser) return null;
    if (currentUser.role === ROLES.OPERATOR) return <UnderConstruction title="Operator Portal" message="Operator workflow screens will be added in a later version." />;
    if (currentUser.role === ROLES.CUSTOMER) return <UnderConstruction title="Customer Portal" message="Customer workflow screens will be added in a later version." />;
    if (UNDER_CONSTRUCTION_SCREENS.has(activeScreen)) return <UnderConstruction title={SCREEN_LABELS[activeScreen]} message={`${SCREEN_LABELS[activeScreen]} is reserved for a future additive release.`} />;
    if (activeScreen === "profile") return profileScreen;
    if (activeScreen === "myJobs") return <div className="screen-grid vendor-screen">{crewJobsSection}</div>;
    if (activeScreen === "completedJobs") return completedJobsScreen;
    if (activeScreen === "mySites") return <div className="screen-grid vendor-screen">{crewSitesSection}</div>;
    if (activeScreen === "myProposals") return <div className="screen-grid vendor-screen">{crewProposalStatusSection}</div>;
    if (activeScreen === "myInvoices") return <div className="screen-grid vendor-screen">{crewInvoicesSection}</div>;
    if (activeScreen === "availableWork") return <div className="screen-grid vendor-screen">{crewAvailableWorkSection}</div>;
    if (activeScreen === "companies") return companiesScreen;
    if (activeScreen === "users") return usersScreen;
    if (activeScreen === "platformStatus") return platformStatusScreen;
    if (activeScreen === "internalNotes") return internalNotesScreen;
    if (activeScreen === "systemControls") return systemControlsScreen;
    if (activeScreen === "amsTeam") return amsTeamScreen;
    if (activeScreen === "sites") return sitesScreen;
    if (activeScreen === "vendors") return crewsScreen;
    if (activeScreen === "workOrders") return workOrdersScreen;
    if (activeScreen === "proposals") return proposalsScreen;
    if (activeScreen === "jobs") return jobsScreen;
    if (activeScreen === "accounting") return accountingScreen;
    if (activeScreen === "weather") return weatherScreen;
    if (activeScreen === "reports") return reportsScreen;
    if (currentUser.role === ROLES.OWNER) return ownerDashboard;
    if (AMS_ROLES.includes(currentUser.role)) return amsDashboard;
    if (currentUser.role === ROLES.CREW && activeScreen === "dashboard") return crewDashboard;
    return <UnderConstruction title="Screen Unavailable" message="This screen is reserved for future development." />;
  }

  if (showSplash) {
    return <SplashScreen />;
  }

  if (!currentUser) {
    return <LoginScreen email={loginForm.email} password={loginForm.password} onChange={updateLoginField} onLogin={() => handleLogin(loginForm.email, loginForm.password)} onDemoLogin={handleDemoLogin} />;
  }

  return (
    <div className="app-shell">
      <Drawer open={drawerOpen} menuItems={DRAWER_MENUS[currentUser.role]} activeScreen={activeScreen} labels={SCREEN_LABELS} currentUser={currentUser} onNavigate={openScreen} onLogout={logout} onClose={() => setDrawerOpen(false)} />
      <div className="main-shell">
        <Header currentUser={currentUser} activeScreen={activeScreen} onOpenDrawer={() => setDrawerOpen(true)} onGoBack={() => openScreen("dashboard")} onOpenNotifications={() => showPlaceholder("Notifications will be added in a later build.")} onToggleProfileMenu={() => setProfileMenuOpen((open) => !open)} profileMenuOpen={profileMenuOpen} onNavigate={openScreen} onLogout={logout} />
        <main className="content-shell"><div className="screen-header"><div><div className="eyebrow">{getPortalEyebrow(currentUser)}</div><h1>{SCREEN_LABELS[activeScreen] || "Dashboard"}</h1></div></div>{renderScreen()}</main>
      </div>

        <Modal open={activeModal === "workOrder"} title="Create Work Order" onClose={closeModal} footer={<div className="form-actions"><button className="secondary-button" onClick={() => showPlaceholder("File and image uploads require backend support and will be added in a later build.")}>Attach File / Upload Picture</button><button className="primary-button" onClick={createWorkOrder}>Create Work Order</button></div>}>
          <div className="modal-reference">AMS Work Order Number: {nextWorkOrderNumber}</div>
          <InputRow>{showExternalWorkOrder ? <Field label="External Work Order Number"><input value={workOrderForm.externalWorkOrderNumber} onChange={(event) => setWorkOrderForm((current) => ({ ...current, externalWorkOrderNumber: event.target.value }))} /></Field> : null}<Field label="Site"><select value={workOrderForm.siteId} onChange={(event) => setWorkOrderForm((current) => ({ ...current, siteId: event.target.value }))}><option value="">Select site</option>{appState.sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></Field><Field label="Service Type"><select value={workOrderForm.serviceType} onChange={(event) => setWorkOrderForm((current) => ({ ...current, serviceType: event.target.value }))}><option value="">Select service type</option>{SERVICE_TYPES.map((serviceType) => <option key={serviceType} value={serviceType}>{serviceType}</option>)}</select></Field><Field label="Workflow Path"><select value={workOrderForm.workflowType} onChange={(event) => setWorkOrderForm((current) => ({ ...current, workflowType: event.target.value, directVendorId: event.target.value === "proposal" ? "" : current.directVendorId }))}><option value="direct">Direct Assignment</option><option value="proposal">Proposal Opportunity</option></select></Field><Field label="Work Type"><select value={workOrderForm.workType} onChange={(event) => setWorkOrderForm((current) => ({ ...current, workType: event.target.value, recurringFrequency: event.target.value === "recurring" ? current.recurringFrequency : "", recurringVendorCost: event.target.value === "recurring" ? current.recurringVendorCost : "", recurringPricingNotes: event.target.value === "recurring" ? current.recurringPricingNotes : "", seasonStart: event.target.value === "seasonal" ? current.seasonStart : "", seasonEnd: event.target.value === "seasonal" ? current.seasonEnd : "", seasonalServiceType: event.target.value === "seasonal" ? current.seasonalServiceType : "" }))}><option value="one_time">One-Time</option><option value="recurring">Recurring</option><option value="seasonal">Seasonal/Triggered</option></select></Field><Field label="Assign Vendor Now"><select value={workOrderForm.directVendorId} disabled={workOrderForm.workflowType !== "direct"} onChange={(event) => setWorkOrderForm((current) => ({ ...current, directVendorId: event.target.value }))}><option value="">Leave unassigned</option>{normalizedVendors.filter((vendor) => vendor.active).map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.companyName || vendor.name}</option>)}</select></Field><Field label="Description"><textarea rows="4" value={workOrderForm.description} onChange={(event) => setWorkOrderForm((current) => ({ ...current, description: event.target.value }))} /></Field>{workOrderForm.workType === "recurring" ? <><Field label="Recurring Frequency"><select value={workOrderForm.recurringFrequency} onChange={(event) => setWorkOrderForm((current) => ({ ...current, recurringFrequency: event.target.value }))}><option value="">Select frequency</option><option value="weekly">Weekly</option><option value="bi_weekly">Bi-weekly</option><option value="monthly">Monthly</option></select></Field><Field label="Vendor Cost"><input value={workOrderForm.recurringVendorCost} onChange={(event) => setWorkOrderForm((current) => ({ ...current, recurringVendorCost: event.target.value }))} placeholder="Enter recurring vendor cost" /></Field></> : null}{workOrderForm.workType === "seasonal" ? <><Field label="Season Start"><input type="date" value={workOrderForm.seasonStart} onChange={(event) => setWorkOrderForm((current) => ({ ...current, seasonStart: event.target.value }))} /></Field><Field label="Season End"><input type="date" value={workOrderForm.seasonEnd} onChange={(event) => setWorkOrderForm((current) => ({ ...current, seasonEnd: event.target.value }))} /></Field><Field label="Seasonal Service"><select value={workOrderForm.seasonalServiceType} onChange={(event) => setWorkOrderForm((current) => ({ ...current, seasonalServiceType: event.target.value }))}><option value="">Select service</option><option value="Plowing">Plowing</option><option value="Shoveling">Shoveling</option><option value="Salting">Salting</option></select></Field></> : null}</InputRow>
        <label className="checkbox-inline"><input type="checkbox" checked={workOrderForm.requireBeforeAfterPhotos} onChange={(event) => setWorkOrderForm((current) => ({ ...current, requireBeforeAfterPhotos: event.target.checked }))} />Require before and after photos</label>
      </Modal>

      <Modal open={activeModal === "site"} title={editingSiteId ? "Edit Site" : "Create Site"} onClose={closeModal} footer={<button className="primary-button" onClick={saveSite}>{editingSiteId ? "Update Site" : "Add Site"}</button>}><InputRow><Field label="Site Name"><input value={siteForm.name} onChange={(event) => setSiteForm((current) => ({ ...current, name: event.target.value }))} /></Field><Field label="Street Address"><input value={siteForm.streetAddress} onChange={(event) => setSiteForm((current) => ({ ...current, streetAddress: event.target.value }))} /></Field><Field label="City"><input value={siteForm.city} onChange={(event) => setSiteForm((current) => ({ ...current, city: event.target.value }))} /></Field><Field label="State"><input value={siteForm.state} maxLength={2} onChange={(event) => setSiteForm((current) => ({ ...current, state: event.target.value.toUpperCase() }))} /></Field><Field label="ZIP Code"><input value={siteForm.zip} onChange={(event) => setSiteForm((current) => ({ ...current, zip: event.target.value }))} /></Field><Field label="Primary Assigned Vendor"><select value={siteForm.assignedVendorId} onChange={(event) => setSiteForm((current) => ({ ...current, assignedVendorId: event.target.value, assignedCrewContactId: "" }))}><option value="">Unassigned</option>{normalizedVendors.filter((vendor) => vendor.active).map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.companyName || vendor.name}</option>)}</select></Field><Field label="Crew Contact"><select value={siteForm.assignedCrewContactId} onChange={(event) => setSiteForm((current) => ({ ...current, assignedCrewContactId: event.target.value }))}><option value="">Not set</option>{appState.users.filter((user) => user.role === ROLES.CREW && (!siteForm.assignedVendorId || normalizedVendors.find((vendor) => vendor.id === siteForm.assignedVendorId)?.userId === user.id)).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></Field><Field label="Internal Notes"><textarea rows="4" value={siteForm.internalNotes} onChange={(event) => setSiteForm((current) => ({ ...current, internalNotes: event.target.value }))} /></Field></InputRow><div className="proposal-summary-grid"><article className="detail-card"><span className="detail-label">Site Map</span><p>Upload Coming Soon</p></article><article className="detail-card"><span className="detail-label">Geo Fence</span><p>Geo Fence Setup Coming Soon</p></article></div></Modal>

      <Modal open={activeModal === "vendor"} title={editingVendorId ? "Edit Vendor" : "Create Vendor"} onClose={closeModal} footer={<button className="primary-button" onClick={saveVendor}>{editingVendorId ? "Update Vendor" : "Add Vendor"}</button>}><InputRow><Field label="Company Name"><input value={vendorForm.companyName} onChange={(event) => setVendorForm((current) => ({ ...current, companyName: event.target.value }))} /></Field><Field label="Point of Contact"><input value={vendorForm.contactName} onChange={(event) => setVendorForm((current) => ({ ...current, contactName: event.target.value }))} /></Field><Field label="Phone Number"><input value={vendorForm.phone} onChange={(event) => setVendorForm((current) => ({ ...current, phone: event.target.value }))} /></Field><Field label="Email Address"><input value={vendorForm.email} onChange={(event) => setVendorForm((current) => ({ ...current, email: event.target.value }))} /></Field><Field label="Password"><input type="password" value={vendorForm.password} onChange={(event) => setVendorForm((current) => ({ ...current, password: event.target.value }))} placeholder="Defaults to Crew123 if left blank" /></Field><Field label="Street Address"><input value={vendorForm.streetAddress} onChange={(event) => setVendorForm((current) => ({ ...current, streetAddress: event.target.value }))} /></Field><Field label="City"><input value={vendorForm.city} onChange={(event) => setVendorForm((current) => ({ ...current, city: event.target.value }))} /></Field><Field label="State"><input value={vendorForm.state} onChange={(event) => setVendorForm((current) => ({ ...current, state: event.target.value.toUpperCase() }))} /></Field><Field label="ZIP Code"><input value={vendorForm.zip} onChange={(event) => setVendorForm((current) => ({ ...current, zip: event.target.value }))} /></Field><Field label="Primary Service Type"><select value={vendorForm.serviceType} onChange={(event) => setVendorForm((current) => ({ ...current, serviceType: event.target.value }))}><option value="">Select service type</option>{SERVICE_TYPES.map((serviceType) => <option key={serviceType} value={serviceType}>{serviceType}</option>)}</select></Field><Field label="Service Types"><input value={vendorForm.serviceTypes} onChange={(event) => setVendorForm((current) => ({ ...current, serviceTypes: event.target.value }))} placeholder="Snow Removal, Landscaping" /></Field><Field label="States"><input value={vendorForm.states} onChange={(event) => setVendorForm((current) => ({ ...current, states: event.target.value.toUpperCase() }))} placeholder="MA, RI" /></Field><Field label="Internal Notes"><textarea rows="4" value={vendorForm.internalNotes} onChange={(event) => setVendorForm((current) => ({ ...current, internalNotes: event.target.value }))} /></Field></InputRow></Modal>

      <Modal open={activeModal === "job"} title="Create Job" onClose={closeModal} footer={<button className="primary-button" onClick={createManualJob}>Create Job</button>}><InputRow><Field label="Work Order"><select value={jobCreateForm.workOrderId} onChange={(event) => setJobCreateForm((current) => ({ ...current, workOrderId: event.target.value }))}><option value="">Select work order</option>{appState.workOrders.filter((workOrder) => !appState.jobs.some((job) => job.workOrderId === workOrder.id)).map((workOrder) => <option key={workOrder.id} value={workOrder.id}>{workOrder.amsWorkOrderNumber} - {workOrder.siteName}</option>)}</select></Field><Field label="Vendor"><select value={jobCreateForm.vendorId} onChange={(event) => setJobCreateForm((current) => ({ ...current, vendorId: event.target.value }))}><option value="">Select vendor</option>{normalizedVendors.filter((vendor) => vendor.active).map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.companyName || vendor.name}</option>)}</select></Field><Field label="Price"><input value={jobCreateForm.price} onChange={(event) => setJobCreateForm((current) => ({ ...current, price: event.target.value }))} /></Field></InputRow></Modal>
      <Modal open={activeModal === "amsTeammate"} title="Add AMS Teammate" onClose={closeModal} footer={<button className="primary-button" onClick={saveUser}>Add Teammate</button>}><InputRow><Field label="Full Name"><input value={userForm.name} onChange={(event) => setUserForm((current) => ({ ...current, name: event.target.value }))} /></Field><Field label="Email / Login"><input value={userForm.email} onChange={(event) => setUserForm((current) => ({ ...current, email: event.target.value }))} /></Field><Field label="Password"><input type="password" value={userForm.password} onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))} /></Field><Field label="Phone Number"><input value={userForm.phone} onChange={(event) => setUserForm((current) => ({ ...current, phone: event.target.value }))} /></Field><Field label="Job Title"><input value={userForm.jobTitle} onChange={(event) => setUserForm((current) => ({ ...current, jobTitle: event.target.value }))} /></Field><Field label="Company Name"><input value={userForm.companyName} onChange={(event) => setUserForm((current) => ({ ...current, companyName: event.target.value }))} /></Field><Field label="Street Address"><input value={userForm.streetAddress} onChange={(event) => setUserForm((current) => ({ ...current, streetAddress: event.target.value }))} /></Field><Field label="City"><input value={userForm.city} onChange={(event) => setUserForm((current) => ({ ...current, city: event.target.value }))} /></Field><Field label="State"><input value={userForm.state} onChange={(event) => setUserForm((current) => ({ ...current, state: event.target.value.toUpperCase() }))} /></Field><Field label="ZIP"><input value={userForm.zip} onChange={(event) => setUserForm((current) => ({ ...current, zip: event.target.value }))} /></Field><Field label="Internal Notes"><textarea rows="4" value={userForm.internalNotes} onChange={(event) => setUserForm((current) => ({ ...current, internalNotes: event.target.value }))} /></Field><Field label="Role"><select value={userForm.role} onChange={(event) => setUserForm((current) => ({ ...current, role: event.target.value }))}><option value={ROLES.AMS_ADMIN}>{ROLES.AMS_ADMIN}</option><option value={ROLES.AMS_MANAGER}>{ROLES.AMS_MANAGER}</option></select></Field></InputRow></Modal>
      <Modal open={activeModal === "teamProfile"} title="AMS Teammate Profile" onClose={closeModal}>{selectedTeamMember ? <div className="detail-stack"><div className="detail-card"><div className="proposal-summary-top"><div><strong>{selectedTeamMember.name}</strong><p>{selectedTeamMember.jobTitle || selectedTeamMember.role}</p></div><StatusBadge value={selectedTeamMember.active ? "active" : "inactive"} label={selectedTeamMember.active ? "Active" : "Inactive"} /></div><div className="proposal-summary-grid"><div><span className="detail-label">Phone Number</span><p>{selectedTeamMember.phone ? <a href={`tel:${selectedTeamMember.phone}`}>{selectedTeamMember.phone}</a> : "Not set"}</p></div><div><span className="detail-label">Email</span><p><a href={`mailto:${selectedTeamMember.email}`}>{selectedTeamMember.email}</a></p></div><div><span className="detail-label">Company Name</span><p>{selectedTeamMember.companyName || "Advanced Maintenance Services"}</p></div><div><span className="detail-label">Address</span><p>{selectedTeamMember.address || "Not set"}</p></div><div><span className="detail-label">Internal Notes</span><p>{selectedTeamMember.internalNotes || "No internal notes."}</p></div></div></div></div> : <EmptyState title="No teammate selected" text="Choose a teammate from the directory." />}</Modal>
      <Modal open={Boolean(jobConfirmation)} title={jobConfirmation?.type === "start" ? "Start Job" : "Complete Job"} onClose={() => setJobConfirmation(null)} footer={<div className="form-actions"><button className="secondary-button" onClick={() => setJobConfirmation(null)}>Cancel</button><button className="primary-button" onClick={confirmJobStatusChange}>{jobConfirmation?.type === "start" ? "Start Job" : "Complete Job"}</button></div>}><p className="detail-muted">{jobConfirmation?.type === "start" ? "Are you on site and ready to start the job?" : "Are you sure this job is complete and the scope of work has been completed?"}</p></Modal>
    </div>
  );
}

export default AppBuild03;



