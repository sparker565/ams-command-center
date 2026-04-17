// v1.1.6 stabilization pass
import React, { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "ams_v11_operational_build";

const ROLES = {
  ADMIN: "Admin",
  AMS_ADMIN: "AMS Admin",
  AMS_USER: "AMS User",
  VENDOR: "Vendor",
};

const STATUS_OPTIONS = [
  "Open",
  "Scheduled",
  "Dispatched",
  "Checked In",
  "In Progress",
  "Checked Out",
  "Completed",
];
const SITE_STATUS_OPTIONS = ["Active", "Inactive"];
const PRIORITY_OPTIONS = ["Low", "Normal", "High", "Critical"];
const SERVICE_TYPES = [
  "",
  "Snow Plow",
  "De Ice",
  "Snow Removal",
  "Landscaping",
  "Emergency",
  "Exterior Maintenance",
];
const STATE_OPTIONS = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
];

const seedState = () => {
  const now = new Date().toISOString();

  return {
    session: {
      currentUserId: null,
    },
    users: [
      {
        id: "user_admin_1",
        role: ROLES.ADMIN,
        email: "Sparker565@gmail.com",
        password: "Admin123",
        name: "Owner Admin",
        phone: "",
        lastLoginTimestamp: now,
        hasLoggedInBefore: true,
        accountStatus: "Active",
        portalState: {
          activeTab: "dashboard",
          profileOpen: false,
        },
        isPrimary: true,
      },
      {
        id: "user_ams_1",
        role: ROLES.AMS_USER,
        email: "amsdemo@ams.local",
        password: "Demo123",
        name: "Demo AMS User",
        phone: "",
        lastLoginTimestamp: "",
        hasLoggedInBefore: false,
        accountStatus: "Active",
        portalState: {
          activeTab: "dashboard",
          profileOpen: false,
        },
        isPrimary: false,
      },
      {
        id: "user_vendor_1",
        role: ROLES.VENDOR,
        email: "vendordemo@ams.local",
        password: "Demo123",
        name: "Demo Vendor User",
        phone: "",
        lastLoginTimestamp: "",
        hasLoggedInBefore: false,
        accountStatus: "Active",
        portalState: {
          activeTab: "dashboard",
          profileOpen: false,
        },
        isPrimary: false,
      },
    ],
    sites: [
      {
        id: "site_1",
        siteName: "AMS Office",
        address: "19B North Street",
        city: "Foxboro",
        state: "MA",
        zip: "02035",
        assignedVendorUserId: "user_vendor_1",
        status: "Active",
        priority: "",
      },
    ],
    alerts: [],
    workOrders: [],
    jobs: [],
    chats: [
      {
        id: "chat_1",
        type: "AMS Internal Chat",
        contextType: "user",
        contextId: "user_ams_1",
        contextLabel: "Demo AMS User",
        participants: ["user_admin_1", "user_ams_1"],
        createdAt: now,
        messages: [
          {
            id: "msg_1",
            senderId: "user_admin_1",
            text: "Internal chat ready for operational use.",
            createdAt: now,
          },
        ],
      },
      {
        id: "chat_2",
        type: "AMS ↔ Vendor Chat",
        contextType: "site",
        contextId: "site_1",
        contextLabel: "AMS Office",
        participants: ["user_admin_1", "user_ams_1", "user_vendor_1"],
        createdAt: now,
        messages: [],
      },
      {
        id: "chat_3",
        type: "IT Support",
        contextType: "user",
        contextId: "user_admin_1",
        contextLabel: "Owner Admin",
        participants: ["user_admin_1"],
        createdAt: now,
        messages: [],
      },
    ],
  };
};

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return seedState();

  try {
    const parsed = JSON.parse(raw);
    return parsed;
  } catch {
    return seedState();
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatDateTime(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

function buildId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

function getTabsForRole(role) {
  if (role === ROLES.ADMIN) {
    return [
      { key: "dashboard", label: "Dashboard" },
      { key: "users", label: "Users" },
      { key: "sites", label: "Sites" },
      { key: "workOrders", label: "Work Orders" },
      { key: "jobs", label: "Jobs" },
      { key: "chats", label: "Chats" },
      { key: "reports", label: "Reports" },
      { key: "about", label: "About" },
      { key: "profile", label: "Profile" },
    ];
  }

  if (role === ROLES.AMS_ADMIN) {
    return [
      { key: "dashboard", label: "Dashboard" },
      { key: "users", label: "Users" },
      { key: "sites", label: "Sites" },
      { key: "workOrders", label: "Work Orders" },
      { key: "jobs", label: "Jobs" },
      { key: "chats", label: "Chats" },
      { key: "vendors", label: "Vendors" },
      { key: "about", label: "About" },
      { key: "profile", label: "Profile" },
    ];
  }

  if (role === ROLES.AMS_USER) {
    return [
      { key: "dashboard", label: "Dashboard" },
      { key: "actionRequired", label: "Action Required" },
      { key: "dispatch", label: "Dispatch" },
      { key: "workOrders", label: "Work Orders" },
      { key: "jobs", label: "Jobs" },
      { key: "vendors", label: "Vendors" },
      { key: "sites", label: "Sites" },
      { key: "chats", label: "Chats" },
      { key: "about", label: "About" },
      { key: "profile", label: "Profile" },
    ];
  }

  return [
    { key: "dashboard", label: "Dashboard" },
    { key: "myJobs", label: "My Jobs" },
    { key: "checkIn", label: "Check In" },
    { key: "messages", label: "Messages" },
    { key: "sites", label: "Sites" },
    { key: "settings", label: "Settings" },
    { key: "about", label: "About" },
    { key: "profile", label: "Profile" },
  ];
}

function getQuickActions(role) {
  if (role === ROLES.ADMIN) {
    return [
      { key: "users", label: "Users" },
      { key: "sites", label: "Sites" },
      { key: "reports", label: "Reports" },
      { key: "workOrders", label: "Work Orders" },
    ];
  }

  if (role === ROLES.AMS_ADMIN || role === ROLES.AMS_USER) {
    return [
      { key: "actionRequired", label: "Action Required" },
      { key: "dispatch", label: "Dispatch" },
      { key: "workOrders", label: "Work Orders" },
      { key: "vendors", label: "Vendors" },
    ];
  }

  return [
    { key: "myJobs", label: "My Jobs" },
    { key: "checkIn", label: "Check In" },
    { key: "messages", label: "Messages" },
    { key: "sites", label: "Sites" },
  ];
}

function App() {
  const [appState, setAppState] = useState(loadState);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    saveState(appState);
  }, [appState]);

  useEffect(() => {
    const timer = setTimeout(() => setSplashDone(true), 900);
    return () => clearTimeout(timer);
  }, []);

  const currentUser = useMemo(
    () =>
      appState.users.find((u) => u.id === appState.session.currentUserId) ||
      null,
    [appState]
  );

  const adminUser = useMemo(
    () => appState.users.find((u) => u.role === ROLES.ADMIN),
    [appState]
  );

  const activeTab = currentUser?.portalState?.activeTab || "dashboard";

  const setCurrentUserPortalState = (updates) => {
    if (!currentUser) return;

    setAppState((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === currentUser.id
          ? {
              ...u,
              portalState: {
                ...u.portalState,
                ...updates,
              },
            }
          : u
      ),
    }));
  };

  const navigateTo = (tab) => {
    setCurrentUserPortalState({ activeTab: tab });
    setDrawerOpen(false);
    setProfileMenuOpen(false);
  };

  const handleLogin = (email, password) => {
    const matchedUser = appState.users.find(
      (u) =>
        u.email.toLowerCase() === email.toLowerCase().trim() &&
        u.password === password &&
        u.accountStatus === "Active"
    );

    if (!matchedUser) {
      alert("Invalid login");
      return;
    }

    const isFirstLogin = !matchedUser.hasLoggedInBefore;
    const now = new Date().toISOString();

    setAppState((prev) => {
      const updatedUsers = prev.users.map((u) =>
        u.id === matchedUser.id
          ? {
              ...u,
              lastLoginTimestamp: now,
              hasLoggedInBefore: true,
            }
          : u
      );

      const newAlerts = [...prev.alerts];

      if (isFirstLogin && matchedUser.role !== ROLES.ADMIN) {
        newAlerts.unshift({
          id: buildId("alert"),
          title: "New user signed in for the first time",
          message: `${matchedUser.name} • ${matchedUser.role} • ${matchedUser.email}`,
          timestamp: now,
          targetUserId: adminUser?.id || "user_admin_1",
          viewed: false,
          actionLabel: "View User",
          actionTarget: "users",
        });
      }

      return {
        ...prev,
        session: {
          currentUserId: matchedUser.id,
        },
        users: updatedUsers,
        alerts: newAlerts,
      };
    });

    setLoginForm({ email: "", password: "" });
  };

  const handleLogout = () => {
    setAppState((prev) => ({
      ...prev,
      session: {
        currentUserId: null,
      },
    }));
    setDrawerOpen(false);
    setProfileMenuOpen(false);
  };

  const createUser = (payload) => {
    const newUser = {
      id: buildId("user"),
      role: payload.role,
      email: payload.email,
      password: payload.password || "Demo123",
      name: payload.name,
      phone: payload.phone || "",
      lastLoginTimestamp: "",
      hasLoggedInBefore: false,
      accountStatus: "Active",
      portalState: {
        activeTab: "dashboard",
        profileOpen: false,
      },
      isPrimary: false,
    };

    setAppState((prev) => ({
      ...prev,
      users: [newUser, ...prev.users],
    }));
  };

  const updateUser = (userId, updates) => {
    setAppState((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === userId ? { ...u, ...updates } : u
      ),
    }));
  };

  const createSite = (payload) => {
    const newSite = {
      id: buildId("site"),
      siteName: payload.siteName,
      address: payload.address,
      city: payload.city,
      state: payload.state,
      zip: payload.zip,
      assignedVendorUserId: payload.assignedVendorUserId || "",
      status: payload.status || "Active",
      priority: payload.priority || "",
    };

    setAppState((prev) => ({
      ...prev,
      sites: [newSite, ...prev.sites],
    }));
  };

  const createWorkOrder = (payload) => {
    const now = new Date().toISOString();

    const newWorkOrder = {
      id: buildId("WO"),
      workOrderId: `WO-${String(
        prevCount(appState.workOrders.length + 1)
      ).padStart(4, "0")}`,
      siteId: payload.siteId,
      description: payload.description,
      serviceType: payload.serviceType || "",
      vendorUserId: payload.vendorUserId || "",
      linkedProposal: payload.linkedProposal || "",
      schedule: payload.schedule || "",
      priority: payload.priority || "",
      notes: payload.notes || "",
      requirements: payload.requirements || {
        photosRequired: false,
        operatorNameRequired: false,
        beforeAfterRequired: false,
      },
      status: "Open",
      createdAt: now,
      createdByUserId: currentUser.id,
    };

    setAppState((prev) => ({
      ...prev,
      workOrders: [newWorkOrder, ...prev.workOrders],
    }));
  };

  const createJobFromWorkOrder = (workOrderId) => {
    const wo = appState.workOrders.find((w) => w.id === workOrderId);
    if (!wo) return;

    const alreadyLinked = appState.jobs.some(
      (j) => j.workOrderId === workOrderId
    );
    if (alreadyLinked) {
      alert("Job already created for this work order");
      return;
    }

    const newJob = {
      id: buildId("job"),
      workOrderId,
      siteId: wo.siteId,
      vendorUserId: wo.vendorUserId || "",
      status: "Scheduled",
      checkInTime: "",
      checkOutTime: "",
      completedAt: "",
      notes: "",
      createdAt: new Date().toISOString(),
    };

    setAppState((prev) => ({
      ...prev,
      jobs: [newJob, ...prev.jobs],
    }));
  };

  const updateJob = (jobId, updates) => {
    setAppState((prev) => ({
      ...prev,
      jobs: prev.jobs.map((j) => (j.id === jobId ? { ...j, ...updates } : j)),
    }));
  };

  const sendChatMessage = (chatId, text) => {
    if (!text.trim()) return;

    const message = {
      id: buildId("msg"),
      senderId: currentUser.id,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };

    setAppState((prev) => ({
      ...prev,
      chats: prev.chats.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              messages: [...chat.messages, message],
            }
          : chat
      ),
    }));
  };

  const requestAmsHelpChat = () => {
    const existing = appState.chats.find(
      (chat) =>
        chat.type === "Request AMS Help" &&
        chat.contextType === "user" &&
        chat.contextId === currentUser.id
    );

    if (existing) {
      navigateTo(currentUser.role === ROLES.VENDOR ? "messages" : "chats");
      return;
    }

    const newChat = {
      id: buildId("chat"),
      type: "Request AMS Help",
      contextType: "user",
      contextId: currentUser.id,
      contextLabel: currentUser.name,
      participants: [currentUser.id, adminUser.id],
      createdAt: new Date().toISOString(),
      messages: [],
    };

    setAppState((prev) => ({
      ...prev,
      chats: [newChat, ...prev.chats],
    }));

    navigateTo(currentUser.role === ROLES.VENDOR ? "messages" : "chats");
  };

  const vendorAssignedSites = useMemo(() => {
    if (!currentUser || currentUser.role !== ROLES.VENDOR) return [];
    return appState.sites.filter(
      (site) => site.assignedVendorUserId === currentUser.id
    );
  }, [appState.sites, currentUser]);

  const visibleChats = useMemo(() => {
    if (!currentUser) return [];

    if (currentUser.role === ROLES.ADMIN) return appState.chats;

    if (
      currentUser.role === ROLES.AMS_ADMIN ||
      currentUser.role === ROLES.AMS_USER
    ) {
      return appState.chats.filter(
        (chat) =>
          chat.type === "AMS Internal Chat" ||
          chat.type === "AMS ↔ Vendor Chat" ||
          chat.type === "Request AMS Help"
      );
    }

    return appState.chats.filter(
      (chat) =>
        chat.type === "AMS ↔ Vendor Chat" ||
        chat.type === "Request AMS Help" ||
        chat.type === "Report Issue"
    );
  }, [appState.chats, currentUser]);

  const visibleWorkOrders = useMemo(() => {
    if (!currentUser) return [];

    if (currentUser.role === ROLES.VENDOR) {
      return appState.workOrders.filter((wo) => {
        const site = appState.sites.find((s) => s.id === wo.siteId);
        return (
          wo.vendorUserId === currentUser.id ||
          site?.assignedVendorUserId === currentUser.id
        );
      });
    }

    return appState.workOrders;
  }, [appState.workOrders, appState.sites, currentUser]);

  const visibleJobs = useMemo(() => {
    if (!currentUser) return [];

    if (currentUser.role === ROLES.VENDOR) {
      return appState.jobs.filter((job) => {
        const site = appState.sites.find((s) => s.id === job.siteId);
        return (
          job.vendorUserId === currentUser.id ||
          site?.assignedVendorUserId === currentUser.id
        );
      });
    }

    return appState.jobs;
  }, [appState.jobs, appState.sites, currentUser]);

  const unreadAdminAlerts = appState.alerts.filter(
    (alert) => alert.targetUserId === adminUser?.id && !alert.viewed
  ).length;

  if (!splashDone) {
    return (
      <>
        <Styles />
        <div className="splashScreen">
          <div className="splashLogoWrap">
            <div className="splashLogo">AMS</div>
            <div className="splashSub">Service Command Center</div>
          </div>
        </div>
      </>
    );
  }

  if (!currentUser) {
    return (
      <>
        <Styles />
        <LoginScreen
          loginForm={loginForm}
          setLoginForm={setLoginForm}
          onLogin={handleLogin}
        />
      </>
    );
  }

  const tabs = getTabsForRole(currentUser.role);
  const quickActions = getQuickActions(currentUser.role);

  return (
    <>
      <Styles />
      <div className="appShell">
        <aside className={`drawer ${drawerOpen ? "open" : ""}`}>
          <div className="drawerHeader">
            <div>
              <div className="brandSmall">AMS</div>
              <div className="drawerTitle">Service Command Center</div>
            </div>
            <button className="ghostBtn" onClick={() => setDrawerOpen(false)}>
              Close
            </button>
          </div>

          <div className="drawerSection">
            <div className="drawerUserCard">
              <div className="drawerUserName">{currentUser.name}</div>
              <div className="muted">{currentUser.role}</div>
              <div className="muted">{currentUser.email}</div>
            </div>
          </div>

          <nav className="drawerNav">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                className={`navBtn ${activeTab === tab.key ? "active" : ""}`}
                onClick={() => navigateTo(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="drawerFooter">
            <button className="dangerBtn fullWidth" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </aside>

        {drawerOpen && (
          <div className="overlay" onClick={() => setDrawerOpen(false)} />
        )}

        <div className="mainArea">
          <header className="topBar">
            <div className="topBarLeft">
              <button className="menuBtn" onClick={() => setDrawerOpen(true)}>
                ☰
              </button>
              <div>
                <div className="brandSmall">AMS</div>
                <div className="pageTitle">V1.1 Operational</div>
              </div>
            </div>

            <div className="topBarRight">
              {currentUser.role === ROLES.ADMIN && (
                <div className="alertBadge">
                  Alerts
                  {unreadAdminAlerts > 0 ? (
                    <span className="countPill">{unreadAdminAlerts}</span>
                  ) : null}
                </div>
              )}

              <div className="profileWrap">
                <button
                  className="profileBtn"
                  onClick={() => setProfileMenuOpen((v) => !v)}
                >
                  {currentUser.name}
                </button>

                {profileMenuOpen && (
                  <div className="profileMenu">
                    <div className="profileMenuName">{currentUser.name}</div>
                    <div className="muted">{currentUser.role}</div>
                    <div className="muted profileEmail">
                      {currentUser.email}
                    </div>

                    <button
                      className="navBtn"
                      onClick={() => navigateTo("profile")}
                    >
                      Settings
                    </button>
                    <button className="navBtn" onClick={handleLogout}>
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <div className="quickActions">
            {quickActions.map((action) => (
              <button
                key={action.key}
                className={`quickBtn ${
                  activeTab === action.key ? "active" : ""
                }`}
                onClick={() => navigateTo(action.key)}
              >
                {action.label}
              </button>
            ))}
          </div>

          <main className="contentArea">
            {renderPage({
              activeTab,
              appState,
              currentUser,
              adminUser,
              visibleChats,
              visibleWorkOrders,
              visibleJobs,
              vendorAssignedSites,
              createUser,
              updateUser,
              createSite,
              createWorkOrder,
              createJobFromWorkOrder,
              updateJob,
              sendChatMessage,
              requestAmsHelpChat,
              navigateTo,
            })}
          </main>
        </div>
      </div>
    </>
  );
}

function LoginScreen({ loginForm, setLoginForm, onLogin }) {
  return (
    <div className="loginShell">
      <div className="loginPanel">
        <div className="loginLogo">AMS</div>
        <div className="loginTitle">Service Command Center</div>
        <div className="loginSub">Operational build v1.1</div>

        <div className="inputGrid">
          <label className="inputLabel">
            Email
            <input
              className="textInput"
              type="email"
              value={loginForm.email}
              onChange={(e) =>
                setLoginForm((prev) => ({ ...prev, email: e.target.value }))
              }
              placeholder="Enter email"
            />
          </label>

          <label className="inputLabel">
            Password
            <input
              className="textInput"
              type="password"
              value={loginForm.password}
              onChange={(e) =>
                setLoginForm((prev) => ({ ...prev, password: e.target.value }))
              }
              placeholder="Enter password"
            />
          </label>
        </div>

        <button
          className="primaryBtn fullWidth"
          onClick={() => onLogin(loginForm.email, loginForm.password)}
        >
          Sign In
        </button>

        <div className="divider" />

        <div className="demoGroup">
          <button
            className="secondaryBtn fullWidth"
            onClick={() => onLogin("amsdemo@ams.local", "Demo123")}
          >
            AMS User Demo
          </button>
          <button
            className="secondaryBtn fullWidth"
            onClick={() => onLogin("vendordemo@ams.local", "Demo123")}
          >
            Vendor Demo
          </button>
        </div>

        <div className="muted centerText smallTop">
          Admin credentials are active but not displayed on this screen.
        </div>
      </div>
    </div>
  );
}

function renderPage(props) {
  const {
    activeTab,
    appState,
    currentUser,
    adminUser,
    visibleChats,
    visibleWorkOrders,
    visibleJobs,
    vendorAssignedSites,
    createUser,
    updateUser,
    createSite,
    createWorkOrder,
    createJobFromWorkOrder,
    updateJob,
    sendChatMessage,
    requestAmsHelpChat,
    navigateTo,
  } = props;

  switch (activeTab) {
    case "dashboard":
      return (
        <DashboardPage
          appState={appState}
          currentUser={currentUser}
          adminUser={adminUser}
          navigateTo={navigateTo}
          visibleJobs={visibleJobs}
          visibleWorkOrders={visibleWorkOrders}
          vendorAssignedSites={vendorAssignedSites}
        />
      );

    case "users":
      return (
        <UsersPage
          appState={appState}
          currentUser={currentUser}
          createUser={createUser}
          updateUser={updateUser}
        />
      );

    case "sites":
      return (
        <SitesPage
          appState={appState}
          currentUser={currentUser}
          vendorAssignedSites={vendorAssignedSites}
          createSite={createSite}
        />
      );

    case "workOrders":
      return (
        <WorkOrdersPage
          appState={appState}
          currentUser={currentUser}
          visibleWorkOrders={visibleWorkOrders}
          createWorkOrder={createWorkOrder}
          createJobFromWorkOrder={createJobFromWorkOrder}
        />
      );

    case "jobs":
    case "myJobs":
    case "checkIn":
    case "dispatch":
    case "actionRequired":
      return (
        <JobsPage
          appState={appState}
          currentUser={currentUser}
          visibleJobs={visibleJobs}
          updateJob={updateJob}
          activeTab={activeTab}
        />
      );

    case "vendors":
      return <VendorsPage appState={appState} />;

    case "chats":
    case "messages":
      return (
        <ChatsPage
          currentUser={currentUser}
          visibleChats={visibleChats}
          appState={appState}
          sendChatMessage={sendChatMessage}
          requestAmsHelpChat={requestAmsHelpChat}
        />
      );

    case "reports":
      return <ReportsPage />;

    case "about":
      return <AboutPage currentUser={currentUser} />;

    case "profile":
    case "settings":
      return <ProfilePage currentUser={currentUser} updateUser={updateUser} />;

    default:
      return (
        <DashboardPage
          appState={appState}
          currentUser={currentUser}
          adminUser={adminUser}
          navigateTo={navigateTo}
          visibleJobs={visibleJobs}
          visibleWorkOrders={visibleWorkOrders}
          vendorAssignedSites={vendorAssignedSites}
        />
      );
  }
}

function DashboardPage({
  appState,
  currentUser,
  adminUser,
  navigateTo,
  visibleJobs,
  visibleWorkOrders,
  vendorAssignedSites,
}) {
  const openWorkOrders = visibleWorkOrders.filter(
    (wo) => wo.status === "Open"
  ).length;
  const activeJobs = visibleJobs.filter(
    (job) => !["Completed"].includes(job.status)
  ).length;
  const unassignedWorkOrders =
    currentUser.role === ROLES.ADMIN ||
    currentUser.role === ROLES.AMS_ADMIN ||
    currentUser.role === ROLES.AMS_USER
      ? visibleWorkOrders.filter((wo) => !wo.vendorUserId).length
      : 0;

  const myAlerts =
    currentUser.role === ROLES.ADMIN
      ? appState.alerts.filter((a) => a.targetUserId === adminUser.id)
      : [];

  return (
    <div className="pageGrid">
      <section className="card">
        <div className="sectionTitle">Operational Dashboard</div>
        <div className="statsGrid">
          {(currentUser.role === ROLES.ADMIN ||
            currentUser.role === ROLES.AMS_ADMIN) && (
            <>
              <StatCard label="Total Users" value={appState.users.length} />
              <StatCard label="Total Sites" value={appState.sites.length} />
            </>
          )}
          {(currentUser.role === ROLES.AMS_USER ||
            currentUser.role === ROLES.ADMIN ||
            currentUser.role === ROLES.AMS_ADMIN) && (
            <>
              <StatCard label="Open Work Orders" value={openWorkOrders} />
              <StatCard label="Active Jobs" value={activeJobs} />
              <StatCard
                label="Unassigned Work Orders"
                value={unassignedWorkOrders}
              />
            </>
          )}
          {currentUser.role === ROLES.VENDOR && (
            <>
              <StatCard
                label="Assigned Sites"
                value={vendorAssignedSites.length}
              />
              <StatCard label="My Open Work Orders" value={openWorkOrders} />
              <StatCard label="My Active Jobs" value={activeJobs} />
            </>
          )}
        </div>
      </section>

      <section className="card">
        <div className="sectionTitle">Map View</div>
        <div className="emptyState">Map view coming soon</div>
      </section>

      {(currentUser.role === ROLES.ADMIN ||
        currentUser.role === ROLES.AMS_ADMIN ||
        currentUser.role === ROLES.AMS_USER) && (
        <section className="card">
          <div className="sectionTitle">Action Required</div>
          {visibleWorkOrders.filter((wo) => !wo.vendorUserId).length === 0 ? (
            <div className="emptyState">No action required</div>
          ) : (
            <div className="listStack">
              {visibleWorkOrders
                .filter((wo) => !wo.vendorUserId)
                .map((wo) => (
                  <div key={wo.id} className="listItem">
                    <div>
                      <strong>{wo.workOrderId}</strong>
                      <div className="muted">Unassigned vendor</div>
                    </div>
                    <button
                      className="secondaryBtn"
                      onClick={() => navigateTo("workOrders")}
                    >
                      Open
                    </button>
                  </div>
                ))}
            </div>
          )}
        </section>
      )}

      {currentUser.role === ROLES.ADMIN && (
        <section className="card">
          <div className="sectionTitle">Admin Alerts</div>
          {myAlerts.length === 0 ? (
            <div className="emptyState">No alerts</div>
          ) : (
            <div className="listStack">
              {myAlerts.map((alert) => (
                <div key={alert.id} className="listItem">
                  <div>
                    <strong>{alert.title}</strong>
                    <div className="muted">{alert.message}</div>
                    <div className="muted">
                      {formatDateTime(alert.timestamp)}
                    </div>
                  </div>
                  <button
                    className="secondaryBtn"
                    onClick={() => navigateTo(alert.actionTarget || "users")}
                  >
                    {alert.actionLabel || "View"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="card">
        <div className="sectionTitle">Media</div>
        <div className="emptyState">Coming soon</div>
      </section>
    </div>
  );
}

function UsersPage({ appState, currentUser, createUser, updateUser }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: ROLES.AMS_USER,
    password: "Demo123",
  });

  const canManageUsers =
    currentUser.role === ROLES.ADMIN || currentUser.role === ROLES.AMS_ADMIN;
  const visibleUsers =
    currentUser.role === ROLES.ADMIN || currentUser.role === ROLES.AMS_ADMIN
      ? appState.users
      : [currentUser];

  return (
    <div className="pageGrid">
      {canManageUsers && (
        <section className="card">
          <div className="sectionTitle">Create User</div>
          <div className="formGrid">
            <InputField
              label="Name"
              value={form.name}
              onChange={(value) => setForm((p) => ({ ...p, name: value }))}
            />
            <InputField
              label="Email"
              value={form.email}
              onChange={(value) => setForm((p) => ({ ...p, email: value }))}
            />
            <InputField
              label="Phone"
              value={form.phone}
              onChange={(value) => setForm((p) => ({ ...p, phone: value }))}
            />
            <SelectField
              label="Role"
              value={form.role}
              onChange={(value) => setForm((p) => ({ ...p, role: value }))}
              options={[ROLES.AMS_ADMIN, ROLES.AMS_USER, ROLES.VENDOR]}
            />
            <InputField
              label="Password"
              value={form.password}
              onChange={(value) => setForm((p) => ({ ...p, password: value }))}
            />
          </div>
          <button
            className="primaryBtn"
            onClick={() => {
              if (!form.name || !form.email) {
                alert("Name and email are required");
                return;
              }
              createUser(form);
              setForm({
                name: "",
                email: "",
                phone: "",
                role: ROLES.AMS_USER,
                password: "Demo123",
              });
            }}
          >
            Create User
          </button>
        </section>
      )}

      <section className="card">
        <div className="sectionTitle">Users</div>
        <div className="listStack">
          {visibleUsers.map((user) => (
            <div key={user.id} className="userCard">
              <div className="userCardTop">
                <div>
                  <strong>{user.name}</strong>
                  <div className="muted">{user.role}</div>
                  <div className="muted">{user.email}</div>
                </div>
                <div className="pillRow">
                  <span className="statusPill">{user.accountStatus}</span>
                  {user.isPrimary && (
                    <span className="statusPill primaryPill">Primary</span>
                  )}
                </div>
              </div>

              <div className="detailRow">
                <span>Last login</span>
                <span>{formatDateTime(user.lastLoginTimestamp)}</span>
              </div>
              <div className="detailRow">
                <span>First login done</span>
                <span>{user.hasLoggedInBefore ? "Yes" : "No"}</span>
              </div>

              {(currentUser.role === ROLES.ADMIN ||
                currentUser.role === ROLES.AMS_ADMIN) &&
                !user.isPrimary && (
                  <div className="inlineActions">
                    <button
                      className="secondaryBtn"
                      onClick={() =>
                        updateUser(user.id, {
                          accountStatus:
                            user.accountStatus === "Active"
                              ? "Disabled"
                              : "Active",
                        })
                      }
                    >
                      {user.accountStatus === "Active" ? "Disable" : "Activate"}
                    </button>
                  </div>
                )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SitesPage({ appState, currentUser, vendorAssignedSites, createSite }) {
  const [form, setForm] = useState({
    siteName: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    assignedVendorUserId: "",
    status: "Active",
    priority: "",
  });

  const canManageSites =
    currentUser.role === ROLES.ADMIN || currentUser.role === ROLES.AMS_ADMIN;
  const vendorUsers = appState.users.filter((u) => u.role === ROLES.VENDOR);

  const visibleSites =
    currentUser.role === ROLES.VENDOR ? vendorAssignedSites : appState.sites;

  return (
    <div className="pageGrid">
      {canManageSites && (
        <section className="card">
          <div className="sectionTitle">Create Site</div>
          <div className="formGrid">
            <InputField
              label="Site Name"
              value={form.siteName}
              onChange={(value) => setForm((p) => ({ ...p, siteName: value }))}
            />
            <InputField
              label="Address"
              value={form.address}
              onChange={(value) => setForm((p) => ({ ...p, address: value }))}
            />
            <InputField
              label="City"
              value={form.city}
              onChange={(value) => setForm((p) => ({ ...p, city: value }))}
            />
            <InputField
              label="State"
              value={form.state}
              onChange={(value) => setForm((p) => ({ ...p, state: value }))}
            />
            <InputField
              label="Zip"
              value={form.zip}
              onChange={(value) => setForm((p) => ({ ...p, zip: value }))}
            />
            <SelectField
              label="Assigned Vendor"
              value={form.assignedVendorUserId}
              onChange={(value) =>
                setForm((p) => ({ ...p, assignedVendorUserId: value }))
              }
              options={["", ...vendorUsers.map((v) => `${v.id}|${v.name}`)]}
              formatter={(item) => (item === "" ? "None" : item.split("|")[1])}
              rawValue={(item) => (item === "" ? "" : item.split("|")[0])}
            />
            <SelectField
              label="Status"
              value={form.status}
              onChange={(value) => setForm((p) => ({ ...p, status: value }))}
              options={SITE_STATUS_OPTIONS}
            />
            <SelectField
              label="Priority"
              value={form.priority}
              onChange={(value) => setForm((p) => ({ ...p, priority: value }))}
              options={["", ...PRIORITY_OPTIONS]}
            />
          </div>

          <button
            className="primaryBtn"
            onClick={() => {
              if (
                !form.siteName ||
                !form.address ||
                !form.city ||
                !form.state ||
                !form.zip
              ) {
                alert("Complete required site fields");
                return;
              }
              createSite(form);
              setForm({
                siteName: "",
                address: "",
                city: "",
                state: "",
                zip: "",
                assignedVendorUserId: "",
                status: "Active",
                priority: "",
              });
            }}
          >
            Create Site
          </button>
        </section>
      )}

      <section className="card">
        <div className="sectionTitle">
          {currentUser.role === ROLES.VENDOR ? "Assigned Sites" : "Sites"}
        </div>
        <div className="listStack">
          {visibleSites.map((site) => {
            const assignedVendor = appState.users.find(
              (u) => u.id === site.assignedVendorUserId
            );

            return (
              <div key={site.id} className="siteCard">
                <div className="siteHeader">
                  <div>
                    <strong>{site.siteName}</strong>
                    <div className="muted">{site.address}</div>
                    <div className="muted">
                      {site.city} {site.state} {site.zip}
                    </div>
                  </div>
                  <div className="pillRow">
                    <span className="statusPill">{site.status}</span>
                    {site.priority ? (
                      <span className="statusPill">{site.priority}</span>
                    ) : null}
                  </div>
                </div>

                <div className="detailRow">
                  <span>Assigned Vendor</span>
                  <span>{assignedVendor?.name || "Unassigned"}</span>
                </div>

                {currentUser.role === ROLES.VENDOR && (
                  <a
                    className="secondaryBtn linkBtn"
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      `${site.address}, ${site.city}, ${site.state} ${site.zip}`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in Google Maps
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function WorkOrdersPage({
  appState,
  currentUser,
  visibleWorkOrders,
  createWorkOrder,
  createJobFromWorkOrder,
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [form, setForm] = useState({
    siteId: appState.sites[0]?.id || "",
    description: "",
    serviceType: "",
    vendorUserId: "",
    linkedProposal: "",
    schedule: "",
    priority: "",
    notes: "",
    requirements: {
      photosRequired: false,
      operatorNameRequired: false,
      beforeAfterRequired: false,
    },
  });

  const sites =
    currentUser.role === ROLES.VENDOR
      ? appState.sites.filter((s) => s.assignedVendorUserId === currentUser.id)
      : appState.sites;

  const vendorUsers = appState.users.filter((u) => u.role === ROLES.VENDOR);

  return (
    <div className="pageGrid">
      {(currentUser.role === ROLES.ADMIN ||
        currentUser.role === ROLES.AMS_ADMIN ||
        currentUser.role === ROLES.AMS_USER) && (
        <section className="card">
          <div className="sectionTitle">Quick Create Work Order</div>
          <div className="formGrid">
            <SelectField
              label="Site"
              value={form.siteId}
              onChange={(value) => setForm((p) => ({ ...p, siteId: value }))}
              options={sites.map((s) => `${s.id}|${s.siteName}`)}
              formatter={(item) => item.split("|")[1]}
              rawValue={(item) => item.split("|")[0]}
            />
            <TextAreaField
              label="Work Description"
              value={form.description}
              onChange={(value) =>
                setForm((p) => ({ ...p, description: value }))
              }
            />
          </div>

          <div className="inlineActions">
            <button
              className="secondaryBtn"
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {showAdvanced ? "Hide Advanced Fields" : "Show Advanced Fields"}
            </button>

            <button
              className="primaryBtn"
              onClick={() => {
                if (!form.siteId || !form.description.trim()) {
                  alert("Site and work description are required");
                  return;
                }
                createWorkOrder(form);
                setForm({
                  siteId: appState.sites[0]?.id || "",
                  description: "",
                  serviceType: "",
                  vendorUserId: "",
                  linkedProposal: "",
                  schedule: "",
                  priority: "",
                  notes: "",
                  requirements: {
                    photosRequired: false,
                    operatorNameRequired: false,
                    beforeAfterRequired: false,
                  },
                });
                setShowAdvanced(false);
              }}
            >
              Create Work Order
            </button>
          </div>

          {showAdvanced && (
            <div className="advancedBox">
              <div className="formGrid">
                <SelectField
                  label="Service Type"
                  value={form.serviceType}
                  onChange={(value) =>
                    setForm((p) => ({ ...p, serviceType: value }))
                  }
                  options={SERVICE_TYPES}
                />
                <SelectField
                  label="Vendor"
                  value={form.vendorUserId}
                  onChange={(value) =>
                    setForm((p) => ({ ...p, vendorUserId: value }))
                  }
                  options={["", ...vendorUsers.map((v) => `${v.id}|${v.name}`)]}
                  formatter={(item) =>
                    item === "" ? "None" : item.split("|")[1]
                  }
                  rawValue={(item) => (item === "" ? "" : item.split("|")[0])}
                />
                <InputField
                  label="Schedule"
                  type="datetime-local"
                  value={form.schedule}
                  onChange={(value) =>
                    setForm((p) => ({ ...p, schedule: value }))
                  }
                />
                <SelectField
                  label="Priority"
                  value={form.priority}
                  onChange={(value) =>
                    setForm((p) => ({ ...p, priority: value }))
                  }
                  options={["", ...PRIORITY_OPTIONS]}
                />
                <InputField
                  label="Linked Proposal"
                  value={form.linkedProposal}
                  onChange={(value) =>
                    setForm((p) => ({ ...p, linkedProposal: value }))
                  }
                />
                <TextAreaField
                  label="Notes"
                  value={form.notes}
                  onChange={(value) => setForm((p) => ({ ...p, notes: value }))}
                />
              </div>

              <div className="checkboxRow">
                <label>
                  <input
                    type="checkbox"
                    checked={form.requirements.photosRequired}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        requirements: {
                          ...p.requirements,
                          photosRequired: e.target.checked,
                        },
                      }))
                    }
                  />{" "}
                  Photos required
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={form.requirements.operatorNameRequired}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        requirements: {
                          ...p.requirements,
                          operatorNameRequired: e.target.checked,
                        },
                      }))
                    }
                  />{" "}
                  Operator name required
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={form.requirements.beforeAfterRequired}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        requirements: {
                          ...p.requirements,
                          beforeAfterRequired: e.target.checked,
                        },
                      }))
                    }
                  />{" "}
                  Before and after required
                </label>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="card">
        <div className="sectionTitle">Work Orders</div>
        {visibleWorkOrders.length === 0 ? (
          <div className="emptyState">No work orders yet</div>
        ) : (
          <div className="listStack">
            {visibleWorkOrders.map((wo) => {
              const site = appState.sites.find((s) => s.id === wo.siteId);
              const vendor = appState.users.find(
                (u) => u.id === wo.vendorUserId
              );
              const linkedJob = appState.jobs.find(
                (j) => j.workOrderId === wo.id
              );

              return (
                <div key={wo.id} className="workOrderCard">
                  <div className="workOrderTop">
                    <div>
                      <strong>{wo.workOrderId}</strong>
                      <div className="muted">
                        {site?.siteName || "Unknown site"}
                      </div>
                    </div>
                    <div className="pillRow">
                      <span className="statusPill">{wo.status}</span>
                      <span
                        className={`statusPill ${
                          wo.vendorUserId ? "" : "warningPill"
                        }`}
                      >
                        {vendor?.name || "Unassigned"}
                      </span>
                    </div>
                  </div>

                  <div className="muted">{wo.description}</div>
                  <div className="detailRow">
                    <span>Created</span>
                    <span>{formatDateTime(wo.createdAt)}</span>
                  </div>
                  <div className="detailRow">
                    <span>Service Type</span>
                    <span>{wo.serviceType || "Not set"}</span>
                  </div>
                  <div className="detailRow">
                    <span>Schedule</span>
                    <span>{wo.schedule || "Not scheduled"}</span>
                  </div>
                  <div className="detailRow">
                    <span>Priority</span>
                    <span>{wo.priority || "Not set"}</span>
                  </div>

                  {(currentUser.role === ROLES.ADMIN ||
                    currentUser.role === ROLES.AMS_ADMIN ||
                    currentUser.role === ROLES.AMS_USER) && (
                    <div className="inlineActions">
                      <button
                        className="primaryBtn"
                        onClick={() => createJobFromWorkOrder(wo.id)}
                        disabled={!!linkedJob}
                      >
                        {linkedJob ? "Job Created" : "Create Job"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function JobsPage({
  appState,
  currentUser,
  visibleJobs,
  updateJob,
  activeTab,
}) {
  return (
    <div className="pageGrid">
      <section className="card">
        <div className="sectionTitle">
          {activeTab === "dispatch"
            ? "Dispatch"
            : activeTab === "actionRequired"
            ? "Action Required"
            : activeTab === "checkIn"
            ? "Check In"
            : currentUser.role === ROLES.VENDOR
            ? "My Jobs"
            : "Jobs"}
        </div>

        {visibleJobs.length === 0 ? (
          <div className="emptyState">No active jobs</div>
        ) : (
          <div className="listStack">
            {visibleJobs.map((job) => {
              const site = appState.sites.find((s) => s.id === job.siteId);
              const workOrder = appState.workOrders.find(
                (wo) => wo.id === job.workOrderId
              );

              return (
                <div key={job.id} className="jobCard">
                  <div className="workOrderTop">
                    <div>
                      <strong>
                        {workOrder?.workOrderId || "Linked work order"}
                      </strong>
                      <div className="muted">
                        {site?.siteName || "Unknown site"}
                      </div>
                    </div>
                    <span className="statusPill">{job.status}</span>
                  </div>

                  <div className="muted">
                    {workOrder?.description || "No description"}
                  </div>
                  <div className="detailRow">
                    <span>Check In</span>
                    <span>
                      {job.checkInTime
                        ? formatDateTime(job.checkInTime)
                        : "Not checked in"}
                    </span>
                  </div>
                  <div className="detailRow">
                    <span>Check Out</span>
                    <span>
                      {job.checkOutTime
                        ? formatDateTime(job.checkOutTime)
                        : "Not checked out"}
                    </span>
                  </div>

                  <div className="inlineActions wrap">
                    {job.status === "Scheduled" && (
                      <button
                        className="primaryBtn"
                        onClick={() =>
                          updateJob(job.id, {
                            status: "Checked In",
                            checkInTime: new Date().toISOString(),
                          })
                        }
                      >
                        Check In
                      </button>
                    )}

                    {job.status === "Checked In" && (
                      <button
                        className="primaryBtn"
                        onClick={() =>
                          updateJob(job.id, {
                            status: "In Progress",
                          })
                        }
                      >
                        Start Work
                      </button>
                    )}

                    {job.status === "In Progress" && (
                      <button
                        className="primaryBtn"
                        onClick={() =>
                          updateJob(job.id, {
                            status: "Checked Out",
                            checkOutTime: new Date().toISOString(),
                          })
                        }
                      >
                        Check Out
                      </button>
                    )}

                    {job.status === "Checked Out" && (
                      <button
                        className="primaryBtn"
                        onClick={() =>
                          updateJob(job.id, {
                            status: "Completed",
                            completedAt: new Date().toISOString(),
                          })
                        }
                      >
                        Complete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="card">
        <div className="sectionTitle">Uploads</div>
        <div className="emptyState">Coming soon</div>
      </section>
    </div>
  );
}

function VendorsPage({ appState }) {
  const vendors = appState.users.filter((u) => u.role === ROLES.VENDOR);

  return (
    <section className="card">
      <div className="sectionTitle">Vendors</div>
      {vendors.length === 0 ? (
        <div className="emptyState">No vendors</div>
      ) : (
        <div className="listStack">
          {vendors.map((vendor) => (
            <div key={vendor.id} className="userCard">
              <div className="userCardTop">
                <div>
                  <strong>{vendor.name}</strong>
                  <div className="muted">{vendor.email}</div>
                </div>
                <span className="statusPill">{vendor.accountStatus}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ChatsPage({
  currentUser,
  visibleChats,
  appState,
  sendChatMessage,
  requestAmsHelpChat,
}) {
  const [selectedChatId, setSelectedChatId] = useState(
    visibleChats[0]?.id || ""
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!selectedChatId && visibleChats[0]?.id) {
      setSelectedChatId(visibleChats[0].id);
    }
  }, [selectedChatId, visibleChats]);

  const selectedChat =
    visibleChats.find((c) => c.id === selectedChatId) || visibleChats[0];

  return (
    <div className="pageGrid chatGrid">
      <section className="card">
        <div className="sectionTitle">Chat Channels</div>

        <div className="inlineActions">
          <button className="secondaryBtn" onClick={requestAmsHelpChat}>
            Request AMS Help
          </button>
        </div>

        {visibleChats.length === 0 ? (
          <div className="emptyState">No chats available</div>
        ) : (
          <div className="listStack">
            {visibleChats.map((chat) => (
              <button
                key={chat.id}
                className={`chatSelectBtn ${
                  selectedChat?.id === chat.id ? "active" : ""
                }`}
                onClick={() => setSelectedChatId(chat.id)}
              >
                <div>
                  <strong>{chat.type}</strong>
                  <div className="muted">Context: {chat.contextLabel}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <div className="sectionTitle">Conversation</div>

        {!selectedChat ? (
          <div className="emptyState">Select a chat</div>
        ) : (
          <>
            <div className="chatContextHeader">
              <div>
                <strong>{selectedChat.type}</strong>
              </div>
              <div className="muted">
                Context: {selectedChat.contextType} •{" "}
                {selectedChat.contextLabel}
              </div>
            </div>

            <div className="chatMessages">
              {selectedChat.messages.length === 0 ? (
                <div className="emptyState">No messages yet</div>
              ) : (
                selectedChat.messages.map((msg) => {
                  const sender = appState.users.find(
                    (u) => u.id === msg.senderId
                  );
                  const mine = msg.senderId === currentUser.id;

                  return (
                    <div
                      key={msg.id}
                      className={`chatBubble ${mine ? "mine" : ""}`}
                    >
                      <div className="chatSender">
                        {sender?.name || "Unknown"}
                      </div>
                      <div>{msg.text}</div>
                      <div className="chatTime">
                        {formatDateTime(msg.createdAt)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="chatComposer">
              <input
                className="textInput"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type message"
              />
              <button
                className="primaryBtn"
                onClick={() => {
                  sendChatMessage(selectedChat.id, message);
                  setMessage("");
                }}
              >
                Send
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function ReportsPage() {
  return (
    <div className="pageGrid">
      <section className="card">
        <div className="sectionTitle">Reports</div>
        <div className="emptyState">
          No fake metrics. Real data will appear as the system is used.
        </div>
      </section>
    </div>
  );
}

function AboutPage({ currentUser }) {
  return (
    <div className="pageGrid">
      {currentUser.role === ROLES.VENDOR && (
        <section className="card">
          <div className="sectionTitle">About AMS</div>
          <div className="copyBlock">
            Advanced Maintenance Services operational portal for field execution
            and communication.
          </div>
        </section>
      )}

      {(currentUser.role === ROLES.AMS_USER ||
        currentUser.role === ROLES.AMS_ADMIN) && (
        <section className="card">
          <div className="sectionTitle">About Dev Team</div>
          <div className="copyBlock">
            AMS Service Command Center ownership and workflow direction by Shawn
            Parker.
          </div>
        </section>
      )}

      {currentUser.role === ROLES.ADMIN && (
        <>
          <section className="card">
            <div className="sectionTitle">About AMS</div>
            <div className="copyBlock">
              Advanced Maintenance Services operational system build for real
              workflows and real field use.
            </div>
          </section>
          <section className="card">
            <div className="sectionTitle">About Dev Team</div>
            <div className="copyBlock">
              AMS Service Command Center ownership and workflow direction by
              Shawn Parker.
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function ProfilePage({ currentUser, updateUser }) {
  const [name, setName] = useState(currentUser.name);
  const [phone, setPhone] = useState(currentUser.phone || "");

  return (
    <div className="pageGrid">
      <section className="card">
        <div className="sectionTitle">Profile</div>

        <div className="profilePhotoMock" onClick={() => alert("Coming soon")}>
          Profile Photo
        </div>

        <div className="formGrid">
          <InputField label="Name" value={name} onChange={setName} />
          <InputField label="Phone" value={phone} onChange={setPhone} />
          <InputField
            label="Email"
            value={currentUser.email}
            onChange={() => {}}
            disabled
          />
          <InputField
            label="Role"
            value={currentUser.role}
            onChange={() => {}}
            disabled
          />
        </div>

        <div className="lockedInfo">
          <div>Controlled by Admin</div>
          <div>Controlled by AMS</div>
        </div>

        <button
          className="primaryBtn"
          onClick={() => updateUser(currentUser.id, { name, phone })}
        >
          Save Profile
        </button>
      </section>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="statCard">
      <div className="statValue">{value}</div>
      <div className="muted">{label}</div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
}) {
  return (
    <label className="inputLabel">
      {label}
      <input
        className="textInput"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </label>
  );
}

function TextAreaField({ label, value, onChange }) {
  return (
    <label className="inputLabel fullSpan">
      {label}
      <textarea
        className="textArea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options, formatter, rawValue }) {
  return (
    <label className="inputLabel">
      {label}
      <select
        className="textInput"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((option) => {
          const renderedLabel = formatter
            ? formatter(option)
            : option || "None";
          const renderedValue = rawValue ? rawValue(option) : option;

          return (
            <option key={`${label}_${String(option)}`} value={renderedValue}>
              {renderedLabel}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function prevCount(num) {
  return num;
}

function Styles() {
  return (
    <style>{`
      * {
        box-sizing: border-box;
      }

      html, body, #root {
        margin: 0;
        min-height: 100%;
        background: #050505;
        color: #ffffff;
        font-family: Inter, Arial, sans-serif;
      }

      body {
        background:
          radial-gradient(circle at top right, rgba(255, 128, 0, 0.14), transparent 28%),
          radial-gradient(circle at bottom left, rgba(255, 128, 0, 0.08), transparent 25%),
          linear-gradient(180deg, #090909 0%, #000000 100%);
      }

      button, input, select, textarea {
        font: inherit;
      }

      .splashScreen, .loginShell {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }

      .splashLogoWrap {
        text-align: center;
      }

      .splashLogo, .loginLogo {
        font-size: 58px;
        font-weight: 900;
        letter-spacing: 8px;
        color: #ffffff;
        text-shadow: 0 0 18px rgba(255, 128, 0, 0.45);
      }

      .splashSub, .loginSub {
        color: #bdbdbd;
        margin-top: 10px;
      }

      .loginPanel {
        width: 100%;
        max-width: 460px;
        background: #050505;
        border: 1px solid rgba(255, 128, 0, 0.65);
        border-radius: 22px;
        padding: 28px;
        box-shadow: 0 0 34px rgba(255, 128, 0, 0.18);
      }

      .loginTitle {
        font-size: 26px;
        font-weight: 800;
        text-align: center;
        margin-top: 10px;
      }

      .inputGrid, .formGrid {
        display: grid;
        gap: 14px;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }

      .inputGrid {
        margin-top: 22px;
      }

      .formGrid {
        margin-top: 10px;
      }

      .inputLabel {
        display: flex;
        flex-direction: column;
        gap: 8px;
        color: #f2f2f2;
        font-size: 14px;
        font-weight: 600;
      }

      .textInput, .textArea {
        width: 100%;
        background: #111111;
        color: #ffffff;
        border: 1px solid #2a2a2a;
        border-radius: 12px;
        padding: 12px 14px;
        outline: none;
      }

      .textInput:focus, .textArea:focus {
        border-color: #ff7a00;
        box-shadow: 0 0 0 2px rgba(255, 122, 0, 0.15);
      }

      .textInput:disabled {
        opacity: 0.7;
      }

      .textArea {
        resize: vertical;
      }

      .fullSpan {
        grid-column: 1 / -1;
      }

      .divider {
        height: 1px;
        background: #1f1f1f;
        margin: 18px 0;
      }

      .appShell {
        min-height: 100vh;
        display: flex;
      }

      .drawer {
        position: fixed;
        inset: 0 auto 0 0;
        width: 290px;
        background: #080808;
        border-right: 1px solid #232323;
        transform: translateX(-100%);
        transition: transform 0.25s ease;
        z-index: 30;
        display: flex;
        flex-direction: column;
        padding: 18px;
      }

      .drawer.open {
        transform: translateX(0);
      }

      .overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.55);
        z-index: 20;
      }

      .drawerHeader, .topBar {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .drawerTitle, .pageTitle {
        font-size: 18px;
        font-weight: 800;
      }

      .brandSmall {
        color: #ff7a00;
        font-size: 12px;
        font-weight: 900;
        letter-spacing: 2px;
        text-transform: uppercase;
      }

      .drawerSection {
        margin-top: 20px;
      }

      .drawerUserCard, .card {
        background: #0b0b0b;
        border: 1px solid #1f1f1f;
        border-radius: 18px;
        padding: 18px;
      }

      .drawerUserName {
        font-size: 18px;
        font-weight: 800;
      }

      .drawerNav {
        margin-top: 18px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .drawerFooter {
        margin-top: auto;
      }

      .mainArea {
        width: 100%;
      }

      .topBar {
        position: sticky;
        top: 0;
        z-index: 10;
        background: rgba(5, 5, 5, 0.96);
        backdrop-filter: blur(8px);
        padding: 14px 16px;
        border-bottom: 1px solid #1a1a1a;
      }

      .topBarLeft, .topBarRight, .inlineActions, .pillRow, .detailRow, .siteHeader, .workOrderTop, .userCardTop {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }

      .quickActions {
        position: sticky;
        top: 74px;
        z-index: 9;
        background: #070707;
        border-bottom: 1px solid #171717;
        display: flex;
        gap: 10px;
        overflow-x: auto;
        padding: 12px 16px;
      }

      .contentArea {
        padding: 16px;
      }

      .pageGrid {
        display: grid;
        gap: 16px;
      }

      .chatGrid {
        grid-template-columns: 320px 1fr;
      }

      .sectionTitle {
        font-size: 18px;
        font-weight: 800;
        margin-bottom: 14px;
      }

      .statsGrid {
        display: grid;
        gap: 12px;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      }

      .statCard {
        background: #111111;
        border: 1px solid #222222;
        border-radius: 14px;
        padding: 16px;
      }

      .statValue {
        font-size: 28px;
        font-weight: 900;
        color: #ff8c1a;
      }

      .muted {
        color: #aaaaaa;
      }

      .centerText {
        text-align: center;
      }

      .smallTop {
        margin-top: 12px;
      }

      .emptyState {
        background: #111111;
        border: 1px dashed #2e2e2e;
        border-radius: 14px;
        padding: 24px;
        color: #a8a8a8;
        text-align: center;
      }

      .copyBlock {
        color: #dddddd;
        line-height: 1.5;
      }

      .listStack {
        display: grid;
        gap: 12px;
      }

      .listItem, .siteCard, .workOrderCard, .jobCard, .userCard {
        background: #111111;
        border: 1px solid #212121;
        border-radius: 14px;
        padding: 14px;
      }

      .detailRow {
        color: #cfcfcf;
        padding-top: 8px;
        font-size: 14px;
      }

      .menuBtn, .profileBtn, .navBtn, .ghostBtn, .chatSelectBtn {
        background: #141414;
        color: #ffffff;
        border: 1px solid #2a2a2a;
        border-radius: 12px;
        padding: 10px 14px;
        cursor: pointer;
      }

      .navBtn.active, .chatSelectBtn.active {
        border-color: #ff7a00;
        background: #221307;
      }

      .primaryBtn, .secondaryBtn, .dangerBtn, .quickBtn {
        border: none;
        border-radius: 12px;
        padding: 12px 16px;
        font-weight: 800;
        cursor: pointer;
      }

      .primaryBtn {
        background: #ff7a00;
        color: #111111;
      }

      .secondaryBtn {
        background: #1a1a1a;
        color: #ffffff;
        border: 1px solid #333333;
      }

      .dangerBtn {
        background: #9d2c2c;
        color: #ffffff;
      }

      .quickBtn {
        background: #1a1a1a;
        color: #ffffff;
        border: 1px solid #2f2f2f;
        white-space: nowrap;
      }

      .quickBtn.active {
        background: #ff7a00;
        color: #111111;
      }

      .fullWidth {
        width: 100%;
      }

      .linkBtn {
        display: inline-flex;
        text-decoration: none;
        align-items: center;
        justify-content: center;
      }

      .advancedBox {
        margin-top: 16px;
        background: #0f0f0f;
        border: 1px solid #222222;
        border-radius: 16px;
        padding: 16px;
      }

      .checkboxRow {
        margin-top: 14px;
        display: flex;
        flex-wrap: wrap;
        gap: 14px;
      }

      .checkboxRow label {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #dddddd;
      }

      .warningPill {
        background: #4a2803;
      }

      .statusPill, .countPill {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: #1d1d1d;
        border: 1px solid #343434;
        border-radius: 999px;
        padding: 6px 10px;
        color: #ffffff;
        font-size: 12px;
        font-weight: 800;
      }

      .primaryPill {
        background: #3b2306;
        border-color: #ff7a00;
      }

      .alertBadge {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        border: 1px solid #2b2b2b;
        border-radius: 12px;
        background: #101010;
      }

      .countPill {
        min-width: 24px;
        background: #ff7a00;
        color: #111111;
      }

      .profileWrap {
        position: relative;
      }

      .profileMenu {
        position: absolute;
        top: calc(100% + 8px);
        right: 0;
        width: 260px;
        background: #0f0f0f;
        border: 1px solid #242424;
        border-radius: 16px;
        padding: 14px;
        display: grid;
        gap: 10px;
        z-index: 12;
      }

      .profileMenuName {
        font-weight: 900;
      }

      .profileEmail {
        word-break: break-word;
      }

      .chatContextHeader {
        background: #111111;
        border: 1px solid #202020;
        border-radius: 14px;
        padding: 14px;
        margin-bottom: 12px;
      }

      .chatMessages {
        display: grid;
        gap: 10px;
        min-height: 280px;
        max-height: 52vh;
        overflow: auto;
        padding-right: 4px;
      }

      .chatBubble {
        background: #161616;
        border: 1px solid #262626;
        border-radius: 14px;
        padding: 12px;
        max-width: 85%;
      }

      .chatBubble.mine {
        margin-left: auto;
        background: #281505;
        border-color: #5c330e;
      }

      .chatSender {
        font-size: 12px;
        color: #ff9d3d;
        margin-bottom: 6px;
        font-weight: 800;
      }

      .chatTime {
        font-size: 11px;
        color: #9d9d9d;
        margin-top: 6px;
      }

      .chatComposer {
        display: flex;
        gap: 10px;
        margin-top: 14px;
      }

      .profilePhotoMock {
        width: 120px;
        height: 120px;
        border-radius: 18px;
        background: #141414;
        border: 1px dashed #444444;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        margin-bottom: 18px;
        cursor: pointer;
      }

      .lockedInfo {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin: 16px 0;
        color: #aaaaaa;
      }

      .wrap {
        flex-wrap: wrap;
      }

      @media (max-width: 880px) {
        .chatGrid {
          grid-template-columns: 1fr;
        }

        .quickActions {
          top: 72px;
        }
      }
    `}</style>
  );
}

export default App;
