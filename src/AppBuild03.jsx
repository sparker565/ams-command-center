import React, { useEffect, useState } from "react";
import {
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
  SplitView,
  StatGrid,
  TopActionBar,
  UnderConstruction,
} from "./components";

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
  return {
    ...vendor,
    userId: vendor.userId || "",
    states: vendor.states || [],
    serviceTypes: vendor.serviceTypes || (vendor.serviceType ? [vendor.serviceType] : []),
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
  return {
    ...job,
    description: job.description || "",
    price: job.price ?? "",
    completedAt: job.completedAt || "",
  };
}

function normalizeInvoice(invoice) {
  return {
    ...invoice,
    invoiceNumber: invoice.invoiceNumber || "",
    amount: invoice.amount ?? "",
    submittedAt: invoice.submittedAt || "",
    submittedBy: invoice.submittedBy || "",
    status: invoice.status || "Not Submitted",
    notes: invoice.notes || "",
    completedAt: invoice.completedAt || "",
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
  };

  return {
    ...normalized,
    proposalState: getWorkOrderProposalState(normalized, proposals),
  };
}

function normalizeStateData(state) {
  const vendors = (state.vendors || []).map(normalizeVendor);
  const proposals = (state.proposals || []).map(normalizeProposal);
  const jobs = (state.jobs || []).map(normalizeJob);
  const invoices = (state.invoices || []).map(normalizeInvoice);
  const workOrders = (state.workOrders || []).map((workOrder) =>
    normalizeWorkOrder(workOrder, proposals, jobs)
  );
  const selectedSiteId =
    state.ui?.selectedSiteId && (state.sites || []).some((site) => site.id === state.ui.selectedSiteId)
      ? state.ui.selectedSiteId
      : state.sites?.[0]?.id || null;
  const currentUserExists = getAllUserPool({ ...state, vendors }).some(
    (user) => user.id === state.ui?.currentUserId
  );

  return {
    ...state,
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
  if (filter === "Open") return workOrder.status === "Open";
  if (filter === "Assigned") return ["Assigned", "In Progress"].includes(workOrder.status);
  if (filter === "Closed") return isClosedWorkOrder(workOrder.status);
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

function buildJobRecord({ workOrder, vendor, price }) {
  return {
    id: createId("job"),
    workOrderId: workOrder.id,
    siteId: workOrder.siteId,
    siteName: workOrder.siteName,
    vendorId: vendor.id,
    vendorName: vendor.name,
    serviceType: workOrder.serviceType,
    description: workOrder.description,
    price: price ?? "",
    status: "Assigned",
    completedAt: "",
  };
}

function buildInvoiceRecord({ job, workOrder, currentUser }) {
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
    amount: job.price || "",
    invoiceNumber: "",
    submittedAt: "",
    submittedBy: currentUser?.name || "",
    status: "Not Submitted",
    notes: "",
    completedAt: job.completedAt || workOrder?.proposalAwardedAt || "",
  };
}

function getInvoiceForJob(invoices, jobId) {
  return invoices.find((invoice) => invoice.jobId === jobId) || null;
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

function AppBuild03() {
  const [appState, setAppState] = useState(() => normalizeStateData(loadAppState()));
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
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [reviewForm, setReviewForm] = useState({ reviewedPrice: "", amsNotes: "" });
  const [workOrderDetailForm, setWorkOrderDetailForm] = useState({
    externalWorkOrderNumber: "",
    requireBeforeAfterPhotos: false,
  });
  const [vendorProposalDrafts, setVendorProposalDrafts] = useState({});
  const [invoiceForm, setInvoiceForm] = useState({
    invoiceNumber: "",
    amount: "",
    notes: "",
    status: "Not Submitted",
  });
  const [siteForm, setSiteForm] = useState({ name: "", address: "", state: "", internalNotes: "" });
  const [vendorForm, setVendorForm] = useState({ name: "", serviceType: "", serviceTypes: "", states: "" });
  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    password: "",
    role: ROLES.AMS_ADMIN,
  });
  const [workOrderForm, setWorkOrderForm] = useState({
    siteId: "",
    description: "",
    serviceType: "",
    workflowType: "direct",
    directVendorId: "",
    externalWorkOrderNumber: "",
    requireBeforeAfterPhotos: false,
  });
  const [jobCreateForm, setJobCreateForm] = useState({ workOrderId: "", vendorId: "", price: "" });
  const [jobAssignment, setJobAssignment] = useState({});
  const [editingSiteId, setEditingSiteId] = useState(null);
  const [editingVendorId, setEditingVendorId] = useState(null);
  const [editingUserId, setEditingUserId] = useState(null);

  const updateAppState = (updater) => {
    setAppState((current) => normalizeStateData(updater(current)));
  };

  useEffect(() => {
    saveAppState(normalizeStateData(appState));
  }, [appState]);

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

  const currentUser = findCurrentUser(appState);
  const activeScreen = getActiveScreen(appState, currentUser);
  const normalizedVendors = appState.vendors || [];
  const selectedSite =
    appState.sites.find((site) => site.id === appState.ui.selectedSiteId) || appState.sites[0] || null;
  const currentCrewRecord = findCrewForUser(normalizedVendors, currentUser);
  const nextWorkOrderNumber = getNextAmsWorkOrderNumber(appState.workOrders || []);

  const openScreen = (screen) => {
    if (!currentUser || screen === "logout") return;
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
        directVendorId: "",
        externalWorkOrderNumber: "",
        requireBeforeAfterPhotos: false,
      });
    }
    if (type === "job") {
      setJobCreateForm({ workOrderId: "", vendorId: "", price: "" });
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

  const handleLogin = (email, password) => {
    const match = (appState.users || []).find(
      (user) =>
        user.email.toLowerCase() === email.trim().toLowerCase() &&
        user.password === password &&
        user.active
    );

    if (!match) {
      window.alert("Invalid email or password.");
      return;
    }

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
  };

  const handleDemoLogin = (type) => {
    if (type === "ams") return handleLogin("admin@amsdemo.local", "Admin123");
    return handleLogin("crew@amsdemo.local", "Vendor123");
  };

  const logout = () => {
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
    if (!siteForm.name.trim() || !siteForm.address.trim() || !siteForm.state.trim()) {
      window.alert("Site name, address, and state are required.");
      return;
    }

    if (editingSiteId) {
      updateAppState((current) => ({
        ...current,
        sites: current.sites.map((site) =>
          site.id === editingSiteId ? { ...site, ...siteForm } : site
        ),
      }));
    } else {
      updateAppState((current) => ({
        ...current,
        sites: [{ id: createId("site"), ...siteForm }, ...current.sites],
      }));
    }

    setSiteForm({ name: "", address: "", state: "", internalNotes: "" });
    setEditingSiteId(null);
    closeModal();
  };

  const startEditSite = (site) => {
    setSiteForm({
      name: site.name,
      address: site.address,
      state: site.state || "",
      internalNotes: site.internalNotes || "",
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
    if (!vendorForm.name.trim() || !vendorForm.serviceType) {
      window.alert("Crew name and primary service type are required.");
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

    const vendorRecord = {
      name: vendorForm.name.trim(),
      serviceType: vendorForm.serviceType,
      serviceTypes: parsedServiceTypes.length ? parsedServiceTypes : [vendorForm.serviceType],
      states: parsedStates,
      userId: existingVendor?.userId || "",
    };

    if (editingVendorId) {
      updateAppState((current) => ({
        ...current,
        vendors: current.vendors.map((vendor) =>
          vendor.id === editingVendorId ? { ...vendor, ...vendorRecord } : vendor
        ),
      }));
    } else {
      updateAppState((current) => ({
        ...current,
        vendors: [{ id: createId("vendor"), active: true, ...vendorRecord }, ...current.vendors],
      }));
    }

    setVendorForm({ name: "", serviceType: "", serviceTypes: "", states: "" });
    setEditingVendorId(null);
    closeModal();
  };

  const startEditVendor = (vendor) => {
    const normalizedVendor = normalizeVendor(vendor);
    setVendorForm({
      name: normalizedVendor.name,
      serviceType: normalizedVendor.serviceType,
      serviceTypes: normalizedVendor.serviceTypes.join(", "),
      states: normalizedVendor.states.join(", "),
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

    if (editingUserId) {
      updateAppState((current) => ({
        ...current,
        users: current.users.map((user) =>
          user.id === editingUserId ? { ...user, ...userForm } : user
        ),
      }));
    } else {
      updateAppState((current) => ({
        ...current,
        users: [{ id: createId("user"), active: true, ...userForm }, ...current.users],
      }));
    }

    setUserForm({ name: "", email: "", password: "", role: ROLES.AMS_ADMIN });
    setEditingUserId(null);
  };

  const startEditUser = (user) => {
    setUserForm({
      name: user.name,
      email: user.email,
      password: user.password,
      role: user.role,
    });
    setEditingUserId(user.id);
  };

  const toggleUserActive = (userId) => {
    updateAppState((current) => ({
      ...current,
      users: current.users.map((user) =>
        user.id === userId ? { ...user, active: !user.active } : user
      ),
    }));
  };
  const createWorkOrder = () => {
    if (!workOrderForm.siteId || !workOrderForm.description.trim()) {
      window.alert("Site and description are required.");
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
      createdAt,
    };

    const createdJob = directVendor ? buildJobRecord({ workOrder: record, vendor: directVendor, price: "" }) : null;

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
      directVendorId: "",
      externalWorkOrderNumber: "",
      requireBeforeAfterPhotos: false,
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

    const newJob = buildJobRecord({ workOrder, vendor, price: "" });

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

    const newJob = buildJobRecord({ workOrder, vendor, price: jobCreateForm.price });
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
      jobs: current.jobs.map((job) =>
        job.id === jobId
          ? {
              ...job,
              status,
              completedAt: status === "Completed" ? new Date().toISOString() : job.completedAt,
            }
          : job
      ),
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
    const newJob = buildJobRecord({ workOrder: selectedWorkOrder, vendor, price: approvedPrice });

    updateAppState((current) => ({
      ...current,
      proposals: current.proposals.map((proposal) => {
        if (proposal.id === selectedProposal.id) {
          return {
            ...proposal,
            status: "approved",
            reviewedPrice: approvedPrice,
            amsNotes: reviewForm.amsNotes,
            approvedAt,
            isActivePath: true,
            lastReviewedAt: approvedAt,
          };
        }
        if (proposal.workOrderId === selectedWorkOrder.id && proposal.isActivePath) {
          return {
            ...proposal,
            status: proposal.id === selectedProposal.id ? "approved" : "rejected",
            rejectedAt: proposal.id === selectedProposal.id ? proposal.rejectedAt : approvedAt,
            isActivePath: proposal.id === selectedProposal.id,
            lastReviewedAt: approvedAt,
          };
        }
        return proposal;
      }),
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
    const invoice = buildInvoiceRecord({ job, workOrder, currentUser });
    updateAppState((current) => ({ ...current, invoices: [invoice, ...current.invoices] }));
    setSelectedInvoiceId(invoice.id);
  };

  const saveInvoice = () => {
    if (!selectedInvoiceId) return;
    updateAppState((current) => ({
      ...current,
      invoices: current.invoices.map((invoice) =>
        invoice.id === selectedInvoiceId ? { ...invoice, ...invoiceForm } : invoice
      ),
    }));
  };

  const updateInvoiceStatus = (status) => {
    if (!selectedInvoiceId) return;
    const timestamp = new Date().toISOString();
    updateAppState((current) => ({
      ...current,
      invoices: current.invoices.map((invoice) =>
        invoice.id === selectedInvoiceId
          ? {
              ...invoice,
              ...invoiceForm,
              status,
              submittedAt: status === "Submitted" && !invoice.submittedAt ? timestamp : invoice.submittedAt,
            }
          : invoice
      ),
    }));
  };

  const openWorkOrders = appState.workOrders.filter((entry) => entry.status === "Open");
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
      ? appState.sites.filter((site) => visibleCrewJobs.some((job) => job.siteId === site.id))
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
    searchMatches([site.name, site.address, site.state, site.internalNotes], siteSearch)
  );
  const filteredCrews = normalizedVendors.filter((vendor) =>
    searchMatches(
      [vendor.name, vendor.serviceType, vendor.serviceTypes.join(", "), vendor.states.join(", ")],
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

  const selectedWorkOrder =
    appState.workOrders.find((workOrder) => workOrder.id === selectedWorkOrderId) || filteredWorkOrders[0] || null;
  const selectedJob = appState.jobs.find((job) => job.id === selectedJobId) || filteredJobs[0] || null;
  const selectedCrew = normalizedVendors.find((vendor) => vendor.id === selectedCrewId) || filteredCrews[0] || null;
  const selectedProposal = appState.proposals.find((proposal) => proposal.id === selectedProposalId) || filteredProposals[0] || null;
  const selectedInvoice = appState.invoices.find((invoice) => invoice.id === selectedInvoiceId) || filteredInvoices[0] || null;
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
      setReviewForm({ reviewedPrice: "", amsNotes: "" });
      return;
    }
    setReviewForm({
      reviewedPrice: selectedProposal.reviewedPrice || selectedProposal.submittedPrice || "",
      amsNotes: selectedProposal.amsNotes || "",
    });
    if (selectedProposal.workOrderId !== selectedWorkOrderId) {
      setSelectedWorkOrderId(selectedProposal.workOrderId);
    }
  }, [selectedProposal]);

  useEffect(() => {
    if (!selectedWorkOrder) {
      setWorkOrderDetailForm({ externalWorkOrderNumber: "", requireBeforeAfterPhotos: false });
      return;
    }
    setWorkOrderDetailForm({
      externalWorkOrderNumber: selectedWorkOrder.externalWorkOrderNumber || "",
      requireBeforeAfterPhotos: Boolean(selectedWorkOrder.requireBeforeAfterPhotos),
    });
  }, [selectedWorkOrder]);

  useEffect(() => {
    if (!selectedInvoice) {
      setInvoiceForm({ invoiceNumber: "", amount: "", notes: "", status: "Not Submitted" });
      return;
    }
    setInvoiceForm({
      invoiceNumber: selectedInvoice.invoiceNumber || "",
      amount: selectedInvoice.amount || "",
      notes: selectedInvoice.notes || "",
      status: selectedInvoice.status || "Not Submitted",
    });
  }, [selectedInvoice]);

  const topActions = [
    { key: "createWorkOrder", label: "Create Work Order", onClick: () => openModal("workOrder"), featured: true },
    { key: "workOrders", label: "Work Orders", onClick: () => openScreen("workOrders") },
    { key: "jobs", label: "Jobs", onClick: () => openScreen("jobs") },
    { key: "sites", label: "Sites", onClick: () => openScreen("sites") },
    { key: "vendors", label: SCREEN_LABELS.vendors, onClick: () => openScreen("vendors") },
    { key: "proposals", label: "Proposals", onClick: () => openScreen("proposals") },
  ];

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
          { label: "Total Users", value: appState.users.length },
          { label: "Total Sites", value: appState.sites.length },
          { label: "Total Crews", value: appState.vendors.length },
          { label: "Accounting Items", value: appState.invoices.length },
        ]} />
      </PageSection>
    </div>
  );

  const amsDashboard = (
    <div className="screen-grid">
      <TopActionBar actions={topActions} />
      <div className="ams-dashboard-grid">
        <div className="dashboard-side-stack">
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
          <PageSection title="Weather">
            <button className="weather-card" onClick={() => showPlaceholder("Weather integration will be added in a later build.")}>
              <div className="weather-icon">Partly Sunny</div>
              <div><strong>Foxboro, MA</strong><p>Weather integration and alerts are reserved for a later build.</p></div>
            </button>
          </PageSection>
        </div>
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
      {visibleCrewJobs.length ? <div className="job-card-grid">{visibleCrewJobs.map((job) => <JobCard key={job.id} job={job} onStart={(jobId) => updateJobStatus(jobId, "In Progress")} onComplete={(jobId) => updateJobStatus(jobId, "Completed")} onHelp={(jobId) => updateJobStatus(jobId, "Need Help")} />)}</div> : <EmptyState title="No jobs assigned" text="Assigned jobs will appear here." />}
    </PageSection>
  );

  const crewSitesSection = (
    <PageSection title="My Sites">
      {vendorSites.length ? <div className="site-card-grid">{vendorSites.map((site) => <article key={site.id} className="simple-card vendor-site-card"><strong>{site.name}</strong><p>{site.address}</p><span className="site-state-tag">{site.state}</span></article>)}</div> : <EmptyState title="No sites available" text="Assigned site information will appear here." />}
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
      {crewInvoices.length ? <DataTable columns={[{ key: "site", label: "Site", render: (row) => row.job.siteName }, { key: "service", label: "Service Type", render: (row) => row.job.serviceType }, { key: "invoice", label: "Invoice Number", render: (row) => row.invoice?.invoiceNumber || "Not created" }, { key: "amount", label: "Amount", render: (row) => formatMoney(row.invoice?.amount || row.job.price) }, { key: "status", label: "Status", render: (row) => <InvoiceStatusBadge value={row.invoice?.status || "Ready for Invoice"} /> }, { key: "notes", label: "Notes", render: (row) => row.invoice?.notes || "No notes yet." }]} rows={crewInvoices.map(({ job, invoice }) => ({ id: job.id, job, invoice }))} emptyTitle="No invoices" emptyText="Completed job invoice tracking will appear here." /> : <EmptyState title="No invoices yet" text="Completed job invoice tracking will appear here." />}
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

  const usersScreen = (
    <div className="screen-grid">
      <PageSection title="User Management">
        <InputRow>
          <Field label="Name"><input value={userForm.name} onChange={(event) => setUserForm((current) => ({ ...current, name: event.target.value }))} /></Field>
          <Field label="Email"><input value={userForm.email} onChange={(event) => setUserForm((current) => ({ ...current, email: event.target.value }))} /></Field>
          <Field label="Password"><input type="password" value={userForm.password} onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))} /></Field>
          <Field label="Role"><select value={userForm.role} onChange={(event) => setUserForm((current) => ({ ...current, role: event.target.value }))}>{Object.values(ROLES).map((role) => <option key={role} value={role}>{role}</option>)}</select></Field>
        </InputRow>
        <div className="form-actions"><button className="primary-button" onClick={saveUser}>{editingUserId ? "Update User" : "Add User"}</button></div>
      </PageSection>
      <PageSection title="Current Users"><DataTable columns={[{ key: "name", label: "Name", render: (row) => row.name }, { key: "email", label: "Email", render: (row) => row.email }, { key: "role", label: "Role", render: (row) => row.role }, { key: "active", label: "Status", render: (row) => (row.active ? "Active" : "Inactive") }, { key: "actions", label: "Actions", render: (row) => <div className="table-actions"><button className="secondary-button" onClick={(event) => { event.stopPropagation(); startEditUser(row); }}>Edit</button><button className="secondary-button" onClick={(event) => { event.stopPropagation(); toggleUserActive(row.id); }}>{row.active ? "Deactivate" : "Activate"}</button></div> }]} rows={appState.users} emptyTitle="No users" emptyText="Users added here will persist locally." /></PageSection>
    </div>
  );

  const sitesScreen = (
    <div className="screen-grid">
      <PageSection title="Sites" action={<button className="primary-button" onClick={() => { setEditingSiteId(null); setSiteForm({ name: "", address: "", state: "", internalNotes: "" }); openModal("site"); }}>Create Site</button>}>
        <SplitView
          list={<div className="list-stack"><SearchBar value={siteSearch} onChange={setSiteSearch} placeholder="Search sites" /><div className="list-scroll"><DataTable columns={[{ key: "name", label: "Name", render: (row) => row.name }, { key: "address", label: "Address", render: (row) => row.address }, { key: "state", label: "State", render: (row) => row.state }]} rows={filteredSites} selectedRowId={appState.ui.selectedSiteId} onRowClick={(row) => setSelectedSite(row.id)} emptyTitle="No sites" emptyText="Add a site to start routing work orders." /></div></div>}
          detail={selectedSite ? <div className="detail-stack"><SiteDetailsCard site={selectedSite} relatedWorkOrderCount={appState.workOrders.filter((workOrder) => workOrder.siteId === selectedSite.id).length} /><div className="form-actions"><button className="secondary-button" onClick={() => startEditSite(selectedSite)}>Edit Site</button><button className="secondary-button danger-button" onClick={() => removeSite(selectedSite.id)}>Remove Site</button></div></div> : <EmptyState title="No site selected" text="Select a site to view details." />}
        />
      </PageSection>
    </div>
  );

  const crewsScreen = (
    <div className="screen-grid">
      <PageSection title="Crews" action={<button className="primary-button" onClick={() => { setEditingVendorId(null); setVendorForm({ name: "", serviceType: "", serviceTypes: "", states: "" }); openModal("vendor"); }}>Create Crew</button>}>
        <SplitView
          list={<div className="list-stack"><SearchBar value={crewSearch} onChange={setCrewSearch} placeholder="Search crews" /><div className="list-scroll"><DataTable columns={[{ key: "name", label: "Crew", render: (row) => row.name }, { key: "serviceType", label: "Primary Service", render: (row) => row.serviceType }, { key: "states", label: "States", render: (row) => row.states.join(", ") }, { key: "status", label: "Status", render: (row) => (row.active ? "Active" : "Inactive") }]} rows={filteredCrews} selectedRowId={selectedCrew?.id} onRowClick={(row) => setSelectedCrewId(row.id)} emptyTitle="No crews" emptyText="Add a crew before assigning jobs." /></div></div>}
          detail={selectedCrew ? <div className="detail-card"><div className="proposal-summary-top"><div><strong>{selectedCrew.name}</strong><p>{selectedCrew.serviceType}</p></div><StatusBadge value={selectedCrew.active ? "active" : "inactive"} label={selectedCrew.active ? "Active" : "Inactive"} /></div><div className="proposal-summary-grid"><div><span className="detail-label">Service Types</span><p>{selectedCrew.serviceTypes.join(", ")}</p></div><div><span className="detail-label">Coverage</span><p>{selectedCrew.states.join(", ") || "Not set"}</p></div><div><span className="detail-label">Linked User</span><p>{selectedCrew.userId || "Not linked"}</p></div></div><div className="form-actions"><button className="secondary-button" onClick={() => startEditVendor(selectedCrew)}>Edit Crew</button><button className="secondary-button" onClick={() => toggleVendorActive(selectedCrew.id)}>{selectedCrew.active ? "Deactivate" : "Activate"}</button></div></div> : <EmptyState title="No crew selected" text="Select a crew to view details." />}
        />
      </PageSection>
    </div>
  );

  const jobsScreen = (
    <div className="screen-grid">
      <PageSection title="Jobs" action={<button className="primary-button" onClick={() => openModal("job")}>Create Job</button>}>
        <SplitView
          list={<div className="list-stack"><div className="list-toolbar"><SearchBar value={jobSearch} onChange={setJobSearch} placeholder="Search jobs" /><FilterRow label="Filter" value={jobFilter} options={JOB_FILTERS} onChange={setJobFilter} /></div><div className="list-scroll"><DataTable columns={[{ key: "siteName", label: "Site", render: (row) => row.siteName }, { key: "vendorName", label: "Crew", render: (row) => row.vendorName || "Unassigned" }, { key: "serviceType", label: "Service Type", render: (row) => row.serviceType }, { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> }]} rows={filteredJobs} selectedRowId={selectedJob?.id} onRowClick={(row) => setSelectedJobId(row.id)} emptyTitle="No jobs" emptyText="Assign crews from work orders or approve a proposal to create jobs." /></div></div>}
          detail={selectedJob ? <div className="detail-card"><div className="proposal-summary-top"><div><strong>{selectedJob.siteName}</strong><p>{selectedJob.description}</p></div><StatusBadge value={selectedJob.status} /></div><div className="proposal-summary-grid"><div><span className="detail-label">Crew</span><p>{selectedJob.vendorName || "Unassigned"}</p></div><div><span className="detail-label">Service Type</span><p>{selectedJob.serviceType}</p></div><div><span className="detail-label">Price</span><p>{formatMoney(selectedJob.price)}</p></div><div><span className="detail-label">Invoice</span><p>{getInvoiceForJob(appState.invoices, selectedJob.id)?.invoiceNumber || "Not created"}</p></div></div><Field label="Job Status"><select value={selectedJob.status} onChange={(event) => updateJobStatus(selectedJob.id, event.target.value)}>{JOB_STATUS.map((status) => <option key={status} value={status}>{status}</option>)}</select></Field></div> : <EmptyState title="No job selected" text="Select a job to view details." />}
        />
      </PageSection>
    </div>
  );

  const workOrdersScreen = (
    <div className="screen-grid">
      <PageSection title="Work Orders" action={<button className="primary-button" onClick={() => openModal("workOrder")}>Create Work Order</button>}>
        <SplitView
          list={<div className="list-stack"><div className="list-toolbar"><SearchBar value={workOrderSearch} onChange={setWorkOrderSearch} placeholder="Search work orders" /><FilterRow label="Filter" value={workOrderFilter} options={WORK_ORDER_FILTERS} onChange={setWorkOrderFilter} /></div><div className="list-scroll"><DataTable columns={[{ key: "reference", label: "AMS Ref", render: (row) => row.amsWorkOrderNumber }, { key: "external", label: "External Ref", render: (row) => row.externalWorkOrderNumber || "Not set" }, { key: "siteName", label: "Site", render: (row) => row.siteName }, { key: "serviceType", label: "Service Type", render: (row) => row.serviceType }, { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> }]} rows={filteredWorkOrders} selectedRowId={selectedWorkOrder?.id} onRowClick={(row) => setSelectedWorkOrderId(row.id)} emptyTitle="No work orders" emptyText="New work orders will appear here." /></div></div>}
          detail={selectedWorkOrder ? <div className="detail-stack"><div className="proposal-review-summary"><div className="proposal-summary-top"><div><strong>{selectedWorkOrder.siteName}</strong><p>{selectedWorkOrder.description}</p></div><div className="proposal-summary-badges"><ProposalStateBadge value={selectedWorkOrder.proposalState} /><StatusBadge value={selectedWorkOrder.status} /></div></div><div className="proposal-summary-grid"><div><span className="detail-label">AMS Work Order</span><p>{selectedWorkOrder.amsWorkOrderNumber}</p></div><div><span className="detail-label">Service Type</span><p>{selectedWorkOrder.serviceType}</p></div><div><span className="detail-label">Assigned Crew</span><p>{selectedWorkOrder.assignedVendorName || "Not assigned"}</p></div><div><span className="detail-label">Job Link</span><p>{selectedWorkOrder.jobId || "No job created yet"}</p></div><div><span className="detail-label">Proposal Requested</span><p>{formatDate(selectedWorkOrder.proposalRequestedAt)}</p></div><div><span className="detail-label">Proposal Awarded</span><p>{formatDate(selectedWorkOrder.proposalAwardedAt)}</p></div></div><InputRow><Field label="External Work Order Number"><input value={workOrderDetailForm.externalWorkOrderNumber} onChange={(event) => setWorkOrderDetailForm((current) => ({ ...current, externalWorkOrderNumber: event.target.value }))} /></Field><Field label="Before / After Photos Required"><select value={workOrderDetailForm.requireBeforeAfterPhotos ? "yes" : "no"} onChange={(event) => setWorkOrderDetailForm((current) => ({ ...current, requireBeforeAfterPhotos: event.target.value === "yes" }))}><option value="no">No</option><option value="yes">Yes</option></select></Field></InputRow><div className="form-actions"><button className="secondary-button" onClick={saveWorkOrderDetail}>Save Detail Updates</button><button className="secondary-button" onClick={() => showPlaceholder("File and image uploads require backend support and will be added in a later build.")}>Attach File / Upload Picture</button>{selectedWorkOrder.proposalRequired ? <button className="primary-button" onClick={() => openScreen("proposals")}>Open Proposal Review</button> : null}</div></div>{selectedWorkOrder.proposalRequired ? <><PageSection title="Proposal Review List"><DataTable columns={[{ key: "vendor", label: "Crew", render: (row) => row.vendorCompanyName }, { key: "submittedPrice", label: "Submitted Price", render: (row) => formatMoney(row.submittedPrice) }, { key: "status", label: "Status", render: (row) => <ProposalStatusBadge value={row.status} /> }, { key: "submittedAt", label: "Submitted At", render: (row) => formatDate(row.submittedAt) }]} rows={selectedWorkOrderProposals} selectedRowId={selectedProposal?.id} onRowClick={(row) => setSelectedProposalId(row.id)} emptyTitle="No proposals" emptyText="Crew proposals will appear here." /></PageSection><PageSection title="Proposal Decision Panel">{renderProposalDecision(selectedProposal, selectedWorkOrder)}</PageSection></> : <div className="detail-card"><div className="proposal-summary-grid"><div><span className="detail-label">Assignment</span><div className="assignment-cell"><select value={jobAssignment[selectedWorkOrder.id] || selectedWorkOrder.assignedVendorId || ""} disabled={Boolean(appState.jobs.find((job) => job.workOrderId === selectedWorkOrder.id))} onChange={(event) => setJobAssignment((current) => ({ ...current, [selectedWorkOrder.id]: event.target.value }))}><option value="">Select crew</option>{normalizedVendors.filter((vendor) => vendor.active).map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select><button className="secondary-button" disabled={Boolean(appState.jobs.find((job) => job.workOrderId === selectedWorkOrder.id))} onClick={() => assignVendorToWorkOrder(selectedWorkOrder.id)}>Assign + Create Job</button></div></div><div><span className="detail-label">Work Order Status</span><select value={selectedWorkOrder.status} onChange={(event) => updateWorkOrderStatus(selectedWorkOrder.id, event.target.value)}>{WORK_ORDER_STATUS.map((status) => <option key={status} value={status}>{status}</option>)}</select></div></div></div>}</div> : <EmptyState title="No work order selected" text="Select a work order to review details." />}
        />
      </PageSection>
    </div>
  );

  const proposalsScreen = (
    <div className="screen-grid">
      <PageSection title="Proposals">
        <SplitView
          list={<div className="list-stack"><SearchBar value={proposalSearch} onChange={setProposalSearch} placeholder="Search proposals" /><div className="list-scroll"><DataTable columns={[{ key: "crew", label: "Crew", render: (row) => row.vendorCompanyName }, { key: "site", label: "Site", render: (row) => appState.workOrders.find((entry) => entry.id === row.workOrderId)?.siteName || "Unknown" }, { key: "price", label: "Submitted Price", render: (row) => formatMoney(row.submittedPrice) }, { key: "status", label: "Status", render: (row) => <ProposalStatusBadge value={row.status} /> }]} rows={filteredProposals} selectedRowId={selectedProposal?.id} onRowClick={(row) => setSelectedProposalId(row.id)} emptyTitle="No proposals" emptyText="Proposal submissions will appear here." /></div></div>}
          detail={<div className="detail-stack"><PageSection title="Work Order Summary">{selectedProposal ? (() => { const workOrder = appState.workOrders.find((entry) => entry.id === selectedProposal.workOrderId); return workOrder ? <div className="proposal-review-summary"><div className="proposal-summary-top"><div><strong>{workOrder.siteName}</strong><p>{workOrder.description}</p></div><div className="proposal-summary-badges"><ProposalStateBadge value={workOrder.proposalState} /><StatusBadge value={workOrder.status} /></div></div><div className="proposal-summary-grid"><div><span className="detail-label">AMS Work Order</span><p>{workOrder.amsWorkOrderNumber}</p></div><div><span className="detail-label">Service Type</span><p>{workOrder.serviceType}</p></div><div><span className="detail-label">External Ref</span><p>{workOrder.externalWorkOrderNumber || "Not set"}</p></div><div><span className="detail-label">Photos Required</span><p>{workOrder.requireBeforeAfterPhotos ? "Yes" : "No"}</p></div></div></div> : <EmptyState title="No work order found" text="This proposal is missing its work order reference." />; })() : <EmptyState title="No proposal selected" text="Choose a proposal to review." />}</PageSection><PageSection title="Proposal Decision Panel">{renderProposalDecision(selectedProposal, selectedProposal ? appState.workOrders.find((entry) => entry.id === selectedProposal.workOrderId) : null)}</PageSection></div>}
        />
      </PageSection>
    </div>
  );

  const accountingScreen = (
    <div className="screen-grid">
      <PageSection title="Accounting Snapshot"><StatGrid items={[{ label: "Ready for Invoice", value: readyForInvoiceJobs.length }, { label: "Submitted", value: appState.invoices.filter((invoice) => invoice.status === "Submitted").length }, { label: "Under Review", value: appState.invoices.filter((invoice) => invoice.status === "Under Review").length }, { label: "Approved", value: appState.invoices.filter((invoice) => invoice.status === "Approved").length }, { label: "Paid", value: appState.invoices.filter((invoice) => invoice.status === "Paid").length }]} /></PageSection>
      <SplitView
        list={<div className="detail-stack"><PageSection title="Ready for Invoice Queue"><div className="list-scroll compact-scroll"><DataTable columns={[{ key: "site", label: "Site", render: (row) => row.siteName }, { key: "crew", label: "Crew", render: (row) => row.vendorName }, { key: "service", label: "Service Type", render: (row) => row.serviceType }, { key: "status", label: "Job Status", render: (row) => row.status }, { key: "price", label: "Price", render: (row) => formatMoney(row.price) }, { key: "action", label: "Action", render: (row) => <button className="secondary-button" onClick={(event) => { event.stopPropagation(); createInvoiceForJob(row); }}>Create Invoice</button> }]} rows={readyForInvoiceJobs} emptyTitle="No jobs ready" emptyText="Completed jobs without invoices will appear here." /></div></PageSection><PageSection title="Invoice Tracker"><div className="list-stack"><SearchBar value={invoiceSearch} onChange={setInvoiceSearch} placeholder="Search invoices" /><div className="list-scroll compact-scroll"><DataTable columns={[{ key: "invoiceNumber", label: "Invoice Number", render: (row) => row.invoiceNumber || "Not set" }, { key: "site", label: "Site", render: (row) => row.siteName }, { key: "crew", label: "Crew", render: (row) => row.vendorName }, { key: "amount", label: "Amount", render: (row) => formatMoney(row.amount) }, { key: "submittedAt", label: "Submitted At", render: (row) => formatDate(row.submittedAt) }, { key: "status", label: "Status", render: (row) => <InvoiceStatusBadge value={row.status} /> }]} rows={filteredInvoices} selectedRowId={selectedInvoice?.id} onRowClick={(row) => setSelectedInvoiceId(row.id)} emptyTitle="No invoices" emptyText="Invoice records will appear here." /></div></div></PageSection></div>}
        detail={<PageSection title="Invoice Editor Panel">{selectedInvoice ? <div className="detail-stack"><div className="proposal-summary-grid"><div><span className="detail-label">Site</span><p>{selectedInvoice.siteName}</p></div><div><span className="detail-label">Crew</span><p>{selectedInvoice.vendorName}</p></div><div><span className="detail-label">Service Type</span><p>{selectedInvoice.serviceType}</p></div><div><span className="detail-label">Job Status</span><p>{selectedInvoice.jobStatus}</p></div></div><InputRow><Field label="Invoice Number"><input value={invoiceForm.invoiceNumber} onChange={(event) => setInvoiceForm((current) => ({ ...current, invoiceNumber: event.target.value }))} /></Field><Field label="Amount"><input value={invoiceForm.amount} onChange={(event) => setInvoiceForm((current) => ({ ...current, amount: event.target.value }))} /></Field><Field label="Status"><select value={invoiceForm.status} onChange={(event) => setInvoiceForm((current) => ({ ...current, status: event.target.value }))}>{INVOICE_STATUS.map((status) => <option key={status} value={status}>{status}</option>)}</select></Field><Field label="Notes"><textarea rows="5" value={invoiceForm.notes} onChange={(event) => setInvoiceForm((current) => ({ ...current, notes: event.target.value }))} /></Field></InputRow><div className="decision-actions"><button className="secondary-button" onClick={saveInvoice}>Save Invoice</button><button className="secondary-button" onClick={() => updateInvoiceStatus("Submitted")}>Mark Submitted</button><button className="secondary-button" onClick={() => updateInvoiceStatus("Approved")}>Mark Approved</button><button className="primary-button" onClick={() => updateInvoiceStatus("Paid")}>Mark Paid</button></div></div> : <EmptyState title="No invoice selected" text="Select an invoice to edit." />}</PageSection>}
      />
    </div>
  );

  const profileScreen = currentUser ? <div className="screen-grid"><PageSection title="Profile"><div className="profile-summary"><div><strong>{currentUser.name}</strong><p>{currentUser.email}</p></div><div className="status-pill active">{currentUser.role}</div></div></PageSection></div> : null;

  function renderScreen() {
    if (!currentUser) return null;
    if (currentUser.role === ROLES.OPERATOR) return <UnderConstruction title="Operator Portal" message="Operator workflow screens will be added in a later version." />;
    if (currentUser.role === ROLES.CUSTOMER) return <UnderConstruction title="Customer Portal" message="Customer workflow screens will be added in a later version." />;
    if (UNDER_CONSTRUCTION_SCREENS.has(activeScreen)) return <UnderConstruction title={SCREEN_LABELS[activeScreen]} message={`${SCREEN_LABELS[activeScreen]} is reserved for a future additive release.`} />;
    if (activeScreen === "profile") return profileScreen;
    if (activeScreen === "myJobs") return <div className="screen-grid vendor-screen">{crewJobsSection}</div>;
    if (activeScreen === "mySites") return <div className="screen-grid vendor-screen">{crewSitesSection}</div>;
    if (activeScreen === "myProposals") return <div className="screen-grid vendor-screen">{crewProposalStatusSection}</div>;
    if (activeScreen === "myInvoices") return <div className="screen-grid vendor-screen">{crewInvoicesSection}</div>;
    if (activeScreen === "availableWork") return <div className="screen-grid vendor-screen">{crewAvailableWorkSection}</div>;
    if (activeScreen === "users") return usersScreen;
    if (activeScreen === "sites") return sitesScreen;
    if (activeScreen === "vendors") return crewsScreen;
    if (activeScreen === "workOrders") return workOrdersScreen;
    if (activeScreen === "proposals") return proposalsScreen;
    if (activeScreen === "jobs") return jobsScreen;
    if (activeScreen === "accounting") return accountingScreen;
    if (currentUser.role === ROLES.OWNER) return ownerDashboard;
    if (AMS_ROLES.includes(currentUser.role)) return amsDashboard;
    if (currentUser.role === ROLES.CREW && activeScreen === "dashboard") return crewDashboard;
    return <UnderConstruction title="Screen Unavailable" message="This screen is reserved for future development." />;
  }

  if (!currentUser) {
    return <LoginScreen email={loginForm.email} password={loginForm.password} onChange={updateLoginField} onLogin={() => handleLogin(loginForm.email, loginForm.password)} onDemoLogin={handleDemoLogin} />;
  }

  return (
    <div className="app-shell">
      <Drawer open={drawerOpen} menuItems={DRAWER_MENUS[currentUser.role]} activeScreen={activeScreen} labels={SCREEN_LABELS} currentUser={currentUser} onNavigate={openScreen} onLogout={logout} onClose={() => setDrawerOpen(false)} />
      <div className="main-shell">
        <Header currentUser={currentUser} onOpenDrawer={() => setDrawerOpen(true)} onOpenNotifications={() => showPlaceholder("Notifications will be added in a later build.")} onToggleProfileMenu={() => setProfileMenuOpen((open) => !open)} profileMenuOpen={profileMenuOpen} onNavigate={openScreen} onLogout={logout} />
        <main className="content-shell"><div className="screen-header"><div><div className="eyebrow">Build 0.4</div><h1>{SCREEN_LABELS[activeScreen] || "Dashboard"}</h1></div></div>{renderScreen()}</main>
      </div>

      <Modal open={activeModal === "workOrder"} title="Create Work Order" onClose={closeModal} footer={<div className="form-actions"><button className="secondary-button" onClick={() => showPlaceholder("File and image uploads require backend support and will be added in a later build.")}>Attach File / Upload Picture</button><button className="primary-button" onClick={createWorkOrder}>Create Work Order</button></div>}>
        <div className="modal-reference">AMS Work Order Number: {nextWorkOrderNumber}</div>
        <InputRow><Field label="External Work Order Number"><input value={workOrderForm.externalWorkOrderNumber} onChange={(event) => setWorkOrderForm((current) => ({ ...current, externalWorkOrderNumber: event.target.value }))} /></Field><Field label="Site"><select value={workOrderForm.siteId} onChange={(event) => setWorkOrderForm((current) => ({ ...current, siteId: event.target.value }))}><option value="">Select site</option>{appState.sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></Field><Field label="Service Type"><select value={workOrderForm.serviceType} onChange={(event) => setWorkOrderForm((current) => ({ ...current, serviceType: event.target.value }))}><option value="">Select service type</option>{SERVICE_TYPES.map((serviceType) => <option key={serviceType} value={serviceType}>{serviceType}</option>)}</select></Field><Field label="Workflow Path"><select value={workOrderForm.workflowType} onChange={(event) => setWorkOrderForm((current) => ({ ...current, workflowType: event.target.value, directVendorId: event.target.value === "proposal" ? "" : current.directVendorId }))}><option value="direct">Direct Assignment</option><option value="proposal">Proposal Opportunity</option></select></Field><Field label="Assign Crew Now"><select value={workOrderForm.directVendorId} disabled={workOrderForm.workflowType !== "direct"} onChange={(event) => setWorkOrderForm((current) => ({ ...current, directVendorId: event.target.value }))}><option value="">Leave unassigned</option>{normalizedVendors.filter((vendor) => vendor.active).map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></Field><Field label="Description"><textarea rows="4" value={workOrderForm.description} onChange={(event) => setWorkOrderForm((current) => ({ ...current, description: event.target.value }))} /></Field></InputRow>
        <label className="checkbox-inline"><input type="checkbox" checked={workOrderForm.requireBeforeAfterPhotos} onChange={(event) => setWorkOrderForm((current) => ({ ...current, requireBeforeAfterPhotos: event.target.checked }))} />Require before and after photos</label>
      </Modal>

      <Modal open={activeModal === "site"} title={editingSiteId ? "Edit Site" : "Create Site"} onClose={closeModal} footer={<button className="primary-button" onClick={saveSite}>{editingSiteId ? "Update Site" : "Add Site"}</button>}><InputRow><Field label="Site Name"><input value={siteForm.name} onChange={(event) => setSiteForm((current) => ({ ...current, name: event.target.value }))} /></Field><Field label="Address"><input value={siteForm.address} onChange={(event) => setSiteForm((current) => ({ ...current, address: event.target.value }))} /></Field><Field label="State"><input value={siteForm.state} maxLength={2} onChange={(event) => setSiteForm((current) => ({ ...current, state: event.target.value.toUpperCase() }))} /></Field><Field label="Internal Notes"><textarea rows="4" value={siteForm.internalNotes} onChange={(event) => setSiteForm((current) => ({ ...current, internalNotes: event.target.value }))} /></Field></InputRow></Modal>

      <Modal open={activeModal === "vendor"} title={editingVendorId ? "Edit Crew" : "Create Crew"} onClose={closeModal} footer={<button className="primary-button" onClick={saveVendor}>{editingVendorId ? "Update Crew" : "Add Crew"}</button>}><InputRow><Field label="Crew Name"><input value={vendorForm.name} onChange={(event) => setVendorForm((current) => ({ ...current, name: event.target.value }))} /></Field><Field label="Primary Service Type"><select value={vendorForm.serviceType} onChange={(event) => setVendorForm((current) => ({ ...current, serviceType: event.target.value }))}><option value="">Select service type</option>{SERVICE_TYPES.map((serviceType) => <option key={serviceType} value={serviceType}>{serviceType}</option>)}</select></Field><Field label="Service Types"><input value={vendorForm.serviceTypes} onChange={(event) => setVendorForm((current) => ({ ...current, serviceTypes: event.target.value }))} placeholder="Snow Removal, Landscaping" /></Field><Field label="States"><input value={vendorForm.states} onChange={(event) => setVendorForm((current) => ({ ...current, states: event.target.value.toUpperCase() }))} placeholder="MA, RI" /></Field></InputRow></Modal>

      <Modal open={activeModal === "job"} title="Create Job" onClose={closeModal} footer={<button className="primary-button" onClick={createManualJob}>Create Job</button>}><InputRow><Field label="Work Order"><select value={jobCreateForm.workOrderId} onChange={(event) => setJobCreateForm((current) => ({ ...current, workOrderId: event.target.value }))}><option value="">Select work order</option>{appState.workOrders.filter((workOrder) => !appState.jobs.some((job) => job.workOrderId === workOrder.id)).map((workOrder) => <option key={workOrder.id} value={workOrder.id}>{workOrder.amsWorkOrderNumber} � {workOrder.siteName}</option>)}</select></Field><Field label="Crew"><select value={jobCreateForm.vendorId} onChange={(event) => setJobCreateForm((current) => ({ ...current, vendorId: event.target.value }))}><option value="">Select crew</option>{normalizedVendors.filter((vendor) => vendor.active).map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></Field><Field label="Price"><input value={jobCreateForm.price} onChange={(event) => setJobCreateForm((current) => ({ ...current, price: event.target.value }))} /></Field></InputRow></Modal>
    </div>
  );
}

export default AppBuild03;
