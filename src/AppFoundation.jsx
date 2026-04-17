import React, { useEffect, useMemo, useState } from "react";
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
  return new Date(value).toLocaleString();
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
    states: vendor.states || [],
    serviceTypes: vendor.serviceTypes || (vendor.serviceType ? [vendor.serviceType] : []),
  };
}

function isWorkOrderClosed(status) {
  return status === "Completed";
}

function getWorkOrderFilterMatch(workOrder, filter) {
  if (filter === "All") return true;
  if (filter === "Open") return workOrder.status === "Open";
  if (filter === "Assigned") return ["Assigned", "In Progress"].includes(workOrder.status);
  if (filter === "Closed") return isWorkOrderClosed(workOrder.status);
  return true;
}

function getJobFilterMatch(job, filter) {
  if (filter === "All") return true;
  if (filter === "Pending") return job.status === "Assigned";
  return job.status === filter;
}

function AppFoundation() {
  const [appState, setAppState] = useState(loadAppState);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [workOrderFilter, setWorkOrderFilter] = useState("All");
  const [jobFilter, setJobFilter] = useState("All");

  useEffect(() => {
    if (!appState.ui.currentUserId) return;

    const savedUser = appState.users.find((u) => u.id === appState.ui.currentUserId);
    if (!savedUser) return;

    setAppState((current) => ({
      ...current,
      ui: {
        ...current.ui,
        activeScreenByRole: {
          ...current.ui.activeScreenByRole,
          [savedUser.role]: "dashboard",
        },
      },
    }));
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
  });
  const [jobAssignment, setJobAssignment] = useState({});
  const [editingSiteId, setEditingSiteId] = useState(null);
  const [editingVendorId, setEditingVendorId] = useState(null);
  const [editingUserId, setEditingUserId] = useState(null);

  useEffect(() => {
    saveAppState(appState);
  }, [appState]);

  const currentUser = findCurrentUser(appState);
  const activeScreen = getActiveScreen(appState, currentUser);
  const normalizedVendors = useMemo(
    () => appState.vendors.map(normalizeVendor),
    [appState.vendors]
  );
  const selectedSite =
    appState.sites.find((site) => site.id === appState.ui.selectedSiteId) ||
    appState.sites[0] ||
    null;
  const selectedSiteRelatedWorkOrders = selectedSite
    ? appState.workOrders.filter((workOrder) => workOrder.siteId === selectedSite.id).length
    : 0;

  const openScreen = (screen) => {
    if (!currentUser || screen === "logout") return;

    setAppState((current) => ({
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
    setAppState((current) => ({
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

    setAppState((current) => ({
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
    setAppState((current) => ({
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
      setAppState((current) => ({
        ...current,
        sites: current.sites.map((site) =>
          site.id === editingSiteId ? { ...site, ...siteForm } : site
        ),
      }));
    } else {
      setAppState((current) => ({
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
    setAppState((current) => ({
      ...current,
      sites: current.sites.filter((site) => site.id !== siteId),
      workOrders: current.workOrders.filter((workOrder) => workOrder.siteId !== siteId),
      jobs: current.jobs.filter((job) => job.siteId !== siteId),
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

    const vendorRecord = {
      name: vendorForm.name.trim(),
      serviceType: vendorForm.serviceType,
      serviceTypes: parsedServiceTypes.length
        ? parsedServiceTypes
        : [vendorForm.serviceType],
      states: parsedStates,
    };

    if (editingVendorId) {
      setAppState((current) => ({
        ...current,
        vendors: current.vendors.map((vendor) =>
          vendor.id === editingVendorId ? { ...vendor, ...vendorRecord } : vendor
        ),
      }));
    } else {
      setAppState((current) => ({
        ...current,
        vendors: [
          { id: createId("vendor"), active: true, ...vendorRecord },
          ...current.vendors,
        ],
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
    setAppState((current) => ({
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
      setAppState((current) => ({
        ...current,
        users: current.users.map((user) =>
          user.id === editingUserId ? { ...user, ...userForm } : user
        ),
      }));
    } else {
      setAppState((current) => ({
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
    setAppState((current) => ({
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

    const record = {
      id: createId("wo"),
      siteId: site.id,
      siteName: site.name,
      description: workOrderForm.description.trim(),
      serviceType: workOrderForm.serviceType || "General Maintenance",
      status: "Open",
      createdAt: new Date().toISOString(),
    };

    setAppState((current) => ({
      ...current,
      workOrders: [record, ...current.workOrders],
    }));

    setWorkOrderForm({ siteId: "", description: "", serviceType: "" });
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

    const existingJob = appState.jobs.find((job) => job.workOrderId === workOrderId);
    if (existingJob) {
      window.alert("A job has already been created for this work order.");
      return;
    }

    setAppState((current) => ({
      ...current,
      jobs: [
        {
          id: createId("job"),
          workOrderId: workOrder.id,
          siteId: workOrder.siteId,
          siteName: workOrder.siteName,
          vendorId: vendor.id,
          vendorName: vendor.name,
          serviceType: workOrder.serviceType,
          status: "Assigned",
        },
        ...current.jobs,
      ],
      workOrders: current.workOrders.map((entry) =>
        entry.id === workOrderId ? { ...entry, status: "Assigned" } : entry
      ),
    }));
  };

  const updateWorkOrderStatus = (workOrderId, status) => {
    setAppState((current) => ({
      ...current,
      workOrders: current.workOrders.map((workOrder) =>
        workOrder.id === workOrderId ? { ...workOrder, status } : workOrder
      ),
    }));
  };

  const updateJobStatus = (jobId, status) => {
    setAppState((current) => ({
      ...current,
      jobs: current.jobs.map((job) => (job.id === jobId ? { ...job, status } : job)),
    }));
  };

  const visibleVendorJobs = currentUser
    ? appState.jobs.filter((job) => job.vendorName === currentUser.name)
    : [];

  const vendorSites = currentUser
    ? appState.sites.filter((site) =>
        visibleVendorJobs.some((job) => job.siteId === site.id)
      )
    : [];
  const currentVendorRecord = currentUser
    ? normalizedVendors.find((vendor) => vendor.name === currentUser.name)
    : null;
  const availableVendorWork =
    currentUser && currentUser.role === ROLES.VENDOR
      ? appState.workOrders.filter((workOrder) => {
          if (workOrder.status !== "Open") return false;
          if (appState.jobs.some((job) => job.workOrderId === workOrder.id)) return false;
          if (!currentVendorRecord?.active) return false;

          const site = appState.sites.find((entry) => entry.id === workOrder.siteId);
          if (!site) return false;
          if (!currentVendorRecord.states.includes(site.state)) return false;
          if (!workOrder.serviceType) return true;

          return currentVendorRecord.serviceTypes.includes(workOrder.serviceType);
        })
      : [];

  const openWorkOrders = appState.workOrders.filter((entry) => entry.status !== "Completed");
  const activeJobs = appState.jobs.filter((entry) => entry.status !== "Completed");
  const filteredWorkOrders = appState.workOrders.filter((workOrder) =>
    getWorkOrderFilterMatch(workOrder, workOrderFilter)
  );
  const filteredJobs = appState.jobs.filter((job) =>
    getJobFilterMatch(job, jobFilter)
  );

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
          Full visibility is active for the foundation build. User management is
          available directly from this dashboard or the side drawer.
        </p>
      </PageSection>
    </div>
  );

  const amsDashboard = (
    <div className="screen-grid">
      <TopActionBar actions={topActions} />
      <div className="ams-dashboard-grid">
        <PageSection title="Operations Snapshot">
          <StatGrid
            items={[
              { label: "Total Sites", value: appState.sites.length },
              { label: "Total Vendors", value: appState.vendors.length },
              { label: "Open Work Orders", value: openWorkOrders.length },
              { label: "Active Jobs", value: activeJobs.length },
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
          {availableVendorWork.map((workOrder) => (
            <AvailableWorkCard
              key={workOrder.id}
              workOrder={workOrder}
              site={appState.sites.find((site) => site.id === workOrder.siteId)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No available work"
          text="New matching opportunities will appear here."
        />
      )}
    </PageSection>
  );

  const vendorDashboard = (
    <div className="screen-grid vendor-screen">
      {vendorJobsSection}
      {vendorAvailableWorkSection}
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
            { key: "siteName", label: "Site", render: (row) => row.siteName },
            { key: "description", label: "Description", render: (row) => row.description },
            { key: "serviceType", label: "Service Type", render: (row) => row.serviceType },
            { key: "status", label: "Status", render: (row) => row.status },
            { key: "createdAt", label: "Created", render: (row) => formatDate(row.createdAt) },
            {
              key: "assign",
              label: "Assignment",
              render: (row) => {
                const relatedJob = appState.jobs.find((job) => job.workOrderId === row.id);
                return (
                  <div className="assignment-cell">
                    <select
                      value={jobAssignment[row.id] || ""}
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
          emptyText="Assign vendors from work orders to create jobs."
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
              <div className="eyebrow">Foundation Build</div>
              <h1>{SCREEN_LABELS[activeScreen] || "Dashboard"}</h1>
            </div>
          </div>
          {renderScreen()}
        </main>
      </div>
    </div>
  );
}

export default AppFoundation;
