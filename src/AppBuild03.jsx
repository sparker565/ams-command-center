import React, { useEffect, useState } from "react";
import {
  APP_VERSION,
  AMS_ROLES,
  CREW_ROLES,
  DRAWER_MENUS,
  FIREBASE_ROLE_BRIDGE,
  INVOICE_STATUS,
  JOB_FILTERS,
  JOB_STATUS,
  ROLES,
  SCREEN_LABELS,
  SERVICE_TYPES,
  normalizeServiceType,
  UNDER_CONSTRUCTION_SCREENS,
  WORK_ORDER_FILTERS,
  WORK_ORDER_STATUS,
} from "./constants";
import { loadAppState, saveAppState } from "./storage";
import {
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
import {
  ensureFirestoreUserProfile,
  getFirebaseErrorMessage,
  signIn,
  signOutUser,
  subscribeToAuthState,
  updateCurrentUserPassword,
} from "./firebaseAuth";
import {
  createFirestoreInvoiceAndMarkJob,
  loadFirestoreInvoices,
  normalizeInvoiceStatus,
  updateFirestoreJobAndInvoiceCost,
  updateFirestoreInvoiceAndJob,
  updateFirestoreInvoice,
} from "./firestoreInvoices";
import {
  createOrLinkFirestoreJobForWorkOrder,
  loadFirestoreJobs,
  updateFirestoreJob,
} from "./firestoreJobs";
import {
  approveFirestoreProposalForWorkOrder,
  createFirestoreProposal,
  loadFirestoreProposals,
  normalizeProposalStatus,
  updateFirestoreProposal,
} from "./firestoreProposals";
import {
  createFirestoreSite,
  createFirestoreSitesBatch,
  deleteFirestoreSite,
  loadFirestoreSites,
  updateFirestoreSite,
} from "./firestoreSites";
import {
  createFirestoreVendor,
  deleteFirestoreVendor,
  loadFirestoreVendors,
  updateFirestoreVendor,
} from "./firestoreVendors";
import {
  createFirestoreWorkOrder,
  loadFirestoreWorkOrders,
  updateFirestoreWorkOrder,
} from "./firestoreWorkOrders";
import { parseSiteImportFile, SITE_IMPORT_HEADERS } from "./siteImport";

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

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

function getCanonicalSellValue(record) {
  return String(record?.sell ?? record?.sellPrice ?? "").trim();
}

function buildAddressLine({
  streetAddress,
  city,
  state,
  zip,
  fallbackAddress,
}) {
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
  const [streetAddress = "", city = "", stateZip = ""] = String(address)
    .split(",")
    .map((part) => part.trim());
  const stateZipMatch = stateZip.match(/^([A-Za-z]{2})\s*(\d{5}(?:-\d{4})?)?$/);
  return {
    streetAddress,
    city,
    state: stateZipMatch?.[1]?.toUpperCase() || "",
    zip: stateZipMatch?.[2] || "",
  };
}

function normalizeEmail(email = "") {
  return String(email).trim().toLowerCase();
}

function isCrewRole(role) {
  return CREW_ROLES.includes(role);
}

function isCrewUser(user) {
  return isCrewRole(user?.role);
}

function getDisplayRole(user) {
  return user?.displayRole || user?.role || "";
}

function getFirestoreRole(role) {
  const normalizedRole = String(role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (normalizedRole === "owner") return ROLES.OWNER;
  if (normalizedRole === "ams_admin" || normalizedRole === "ams")
    return ROLES.AMS_ADMIN;
  if (normalizedRole === "ams_manager") return ROLES.AMS_MANAGER;
  if (normalizedRole === "vendor") return ROLES.VENDOR;
  if (normalizedRole === "crew") return ROLES.CREW;
  if (role === ROLES.AMS_ADMIN) return ROLES.AMS_ADMIN;
  if (role === ROLES.AMS_MANAGER) return ROLES.AMS_MANAGER;
  if (role === ROLES.VENDOR) return ROLES.VENDOR;
  if (role === ROLES.OWNER) return ROLES.OWNER;
  return role || "";
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function calculateInvoiceTotal(lineItems = []) {
  return lineItems
    .reduce((sum, item) => sum + toNumber(item.amount), 0)
    .toFixed(2);
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
  return (
    getAllUserPool(state).find((user) => user.id === state.ui?.currentUserId) ||
    null
  );
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
    serviceTypes:
      vendor.serviceTypes || (vendor.serviceType ? [vendor.serviceType] : []),
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
    address: buildAddressLine({
      streetAddress,
      city,
      state,
      zip,
      fallbackAddress: site.address || "",
    }),
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
  const hasBadDefaultAmsAddress =
    user.streetAddress === "19B North Street" &&
    [
      "Advanced Maintenance Services",
      "SparkCommand Systems",
      "AMS Demo Crew Company",
    ].includes(user.companyName || "");
  const streetAddress = hasBadDefaultAmsAddress
    ? ""
    : user.streetAddress || legacyAddress.streetAddress;
  const city = hasBadDefaultAmsAddress ? "" : user.city || legacyAddress.city;
  const state = hasBadDefaultAmsAddress
    ? ""
    : user.state || legacyAddress.state;
  const zip = hasBadDefaultAmsAddress ? "" : user.zip || legacyAddress.zip;
  return {
    ...user,
    email: normalizeEmail(user.email || ""),
    active: user.active ?? (user.accessStatus || "Active") === "Active",
    status:
      user.status ||
      ((user.active ?? (user.accessStatus || "Active") === "Active")
        ? "active"
        : "inactive"),
    accessStatus:
      user.accessStatus || (user.active === false ? "Inactive" : "Active"),
    authStatus:
      user.authStatus || (user.active === false ? "Disabled" : "Active"),
    role: getFirestoreRole(user.role),
    displayRole: user.displayRole || user.role || "",
    phone: user.phone || "",
    jobTitle: user.jobTitle || "",
    companyName: user.companyName || "",
    portal: user.portal || getPortalPathForUser(user),
    defaultPortal: user.defaultPortal || getPortalPathForUser(user),
    createdAt: user.createdAt || "",
    updatedAt: user.updatedAt || "",
    streetAddress,
    city,
    state,
    zip,
    internalNotes: user.internalNotes || "",
    profilePhotoStatus: user.profilePhotoStatus || "Photo Upload Coming Soon",
    address: buildAddressLine({
      streetAddress,
      city,
      state,
      zip,
      fallbackAddress: hasBadDefaultAmsAddress ? "" : user.address || "",
    }),
  };
}

function normalizeProposal(proposal) {
  const status = normalizeProposalStatus(proposal.status);
  const submittedPrice = proposal.submittedPrice ?? proposal.price ?? "";
  const submittedNotes = proposal.submittedNotes ?? proposal.notes ?? "";
  const submittedAt = proposal.submittedAt || proposal.createdAt || "";
  const revisionCount = proposal.revisionCount || proposal.revisionNumber || 1;
  const vendorName = proposal.vendorCompanyName || proposal.vendorName || "";

  return {
    ...proposal,
    status,
    vendorCompanyName: vendorName,
    vendorName,
    submittedPrice,
    submittedNotes,
    price: proposal.price ?? submittedPrice,
    notes: proposal.notes ?? submittedNotes,
    submittedAt,
    createdAt: proposal.createdAt || submittedAt,
    reviewedPrice: proposal.reviewedPrice ?? "",
    amsNotes: proposal.amsNotes || "",
    lastReviewedAt: proposal.lastReviewedAt || "",
    revisionCount,
    revisionNumber: proposal.revisionNumber || revisionCount,
    supersedesProposalId: proposal.supersedesProposalId || null,
    isActivePath:
      proposal.isActivePath ??
      ["submitted", "revision_requested"].includes(status),
    rejectedAt: proposal.rejectedAt || "",
    approvedAt: proposal.approvedAt || "",
    requestedRevisionAt: proposal.requestedRevisionAt || "",
  };
}

function normalizeJob(job) {
  const normalizedSell = getCanonicalSellValue(job);
  const startedAt = job.startedAt || job.startTime || "";
  const startTime = job.startTime || startedAt;
  const completedTime = job.completedTime || job.completedAt || "";
  return {
    ...job,
    description: job.description || "",
    price: job.price ?? job.cost ?? "",
    sell: normalizedSell,
    pricingStatus: job.pricingStatus || (normalizedSell ? "set" : "not_set"),
    sellSetBy: job.sellSetBy || null,
    sellSetAt: job.sellSetAt || "",
    startedAt,
    startTime,
    completedTime,
    completedAt: completedTime,
    serviceDate: job.serviceDate || completedTime || "",
    serviceType: normalizeServiceType(job.serviceType) || job.serviceType || "",
    servicePerformed:
      normalizeServiceType(job.servicePerformed || job.serviceType) || "",
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
  const total =
    invoice.total ?? invoice.amount ?? calculateInvoiceTotal(lineItems);
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
    status: normalizeInvoiceStatus(invoice.status),
    notes: invoice.notes || "",
    completedAt: invoice.completedAt || "",
    lastCostUpdatedAt: invoice.lastCostUpdatedAt || "",
    lastCostUpdatedBy: invoice.lastCostUpdatedBy || "",
    adjustments: invoice.adjustments || [],
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
  if (
    workOrder.proposalAwardedAt ||
    workOrder.assignedVendorId ||
    workOrder.jobId
  )
    return "awarded";

  const relatedProposals = proposals.filter(
    (proposal) => proposal.workOrderId === workOrder.id,
  );
  const hasApprovedProposal = relatedProposals.some(
    (proposal) => proposal.status === "approved",
  );
  const hasActiveProposal = relatedProposals.some(
    (proposal) => proposal.isActivePath,
  );

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
  const linkedJob = jobs.find(
    (job) =>
      job.workOrderId === workOrder.id ||
      job.workOrderId === workOrder.firestoreId ||
      job.id === workOrder.jobId,
  );

  const jobStatusMap = {
    Assigned: "Assigned",
    Scheduled: "Assigned",
    Started: "In Progress",
    "In Progress": "In Progress",
    Completed: "Completed",
    "Ready for Invoice": "Ready for Invoice",
    Invoiced: "Invoiced",
    Paid: "Paid",
  };

  const derivedStatus = linkedJob
    ? jobStatusMap[linkedJob.status] || workOrder.status
    : workOrder.status;

  const status = String(derivedStatus || "Needs Review").trim();
  const statusLookup = status.toLowerCase();

  const normalized = {
    ...workOrder,
    amsWorkOrderNumber:
      workOrder.amsWorkOrderNumber || getNextAmsWorkOrderNumber([workOrder]),
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
    status:
      statusLookup === "open opportunity"
        ? "Open"
        : statusLookup === "proposal needed"
          ? "Needs Vendor"
          : status,
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
    normalizeWorkOrder(workOrder, proposals, jobs),
  );
  const selectedSiteId =
    state.ui?.selectedSiteId &&
    sites.some((site) => site.id === state.ui.selectedSiteId)
      ? state.ui.selectedSiteId
      : sites[0]?.id || null;
  const currentUserExists = getAllUserPool({ ...state, users, vendors }).some(
    (user) => user.id === state.ui?.currentUserId,
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
      ...(state.ui || {}),
      currentUserId: currentUserExists ? state.ui?.currentUserId || null : null,
      selectedSiteId,
      activeScreenByRole: {
        [ROLES.OWNER]: "dashboard",
        [ROLES.AMS_ADMIN]: "dashboard",
        [ROLES.AMS_MANAGER]: "dashboard",
        [ROLES.CUSTOMER]: "dashboard",
        [ROLES.CREW]: "dashboard",
        [ROLES.VENDOR]: "dashboard",
        [ROLES.OPERATOR]: "dashboard",
        ...(state.ui?.activeScreenByRole || {}),
      },
    },
  };
}

function getWorkOrderFilterMatch(workOrder, filter) {
  if (filter === "All") return true;
  if (filter === "Open") {
    return [
      "Needs Review",
      "Needs Attention",
      "Needs Vendor",
      "Scheduled",
      "Open",
    ].includes(workOrder.status);
  }
  if (filter === "Assigned")
    return ["Assigned", "In Progress"].includes(workOrder.status);
  if (filter === "Closed")
    return (
      ["Completed", "Ready for Invoice"].includes(workOrder.status) ||
      isClosedWorkOrder(workOrder.status)
    );
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
  return values.some((value) =>
    String(value || "")
      .toLowerCase()
      .includes(normalizedQuery),
  );
}

function findCrewForUser(vendors, currentUser) {
  if (!currentUser || !isCrewUser(currentUser)) return null;
  const currentEmail = normalizeEmail(currentUser.email);

  return (
    vendors.find(
      (vendor) => vendor.userId && vendor.userId === currentUser.id,
    ) ||
    vendors.find(
      (vendor) =>
        normalizeEmail(vendor.userEmail || vendor.email) === currentEmail,
    ) ||
    vendors.find(
      (vendor) =>
        String(vendor.name || "")
          .trim()
          .toLowerCase() ===
        String(currentUser.name || "")
          .trim()
          .toLowerCase(),
    ) ||
    null
  );
}

function getCrewWorkOrderProposals(proposals, workOrderId, vendorId) {
  return sortByNewest(
    proposals.filter(
      (proposal) =>
        proposal.workOrderId === workOrderId && proposal.vendorId === vendorId,
    ),
    "submittedAt",
  );
}

function getLatestCrewProposal(proposals, workOrderId, vendorId) {
  return getCrewWorkOrderProposals(proposals, workOrderId, vendorId)[0] || null;
}

function getVendorCoverageStates(vendor) {
  return [vendor?.state, ...(vendor?.states || [])]
    .map((state) =>
      String(state || "")
        .trim()
        .toUpperCase(),
    )
    .filter(Boolean);
}

function getWorkOrderDispatchState(workOrder, site) {
  return String(workOrder?.state || site?.state || "")
    .trim()
    .toUpperCase();
}

function getNormalizedStatus(status) {
  return String(status || "")
    .trim()
    .toLowerCase();
}

function isCrewOpenWorkOrderStatus(status) {
  return [
    "open",
    "needs vendor",
    "open opportunity",
    "proposal needed",
  ].includes(getNormalizedStatus(status));
}

function hasAssignedValue(value) {
  return String(value ?? "").trim() !== "";
}

function isWorkOrderTrulyAssigned(workOrder) {
  return (
    hasAssignedValue(workOrder?.assignedVendorId) ||
    hasAssignedValue(workOrder?.jobId) ||
    hasAssignedValue(workOrder?.proposalAwardedAt)
  );
}

function getWorkOrderStatusDisplay(workOrder) {
  const rawStatus = String(workOrder?.status || "Needs Review").trim();
  const normalizedStatus = getNormalizedStatus(rawStatus);

  if (
    ["assigned", "in progress", "completed", "canceled"].includes(
      normalizedStatus,
    )
  ) {
    return rawStatus;
  }

  if (isWorkOrderTrulyAssigned(workOrder)) {
    return "Assigned";
  }

  if (normalizedStatus === "open") {
    return "Open Opportunity";
  }

  return rawStatus;
}

function shouldShowProposalStateBadge(workOrder) {
  return ["under_review"].includes(workOrder?.proposalState);
}

function createDemoSessionUser(type) {
  if (type === "ams") {
    return normalizeUser({
      id: "demo-ams-session",
      name: "AMS Demo",
      email: "amsdemo@amsdemo.local",
      role: ROLES.AMS_ADMIN,
      displayRole: "AMS Admin",
      active: true,
      accessStatus: "Active",
      authStatus: "Demo",
      companyName: "Advanced Maintenance Services",
      demo: true,
    });
  }

  return normalizeUser({
    id: "demo-crew-session",
    name: "Crew Demo",
    email: "crewdemo@amsdemo.local",
    role: ROLES.VENDOR,
    displayRole: "Crew",
    active: true,
    accessStatus: "Active",
    authStatus: "Demo",
    companyName: "Crew Demo Company",
    demo: true,
  });
}

function isCrewEligibleForWorkOrder({
  workOrder,
  site,
  vendor,
  proposals,
  jobs,
}) {
  if (!workOrder || !vendor?.active) return false;
  if (!isCrewOpenWorkOrderStatus(workOrder.status)) return false;
  if (isWorkOrderTrulyAssigned(workOrder)) return false;
  if (
    jobs.some(
      (job) =>
        String(job.workOrderId || "").trim() ===
        String(workOrder.id || "").trim(),
    )
  )
    return false;
  if (
    proposals.some(
      (proposal) =>
        proposal.workOrderId === workOrder.id && proposal.status === "approved",
    )
  ) {
    return false;
  }
  const workOrderState = getWorkOrderDispatchState(workOrder, site);
  const vendorStates = getVendorCoverageStates(vendor);
  return Boolean(workOrderState && vendorStates.includes(workOrderState));
}

function canCrewSubmitProposal({ workOrder, site, vendor, proposals, jobs }) {
  if (!isCrewEligibleForWorkOrder({ workOrder, site, vendor, proposals, jobs }))
    return false;
  const latestProposal = getLatestCrewProposal(
    proposals,
    workOrder.id,
    vendor.id,
  );
  if (!latestProposal) return true;
  return ["rejected", "revision_requested"].includes(latestProposal.status);
}

function getJobSellValue(job) {
  return getCanonicalSellValue(job);
}

function getJobCostValue(job) {
  return String(job?.cost ?? job?.price ?? "").trim();
}

function normalizeCostForCompare(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  const numeric = Number(trimmed);
  return Number.isNaN(numeric) ? trimmed : String(numeric);
}

function didCostValueChange(previousCost, nextCost) {
  return (
    normalizeCostForCompare(previousCost) !== normalizeCostForCompare(nextCost)
  );
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
    sell: hasSell ? normalizedSell : "",
    pricingStatus: hasSell ? "set" : "not_set",
    sellSetBy: hasSell
      ? currentUser?.id || existingJob?.sellSetBy || null
      : null,
    sellSetAt: hasSell
      ? changed
        ? timestamp
        : existingJob?.sellSetAt || timestamp
      : "",
  };
}

function getInheritedJobCost(workOrder, explicitPrice) {
  if (
    explicitPrice !== undefined &&
    explicitPrice !== null &&
    String(explicitPrice).trim() !== ""
  ) {
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
    serviceType:
      normalizeServiceType(workOrder.serviceType) || workOrder.serviceType,
    description: workOrder.description,
    price: getInheritedJobCost(workOrder, price),
    ...buildPricingFields({ sell, currentUser }),
    status: "Assigned",
    startTime: "",
    completedTime: "",
    serviceDate: "",
    servicePerformed:
      normalizeServiceType(workOrder.serviceType) || workOrder.serviceType,
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
  const internalReference =
    workOrder?.amsWorkOrderNumber || `INV-${String(job.id).slice(-6)}`;
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
    invoiceNumber: internalReference,
    invoiceDate: new Date().toISOString(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    terms: "Net 30",
    submittedAt: new Date().toISOString(),
    submittedBy: currentUser?.name || "",
    vendorUserEmail: job.vendorUserEmail || currentUser?.email || "",
    state: job.state || workOrder?.state || "",
    status: "Submitted",
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
  if (isCrewUser(user) && vendorRecord) {
    return state.companyProfiles?.vendors?.[vendorRecord.id] || null;
  }
  return state.companyProfiles?.ams || null;
}

function isAmsUser(user) {
  return AMS_ROLES.includes(user?.role) || user?.role === ROLES.OWNER;
}

function canViewExternalWorkOrder(user) {
  return !isCrewUser(user);
}

function canEditCrewIdentity(user) {
  return user?.role === ROLES.OWNER || user?.role === ROLES.AMS_ADMIN;
}

function getPortalPathForUser(user) {
  if (user?.role === ROLES.OWNER) return "/owner";
  if (AMS_ROLES.includes(user?.role)) return "/ams";
  if (isCrewUser(user)) return "/crew";
  return "/";
}

function getPortalEyebrow(user) {
  if (user?.role === ROLES.OWNER) return "SparkCommand Systems";
  if (AMS_ROLES.includes(user?.role))
    return `AMS Portal • Version ${APP_VERSION}`;
  if (isCrewUser(user)) return `Crew Portal • Version ${APP_VERSION}`;
  return `Version ${APP_VERSION}`;
}

function buildUserFromFirestoreProfile(profile, authUser, state) {
  const email = normalizeEmail(profile?.email || authUser?.email || "");
  const existingUser =
    (state.users || []).find((user) => normalizeEmail(user.email) === email) ||
    getAllUserPool(state).find(
      (user) => normalizeEmail(user.email) === email,
    ) ||
    null;
  const role = getFirestoreRole(profile?.role);
  const displayRole = profile?.displayRole || role;
  const name =
    profile?.name ||
    profile?.displayName ||
    [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") ||
    existingUser?.name ||
    authUser?.displayName ||
    email;

  return normalizeUser({
    ...(existingUser || {}),
    id:
      existingUser?.id ||
      profile?.id ||
      authUser?.uid ||
      createId("firebase-user"),
    name,
    email: profile?.email || email,
    password: existingUser?.password || "",
    role,
    displayRole,
    active: profile?.active ?? existingUser?.active ?? true,
    status: profile?.status || existingUser?.status || "active",
    accessStatus:
      profile?.accessStatus || existingUser?.accessStatus || "Active",
    authStatus: profile?.authStatus || "Active",
    phone: profile?.phone || existingUser?.phone || "",
    jobTitle:
      profile?.jobTitle ||
      profile?.title ||
      existingUser?.jobTitle ||
      displayRole,
    companyName:
      profile?.companyName ||
      profile?.company ||
      existingUser?.companyName ||
      (role === ROLES.VENDOR
        ? "Crew Company"
        : "Advanced Maintenance Services"),
    portal:
      profile?.portal || existingUser?.portal || getPortalPathForUser({ role }),
    defaultPortal:
      profile?.defaultPortal ||
      existingUser?.defaultPortal ||
      getPortalPathForUser({ role }),
    streetAddress: profile?.streetAddress || existingUser?.streetAddress || "",
    city: profile?.city || existingUser?.city || "",
    state: profile?.state || existingUser?.state || "",
    zip: profile?.zip || existingUser?.zip || "",
    internalNotes: existingUser?.internalNotes || "",
    firebaseUid: authUser?.uid || existingUser?.firebaseUid || "",
    firestoreUserId: profile?.id || existingUser?.firestoreUserId || "",
    createdAt: profile?.createdAt || existingUser?.createdAt || "",
    updatedAt: profile?.updatedAt || existingUser?.updatedAt || "",
  });
}

function userCanManageUser(actor, target) {
  if (!actor || !target) return false;
  if (actor.role === ROLES.OWNER) return true;
  if (actor.role !== ROLES.AMS_ADMIN) return false;
  return target.role !== ROLES.OWNER;
}

function getSiteNeedsActionCount({
  site,
  workOrders = [],
  jobs = [],
  invoices = [],
  proposals = [],
}) {
  if (!site) return 0;
  const siteWorkOrders = workOrders.filter(
    (workOrder) => workOrder.siteId === site.id,
  );
  const siteJobs = jobs.filter((job) => job.siteId === site.id);
  const siteJobIds = new Set(siteJobs.map((job) => job.id));

  const proposalActions = proposals.filter((proposal) => {
    const workOrder = workOrders.find(
      (entry) => entry.id === proposal.workOrderId,
    );
    return (
      workOrder?.siteId === site.id &&
      proposal.isActivePath &&
      ["submitted", "revision_requested"].includes(proposal.status)
    );
  }).length;
  const workOrderActions = siteWorkOrders.filter((workOrder) =>
    ["Needs Review", "Needs Attention", "Needs Vendor", "Open"].includes(
      workOrder.status,
    ),
  ).length;
  const invoiceActions = invoices.filter(
    (invoice) =>
      siteJobIds.has(invoice.jobId) &&
      ["Submitted", "Rejected"].includes(
        normalizeInvoiceStatus(invoice.status),
      ),
  ).length;

  return proposalActions + workOrderActions + invoiceActions;
}

function getBidCountForWorkOrder(proposals = [], workOrderId) {
  return new Set(
    proposals
      .filter(
        (proposal) =>
          proposal.workOrderId === workOrderId &&
          proposal.status !== "withdrawn",
      )
      .map((proposal) => proposal.vendorId),
  ).size;
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

function buildInvoiceDownloadMarkup(
  invoice,
  amsProfile,
  workOrder,
  currentUser,
) {
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
        </tr>`,
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
  return (
    <span className={`status-pill ${statusClassName(value)}`}>
      {label || value}
    </span>
  );
}

function WorkOrderStatusBadge({ workOrder }) {
  const displayStatus = getWorkOrderStatusDisplay(workOrder);
  return <StatusBadge value={displayStatus} label={displayStatus} />;
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
    withdrawn: "Withdrawn",
  };
  return <StatusBadge value={value} label={labels[value] || value} />;
}

function InvoiceStatusBadge({ value }) {
  return <StatusBadge value={value} label={value} />;
}

function SellControl({
  sellValue,
  costValue,
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
            <span className="detail-label">Cost</span>
            <p>{formatMoney(costValue)}</p>
          </div>
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
      <div className="pricing-reference-row">
        <span className="detail-label">Current Cost</span>
        <strong>{formatMoney(costValue)}</strong>
      </div>
      <InputRow>
        <Field label="Current Cost">
          <input value={formatMoney(costValue)} readOnly disabled />
        </Field>
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

function CostControl({
  costValue,
  editing,
  onStartEdit,
  onChange,
  onSave,
  disabled = false,
}) {
  if (!editing) {
    return (
      <div className="detail-card sell-lock-card">
        <div className="proposal-summary-grid">
          <div className="editable-money-row">
            <span className="detail-label">Cost</span>
            <div className="money-inline">
              <p>{formatMoney(costValue)}</p>
              {!disabled ? (
                <button
                  type="button"
                  className="icon-button inline-edit-button"
                  onClick={onStartEdit}
                  aria-label="Edit job cost"
                  title="Edit cost"
                >
                  ✎
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="detail-stack">
      <InputRow>
        <Field label="Crew Cost">
          <input
            value={costValue}
            onChange={(event) => onChange(event.target.value)}
            disabled={disabled}
            placeholder="Enter crew cost"
          />
        </Field>
      </InputRow>
      {!disabled ? (
        <div className="form-actions">
          <button className="secondary-button" onClick={onSave}>
            Save Cost
          </button>
        </div>
      ) : null}
    </div>
  );
}

function AppBuild03() {
  const [appState, setAppState] = useState(() =>
    normalizeStateData(loadAppState()),
  );
  const [showSplash, setShowSplash] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [authRestoring, setAuthRestoring] = useState(true);
  const [activeModal, setActiveModal] = useState(null);
  const [workOrderFilter, setWorkOrderFilter] = useState("All");
  const [jobFilter, setJobFilter] = useState("All");
  const [workOrderSearch, setWorkOrderSearch] = useState("");
  const [jobSearch, setJobSearch] = useState("");
  const [siteSearch, setSiteSearch] = useState("");
  const [crewSearch, setCrewSearch] = useState("");
  const [proposalSearch, setProposalSearch] = useState("");
  const [proposalStatusFilter, setProposalStatusFilter] = useState("All");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("All");
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState(null);
  const [selectedProposalId, setSelectedProposalId] = useState(null);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [selectedCrewId, setSelectedCrewId] = useState(null);
  const [selectedCrewSiteId, setSelectedCrewSiteId] = useState(null);
  const [selectedCrewOpportunityId, setSelectedCrewOpportunityId] =
    useState(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [selectedTeamMemberId, setSelectedTeamMemberId] = useState(null);
  const [reviewForm, setReviewForm] = useState({
    reviewedPrice: "",
    amsNotes: "",
  });
  const [proposalSaveNotice, setProposalSaveNotice] = useState(null);
  const [actionNotice, setActionNotice] = useState(null);
  const [showProfilePassword, setShowProfilePassword] = useState(false);
  const [profilePasswordError, setProfilePasswordError] = useState("");
  const [workOrdersLoading, setWorkOrdersLoading] = useState(false);
  const [workOrdersError, setWorkOrdersError] = useState("");
  const [workOrdersLoaded, setWorkOrdersLoaded] = useState(false);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState("");
  const [jobsLoaded, setJobsLoaded] = useState(false);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [vendorsError, setVendorsError] = useState("");
  const [vendorsLoaded, setVendorsLoaded] = useState(false);
  const [sitesLoading, setSitesLoading] = useState(false);
  const [sitesError, setSitesError] = useState("");
  const [sitesLoaded, setSitesLoaded] = useState(false);
  const [proposalsLoading, setProposalsLoading] = useState(false);
  const [proposalsError, setProposalsError] = useState("");
  const [proposalsLoaded, setProposalsLoaded] = useState(false);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoicesError, setInvoicesError] = useState("");
  const [invoicesLoaded, setInvoicesLoaded] = useState(false);
  const [siteImportRows, setSiteImportRows] = useState([]);
  const [siteImportError, setSiteImportError] = useState("");
  const [siteImportSummary, setSiteImportSummary] = useState("");
  const [siteImportFileName, setSiteImportFileName] = useState("");
  const [siteImportLoading, setSiteImportLoading] = useState(false);
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
    status: "Submitted",
    lineItems: [
      {
        id: "line-1",
        service: "",
        description: "",
        qty: "1",
        rate: "",
        amount: "",
      },
    ],
  });
  const [jobSellDrafts, setJobSellDrafts] = useState({});
  const [accountingSellForm, setAccountingSellForm] = useState("");
  const [accountingCostForm, setAccountingCostForm] = useState("");
  const [editingJobSellId, setEditingJobSellId] = useState(null);
  const [editingAccountingSellJobId, setEditingAccountingSellJobId] =
    useState(null);
  const [editingAccountingCostJobId, setEditingAccountingCostJobId] =
    useState(null);
  const [dataRefreshLoading, setDataRefreshLoading] = useState(false);
  const [sellSaveNotice, setSellSaveNotice] = useState(null);
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
    vendorCost: "",
    seasonStart: "",
    seasonEnd: "",
    seasonalServiceType: "",
    directVendorId: "",
    externalWorkOrderNumber: "",
    requireBeforeAfterPhotos: false,
  });
  const [jobCreateForm, setJobCreateForm] = useState({
    workOrderId: "",
    vendorId: "",
    price: "",
  });
  const [jobAssignment, setJobAssignment] = useState({});
  const [editingSiteId, setEditingSiteId] = useState(null);
  const [editingVendorId, setEditingVendorId] = useState(null);
  const [editingUserId, setEditingUserId] = useState(null);
  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
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
    const savedUser =
      getAllUserPool(appState).find((user) => user.id === currentUserId) ||
      null;
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
      }),
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
    appState.sites.find((site) => site.id === appState.ui.selectedSiteId) ||
    appState.sites[0] ||
    null;
  const currentCrewRecord = findCrewForUser(normalizedVendors, currentUser);
  const currentCompanyProfile = getCompanyProfileForRole(
    appState,
    currentUser,
    currentCrewRecord,
  );
  const selectedTeamMember =
    appState.users.find((user) => user.id === selectedTeamMemberId) || null;
  const nextWorkOrderNumber = getNextAmsWorkOrderNumber(
    appState.workOrders || [],
  );

  const refreshFirestoreData = async ({ silent = false } = {}) => {
    if (!currentUser?.firebaseUid) {
      if (!silent)
        showActionNotice(
          "error",
          "Sign in with Firebase before refreshing live data.",
        );
      return false;
    }

    setDataRefreshLoading(true);
    setWorkOrdersLoading(true);
    setJobsLoading(true);
    setVendorsLoading(true);
    setSitesLoading(true);
    setProposalsLoading(true);
    setInvoicesLoading(true);

    const [
      workOrdersResult,
      jobsResult,
      vendorsResult,
      sitesResult,
      proposalsResult,
      invoicesResult,
    ] = await Promise.all([
      loadFirestoreWorkOrders(),
      loadFirestoreJobs(),
      loadFirestoreVendors(),
      loadFirestoreSites(),
      loadFirestoreProposals(),
      loadFirestoreInvoices(),
    ]);

    setDataRefreshLoading(false);
    setWorkOrdersLoading(false);
    setJobsLoading(false);
    setVendorsLoading(false);
    setSitesLoading(false);
    setProposalsLoading(false);
    setInvoicesLoading(false);
    setWorkOrdersLoaded(true);
    setJobsLoaded(true);
    setVendorsLoaded(true);
    setSitesLoaded(true);
    setProposalsLoaded(true);
    setInvoicesLoaded(true);

    const errorMessages = [
      ["work orders", workOrdersResult.error, setWorkOrdersError],
      ["jobs", jobsResult.error, setJobsError],
      ["vendors", vendorsResult.error, setVendorsError],
      ["sites", sitesResult.error, setSitesError],
      ["proposals", proposalsResult.error, setProposalsError],
      ["invoices", invoicesResult.error, setInvoicesError],
    ].reduce((messages, [label, error, setError]) => {
      const message = error ? getFirebaseErrorMessage(error) : "";
      setError(message);
      return message ? [...messages, `${label}: ${message}`] : messages;
    }, []);

    updateAppState((current) => ({
      ...current,
      ...(workOrdersResult.error
        ? {}
        : { workOrders: workOrdersResult.workOrders }),
      ...(jobsResult.error ? {} : { jobs: jobsResult.jobs }),
      ...(vendorsResult.error ? {} : { vendors: vendorsResult.vendors }),
      ...(sitesResult.error ? {} : { sites: sitesResult.sites }),
      ...(proposalsResult.error
        ? {}
        : { proposals: proposalsResult.proposals }),
      ...(invoicesResult.error ? {} : { invoices: invoicesResult.invoices }),
    }));

    if (errorMessages.length) {
      showActionNotice(
        "error",
        `Refresh completed with errors: ${errorMessages.join("; ")}`,
      );
      return false;
    }

    if (!silent) showActionNotice("success", "Live Firestore data refreshed.");
    return true;
  };

  useEffect(() => {
    if (authRestoring) return;
    if (!currentUser) {
      setWorkOrdersLoaded(false);
      return;
    }
    if (!currentUser.firebaseUid) {
      setWorkOrdersLoading(false);
      setWorkOrdersError("");
      setWorkOrdersLoaded(true);
      return;
    }

    let canceled = false;
    setWorkOrdersLoading(true);
    setWorkOrdersError("");
    setWorkOrdersLoaded(false);

    loadFirestoreWorkOrders().then(({ workOrders, error }) => {
      if (canceled) return;
      setWorkOrdersLoading(false);
      setWorkOrdersLoaded(true);

      if (error) {
        setWorkOrdersError(getFirebaseErrorMessage(error));
        return;
      }

      setWorkOrdersError("");
      updateAppState((current) => ({
        ...current,
        workOrders,
      }));
    });

    return () => {
      canceled = true;
    };
  }, [authRestoring, currentUser?.firebaseUid]);

  useEffect(() => {
    if (authRestoring) return;
    if (!currentUser) {
      setJobsLoaded(false);
      return;
    }
    if (!currentUser.firebaseUid) {
      setJobsLoading(false);
      setJobsError("");
      setJobsLoaded(true);
      return;
    }

    let canceled = false;
    setJobsLoading(true);
    setJobsError("");
    setJobsLoaded(false);

    loadFirestoreJobs().then(({ jobs, error }) => {
      if (canceled) return;
      setJobsLoading(false);
      setJobsLoaded(true);

      if (error) {
        setJobsError(getFirebaseErrorMessage(error));
        return;
      }

      setJobsError("");
      updateAppState((current) => ({
        ...current,
        jobs,
      }));
    });

    return () => {
      canceled = true;
    };
  }, [authRestoring, currentUser?.firebaseUid]);

  useEffect(() => {
    if (authRestoring) return;
    if (!currentUser) {
      setVendorsLoaded(false);
      return;
    }
    if (!currentUser.firebaseUid) {
      setVendorsLoading(false);
      setVendorsError("");
      setVendorsLoaded(true);
      return;
    }

    let canceled = false;
    setVendorsLoading(true);
    setVendorsError("");
    setVendorsLoaded(false);

    loadFirestoreVendors().then(({ vendors, error }) => {
      if (canceled) return;
      setVendorsLoading(false);
      setVendorsLoaded(true);

      if (error) {
        setVendorsError(getFirebaseErrorMessage(error));
        return;
      }

      setVendorsError("");
      updateAppState((current) => ({
        ...current,
        vendors,
      }));
    });

    return () => {
      canceled = true;
    };
  }, [authRestoring, currentUser?.firebaseUid]);

  useEffect(() => {
    if (authRestoring) return;
    if (!currentUser) {
      setSitesLoaded(false);
      return;
    }
    if (!currentUser.firebaseUid) {
      setSitesLoading(false);
      setSitesError("");
      setSitesLoaded(true);
      return;
    }

    let canceled = false;
    setSitesLoading(true);
    setSitesError("");
    setSitesLoaded(false);

    loadFirestoreSites().then(({ sites, error }) => {
      if (canceled) return;
      setSitesLoading(false);
      setSitesLoaded(true);

      if (error) {
        setSitesError(getFirebaseErrorMessage(error));
        return;
      }

      setSitesError("");
      updateAppState((current) => ({
        ...current,
        sites,
      }));
    });

    return () => {
      canceled = true;
    };
  }, [authRestoring, currentUser?.firebaseUid]);

  useEffect(() => {
    if (authRestoring) return;
    if (!currentUser) {
      setProposalsLoaded(false);
      return;
    }
    if (!currentUser.firebaseUid) {
      setProposalsLoading(false);
      setProposalsError("");
      setProposalsLoaded(true);
      return;
    }

    let canceled = false;
    setProposalsLoading(true);
    setProposalsError("");
    setProposalsLoaded(false);

    loadFirestoreProposals().then(({ proposals, error }) => {
      if (canceled) return;
      setProposalsLoading(false);
      setProposalsLoaded(true);

      if (error) {
        setProposalsError(getFirebaseErrorMessage(error));
        return;
      }

      setProposalsError("");
      updateAppState((current) => ({
        ...current,
        proposals,
      }));
    });

    return () => {
      canceled = true;
    };
  }, [authRestoring, currentUser?.firebaseUid]);

  useEffect(() => {
    if (authRestoring) return;
    if (!currentUser) {
      setInvoicesLoaded(false);
      return;
    }
    if (!currentUser.firebaseUid) {
      setInvoicesLoading(false);
      setInvoicesError("");
      setInvoicesLoaded(true);
      return;
    }

    let canceled = false;
    setInvoicesLoading(true);
    setInvoicesError("");
    setInvoicesLoaded(false);

    loadFirestoreInvoices().then(({ invoices, error }) => {
      if (canceled) return;
      setInvoicesLoading(false);
      setInvoicesLoaded(true);

      if (error) {
        setInvoicesError(getFirebaseErrorMessage(error));
        return;
      }

      setInvoicesError("");
      updateAppState((current) => ({
        ...current,
        invoices,
      }));
    });

    return () => {
      canceled = true;
    };
  }, [authRestoring, currentUser?.firebaseUid]);

  const openScreen = (screen) => {
    if (!currentUser || screen === "logout") return;
    if (
      !DRAWER_MENUS[currentUser.role]?.includes(screen) &&
      screen !== "profile"
    )
      return;
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
    setActionNotice(null);
    setSellSaveNotice(null);
    setProposalSaveNotice(null);
    setLoginError("");
    setLoginLoading(false);
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
        vendorCost: "",
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
  const showActionNotice = (type, message) =>
    setActionNotice({ type, message });

  const selectWorkOrder = (workOrderId) => {
    if (!workOrderId) return;
    setSelectedWorkOrderId(workOrderId);
    setSelectedProposalId(null);
    setActionNotice(null);
    setSellSaveNotice(null);
    setProposalSaveNotice(null);
  };

  const completeFirebaseLogin = (firebaseUser) => {
    if (!firebaseUser) return false;

    updateAppState((current) => {
      const upsertedUsers = current.users.some(
        (user) =>
          user.id === firebaseUser.id ||
          normalizeEmail(user.email) === normalizeEmail(firebaseUser.email),
      )
        ? current.users.map((user) =>
            user.id === firebaseUser.id ||
            normalizeEmail(user.email) === normalizeEmail(firebaseUser.email)
              ? { ...user, ...firebaseUser, id: user.id }
              : user,
          )
        : [firebaseUser, ...current.users];
      const currentUserId =
        upsertedUsers.find(
          (user) =>
            normalizeEmail(user.email) === normalizeEmail(firebaseUser.email),
        )?.id || firebaseUser.id;

      return {
        ...current,
        users: upsertedUsers,
        ui: {
          ...current.ui,
          currentUserId,
          activeScreenByRole: {
            ...(current.ui?.activeScreenByRole || {}),
            [firebaseUser.role]:
              current.ui?.activeScreenByRole?.[firebaseUser.role] ||
              "dashboard",
          },
        },
      };
    });
    setLoginForm({ email: "", password: "" });
    return true;
  };

  const resolveFirebaseAppUser = async (authUser, stateSnapshot = appState) => {
    if (!authUser?.email) {
      return {
        user: null,
        error: new Error(
          "Authenticated Firebase user is missing an email address.",
        ),
      };
    }

    const ensuredProfile = await ensureFirestoreUserProfile(authUser);
    if (ensuredProfile.error) {
      return { user: null, error: ensuredProfile.error };
    }

    const profile = ensuredProfile.profile;
    if (!profile) {
      return {
        user: null,
        error: new Error(
          "Authenticated user was not found in the Firestore users collection.",
        ),
      };
    }

    const resolvedUser = buildUserFromFirestoreProfile(
      profile,
      authUser,
      stateSnapshot,
    );
    if (
      ![ROLES.AMS_ADMIN, ROLES.VENDOR, ROLES.OWNER, ROLES.AMS_MANAGER].includes(
        resolvedUser.role,
      )
    ) {
      return {
        user: null,
        error: new Error(
          "Your Firestore user role is not supported for this portal.",
        ),
      };
    }

    return { user: resolvedUser, error: null };
  };

  const handleLogin = async (email, password) => {
    setLoginError("");
    setLoginLoading(true);
    const firebaseResult = await signIn(email.trim(), password);
    if (!firebaseResult.user) {
      setLoginLoading(false);
      setLoginError(getFirebaseErrorMessage(firebaseResult.error));
      return false;
    }

    const resolvedUserResult = await resolveFirebaseAppUser(
      firebaseResult.user,
      appState,
    );
    if (resolvedUserResult.error) {
      await signOutUser();
      setLoginLoading(false);
      setLoginError(getFirebaseErrorMessage(resolvedUserResult.error));
      return false;
    }

    completeFirebaseLogin(resolvedUserResult.user);
    setLoginLoading(false);
    return true;
  };

  const handleDemoLogin = async (type) => {
    setLoginError("");
    const demoEmail =
      type === "ams" ? "amsdemo@amsdemo.local" : "crewdemo@amsdemo.local";
    const demoPassword = type === "ams" ? "DemoAMS123" : "DemoCrew123";
    const signedIn = await handleLogin(demoEmail, demoPassword);

    if (!signedIn) {
      const demoUser = createDemoSessionUser(type);
      completeFirebaseLogin(demoUser);
      setLoginError("");
      setLoginLoading(false);
      showActionNotice(
        "info",
        type === "ams"
          ? "AMS Demo started in local demo mode. Firestore operational data remains available only to authenticated Firebase users."
          : "Crew Demo started in local demo mode. Use a real Crew login linked to a Firestore vendor profile to view live available work.",
      );
    }
  };

  useEffect(() => {
    let active = true;
    const unsubscribe = subscribeToAuthState(async (firebaseUser) => {
      if (!active) return;

      if (!firebaseUser) {
        updateAppState((current) => ({
          ...current,
          ui: {
            ...current.ui,
            currentUserId: null,
          },
        }));
        setAuthRestoring(false);
        return;
      }

      const resolvedUserResult = await resolveFirebaseAppUser(
        firebaseUser,
        appState,
      );
      if (!active) return;

      if (resolvedUserResult.error) {
        await signOutUser();
        setLoginError(getFirebaseErrorMessage(resolvedUserResult.error));
        setAuthRestoring(false);
        return;
      }

      completeFirebaseLogin(resolvedUserResult.user);
      setAuthRestoring(false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

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
    if (loginError) setLoginError("");
    setLoginForm((current) => ({ ...current, [key]: value }));
  };

  const saveSite = async () => {
    if (
      !siteForm.name.trim() ||
      !siteForm.streetAddress.trim() ||
      !siteForm.city.trim() ||
      !siteForm.state.trim()
    ) {
      window.alert("Site name, street address, city, and state are required.");
      return;
    }

    const assignedVendor = normalizedVendors.find(
      (vendor) => vendor.id === siteForm.assignedVendorId,
    );
    const assignedCrewContact =
      appState.users.find(
        (user) =>
          user.id === siteForm.assignedCrewContactId && isCrewRole(user.role),
      ) || null;
    const siteRecord = {
      ...siteForm,
      state: siteForm.state.toUpperCase(),
      assignedVendorId: siteForm.assignedVendorId || "",
      assignedVendorName:
        assignedVendor?.companyName || assignedVendor?.name || "",
      assignedCrewContactId: siteForm.assignedCrewContactId || "",
      assignedCrewContactName: assignedCrewContact?.name || "",
      address: buildAddressLine(siteForm),
      siteMapStatus: "Upload Coming Soon",
      geoFenceStatus: "Geo Fence Setup Coming Soon",
      createdAt:
        appState.sites.find((site) => site.id === editingSiteId)?.createdAt ||
        new Date().toISOString(),
      createdBy: currentUser?.email || currentUser?.name || "",
    };

    try {
      let savedSite = editingSiteId
        ? { id: editingSiteId, ...siteRecord }
        : { id: createId("site"), ...siteRecord };

      if (currentUser?.firebaseUid) {
        const result = editingSiteId
          ? await updateFirestoreSite(
              appState.sites.find((site) => site.id === editingSiteId)
                ?.firestoreId || editingSiteId,
              siteRecord,
            )
          : await createFirestoreSite(siteRecord);
        if (result.error) throw result.error;
        if (!result.site?.id)
          throw new Error("Site save did not return a Firestore ID.");
        savedSite = result.site;
      }

      updateAppState((current) => ({
        ...current,
        sites: editingSiteId
          ? current.sites.map((site) =>
              site.id === editingSiteId ? { ...site, ...savedSite } : site,
            )
          : [
              savedSite,
              ...current.sites.filter((site) => site.id !== savedSite.id),
            ],
      }));

      setSelectedSite(savedSite.id);
      showActionNotice(
        "success",
        editingSiteId ? "Site updated." : "Site created in Firestore.",
      );
    } catch (error) {
      showActionNotice(
        "error",
        `Site was not saved: ${getFirebaseErrorMessage(error)}`,
      );
      return;
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

  const removeSite = async (siteId) => {
    const targetSite = appState.sites.find((site) => site.id === siteId);
    if (!targetSite) return;
    const confirmed = window.confirm(
      `Remove ${targetSite.name || "this site"}? Existing work orders and jobs will remain in Firestore history.`,
    );
    if (!confirmed) return;

    if (currentUser?.firebaseUid) {
      const result = await deleteFirestoreSite(
        targetSite.firestoreId || targetSite.id,
      );
      if (result.error) {
        showActionNotice(
          "error",
          `Site was not removed: ${getFirebaseErrorMessage(result.error)}`,
        );
        return;
      }
    }

    updateAppState((current) => ({
      ...current,
      sites: current.sites.filter((site) => site.id !== siteId),
      ui: {
        ...current.ui,
        selectedSiteId:
          current.ui.selectedSiteId === siteId
            ? current.sites.find((site) => site.id !== siteId)?.id || null
            : current.ui.selectedSiteId,
      },
    }));
    showActionNotice("success", `${targetSite.name || "Site"} removed.`);
  };

  const resetSiteImport = () => {
    setSiteImportRows([]);
    setSiteImportError("");
    setSiteImportSummary("");
    setSiteImportFileName("");
    setSiteImportLoading(false);
  };

  const openSiteImport = () => {
    resetSiteImport();
    setActiveModal("siteImport");
  };

  const handleSiteImportFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    resetSiteImport();
    if (!file) return;

    setSiteImportFileName(file.name);
    setSiteImportLoading(true);

    try {
      const result = await parseSiteImportFile(file);
      if (result.error) {
        setSiteImportError(result.error);
        setSiteImportRows([]);
        return;
      }

      const existingSiteNumbers = new Set(
        appState.sites
          .map((site) =>
            String(site.siteNumber || "")
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      );

      const rows = result.rows.map((row) => {
        const siteNumber = String(row.site.siteNumber || "")
          .trim()
          .toLowerCase();
        if (!siteNumber || !existingSiteNumbers.has(siteNumber)) return row;
        const errors = [
          ...row.errors,
          "siteNumber already exists in Firestore",
        ];
        return { ...row, valid: false, errors };
      });

      setSiteImportRows(rows);
      setSiteImportSummary(
        `${rows.filter((row) => row.valid).length} valid row(s), ${rows.filter((row) => !row.valid).length} row(s) need attention.`,
      );
    } catch (error) {
      setSiteImportError(error?.message || "Site upload could not be parsed.");
      setSiteImportRows([]);
    } finally {
      setSiteImportLoading(false);
    }
  };

  const confirmSiteImport = async () => {
    if (!currentUser?.firebaseUid) {
      setSiteImportError(
        "Site imports require a Firebase-authenticated AMS session.",
      );
      return;
    }

    const invalidRows = siteImportRows.filter((row) => !row.valid);
    if (invalidRows.length) {
      setSiteImportError("Fix invalid rows before importing sites.");
      return;
    }

    const validRows = siteImportRows.filter((row) => row.valid);
    if (!validRows.length) {
      setSiteImportError(
        "Upload and preview valid site rows before importing.",
      );
      return;
    }

    setSiteImportLoading(true);
    setSiteImportError("");

    const createdAt = new Date().toISOString();
    const sitesToCreate = validRows.map(({ site }) => ({
      name: site.name,
      client: site.client,
      streetAddress: site.address,
      address: site.address,
      city: site.city,
      state: site.state,
      zip: site.zip,
      status: site.status,
      siteNumber: site.siteNumber,
      serviceTypes: site.serviceTypes,
      notes: site.notes,
      internalNotes: site.notes,
      contactName: site.contactName,
      contact: site.contactName,
      contactPhone: site.contactPhone,
      contactEmail: site.contactEmail,
      siteMapStatus: "Upload Coming Soon",
      geoFenceStatus: "Geo Fence Setup Coming Soon",
      createdAt,
      createdBy: currentUser.email || currentUser.name || "",
    }));

    const result = await createFirestoreSitesBatch(sitesToCreate);
    setSiteImportLoading(false);

    if (result.error) {
      setSiteImportError(
        `Site import failed: ${getFirebaseErrorMessage(result.error)}`,
      );
      setSiteImportSummary(`0 imported, ${validRows.length} failed.`);
      return;
    }

    updateAppState((current) => ({
      ...current,
      sites: [
        ...result.sites,
        ...current.sites.filter(
          (site) => !result.sites.some((created) => created.id === site.id),
        ),
      ],
    }));

    if (result.sites[0]?.id) setSelectedSite(result.sites[0].id);
    setSiteImportRows([]);
    setSiteImportSummary(`${result.sites.length} imported, 0 failed.`);
    showActionNotice(
      "success",
      `${result.sites.length} site${result.sites.length === 1 ? "" : "s"} imported.`,
    );
  };

  const saveVendor = async () => {
    if (
      !vendorForm.companyName.trim() ||
      !vendorForm.email.trim() ||
      !vendorForm.serviceType
    ) {
      window.alert(
        "Company name, email, and primary service type are required.",
      );
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
    const existingVendor = normalizedVendors.find(
      (vendor) => vendor.id === editingVendorId,
    );
    const existingCrewUser =
      appState.users.find((user) => user.id === existingVendor?.userId) || null;
    const password =
      vendorForm.password || existingCrewUser?.password || "Crew123";

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
      userEmail: vendorForm.email.trim(),
      serviceType: vendorForm.serviceType,
      serviceTypes: parsedServiceTypes.length
        ? parsedServiceTypes
        : [vendorForm.serviceType],
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

    try {
      let savedVendor = editingVendorId
        ? {
            ...existingVendor,
            ...vendorRecord,
            id: editingVendorId,
            active: existingVendor?.active ?? true,
          }
        : { id: createId("vendor"), active: true, ...vendorRecord };

      if (currentUser?.firebaseUid) {
        const result = editingVendorId
          ? await updateFirestoreVendor(
              existingVendor?.firestoreId || editingVendorId,
              {
                ...vendorRecord,
                active: existingVendor?.active ?? true,
                status:
                  existingVendor?.active === false ? "inactive" : "active",
              },
            )
          : await createFirestoreVendor({
              ...vendorRecord,
              active: true,
              status: "active",
            });
        if (result.error) throw result.error;
        if (!result.vendor?.id)
          throw new Error("Vendor save did not return a Firestore ID.");
        savedVendor = result.vendor;
      }

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
            users: users.map((user) =>
              user.id === vendorUserId ? { ...user, ...linkedUser } : user,
            ),
          };
        }

        return {
          userId: nextUserId,
          users: [{ ...linkedUser }, ...users],
        };
      };

      updateAppState((current) => {
        const linkedUserUpdate = currentUser?.firebaseUid
          ? { userId: existingVendor?.userId || "", users: current.users }
          : upsertCrewUser(current.users, existingVendor?.userId);
        const nextVendorId = savedVendor.id;
        return {
          ...current,
          users: linkedUserUpdate.users,
          vendors: editingVendorId
            ? current.vendors.map((vendor) =>
                vendor.id === editingVendorId
                  ? {
                      ...vendor,
                      ...savedVendor,
                      userId:
                        linkedUserUpdate.userId || savedVendor.userId || "",
                    }
                  : vendor,
              )
            : [
                {
                  ...savedVendor,
                  userId: linkedUserUpdate.userId || savedVendor.userId || "",
                },
                ...current.vendors,
              ],
          companyProfiles: {
            ...(current.companyProfiles || {}),
            vendors: {
              ...(current.companyProfiles?.vendors || {}),
              [nextVendorId]: {
                ...(current.companyProfiles?.vendors?.[nextVendorId] || {}),
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
      showActionNotice(
        "success",
        editingVendorId ? "Vendor updated." : "Vendor created in Firestore.",
      );
    } catch (error) {
      showActionNotice(
        "error",
        `Vendor was not saved: ${getFirebaseErrorMessage(error)}`,
      );
      return;
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
    setVendorForm({
      companyName: normalizedVendor.companyName || "",
      streetAddress: normalizedVendor.streetAddress || "",
      city: normalizedVendor.city || "",
      state: normalizedVendor.state || "",
      zip: normalizedVendor.zip || "",
      contactName: normalizedVendor.contactName || "",
      phone: normalizedVendor.phone || "",
      email: normalizedVendor.email || "",
      password: "",
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
        vendor.id === vendorId ? { ...vendor, active: !vendor.active } : vendor,
      ),
    }));
  };

  const removeVendor = async (vendorId) => {
    const targetVendor = normalizedVendors.find(
      (vendor) => vendor.id === vendorId,
    );
    if (!targetVendor) return;
    const relatedJobs = appState.jobs.filter(
      (job) => job.vendorId === vendorId || job.assignedVendorId === vendorId,
    );
    const confirmed = window.confirm(
      `Remove ${targetVendor.companyName || targetVendor.name || "this vendor"}? ${relatedJobs.length ? "Existing job history will remain linked by vendor ID." : "This removes the vendor record."}`,
    );
    if (!confirmed) return;

    if (currentUser?.firebaseUid) {
      const result = await deleteFirestoreVendor(
        targetVendor.firestoreId || targetVendor.id,
      );
      if (result.error) {
        showActionNotice(
          "error",
          `Vendor was not removed: ${getFirebaseErrorMessage(result.error)}`,
        );
        return;
      }
    }

    updateAppState((current) => {
      const nextCompanyProfiles = {
        ...(current.companyProfiles?.vendors || {}),
      };
      delete nextCompanyProfiles[vendorId];
      return {
        ...current,
        vendors: current.vendors.filter((vendor) => vendor.id !== vendorId),
        companyProfiles: {
          ...(current.companyProfiles || {}),
          vendors: nextCompanyProfiles,
        },
      };
    });
    setSelectedCrewId((current) => (current === vendorId ? null : current));
    showActionNotice(
      "success",
      `${targetVendor.companyName || targetVendor.name || "Vendor"} removed.`,
    );
  };

  const saveUser = () => {
    if (
      !userForm.name.trim() ||
      !userForm.email.trim() ||
      !userForm.password.trim()
    ) {
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
          user.id === editingUserId ? { ...user, ...userRecord } : user,
        ),
      }));
    } else {
      updateAppState((current) => ({
        ...current,
        users: [
          { id: nextUserId, active: true, ...userRecord },
          ...current.users,
        ],
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
          : user,
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
          : user,
      ),
    }));
  };

  const deleteUser = (userId) => {
    const targetUser = appState.users.find((user) => user.id === userId);
    if (!userCanManageUser(currentUser, targetUser)) return;
    const confirmed = window.confirm(
      `Delete ${targetUser?.name || "this user"}? This will remove the local operational record and should only be used when you are sure.`,
    );
    if (!confirmed) return;

    updateAppState((current) => ({
      ...current,
      users: current.users.filter((user) => user.id !== userId),
      ui: {
        ...current.ui,
        currentUserId:
          current.ui?.currentUserId === userId
            ? null
            : current.ui?.currentUserId || null,
      },
    }));
  };
  const createWorkOrder = async () => {
    if (!workOrderForm.siteId || !workOrderForm.description.trim()) {
      window.alert("Site and description are required.");
      return;
    }
    if (
      workOrderForm.workType === "recurring" &&
      !workOrderForm.recurringFrequency
    ) {
      window.alert(
        "Select a recurring frequency before creating this work order.",
      );
      return;
    }
    if (
      workOrderForm.workType === "seasonal" &&
      (!workOrderForm.seasonStart ||
        !workOrderForm.seasonEnd ||
        !workOrderForm.seasonalServiceType)
    ) {
      window.alert(
        "Seasonal work orders need a season start, season end, and service type.",
      );
      return;
    }

    const site = appState.sites.find(
      (entry) => entry.id === workOrderForm.siteId,
    );
    if (!site) {
      window.alert("Selected site was not found.");
      return;
    }

    const directVendor =
      workOrderForm.workflowType === "direct" && workOrderForm.directVendorId
        ? normalizedVendors.find(
            (vendor) => vendor.id === workOrderForm.directVendorId,
          )
        : null;

    if (
      workOrderForm.workflowType === "direct" &&
      workOrderForm.directVendorId &&
      !directVendor
    ) {
      window.alert("Selected crew was not found.");
      return;
    }

    const createdAt = new Date().toISOString();
    const proposalRequired = workOrderForm.workflowType === "proposal";
    const workType = workOrderForm.workType || "one_time";
    const directVendorCost = String(workOrderForm.vendorCost || "").trim();
    const serviceType =
      normalizeServiceType(workOrderForm.serviceType) || "General Maintenance";
    const record = {
      id: createId("wo"),
      title: `${serviceType} - ${site.name}`,
      amsWorkOrderNumber: nextWorkOrderNumber,
      externalWorkOrderNumber: workOrderForm.externalWorkOrderNumber.trim(),
      siteId: site.id,
      siteName: site.name,
      state: site.state || "",
      priority: "Normal",
      description: workOrderForm.description.trim(),
      serviceType,
      status: directVendor
        ? "Assigned"
        : proposalRequired
          ? "Open"
          : "Needs Review",
      proposalRequired,
      proposalState: proposalRequired ? "opportunity" : "none",
      proposalRequestedAt: proposalRequired ? createdAt : "",
      proposalAwardedAt: "",
      assignedVendorId: directVendor?.id || "",
      assignedVendorName: directVendor
        ? directVendor.companyName || directVendor.name
        : "",
      jobId: "",
      requireBeforeAfterPhotos: Boolean(workOrderForm.requireBeforeAfterPhotos),
      workType,
      recurringFrequency:
        workType === "recurring" ? workOrderForm.recurringFrequency : "",
      recurringVendorCost:
        workType === "recurring"
          ? String(workOrderForm.recurringVendorCost || "").trim()
          : "",
      vendorCost: directVendorCost,
      recurringPricingNotes:
        workType === "recurring"
          ? String(workOrderForm.recurringPricingNotes || "").trim()
          : "",
      seasonStart: workType === "seasonal" ? workOrderForm.seasonStart : "",
      seasonEnd: workType === "seasonal" ? workOrderForm.seasonEnd : "",
      seasonalServiceType:
        workType === "seasonal"
          ? normalizeServiceType(workOrderForm.seasonalServiceType)
          : "",
      createdAt,
      createdBy: currentUser?.email || currentUser?.name || "",
    };

    try {
      let savedWorkOrder = record;
      let createdJob = null;

      if (currentUser?.firebaseUid) {
        const workOrderResult = await createFirestoreWorkOrder(record);
        if (workOrderResult.error) throw workOrderResult.error;
        if (!workOrderResult.workOrder?.id)
          throw new Error("Work order creation did not return a Firestore ID.");
        savedWorkOrder = {
          ...workOrderResult.workOrder,
          proposalState: proposalRequired ? "opportunity" : "none",
        };

        if (directVendor) {
          const jobResult = await createOrLinkFirestoreJobForWorkOrder({
            workOrder: savedWorkOrder,
            vendor: directVendor,
            price: directVendorCost,
            sell: savedWorkOrder.sell || savedWorkOrder.sellPrice || "",
            createdBy: currentUser.email || currentUser.name || "",
          });
          if (jobResult.error) throw jobResult.error;
          createdJob = jobResult.job;
          savedWorkOrder = {
            ...savedWorkOrder,
            jobId: jobResult.jobId || createdJob?.id || "",
          };
        }
      } else if (directVendor) {
        createdJob = buildJobRecord({
          workOrder: record,
          vendor: directVendor,
          price: directVendorCost,
          currentUser,
        });
        savedWorkOrder = { ...record, jobId: createdJob.id };
      }

      updateAppState((current) => ({
        ...current,
        workOrders: [
          savedWorkOrder,
          ...current.workOrders.filter(
            (workOrder) => workOrder.id !== savedWorkOrder.id,
          ),
        ],
        jobs: createdJob
          ? current.jobs.some((job) => job.id === createdJob.id)
            ? current.jobs.map((job) =>
                job.id === createdJob.id ? { ...job, ...createdJob } : job,
              )
            : [
                createdJob,
                ...current.jobs.filter(
                  (job) => job.workOrderId !== savedWorkOrder.id,
                ),
              ]
          : current.jobs,
      }));

      setSelectedWorkOrderId(savedWorkOrder.id);
      if (createdJob?.id) setSelectedJobId(createdJob.id);
      setWorkOrderForm({
        siteId: selectedSite?.id || "",
        description: "",
        serviceType: "",
        workflowType: "direct",
        workType: "one_time",
        recurringFrequency: "",
        vendorCost: "",
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
      showActionNotice(
        "success",
        directVendor
          ? "Work order created and job assigned."
          : "Work order created.",
      );
    } catch (error) {
      showActionNotice(
        "error",
        `Work order was not created: ${getFirebaseErrorMessage(error)}`,
      );
    }
  };

  const saveWorkOrderDetail = () => {
    const targetWorkOrderId = selectedWorkOrder?.id;
    if (!targetWorkOrderId) {
      showActionNotice("error", "Select a work order before saving details.");
      return;
    }
    updateAppState((current) => ({
      ...current,
      workOrders: current.workOrders.map((workOrder) =>
        workOrder.id === targetWorkOrderId
          ? {
              ...workOrder,
              externalWorkOrderNumber:
                workOrderDetailForm.externalWorkOrderNumber,
              requireBeforeAfterPhotos:
                workOrderDetailForm.requireBeforeAfterPhotos,
              recurringVendorCost:
                workOrder.workType === "recurring"
                  ? String(workOrderDetailForm.recurringVendorCost || "").trim()
                  : (workOrder.recurringVendorCost ?? ""),
              recurringPricingNotes:
                workOrder.workType === "recurring"
                  ? String(
                      workOrderDetailForm.recurringPricingNotes || "",
                    ).trim()
                  : workOrder.recurringPricingNotes || "",
            }
          : workOrder,
      ),
    }));
    showActionNotice("success", "Work order details saved.");
  };

  const assignVendorToWorkOrder = async (workOrderId) => {
    const workOrder = appState.workOrders.find(
      (entry) => entry.id === workOrderId,
    );
    const vendorId =
      jobAssignment[workOrderId] || workOrder?.assignedVendorId || "";
    if (!vendorId) {
      window.alert("Choose a crew before assigning a job.");
      return;
    }

    const vendor = normalizedVendors.find((entry) => entry.id === vendorId);
    if (!workOrder || !vendor) return;

    if (workOrder.proposalRequired) {
      window.alert(
        "Proposal work orders must be awarded through proposal review.",
      );
      return;
    }

    try {
      let newJob =
        appState.jobs.find((job) => job.workOrderId === workOrderId) || null;
      let jobAlreadyExisted = Boolean(newJob);

      if (currentUser?.firebaseUid) {
        const result = await createOrLinkFirestoreJobForWorkOrder({
          workOrder,
          vendor,
          price: workOrder.vendorCost || workOrder.recurringVendorCost || "",
          sell: workOrder.sell || workOrder.sellPrice || "",
          createdBy: currentUser.email || currentUser.name || "",
        });
        if (result.error) throw result.error;
        newJob = result.job;
        jobAlreadyExisted = Boolean(result.jobAlreadyExisted);
      } else if (!newJob) {
        newJob = buildJobRecord({
          workOrder,
          vendor,
          price: workOrder.vendorCost || workOrder.recurringVendorCost || "",
          currentUser,
        });
      }

      if (!newJob?.id) throw new Error("Job creation did not return a job ID.");

      updateAppState((current) => ({
        ...current,
        jobs: current.jobs.some((job) => job.id === newJob.id)
          ? current.jobs.map((job) =>
              job.id === newJob.id ? { ...job, ...newJob } : job,
            )
          : [
              newJob,
              ...current.jobs.filter((job) => job.workOrderId !== workOrderId),
            ],
        workOrders: current.workOrders.map((entry) =>
          entry.id === workOrderId
            ? {
                ...entry,
                status: "Assigned",
                assignedVendorId: vendor.id,
                assignedVendorName: vendor.companyName || vendor.name,
                jobId: newJob.id,
                proposalRequired: false,
              }
            : entry,
        ),
      }));
      setSelectedJobId(newJob.id);
      showActionNotice(
        "success",
        jobAlreadyExisted
          ? "Existing job linked to this work order."
          : "Job created and assigned.",
      );
    } catch (error) {
      showActionNotice(
        "error",
        `Job was not created: ${getFirebaseErrorMessage(error)}`,
      );
    }
  };

  const createManualJob = async () => {
    const workOrder = appState.workOrders.find(
      (entry) => entry.id === jobCreateForm.workOrderId,
    );
    const vendorId =
      jobCreateForm.vendorId || workOrder?.assignedVendorId || "";
    const vendor = normalizedVendors.find((entry) => entry.id === vendorId);
    if (!workOrder || !vendor) {
      window.alert("Choose a work order and crew.");
      return;
    }

    try {
      let newJob =
        appState.jobs.find((job) => job.workOrderId === workOrder.id) || null;
      let jobAlreadyExisted = Boolean(newJob);

      if (currentUser?.firebaseUid) {
        const result = await createOrLinkFirestoreJobForWorkOrder({
          workOrder,
          vendor,
          price: jobCreateForm.price,
          sell: workOrder.sell || workOrder.sellPrice || "",
          createdBy: currentUser.email || currentUser.name || "",
        });
        if (result.error) throw result.error;
        newJob = result.job;
        jobAlreadyExisted = Boolean(result.jobAlreadyExisted);
      } else if (!newJob) {
        newJob = buildJobRecord({
          workOrder,
          vendor,
          price: jobCreateForm.price,
          currentUser,
        });
      }

      if (!newJob?.id) throw new Error("Job creation did not return a job ID.");

      updateAppState((current) => ({
        ...current,
        jobs: current.jobs.some((job) => job.id === newJob.id)
          ? current.jobs.map((job) =>
              job.id === newJob.id ? { ...job, ...newJob } : job,
            )
          : [
              newJob,
              ...current.jobs.filter((job) => job.workOrderId !== workOrder.id),
            ],
        workOrders: current.workOrders.map((entry) =>
          entry.id === workOrder.id
            ? {
                ...entry,
                status: "Assigned",
                assignedVendorId: vendor.id,
                assignedVendorName: vendor.companyName || vendor.name,
                jobId: newJob.id,
              }
            : entry,
        ),
      }));
      setSelectedJobId(newJob.id);
      showActionNotice(
        "success",
        jobAlreadyExisted
          ? "Existing job linked to this work order."
          : "Job created and assigned.",
      );
      closeModal();
    } catch (error) {
      showActionNotice(
        "error",
        `Job was not created: ${getFirebaseErrorMessage(error)}`,
      );
    }
  };

  const updateInvoiceLineItem = (lineItemId, key, value) => {
    setInvoiceForm((current) => {
      const lineItems = current.lineItems.map((lineItem) => {
        if (lineItem.id !== lineItemId) return lineItem;
        const updated = { ...lineItem, [key]: value };
        if (key === "qty" || key === "rate") {
          updated.amount = (
            toNumber(updated.qty) * toNumber(updated.rate)
          ).toFixed(2);
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
        {
          id: createId("line"),
          service: "",
          description: "",
          qty: "1",
          rate: "",
          amount: "",
        },
      ],
    }));
  };

  const removeInvoiceLineItem = (lineItemId) => {
    const confirmed = window.confirm("Remove this invoice line item?");
    if (!confirmed) return;
    setInvoiceForm((current) => {
      const lineItems = current.lineItems.filter(
        (lineItem) => lineItem.id !== lineItemId,
      );
      const total = calculateInvoiceTotal(lineItems);
      return {
        ...current,
        lineItems,
        amount: total,
        total,
      };
    });
  };

  const saveProfile = async () => {
    if (!currentUser) {
      showActionNotice(
        "error",
        "Profile could not be saved because no user is active.",
      );
      return;
    }
    const requestedPassword = profileForm.password.trim();
    const confirmedPassword = profileForm.confirmPassword.trim();
    setProfilePasswordError("");
    if (requestedPassword || confirmedPassword) {
      if (requestedPassword !== confirmedPassword) {
        const message = "New password and confirm password must match.";
        setProfilePasswordError(message);
        showActionNotice("error", message);
        return;
      }
      if (!currentUser.firebaseUid) {
        showActionNotice(
          "error",
          "Password changes are only available for Firebase-authenticated users.",
        );
        return;
      }
      const passwordResult = await updateCurrentUserPassword(requestedPassword);
      if (passwordResult.error) {
        showActionNotice(
          "error",
          `Password was not updated: ${getFirebaseErrorMessage(passwordResult.error)}`,
        );
        return;
      }
    }
    updateAppState((current) => {
      const nextUsers = current.users.map((user) =>
        user.id === currentUser.id
          ? {
              ...user,
              name: profileForm.name.trim(),
              email: isCrewUser(currentUser)
                ? user.email
                : profileForm.email.trim(),
              phone: profileForm.phone.trim(),
              jobTitle: profileForm.jobTitle.trim(),
              companyName: isCrewUser(currentUser)
                ? user.companyName
                : profileForm.companyName.trim(),
              streetAddress: profileForm.streetAddress.trim(),
              city: profileForm.city.trim(),
              state: profileForm.state.trim().toUpperCase(),
              zip: profileForm.zip.trim(),
              internalNotes: profileForm.internalNotes.trim(),
              profilePhotoStatus:
                profileForm.profilePhotoStatus || "Photo Upload Coming Soon",
              address: buildAddressLine({
                streetAddress: profileForm.streetAddress.trim(),
                city: profileForm.city.trim(),
                state: profileForm.state.trim().toUpperCase(),
                zip: profileForm.zip.trim(),
              }),
            }
          : user,
      );

      if (isCrewUser(currentUser) && currentCrewRecord) {
        return {
          ...current,
          users: nextUsers,
          vendors: current.vendors.map((vendor) =>
            vendor.id === currentCrewRecord.id
              ? {
                  ...vendor,
                  contactName: profileForm.name.trim(),
                  phone: profileForm.phone.trim(),
                }
              : vendor,
          ),
          companyProfiles: {
            ...(current.companyProfiles || {}),
            vendors: {
              ...(current.companyProfiles?.vendors || {}),
              [currentCrewRecord.id]: {
                ...(current.companyProfiles?.vendors?.[currentCrewRecord.id] ||
                  {}),
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
    setProfileForm((current) => ({
      ...current,
      password: "",
      confirmPassword: "",
    }));
    showActionNotice(
      "success",
      requestedPassword
        ? "Profile saved and Firebase password updated."
        : "Profile changes saved.",
    );
  };

  const saveCompanyProfile = () => {
    if (!currentUser) {
      showActionNotice(
        "error",
        "Company profile could not be saved because no user is active.",
      );
      return;
    }
    updateAppState((current) => {
      if (isCrewUser(currentUser) && currentCrewRecord) {
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
              : vendor,
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
    showActionNotice("success", "Company profile saved.");
  };

  const downloadInvoice = (invoice) => {
    if (!invoice) return;
    const linkedWorkOrder =
      appState.workOrders.find(
        (workOrder) => workOrder.id === invoice.workOrderId,
      ) || null;
    const markup = buildInvoiceDownloadMarkup(
      invoice,
      appState.companyProfiles?.ams,
      linkedWorkOrder,
      currentUser,
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
    const targetWorkOrder = appState.workOrders.find(
      (workOrder) => workOrder.id === workOrderId,
    );
    if (!targetWorkOrder) {
      showActionNotice(
        "error",
        "Work order status was not updated because the record was not found.",
      );
      return;
    }
    updateAppState((current) => ({
      ...current,
      workOrders: current.workOrders.map((workOrder) =>
        workOrder.id === workOrderId ? { ...workOrder, status } : workOrder,
      ),
    }));
    showActionNotice(
      "success",
      `${targetWorkOrder.amsWorkOrderNumber || "Work order"} updated to ${status}.`,
    );
  };

  const canTransitionJobStatus = (currentStatus, nextStatus) => {
    if (currentStatus === nextStatus) return true;
    const allowedTransitions = {
      Assigned: ["In Progress"],
      "In Progress": ["Completed"],
      Completed: ["Invoiced"],
      Invoiced: ["Closed"],
      Closed: [],
      Canceled: [],
    };
    return (allowedTransitions[currentStatus] || []).includes(nextStatus);
  };

  const getInvalidJobTransitionMessage = (currentStatus, nextStatus) => {
    if (currentStatus === "Completed" && nextStatus === "In Progress") {
      return "Completed jobs cannot be restarted. Submit an invoice or continue accounting review.";
    }
    if (currentStatus === "Completed") {
      return "Completed jobs can only move forward to invoicing.";
    }
    if (currentStatus === "Assigned") {
      return "Assigned jobs must be started before they can be completed.";
    }
    if (currentStatus === "Invoiced") {
      return "Invoiced jobs can only move forward to Closed.";
    }
    if (currentStatus === "Closed" || currentStatus === "Canceled") {
      return `${currentStatus} jobs cannot be moved through the normal lifecycle.`;
    }
    return `Cannot move job from ${currentStatus || "Unknown"} to ${nextStatus}.`;
  };

  const buildJobLifecycleUpdate = (job, status) => {
    const timestamp = new Date().toISOString();
    const nextStartedAt =
      status === "In Progress"
        ? job.startedAt || job.startTime || timestamp
        : job.startedAt || job.startTime || "";
    const nextStartTime =
      status === "In Progress"
        ? job.startTime || job.startedAt || timestamp
        : job.startTime || job.startedAt || "";
    const nextCompletedTime =
      status === "Completed"
        ? job.completedTime || timestamp
        : job.completedTime || "";

    return {
      status,
      startedAt: nextStartedAt,
      startTime: nextStartTime,
      completedTime: nextCompletedTime,
      completedAt: nextCompletedTime,
      serviceDate: job.serviceDate || nextCompletedTime || nextStartTime || "",
      servicePerformed: job.servicePerformed || job.serviceType,
      scope: job.scope || job.description || "",
      notes: job.notes || "",
    };
  };

  const updateJobStatus = async (jobId, status) => {
    const targetJob = appState.jobs.find((job) => job.id === jobId);
    if (!targetJob) {
      showActionNotice(
        "error",
        "Job status was not updated because the record was not found.",
      );
      return;
    }
    if (!canTransitionJobStatus(targetJob.status, status)) {
      showActionNotice(
        "error",
        getInvalidJobTransitionMessage(targetJob.status, status),
      );
      return;
    }

    const jobUpdates = buildJobLifecycleUpdate(targetJob, status);
    if (currentUser?.firebaseUid) {
      const result = await updateFirestoreJob(
        targetJob.firestoreId || targetJob.id,
        jobUpdates,
      );
      if (result.error) {
        showActionNotice(
          "error",
          `Job status was not saved: ${getFirebaseErrorMessage(result.error)}`,
        );
        return;
      }
    }

    updateAppState((current) => ({
      ...current,
      jobs: current.jobs.map((job) => {
        if (job.id !== jobId) return job;
        return {
          ...job,
          ...jobUpdates,
        };
      }),
      workOrders: current.workOrders.map((workOrder) => {
        const linkedJob = current.jobs.find((job) => job.id === jobId);
        if (!linkedJob || workOrder.id !== linkedJob.workOrderId)
          return workOrder;
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
    showActionNotice(
      "success",
      `${targetJob.siteName || "Job"} updated to ${status}.`,
    );
  };

  const cancelJobForWorkOrder = async (workOrder, job) => {
    if (!workOrder || !job) return;
    if (
      job.startTime ||
      ["In Progress", "Completed", "Canceled"].includes(job.status)
    )
      return;
    const confirmed = window.confirm(
      "Are you sure you want to cancel the job?\nHave you contacted the vendor?",
    );
    if (!confirmed) return;

    const canceledAt = new Date().toISOString();
    const jobUpdates = { status: "Canceled", canceledAt };
    const workOrderUpdates = { status: "Canceled", canceledAt };

    if (currentUser?.firebaseUid) {
      const jobResult = await updateFirestoreJob(
        job.firestoreId || job.id,
        jobUpdates,
      );
      if (jobResult.error) {
        showActionNotice(
          "error",
          `Job was not canceled: ${getFirebaseErrorMessage(jobResult.error)}`,
        );
        return;
      }
      const workOrderResult = await updateFirestoreWorkOrder(
        workOrder.firestoreId || workOrder.id,
        workOrderUpdates,
      );
      if (workOrderResult.error) {
        showActionNotice(
          "error",
          `Work order was not canceled: ${getFirebaseErrorMessage(workOrderResult.error)}`,
        );
        return;
      }
    }

    updateAppState((current) => ({
      ...current,
      jobs: current.jobs.map((entry) =>
        entry.id === job.id ? { ...entry, ...jobUpdates } : entry,
      ),
      workOrders: current.workOrders.map((entry) =>
        entry.id === workOrder.id ? { ...entry, ...workOrderUpdates } : entry,
      ),
    }));
    showActionNotice("success", "Job canceled and saved.");
  };

  const persistProposalReviewEdits = (proposalId, updates) => {
    const targetProposal = appState.proposals.find(
      (proposal) => proposal.id === proposalId,
    );
    if (!targetProposal) {
      throw new Error("The selected proposal could not be found.");
    }
    updateAppState((current) => ({
      ...current,
      proposals: current.proposals.map((proposal) =>
        proposal.id === proposalId ? { ...proposal, ...updates } : proposal,
      ),
    }));
    return targetProposal;
  };

  const handleSaveProposalChanges = async (proposal = selectedProposal) => {
    if (!proposal?.id) {
      setProposalSaveNotice({
        type: "error",
        message: "Select a proposal before saving changes.",
      });
      return false;
    }
    try {
      const updates = {
        reviewedPrice: reviewForm.reviewedPrice,
        amsNotes: reviewForm.amsNotes,
        lastReviewedAt: new Date().toISOString(),
      };
      if (currentUser?.firebaseUid) {
        const result = await updateFirestoreProposal(
          proposal.firestoreId || proposal.id,
          updates,
        );
        if (result.error) throw result.error;
      }
      const targetProposal = persistProposalReviewEdits(proposal.id, updates);
      setProposalSaveNotice({
        type: "success",
        message: `Proposal changes saved for ${targetProposal.vendorCompanyName || "selected crew"}.`,
      });
      return true;
    } catch (error) {
      setProposalSaveNotice({
        type: "error",
        message: error?.message || "Proposal changes could not be saved.",
      });
      return false;
    }
  };

  const updateProposalReviewField = (key, value) => {
    setProposalSaveNotice(null);
    setReviewForm((current) => ({ ...current, [key]: value }));
  };

  const handleRequestRevision = async (proposal = selectedProposal) => {
    if (!proposal) return;
    const reviewedAt = new Date().toISOString();
    const updates = {
      status: "revision_requested",
      reviewedPrice: reviewForm.reviewedPrice,
      amsNotes: reviewForm.amsNotes,
      requestedRevisionAt: reviewedAt,
      lastReviewedAt: reviewedAt,
      isActivePath: true,
    };

    try {
      if (currentUser?.firebaseUid) {
        const result = await updateFirestoreProposal(
          proposal.firestoreId || proposal.id,
          updates,
        );
        if (result.error) throw result.error;
      }
      persistProposalReviewEdits(proposal.id, updates);
      setProposalSaveNotice({
        type: "success",
        message: "Revision requested.",
      });
      showActionNotice("success", "Proposal marked Revision Requested.");
    } catch (error) {
      const message = getFirebaseErrorMessage(error);
      setProposalSaveNotice({ type: "error", message });
      showActionNotice(
        "error",
        `Revision request did not complete: ${message}`,
      );
    }
  };

  const handleRejectProposal = async (proposal = selectedProposal) => {
    if (!proposal) return;
    const reviewedAt = new Date().toISOString();
    const updates = {
      status: "rejected",
      reviewedPrice: reviewForm.reviewedPrice,
      amsNotes: reviewForm.amsNotes,
      rejectedAt: reviewedAt,
      isActivePath: false,
      lastReviewedAt: reviewedAt,
    };

    try {
      if (currentUser?.firebaseUid) {
        const result = await updateFirestoreProposal(
          proposal.firestoreId || proposal.id,
          updates,
        );
        if (result.error) throw result.error;
      }
      persistProposalReviewEdits(proposal.id, updates);
      setProposalSaveNotice({ type: "success", message: "Proposal rejected." });
      showActionNotice("success", "Proposal rejected.");
    } catch (error) {
      setProposalSaveNotice({
        type: "error",
        message: getFirebaseErrorMessage(error),
      });
    }
  };

  const handleApproveProposal = async (proposal = selectedProposal) => {
    if (!proposal) return;
    const workOrderForProposal = appState.workOrders.find(
      (entry) => entry.id === proposal.workOrderId,
    );
    if (!workOrderForProposal) return;
    const vendor = normalizedVendors.find(
      (entry) => entry.id === proposal.vendorId,
    );
    if (!vendor) {
      window.alert("The proposal crew could not be found.");
      return;
    }
    if (
      hasAssignedValue(workOrderForProposal.assignedVendorId) &&
      workOrderForProposal.assignedVendorId !== proposal.vendorId &&
      proposal.status !== "approved"
    ) {
      setProposalSaveNotice({
        type: "error",
        message:
          "This work order is already assigned to another approved proposal.",
      });
      return;
    }
    const approvedAt = new Date().toISOString();
    const approvedPrice =
      reviewForm.reviewedPrice ||
      proposal.reviewedPrice ||
      proposal.submittedPrice;
    const updates = {
      status: "approved",
      reviewedPrice: approvedPrice,
      amsNotes: reviewForm.amsNotes,
      approvedAt,
      isActivePath: false,
      lastReviewedAt: approvedAt,
    };

    try {
      let approvedJob = null;
      let approvedJobId = workOrderForProposal.jobId || "";
      let jobAlreadyExisted = false;

      if (currentUser?.firebaseUid) {
        const result = await approveFirestoreProposalForWorkOrder({
          proposal: {
            ...proposal,
            vendorName:
              proposal.vendorName ||
              proposal.vendorCompanyName ||
              vendor.companyName ||
              vendor.name,
          },
          workOrder: workOrderForProposal,
          updates,
          approvedBy: currentUser.email || currentUser.name || "",
        });
        if (result.error) throw result.error;
        approvedJob = result.job;
        approvedJobId = result.jobId || approvedJob?.id || approvedJobId;
        jobAlreadyExisted = Boolean(result.jobAlreadyExisted);
      } else {
        const existingJob = appState.jobs.find(
          (job) => job.workOrderId === workOrderForProposal.id,
        );
        approvedJob =
          existingJob ||
          buildJobRecord({
            workOrder: workOrderForProposal,
            vendor,
            price: approvedPrice,
            sell:
              workOrderForProposal.sell || workOrderForProposal.sellPrice || "",
            currentUser,
          });
        approvedJobId = approvedJob.id;
        jobAlreadyExisted = Boolean(existingJob);
      }

      updateAppState((current) => {
        const nextJobs =
          approvedJob && approvedJob.id
            ? current.jobs.some((job) => job.id === approvedJob.id)
              ? current.jobs.map((job) =>
                  job.id === approvedJob.id ? { ...job, ...approvedJob } : job,
                )
              : [
                  approvedJob,
                  ...current.jobs.filter(
                    (job) => job.workOrderId !== workOrderForProposal.id,
                  ),
                ]
            : current.jobs;

        return {
          ...current,
          jobs: nextJobs,
          proposals: current.proposals.map((entry) => {
            if (entry.workOrderId !== workOrderForProposal.id) return entry;
            if (entry.id === proposal.id) {
              return { ...entry, ...updates };
            }
            if (["submitted", "revision_requested"].includes(entry.status)) {
              return {
                ...entry,
                status: "rejected",
                rejectedAt: entry.rejectedAt || approvedAt,
                isActivePath: false,
                lastReviewedAt: approvedAt,
              };
            }
            return entry;
          }),
          workOrders: current.workOrders.map((workOrder) =>
            workOrder.id === workOrderForProposal.id
              ? {
                  ...workOrder,
                  status: "Assigned",
                  assignedVendorId: vendor.id,
                  assignedVendorName: vendor.companyName || vendor.name,
                  proposalAwardedAt: approvedAt,
                  jobId: approvedJobId,
                }
              : workOrder,
          ),
        };
      });
      if (approvedJobId) setSelectedJobId(approvedJobId);
      const successMessage = jobAlreadyExisted
        ? "Proposal approved. Existing job was linked to the work order."
        : "Proposal approved. Job created and assigned.";
      setProposalSaveNotice({ type: "success", message: successMessage });
      showActionNotice(
        "success",
        `${successMessage} Competing submitted proposals were rejected.`,
      );
    } catch (error) {
      setProposalSaveNotice({
        type: "error",
        message: getFirebaseErrorMessage(error),
      });
    }
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

  const openCrewOpportunityDetails = (workOrderId) => {
    updateVendorProposalDraft(
      workOrderId,
      "submittedPrice",
      vendorProposalDrafts[workOrderId]?.submittedPrice || "",
    );
    setSelectedCrewOpportunityId(workOrderId);
  };

  const hideCrewOpportunity = (workOrderId) => {
    if (!workOrderId || !currentCrewRecord) {
      showActionNotice(
        "error",
        "Opportunity could not be hidden because the Crew record was not found.",
      );
      return;
    }
    const targetWorkOrder = appState.workOrders.find(
      (workOrder) => workOrder.id === workOrderId,
    );
    const crewKey = currentCrewRecord.id || currentUser?.id;
    updateAppState((current) => {
      const hiddenByCrew = current.ui?.hiddenCrewOpportunityIdsByUser || {};
      const existingHidden = hiddenByCrew[crewKey] || [];
      return {
        ...current,
        ui: {
          ...(current.ui || {}),
          hiddenCrewOpportunityIdsByUser: {
            ...hiddenByCrew,
            [crewKey]: existingHidden.includes(workOrderId)
              ? existingHidden
              : [...existingHidden, workOrderId],
          },
        },
      };
    });
    if (selectedCrewOpportunityId === workOrderId) {
      setSelectedCrewOpportunityId(null);
    }
    showActionNotice(
      "success",
      `${targetWorkOrder?.siteName || "Opportunity"} hidden from Available Work.`,
    );
  };

  const handleCrewProposalSubmit = async (workOrder) => {
    if (!currentCrewRecord) return;
    const site = appState.sites.find((entry) => entry.id === workOrder.siteId);
    if (
      !canCrewSubmitProposal({
        workOrder,
        site,
        vendor: currentCrewRecord,
        proposals: appState.proposals,
        jobs: appState.jobs,
      })
    ) {
      window.alert(
        "This proposal opportunity is not available for submission.",
      );
      return;
    }

    const draft = vendorProposalDrafts[workOrder.id] || {};
    if (!String(draft.submittedPrice || "").trim()) {
      window.alert("Proposal cost is required.");
      return;
    }

    const latestProposal = getLatestCrewProposal(
      appState.proposals,
      workOrder.id,
      currentCrewRecord.id,
    );
    const submittedAt = new Date().toISOString();
    const newProposal = {
      id: createId("proposal"),
      workOrderId: workOrder.id,
      siteId: workOrder.siteId || "",
      siteName: workOrder.siteName || site?.name || "",
      vendorId: currentCrewRecord.id,
      vendorName: currentCrewRecord.companyName || currentCrewRecord.name,
      vendorCompanyName:
        currentCrewRecord.companyName || currentCrewRecord.name,
      vendorUserEmail:
        currentCrewRecord.userEmail ||
        currentCrewRecord.email ||
        currentUser?.email ||
        "",
      serviceType: workOrder.serviceType || "",
      price: draft.submittedPrice,
      notes: draft.submittedNotes || "",
      submittedPrice: draft.submittedPrice,
      submittedNotes: draft.submittedNotes || "",
      submittedAt,
      createdAt: submittedAt,
      createdBy: currentUser?.id || currentUser?.email || "",
      reviewedPrice: "",
      amsNotes: "",
      lastReviewedAt: "",
      status: "submitted",
      revisionNumber: latestProposal
        ? (latestProposal.revisionNumber || latestProposal.revisionCount || 1) +
          1
        : 1,
      revisionCount: latestProposal
        ? (latestProposal.revisionCount || 1) + 1
        : 1,
      supersedesProposalId: latestProposal?.id || null,
      isActivePath: true,
      rejectedAt: "",
      approvedAt: "",
      requestedRevisionAt: "",
    };

    let proposalToStore = newProposal;
    if (currentUser?.firebaseUid) {
      const result = await createFirestoreProposal(newProposal);
      if (result.error) {
        showActionNotice("error", getFirebaseErrorMessage(result.error));
        return;
      }
      proposalToStore = result.proposal || newProposal;
    }

    updateAppState((current) => ({
      ...current,
      proposals: [
        proposalToStore,
        ...current.proposals.map((proposal) =>
          latestProposal && proposal.id === latestProposal.id
            ? { ...proposal, isActivePath: false }
            : proposal,
        ),
      ],
    }));

    setVendorProposalDrafts((current) => ({
      ...current,
      [workOrder.id]: { submittedPrice: "", submittedNotes: "" },
    }));
    setSelectedCrewOpportunityId(null);
    showActionNotice("success", "Proposal submitted.");
  };

  const createInvoiceForJob = async (job) => {
    if (!currentUser || !isCrewUser(currentUser) || !currentCrewRecord) {
      showActionNotice(
        "error",
        "Invoice could not be submitted because the Crew record was not found.",
      );
      return;
    }
    if (job.vendorId !== currentCrewRecord.id) {
      showActionNotice(
        "error",
        "Invoice could not be submitted because this job belongs to another Crew record.",
      );
      return;
    }
    if (getInvoiceForJob(appState.invoices, job.id)) {
      window.alert("An invoice already exists for this job.");
      return;
    }
    const workOrder = appState.workOrders.find(
      (entry) => entry.id === job.workOrderId,
    );
    const companyProfile =
      appState.companyProfiles?.vendors?.[job.vendorId] || {};
    const invoice = {
      ...buildInvoiceRecord({ job, workOrder, currentUser }),
      vendorCompany: { ...companyProfile },
      amount: calculateInvoiceTotal(
        buildInvoiceRecord({ job, workOrder, currentUser }).lineItems,
      ),
      total: calculateInvoiceTotal(
        buildInvoiceRecord({ job, workOrder, currentUser }).lineItems,
      ),
    };
    let invoiceToStore = invoice;
    const jobUpdates = { status: "Invoiced" };
    if (currentUser?.firebaseUid) {
      const invoiceResult = await createFirestoreInvoiceAndMarkJob({
        invoice,
        jobId: job.firestoreId || job.id,
      });
      if (invoiceResult.error) {
        showActionNotice(
          "error",
          `Invoice was not submitted: ${getFirebaseErrorMessage(invoiceResult.error)}`,
        );
        return;
      }
      if (invoiceResult.alreadyExists) {
        showActionNotice("error", "An invoice already exists for this job.");
        return;
      }
      if (!invoiceResult.invoice?.id) {
        showActionNotice(
          "error",
          "Invoice was not submitted because Firestore did not return an invoice ID.",
        );
        return;
      }
      invoiceToStore = invoiceResult.invoice;
    }
    updateAppState((current) => ({
      ...current,
      invoices: [
        invoiceToStore,
        ...current.invoices.filter((entry) => entry.jobId !== job.id),
      ],
      jobs: current.jobs.map((entry) =>
        entry.id === job.id
          ? {
              ...entry,
              ...jobUpdates,
            }
          : entry,
      ),
    }));
    setSelectedInvoiceId(invoiceToStore.id);
    showActionNotice("success", "Invoice submitted. Job moved to Invoiced.");
    openScreen("myInvoices");
  };

  const openJobConfirmation = (type, jobId) => {
    const job = appState.jobs.find((entry) => entry.id === jobId);
    if (!job) return;
    if (type === "start" && job.status !== "Assigned") {
      showActionNotice(
        "error",
        getInvalidJobTransitionMessage(job.status, "In Progress"),
      );
      return;
    }
    if (type === "complete" && job.status !== "In Progress") {
      showActionNotice(
        "error",
        getInvalidJobTransitionMessage(job.status, "Completed"),
      );
      return;
    }
    setJobConfirmation({ type, jobId });
  };

  const confirmJobStatusChange = async () => {
    if (!jobConfirmation?.jobId) return;
    const nextStatus =
      jobConfirmation.type === "start" ? "In Progress" : "Completed";
    await updateJobStatus(jobConfirmation.jobId, nextStatus);
    setJobConfirmation(null);
  };

  const saveJobSell = async (jobId, sellValue) => {
    if (
      !jobId ||
      !(
        AMS_ROLES.includes(currentUser?.role) ||
        currentUser?.role === ROLES.OWNER
      )
    ) {
      setSellSaveNotice({
        type: "error",
        message: "You do not have permission to save AMS sell pricing.",
      });
      return false;
    }
    const targetJob = appState.jobs.find((job) => job.id === jobId);
    if (!targetJob) {
      setSellSaveNotice({
        type: "error",
        message:
          "Sell price was not saved because the selected job was not found.",
      });
      return false;
    }
    const pricingUpdates = buildPricingFields({
      sell: sellValue,
      currentUser,
      existingJob: targetJob,
    });
    const canonicalSellValue = pricingUpdates.sell;

    if (currentUser?.firebaseUid) {
      const result = await updateFirestoreJob(
        targetJob.firestoreId || targetJob.id,
        pricingUpdates,
      );
      if (result.error) {
        setSellSaveNotice({
          type: "error",
          message: `Sell price was not saved: ${getFirebaseErrorMessage(result.error)}`,
        });
        return false;
      }
    }

    updateAppState((current) => ({
      ...current,
      jobs: current.jobs.map((job) =>
        job.id === jobId
          ? (() => {
              const { sellPrice, ...jobWithoutLegacySellPrice } = job;
              return {
                ...jobWithoutLegacySellPrice,
                ...pricingUpdates,
              };
            })()
          : job,
      ),
    }));
    setSellSaveNotice({
      type: "success",
      message: `Sell price saved for ${targetJob.siteName}.`,
    });
    setJobSellDrafts((current) => ({
      ...current,
      [jobId]: canonicalSellValue,
    }));
    return true;
  };

  const saveJobCost = async (jobId, costValue) => {
    if (
      !jobId ||
      !(
        AMS_ROLES.includes(currentUser?.role) ||
        currentUser?.role === ROLES.OWNER
      )
    ) {
      setSellSaveNotice({
        type: "error",
        message: "You do not have permission to save crew cost.",
      });
      return false;
    }
    const targetJob = appState.jobs.find((job) => job.id === jobId);
    if (!targetJob) {
      setSellSaveNotice({
        type: "error",
        message: "Cost was not saved because the selected job was not found.",
      });
      return false;
    }
    const linkedInvoice = getInvoiceForJob(appState.invoices, targetJob.id);
    const previousInvoiceCost =
      linkedInvoice?.amount ?? linkedInvoice?.total ?? "";
    const invoiceCostChanged =
      Boolean(linkedInvoice) &&
      didCostValueChange(previousInvoiceCost, costValue);
    const editedBy = currentUser?.email || "";

    const costUpdates = {
      cost: costValue,
      price: costValue,
      costSetBy: currentUser?.id || currentUser?.email || null,
      costSetAt: new Date().toISOString(),
    };

    if (currentUser?.firebaseUid) {
      const result = linkedInvoice
        ? await updateFirestoreJobAndInvoiceCost({
            invoice: linkedInvoice,
            invoiceId: linkedInvoice.firestoreId || linkedInvoice.id,
            jobId: targetJob.firestoreId || targetJob.id,
            jobUpdates: costUpdates,
            newCost: costValue,
            editedBy,
          })
        : await updateFirestoreJob(
            targetJob.firestoreId || targetJob.id,
            costUpdates,
          );
      if (result.error) {
        setSellSaveNotice({
          type: "error",
          message: linkedInvoice
            ? `Cost sync failed: ${getFirebaseErrorMessage(result.error)}`
            : `Cost was not saved: ${getFirebaseErrorMessage(result.error)}`,
        });
        return false;
      }
    }

    updateAppState((current) => ({
      ...current,
      jobs: current.jobs.map((job) =>
        job.id === jobId
          ? {
              ...job,
              ...costUpdates,
            }
          : job,
      ),
      invoices: linkedInvoice
        ? current.invoices.map((invoice) =>
            invoice.id === linkedInvoice.id
              ? {
                  ...invoice,
                  amount: costValue,
                  total: costValue,
                  ...(invoiceCostChanged
                    ? {
                        lastCostUpdatedBy: editedBy,
                        lastCostUpdatedAt: new Date().toISOString(),
                        adjustments: [
                          ...(invoice.adjustments || []),
                          {
                            previousCost: previousInvoiceCost,
                            newCost: costValue,
                            editedBy,
                            editedAt: new Date().toISOString(),
                          },
                        ],
                      }
                    : {}),
                }
              : invoice,
          )
        : current.invoices,
    }));
    setSellSaveNotice({
      type: "success",
      message: linkedInvoice
        ? `Cost saved for ${targetJob.siteName} and synced to invoice.`
        : `Cost saved for ${targetJob.siteName}.`,
    });
    return true;
  };

  const getJobSellDraft = (job) => {
    if (!job) return "";
    return jobSellDrafts[job.id] ?? getJobSellValue(job);
  };

  const updateJobSellDraft = (jobId, value) => {
    setSellSaveNotice(null);
    setJobSellDrafts((current) => ({ ...current, [jobId]: value }));
  };

  const startJobSellEdit = (job) => {
    if (!job) return;
    setSellSaveNotice(null);
    setJobSellDrafts((current) => ({
      ...current,
      [job.id]: current[job.id] ?? getJobSellValue(job),
    }));
    setEditingJobSellId(job.id);
  };

  const saveJobSellForJob = async (job) => {
    if (!job?.id) {
      setSellSaveNotice({
        type: "error",
        message: "Choose a job before saving sell pricing.",
      });
      return;
    }
    const saved = await saveJobSell(
      job.id,
      jobSellDrafts[job.id] ?? getJobSellValue(job),
    );
    if (saved && editingJobSellId === job.id) setEditingJobSellId(null);
  };

  const saveAccountingSell = async () => {
    if (!selectedInvoiceJob) return;
    const saved = await saveJobSell(selectedInvoiceJob.id, accountingSellForm);
    if (saved) setEditingAccountingSellJobId(null);
  };

  const saveAccountingCost = async () => {
    if (!selectedInvoiceJob) return;
    const saved = await saveJobCost(selectedInvoiceJob.id, accountingCostForm);
    if (saved) setEditingAccountingCostJobId(null);
  };

  const saveInvoice = async () => {
    const targetInvoiceId = selectedInvoice?.id;
    if (!targetInvoiceId) {
      showActionNotice("error", "Select an invoice before saving.");
      return;
    }
    const locked = selectedInvoice?.status === "Paid";
    if (locked) {
      showActionNotice(
        "error",
        "Paid invoices are locked and cannot be edited.",
      );
      return;
    }
    const total = calculateInvoiceTotal(invoiceForm.lineItems);
    const invoiceUpdates = {
      ...invoiceForm,
      status: normalizeInvoiceStatus(invoiceForm.status),
      amount: total,
      total,
    };
    if (currentUser?.firebaseUid) {
      const result = await updateFirestoreInvoice(
        selectedInvoice.firestoreId || selectedInvoice.id,
        invoiceUpdates,
      );
      if (result.error) {
        showActionNotice(
          "error",
          `Invoice was not saved: ${getFirebaseErrorMessage(result.error)}`,
        );
        return;
      }
    }
    updateAppState((current) => ({
      ...current,
      invoices: current.invoices.map((invoice) =>
        invoice.id === targetInvoiceId
          ? {
              ...invoice,
              ...invoiceUpdates,
            }
          : invoice,
      ),
    }));
    showActionNotice("success", "Invoice saved.");
  };

  const updateInvoiceStatus = async (status) => {
    const targetInvoiceId = selectedInvoice?.id;
    if (!targetInvoiceId) {
      showActionNotice("error", "Select an invoice before updating status.");
      return;
    }
    if (selectedInvoice?.status === "Paid") {
      showActionNotice(
        "error",
        "Paid invoices are locked and cannot be updated.",
      );
      return;
    }
    const timestamp = new Date().toISOString();
    const normalizedStatus = normalizeInvoiceStatus(status);
    const shouldCloseJob = normalizedStatus === "Paid" && selectedInvoiceJob;
    const invoiceUpdates = {
      ...invoiceForm,
      status: normalizedStatus,
      amount: calculateInvoiceTotal(invoiceForm.lineItems),
      total: calculateInvoiceTotal(invoiceForm.lineItems),
      approvedAt:
        normalizedStatus === "Approved"
          ? selectedInvoice.approvedAt || timestamp
          : selectedInvoice.approvedAt || "",
      approvedBy:
        normalizedStatus === "Approved"
          ? currentUser?.email || currentUser?.name || ""
          : selectedInvoice.approvedBy || "",
      paidAt:
        normalizedStatus === "Paid"
          ? selectedInvoice.paidAt || timestamp
          : selectedInvoice.paidAt || "",
    };
    if (currentUser?.firebaseUid) {
      if (shouldCloseJob) {
        const result = await updateFirestoreInvoiceAndJob(
          selectedInvoice.firestoreId || selectedInvoice.id,
          invoiceUpdates,
          selectedInvoiceJob.firestoreId || selectedInvoiceJob.id,
          { status: "Closed" },
        );
        if (result.error) {
          showActionNotice(
            "error",
            `Invoice was not marked Paid: ${getFirebaseErrorMessage(result.error)}`,
          );
          return;
        }
      } else {
        const invoiceResult = await updateFirestoreInvoice(
          selectedInvoice.firestoreId || selectedInvoice.id,
          invoiceUpdates,
        );
        if (invoiceResult.error) {
          showActionNotice(
            "error",
            `Invoice status was not saved: ${getFirebaseErrorMessage(invoiceResult.error)}`,
          );
          return;
        }
      }
    }
    updateAppState((current) => ({
      ...current,
      invoices: current.invoices.map((invoice) =>
        invoice.id === targetInvoiceId
          ? {
              ...invoice,
              ...invoiceUpdates,
            }
          : invoice,
      ),
      jobs: shouldCloseJob
        ? current.jobs.map((job) =>
            job.id === selectedInvoiceJob.id
              ? {
                  ...job,
                  status: "Closed",
                }
              : job,
          )
        : current.jobs,
    }));
    showActionNotice(
      "success",
      shouldCloseJob
        ? "Invoice marked Paid and job closed."
        : `Invoice marked ${normalizedStatus}.`,
    );
  };

  const openWorkOrders = appState.workOrders.filter((entry) =>
    [
      "Needs Review",
      "Needs Attention",
      "Needs Vendor",
      "Scheduled",
      "Open",
    ].includes(entry.status),
  );
  const proposalOpportunities = appState.workOrders.filter(
    (entry) => entry.proposalRequired && entry.proposalState === "opportunity",
  );
  const proposalsAwaitingDecision = appState.proposals.filter(
    (proposal) => proposal.isActivePath && proposal.status === "submitted",
  );
  const invoicesAwaitingReview = appState.invoices.filter(
    (invoice) => normalizeInvoiceStatus(invoice.status) === "Submitted",
  );
  const paidInvoices = appState.invoices.filter(
    (invoice) => normalizeInvoiceStatus(invoice.status) === "Paid",
  );

  const visibleCrewJobs =
    currentUser && currentCrewRecord
      ? appState.jobs.filter((job) => job.vendorId === currentCrewRecord.id)
      : [];
  const crewInvoices =
    currentCrewRecord && isCrewUser(currentUser)
      ? appState.jobs
          .filter(
            (job) =>
              job.vendorId === currentCrewRecord.id &&
              ["Completed", "Invoiced", "Closed"].includes(job.status),
          )
          .map((job) => ({
            job,
            invoice: getInvoiceForJob(appState.invoices, job.id),
          }))
      : [];
  const crewSubmittedInvoices = [
    ...crewInvoices
      .filter(({ invoice }) => invoice)
      .map(({ job, invoice }) => ({ id: invoice.id, job, invoice })),
  ].sort(
    (a, b) =>
      new Date(b.invoice?.submittedAt || 0).getTime() -
      new Date(a.invoice?.submittedAt || 0).getTime(),
  );
  const crewOpenInvoices = crewInvoices.filter(
    ({ invoice }) =>
      invoice && normalizeInvoiceStatus(invoice.status) !== "Paid",
  );
  const crewPaidInvoices = crewInvoices.filter(
    ({ invoice }) => normalizeInvoiceStatus(invoice?.status) === "Paid",
  );

  const vendorSites =
    currentUser && currentCrewRecord
      ? appState.sites.filter(
          (site) =>
            site.assignedVendorId === currentCrewRecord.id ||
            visibleCrewJobs.some((job) => job.siteId === site.id),
        )
      : [];
  const hiddenCrewOpportunityIds = currentCrewRecord
    ? appState.ui?.hiddenCrewOpportunityIdsByUser?.[
        currentCrewRecord.id || currentUser?.id
      ] || []
    : [];
  const crewOpportunityDataReady =
    Boolean(currentUser) &&
    (!currentUser.firebaseUid ||
      (workOrdersLoaded && jobsLoaded && vendorsLoaded && proposalsLoaded));
  const availableCrewWork =
    currentUser &&
    isCrewUser(currentUser) &&
    currentCrewRecord &&
    crewOpportunityDataReady
      ? appState.workOrders.filter((workOrder) => {
          if (hiddenCrewOpportunityIds.includes(workOrder.id)) return false;
          const site = appState.sites.find(
            (entry) => entry.id === workOrder.siteId,
          );
          return canCrewSubmitProposal({
            workOrder,
            site,
            vendor: currentCrewRecord,
            proposals: appState.proposals,
            jobs: appState.jobs,
          });
        })
      : [];
  const crewAvailableWorkEmptyText = (() => {
    if (!crewOpportunityDataReady) return "";
    if (!currentUser || !isCrewUser(currentUser))
      return "Crew login is required to view available work.";
    if (currentUser.demo && !currentUser.firebaseUid) {
      return "Crew Demo is active, but it is not linked to a Firestore Crew company profile. Use a real Crew test login to view live available work.";
    }
    if (!currentCrewRecord)
      return "No matching Crew company profile was found for this login.";
    if (!appState.workOrders.length) return "No work orders are available yet.";

    const visibleWorkOrders = appState.workOrders.filter(
      (workOrder) => !hiddenCrewOpportunityIds.includes(workOrder.id),
    );
    const unassignedWorkOrders = visibleWorkOrders.filter(
      (workOrder) => !isWorkOrderTrulyAssigned(workOrder),
    );

    if (!unassignedWorkOrders.length)
      return "No unassigned work orders are available right now.";

    const openWorkOrders = unassignedWorkOrders.filter((workOrder) =>
      isCrewOpenWorkOrderStatus(workOrder.status),
    );
    if (!openWorkOrders.length)
      return "No open Crew opportunities are available right now.";

    const vendorStates = getVendorCoverageStates(currentCrewRecord);
    const stateMatchedWorkOrders = openWorkOrders.filter((workOrder) => {
      const site = appState.sites.find(
        (entry) => entry.id === workOrder.siteId,
      );
      const workOrderState = getWorkOrderDispatchState(workOrder, site);
      return Boolean(workOrderState && vendorStates.includes(workOrderState));
    });

    if (!vendorStates.length)
      return "Your Crew profile does not have a service state assigned yet.";
    if (!stateMatchedWorkOrders.length)
      return `No eligible work orders are available in ${vendorStates.join(", ")} right now.`;

    return "No available work matches your Crew profile right now.";
  })();
  const selectedCrewOpportunity =
    availableCrewWork.find(
      (workOrder) => workOrder.id === selectedCrewOpportunityId,
    ) || null;
  const selectedCrewOpportunitySite = selectedCrewOpportunity
    ? appState.sites.find(
        (site) => site.id === selectedCrewOpportunity.siteId,
      ) || null
    : null;
  const selectedCrewOpportunityDraft = selectedCrewOpportunity
    ? vendorProposalDrafts[selectedCrewOpportunity.id] || {
        submittedPrice: "",
        submittedNotes: "",
      }
    : { submittedPrice: "", submittedNotes: "" };
  const selectedCrewOpportunityLatestProposal =
    selectedCrewOpportunity && currentCrewRecord
      ? getLatestCrewProposal(
          appState.proposals,
          selectedCrewOpportunity.id,
          currentCrewRecord.id,
        )
      : null;
  const activeCrewJobs = visibleCrewJobs.filter((job) =>
    ["Assigned", "In Progress"].includes(job.status),
  );
  const completedCrewJobs = sortByNewest(
    visibleCrewJobs.filter((job) =>
      ["Completed", "Invoiced", "Closed"].includes(job.status),
    ),
    "completedTime",
  );
  const filteredCrewSites = vendorSites.filter((site) =>
    searchMatches(
      [
        site.name,
        site.address,
        site.streetAddress,
        site.city,
        site.state,
        site.zip,
        site.assignedVendorName,
      ],
      crewSiteSearch,
    ),
  );
  const selectedCrewSite =
    filteredCrewSites.find((site) => site.id === selectedCrewSiteId) ||
    filteredCrewSites[0] ||
    null;
  const selectedCrewSiteServiceLog = selectedCrewSite
    ? sortByNewest(
        completedCrewJobs
          .filter(
            (job) =>
              job.siteId === selectedCrewSite.id &&
              job.vendorId === currentCrewRecord?.id,
          )
          .map((job) => ({
            ...job,
            invoice: getInvoiceForJob(appState.invoices, job.id) || null,
            workOrder:
              appState.workOrders.find(
                (workOrder) => workOrder.id === job.workOrderId,
              ) || null,
          })),
        "completedTime",
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
        appState.workOrders.find(
          (workOrder) => workOrder.id === job.workOrderId,
        )?.amsWorkOrderNumber,
        getInvoiceForJob(appState.invoices, job.id)?.status,
      ],
      crewCompletedJobSearch,
    ),
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
        workOrderSearch,
      ),
  );
  const filteredJobs = appState.jobs.filter(
    (job) =>
      getJobFilterMatch(job, jobFilter) &&
      searchMatches(
        [
          job.id,
          job.siteName,
          job.description,
          job.vendorName,
          job.serviceType,
          job.workOrderId,
        ],
        jobSearch,
      ),
  );
  const filteredSites = appState.sites.filter((site) =>
    searchMatches(
      [
        site.name,
        site.client,
        site.address,
        site.streetAddress,
        site.city,
        site.state,
        site.zip,
        site.status,
        site.siteNumber,
        Array.isArray(site.serviceTypes)
          ? site.serviceTypes.join(", ")
          : site.serviceTypes,
        site.assignedVendorName,
        site.internalNotes,
        site.notes,
        site.contactName,
        site.contactPhone,
        site.contactEmail,
      ],
      siteSearch,
    ),
  );
  const filteredCrews = normalizedVendors.filter((vendor) =>
    searchMatches(
      [
        vendor.name,
        vendor.companyName,
        vendor.contactName,
        vendor.phone,
        vendor.email,
        vendor.address,
        vendor.serviceType,
        vendor.serviceTypes.join(", "),
        vendor.states.join(", "),
      ],
      crewSearch,
    ),
  );
  const filteredProposals = sortByNewest(
    appState.proposals.filter((proposal) => {
      const workOrder = appState.workOrders.find(
        (entry) => entry.id === proposal.workOrderId,
      );
      const matchesStatus =
        proposalStatusFilter === "All" ||
        proposal.status === proposalStatusFilter;
      if (!matchesStatus) return false;
      return searchMatches(
        [
          proposal.vendorCompanyName,
          proposal.status,
          proposal.submittedPrice,
          proposal.submittedNotes,
          workOrder?.siteName,
          workOrder?.amsWorkOrderNumber,
        ],
        proposalSearch,
      );
    }),
    "submittedAt",
  );
  const filteredInvoices = sortByNewest(
    appState.invoices.filter(
      (invoice) =>
        (invoiceStatusFilter === "All" ||
          normalizeInvoiceStatus(invoice.status) === invoiceStatusFilter) &&
        searchMatches(
          [
            invoice.invoiceNumber,
            invoice.siteName,
            invoice.vendorName,
            invoice.amount,
            invoice.status,
            invoice.notes,
          ],
          invoiceSearch,
        ),
    ),
    "submittedAt",
  );
  const readyForInvoiceJobs = appState.jobs.filter(
    (job) =>
      job.status === "Completed" &&
      !getInvoiceForJob(appState.invoices, job.id),
  );
  const jobsMissingSell = appState.jobs.filter(
    (job) => getPricingStatus(job) === "not_set",
  );
  const selectedSiteServiceLog = selectedSite
    ? sortByNewest(
        appState.jobs
          .filter(
            (job) =>
              job.siteId === selectedSite.id &&
              ["Completed", "Invoiced", "Closed"].includes(job.status),
          )
          .map((job) => ({
            ...job,
            workOrder:
              appState.workOrders.find(
                (workOrder) => workOrder.id === job.workOrderId,
              ) || null,
            invoice: getInvoiceForJob(appState.invoices, job.id) || null,
          })),
        "completedAt",
      )
    : [];
  const selectedSiteNeedsActionCount = getSiteNeedsActionCount({
    site: selectedSite,
    workOrders: appState.workOrders,
    jobs: appState.jobs,
    invoices: appState.invoices,
    proposals: appState.proposals,
  });

  const selectedWorkOrder =
    appState.workOrders.find(
      (workOrder) => workOrder.id === selectedWorkOrderId,
    ) ||
    filteredWorkOrders[0] ||
    null;
  const selectedWorkOrderJob = selectedWorkOrder
    ? appState.jobs.find((job) => job.workOrderId === selectedWorkOrder.id) ||
      null
    : null;
  const selectedJob =
    appState.jobs.find((job) => job.id === selectedJobId) ||
    filteredJobs[0] ||
    null;
  const selectedCrew =
    normalizedVendors.find((vendor) => vendor.id === selectedCrewId) ||
    filteredCrews[0] ||
    null;
  const selectedProposal =
    appState.proposals.find((proposal) => proposal.id === selectedProposalId) ||
    filteredProposals[0] ||
    null;
  const selectedInvoice =
    appState.invoices.find((invoice) => invoice.id === selectedInvoiceId) ||
    filteredInvoices[0] ||
    null;
  const selectedInvoiceJob = selectedInvoice
    ? appState.jobs.find((job) => job.id === selectedInvoice.jobId) || null
    : null;
  const selectedCrewInvoiceRecord =
    crewSubmittedInvoices.find(
      ({ invoice }) => invoice.id === selectedInvoiceId,
    ) ||
    crewSubmittedInvoices[0] ||
    null;
  const amsTeamMembers = sortByNewest(
    appState.users.filter((user) => AMS_ROLES.includes(user.role)),
    "name",
  );
  const ownerVisibleUsers = sortByNewest(
    appState.users.filter((user) => user.role !== ROLES.OWNER),
    "name",
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
      users: appState.users.filter((user) => AMS_ROLES.includes(user.role))
        .length,
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
    ? sortByNewest(
        appState.proposals.filter(
          (proposal) => proposal.workOrderId === selectedWorkOrder.id,
        ),
        "submittedAt",
      )
    : [];
  const selectedWorkOrderProposal =
    selectedWorkOrderProposals.find(
      (proposal) => proposal.id === selectedProposalId,
    ) ||
    selectedWorkOrderProposals[0] ||
    null;
  const selectedWorkOrderBidderNames = selectedWorkOrderProposals.map(
    (proposal) => proposal.vendorCompanyName,
  );

  useEffect(() => {
    if (
      !filteredWorkOrders.some(
        (workOrder) => workOrder.id === selectedWorkOrderId,
      )
    ) {
      setSelectedWorkOrderId(filteredWorkOrders[0]?.id || null);
    }
  }, [filteredWorkOrders, selectedWorkOrderId]);

  useEffect(() => {
    if (!filteredJobs.some((job) => job.id === selectedJobId)) {
      setSelectedJobId(filteredJobs[0]?.id || null);
    }
  }, [filteredJobs, selectedJobId]);

  useEffect(() => {
    if (
      !filteredSites.some((site) => site.id === appState.ui.selectedSiteId) &&
      filteredSites[0]?.id
    ) {
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
    if (
      !filteredProposals.some((proposal) => proposal.id === selectedProposalId)
    ) {
      setSelectedProposalId(filteredProposals[0]?.id || null);
    }
  }, [filteredProposals, selectedProposalId]);

  useEffect(() => {
    setProposalSaveNotice(null);
  }, [activeScreen, selectedProposalId]);

  useEffect(() => {
    if (!filteredInvoices.some((invoice) => invoice.id === selectedInvoiceId)) {
      setSelectedInvoiceId(filteredInvoices[0]?.id || null);
    }
  }, [filteredInvoices, selectedInvoiceId]);

  useEffect(() => {
    const proposalForReview =
      activeScreen === "workOrders"
        ? selectedWorkOrderProposal
        : selectedProposal;
    if (!proposalForReview) {
      setReviewForm({ reviewedPrice: "", amsNotes: "" });
      return;
    }
    setReviewForm({
      reviewedPrice:
        proposalForReview.reviewedPrice ||
        proposalForReview.submittedPrice ||
        "",
      amsNotes: proposalForReview.amsNotes || "",
    });
    if (
      activeScreen === "proposals" &&
      selectedProposal &&
      selectedProposal.workOrderId !== selectedWorkOrderId
    ) {
      setSelectedWorkOrderId(selectedProposal.workOrderId);
    }
  }, [
    activeScreen,
    selectedProposal,
    selectedWorkOrderProposal,
    selectedWorkOrderId,
  ]);

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
      requireBeforeAfterPhotos: Boolean(
        selectedWorkOrder.requireBeforeAfterPhotos,
      ),
      recurringVendorCost: selectedWorkOrder.recurringVendorCost ?? "",
      recurringPricingNotes: selectedWorkOrder.recurringPricingNotes || "",
    });
  }, [selectedWorkOrder]);

  useEffect(() => {
    if (!selectedWorkOrderJob) return;
    setJobSellDrafts((current) => ({
      ...current,
      [selectedWorkOrderJob.id]:
        current[selectedWorkOrderJob.id] ??
        getJobSellValue(selectedWorkOrderJob),
    }));
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
        status: "Submitted",
        lineItems: [
          {
            id: "line-1",
            service: "",
            description: "",
            qty: "1",
            rate: "",
            amount: "",
          },
        ],
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
      status: normalizeInvoiceStatus(selectedInvoice.status),
      lineItems: selectedInvoice.lineItems?.length
        ? selectedInvoice.lineItems
        : [
            {
              id: "line-1",
              service: "",
              description: "",
              qty: "1",
              rate: "",
              amount: "",
            },
          ],
    });
  }, [selectedInvoice]);

  useEffect(() => {
    if (!selectedJob) return;
    setJobSellDrafts((current) => ({
      ...current,
      [selectedJob.id]: current[selectedJob.id] ?? getJobSellValue(selectedJob),
    }));
  }, [selectedJob]);

  useEffect(() => {
    setAccountingSellForm(getJobSellValue(selectedInvoiceJob));
    setAccountingCostForm(getJobCostValue(selectedInvoiceJob));
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
      password: "",
      confirmPassword: "",
      phone: currentUser.phone || "",
      jobTitle: currentUser.jobTitle || "",
      companyName: currentUser.companyName || "",
      streetAddress: currentUser.streetAddress || "",
      city: currentUser.city || "",
      state: currentUser.state || "",
      zip: currentUser.zip || "",
      internalNotes: currentUser.internalNotes || "",
      profilePhotoStatus:
        currentUser.profilePhotoStatus || "Photo Upload Coming Soon",
    });
    setProfilePasswordError("");
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

  const amsQuickActions = [
    {
      key: "dashboard",
      label: "Dashboard",
      onClick: () => openScreen("dashboard"),
    },
    {
      key: "refresh",
      label: dataRefreshLoading ? "Refreshing..." : "Refresh",
      onClick: () => refreshFirestoreData(),
    },
    {
      key: "createWorkOrder",
      label: "Create Work Order",
      onClick: () => openModal("workOrder"),
      featured: true,
    },
    {
      key: "workOrders",
      label: "Work Orders",
      onClick: () => openScreen("workOrders"),
    },
    { key: "jobs", label: "Jobs", onClick: () => openScreen("jobs") },
    { key: "sites", label: "Sites", onClick: () => openScreen("sites") },
    {
      key: "vendors",
      label: SCREEN_LABELS.vendors,
      onClick: () => openScreen("vendors"),
    },
    {
      key: "proposals",
      label: "Proposals",
      onClick: () => openScreen("proposals"),
    },
    {
      key: "accounting",
      label: "Accounting",
      onClick: () => openScreen("accounting"),
    },
  ];
  const crewQuickActions = [
    {
      key: "dashboard",
      label: "Dashboard",
      onClick: () => openScreen("dashboard"),
    },
    {
      key: "refresh",
      label: dataRefreshLoading ? "Refreshing..." : "Refresh",
      onClick: () => refreshFirestoreData(),
    },
    {
      key: "availableWork",
      label: "Available Work",
      onClick: () => openScreen("availableWork"),
    },
    { key: "myJobs", label: "My Jobs", onClick: () => openScreen("myJobs") },
    { key: "mySites", label: "My Sites", onClick: () => openScreen("mySites") },
    {
      key: "myProposals",
      label: "My Proposals",
      onClick: () => openScreen("myProposals"),
    },
    {
      key: "myInvoices",
      label: "My Invoices",
      onClick: () => openScreen("myInvoices"),
    },
  ];
  const quickActions = isCrewUser(currentUser)
    ? crewQuickActions
    : AMS_ROLES.includes(currentUser?.role)
      ? amsQuickActions
      : [];
  const weatherSummary = weatherSummaryConfig.map((item) => ({
    ...item,
    value: weatherCommandState.filter((site) => site.status === item.key)
      .length,
  }));

  const renderProposalDecision = (proposal, workOrder) => {
    if (!proposal) {
      return (
        <EmptyState
          title="No proposal selected"
          text="Select a proposal to review."
        />
      );
    }
    const proposalStatus = normalizeProposalStatus(proposal.status);
    const proposalJob = workOrder
      ? appState.jobs.find((job) => job.workOrderId === workOrder.id)
      : null;
    const approvedProposalForWorkOrder = appState.proposals.find(
      (entry) =>
        entry.workOrderId === proposal.workOrderId &&
        normalizeProposalStatus(entry.status) === "approved",
    );
    const isApproved = proposalStatus === "approved";
    const isDecisionPending = ["submitted", "revision_requested"].includes(
      proposalStatus,
    );
    const isAssignedToAnotherProposal =
      !isApproved &&
      ((approvedProposalForWorkOrder &&
        approvedProposalForWorkOrder.id !== proposal.id) ||
        (hasAssignedValue(workOrder?.assignedVendorId) &&
          workOrder.assignedVendorId !== proposal.vendorId));
    const canApprove = isDecisionPending && !isAssignedToAnotherProposal;
    const canCancelJob =
      isApproved &&
      proposalJob &&
      proposalJob.status === "Assigned" &&
      !proposalJob.startTime &&
      !proposalJob.completedAt &&
      !["In Progress", "Completed", "Invoiced", "Closed", "Canceled"].includes(
        proposalJob.status,
      );

    return (
      <div className="proposal-decision-card">
        <div className="proposal-decision-header">
          <div>
            <strong>{proposal.vendorCompanyName}</strong>
            <p>
              Submitted {formatDate(proposal.submittedAt)} � Revision{" "}
              {proposal.revisionCount}
            </p>
          </div>
          <ProposalStatusBadge value={proposal.status} />
        </div>
        <div className="proposal-summary-grid">
          <div>
            <span className="detail-label">AMS Work Order</span>
            <p>{workOrder?.amsWorkOrderNumber || "Not available"}</p>
          </div>
          <div>
            <span className="detail-label">Site</span>
            <p>{workOrder?.siteName || "Unknown site"}</p>
          </div>
          <div>
            <span className="detail-label">Submitted Cost</span>
            <p>{formatMoney(proposal.submittedPrice)}</p>
          </div>
          <div>
            <span className="detail-label">Submitted Notes</span>
            <p>{proposal.submittedNotes || "No submitted notes."}</p>
          </div>
        </div>
        <InputRow>
          <Field label="Reviewed Price">
            <input
              value={reviewForm.reviewedPrice}
              onChange={(event) =>
                updateProposalReviewField("reviewedPrice", event.target.value)
              }
            />
          </Field>
          <Field label="AMS Notes">
            <textarea
              rows="4"
              value={reviewForm.amsNotes}
              onChange={(event) =>
                updateProposalReviewField("amsNotes", event.target.value)
              }
            />
          </Field>
        </InputRow>
        {proposalSaveNotice ? (
          <div className={`inline-notice ${proposalSaveNotice.type}`}>
            {proposalSaveNotice.message}
          </div>
        ) : null}
        <div className="decision-actions">
          {isDecisionPending ? (
            <button
              className="secondary-button"
              onClick={() => handleSaveProposalChanges(proposal)}
            >
              Save Changes
            </button>
          ) : null}
          {isDecisionPending ? (
            <button
              className="secondary-button"
              onClick={() => handleRequestRevision(proposal)}
            >
              Request Revision
            </button>
          ) : null}
          {isDecisionPending ? (
            <button
              className="secondary-button danger-button"
              onClick={() => handleRejectProposal(proposal)}
            >
              Reject
            </button>
          ) : null}
          {canCancelJob ? (
            <button
              className="secondary-button danger-button"
              onClick={() => cancelJobForWorkOrder(workOrder, proposalJob)}
            >
              Cancel Job
            </button>
          ) : null}
          <button
            className="primary-button"
            disabled={!canApprove}
            onClick={() => handleApproveProposal(proposal)}
          >
            Approve
          </button>
        </div>
      </div>
    );
  };

  const ownerDashboard = (
    <div className="screen-grid">
      <PageSection title="Owner Overview">
        <StatGrid
          items={[
            {
              label: "Companies",
              value: platformCompanies.length,
              onClick: () => openScreen("companies"),
            },
            {
              label: "Managed Users",
              value: ownerVisibleUsers.length,
              onClick: () => openScreen("users"),
            },
            {
              label: "Operational Sites",
              value: appState.sites.length,
              onClick: () => openScreen("companies"),
            },
            {
              label: "Platform Alerts",
              value: appState.invoices.filter(
                (invoice) => invoice.status === "Rejected",
              ).length,
              onClick: () => openScreen("platformStatus"),
            },
          ]}
        />
      </PageSection>
      <PageSection title="Platform Snapshot">
        <div className="proposal-summary-grid">
          <div>
            <span className="detail-label">Brand Layer</span>
            <p>SparkCommand Systems</p>
          </div>
          <div>
            <span className="detail-label">Customer Layer</span>
            <p>Advanced Maintenance Services</p>
          </div>
          <div>
            <span className="detail-label">Operational Records</span>
            <p>
              {appState.workOrders.length} work orders / {appState.jobs.length}{" "}
              jobs / {appState.invoices.length} invoices
            </p>
          </div>
          <div>
            <span className="detail-label">Owner Visibility</span>
            <p>Hidden from AMS and Crew menus</p>
          </div>
        </div>
      </PageSection>
    </div>
  );

  const amsDashboard = (
    <div className="screen-grid">
      <div className="ams-dashboard-grid">
        <PageSection title="Operations Snapshot">
          <StatGrid
            items={[
              {
                label: "Open Work Orders",
                value: openWorkOrders.length,
                onClick: () => openScreen("workOrders"),
              },
              {
                label: "Proposal Opportunities",
                value: proposalOpportunities.length,
                onClick: () => openScreen("proposals"),
              },
              {
                label: "Active Jobs",
                value: appState.jobs.filter(
                  (entry) => entry.status !== "Completed",
                ).length,
                onClick: () => openScreen("jobs"),
              },
              {
                label: "Proposals Awaiting Review",
                value: proposalsAwaitingDecision.length,
                onClick: () => openScreen("proposals"),
              },
              {
                label: "Invoices Awaiting Review",
                value: invoicesAwaitingReview.length,
                onClick: () => openScreen("accounting"),
              },
              {
                label: "Paid Invoices",
                value: paidInvoices.length,
                onClick: () => openScreen("accounting"),
              },
            ]}
          />
        </PageSection>
        <PageSection title="Command Map">
          <CommandMap
            sites={appState.sites}
            selectedSiteId={selectedSite?.id}
            onSelectSite={setSelectedSite}
          />
          <SiteDetailsCard
            site={selectedSite}
            relatedWorkOrderCount={
              selectedSite
                ? appState.workOrders.filter(
                    (workOrder) => workOrder.siteId === selectedSite.id,
                  ).length
                : 0
            }
            needsActionCount={selectedSiteNeedsActionCount}
          />
        </PageSection>
      </div>
    </div>
  );

  const crewAvailableWorkSection = (
    <PageSection title="Available Work">
      {!crewOpportunityDataReady ? (
        <div className="inline-notice info">Loading available work...</div>
      ) : null}
      {workOrdersError ? (
        <div className="inline-notice error">
          Available work could not load work orders: {workOrdersError}
        </div>
      ) : null}
      {vendorsError ? (
        <div className="inline-notice error">
          Available work could not load Crew company profile: {vendorsError}
        </div>
      ) : null}
      {jobsError ? (
        <div className="inline-notice error">
          Available work could not verify assigned jobs: {jobsError}
        </div>
      ) : null}
      {proposalsError ? (
        <div className="inline-notice error">
          Available work could not verify proposals: {proposalsError}
        </div>
      ) : null}
      {availableCrewWork.length ? (
        <div className="available-work-scroll contained-scroll">
          <div className="available-work-grid compact-opportunity-grid">
            {availableCrewWork.map((workOrder) => {
              const site = appState.sites.find(
                (entry) => entry.id === workOrder.siteId,
              );
              const latestProposal = currentCrewRecord
                ? getLatestCrewProposal(
                    appState.proposals,
                    workOrder.id,
                    currentCrewRecord.id,
                  )
                : null;
              const timing =
                workOrder.seasonStart ||
                workOrder.proposalRequestedAt ||
                workOrder.createdAt;
              return (
                <article
                  key={workOrder.id}
                  className="available-work-card compact-opportunity-card"
                >
                  <div className="available-work-top">
                    <div>
                      <strong>{workOrder.siteName}</strong>
                      <p className="detail-muted">
                        {workOrder.serviceType || "Service not specified"}
                      </p>
                    </div>
                    <WorkOrderStatusBadge workOrder={workOrder} />
                  </div>
                  <div className="available-work-summary-grid">
                    <div>
                      <span className="detail-label">State</span>
                      <p>
                        {getWorkOrderDispatchState(workOrder, site) ||
                          "Unknown"}
                      </p>
                    </div>
                    <div>
                      <span className="detail-label">Timing</span>
                      <p>{timing ? formatDate(timing) : "Not set"}</p>
                    </div>
                    <div>
                      <span className="detail-label">Opportunity</span>
                      <p>
                        <WorkOrderStatusBadge workOrder={workOrder} />
                      </p>
                    </div>
                    <div>
                      <span className="detail-label">Proposal</span>
                      <p>
                        {latestProposal ? (
                          <ProposalStatusBadge value={latestProposal.status} />
                        ) : (
                          "Not submitted"
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="proposal-card-actions">
                    <button
                      className="secondary-button"
                      onClick={() => hideCrewOpportunity(workOrder.id)}
                    >
                      Hide
                    </button>
                    <button
                      className="primary-button"
                      onClick={() => openCrewOpportunityDetails(workOrder.id)}
                    >
                      {latestProposal ? "View Details" : "Open Opportunity"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : !crewOpportunityDataReady ? null : (
        <EmptyState
          title="No available work"
          text={
            crewAvailableWorkEmptyText ||
            "New matching proposal opportunities will appear here."
          }
        />
      )}
    </PageSection>
  );

  const crewJobsSection = (
    <PageSection title="My Jobs">
      <div className="detail-stack">
        <PageSection title="Active Jobs">
          {activeCrewJobs.length ? (
            <div className="job-card-grid">
              {activeCrewJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onStart={(jobId) => openJobConfirmation("start", jobId)}
                  onComplete={(jobId) => openJobConfirmation("complete", jobId)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No active jobs"
              text="Assigned active jobs will appear here."
            />
          )}
        </PageSection>
        <PageSection title="Completed Jobs">
          <div className="list-stack">
            <SearchBar
              value={crewCompletedJobSearch}
              onChange={setCrewCompletedJobSearch}
              placeholder="Search completed jobs"
            />
            <div className="list-scroll compact-scroll contained-scroll">
              <DataTable
                columns={[
                  {
                    key: "site",
                    label: "Site Name",
                    render: (row) => row.siteName,
                  },
                  {
                    key: "reference",
                    label: "Job / WO Ref",
                    render: (row) =>
                      `${row.id} / ${appState.workOrders.find((workOrder) => workOrder.id === row.workOrderId)?.amsWorkOrderNumber || "Not available"}`,
                  },
                  {
                    key: "serviceDate",
                    label: "Service Date",
                    render: (row) =>
                      formatDate(row.serviceDate || row.completedTime),
                  },
                  {
                    key: "start",
                    label: "Start Time",
                    render: (row) => formatDate(row.startTime),
                  },
                  {
                    key: "end",
                    label: "Completion Time",
                    render: (row) => formatDate(row.completedTime),
                  },
                  {
                    key: "service",
                    label: "Service Performed",
                    render: (row) => row.servicePerformed || row.serviceType,
                  },
                  {
                    key: "workType",
                    label: "Work Type",
                    render: (row) => getWorkTypeLabel(row.workType),
                  },
                  {
                    key: "scope",
                    label: "Scope",
                    render: (row) =>
                      row.scope || row.description || "No scope notes",
                  },
                  {
                    key: "notes",
                    label: "Notes",
                    render: (row) => row.notes || "No notes",
                  },
                  {
                    key: "wo",
                    label: "AMS Work Order",
                    render: (row) =>
                      appState.workOrders.find(
                        (workOrder) => workOrder.id === row.workOrderId,
                      )?.amsWorkOrderNumber || "Not available",
                  },
                  {
                    key: "invoice",
                    label: "Invoice Status",
                    render: (row) =>
                      getInvoiceForJob(appState.invoices, row.id)?.status ||
                      "Not Invoiced",
                  },
                  {
                    key: "action",
                    label: "Invoice",
                    render: (row) => {
                      const invoice = getInvoiceForJob(
                        appState.invoices,
                        row.id,
                      );
                      if (invoice) {
                        return (
                          <button
                            className="secondary-button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedInvoiceId(invoice.id);
                              openScreen("myInvoices");
                            }}
                          >
                            View Invoice
                          </button>
                        );
                      }

                      if (row.status !== "Completed") {
                        return (
                          <span className="detail-muted">{row.status}</span>
                        );
                      }

                      return (
                        <button
                          className="primary-button"
                          onClick={(event) => {
                            event.stopPropagation();
                            createInvoiceForJob(row);
                          }}
                        >
                          Submit Invoice
                        </button>
                      );
                    },
                  },
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
        list={
          <div className="list-stack">
            <SearchBar
              value={crewSiteSearch}
              onChange={setCrewSiteSearch}
              placeholder="Search my sites"
            />
            <div className="list-scroll">
              <DataTable
                columns={[
                  { key: "name", label: "Site", render: (row) => row.name },
                  {
                    key: "address",
                    label: "Address",
                    render: (row) => row.address,
                  },
                  {
                    key: "visibility",
                    label: "Visibility",
                    render: (row) =>
                      row.assignedVendorId === currentCrewRecord?.id
                        ? "Assigned site"
                        : "Visible through job history",
                  },
                ]}
                rows={filteredCrewSites}
                selectedRowId={selectedCrewSite?.id}
                onRowClick={(row) => setSelectedCrewSiteId(row.id)}
                emptyTitle="No sites available"
                emptyText="Assigned site information will appear here."
              />
            </div>
          </div>
        }
        detail={
          selectedCrewSite ? (
            <div className="detail-stack">
              <div className="detail-card">
                <div className="proposal-summary-top">
                  <div>
                    <strong>{selectedCrewSite.name}</strong>
                    <p>{selectedCrewSite.address}</p>
                  </div>
                  <span className="site-state-tag">
                    {selectedCrewSite.state}
                  </span>
                </div>
                <div className="proposal-summary-grid">
                  <div>
                    <span className="detail-label">Street Address</span>
                    <p>{selectedCrewSite.streetAddress || "Not set"}</p>
                  </div>
                  <div>
                    <span className="detail-label">City</span>
                    <p>{selectedCrewSite.city || "Not set"}</p>
                  </div>
                  <div>
                    <span className="detail-label">State</span>
                    <p>{selectedCrewSite.state || "Not set"}</p>
                  </div>
                  <div>
                    <span className="detail-label">ZIP Code</span>
                    <p>{selectedCrewSite.zip || "Not set"}</p>
                  </div>
                </div>
              </div>
              <PageSection title="Site Service Report">
                <div className="list-scroll compact-scroll contained-scroll">
                  <DataTable
                    columns={[
                      {
                        key: "date",
                        label: "Date of Service",
                        render: (row) =>
                          formatDate(row.serviceDate || row.completedTime),
                      },
                      {
                        key: "service",
                        label: "Service Performed",
                        render: (row) =>
                          row.servicePerformed || row.serviceType,
                      },
                      {
                        key: "workType",
                        label: "Work Type",
                        render: (row) => getWorkTypeLabel(row.workType),
                      },
                      {
                        key: "start",
                        label: "Start Time",
                        render: (row) => formatDate(row.startTime),
                      },
                      {
                        key: "end",
                        label: "Completion Time",
                        render: (row) => formatDate(row.completedTime),
                      },
                      {
                        key: "scope",
                        label: "Scope",
                        render: (row) =>
                          row.scope || row.description || "No scope notes",
                      },
                      {
                        key: "notes",
                        label: "Notes",
                        render: (row) => row.notes || "No notes",
                      },
                      {
                        key: "wo",
                        label: "AMS Work Order Number",
                        render: (row) =>
                          row.workOrder?.amsWorkOrderNumber || "Not available",
                      },
                      {
                        key: "invoice",
                        label: "Invoice Status",
                        render: (row) => row.invoice?.status || "No invoice",
                      },
                    ]}
                    rows={selectedCrewSiteServiceLog}
                    stickyHeader
                    emptyTitle="No services recorded yet"
                    emptyText="No services recorded yet"
                  />
                </div>
              </PageSection>
            </div>
          ) : (
            <EmptyState
              title="No site selected"
              text="Select a site to view details."
            />
          )
        }
      />
    </PageSection>
  );

  const crewProposalStatusSection = (
    <PageSection title="My Proposals">
      {currentCrewRecord ? (
        <div className="proposal-history-grid">
          {sortByNewest(
            appState.proposals.filter(
              (proposal) => proposal.vendorId === currentCrewRecord.id,
            ),
            "submittedAt",
          ).map((proposal) => {
            const workOrder = appState.workOrders.find(
              (entry) => entry.id === proposal.workOrderId,
            );
            const site = workOrder
              ? appState.sites.find((entry) => entry.id === workOrder.siteId)
              : null;
            const canResubmit =
              currentCrewRecord &&
              workOrder &&
              canCrewSubmitProposal({
                workOrder,
                site,
                vendor: currentCrewRecord,
                proposals: appState.proposals,
                jobs: appState.jobs,
              }) &&
              ["rejected", "revision_requested"].includes(proposal.status);
            return (
              <article key={proposal.id} className="proposal-history-card">
                <div className="proposal-history-top">
                  <div>
                    <strong>{workOrder?.siteName || "Work Order"}</strong>
                    <p>{workOrder?.description || "Reference unavailable"}</p>
                  </div>
                  <ProposalStatusBadge value={proposal.status} />
                </div>
                <div className="proposal-history-grid-inner">
                  <div>
                    <span className="detail-label">Submitted Cost</span>
                    <p>{formatMoney(proposal.submittedPrice)}</p>
                  </div>
                  <div>
                    <span className="detail-label">Reviewed Cost</span>
                    <p>{formatMoney(proposal.reviewedPrice)}</p>
                  </div>
                  <div>
                    <span className="detail-label">Submitted At</span>
                    <p>{formatDate(proposal.submittedAt)}</p>
                  </div>
                  <div>
                    <span className="detail-label">Revision Count</span>
                    <p>{proposal.revisionCount}</p>
                  </div>
                </div>
                <div className="proposal-history-notes">
                  <div>
                    <span className="detail-label">AMS Notes</span>
                    <p>{proposal.amsNotes || "No AMS notes yet."}</p>
                  </div>
                </div>
                {canResubmit ? (
                  <div className="proposal-history-actions">
                    <button
                      className="secondary-button"
                      onClick={() => prepareResubmissionDraft(proposal)}
                    >
                      Load Resubmission Draft
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No proposals yet"
          text="Your submitted proposal history will appear here."
        />
      )}
    </PageSection>
  );

  const crewInvoicesSection = (
    <PageSection title="My Invoices">
      {crewInvoices.length ? (
        <div className="detail-stack">
          <PageSection title="Ready To Submit">
            <div className="list-scroll compact-scroll contained-scroll">
              <DataTable
                columns={[
                  {
                    key: "site",
                    label: "Site",
                    render: (row) => row.job.siteName,
                  },
                  {
                    key: "reference",
                    label: "Job / WO Ref",
                    render: (row) =>
                      `${row.job.id} / ${appState.workOrders.find((workOrder) => workOrder.id === row.job.workOrderId)?.amsWorkOrderNumber || "Not available"}`,
                  },
                  {
                    key: "amount",
                    label: "Submitted Amount",
                    render: (row) => formatMoney(row.job.price),
                  },
                  {
                    key: "completedAt",
                    label: "Completion Date",
                    render: (row) =>
                      formatDate(row.job.completedTime || row.job.completedAt),
                  },
                  {
                    key: "action",
                    label: "Action",
                    render: (row) => (
                      <button
                        className="primary-button"
                        onClick={(event) => {
                          event.stopPropagation();
                          createInvoiceForJob(row.job);
                        }}
                      >
                        Submit Invoice
                      </button>
                    ),
                  },
                ]}
                rows={crewInvoices
                  .filter(
                    ({ job, invoice }) =>
                      job.status === "Completed" && !invoice,
                  )
                  .map(({ job, invoice }) => ({ id: job.id, job, invoice }))}
                emptyTitle="No invoices ready"
                emptyText="Completed jobs without invoices will appear here."
              />
            </div>
          </PageSection>
          <PageSection title="Submitted Invoice History">
            <div className="list-scroll compact-scroll contained-scroll">
              <DataTable
                columns={[
                  {
                    key: "invoice",
                    label: "Invoice Ref",
                    render: (row) =>
                      row.invoice.invoiceNumber || row.invoice.id,
                  },
                  {
                    key: "reference",
                    label: "Job / WO Ref",
                    render: (row) =>
                      `${row.job.id} / ${appState.workOrders.find((workOrder) => workOrder.id === row.job.workOrderId)?.amsWorkOrderNumber || "Not available"}`,
                  },
                  {
                    key: "site",
                    label: "Site",
                    render: (row) => row.job.siteName,
                  },
                  {
                    key: "amount",
                    label: "Submitted Amount",
                    render: (row) => formatMoney(row.invoice.amount),
                  },
                  {
                    key: "submittedAt",
                    label: "Submission Date",
                    render: (row) => formatDate(row.invoice.submittedAt),
                  },
                  {
                    key: "status",
                    label: "Status",
                    render: (row) => (
                      <InvoiceStatusBadge value={row.invoice.status} />
                    ),
                  },
                ]}
                rows={crewSubmittedInvoices}
                selectedRowId={selectedInvoice?.id}
                onRowClick={(row) => setSelectedInvoiceId(row.invoice.id)}
                emptyTitle="No submitted invoices"
                emptyText="Submitted invoice history will appear here."
              />
            </div>
          </PageSection>
          <PageSection title="Invoice Detail">
            {selectedCrewInvoiceRecord ? (
              <div className="detail-card">
                <div className="proposal-summary-top">
                  <div>
                    <strong>
                      {selectedCrewInvoiceRecord.invoice.invoiceNumber ||
                        selectedCrewInvoiceRecord.invoice.id}
                    </strong>
                    <p>{selectedCrewInvoiceRecord.job.siteName}</p>
                  </div>
                  <InvoiceStatusBadge
                    value={selectedCrewInvoiceRecord.invoice.status}
                  />
                </div>
                <div className="proposal-summary-grid">
                  <div>
                    <span className="detail-label">Job</span>
                    <p>{selectedCrewInvoiceRecord.job.id}</p>
                  </div>
                  <div>
                    <span className="detail-label">Work Order</span>
                    <p>
                      {appState.workOrders.find(
                        (workOrder) =>
                          workOrder.id ===
                          selectedCrewInvoiceRecord.job.workOrderId,
                      )?.amsWorkOrderNumber || "Not available"}
                    </p>
                  </div>
                  <div>
                    <span className="detail-label">Submitted Amount</span>
                    <p>
                      {formatMoney(selectedCrewInvoiceRecord.invoice.amount)}
                    </p>
                  </div>
                  <div>
                    <span className="detail-label">Submitted Date</span>
                    <p>
                      {formatDate(
                        selectedCrewInvoiceRecord.invoice.submittedAt,
                      )}
                    </p>
                  </div>
                  <div>
                    <span className="detail-label">Terms</span>
                    <p>{selectedCrewInvoiceRecord.invoice.terms || "Net 30"}</p>
                  </div>
                  <div>
                    <span className="detail-label">Service</span>
                    <p>
                      {selectedCrewInvoiceRecord.job.servicePerformed ||
                        selectedCrewInvoiceRecord.job.serviceType}
                    </p>
                  </div>
                  <div>
                    <span className="detail-label">Job Completed</span>
                    <p>
                      {formatDate(
                        selectedCrewInvoiceRecord.job.completedTime ||
                          selectedCrewInvoiceRecord.job.completedAt,
                      )}
                    </p>
                  </div>
                  <div>
                    <span className="detail-label">AMS Notes</span>
                    <p>
                      {selectedCrewInvoiceRecord.invoice.notes ||
                        "No notes yet."}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState
                title="No invoice selected"
                text="Select a submitted invoice to view details."
              />
            )}
          </PageSection>
        </div>
      ) : (
        <EmptyState
          title="No invoices yet"
          text="Completed job invoice tracking will appear here."
        />
      )}
    </PageSection>
  );

  const completedJobsScreen = (
    <div className="screen-grid vendor-screen">
      <PageSection title="Completed Jobs">
        <div className="list-scroll compact-scroll contained-scroll">
          <DataTable
            columns={[
              { key: "site", label: "Site", render: (row) => row.siteName },
              {
                key: "service",
                label: "Service",
                render: (row) => row.servicePerformed || row.serviceType,
              },
              {
                key: "start",
                label: "Start Time",
                render: (row) => formatDate(row.startTime),
              },
              {
                key: "end",
                label: "Completion Time",
                render: (row) => formatDate(row.completedTime),
              },
              {
                key: "invoice",
                label: "Invoice",
                render: (row) =>
                  getInvoiceForJob(appState.invoices, row.id)?.status ||
                  "Not Invoiced",
              },
            ]}
            rows={completedCrewJobs}
            emptyTitle="No completed jobs"
            emptyText="Completed crew jobs will appear here."
          />
        </div>
      </PageSection>
    </div>
  );

  const crewDashboard = (
    <div className="screen-grid vendor-screen">
      <PageSection title="My Jobs">
        {activeCrewJobs.length ? (
          <div className="job-card-grid">
            {activeCrewJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onStart={(jobId) => openJobConfirmation("start", jobId)}
                onComplete={(jobId) => openJobConfirmation("complete", jobId)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No active jobs"
            text="Assigned active jobs will appear here."
          />
        )}
      </PageSection>
      {crewAvailableWorkSection}
      {completedJobsScreen}
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
            {
              key: "vendor",
              label: "Vendor",
              render: (row) => row.companyName,
            },
            {
              key: "contact",
              label: "Contact",
              render: (row) => row.contactName,
            },
            {
              key: "phone",
              label: "Phone",
              render: (row) => <a href={`tel:${row.phone}`}>{row.phone}</a>,
            },
            {
              key: "sites",
              label: "Assigned Sites",
              render: (row) =>
                appState.sites.filter(
                  (site) => site.assignedVendorId === row.id,
                ).length,
            },
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
        <StatGrid
          items={[
            {
              label: "Firebase Auth Mapping",
              value: Object.keys(FIREBASE_ROLE_BRIDGE || {}).length,
            },
            {
              label: "Active Users",
              value: appState.users.filter((user) => user.active).length,
            },
            {
              label: "Pending Vendor Auth",
              value: normalizedVendors.filter(
                (vendor) => vendor.authStatus === "Pending",
              ).length,
            },
            {
              label: "Invoices Rejected",
              value: appState.invoices.filter(
                (invoice) => invoice.status === "Rejected",
              ).length,
            },
          ]}
        />
      </PageSection>
    </div>
  );

  const internalNotesScreen = (
    <div className="screen-grid">
      <PageSection title="Internal Notes">
        <div className="detail-stack">
          <div className="detail-card">
            <span className="detail-label">Owner Note</span>
            <p>
              Owner portal remains hidden and only opens for the mapped platform
              account.
            </p>
          </div>
          <div className="detail-card">
            <span className="detail-label">Operational Note</span>
            <p>
              Cold starts return to splash and login, while in-session
              navigation is preserved until the app is fully closed.
            </p>
          </div>
          <div className="detail-card">
            <span className="detail-label">Data Note</span>
            <p>
              Operational Sites, Work Orders, Jobs, and Vendors load from
              Firestore. Empty Firestore collections show clean empty states.
            </p>
          </div>
        </div>
      </PageSection>
    </div>
  );

  const systemControlsScreen = (
    <div className="screen-grid">
      <PageSection title="System Controls">
        <div className="form-actions">
          <button
            className="secondary-button"
            onClick={() =>
              window.alert(
                "Firebase Auth and Firestore role routing are active.",
              )
            }
          >
            Auth Status
          </button>
          <button
            className="secondary-button"
            onClick={() =>
              window.alert(
                "Operational Work Orders, Jobs, and Vendors are loaded from Firestore. Session state only preserves navigation while the app is open.",
              )
            }
          >
            Session Policy
          </button>
          <button
            className="secondary-button"
            onClick={() =>
              window.alert(
                "Audit log is reserved as a placeholder for the next controlled release.",
              )
            }
          >
            Audit Queue
          </button>
        </div>
      </PageSection>
    </div>
  );

  const reportsScreen = (
    <div className="screen-grid">
      <PageSection title="Reports">
        <StatGrid
          items={[
            {
              label: "Completed Jobs",
              value: appState.jobs.filter((job) => job.status === "Completed")
                .length,
            },
            { label: "Ready for Invoice", value: readyForInvoiceJobs.length },
            {
              label: "Needs Attention",
              value: appState.workOrders.filter(
                (workOrder) => workOrder.status === "Needs Attention",
              ).length,
            },
            {
              label: "Open Opportunities",
              value: appState.workOrders.filter(
                (workOrder) => workOrder.status === "Open",
              ).length,
            },
          ]}
        />
      </PageSection>
    </div>
  );

  const usersScreen = (
    <div className="screen-grid">
      <PageSection title="User Management">
        <InputRow>
          <Field label="Full Name">
            <input
              value={userForm.name}
              onChange={(event) =>
                setUserForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Email">
            <input
              value={userForm.email}
              onChange={(event) =>
                setUserForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              value={userForm.password}
              onChange={(event) =>
                setUserForm((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Phone Number">
            <input
              value={userForm.phone}
              onChange={(event) =>
                setUserForm((current) => ({
                  ...current,
                  phone: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Job Title">
            <input
              value={userForm.jobTitle}
              onChange={(event) =>
                setUserForm((current) => ({
                  ...current,
                  jobTitle: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Company Name">
            <input
              value={userForm.companyName}
              onChange={(event) =>
                setUserForm((current) => ({
                  ...current,
                  companyName: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Street Address">
            <input
              value={userForm.streetAddress}
              onChange={(event) =>
                setUserForm((current) => ({
                  ...current,
                  streetAddress: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="City">
            <input
              value={userForm.city}
              onChange={(event) =>
                setUserForm((current) => ({
                  ...current,
                  city: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="State">
            <input
              value={userForm.state}
              onChange={(event) =>
                setUserForm((current) => ({
                  ...current,
                  state: event.target.value.toUpperCase(),
                }))
              }
            />
          </Field>
          <Field label="ZIP">
            <input
              value={userForm.zip}
              onChange={(event) =>
                setUserForm((current) => ({
                  ...current,
                  zip: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Access Status">
            <select
              value={userForm.accessStatus}
              onChange={(event) =>
                setUserForm((current) => ({
                  ...current,
                  accessStatus: event.target.value,
                }))
              }
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </Field>
          <Field label="Auth Status">
            <select
              value={userForm.authStatus}
              onChange={(event) =>
                setUserForm((current) => ({
                  ...current,
                  authStatus: event.target.value,
                }))
              }
            >
              <option value="Active">Active</option>
              <option value="Pending">Pending</option>
              <option value="Disabled">Disabled</option>
            </select>
          </Field>
          <Field label="Internal Notes">
            <textarea
              rows="4"
              value={userForm.internalNotes}
              onChange={(event) =>
                setUserForm((current) => ({
                  ...current,
                  internalNotes: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Role">
            <select
              value={userForm.role}
              onChange={(event) =>
                setUserForm((current) => ({
                  ...current,
                  role: event.target.value,
                }))
              }
            >
              {Object.values(ROLES).map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </Field>
        </InputRow>
        <div className="form-actions">
          <button className="primary-button" onClick={saveUser}>
            {editingUserId ? "Update User" : "Add User"}
          </button>
        </div>
      </PageSection>
      <PageSection title="Current Users">
        <DataTable
          columns={[
            { key: "name", label: "Name", render: (row) => row.name },
            { key: "email", label: "Email", render: (row) => row.email },
            {
              key: "phone",
              label: "Phone",
              render: (row) => row.phone || "Not set",
            },
            { key: "role", label: "Role", render: (row) => row.role },
            {
              key: "access",
              label: "Access Status",
              render: (row) =>
                row.accessStatus || (row.active ? "Active" : "Inactive"),
            },
            {
              key: "auth",
              label: "Auth Status",
              render: (row) => row.authStatus || "Active",
            },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div className="table-actions">
                  <button
                    className="secondary-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      startEditUser(row);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="secondary-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleUserActive(row.id);
                    }}
                  >
                    {row.active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    className="secondary-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      archiveUser(row.id);
                    }}
                  >
                    Archive
                  </button>
                  <button
                    className="secondary-button danger-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteUser(row.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              ),
            },
          ]}
          rows={ownerVisibleUsers}
          emptyTitle="No users"
          emptyText="Users added here will persist locally."
        />
      </PageSection>
    </div>
  );

  const siteImportValidCount = siteImportRows.filter((row) => row.valid).length;
  const siteImportInvalidCount = siteImportRows.filter(
    (row) => !row.valid,
  ).length;
  const canConfirmSiteImport =
    Boolean(siteImportRows.length) &&
    siteImportInvalidCount === 0 &&
    !siteImportLoading;

  const sitesScreen = (
    <div className="screen-grid">
      {sitesLoading ? (
        <div className="inline-notice info">Loading Firestore sites...</div>
      ) : null}
      {sitesError ? (
        <div className="inline-notice error">
          Firestore sites unavailable: {sitesError}.
        </div>
      ) : null}
      <PageSection
        title="Sites"
        action={
          <div className="form-actions">
            {isAmsViewer ? (
              <button className="secondary-button" onClick={openSiteImport}>
                Upload Sites
              </button>
            ) : null}
            <button
              className="primary-button"
              onClick={() => openModal("site")}
            >
              Create Site
            </button>
          </div>
        }
      >
        <SplitView
          list={
            <div className="list-stack">
              <SearchBar
                value={siteSearch}
                onChange={setSiteSearch}
                placeholder="Search sites"
              />
              <div className="list-scroll">
                <DataTable
                  columns={[
                    { key: "name", label: "Name", render: (row) => row.name },
                    {
                      key: "siteNumber",
                      label: "Site #",
                      render: (row) => row.siteNumber || "Not set",
                    },
                    {
                      key: "address",
                      label: "Address",
                      render: (row) => row.address,
                    },
                    {
                      key: "assigned",
                      label: "Primary Assigned Vendor",
                      render: (row) => row.assignedVendorName || "Unassigned",
                    },
                    {
                      key: "state",
                      label: "State",
                      render: (row) => row.state,
                    },
                  ]}
                  rows={filteredSites}
                  selectedRowId={appState.ui.selectedSiteId}
                  onRowClick={(row) => setSelectedSite(row.id)}
                  emptyTitle="No sites"
                  emptyText="Add a site to start routing work orders."
                />
              </div>
            </div>
          }
          detail={
            selectedSite ? (
              <div className="detail-stack">
                <SiteDetailsCard
                  site={selectedSite}
                  relatedWorkOrderCount={
                    appState.workOrders.filter(
                      (workOrder) => workOrder.siteId === selectedSite.id,
                    ).length
                  }
                  needsActionCount={selectedSiteNeedsActionCount}
                />
                <div className="detail-card">
                  <div className="proposal-summary-grid">
                    <div>
                      <span className="detail-label">Street Address</span>
                      <p>{selectedSite.streetAddress || "Not set"}</p>
                    </div>
                    <div>
                      <span className="detail-label">City</span>
                      <p>{selectedSite.city || "Not set"}</p>
                    </div>
                    <div>
                      <span className="detail-label">State</span>
                      <p>{selectedSite.state || "Not set"}</p>
                    </div>
                    <div>
                      <span className="detail-label">ZIP Code</span>
                      <p>{selectedSite.zip || "Not set"}</p>
                    </div>
                    <div>
                      <span className="detail-label">Manager</span>
                      <p>{selectedSite.manager || "Not set"}</p>
                    </div>
                    <div>
                      <span className="detail-label">Contact</span>
                      <p>{selectedSite.contact || "Not set"}</p>
                    </div>
                    <div>
                      <span className="detail-label">
                        Primary Assigned Vendor
                      </span>
                      <p>{selectedSite.assignedVendorName || "Unassigned"}</p>
                    </div>
                    <div>
                      <span className="detail-label">Vendor Contact</span>
                      <p>
                        {selectedSite.assignedCrewContactName ||
                          normalizedVendors.find(
                            (vendor) =>
                              vendor.id === selectedSite.assignedVendorId,
                          )?.contactName ||
                          "Not set"}
                      </p>
                    </div>
                    <div>
                      <span className="detail-label">Vendor Phone</span>
                      <p>
                        {normalizedVendors.find(
                          (vendor) =>
                            vendor.id === selectedSite.assignedVendorId,
                        )?.phone ? (
                          <a
                            href={`tel:${normalizedVendors.find((vendor) => vendor.id === selectedSite.assignedVendorId)?.phone}`}
                          >
                            {
                              normalizedVendors.find(
                                (vendor) =>
                                  vendor.id === selectedSite.assignedVendorId,
                              )?.phone
                            }
                          </a>
                        ) : (
                          "Not set"
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="detail-label">Vendor Email</span>
                      <p>
                        {normalizedVendors.find(
                          (vendor) =>
                            vendor.id === selectedSite.assignedVendorId,
                        )?.email || "Not set"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="proposal-summary-grid">
                  <article className="detail-card">
                    <span className="detail-label">Site Map</span>
                    <p>{selectedSite.siteMapStatus}</p>
                  </article>
                  <article className="detail-card">
                    <span className="detail-label">Geo Fence</span>
                    <p>{selectedSite.geoFenceStatus}</p>
                  </article>
                </div>
                <PageSection title="Site Service Log">
                  <div className="list-scroll compact-scroll contained-scroll">
                    <DataTable
                      columns={[
                        {
                          key: "date",
                          label: "Date of Service",
                          render: (row) =>
                            formatDate(row.completedAt || row.canceledAt),
                        },
                        {
                          key: "service",
                          label: "Service Performed",
                          render: (row) => row.serviceType,
                        },
                        {
                          key: "workType",
                          label: "Work Type",
                          render: (row) => getWorkTypeLabel(row.workType),
                        },
                        {
                          key: "vendor",
                          label: "Vendor",
                          render: (row) => row.vendorName,
                        },
                        {
                          key: "status",
                          label: "Status",
                          render: (row) => <StatusBadge value={row.status} />,
                        },
                        {
                          key: "start",
                          label: "Start Time",
                          render: (row) => formatDate(row.startTime),
                        },
                        {
                          key: "end",
                          label: "Completion Time",
                          render: (row) => formatDate(row.completedAt),
                        },
                        {
                          key: "scope",
                          label: "Scope",
                          render: (row) =>
                            row.scope || row.description || "No scope notes",
                        },
                        {
                          key: "wo",
                          label: "AMS Work Order",
                          render: (row) =>
                            row.workOrder?.amsWorkOrderNumber ||
                            "Not available",
                        },
                        {
                          key: "invoice",
                          label: "Invoice Status",
                          render: (row) =>
                            row.invoice?.status || "Not Invoiced",
                        },
                      ]}
                      rows={selectedSiteServiceLog}
                      emptyTitle="No site service history"
                      emptyText="Completed and canceled services for this site will appear here."
                    />
                  </div>
                </PageSection>
                <div className="form-actions">
                  <button
                    className="secondary-button"
                    onClick={() => startEditSite(selectedSite)}
                  >
                    Edit Site
                  </button>
                  <button
                    className="secondary-button danger-button"
                    onClick={() => removeSite(selectedSite.id)}
                  >
                    Remove Site
                  </button>
                </div>
              </div>
            ) : (
              <EmptyState
                title="No site selected"
                text="Select a site to view details."
              />
            )
          }
        />
      </PageSection>
    </div>
  );

  const crewsScreen = (
    <div className="screen-grid">
      {vendorsLoading ? (
        <div className="inline-notice info">Loading Firestore vendors...</div>
      ) : null}
      {vendorsError ? (
        <div className="inline-notice error">
          Firestore vendors unavailable: {vendorsError}.
        </div>
      ) : null}
      <PageSection
        title="Vendors"
        action={
          <button
            className="primary-button"
            onClick={() => openModal("vendor")}
          >
            Add Vendor
          </button>
        }
      >
        <SplitView
          list={
            <div className="list-stack">
              <SearchBar
                value={crewSearch}
                onChange={setCrewSearch}
                placeholder="Search vendors"
              />
              <div className="list-scroll">
                <DataTable
                  columns={[
                    {
                      key: "company",
                      label: "Vendor Company",
                      render: (row) => row.companyName || row.name,
                    },
                    {
                      key: "contact",
                      label: "Vendor Contact",
                      render: (row) => row.contactName || "Not set",
                    },
                    {
                      key: "serviceType",
                      label: "Primary Service",
                      render: (row) => row.serviceType,
                    },
                    {
                      key: "states",
                      label: "States",
                      render: (row) => row.states.join(", "),
                    },
                    {
                      key: "status",
                      label: "Status",
                      render: (row) => (row.active ? "Active" : "Inactive"),
                    },
                  ]}
                  rows={filteredCrews}
                  selectedRowId={selectedCrew?.id}
                  onRowClick={(row) => setSelectedCrewId(row.id)}
                  emptyTitle="No vendors"
                  emptyText="Add a vendor before assigning jobs."
                />
              </div>
            </div>
          }
          detail={
            selectedCrew ? (
              <div className="detail-card">
                <div className="proposal-summary-top">
                  <div>
                    <strong>
                      {selectedCrew.companyName || selectedCrew.name}
                    </strong>
                    <p>{selectedCrew.serviceType}</p>
                  </div>
                  <StatusBadge
                    value={selectedCrew.active ? "active" : "inactive"}
                    label={selectedCrew.active ? "Active" : "Inactive"}
                  />
                </div>
                <div className="proposal-summary-grid">
                  <div>
                    <span className="detail-label">Vendor Company</span>
                    <p>{selectedCrew.companyName || "Not set"}</p>
                  </div>
                  <div>
                    <span className="detail-label">Vendor Contact</span>
                    <p>{selectedCrew.contactName || "Not set"}</p>
                  </div>
                  <div>
                    <span className="detail-label">Phone</span>
                    <p>
                      {selectedCrew.phone ? (
                        <a href={`tel:${selectedCrew.phone}`}>
                          {selectedCrew.phone}
                        </a>
                      ) : (
                        "Not set"
                      )}
                    </p>
                  </div>
                  <div>
                    <span className="detail-label">Email</span>
                    <p>{selectedCrew.email || "Not set"}</p>
                  </div>
                  <div>
                    <span className="detail-label">Address</span>
                    <p>{selectedCrew.address || "Not set"}</p>
                  </div>
                  <div>
                    <span className="detail-label">Service Types</span>
                    <p>{selectedCrew.serviceTypes.join(", ")}</p>
                  </div>
                  <div>
                    <span className="detail-label">Coverage</span>
                    <p>{selectedCrew.states.join(", ") || "Not set"}</p>
                  </div>
                  <div>
                    <span className="detail-label">Linked Login</span>
                    <p>{selectedCrew.email || "Not linked"}</p>
                  </div>
                  <div>
                    <span className="detail-label">Internal Notes</span>
                    <p>{selectedCrew.internalNotes || "No internal notes"}</p>
                  </div>
                </div>
                <div className="form-actions">
                  <button
                    className="secondary-button"
                    onClick={() => startEditVendor(selectedCrew)}
                  >
                    Edit Vendor
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => toggleVendorActive(selectedCrew.id)}
                  >
                    {selectedCrew.active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    className="secondary-button danger-button"
                    onClick={() => removeVendor(selectedCrew.id)}
                  >
                    Remove Vendor
                  </button>
                </div>
              </div>
            ) : (
              <EmptyState
                title="No vendor selected"
                text="Select a vendor to view details."
              />
            )
          }
        />
      </PageSection>
    </div>
  );

  const jobsScreen = (
    <div className="screen-grid">
      {sellSaveNotice ? (
        <div className={`inline-notice ${sellSaveNotice.type}`}>
          {sellSaveNotice.message}
        </div>
      ) : null}
      {jobsLoading ? (
        <div className="inline-notice info">Loading Firestore jobs...</div>
      ) : null}
      {jobsError ? (
        <div className="inline-notice error">
          Firestore jobs unavailable: {jobsError}.
        </div>
      ) : null}
      <PageSection
        title="Jobs"
        action={
          <button className="primary-button" onClick={() => openModal("job")}>
            Create Job
          </button>
        }
      >
        <SplitView
          list={
            <div className="list-stack">
              <div className="list-toolbar">
                <SearchBar
                  value={jobSearch}
                  onChange={setJobSearch}
                  placeholder="Search jobs"
                />
                <FilterRow
                  label="Filter"
                  value={jobFilter}
                  options={JOB_FILTERS}
                  onChange={setJobFilter}
                />
              </div>
              <div className="list-scroll">
                <DataTable
                  columns={[
                    {
                      key: "siteName",
                      label: "Site",
                      render: (row) => row.siteName,
                    },
                    {
                      key: "vendorName",
                      label: "Crew",
                      render: (row) => row.vendorName || "Unassigned",
                    },
                    {
                      key: "serviceType",
                      label: "Service Type",
                      render: (row) => row.serviceType,
                    },
                    ...(AMS_ROLES.includes(currentUser?.role) ||
                    currentUser?.role === ROLES.OWNER
                      ? [
                          {
                            key: "pricingStatus",
                            label: "Pricing",
                            render: (row) => (
                              <StatusBadge
                                value={getPricingStatus(row)}
                                label={
                                  getPricingStatus(row) === "set"
                                    ? "Sell Set"
                                    : "Sell Not Set"
                                }
                              />
                            ),
                          },
                        ]
                      : []),
                    {
                      key: "status",
                      label: "Status",
                      render: (row) => <StatusBadge value={row.status} />,
                    },
                  ]}
                  rows={filteredJobs}
                  selectedRowId={selectedJob?.id}
                  onRowClick={(row) => setSelectedJobId(row.id)}
                  emptyTitle="No jobs available"
                  emptyText="Assign crews from work orders or approve a proposal to create jobs."
                />
              </div>
            </div>
          }
          detail={
            selectedJob ? (
              <div className="detail-card">
                <div className="proposal-summary-top">
                  <div>
                    <strong>{selectedJob.siteName}</strong>
                    <p>{selectedJob.description}</p>
                  </div>
                  <StatusBadge value={selectedJob.status} />
                </div>
                <div className="proposal-summary-grid">
                  <div>
                    <span className="detail-label">Crew</span>
                    <p>{selectedJob.vendorName || "Unassigned"}</p>
                  </div>
                  <div>
                    <span className="detail-label">Service Type</span>
                    <p>{selectedJob.serviceType}</p>
                  </div>
                  <div>
                    <span className="detail-label">Work Type</span>
                    <p>{getWorkTypeLabel(selectedJob.workType)}</p>
                  </div>
                  <div>
                    <span className="detail-label">Cost</span>
                    <p>{formatMoney(getJobCostValue(selectedJob))}</p>
                  </div>
                  {selectedJob.workType === "recurring" && isAmsViewer ? (
                    <div>
                      <span className="detail-label">
                        Recurring Vendor Cost
                      </span>
                      <p>{formatMoney(selectedJob.recurringVendorCost)}</p>
                    </div>
                  ) : null}
                  {AMS_ROLES.includes(currentUser?.role) ||
                  currentUser?.role === ROLES.OWNER ? (
                    <>
                      <div>
                        <span className="detail-label">Sell</span>
                        <p>{formatMoney(getJobSellValue(selectedJob))}</p>
                      </div>
                      <div>
                        <span className="detail-label">Pricing Status</span>
                        <p>
                          <StatusBadge
                            value={getPricingStatus(selectedJob)}
                            label={
                              getPricingStatus(selectedJob) === "set"
                                ? "Sell Set"
                                : "Sell Not Set"
                            }
                          />
                        </p>
                      </div>
                      <div>
                        <span className="detail-label">Sell Set By</span>
                        <p>
                          {appState.users.find(
                            (user) => user.id === selectedJob.sellSetBy,
                          )?.name || "Not set"}
                        </p>
                      </div>
                      <div>
                        <span className="detail-label">Sell Set At</span>
                        <p>
                          {selectedJob.sellSetAt
                            ? formatDate(selectedJob.sellSetAt)
                            : "Not set"}
                        </p>
                      </div>
                    </>
                  ) : null}
                  <div>
                    <span className="detail-label">Invoice</span>
                    <p>
                      {getInvoiceForJob(appState.invoices, selectedJob.id)
                        ?.invoiceNumber || "Not created"}
                    </p>
                  </div>
                </div>
                <Field label="Job Status">
                  <select
                    value={selectedJob.status}
                    onChange={(event) =>
                      updateJobStatus(selectedJob.id, event.target.value)
                    }
                  >
                    {JOB_STATUS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </Field>
                {isAmsViewer ? (
                  <SellControl
                    sellValue={getJobSellDraft(selectedJob)}
                    costValue={getJobCostValue(selectedJob)}
                    pricingStatus={getPricingStatus(selectedJob)}
                    editing={
                      editingJobSellId === selectedJob.id ||
                      getPricingStatus(selectedJob) !== "set"
                    }
                    onStartEdit={() => startJobSellEdit(selectedJob)}
                    onChange={(value) =>
                      updateJobSellDraft(selectedJob.id, value)
                    }
                    onSave={() => saveJobSellForJob(selectedJob)}
                  />
                ) : null}
              </div>
            ) : (
              <EmptyState
                title="No job selected"
                text="Select a job to view details."
              />
            )
          }
        />
      </PageSection>
    </div>
  );

  const workOrdersScreen = (
    <div className="screen-grid">
      <PageSection
        title="Work Orders"
        action={
          <button
            className="primary-button"
            onClick={() => openModal("workOrder")}
          >
            Create Work Order
          </button>
        }
      >
        {sellSaveNotice ? (
          <div className={`inline-notice ${sellSaveNotice.type}`}>
            {sellSaveNotice.message}
          </div>
        ) : null}
        {workOrdersLoading ? (
          <div className="inline-notice info">
            Loading Firestore work orders...
          </div>
        ) : null}
        {workOrdersError ? (
          <div className="inline-notice error">
            Firestore work orders unavailable: {workOrdersError}.
          </div>
        ) : null}
        <SplitView
          list={
            <div className="list-stack">
              <div className="list-toolbar">
                <SearchBar
                  value={workOrderSearch}
                  onChange={setWorkOrderSearch}
                  placeholder="Search work orders"
                />
                <FilterRow
                  label="Filter"
                  value={workOrderFilter}
                  options={WORK_ORDER_FILTERS}
                  onChange={setWorkOrderFilter}
                />
              </div>
              <div className="list-scroll">
                <DataTable
                  columns={[
                    {
                      key: "reference",
                      label: "AMS Ref",
                      render: (row) => row.amsWorkOrderNumber,
                    },
                    ...(showExternalWorkOrder
                      ? [
                          {
                            key: "external",
                            label: "External Ref",
                            render: (row) =>
                              row.externalWorkOrderNumber || "Not set",
                          },
                        ]
                      : []),
                    {
                      key: "siteName",
                      label: "Site",
                      render: (row) => row.siteName,
                    },
                    {
                      key: "serviceType",
                      label: "Service Type",
                      render: (row) => row.serviceType,
                    },
                    {
                      key: "bids",
                      label: "Bids",
                      render: (row) =>
                        getBidCountForWorkOrder(appState.proposals, row.id),
                    },
                    {
                      key: "status",
                      label: "Status",
                      render: (row) => <WorkOrderStatusBadge workOrder={row} />,
                    },
                  ]}
                  rows={filteredWorkOrders}
                  selectedRowId={selectedWorkOrder?.id}
                  onRowClick={(row) => selectWorkOrder(row.id)}
                  emptyTitle="No work orders available"
                  emptyText="New work orders will appear here."
                />
              </div>
            </div>
          }
          detail={
            selectedWorkOrder ? (
              <div className="detail-stack">
                <div className="proposal-review-summary">
                  <div className="proposal-summary-top">
                    <div>
                      <strong>{selectedWorkOrder.siteName}</strong>
                      <p>{selectedWorkOrder.description}</p>
                    </div>
                    <div className="proposal-summary-badges">
                      {shouldShowProposalStateBadge(selectedWorkOrder) ? (
                        <ProposalStateBadge
                          value={selectedWorkOrder.proposalState}
                        />
                      ) : null}
                      <WorkOrderStatusBadge workOrder={selectedWorkOrder} />
                    </div>
                  </div>
                  <div className="proposal-summary-grid">
                    <div>
                      <span className="detail-label">AMS Work Order</span>
                      <p>{selectedWorkOrder.amsWorkOrderNumber}</p>
                    </div>
                    <div>
                      <span className="detail-label">Service Type</span>
                      <p>{selectedWorkOrder.serviceType}</p>
                    </div>
                    <div>
                      <span className="detail-label">Work Type</span>
                      <p>{getWorkTypeLabel(selectedWorkOrder.workType)}</p>
                    </div>
                    <div>
                      <span className="detail-label">
                        Primary Assigned Vendor
                      </span>
                      <p>
                        {selectedWorkOrder.assignedVendorName || "Not assigned"}
                      </p>
                    </div>
                    <div>
                      <span className="detail-label">Bid Count</span>
                      <p>
                        {getBidCountForWorkOrder(
                          appState.proposals,
                          selectedWorkOrder.id,
                        )}
                      </p>
                    </div>
                    {selectedWorkOrder.workType === "recurring" &&
                    isAmsViewer ? (
                      <div>
                        <span className="detail-label">
                          Recurring Vendor Cost
                        </span>
                        <p>
                          {formatMoney(selectedWorkOrder.recurringVendorCost)}
                        </p>
                      </div>
                    ) : null}
                    <div>
                      <span className="detail-label">Job Link</span>
                      <p>{selectedWorkOrder.jobId || "No job created yet"}</p>
                    </div>
                    <div>
                      <span className="detail-label">Proposal Requested</span>
                      <p>{formatDate(selectedWorkOrder.proposalRequestedAt)}</p>
                    </div>
                    <div>
                      <span className="detail-label">Proposal Awarded</span>
                      <p>{formatDate(selectedWorkOrder.proposalAwardedAt)}</p>
                    </div>
                  </div>
                  <InputRow>
                    {showExternalWorkOrder ? (
                      <Field label="External Work Order Number">
                        <input
                          value={workOrderDetailForm.externalWorkOrderNumber}
                          onChange={(event) =>
                            setWorkOrderDetailForm((current) => ({
                              ...current,
                              externalWorkOrderNumber: event.target.value,
                            }))
                          }
                        />
                      </Field>
                    ) : null}
                    <Field label="Before / After Photos Required">
                      <select
                        value={
                          workOrderDetailForm.requireBeforeAfterPhotos
                            ? "yes"
                            : "no"
                        }
                        onChange={(event) =>
                          setWorkOrderDetailForm((current) => ({
                            ...current,
                            requireBeforeAfterPhotos:
                              event.target.value === "yes",
                          }))
                        }
                      >
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </Field>
                    {selectedWorkOrder.workType === "recurring" &&
                    isAmsViewer ? (
                      <Field label="Vendor Cost">
                        <input
                          value={workOrderDetailForm.recurringVendorCost}
                          onChange={(event) =>
                            setWorkOrderDetailForm((current) => ({
                              ...current,
                              recurringVendorCost: event.target.value,
                            }))
                          }
                          placeholder="Enter recurring vendor cost"
                        />
                      </Field>
                    ) : null}
                  </InputRow>
                  <div className="form-actions">
                    <button
                      className="secondary-button"
                      onClick={saveWorkOrderDetail}
                    >
                      Save Detail Updates
                    </button>
                    <button
                      className="secondary-button"
                      onClick={() =>
                        showPlaceholder(
                          "File and image uploads require backend support and will be added in a later build.",
                        )
                      }
                    >
                      Attach File / Upload Picture
                    </button>
                  </div>
                </div>
                {isAmsViewer && selectedWorkOrderJob ? (
                  <div className="detail-card">
                    <SellControl
                      sellValue={getJobSellDraft(selectedWorkOrderJob)}
                      costValue={getJobCostValue(selectedWorkOrderJob)}
                      pricingStatus={getPricingStatus(selectedWorkOrderJob)}
                      editing={
                        editingJobSellId === selectedWorkOrderJob.id ||
                        getPricingStatus(selectedWorkOrderJob) !== "set"
                      }
                      onStartEdit={() => startJobSellEdit(selectedWorkOrderJob)}
                      onChange={(value) =>
                        updateJobSellDraft(selectedWorkOrderJob.id, value)
                      }
                      onSave={() => saveJobSellForJob(selectedWorkOrderJob)}
                    />
                  </div>
                ) : null}
                {selectedWorkOrder.proposalRequired ? (
                  <>
                    <PageSection
                      title={`Proposal Review List (${getBidCountForWorkOrder(appState.proposals, selectedWorkOrder.id)} bids)`}
                    >
                      <div className="proposal-list-scroll">
                        <DataTable
                          columns={[
                            {
                              key: "vendor",
                              label: "Crew",
                              render: (row) => row.vendorCompanyName,
                            },
                            {
                              key: "submittedPrice",
                              label: "Submitted Cost",
                              render: (row) => formatMoney(row.submittedPrice),
                            },
                            {
                              key: "reviewedPrice",
                              label: "Reviewed Cost",
                              render: (row) => formatMoney(row.reviewedPrice),
                            },
                            {
                              key: "status",
                              label: "Status",
                              render: (row) => (
                                <ProposalStatusBadge value={row.status} />
                              ),
                            },
                            {
                              key: "submittedAt",
                              label: "Submitted At",
                              render: (row) => formatDate(row.submittedAt),
                            },
                          ]}
                          rows={selectedWorkOrderProposals}
                          selectedRowId={selectedWorkOrderProposal?.id}
                          onRowClick={(row) => setSelectedProposalId(row.id)}
                          emptyTitle="No proposals"
                          emptyText="Crew proposals will appear here."
                        />
                      </div>
                      {selectedWorkOrderBidderNames.length ? (
                        <p className="detail-muted">
                          Bidders: {selectedWorkOrderBidderNames.join(", ")}
                        </p>
                      ) : null}
                    </PageSection>
                    <PageSection title="Proposal Decision Panel">
                      {renderProposalDecision(
                        selectedWorkOrderProposal,
                        selectedWorkOrder,
                      )}
                    </PageSection>
                  </>
                ) : (
                  <div className="detail-card">
                    <div className="proposal-summary-grid">
                      <div>
                        <span className="detail-label">Assignment</span>
                        <div className="assignment-cell">
                          <select
                            value={
                              jobAssignment[selectedWorkOrder.id] ||
                              selectedWorkOrder.assignedVendorId ||
                              ""
                            }
                            disabled={Boolean(
                              appState.jobs.find(
                                (job) =>
                                  job.workOrderId === selectedWorkOrder.id,
                              ),
                            )}
                            onChange={(event) =>
                              setJobAssignment((current) => ({
                                ...current,
                                [selectedWorkOrder.id]: event.target.value,
                              }))
                            }
                          >
                            <option value="">Select vendor</option>
                            {normalizedVendors
                              .filter((vendor) => vendor.active)
                              .map((vendor) => (
                                <option key={vendor.id} value={vendor.id}>
                                  {vendor.companyName || vendor.name}
                                </option>
                              ))}
                          </select>
                          <button
                            className="secondary-button"
                            disabled={Boolean(
                              appState.jobs.find(
                                (job) =>
                                  job.workOrderId === selectedWorkOrder.id,
                              ),
                            )}
                            onClick={() =>
                              assignVendorToWorkOrder(selectedWorkOrder.id)
                            }
                          >
                            Assign + Create Job
                          </button>
                        </div>
                      </div>
                      <div>
                        <span className="detail-label">Work Order Status</span>
                        <select
                          value={selectedWorkOrder.status}
                          onChange={(event) =>
                            updateWorkOrderStatus(
                              selectedWorkOrder.id,
                              event.target.value,
                            )
                          }
                        >
                          {WORK_ORDER_STATUS.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState
                title="No work order selected"
                text="Select a work order to review details."
              />
            )
          }
        />
      </PageSection>
    </div>
  );

  const proposalsScreen = (
    <div className="screen-grid">
      {proposalsLoading ? (
        <div className="inline-notice info">Loading Firestore proposals...</div>
      ) : null}
      {proposalsError ? (
        <div className="inline-notice error">
          Firestore proposals unavailable: {proposalsError}
        </div>
      ) : null}
      <PageSection title="Proposal Pipeline">
        <StatGrid
          items={[
            {
              label: "Pending",
              value: appState.proposals.filter(
                (proposal) => proposal.status === "submitted",
              ).length,
            },
            {
              label: "Active",
              value: appState.proposals.filter(
                (proposal) => proposal.isActivePath,
              ).length,
            },
            {
              label: "Approved",
              value: appState.proposals.filter(
                (proposal) => proposal.status === "approved",
              ).length,
            },
            {
              label: "Rejected",
              value: appState.proposals.filter(
                (proposal) => proposal.status === "rejected",
              ).length,
            },
            {
              label: "Revision Needed",
              value: appState.proposals.filter(
                (proposal) => proposal.status === "revision_requested",
              ).length,
            },
          ]}
        />
      </PageSection>
      <PageSection title="Proposals">
        <SplitView
          list={
            <div className="list-stack">
              <div className="list-toolbar">
                <SearchBar
                  value={proposalSearch}
                  onChange={setProposalSearch}
                  placeholder="Search proposals"
                />
                <FilterRow
                  label="Status"
                  value={proposalStatusFilter}
                  options={[
                    "All",
                    "submitted",
                    "revision_requested",
                    "approved",
                    "rejected",
                    "withdrawn",
                  ]}
                  onChange={setProposalStatusFilter}
                />
              </div>
              <div className="list-scroll">
                <DataTable
                  columns={[
                    {
                      key: "crew",
                      label: "Crew",
                      render: (row) => row.vendorCompanyName,
                    },
                    {
                      key: "site",
                      label: "Site",
                      render: (row) =>
                        appState.workOrders.find(
                          (entry) => entry.id === row.workOrderId,
                        )?.siteName ||
                        row.siteName ||
                        "Unknown",
                    },
                    {
                      key: "price",
                      label: "Submitted Cost",
                      render: (row) => formatMoney(row.submittedPrice),
                    },
                    {
                      key: "reviewedPrice",
                      label: "Reviewed Cost",
                      render: (row) => formatMoney(row.reviewedPrice),
                    },
                    {
                      key: "status",
                      label: "Status",
                      render: (row) => (
                        <ProposalStatusBadge value={row.status} />
                      ),
                    },
                  ]}
                  rows={filteredProposals}
                  selectedRowId={selectedProposal?.id}
                  onRowClick={(row) => setSelectedProposalId(row.id)}
                  emptyTitle="No proposals"
                  emptyText="Proposal submissions will appear here."
                />
              </div>
            </div>
          }
          detail={
            <div className="detail-stack">
              <PageSection title="Work Order Summary">
                {selectedProposal ? (
                  (() => {
                    const workOrder = appState.workOrders.find(
                      (entry) => entry.id === selectedProposal.workOrderId,
                    );
                    return workOrder ? (
                      <div className="proposal-review-summary">
                        <div className="proposal-summary-top">
                          <div>
                            <strong>{workOrder.siteName}</strong>
                            <p>{workOrder.description}</p>
                          </div>
                          <div className="proposal-summary-badges">
                            {shouldShowProposalStateBadge(workOrder) ? (
                              <ProposalStateBadge
                                value={workOrder.proposalState}
                              />
                            ) : null}
                            <WorkOrderStatusBadge workOrder={workOrder} />
                          </div>
                        </div>
                        <div className="proposal-summary-grid">
                          <div>
                            <span className="detail-label">AMS Work Order</span>
                            <p>{workOrder.amsWorkOrderNumber}</p>
                          </div>
                          <div>
                            <span className="detail-label">Service Type</span>
                            <p>{workOrder.serviceType}</p>
                          </div>
                          {showExternalWorkOrder ? (
                            <div>
                              <span className="detail-label">External Ref</span>
                              <p>
                                {workOrder.externalWorkOrderNumber || "Not set"}
                              </p>
                            </div>
                          ) : null}
                          <div>
                            <span className="detail-label">
                              Photos Required
                            </span>
                            <p>
                              {workOrder.requireBeforeAfterPhotos
                                ? "Yes"
                                : "No"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <EmptyState
                        title="No work order found"
                        text="This proposal is missing its work order reference."
                      />
                    );
                  })()
                ) : (
                  <EmptyState
                    title="No proposal selected"
                    text="Choose a proposal to review."
                  />
                )}
              </PageSection>
              <PageSection title="Proposal Decision Panel">
                {renderProposalDecision(
                  selectedProposal,
                  selectedProposal
                    ? appState.workOrders.find(
                        (entry) => entry.id === selectedProposal.workOrderId,
                      )
                    : null,
                )}
              </PageSection>
            </div>
          }
        />
      </PageSection>
    </div>
  );

  const accountingScreen = (
    <div className="screen-grid accounting-screen">
      {sellSaveNotice ? (
        <div className={`inline-notice ${sellSaveNotice.type}`}>
          {sellSaveNotice.message}
        </div>
      ) : null}
      {invoicesLoading ? (
        <div className="inline-notice">Loading Firestore invoices...</div>
      ) : null}
      {invoicesError ? (
        <div className="inline-notice error">
          Invoice data could not be loaded: {invoicesError}
        </div>
      ) : null}
      <PageSection title="Accounting Snapshot">
        <StatGrid
          items={[
            { label: "Ready for Invoice", value: readyForInvoiceJobs.length },
            { label: "Sell Missing", value: jobsMissingSell.length },
            {
              label: "Submitted",
              value: appState.invoices.filter(
                (invoice) =>
                  normalizeInvoiceStatus(invoice.status) === "Submitted",
              ).length,
            },
            {
              label: "Approved",
              value: appState.invoices.filter(
                (invoice) =>
                  normalizeInvoiceStatus(invoice.status) === "Approved",
              ).length,
            },
            {
              label: "Rejected",
              value: appState.invoices.filter(
                (invoice) =>
                  normalizeInvoiceStatus(invoice.status) === "Rejected",
              ).length,
            },
            {
              label: "Paid",
              value: appState.invoices.filter(
                (invoice) => normalizeInvoiceStatus(invoice.status) === "Paid",
              ).length,
            },
          ]}
        />
      </PageSection>
      <SplitView
        list={
          <div className="detail-stack">
            <PageSection title="Ready for Invoice Queue">
              <div className="list-scroll compact-scroll contained-scroll">
                <DataTable
                  columns={[
                    {
                      key: "site",
                      label: "Site",
                      render: (row) => row.siteName,
                    },
                    {
                      key: "crew",
                      label: "Crew",
                      render: (row) => row.vendorName,
                    },
                    {
                      key: "service",
                      label: "Service Type",
                      render: (row) => row.serviceType,
                    },
                    {
                      key: "status",
                      label: "Job Status",
                      render: (row) => row.status,
                    },
                    {
                      key: "cost",
                      label: "Cost",
                      render: (row) => formatMoney(getJobCostValue(row)),
                    },
                    {
                      key: "sell",
                      label: "Sell",
                      render: (row) => formatMoney(getJobSellValue(row)),
                    },
                    {
                      key: "pricing",
                      label: "Pricing",
                      render: (row) => (
                        <StatusBadge
                          value={getPricingStatus(row)}
                          label={
                            getPricingStatus(row) === "set"
                              ? "Sell Set"
                              : "Sell Not Set"
                          }
                        />
                      ),
                    },
                    {
                      key: "action",
                      label: "Action",
                      render: () => (
                        <span className="detail-muted">
                          Awaiting crew submission
                        </span>
                      ),
                    },
                  ]}
                  rows={readyForInvoiceJobs}
                  emptyTitle="No jobs ready"
                  emptyText="Completed jobs without invoices will appear here."
                />
              </div>
            </PageSection>
            <PageSection title="Invoice Tracker">
              <div className="list-stack">
                <div className="list-toolbar">
                  <SearchBar
                    value={invoiceSearch}
                    onChange={setInvoiceSearch}
                    placeholder="Search invoices"
                  />
                  <FilterRow
                    label="Status"
                    value={invoiceStatusFilter}
                    options={["All", ...INVOICE_STATUS]}
                    onChange={setInvoiceStatusFilter}
                  />
                </div>
                <div className="list-scroll compact-scroll contained-scroll">
                  <DataTable
                    columns={[
                      {
                        key: "invoiceNumber",
                        label: "Invoice Number",
                        render: (row) => row.invoiceNumber || "Not set",
                      },
                      {
                        key: "site",
                        label: "Site",
                        render: (row) => row.siteName,
                      },
                      {
                        key: "crew",
                        label: "Crew",
                        render: (row) => row.vendorName,
                      },
                      {
                        key: "amount",
                        label: "Cost",
                        render: (row) => formatMoney(row.amount),
                      },
                      {
                        key: "submittedAt",
                        label: "Submitted At",
                        render: (row) => formatDate(row.submittedAt),
                      },
                      {
                        key: "status",
                        label: "Status",
                        render: (row) => (
                          <InvoiceStatusBadge value={row.status} />
                        ),
                      },
                      {
                        key: "download",
                        label: "Download",
                        render: (row) => (
                          <button
                            className="secondary-button"
                            disabled={
                              !["Approved", "Paid"].includes(row.status)
                            }
                            onClick={(event) => {
                              event.stopPropagation();
                              downloadInvoice(row);
                            }}
                          >
                            Download Invoice
                          </button>
                        ),
                      },
                    ]}
                    rows={filteredInvoices}
                    selectedRowId={selectedInvoice?.id}
                    onRowClick={(row) => setSelectedInvoiceId(row.id)}
                    emptyTitle="No invoices"
                    emptyText="Invoice records will appear here."
                  />
                </div>
              </div>
            </PageSection>
          </div>
        }
        detail={
          <PageSection title="Invoice Editor Panel">
            {selectedInvoice ? (
              <div className="detail-stack">
                <div className="proposal-summary-grid">
                  <div>
                    <span className="detail-label">Site</span>
                    <p>{selectedInvoice.siteName}</p>
                  </div>
                  <div>
                    <span className="detail-label">Crew</span>
                    <p>{selectedInvoice.vendorName}</p>
                  </div>
                  <div>
                    <span className="detail-label">Service Type</span>
                    <p>{selectedInvoice.serviceType}</p>
                  </div>
                  <div>
                    <span className="detail-label">Job Status</span>
                    <p>
                      {selectedInvoiceJob?.status || selectedInvoice.jobStatus}
                    </p>
                  </div>
                  <div>
                    <span className="detail-label">Cost</span>
                    <p>
                      {formatMoney(
                        getJobCostValue(selectedInvoiceJob) ||
                          selectedInvoice.amount,
                      )}
                    </p>
                  </div>
                  <div>
                    <span className="detail-label">Sell</span>
                    <p>{formatMoney(getJobSellValue(selectedInvoiceJob))}</p>
                  </div>
                  <div>
                    <span className="detail-label">Pricing Status</span>
                    <p>
                      <StatusBadge
                        value={getPricingStatus(selectedInvoiceJob)}
                        label={
                          getPricingStatus(selectedInvoiceJob) === "set"
                            ? "Sell Set"
                            : "Sell Not Set"
                        }
                      />
                    </p>
                  </div>
                  <div>
                    <span className="detail-label">Sell Set At</span>
                    <p>
                      {selectedInvoiceJob?.sellSetAt
                        ? formatDate(selectedInvoiceJob.sellSetAt)
                        : "Not set"}
                    </p>
                  </div>
                </div>
                <InputRow>
                  <Field label="Invoice Number">
                    <input
                      value={invoiceForm.invoiceNumber}
                      onChange={(event) =>
                        setInvoiceForm((current) => ({
                          ...current,
                          invoiceNumber: event.target.value,
                        }))
                      }
                      disabled={selectedInvoice.status === "Paid"}
                    />
                  </Field>
                  <Field label="Invoice Date">
                    <input
                      type="date"
                      value={
                        invoiceForm.invoiceDate
                          ? invoiceForm.invoiceDate.slice(0, 10)
                          : ""
                      }
                      onChange={(event) =>
                        setInvoiceForm((current) => ({
                          ...current,
                          invoiceDate: event.target.value,
                        }))
                      }
                      disabled={selectedInvoice.status === "Paid"}
                    />
                  </Field>
                  <Field label="Due Date">
                    <input
                      type="date"
                      value={
                        invoiceForm.dueDate
                          ? invoiceForm.dueDate.slice(0, 10)
                          : ""
                      }
                      onChange={(event) =>
                        setInvoiceForm((current) => ({
                          ...current,
                          dueDate: event.target.value,
                        }))
                      }
                      disabled={selectedInvoice.status === "Paid"}
                    />
                  </Field>
                  <Field label="Terms">
                    <input
                      value={invoiceForm.terms}
                      onChange={(event) =>
                        setInvoiceForm((current) => ({
                          ...current,
                          terms: event.target.value,
                        }))
                      }
                      disabled={selectedInvoice.status === "Paid"}
                    />
                  </Field>
                  <Field label="Status">
                    <select
                      value={invoiceForm.status}
                      onChange={(event) =>
                        setInvoiceForm((current) => ({
                          ...current,
                          status: event.target.value,
                        }))
                      }
                      disabled={selectedInvoice.status === "Paid"}
                    >
                      {INVOICE_STATUS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Notes">
                    <textarea
                      rows="5"
                      value={invoiceForm.notes}
                      onChange={(event) =>
                        setInvoiceForm((current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                      disabled={selectedInvoice.status === "Paid"}
                    />
                  </Field>
                </InputRow>
                <div className="invoice-line-items">
                  {invoiceForm.lineItems.map((lineItem) => (
                    <div key={lineItem.id} className="invoice-line-item">
                      <input
                        value={lineItem.service}
                        onChange={(event) =>
                          updateInvoiceLineItem(
                            lineItem.id,
                            "service",
                            event.target.value,
                          )
                        }
                        placeholder="Service"
                        disabled={selectedInvoice.status === "Paid"}
                      />
                      <input
                        value={lineItem.description}
                        onChange={(event) =>
                          updateInvoiceLineItem(
                            lineItem.id,
                            "description",
                            event.target.value,
                          )
                        }
                        placeholder="Description"
                        disabled={selectedInvoice.status === "Paid"}
                      />
                      <input
                        value={lineItem.qty}
                        onChange={(event) =>
                          updateInvoiceLineItem(
                            lineItem.id,
                            "qty",
                            event.target.value,
                          )
                        }
                        placeholder="Qty"
                        disabled={selectedInvoice.status === "Paid"}
                      />
                      <input
                        value={lineItem.rate}
                        onChange={(event) =>
                          updateInvoiceLineItem(
                            lineItem.id,
                            "rate",
                            event.target.value,
                          )
                        }
                        placeholder="Rate"
                        disabled={selectedInvoice.status === "Paid"}
                      />
                      <input
                        value={lineItem.amount}
                        readOnly
                        placeholder="Amount"
                      />
                      <button
                        className="secondary-button danger-button"
                        onClick={() => removeInvoiceLineItem(lineItem.id)}
                        disabled={selectedInvoice.status === "Paid"}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {selectedInvoice.status !== "Paid" ? (
                    <button
                      className="secondary-button"
                      onClick={addInvoiceLineItem}
                    >
                      Add Line Item
                    </button>
                  ) : null}
                </div>
                {selectedInvoiceJob ? (
                  <>
                    <CostControl
                      costValue={accountingCostForm}
                      editing={
                        editingAccountingCostJobId === selectedInvoiceJob.id
                      }
                      onStartEdit={() =>
                        setEditingAccountingCostJobId(selectedInvoiceJob.id)
                      }
                      onChange={setAccountingCostForm}
                      onSave={saveAccountingCost}
                      disabled={selectedInvoice.status === "Paid"}
                    />
                    <SellControl
                      sellValue={accountingSellForm}
                      costValue={accountingCostForm}
                      pricingStatus={getPricingStatus(selectedInvoiceJob)}
                      editing={
                        editingAccountingSellJobId === selectedInvoiceJob.id ||
                        getPricingStatus(selectedInvoiceJob) !== "set"
                      }
                      onStartEdit={() =>
                        setEditingAccountingSellJobId(selectedInvoiceJob.id)
                      }
                      onChange={setAccountingSellForm}
                      onSave={saveAccountingSell}
                      disabled={selectedInvoice.status === "Paid"}
                    />
                  </>
                ) : null}
                <div className="proposal-summary-grid">
                  <div>
                    <span className="detail-label">Invoice Total</span>
                    <p>{formatMoney(invoiceForm.total)}</p>
                  </div>
                </div>
                <div className="decision-actions">
                  <button
                    className="secondary-button"
                    onClick={saveInvoice}
                    disabled={selectedInvoice.status === "Paid"}
                  >
                    Save Invoice
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => updateInvoiceStatus("Approved")}
                    disabled={selectedInvoice.status === "Paid"}
                  >
                    Approve Invoice
                  </button>
                  <button
                    className="secondary-button danger-button"
                    onClick={() => updateInvoiceStatus("Rejected")}
                    disabled={selectedInvoice.status === "Paid"}
                  >
                    Reject Invoice
                  </button>
                  <button
                    className="primary-button"
                    onClick={() => updateInvoiceStatus("Paid")}
                    disabled={selectedInvoice.status === "Paid"}
                  >
                    Mark Paid / Close Job
                  </button>
                </div>
              </div>
            ) : (
              <EmptyState
                title="No invoice selected"
                text="Select an invoice to edit."
              />
            )}
          </PageSection>
        }
      />
    </div>
  );

  const amsTeamScreen = (
    <div className="screen-grid">
      <PageSection
        title="AMS Team"
        action={
          canEditCrewIdentity(currentUser) ? (
            <button
              className="primary-button"
              onClick={() => openModal("amsTeammate")}
            >
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
                    {
                      key: "name",
                      label: "Full Name",
                      render: (row) => row.name,
                    },
                    {
                      key: "title",
                      label: "Job Title",
                      render: (row) => row.jobTitle || "Not set",
                    },
                    {
                      key: "email",
                      label: "Email",
                      render: (row) => row.email,
                    },
                    {
                      key: "phone",
                      label: "Phone",
                      render: (row) => row.phone || "Not set",
                    },
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
                  Direct team messaging will be added later with backend
                  support.
                </p>
              </div>
              <div className="detail-card">
                <span className="detail-label">Directory</span>
                <p className="detail-muted">
                  Click a teammate row to open the profile card with direct
                  contact details.
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
            <article
              key={item.key}
              className={`weather-threat-card ${item.key}`}
            >
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
          <div className="profile-summary">
            <div>
              <strong>{currentUser.name}</strong>
              <p>{currentUser.email}</p>
            </div>
            <div className="status-pill active">
              {getDisplayRole(currentUser)}
            </div>
          </div>
          <article className="detail-card profile-photo-card">
            <span className="detail-label">Profile Photo</span>
            <strong>Future Profile Picture</strong>
            <p>{profileForm.profilePhotoStatus}</p>
            <button
              className="secondary-button"
              onClick={() =>
                showPlaceholder(
                  "Profile photo upload will be added in a later build.",
                )
              }
            >
              Photo Upload Coming Soon
            </button>
          </article>
          <InputRow>
            <Field
              label={isCrewUser(currentUser) ? "Point of Contact Name" : "Name"}
            >
              <input
                value={profileForm.name}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Email / Login">
              <input
                value={profileForm.email}
                readOnly={isCrewUser(currentUser)}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="New Password">
              <div className="password-field-wrap">
                <input
                  type={showProfilePassword ? "text" : "password"}
                  value={profileForm.password}
                  placeholder="Firebase Auth only; leave blank to keep current password"
                  onChange={(event) => {
                    setProfilePasswordError("");
                    setProfileForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }));
                  }}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowProfilePassword((current) => !current)}
                  aria-label={
                    showProfilePassword ? "Hide password" : "Show password"
                  }
                >
                  {showProfilePassword ? "Hide" : "Show"}
                </button>
              </div>
            </Field>
            <Field label="Confirm Password">
              <div className="password-field-wrap">
                <input
                  type={showProfilePassword ? "text" : "password"}
                  value={profileForm.confirmPassword}
                  placeholder="Re-enter new password"
                  onChange={(event) => {
                    setProfilePasswordError("");
                    setProfileForm((current) => ({
                      ...current,
                      confirmPassword: event.target.value,
                    }));
                  }}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowProfilePassword((current) => !current)}
                  aria-label={
                    showProfilePassword ? "Hide password" : "Show password"
                  }
                >
                  {showProfilePassword ? "Hide" : "Show"}
                </button>
              </div>
            </Field>
            <Field label="Phone">
              <input
                value={profileForm.phone}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Job Title">
              <input
                value={profileForm.jobTitle}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    jobTitle: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Company Name">
              <input
                value={profileForm.companyName}
                readOnly={isCrewUser(currentUser)}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    companyName: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Street Address">
              <input
                value={profileForm.streetAddress}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    streetAddress: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="City">
              <input
                value={profileForm.city}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    city: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="State">
              <input
                value={profileForm.state}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    state: event.target.value.toUpperCase(),
                  }))
                }
              />
            </Field>
            <Field label="ZIP">
              <input
                value={profileForm.zip}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    zip: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Internal Notes">
              <textarea
                rows="4"
                value={profileForm.internalNotes}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    internalNotes: event.target.value,
                  }))
                }
              />
            </Field>
          </InputRow>
          {profilePasswordError ? (
            <div className="inline-notice error">{profilePasswordError}</div>
          ) : null}
          <div className="form-actions">
            <button className="primary-button" onClick={saveProfile}>
              Save Profile
            </button>
          </div>
        </div>
      </PageSection>
      <PageSection title="Company Profile">
        <InputRow>
          <Field label="Company Name">
            <input
              value={companyProfileForm.companyName}
              disabled={isCrewUser(currentUser)}
              onChange={(event) =>
                setCompanyProfileForm((current) => ({
                  ...current,
                  companyName: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Contact Name">
            <input
              value={companyProfileForm.contactName}
              disabled={isCrewUser(currentUser)}
              onChange={(event) =>
                setCompanyProfileForm((current) => ({
                  ...current,
                  contactName: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Phone">
            <input
              value={companyProfileForm.phone}
              disabled={isCrewUser(currentUser)}
              onChange={(event) =>
                setCompanyProfileForm((current) => ({
                  ...current,
                  phone: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Email">
            <input
              value={companyProfileForm.email}
              disabled={isCrewUser(currentUser)}
              onChange={(event) =>
                setCompanyProfileForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Address">
            <input
              value={companyProfileForm.address}
              disabled={isCrewUser(currentUser)}
              onChange={(event) =>
                setCompanyProfileForm((current) => ({
                  ...current,
                  address: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="City">
            <input
              value={companyProfileForm.city}
              disabled={isCrewUser(currentUser)}
              onChange={(event) =>
                setCompanyProfileForm((current) => ({
                  ...current,
                  city: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="State">
            <input
              value={companyProfileForm.state}
              disabled={isCrewUser(currentUser)}
              onChange={(event) =>
                setCompanyProfileForm((current) => ({
                  ...current,
                  state: event.target.value.toUpperCase(),
                }))
              }
            />
          </Field>
          <Field label="ZIP">
            <input
              value={companyProfileForm.zip}
              disabled={isCrewUser(currentUser)}
              onChange={(event) =>
                setCompanyProfileForm((current) => ({
                  ...current,
                  zip: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Billing / Remit Details">
            <textarea
              rows="4"
              value={companyProfileForm.billingDetails}
              disabled={isCrewUser(currentUser)}
              onChange={(event) =>
                setCompanyProfileForm((current) => ({
                  ...current,
                  billingDetails: event.target.value,
                }))
              }
            />
          </Field>
        </InputRow>
        {isCrewUser(currentUser) ? (
          <p className="detail-muted">
            Company identity fields are read-only for Crew users in this build.
          </p>
        ) : (
          <div className="form-actions">
            <button className="primary-button" onClick={saveCompanyProfile}>
              Save Company Profile
            </button>
          </div>
        )}
      </PageSection>
    </div>
  ) : null;

  function renderScreen() {
    if (!currentUser) return null;
    if (currentUser.role === ROLES.OPERATOR)
      return (
        <UnderConstruction
          title="Operator Portal"
          message="Operator workflow screens will be added in a later version."
        />
      );
    if (currentUser.role === ROLES.CUSTOMER)
      return (
        <UnderConstruction
          title="Customer Portal"
          message="Customer workflow screens will be added in a later version."
        />
      );
    if (UNDER_CONSTRUCTION_SCREENS.has(activeScreen))
      return (
        <UnderConstruction
          title={SCREEN_LABELS[activeScreen]}
          message={`${SCREEN_LABELS[activeScreen]} is reserved for a future additive release.`}
        />
      );
    if (activeScreen === "profile") return profileScreen;
    if (activeScreen === "myJobs")
      return <div className="screen-grid vendor-screen">{crewJobsSection}</div>;
    if (activeScreen === "completedJobs") return completedJobsScreen;
    if (activeScreen === "mySites")
      return (
        <div className="screen-grid vendor-screen">{crewSitesSection}</div>
      );
    if (activeScreen === "myProposals")
      return (
        <div className="screen-grid vendor-screen">
          {crewProposalStatusSection}
        </div>
      );
    if (activeScreen === "myInvoices")
      return (
        <div className="screen-grid vendor-screen">{crewInvoicesSection}</div>
      );
    if (activeScreen === "availableWork")
      return (
        <div className="screen-grid vendor-screen">
          {crewAvailableWorkSection}
        </div>
      );
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
    if (isCrewUser(currentUser) && activeScreen === "dashboard")
      return crewDashboard;
    return (
      <UnderConstruction
        title="Screen Unavailable"
        message="This screen is reserved for future development."
      />
    );
  }

  if (showSplash || authRestoring) {
    return <SplashScreen />;
  }

  if (!currentUser) {
    return (
      <LoginScreen
        email={loginForm.email}
        password={loginForm.password}
        onChange={updateLoginField}
        onLogin={() => handleLogin(loginForm.email, loginForm.password)}
        onDemoLogin={handleDemoLogin}
        loading={loginLoading}
        errorMessage={loginError}
      />
    );
  }

  return (
    <div className="app-shell">
      <Drawer
        open={drawerOpen}
        menuItems={DRAWER_MENUS[currentUser.role]}
        activeScreen={activeScreen}
        labels={SCREEN_LABELS}
        currentUser={currentUser}
        onNavigate={openScreen}
        onLogout={logout}
        onClose={() => setDrawerOpen(false)}
      />
      <div className="main-shell">
        <Header
          currentUser={currentUser}
          activeScreen={activeScreen}
          onOpenDrawer={() => setDrawerOpen(true)}
          onGoBack={() => openScreen("dashboard")}
          onOpenNotifications={() =>
            showPlaceholder("Notifications will be added in a later build.")
          }
          onToggleProfileMenu={() => setProfileMenuOpen((open) => !open)}
          profileMenuOpen={profileMenuOpen}
          onNavigate={openScreen}
          onLogout={logout}
        />
        <main className="content-shell">
          <div className="screen-header">
            <div>
              <div className="eyebrow">{getPortalEyebrow(currentUser)}</div>
              <h1>{SCREEN_LABELS[activeScreen] || "Dashboard"}</h1>
            </div>
          </div>
          {actionNotice ? (
            <div className={`inline-notice ${actionNotice.type}`}>
              {actionNotice.message}
            </div>
          ) : null}
          {quickActions.length ? (
            <TopActionBar actions={quickActions} activeKey={activeScreen} />
          ) : null}
          {renderScreen()}
        </main>
      </div>

      <Modal
        open={Boolean(selectedCrewOpportunity)}
        title="Crew Opportunity Details"
        className="crew-opportunity-modal"
        onClose={() => setSelectedCrewOpportunityId(null)}
        footer={
          selectedCrewOpportunity ? (
            <div className="form-actions">
              <button
                className="secondary-button"
                onClick={() => hideCrewOpportunity(selectedCrewOpportunity.id)}
              >
                Hide Opportunity
              </button>
              <button
                className="secondary-button"
                onClick={() => setSelectedCrewOpportunityId(null)}
              >
                Close
              </button>
              <button
                className="primary-button"
                onClick={() =>
                  handleCrewProposalSubmit(selectedCrewOpportunity)
                }
              >
                {selectedCrewOpportunityLatestProposal
                  ? "Resubmit Proposal"
                  : "Submit Proposal"}
              </button>
            </div>
          ) : null
        }
      >
        {selectedCrewOpportunity ? (
          <div className="crew-opportunity-detail detail-stack">
            <div className="proposal-summary-top">
              <div>
                <strong>{selectedCrewOpportunity.siteName}</strong>
                <p>
                  {selectedCrewOpportunity.serviceType ||
                    "Service type not specified"}
                </p>
              </div>
              <div className="proposal-summary-badges">
                <WorkOrderStatusBadge workOrder={selectedCrewOpportunity} />
                {selectedCrewOpportunityLatestProposal ? (
                  <ProposalStatusBadge
                    value={selectedCrewOpportunityLatestProposal.status}
                  />
                ) : null}
              </div>
            </div>
            <div className="proposal-summary-grid">
              <div>
                <span className="detail-label">Site Address</span>
                <p>{selectedCrewOpportunitySite?.address || "Not available"}</p>
              </div>
              <div>
                <span className="detail-label">State</span>
                <p>
                  {getWorkOrderDispatchState(
                    selectedCrewOpportunity,
                    selectedCrewOpportunitySite,
                  ) || "Unknown"}
                </p>
              </div>
              <div>
                <span className="detail-label">Status</span>
                <p>
                  <WorkOrderStatusBadge workOrder={selectedCrewOpportunity} />
                </p>
              </div>
              <div>
                <span className="detail-label">Timing</span>
                <p>
                  {formatDate(
                    selectedCrewOpportunity.seasonStart ||
                      selectedCrewOpportunity.proposalRequestedAt ||
                      selectedCrewOpportunity.createdAt,
                  )}
                </p>
              </div>
              <div>
                <span className="detail-label">Photos Required</span>
                <p>
                  {selectedCrewOpportunity.requireBeforeAfterPhotos
                    ? "Yes"
                    : "No"}
                </p>
              </div>
              <div>
                <span className="detail-label">Work Type</span>
                <p>{getWorkTypeLabel(selectedCrewOpportunity.workType)}</p>
              </div>
            </div>
            <article className="detail-card">
              <span className="detail-label">Full Description</span>
              <p>
                {selectedCrewOpportunity.description ||
                  "No description provided."}
              </p>
            </article>
            <article className="detail-card">
              <span className="detail-label">Service Requirements</span>
              <p>
                {selectedCrewOpportunity.recurringPricingNotes ||
                  selectedCrewOpportunitySite?.internalNotes ||
                  "No additional service requirements provided."}
              </p>
            </article>
            <InputRow>
              <Field label="Required Cost">
                <input
                  value={selectedCrewOpportunityDraft.submittedPrice}
                  onChange={(event) =>
                    updateVendorProposalDraft(
                      selectedCrewOpportunity.id,
                      "submittedPrice",
                      event.target.value,
                    )
                  }
                  placeholder="Enter crew cost"
                  required
                />
              </Field>
              <Field label="Proposal Notes">
                <textarea
                  rows="4"
                  value={selectedCrewOpportunityDraft.submittedNotes}
                  onChange={(event) =>
                    updateVendorProposalDraft(
                      selectedCrewOpportunity.id,
                      "submittedNotes",
                      event.target.value,
                    )
                  }
                  placeholder="Add scope notes or crew comments"
                />
              </Field>
            </InputRow>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={activeModal === "workOrder"}
        title="Create Work Order"
        onClose={closeModal}
        footer={
          <div className="form-actions">
            <button
              className="secondary-button"
              onClick={() =>
                showPlaceholder(
                  "File and image uploads require backend support and will be added in a later build.",
                )
              }
            >
              Attach File / Upload Picture
            </button>
            <button className="primary-button" onClick={createWorkOrder}>
              Create Work Order
            </button>
          </div>
        }
      >
        <div className="modal-reference">
          AMS Work Order Number: {nextWorkOrderNumber}
        </div>
        <InputRow>
          {showExternalWorkOrder ? (
            <Field label="External Work Order Number">
              <input
                value={workOrderForm.externalWorkOrderNumber}
                onChange={(event) =>
                  setWorkOrderForm((current) => ({
                    ...current,
                    externalWorkOrderNumber: event.target.value,
                  }))
                }
              />
            </Field>
          ) : null}
          <Field label="Site">
            <select
              value={workOrderForm.siteId}
              onChange={(event) =>
                setWorkOrderForm((current) => ({
                  ...current,
                  siteId: event.target.value,
                }))
              }
            >
              <option value="">Select site</option>
              {appState.sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Service Type">
            <select
              value={workOrderForm.serviceType}
              onChange={(event) =>
                setWorkOrderForm((current) => ({
                  ...current,
                  serviceType: event.target.value,
                }))
              }
            >
              <option value="">Select service type</option>
              {SERVICE_TYPES.map((serviceType) => (
                <option key={serviceType} value={serviceType}>
                  {serviceType}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Workflow Path">
            <select
              value={workOrderForm.workflowType}
              onChange={(event) =>
                setWorkOrderForm((current) => ({
                  ...current,
                  workflowType: event.target.value,
                  directVendorId:
                    event.target.value === "proposal"
                      ? ""
                      : current.directVendorId,
                }))
              }
            >
              <option value="direct">Direct Assignment</option>
              <option value="proposal">Proposal Opportunity</option>
            </select>
          </Field>
          <Field label="Work Type">
            <select
              value={workOrderForm.workType}
              onChange={(event) =>
                setWorkOrderForm((current) => ({
                  ...current,
                  workType: event.target.value,
                  recurringFrequency:
                    event.target.value === "recurring"
                      ? current.recurringFrequency
                      : "",
                  recurringVendorCost:
                    event.target.value === "recurring"
                      ? current.recurringVendorCost
                      : "",
                  recurringPricingNotes:
                    event.target.value === "recurring"
                      ? current.recurringPricingNotes
                      : "",
                  seasonStart:
                    event.target.value === "seasonal"
                      ? current.seasonStart
                      : "",
                  seasonEnd:
                    event.target.value === "seasonal" ? current.seasonEnd : "",
                  seasonalServiceType:
                    event.target.value === "seasonal"
                      ? current.seasonalServiceType
                      : "",
                }))
              }
            >
              <option value="one_time">One-Time</option>
              <option value="recurring">Recurring</option>
              <option value="seasonal">Seasonal/Triggered</option>
            </select>
          </Field>
          <Field label="Assign Vendor Now">
            <select
              value={workOrderForm.directVendorId}
              disabled={workOrderForm.workflowType !== "direct"}
              onChange={(event) =>
                setWorkOrderForm((current) => ({
                  ...current,
                  directVendorId: event.target.value,
                }))
              }
            >
              <option value="">Leave unassigned</option>
              {normalizedVendors
                .filter((vendor) => vendor.active)
                .map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.companyName || vendor.name}
                  </option>
                ))}
            </select>
          </Field>
          {workOrderForm.workflowType === "direct" &&
          workOrderForm.workType !== "recurring" ? (
            <Field label="Vendor Cost">
              <input
                value={workOrderForm.vendorCost}
                onChange={(event) =>
                  setWorkOrderForm((current) => ({
                    ...current,
                    vendorCost: event.target.value,
                  }))
                }
                placeholder="Enter vendor cost"
              />
            </Field>
          ) : null}
          <Field label="Description">
            <textarea
              rows="4"
              value={workOrderForm.description}
              onChange={(event) =>
                setWorkOrderForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </Field>
          {workOrderForm.workType === "recurring" ? (
            <>
              <Field label="Recurring Frequency">
                <select
                  value={workOrderForm.recurringFrequency}
                  onChange={(event) =>
                    setWorkOrderForm((current) => ({
                      ...current,
                      recurringFrequency: event.target.value,
                    }))
                  }
                >
                  <option value="">Select frequency</option>
                  <option value="weekly">Weekly</option>
                  <option value="bi_weekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </Field>
              <Field label="Vendor Cost">
                <input
                  value={workOrderForm.recurringVendorCost}
                  onChange={(event) =>
                    setWorkOrderForm((current) => ({
                      ...current,
                      recurringVendorCost: event.target.value,
                      vendorCost: event.target.value,
                    }))
                  }
                  placeholder="Enter recurring vendor cost"
                />
              </Field>
            </>
          ) : null}
          {workOrderForm.workType === "seasonal" ? (
            <>
              <Field label="Season Start">
                <input
                  type="date"
                  value={workOrderForm.seasonStart}
                  onChange={(event) =>
                    setWorkOrderForm((current) => ({
                      ...current,
                      seasonStart: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Season End">
                <input
                  type="date"
                  value={workOrderForm.seasonEnd}
                  onChange={(event) =>
                    setWorkOrderForm((current) => ({
                      ...current,
                      seasonEnd: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Seasonal Service">
                <select
                  value={workOrderForm.seasonalServiceType}
                  onChange={(event) =>
                    setWorkOrderForm((current) => ({
                      ...current,
                      seasonalServiceType: event.target.value,
                    }))
                  }
                >
                  <option value="">Select service</option>
                  <option value="Plowing">Plowing</option>
                  <option value="Shoveling">Shoveling</option>
                  <option value="Salting">Salting</option>
                </select>
              </Field>
            </>
          ) : null}
        </InputRow>
        <label className="checkbox-inline">
          <input
            type="checkbox"
            checked={workOrderForm.requireBeforeAfterPhotos}
            onChange={(event) =>
              setWorkOrderForm((current) => ({
                ...current,
                requireBeforeAfterPhotos: event.target.checked,
              }))
            }
          />
          Require before and after photos
        </label>
      </Modal>

      <Modal
        open={activeModal === "siteImport"}
        title="Upload Sites"
        onClose={() => {
          closeModal();
          resetSiteImport();
        }}
        className="site-import-modal"
        footer={
          <div className="form-actions">
            <button
              className="secondary-button"
              onClick={() => {
                closeModal();
                resetSiteImport();
              }}
            >
              Cancel
            </button>
            <button
              className="primary-button"
              onClick={confirmSiteImport}
              disabled={!canConfirmSiteImport}
            >
              {siteImportLoading
                ? "Importing..."
                : `Import ${siteImportValidCount || ""} Sites`}
            </button>
          </div>
        }
      >
        <div className="detail-stack">
          <div className="detail-card">
            <span className="detail-label">AMS Site Template</span>
            <p className="detail-muted">
              Upload a .xlsx or .csv file with exactly these headers:{" "}
              {SITE_IMPORT_HEADERS.join(", ")}.
            </p>
            <input
              type="file"
              accept=".xlsx,.csv"
              onChange={handleSiteImportFile}
              disabled={siteImportLoading}
            />
            {siteImportFileName ? (
              <p className="detail-muted">
                Selected file: {siteImportFileName}
              </p>
            ) : null}
          </div>
          {siteImportError ? (
            <div className="inline-notice error">{siteImportError}</div>
          ) : null}
          {siteImportSummary ? (
            <div className="inline-notice info">{siteImportSummary}</div>
          ) : null}
          {siteImportRows.length ? (
            <div className="list-scroll compact-scroll contained-scroll site-import-preview">
              <DataTable
                columns={[
                  { key: "row", label: "Row", render: (row) => row.rowNumber },
                  {
                    key: "valid",
                    label: "Status",
                    render: (row) => (row.valid ? "Ready" : "Needs Fix"),
                  },
                  {
                    key: "siteNumber",
                    label: "Site #",
                    render: (row) => row.site.siteNumber,
                  },
                  {
                    key: "name",
                    label: "Name",
                    render: (row) => row.site.name,
                  },
                  {
                    key: "client",
                    label: "Client",
                    render: (row) => row.site.client,
                  },
                  {
                    key: "address",
                    label: "Address",
                    render: (row) =>
                      `${row.site.address}, ${row.site.city}, ${row.site.state} ${row.site.zip}`,
                  },
                  {
                    key: "services",
                    label: "Services",
                    render: (row) => row.site.serviceTypes.join(", "),
                  },
                  {
                    key: "errors",
                    label: "Validation",
                    render: (row) => row.errors.join("; ") || "OK",
                  },
                ]}
                rows={siteImportRows}
                emptyTitle="No rows previewed"
                emptyText="Upload an AMS site template to preview import rows."
              />
            </div>
          ) : null}
          {siteImportInvalidCount ? (
            <p className="detail-muted">
              Import is blocked until invalid rows are corrected and the file is
              uploaded again.
            </p>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={activeModal === "site"}
        title={editingSiteId ? "Edit Site" : "Create Site"}
        onClose={closeModal}
        footer={
          <button className="primary-button" onClick={saveSite}>
            {editingSiteId ? "Update Site" : "Add Site"}
          </button>
        }
      >
        <InputRow>
          <Field label="Site Name">
            <input
              value={siteForm.name}
              onChange={(event) =>
                setSiteForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Street Address">
            <input
              value={siteForm.streetAddress}
              onChange={(event) =>
                setSiteForm((current) => ({
                  ...current,
                  streetAddress: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="City">
            <input
              value={siteForm.city}
              onChange={(event) =>
                setSiteForm((current) => ({
                  ...current,
                  city: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="State">
            <input
              value={siteForm.state}
              maxLength={2}
              onChange={(event) =>
                setSiteForm((current) => ({
                  ...current,
                  state: event.target.value.toUpperCase(),
                }))
              }
            />
          </Field>
          <Field label="ZIP Code">
            <input
              value={siteForm.zip}
              onChange={(event) =>
                setSiteForm((current) => ({
                  ...current,
                  zip: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Primary Assigned Vendor">
            <select
              value={siteForm.assignedVendorId}
              onChange={(event) =>
                setSiteForm((current) => ({
                  ...current,
                  assignedVendorId: event.target.value,
                  assignedCrewContactId: "",
                }))
              }
            >
              <option value="">Unassigned</option>
              {normalizedVendors
                .filter((vendor) => vendor.active)
                .map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.companyName || vendor.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Crew Contact">
            <select
              value={siteForm.assignedCrewContactId}
              onChange={(event) =>
                setSiteForm((current) => ({
                  ...current,
                  assignedCrewContactId: event.target.value,
                }))
              }
            >
              <option value="">Not set</option>
              {appState.users
                .filter(
                  (user) =>
                    user.role === ROLES.CREW &&
                    (!siteForm.assignedVendorId ||
                      normalizedVendors.find(
                        (vendor) => vendor.id === siteForm.assignedVendorId,
                      )?.userId === user.id),
                )
                .map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Internal Notes">
            <textarea
              rows="4"
              value={siteForm.internalNotes}
              onChange={(event) =>
                setSiteForm((current) => ({
                  ...current,
                  internalNotes: event.target.value,
                }))
              }
            />
          </Field>
        </InputRow>
        <div className="proposal-summary-grid">
          <article className="detail-card">
            <span className="detail-label">Site Map</span>
            <p>Upload Coming Soon</p>
          </article>
          <article className="detail-card">
            <span className="detail-label">Geo Fence</span>
            <p>Geo Fence Setup Coming Soon</p>
          </article>
        </div>
      </Modal>

      <Modal
        open={activeModal === "vendor"}
        title={editingVendorId ? "Edit Vendor" : "Create Vendor"}
        onClose={closeModal}
        footer={
          <button className="primary-button" onClick={saveVendor}>
            {editingVendorId ? "Update Vendor" : "Add Vendor"}
          </button>
        }
      >
        <InputRow>
          <Field label="Company Name">
            <input
              value={vendorForm.companyName}
              onChange={(event) =>
                setVendorForm((current) => ({
                  ...current,
                  companyName: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Point of Contact">
            <input
              value={vendorForm.contactName}
              onChange={(event) =>
                setVendorForm((current) => ({
                  ...current,
                  contactName: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Phone Number">
            <input
              value={vendorForm.phone}
              onChange={(event) =>
                setVendorForm((current) => ({
                  ...current,
                  phone: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Email Address">
            <input
              value={vendorForm.email}
              onChange={(event) =>
                setVendorForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              value={vendorForm.password}
              onChange={(event) =>
                setVendorForm((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
              placeholder="Defaults to Crew123 if left blank"
            />
          </Field>
          <Field label="Street Address">
            <input
              value={vendorForm.streetAddress}
              onChange={(event) =>
                setVendorForm((current) => ({
                  ...current,
                  streetAddress: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="City">
            <input
              value={vendorForm.city}
              onChange={(event) =>
                setVendorForm((current) => ({
                  ...current,
                  city: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="State">
            <input
              value={vendorForm.state}
              onChange={(event) =>
                setVendorForm((current) => ({
                  ...current,
                  state: event.target.value.toUpperCase(),
                }))
              }
            />
          </Field>
          <Field label="ZIP Code">
            <input
              value={vendorForm.zip}
              onChange={(event) =>
                setVendorForm((current) => ({
                  ...current,
                  zip: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Primary Service Type">
            <select
              value={vendorForm.serviceType}
              onChange={(event) =>
                setVendorForm((current) => ({
                  ...current,
                  serviceType: event.target.value,
                }))
              }
            >
              <option value="">Select service type</option>
              {SERVICE_TYPES.map((serviceType) => (
                <option key={serviceType} value={serviceType}>
                  {serviceType}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Service Types">
            <input
              value={vendorForm.serviceTypes}
              onChange={(event) =>
                setVendorForm((current) => ({
                  ...current,
                  serviceTypes: event.target.value,
                }))
              }
              placeholder="Snow Removal, Landscaping"
            />
          </Field>
          <Field label="States">
            <input
              value={vendorForm.states}
              onChange={(event) =>
                setVendorForm((current) => ({
                  ...current,
                  states: event.target.value.toUpperCase(),
                }))
              }
              placeholder="MA, RI"
            />
          </Field>
          <Field label="Internal Notes">
            <textarea
              rows="4"
              value={vendorForm.internalNotes}
              onChange={(event) =>
                setVendorForm((current) => ({
                  ...current,
                  internalNotes: event.target.value,
                }))
              }
            />
          </Field>
        </InputRow>
      </Modal>

      <Modal
        open={activeModal === "job"}
        title="Create Job"
        onClose={closeModal}
        footer={
          <button className="primary-button" onClick={createManualJob}>
            Create Job
          </button>
        }
      >
        <InputRow>
          <Field label="Work Order">
            <select
              value={jobCreateForm.workOrderId}
              onChange={(event) => {
                const nextWorkOrder = appState.workOrders.find(
                  (workOrder) => workOrder.id === event.target.value,
                );
                setJobCreateForm((current) => ({
                  ...current,
                  workOrderId: event.target.value,
                  vendorId: nextWorkOrder?.assignedVendorId || current.vendorId,
                }));
              }}
            >
              <option value="">Select work order</option>
              {appState.workOrders
                .filter(
                  (workOrder) =>
                    !appState.jobs.some(
                      (job) => job.workOrderId === workOrder.id,
                    ),
                )
                .map((workOrder) => (
                  <option key={workOrder.id} value={workOrder.id}>
                    {workOrder.amsWorkOrderNumber} - {workOrder.siteName}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Vendor">
            <select
              value={jobCreateForm.vendorId}
              onChange={(event) =>
                setJobCreateForm((current) => ({
                  ...current,
                  vendorId: event.target.value,
                }))
              }
            >
              <option value="">Select vendor</option>
              {normalizedVendors
                .filter((vendor) => vendor.active)
                .map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.companyName || vendor.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Price">
            <input
              value={jobCreateForm.price}
              onChange={(event) =>
                setJobCreateForm((current) => ({
                  ...current,
                  price: event.target.value,
                }))
              }
            />
          </Field>
        </InputRow>
      </Modal>
      <Modal
        open={activeModal === "amsTeammate"}
        title="Add AMS Teammate"
        onClose={closeModal}
        footer={
          <button className="primary-button" onClick={saveUser}>
            Add Teammate
          </button>
        }
      >
        <InputRow>
          <Field label="Full Name">
            <input
              value={userForm.name}
              onChange={(event) =>
                setUserForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Email / Login">
            <input
              value={userForm.email}
              onChange={(event) =>
                setUserForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              value={userForm.password}
              onChange={(event) =>
                setUserForm((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Phone Number">
            <input
              value={userForm.phone}
              onChange={(event) =>
                setUserForm((current) => ({
                  ...current,
                  phone: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Job Title">
            <input
              value={userForm.jobTitle}
              onChange={(event) =>
                setUserForm((current) => ({
                  ...current,
                  jobTitle: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Company Name">
            <input
              value={userForm.companyName}
              onChange={(event) =>
                setUserForm((current) => ({
                  ...current,
                  companyName: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Street Address">
            <input
              value={userForm.streetAddress}
              onChange={(event) =>
                setUserForm((current) => ({
                  ...current,
                  streetAddress: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="City">
            <input
              value={userForm.city}
              onChange={(event) =>
                setUserForm((current) => ({
                  ...current,
                  city: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="State">
            <input
              value={userForm.state}
              onChange={(event) =>
                setUserForm((current) => ({
                  ...current,
                  state: event.target.value.toUpperCase(),
                }))
              }
            />
          </Field>
          <Field label="ZIP">
            <input
              value={userForm.zip}
              onChange={(event) =>
                setUserForm((current) => ({
                  ...current,
                  zip: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Internal Notes">
            <textarea
              rows="4"
              value={userForm.internalNotes}
              onChange={(event) =>
                setUserForm((current) => ({
                  ...current,
                  internalNotes: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Role">
            <select
              value={userForm.role}
              onChange={(event) =>
                setUserForm((current) => ({
                  ...current,
                  role: event.target.value,
                }))
              }
            >
              <option value={ROLES.AMS_ADMIN}>{ROLES.AMS_ADMIN}</option>
              <option value={ROLES.AMS_MANAGER}>{ROLES.AMS_MANAGER}</option>
            </select>
          </Field>
        </InputRow>
      </Modal>
      <Modal
        open={activeModal === "teamProfile"}
        title="AMS Teammate Profile"
        onClose={closeModal}
      >
        {selectedTeamMember ? (
          <div className="detail-stack">
            <div className="detail-card">
              <div className="proposal-summary-top">
                <div>
                  <strong>{selectedTeamMember.name}</strong>
                  <p>
                    {selectedTeamMember.jobTitle || selectedTeamMember.role}
                  </p>
                </div>
                <StatusBadge
                  value={selectedTeamMember.active ? "active" : "inactive"}
                  label={selectedTeamMember.active ? "Active" : "Inactive"}
                />
              </div>
              <div className="proposal-summary-grid">
                <div>
                  <span className="detail-label">Phone Number</span>
                  <p>
                    {selectedTeamMember.phone ? (
                      <a href={`tel:${selectedTeamMember.phone}`}>
                        {selectedTeamMember.phone}
                      </a>
                    ) : (
                      "Not set"
                    )}
                  </p>
                </div>
                <div>
                  <span className="detail-label">Email</span>
                  <p>
                    <a href={`mailto:${selectedTeamMember.email}`}>
                      {selectedTeamMember.email}
                    </a>
                  </p>
                </div>
                <div>
                  <span className="detail-label">Company Name</span>
                  <p>
                    {selectedTeamMember.companyName ||
                      "Advanced Maintenance Services"}
                  </p>
                </div>
                <div>
                  <span className="detail-label">Address</span>
                  <p>{selectedTeamMember.address || "Not set"}</p>
                </div>
                <div>
                  <span className="detail-label">Internal Notes</span>
                  <p>
                    {selectedTeamMember.internalNotes || "No internal notes."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            title="No teammate selected"
            text="Choose a teammate from the directory."
          />
        )}
      </Modal>
      <Modal
        open={Boolean(jobConfirmation)}
        title={jobConfirmation?.type === "start" ? "Start Job" : "Complete Job"}
        onClose={() => setJobConfirmation(null)}
        footer={
          <div className="form-actions">
            <button
              className="secondary-button"
              onClick={() => setJobConfirmation(null)}
            >
              Cancel
            </button>
            <button className="primary-button" onClick={confirmJobStatusChange}>
              {jobConfirmation?.type === "start" ? "Start Job" : "Complete Job"}
            </button>
          </div>
        }
      >
        <p className="detail-muted">
          {jobConfirmation?.type === "start"
            ? "Are you on site and ready to start the job?"
            : "Are you sure this job is complete and the scope of work has been completed?"}
        </p>
      </Modal>
    </div>
  );
}

export default AppBuild03;
