import React, { useEffect, useState } from "react";
import {
  AMS_ROLES,
  DRAWER_MENUS,
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
  PageSection,
  SiteDetailsCard,
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

function findCurrentUser(state) {
  return state.users.find((user) => user.id === state.ui.currentUserId) || null;
}

function getActiveScreen(state, user) {
  if (!user) return "dashboard";
  return state.ui.activeScreenByRole[user.role] || "dashboard";
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

function normalizeWorkOrder(workOrder, proposals, jobs) {
  const linkedJob = jobs.find((job) => job.workOrderId === workOrder.id);
  const normalized = {
    ...workOrder,
    proposalRequired: Boolean(workOrder.proposalRequired),
    proposalRequestedAt: workOrder.proposalRequestedAt || "",
    proposalAwardedAt: workOrder.proposalAwardedAt || "",
    assignedVendorId: workOrder.assignedVendorId || "",
    assignedVendorName: workOrder.assignedVendorName || "",
    jobId: workOrder.jobId || linkedJob?.id || "",
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
  const workOrders = (state.workOrders || []).map((workOrder) =>
    normalizeWorkOrder(workOrder, proposals, jobs)
  );
  const selectedSiteId =
    state.ui?.selectedSiteId && (state.sites || []).some((site) => site.id === state.ui.selectedSiteId)
      ? state.ui.selectedSiteId
      : state.sites?.[0]?.id || null;

  return {
    ...state,
    vendors,
    proposals,
    jobs,
    workOrders,
    ui: {
      currentUserId: state.ui?.currentUserId || null,
      selectedSiteId,
      activeScreenByRole: {
        [ROLES.OWNER]: "dashboard",
        [ROLES.AMS_ADMIN]: "dashboard",
        [ROLES.AMS_MANAGER]: "dashboard",
        [ROLES.VENDOR]: "dashboard",
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

function findVendorForUser(vendors, currentUser) {
  if (!currentUser || currentUser.role !== ROLES.VENDOR) return null;

  return (
    vendors.find((vendor) => vendor.userId && vendor.userId === currentUser.id) ||
    vendors.find((vendor) => vendor.name === currentUser.name) ||
    null
  );
}

function getVendorWorkOrderProposals(proposals, workOrderId, vendorId) {
  return sortByNewest(
    proposals.filter(
      (proposal) => proposal.workOrderId === workOrderId && proposal.vendorId === vendorId
    ),
    "submittedAt"
  );
}

function getLatestVendorProposal(proposals, workOrderId, vendorId) {
  return getVendorWorkOrderProposals(proposals, workOrderId, vendorId)[0] || null;
}

function isVendorEligibleForWorkOrder({ workOrder, site, vendor, proposals, jobs }) {
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

function canVendorSubmitProposal({ workOrder, site, vendor, proposals, jobs }) {
  if (!isVendorEligibleForWorkOrder({ workOrder, site, vendor, proposals, jobs })) return false;

  const latestProposal = getLatestVendorProposal(proposals, workOrder.id, vendor.id);
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
  };
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

function AppBuild03() {
  const [appState, setAppState] = useState(() => normalizeStateData(loadAppState()));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [workOrderFilter, setWorkOrderFilter] = useState("All");
  const [jobFilter, setJobFilter] = useState("All");
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState(null);
  const [selectedProposalId, setSelectedProposalId] = useState(null);
  const [reviewForm, setReviewForm] = useState({ reviewedPrice: "", amsNotes: "" });
  const [vendorProposalDrafts, setVendorProposalDrafts] = useState({});

  const updateAppState = (updater) => {
    setAppState((current) => normalizeStateData(updater(current)));
  };

  useEffect(() => {
    saveAppState(normalizeStateData(appState));
  }, [appState]);

  useEffect(() => {
    if (!appState.ui.currentUserId) return;

    const savedUser = appState.users.find((user) => user.id === appState.ui.currentUserId);
    if (!savedUser) return;

    setAppState((current) =>
      normalizeStateData({
        ...current,
        ui: {
          ...current.ui,
          activeScreenByRole: {
            ...current.ui.activeScreenByRole,
            [savedUser.role]: "dashboard",
          },
        },
      })
    );
  }, []);

  const [siteForm, setSiteForm] = useState({
    name: "",
    address: "",
    state: "",
    internalNotes: "",
  });
  const [vendorForm, setVendorForm] = useState({
    name: "",
    serviceType: "",
    serviceTypes: "",
    states: "",
  });
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
  });
  const [jobAssignment, setJobAssignment] = useState({});
  const [editingSiteId, setEditingSiteId] = useState(null);
  const [editingVendorId, setEditingVendorId] = useState(null);
  const [editingUserId, setEditingUserId] = useState(null);

  const currentUser = findCurrentUser(appState);
  const activeScreen = getActiveScreen(appState, currentUser);
  const normalizedVendors = appState.vendors;
  const selectedSite =
    appState.sites.find((site) => site.id === appState.ui.selectedSiteId) || appState.sites[0] || null;
  const selectedSiteRelatedWorkOrders = selectedSite
    ? appState.workOrders.filter((workOrder) => workOrder.siteId === selectedSite.id).length
    : 0;
  const currentVendorRecord = findVendorForUser(normalizedVendors, currentUser);

  const openScreen = (screen) => {
    if (!currentUser || screen === "logout") return;

    updateAppState((current) => ({
      ...current,
      ui: {
        ...current.ui,
        activeScreenByRole: {
          ...current.ui.activeScreenByRole,
          [currentUser.role]: screen,
        },
      },
    }));
    setDrawerOpen(false);
    setProfileMenuOpen(false);
  };

  const setSelectedSite = (siteId) => {
    updateAppState((current) => ({
      ...current,
      ui: {
        ...current.ui,
        selectedSiteId: siteId,
      },
    }));
  };

  const handleLogin = (email, password) => {
    const match = appState.users.find(
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
          ...current.ui.activeScreenByRole,
          [match.role]: "dashboard",
        },
      },
    }));
    setLoginForm({ email: "", password: "" });
  };

  const handleDemoLogin = (type) => {
    if (type === "ams") {
      handleLogin("admin@amsdemo.local", "Admin123");
      return;
    }

    handleLogin("vendor@amsdemo.local", "Vendor123");
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
  };

  const startEditSite = (site) => {
    setSiteForm({
      name: site.name,
      address: site.address,
      state: site.state || "",
      internalNotes: site.internalNotes,
    });
    setEditingSiteId(site.id);
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
      ui: {
        ...current.ui,
        selectedSiteId:
          current.ui.selectedSiteId === siteId
            ? current.sites.find((site) => site.id !== siteId)?.id || null
            : current.ui.selectedSiteId,
      },
    }));

    if (editingSiteId === siteId) {
      setEditingSiteId(null);
      setSiteForm({ name: "", address: "", state: "", internalNotes: "" });
    }
  };

  const saveVendor = () => {
    if (!vendorForm.name.trim() || !vendorForm.serviceType) {
      window.alert("Vendor name and primary service type are required.");
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
      window.alert("Selected vendor was not found.");
      return;
    }

    const createdAt = new Date().toISOString();
    const proposalRequired = workOrderForm.workflowType === "proposal";
    const record = {
      id: createId("wo"),
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
      createdAt,
    };

    const createdJob = directVendor
      ? buildJobRecord({
          workOrder: record,
          vendor: directVendor,
          price: "",
        })
      : null;

    updateAppState((current) => ({
      ...current,
      workOrders: [
        {
          ...record,
          jobId: createdJob?.id || "",
        },
        ...current.workOrders,
      ],
      jobs: createdJob ? [createdJob, ...current.jobs] : current.jobs,
    }));

    setWorkOrderForm({
      siteId: "",
      description: "",
      serviceType: "",
      workflowType: "direct",
      directVendorId: "",
    });
  };

  const assignVendorToWorkOrder = (workOrderId) => {
    const vendorId = jobAssignment[workOrderId];
    if (!vendorId) {
      window.alert("Choose a vendor before assigning a job.");
      return;
    }

    const workOrder = appState.workOrders.find((entry) => entry.id === workOrderId);
    const vendor = normalizedVendors.find((entry) => entry.id === vendorId);
    if (!workOrder || !vendor) return;

    if (workOrder.proposalRequired) {
      window.alert("Proposal-based work orders must be awarded through the proposal review workflow.");
      return;
    }

    const existingJob = appState.jobs.find((job) => job.workOrderId === workOrderId);
    if (existingJob) {
      window.alert("A job has already been created for this work order.");
      return;
    }

    const newJob = buildJobRecord({
      workOrder,
      vendor,
      price: "",
    });

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
      jobs: current.jobs.map((job) => (job.id === jobId ? { ...job, status } : job)),
    }));
  };

  const openWorkOrders = appState.workOrders.filter((entry) => entry.status === "Open");
  const proposalOpportunities = appState.workOrders.filter(
    (entry) => entry.proposalRequired && entry.proposalState === "opportunity"
  );
  const proposalsAwaitingDecision = appState.proposals.filter(
    (proposal) => proposal.isActivePath && proposal.status === "submitted"
  );

  const visibleVendorJobs =
    currentUser && currentVendorRecord
      ? appState.jobs.filter((job) => job.vendorId === currentVendorRecord.id)
      : [];

  const vendorSites =
    currentUser && currentVendorRecord
      ? appState.sites.filter((site) =>
          visibleVendorJobs.some((job) => job.siteId === site.id)
        )
      : [];

  const availableVendorWork =
    currentUser && currentUser.role === ROLES.VENDOR && currentVendorRecord
      ? appState.workOrders.filter((workOrder) => {
          const site = appState.sites.find((entry) => entry.id === workOrder.siteId);
          return canVendorSubmitProposal({
            workOrder,
            site,
            vendor: currentVendorRecord,
            proposals: appState.proposals,
            jobs: appState.jobs,
          });
        })
      : [];

  const filteredWorkOrders = appState.workOrders.filter((workOrder) =>
    getWorkOrderFilterMatch(workOrder, workOrderFilter)
  );
  const filteredJobs = appState.jobs.filter((job) => getJobFilterMatch(job, jobFilter));
  const selectedWorkOrder =
    appState.workOrders.find((workOrder) => workOrder.id === selectedWorkOrderId) ||
    filteredWorkOrders[0] ||
    appState.workOrders[0] ||
    null;
  const selectedWorkOrderProposals = selectedWorkOrder
    ? sortByNewest(
        appState.proposals.filter((proposal) => proposal.workOrderId === selectedWorkOrder.id),
        "submittedAt"
      )
    : [];
  const selectedProposal =
    selectedWorkOrderProposals.find((proposal) => proposal.id === selectedProposalId) ||
    selectedWorkOrderProposals[0] ||
    null;

  useEffect(() => {
    if (!selectedWorkOrder && selectedWorkOrderId) {
      setSelectedWorkOrderId(null);
    }
    if (!selectedWorkOrderId && filteredWorkOrders[0]?.id) {
      setSelectedWorkOrderId(filteredWorkOrders[0].id);
    }
  }, [filteredWorkOrders, selectedWorkOrder, selectedWorkOrderId]);

  useEffect(() => {
    if (!selectedProposal && selectedProposalId) {
      setSelectedProposalId(null);
    }
    if (!selectedProposalId && selectedWorkOrderProposals[0]?.id) {
      setSelectedProposalId(selectedWorkOrderProposals[0].id);
    }
  }, [selectedProposal, selectedProposalId, selectedWorkOrderProposals]);

  useEffect(() => {
    if (!selectedProposal) {
      setReviewForm({ reviewedPrice: "", amsNotes: "" });
      return;
    }

    setReviewForm({
      reviewedPrice: selectedProposal.reviewedPrice || selectedProposal.submittedPrice || "",
      amsNotes: selectedProposal.amsNotes || "",
    });
  }, [selectedProposalId, selectedProposal]);

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

    const competingApprovedProposal = appState.proposals.find(
      (proposal) =>
        proposal.workOrderId === selectedWorkOrder.id &&
        proposal.status === "approved" &&
        proposal.id !== selectedProposal.id
    );

    if (competingApprovedProposal) {
      window.alert("This work order already has an approved proposal.");
      return;
    }

    const vendor = normalizedVendors.find((entry) => entry.id === selectedProposal.vendorId);
    if (!vendor) {
      window.alert("The proposal vendor could not be found.");
      return;
    }

    const existingJob = appState.jobs.find((job) => job.workOrderId === selectedWorkOrder.id);
    if (existingJob) {
      window.alert("A job already exists for this work order.");
      return;
    }

    const approvedAt = new Date().toISOString();
    const approvedPrice =
      reviewForm.reviewedPrice || selectedProposal.reviewedPrice || selectedProposal.submittedPrice;
    const newJob = buildJobRecord({
      workOrder: selectedWorkOrder,
      vendor,
      price: approvedPrice,
    });

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
            status: "rejected",
            rejectedAt: proposal.rejectedAt || approvedAt,
            isActivePath: false,
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

  const handleVendorProposalSubmit = (workOrder) => {
    if (!currentVendorRecord) return;

    const site = appState.sites.find((entry) => entry.id === workOrder.siteId);
    if (
      !canVendorSubmitProposal({
        workOrder,
        site,
        vendor: currentVendorRecord,
        proposals: appState.proposals,
        jobs: appState.jobs,
      })
    ) {
      window.alert("This proposal opportunity is not available for submission.");
      return;
    }

    const draft = vendorProposalDrafts[workOrder.id] || {};
    if (!String(draft.submittedPrice || "").trim()) {
      window.alert("Proposal price is required.");
      return;
    }

    const latestProposal = getLatestVendorProposal(
      appState.proposals,
      workOrder.id,
      currentVendorRecord.id
    );
    const submittedAt = new Date().toISOString();
    const newProposal = {
      id: createId("proposal"),
      workOrderId: workOrder.id,
      vendorId: currentVendorRecord.id,
      vendorCompanyName: currentVendorRecord.name,
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
      [workOrder.id]: {
        submittedPrice: "",
        submittedNotes: "",
      },
    }));
  };

  const vendorProposalHistory =
    currentVendorRecord && currentUser?.role === ROLES.VENDOR
      ? sortByNewest(
          appState.proposals.filter((proposal) => proposal.vendorId === currentVendorRecord.id),
          "submittedAt"
        )
      : [];

  const topActions = [
    { key: "workOrders", label: "Work Orders", onClick: () => openScreen("workOrders") },
    { key: "createWorkOrder", label: "Create Work Order", onClick: () => openScreen("workOrders") },
    { key: "jobs", label: "Jobs", onClick: () => openScreen("jobs") },
    { key: "sites", label: "Sites", onClick: () => openScreen("sites") },
    { key: "vendors", label: "Vendors", onClick: () => openScreen("vendors") },
  ];

  const ownerDashboard = (
    <div className="screen-grid">
      <PageSection title="Owner Overview">
        <StatGrid
          items={[
            { label: "Total Users", value: appState.users.length },
            { label: "Total Sites", value: appState.sites.length },
            { label: "Total Vendors", value: appState.vendors.length },
            { label: "User Management", value: "Enabled" },
          ]}
        />
      </PageSection>
      <PageSection
        title="Owner Access"
        action={
          <button className="secondary-button" onClick={() => openScreen("users")}>
            Open User Management
          </button>
        }
      >
        <p className="supporting-copy">
          Full visibility is active for the additive 0.3 build. Proposal workflow review is
          available through the work order screen without changing the existing command layout.
        </p>
      </PageSection>
    </div>
  );

  const amsDashboard = (
    <div className="screen-grid">
      {(currentUser.role === ROLES.AMS_ADMIN || currentUser.role === ROLES.AMS_MANAGER) && (
        <div
          style={{
            color: "var(--ams-orange, #f97316)",
            fontWeight: 700,
            textAlign: "center",
            marginBottom: "1rem",
          }}
        >
          TEST BUILD SUCCESS
        </div>
      )}
      <TopActionBar actions={topActions} />
      <div className="ams-dashboard-grid">
        <PageSection title="Operations Snapshot">
          <StatGrid
            items={[
              { label: "Total Sites", value: appState.sites.length },
              { label: "Total Vendors", value: appState.vendors.length },
              { label: "Open Work Orders", value: openWorkOrders.length },
              { label: "Proposal Opportunities", value: proposalOpportunities.length },
              { label: "Active Jobs", value: appState.jobs.filter((entry) => entry.status !== "Completed").length },
              { label: "Proposals Awaiting Review", value: proposalsAwaitingDecision.length },
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
            relatedWorkOrderCount={selectedSiteRelatedWorkOrders}
          />
        </PageSection>
      </div>
    </div>
  );

  const vendorJobsSection = (
    <PageSection title="My Jobs">
      {visibleVendorJobs.length ? (
        <div className="job-card-grid">
          {visibleVendorJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onStart={(jobId) => updateJobStatus(jobId, "In Progress")}
              onComplete={(jobId) => updateJobStatus(jobId, "Completed")}
              onHelp={(jobId) => updateJobStatus(jobId, "Need Help")}
            />
          ))}
        </div>
      ) : (
        <EmptyState title="No jobs assigned" text="Assigned jobs will appear here." />
      )}
    </PageSection>
  );

  const vendorSitesSection = (
    <PageSection title="My Sites">
      {vendorSites.length ? (
        <div className="site-card-grid">
          {vendorSites.map((site) => (
            <article key={site.id} className="simple-card vendor-site-card">
              <strong>{site.name}</strong>
              <p>{site.address}</p>
              <span className="site-state-tag">{site.state}</span>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="No sites available" text="Assigned site information will appear here." />
      )}
    </PageSection>
  );

  const vendorAvailableWorkSection = (
    <PageSection title="Available Work">
      {availableVendorWork.length ? (
        <div className="available-work-grid">
          {availableVendorWork.map((workOrder) => {
            const site = appState.sites.find((entry) => entry.id === workOrder.siteId);
            const draft = vendorProposalDrafts[workOrder.id] || {
              submittedPrice: "",
              submittedNotes: "",
            };
            const latestProposal = currentVendorRecord
              ? getLatestVendorProposal(appState.proposals, workOrder.id, currentVendorRecord.id)
              : null;
            const actionLabel = latestProposal ? "Resubmit Proposal" : "Submit Proposal";

            return (
              <AvailableWorkCard key={workOrder.id} workOrder={workOrder} site={site}>
                <div className="proposal-card-meta">
                  <div className="proposal-card-badges">
                    <ProposalStateBadge value={workOrder.proposalState} />
                    {latestProposal ? <ProposalStatusBadge value={latestProposal.status} /> : null}
                  </div>
                  <div className="proposal-card-form">
                    <label className="field compact-field">
                      <span>Proposal Price</span>
                      <input
                        value={draft.submittedPrice}
                        onChange={(event) =>
                          updateVendorProposalDraft(workOrder.id, "submittedPrice", event.target.value)
                        }
                        placeholder="Enter price"
                      />
                    </label>
                    <label className="field compact-field">
                      <span>Proposal Notes</span>
                      <textarea
                        rows="3"
                        value={draft.submittedNotes}
                        onChange={(event) =>
                          updateVendorProposalDraft(workOrder.id, "submittedNotes", event.target.value)
                        }
                        placeholder="Add scope notes or vendor comments"
                      />
                    </label>
                  </div>
                  <div className="proposal-card-actions">
                    <button
                      className="primary-button"
                      disabled={
                        !canVendorSubmitProposal({
                          workOrder,
                          site,
                          vendor: currentVendorRecord,
                          proposals: appState.proposals,
                          jobs: appState.jobs,
                        })
                      }
                      onClick={() => handleVendorProposalSubmit(workOrder)}
                    >
                      {actionLabel}
                    </button>
                  </div>
                </div>
              </AvailableWorkCard>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No available work"
          text="New matching proposal opportunities will appear here."
        />
      )}
    </PageSection>
  );

  const vendorProposalStatusSection = (
    <PageSection title="Proposal Status">
      {vendorProposalHistory.length ? (
        <div className="proposal-history-grid">
          {vendorProposalHistory.map((proposal) => {
            const workOrder = appState.workOrders.find((entry) => entry.id === proposal.workOrderId);
            const site = workOrder
              ? appState.sites.find((entry) => entry.id === workOrder.siteId)
              : null;
            const canResubmit =
              currentVendorRecord &&
              workOrder &&
              canVendorSubmitProposal({
                workOrder,
                site,
                vendor: currentVendorRecord,
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
                    <span className="detail-label">Submitted Price</span>
                    <p>{formatMoney(proposal.submittedPrice)}</p>
                  </div>
                  <div>
                    <span className="detail-label">Reviewed Price</span>
                    <p>{formatMoney(proposal.reviewedPrice)}</p>
                  </div>
                  <div>
                    <span className="detail-label">Revision Count</span>
                    <p>{proposal.revisionCount}</p>
                  </div>
                  <div>
                    <span className="detail-label">Submitted At</span>
                    <p>{formatDate(proposal.submittedAt)}</p>
                  </div>
                </div>
                <div className="proposal-history-notes">
                  <div>
                    <span className="detail-label">Submitted Notes</span>
                    <p>{proposal.submittedNotes || "No submitted notes."}</p>
                  </div>
                  <div>
                    <span className="detail-label">AMS Notes</span>
                    <p>{proposal.amsNotes || "No AMS notes yet."}</p>
                  </div>
                </div>
                <div className="proposal-history-meta">
                  <span>{proposal.requestedRevisionAt ? `Revision requested ${formatDate(proposal.requestedRevisionAt)}` : null}</span>
                  <span>{proposal.rejectedAt ? `Rejected ${formatDate(proposal.rejectedAt)}` : null}</span>
                  <span>{proposal.approvedAt ? `Approved ${formatDate(proposal.approvedAt)}` : null}</span>
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
        <EmptyState title="No proposals yet" text="Your submitted proposal history will appear here." />
      )}
    </PageSection>
  );

  const vendorDashboard = (
    <div className="screen-grid vendor-screen">
      {vendorAvailableWorkSection}
      {vendorProposalStatusSection}
      {vendorJobsSection}
      {vendorSitesSection}
    </div>
  );

  const usersScreen = (
    <div className="screen-grid">
      <PageSection title="User Management">
        <InputRow>
          <Field label="Name">
            <input
              value={userForm.name}
              onChange={(event) => setUserForm((current) => ({ ...current, name: event.target.value }))}
            />
          </Field>
          <Field label="Email">
            <input
              value={userForm.email}
              onChange={(event) => setUserForm((current) => ({ ...current, email: event.target.value }))}
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              value={userForm.password}
              onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))}
            />
          </Field>
          <Field label="Role">
            <select
              value={userForm.role}
              onChange={(event) => setUserForm((current) => ({ ...current, role: event.target.value }))}
            >
              {[ROLES.OWNER, ROLES.AMS_ADMIN, ROLES.AMS_MANAGER, ROLES.VENDOR, ROLES.OPERATOR].map(
                (role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                )
              )}
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
            { key: "role", label: "Role", render: (row) => row.role },
            { key: "active", label: "Status", render: (row) => (row.active ? "Active" : "Inactive") },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div className="table-actions">
                  <button className="secondary-button" onClick={() => startEditUser(row)}>
                    Edit
                  </button>
                  <button className="secondary-button" onClick={() => toggleUserActive(row.id)}>
                    {row.active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              ),
            },
          ]}
          rows={appState.users}
          emptyTitle="No users"
          emptyText="Users added here will persist locally."
        />
      </PageSection>
    </div>
  );

  const sitesScreen = (
    <div className="screen-grid">
      <PageSection title="Sites">
        <InputRow>
          <Field label="Site Name">
            <input
              value={siteForm.name}
              onChange={(event) => setSiteForm((current) => ({ ...current, name: event.target.value }))}
            />
          </Field>
          <Field label="Address">
            <input
              value={siteForm.address}
              onChange={(event) => setSiteForm((current) => ({ ...current, address: event.target.value }))}
            />
          </Field>
          <Field label="State">
            <input
              value={siteForm.state}
              maxLength={2}
              onChange={(event) =>
                setSiteForm((current) => ({ ...current, state: event.target.value.toUpperCase() }))
              }
            />
          </Field>
          <Field label="Internal Notes">
            <textarea
              rows="3"
              value={siteForm.internalNotes}
              onChange={(event) => setSiteForm((current) => ({ ...current, internalNotes: event.target.value }))}
            />
          </Field>
        </InputRow>
        <div className="form-actions">
          <button className="primary-button" onClick={saveSite}>
            {editingSiteId ? "Update Site" : "Add Site"}
          </button>
        </div>
      </PageSection>
      <PageSection title="Site List">
        <DataTable
          columns={[
            { key: "name", label: "Name", render: (row) => row.name },
            { key: "address", label: "Address", render: (row) => row.address },
            { key: "state", label: "State", render: (row) => row.state || "NA" },
            { key: "notes", label: "Internal Notes", render: (row) => row.internalNotes || "None" },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div className="table-actions">
                  <button className="secondary-button" onClick={() => startEditSite(row)}>
                    Edit
                  </button>
                  <button className="secondary-button" onClick={() => removeSite(row.id)}>
                    Remove
                  </button>
                </div>
              ),
            },
          ]}
          rows={appState.sites}
          emptyTitle="No sites"
          emptyText="Add a site to start routing work orders."
        />
      </PageSection>
    </div>
  );

  const vendorsScreen = (
    <div className="screen-grid">
      <PageSection title="Vendors">
        <InputRow>
          <Field label="Vendor Name">
            <input
              value={vendorForm.name}
              onChange={(event) => setVendorForm((current) => ({ ...current, name: event.target.value }))}
            />
          </Field>
          <Field label="Primary Service Type">
            <select
              value={vendorForm.serviceType}
              onChange={(event) => setVendorForm((current) => ({ ...current, serviceType: event.target.value }))}
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
              placeholder="Snow Removal, Landscaping"
              onChange={(event) =>
                setVendorForm((current) => ({ ...current, serviceTypes: event.target.value }))
              }
            />
          </Field>
          <Field label="States">
            <input
              value={vendorForm.states}
              placeholder="MA, RI"
              onChange={(event) =>
                setVendorForm((current) => ({ ...current, states: event.target.value.toUpperCase() }))
              }
            />
          </Field>
        </InputRow>
        <div className="form-actions">
          <button className="primary-button" onClick={saveVendor}>
            {editingVendorId ? "Update Vendor" : "Add Vendor"}
          </button>
        </div>
      </PageSection>
      <PageSection title="Vendor Directory">
        <DataTable
          columns={[
            { key: "name", label: "Name", render: (row) => row.name },
            { key: "serviceType", label: "Primary Service", render: (row) => row.serviceType },
            {
              key: "serviceTypes",
              label: "Service Types",
              render: (row) => normalizeVendor(row).serviceTypes.join(", "),
            },
            {
              key: "states",
              label: "States",
              render: (row) => normalizeVendor(row).states.join(", "),
            },
            { key: "active", label: "Status", render: (row) => (row.active ? "Active" : "Inactive") },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div className="table-actions">
                  <button className="secondary-button" onClick={() => startEditVendor(row)}>
                    Edit
                  </button>
                  <button className="secondary-button" onClick={() => toggleVendorActive(row.id)}>
                    {row.active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              ),
            },
          ]}
          rows={normalizedVendors}
          emptyTitle="No vendors"
          emptyText="Add a vendor before assigning jobs."
        />
      </PageSection>
    </div>
  );

  const workOrdersScreen = (
    <div className="screen-grid">
      <PageSection title="Create Work Order">
        <InputRow>
          <Field label="Site">
            <select
              value={workOrderForm.siteId}
              onChange={(event) => setWorkOrderForm((current) => ({ ...current, siteId: event.target.value }))}
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
              onChange={(event) => setWorkOrderForm((current) => ({ ...current, serviceType: event.target.value }))}
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
                  directVendorId: event.target.value === "proposal" ? "" : current.directVendorId,
                }))
              }
            >
              <option value="direct">Direct Assignment</option>
              <option value="proposal">Proposal Opportunity</option>
            </select>
          </Field>
          <Field label="Assign Vendor Now">
            <select
              value={workOrderForm.directVendorId}
              disabled={workOrderForm.workflowType !== "direct"}
              onChange={(event) =>
                setWorkOrderForm((current) => ({ ...current, directVendorId: event.target.value }))
              }
            >
              <option value="">Leave unassigned</option>
              {normalizedVendors
                .filter((vendor) => vendor.active)
                .map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Description">
            <textarea
              rows="3"
              value={workOrderForm.description}
              onChange={(event) => setWorkOrderForm((current) => ({ ...current, description: event.target.value }))}
            />
          </Field>
        </InputRow>
        <div className="form-actions">
          <button className="primary-button" onClick={createWorkOrder}>
            Create Work Order
          </button>
        </div>
      </PageSection>
      <PageSection
        title="Work Orders"
        action={
          <FilterRow
            label="Filter"
            value={workOrderFilter}
            options={WORK_ORDER_FILTERS}
            onChange={setWorkOrderFilter}
          />
        }
      >
        <DataTable
          columns={[
            {
              key: "reference",
              label: "Reference",
              render: (row) => (
                <button className="table-link-button" onClick={() => setSelectedWorkOrderId(row.id)}>
                  {row.id.toUpperCase()}
                </button>
              ),
            },
            { key: "siteName", label: "Site", render: (row) => row.siteName },
            { key: "description", label: "Description", render: (row) => row.description },
            { key: "serviceType", label: "Service Type", render: (row) => row.serviceType },
            {
              key: "proposalRequired",
              label: "Workflow",
              render: (row) =>
                row.proposalRequired ? (
                  <StatusBadge value="opportunity" label="Proposal" />
                ) : (
                  <StatusBadge value="assigned" label="Direct" />
                ),
            },
            {
              key: "proposalState",
              label: "Proposal State",
              render: (row) => <ProposalStateBadge value={row.proposalState} />,
            },
            {
              key: "proposalCount",
              label: "Proposal Count",
              render: (row) =>
                appState.proposals.filter((proposal) => proposal.workOrderId === row.id).length,
            },
            { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
            { key: "createdAt", label: "Created", render: (row) => formatDate(row.createdAt) },
            {
              key: "assign",
              label: "Assignment",
              render: (row) => {
                const relatedJob = appState.jobs.find((job) => job.workOrderId === row.id);

                if (row.proposalRequired) {
                  return <ProposalStateBadge value={row.proposalState} />;
                }

                return (
                  <div className="assignment-cell">
                    <select
                      value={jobAssignment[row.id] || row.assignedVendorId || ""}
                      disabled={Boolean(relatedJob)}
                      onChange={(event) =>
                        setJobAssignment((current) => ({ ...current, [row.id]: event.target.value }))
                      }
                    >
                      <option value="">Select vendor</option>
                      {normalizedVendors
                        .filter((vendor) => vendor.active)
                        .map((vendor) => (
                          <option key={vendor.id} value={vendor.id}>
                            {vendor.name}
                          </option>
                        ))}
                    </select>
                    <button
                      className="secondary-button"
                      disabled={Boolean(relatedJob)}
                      onClick={() => assignVendorToWorkOrder(row.id)}
                    >
                      {relatedJob ? "Job Created" : "Assign + Create Job"}
                    </button>
                  </div>
                );
              },
            },
            {
              key: "updateStatus",
              label: "Status Update",
              render: (row) => (
                <select value={row.status} onChange={(event) => updateWorkOrderStatus(row.id, event.target.value)}>
                  {WORK_ORDER_STATUS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              ),
            },
          ]}
          rows={filteredWorkOrders}
          emptyTitle="No work orders"
          emptyText="New work orders will appear here."
        />
      </PageSection>

      <PageSection title="Work Order Detail">
        {!selectedWorkOrder ? (
          <EmptyState title="No work order selected" text="Choose a work order to review proposal details." />
        ) : (
          <div className="proposal-review-layout">
            <div className="proposal-review-summary">
              <div className="proposal-summary-top">
                <div>
                  <strong>{selectedWorkOrder.siteName}</strong>
                  <p>{selectedWorkOrder.description}</p>
                </div>
                <div className="proposal-summary-badges">
                  <ProposalStateBadge value={selectedWorkOrder.proposalState} />
                  <StatusBadge value={selectedWorkOrder.status} />
                </div>
              </div>
              <div className="proposal-summary-grid">
                <div>
                  <span className="detail-label">Service Type</span>
                  <p>{selectedWorkOrder.serviceType}</p>
                </div>
                <div>
                  <span className="detail-label">Workflow</span>
                  <p>{selectedWorkOrder.proposalRequired ? "Proposal Opportunity" : "Direct Assignment"}</p>
                </div>
                <div>
                  <span className="detail-label">Proposal Requested</span>
                  <p>{formatDate(selectedWorkOrder.proposalRequestedAt)}</p>
                </div>
                <div>
                  <span className="detail-label">Proposal Awarded</span>
                  <p>{formatDate(selectedWorkOrder.proposalAwardedAt)}</p>
                </div>
                <div>
                  <span className="detail-label">Assigned Vendor</span>
                  <p>{selectedWorkOrder.assignedVendorName || "Not assigned"}</p>
                </div>
                <div>
                  <span className="detail-label">Job Link</span>
                  <p>{selectedWorkOrder.jobId || "No job created yet"}</p>
                </div>
              </div>
            </div>

            {selectedWorkOrder.proposalRequired ? (
              <>
                <div className="proposal-history-list">
                  <div className="subsection-title">Proposal Review List</div>
                  {selectedWorkOrderProposals.length ? (
                    <DataTable
                      columns={[
                        {
                          key: "vendor",
                          label: "Vendor Company",
                          render: (row) => (
                            <button
                              className="table-link-button"
                              onClick={() => setSelectedProposalId(row.id)}
                            >
                              {row.vendorCompanyName}
                            </button>
                          ),
                        },
                        {
                          key: "submittedPrice",
                          label: "Submitted Price",
                          render: (row) => formatMoney(row.submittedPrice),
                        },
                        {
                          key: "reviewedPrice",
                          label: "Reviewed Price",
                          render: (row) => formatMoney(row.reviewedPrice),
                        },
                        {
                          key: "submittedNotes",
                          label: "Submitted Notes",
                          render: (row) => row.submittedNotes || "None",
                        },
                        {
                          key: "amsNotes",
                          label: "AMS Notes",
                          render: (row) => row.amsNotes || "None",
                        },
                        {
                          key: "status",
                          label: "Status",
                          render: (row) => <ProposalStatusBadge value={row.status} />,
                        },
                        { key: "revisionCount", label: "Revision Count", render: (row) => row.revisionCount },
                        { key: "submittedAt", label: "Submitted At", render: (row) => formatDate(row.submittedAt) },
                        {
                          key: "lastReviewedAt",
                          label: "Last Reviewed",
                          render: (row) => formatDate(row.lastReviewedAt),
                        },
                      ]}
                      rows={selectedWorkOrderProposals}
                      emptyTitle="No proposals"
                      emptyText="Vendor proposals will appear here."
                    />
                  ) : (
                    <EmptyState
                      title="No proposals submitted"
                      text="Eligible vendor proposals for this work order will appear here."
                    />
                  )}
                </div>

                <div className="proposal-decision-panel">
                  <div className="subsection-title">Proposal Decision Panel</div>
                  {!selectedProposal ? (
                    <EmptyState title="No proposal selected" text="Select a proposal to review." />
                  ) : (
                    <div className="proposal-decision-card">
                      <div className="proposal-decision-header">
                        <div>
                          <strong>{selectedProposal.vendorCompanyName}</strong>
                          <p>
                            Submitted {formatDate(selectedProposal.submittedAt)} • Revision{" "}
                            {selectedProposal.revisionCount}
                          </p>
                        </div>
                        <ProposalStatusBadge value={selectedProposal.status} />
                      </div>
                      <div className="proposal-summary-grid">
                        <div>
                          <span className="detail-label">Original Submitted Price</span>
                          <p>{formatMoney(selectedProposal.submittedPrice)}</p>
                        </div>
                        <div>
                          <span className="detail-label">Original Submitted Notes</span>
                          <p>{selectedProposal.submittedNotes || "No submitted notes."}</p>
                        </div>
                      </div>
                      <InputRow>
                        <Field label="Reviewed Price">
                          <input
                            value={reviewForm.reviewedPrice}
                            onChange={(event) =>
                              setReviewForm((current) => ({
                                ...current,
                                reviewedPrice: event.target.value,
                              }))
                            }
                          />
                        </Field>
                        <Field label="AMS Notes">
                          <textarea
                            rows="4"
                            value={reviewForm.amsNotes}
                            onChange={(event) =>
                              setReviewForm((current) => ({
                                ...current,
                                amsNotes: event.target.value,
                              }))
                            }
                          />
                        </Field>
                      </InputRow>
                      <div className="decision-actions">
                        <button className="secondary-button" onClick={handleEditProposal}>
                          Edit Proposal
                        </button>
                        <button className="secondary-button" onClick={handleRequestRevision}>
                          Request Revision
                        </button>
                        <button className="secondary-button danger-button" onClick={handleRejectProposal}>
                          Reject
                        </button>
                        <button className="primary-button" onClick={handleApproveProposal}>
                          Approve
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <EmptyState
                title="Direct Assignment Path"
                text="This work order is using the direct assignment workflow. Existing assignment behavior remains active."
              />
            )}
          </div>
        )}
      </PageSection>
    </div>
  );

  const jobsScreen = (
    <div className="screen-grid">
      <PageSection
        title="Jobs"
        action={
          <FilterRow
            label="Filter"
            value={jobFilter}
            options={JOB_FILTERS}
            onChange={setJobFilter}
          />
        }
      >
        <DataTable
          columns={[
            { key: "siteName", label: "Site", render: (row) => row.siteName },
            { key: "vendorName", label: "Vendor", render: (row) => row.vendorName || "Unassigned" },
            { key: "serviceType", label: "Service Type", render: (row) => row.serviceType },
            { key: "price", label: "Price", render: (row) => formatMoney(row.price) },
            {
              key: "status",
              label: "Status",
              render: (row) => (
                <select value={row.status} onChange={(event) => updateJobStatus(row.id, event.target.value)}>
                  {JOB_STATUS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              ),
            },
          ]}
          rows={filteredJobs}
          emptyTitle="No jobs"
          emptyText="Assign vendors from direct work orders or approve a proposal to create jobs."
        />
      </PageSection>
    </div>
  );

  const profileScreen = currentUser ? (
    <div className="screen-grid">
      <PageSection title="Profile">
        <div className="profile-summary">
          <div>
            <strong>{currentUser.name}</strong>
            <p>{currentUser.email}</p>
          </div>
          <div className="status-pill active">{currentUser.role}</div>
        </div>
      </PageSection>
    </div>
  ) : null;

  function renderScreen() {
    if (!currentUser) return null;

    if (currentUser.role === ROLES.OPERATOR) {
      return (
        <UnderConstruction
          title="Operator Portal"
          message="Operator workflow screens will be added in a later version."
        />
      );
    }

    if (UNDER_CONSTRUCTION_SCREENS.has(activeScreen)) {
      return (
        <UnderConstruction
          title={SCREEN_LABELS[activeScreen]}
          message={`${SCREEN_LABELS[activeScreen]} is reserved for a future additive release.`}
        />
      );
    }

    if (activeScreen === "profile") return profileScreen;
    if (activeScreen === "users") return usersScreen;
    if (activeScreen === "sites") return sitesScreen;
    if (activeScreen === "vendors") return vendorsScreen;
    if (activeScreen === "workOrders") return workOrdersScreen;
    if (activeScreen === "jobs") return jobsScreen;
    if (activeScreen === "availableWork") {
      return <div className="screen-grid vendor-screen">{vendorAvailableWorkSection}</div>;
    }
    if (activeScreen === "myProposals") {
      return <div className="screen-grid vendor-screen">{vendorProposalStatusSection}</div>;
    }
    if (activeScreen === "myJobs") return <div className="screen-grid vendor-screen">{vendorJobsSection}</div>;
    if (activeScreen === "mySites") return <div className="screen-grid vendor-screen">{vendorSitesSection}</div>;

    if (currentUser.role === ROLES.OWNER) return ownerDashboard;
    if (AMS_ROLES.includes(currentUser.role)) return amsDashboard;
    if (currentUser.role === ROLES.VENDOR) return vendorDashboard;

    return (
      <UnderConstruction
        title="Screen Unavailable"
        message="This screen is reserved for future development."
      />
    );
  }

  if (!currentUser) {
    return (
      <LoginScreen
        email={loginForm.email}
        password={loginForm.password}
        onChange={updateLoginField}
        onLogin={() => handleLogin(loginForm.email, loginForm.password)}
        onDemoLogin={handleDemoLogin}
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
          onOpenDrawer={() => setDrawerOpen(true)}
          onToggleProfileMenu={() => setProfileMenuOpen((open) => !open)}
          profileMenuOpen={profileMenuOpen}
          onNavigate={openScreen}
          onLogout={logout}
        />

        <main className="content-shell">
          <div className="screen-header">
            <div>
              <div className="eyebrow">Build 0.3</div>
              <h1>{SCREEN_LABELS[activeScreen] || "Dashboard"}</h1>
            </div>
          </div>
          {renderScreen()}
        </main>
      </div>
    </div>
  );
}

export default AppBuild03;
