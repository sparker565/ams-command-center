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
        id: "user_ams_admin_1",
        role: ROLES.AMS_ADMIN,
        email: "amsadmin@ams.local",
        password: "Demo123",
        name: "Demo AMS Admin",
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
        serviceStates: ["MA", "RI", "CT"],
        primaryState: "MA",
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
        participants: ["user_admin_1", "user_ams_1", "user_ams_admin_1"],
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
        type: "AMS to Vendor Chat",
        contextType: "site",
        contextId: "site_1",
        contextLabel: "AMS Office",
        participants: [
          "user_admin_1",
          "user_ams_1",
          "user_ams_admin_1",
          "user_vendor_1",
        ],
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

function buildId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

function formatDateTime(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

function normalizeServiceStates(value) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
    ? value.split(",")
    : [];

  return Array.from(
    new Set(
      source
        .map((item) =>
          String(item || "")
            .trim()
            .toUpperCase()
        )
        .filter((item) => STATE_OPTIONS.includes(item))
    )
  );
}

function normalizeUser(user) {
  const base = {
    ...user,
    phone: user.phone || "",
    accountStatus: user.accountStatus || "Active",
    portalState: {
      activeTab: user.portalState?.activeTab || "dashboard",
      profileOpen: false,
    },
  };

  if (base.role !== ROLES.VENDOR) {
    return {
      ...base,
      serviceStates: [],
      primaryState: "",
    };
  }

  const serviceStates = normalizeServiceStates(
    base.serviceStates || base.states || base.state || []
  );
  const requestedPrimary = String(base.primaryState || "")
    .trim()
    .toUpperCase();

  return {
    ...base,
    serviceStates,
    primaryState: serviceStates.includes(requestedPrimary)
      ? requestedPrimary
      : "",
  };
}

function normalizeStateShape(raw) {
  const defaults = seedState();
  const source = raw && typeof raw === "object" ? raw : {};

  const usersById = new Map();
  [
    ...defaults.users,
    ...(Array.isArray(source.users) ? source.users : []),
  ].forEach((user) => {
    usersById.set(user.id, normalizeUser(user));
  });

  return {
    ...defaults,
    ...source,
    session: {
      currentUserId: source.session?.currentUserId || null,
    },
    users: Array.from(usersById.values()),
    sites:
      Array.isArray(source.sites) && source.sites.length
        ? source.sites
        : defaults.sites,
    alerts: Array.isArray(source.alerts) ? source.alerts : defaults.alerts,
    workOrders: Array.isArray(source.workOrders)
      ? source.workOrders
      : defaults.workOrders,
    jobs: Array.isArray(source.jobs) ? source.jobs : defaults.jobs,
    chats:
      Array.isArray(source.chats) && source.chats.length
        ? source.chats
        : defaults.chats,
  };
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return normalizeStateShape(seedState());

  try {
    return normalizeStateShape(JSON.parse(raw));
  } catch {
    return normalizeStateShape(seedState());
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function prevCount(num) {
  return num;
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

function getVendorOpportunities(appState, currentUser) {
  if (!currentUser || currentUser.role !== ROLES.VENDOR) return [];

  const allowedStates = currentUser.serviceStates || [];
  if (!allowedStates.length) return [];

  return appState.workOrders.filter((workOrder) => {
    if (workOrder.vendorUserId) return false;
    if (workOrder.status !== "Open") return false;

    const site = appState.sites.find((item) => item.id === workOrder.siteId);
    return (
      !!site?.state && allowedStates.includes(String(site.state).toUpperCase())
    );
  });
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
      appState.users.find(
        (user) => user.id === appState.session.currentUserId
      ) || null,
    [appState]
  );

  const adminUser = useMemo(
    () => appState.users.find((user) => user.role === ROLES.ADMIN) || null,
    [appState]
  );

  const activeTab = currentUser?.portalState?.activeTab || "dashboard";

  const setCurrentUserPortalState = (updates) => {
    if (!currentUser) return;

    setAppState((prev) => ({
      ...prev,
      users: prev.users.map((user) =>
        user.id === currentUser.id
          ? {
              ...user,
              portalState: {
                ...user.portalState,
                ...updates,
              },
            }
          : user
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
      (user) =>
        user.email.toLowerCase() === email.toLowerCase().trim() &&
        user.password === password &&
        user.accountStatus === "Active"
    );

    if (!matchedUser) {
      alert("Invalid login");
      return;
    }

    const isFirstLogin = !matchedUser.hasLoggedInBefore;
    const now = new Date().toISOString();

    setAppState((prev) => {
      const updatedUsers = prev.users.map((user) =>
        user.id === matchedUser.id
          ? {
              ...user,
              lastLoginTimestamp: now,
              hasLoggedInBefore: true,
            }
          : user
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
    const newUser = normalizeUser({
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
      serviceStates: payload.role === ROLES.VENDOR ? payload.serviceStates : [],
      primaryState: payload.role === ROLES.VENDOR ? payload.primaryState : "",
    });

    setAppState((prev) => ({
      ...prev,
      users: [newUser, ...prev.users],
    }));
  };

  const updateUser = (userId, updates) => {
    setAppState((prev) => ({
      ...prev,
      users: prev.users.map((user) =>
        user.id === userId ? normalizeUser({ ...user, ...updates }) : user
      ),
    }));
  };

  const createSite = (payload) => {
    const newSite = {
      id: buildId("site"),
      siteName: payload.siteName,
      address: payload.address,
      city: payload.city,
      state: String(payload.state || "")
        .trim()
        .toUpperCase(),
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
    const workOrder = appState.workOrders.find(
      (item) => item.id === workOrderId
    );
    if (!workOrder) return;

    const alreadyLinked = appState.jobs.some(
      (job) => job.workOrderId === workOrderId
    );
    if (alreadyLinked) {
      alert("Job already created for this work order");
      return;
    }

    const newJob = {
      id: buildId("job"),
      workOrderId,
      siteId: workOrder.siteId,
      vendorUserId: workOrder.vendorUserId || "",
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

  const claimOpportunity = (workOrderId) => {
    if (!currentUser || currentUser.role !== ROLES.VENDOR) return;

    const workOrder = appState.workOrders.find(
      (item) => item.id === workOrderId
    );
    if (!workOrder || workOrder.vendorUserId) return;

    const linkedJob = appState.jobs.find(
      (item) => item.workOrderId === workOrderId
    );
    const nextJob = linkedJob
      ? null
      : {
          id: buildId("job"),
          workOrderId,
          siteId: workOrder.siteId,
          vendorUserId: currentUser.id,
          status: "Scheduled",
          checkInTime: "",
          checkOutTime: "",
          completedAt: "",
          notes: "",
          createdAt: new Date().toISOString(),
        };

    setAppState((prev) => ({
      ...prev,
      workOrders: prev.workOrders.map((item) =>
        item.id === workOrderId
          ? { ...item, vendorUserId: currentUser.id }
          : item
      ),
      jobs: nextJob
        ? [{ ...nextJob }, ...prev.jobs]
        : prev.jobs.map((item) =>
            item.workOrderId === workOrderId
              ? { ...item, vendorUserId: currentUser.id }
              : item
          ),
    }));
  };

  const updateJob = (jobId, updates) => {
    setAppState((prev) => ({
      ...prev,
      jobs: prev.jobs.map((job) =>
        job.id === jobId ? { ...job, ...updates } : job
      ),
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
      participants: [currentUser.id, adminUser?.id || "user_admin_1"],
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

  const vendorOpportunities = useMemo(
    () => getVendorOpportunities(appState, currentUser),
    [appState, currentUser]
  );

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
          chat.type === "AMS to Vendor Chat" ||
          chat.type === "Request AMS Help"
      );
    }

    return appState.chats.filter(
      (chat) =>
        chat.type === "AMS to Vendor Chat" ||
        chat.type === "Request AMS Help" ||
        chat.type === "Report Issue"
    );
  }, [appState.chats, currentUser]);

  const visibleWorkOrders = useMemo(() => {
    if (!currentUser) return [];

    if (currentUser.role === ROLES.VENDOR) {
      return appState.workOrders.filter((workOrder) => {
        const site = appState.sites.find(
          (item) => item.id === workOrder.siteId
        );
        return (
          workOrder.vendorUserId === currentUser.id ||
          site?.assignedVendorUserId === currentUser.id
        );
      });
    }

    return appState.workOrders;
  }, [appState.workOrders, appState.sites, currentUser]);

  const visibleJobs = useMemo(() => {
    if (!currentUser) return [];

    if (currentUser.role === ROLES.VENDOR) {
      return appState.jobs.filter((job) => job.vendorUserId === currentUser.id);
    }

    return appState.jobs;
  }, [appState.jobs, currentUser]);

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
            <div className="topBarSide leftAlign">
              <button
                className="menuBtn compactIconBtn"
                onClick={() => setDrawerOpen(true)}
              >
                <span aria-hidden="true">☰</span>
              </button>
            </div>

            <div className="topBarCenter">
              <button
                className="headerLogo"
                onClick={() => navigateTo("dashboard")}
              >
                <span className="headerLogoMark">AMS</span>
              </button>
            </div>

            <div className="topBarSide rightAlign">
              <button
                className="iconCircle"
                onClick={() => {
                  if (currentUser.role === ROLES.ADMIN) navigateTo("users");
                }}
                title="Notifications"
              >
                <span aria-hidden="true">🔔</span>
                {currentUser.role === ROLES.ADMIN && unreadAdminAlerts > 0 ? (
                  <span className="iconBadge">{unreadAdminAlerts}</span>
                ) : null}
              </button>

              <div className="profileWrap">
                <button
                  className="iconCircle profileCircle"
                  onClick={() => setProfileMenuOpen((value) => !value)}
                  title="Profile"
                >
                  <span>{getInitials(currentUser.name)}</span>
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
              vendorOpportunities,
              createUser,
              updateUser,
              createSite,
              createWorkOrder,
              createJobFromWorkOrder,
              claimOpportunity,
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
        <div className="loginHeader">
          <div className="loginLogo">AMS</div>
          <div className="loginTitle">Service Command Center</div>
          <div className="loginSub">Sign in to continue</div>
        </div>

        <div className="inputGrid loginGrid">
          <label className="inputLabel">
            Email
            <input
              className="textInput"
              type="email"
              value={loginForm.email}
              onChange={(event) =>
                setLoginForm((prev) => ({ ...prev, email: event.target.value }))
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
              onChange={(event) =>
                setLoginForm((prev) => ({
                  ...prev,
                  password: event.target.value,
                }))
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
            onClick={() => onLogin("amsadmin@ams.local", "Demo123")}
          >
            AMS Admin Demo
          </button>
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
    vendorOpportunities,
    createUser,
    updateUser,
    createSite,
    createWorkOrder,
    createJobFromWorkOrder,
    claimOpportunity,
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
          vendorOpportunities={vendorOpportunities}
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
          vendorOpportunities={vendorOpportunities}
          claimOpportunity={claimOpportunity}
        />
      );

    case "vendors":
      return (
        <VendorsPage
          appState={appState}
          currentUser={currentUser}
          updateUser={updateUser}
        />
      );

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
          vendorOpportunities={vendorOpportunities}
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
  vendorOpportunities,
}) {
  const openWorkOrders = visibleWorkOrders.filter(
    (workOrder) => workOrder.status === "Open"
  ).length;
  const activeJobs = visibleJobs.filter(
    (job) => !["Completed"].includes(job.status)
  ).length;
  const unassignedWorkOrders =
    currentUser.role === ROLES.ADMIN ||
    currentUser.role === ROLES.AMS_ADMIN ||
    currentUser.role === ROLES.AMS_USER
      ? visibleWorkOrders.filter((workOrder) => !workOrder.vendorUserId).length
      : 0;

  const myAlerts =
    currentUser.role === ROLES.ADMIN
      ? appState.alerts.filter((alert) => alert.targetUserId === adminUser?.id)
      : [];

  return (
    <div className="pageGrid compactPageGrid">
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
                label="Open Opportunities"
                value={vendorOpportunities.length}
                onClick={() => navigateTo("myJobs")}
              />
              <StatCard
                label="Active Jobs"
                value={activeJobs}
                onClick={() => navigateTo("myJobs")}
              />
              <StatCard
                label="Assigned Sites"
                value={vendorAssignedSites.length}
              />
              <StatCard label="My Open Work Orders" value={openWorkOrders} />
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
          {visibleWorkOrders.filter((workOrder) => !workOrder.vendorUserId)
            .length === 0 ? (
            <div className="emptyState">No action required</div>
          ) : (
            <div className="listStack compactList">
              {visibleWorkOrders
                .filter((workOrder) => !workOrder.vendorUserId)
                .map((workOrder) => (
                  <div key={workOrder.id} className="listItem splitListItem">
                    <div>
                      <strong>{workOrder.workOrderId}</strong>
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
            <div className="listStack compactList">
              {myAlerts.map((alert) => (
                <div key={alert.id} className="listItem splitListItem">
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
    serviceStates: [],
    primaryState: "",
  });

  const canManageUsers =
    currentUser.role === ROLES.ADMIN || currentUser.role === ROLES.AMS_ADMIN;
  const visibleUsers =
    currentUser.role === ROLES.ADMIN || currentUser.role === ROLES.AMS_ADMIN
      ? appState.users
      : [currentUser];

  return (
    <div className="pageGrid compactPageGrid">
      {canManageUsers && (
        <section className="card">
          <div className="sectionTitle">Create User</div>
          <div className="formGrid compactFormGrid">
            <InputField
              label="Name"
              value={form.name}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, name: value }))
              }
            />
            <InputField
              label="Email"
              value={form.email}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, email: value }))
              }
            />
            <InputField
              label="Phone"
              value={form.phone}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, phone: value }))
              }
            />
            <SelectField
              label="Role"
              value={form.role}
              onChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  role: value,
                  serviceStates:
                    value === ROLES.VENDOR ? prev.serviceStates : [],
                  primaryState: value === ROLES.VENDOR ? prev.primaryState : "",
                }))
              }
              options={[ROLES.AMS_ADMIN, ROLES.AMS_USER, ROLES.VENDOR]}
            />
            <InputField
              label="Password"
              value={form.password}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, password: value }))
              }
            />
          </div>

          {form.role === ROLES.VENDOR ? (
            <div className="advancedBox tightBox">
              <StateSelector
                selectedStates={form.serviceStates}
                primaryState={form.primaryState}
                onChangeStates={(serviceStates) =>
                  setForm((prev) => ({
                    ...prev,
                    serviceStates,
                    primaryState: serviceStates.includes(prev.primaryState)
                      ? prev.primaryState
                      : "",
                  }))
                }
                onChangePrimary={(primaryState) =>
                  setForm((prev) => ({ ...prev, primaryState }))
                }
              />
            </div>
          ) : null}

          <button
            className="primaryBtn"
            onClick={() => {
              if (!form.name || !form.email) {
                alert("Name and email are required");
                return;
              }
              if (
                form.role === ROLES.VENDOR &&
                form.serviceStates.length === 0
              ) {
                alert("Select at least one vendor service state");
                return;
              }
              createUser(form);
              setForm({
                name: "",
                email: "",
                phone: "",
                role: ROLES.AMS_USER,
                password: "Demo123",
                serviceStates: [],
                primaryState: "",
              });
            }}
          >
            Create User
          </button>
        </section>
      )}

      <section className="card">
        <div className="sectionTitle">Users</div>
        <div className="listStack compactList">
          {visibleUsers.map((user) => (
            <div key={user.id} className="userCard compactCard">
              <div className="userCardTop alignStartMobile">
                <div>
                  <strong>{user.name}</strong>
                  <div className="muted">{user.role}</div>
                  <div className="muted">{user.email}</div>
                </div>
                <div className="pillRow wrapLeft">
                  <span className="statusPill">{user.accountStatus}</span>
                  {user.isPrimary ? (
                    <span className="statusPill primaryPill">Primary</span>
                  ) : null}
                </div>
              </div>

              {user.role === ROLES.VENDOR ? (
                <StateBadges
                  serviceStates={user.serviceStates}
                  primaryState={user.primaryState}
                />
              ) : null}

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
                  <div className="inlineActions wrapLeft compactActions">
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
  const vendorUsers = appState.users.filter(
    (user) => user.role === ROLES.VENDOR
  );

  const visibleSites =
    currentUser.role === ROLES.VENDOR ? vendorAssignedSites : appState.sites;

  return (
    <div className="pageGrid compactPageGrid">
      {canManageSites && (
        <section className="card">
          <div className="sectionTitle">Create Site</div>
          <div className="formGrid compactFormGrid">
            <InputField
              label="Site Name"
              value={form.siteName}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, siteName: value }))
              }
            />
            <InputField
              label="Address"
              value={form.address}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, address: value }))
              }
            />
            <InputField
              label="City"
              value={form.city}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, city: value }))
              }
            />
            <InputField
              label="State"
              value={form.state}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, state: value }))
              }
            />
            <InputField
              label="Zip"
              value={form.zip}
              onChange={(value) => setForm((prev) => ({ ...prev, zip: value }))}
            />
            <SelectField
              label="Assigned Vendor"
              value={form.assignedVendorUserId}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, assignedVendorUserId: value }))
              }
              options={[
                "",
                ...vendorUsers.map((vendor) => `${vendor.id}|${vendor.name}`),
              ]}
              formatter={(item) => (item === "" ? "None" : item.split("|")[1])}
              rawValue={(item) => (item === "" ? "" : item.split("|")[0])}
            />
            <SelectField
              label="Status"
              value={form.status}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, status: value }))
              }
              options={SITE_STATUS_OPTIONS}
            />
            <SelectField
              label="Priority"
              value={form.priority}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, priority: value }))
              }
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
        <div className="listStack compactList">
          {visibleSites.map((site) => {
            const assignedVendor = appState.users.find(
              (user) => user.id === site.assignedVendorUserId
            );

            return (
              <div key={site.id} className="siteCard compactCard">
                <div className="siteHeader alignStartMobile">
                  <div>
                    <strong>{site.siteName}</strong>
                    <div className="muted">{site.address}</div>
                    <div className="muted">
                      {site.city} {site.state} {site.zip}
                    </div>
                  </div>
                  <div className="pillRow wrapLeft">
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

                {currentUser.role === ROLES.VENDOR ? (
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
                ) : null}
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
      ? appState.sites.filter(
          (site) => site.assignedVendorUserId === currentUser.id
        )
      : appState.sites;

  const vendorUsers = appState.users.filter(
    (user) => user.role === ROLES.VENDOR
  );

  return (
    <div className="pageGrid compactPageGrid">
      {(currentUser.role === ROLES.ADMIN ||
        currentUser.role === ROLES.AMS_ADMIN ||
        currentUser.role === ROLES.AMS_USER) && (
        <section className="card">
          <div className="sectionTitle">Quick Create Work Order</div>
          <div className="formGrid compactFormGrid">
            <SelectField
              label="Site"
              value={form.siteId}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, siteId: value }))
              }
              options={sites.map((site) => `${site.id}|${site.siteName}`)}
              formatter={(item) => item.split("|")[1]}
              rawValue={(item) => item.split("|")[0]}
            />
            <TextAreaField
              label="Work Description"
              value={form.description}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, description: value }))
              }
            />
          </div>

          <div className="inlineActions wrapLeft compactActions">
            <button
              className="secondaryBtn"
              onClick={() => setShowAdvanced((value) => !value)}
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

          {showAdvanced ? (
            <div className="advancedBox tightBox">
              <div className="formGrid compactFormGrid">
                <SelectField
                  label="Service Type"
                  value={form.serviceType}
                  onChange={(value) =>
                    setForm((prev) => ({ ...prev, serviceType: value }))
                  }
                  options={SERVICE_TYPES}
                />
                <SelectField
                  label="Vendor"
                  value={form.vendorUserId}
                  onChange={(value) =>
                    setForm((prev) => ({ ...prev, vendorUserId: value }))
                  }
                  options={[
                    "",
                    ...vendorUsers.map(
                      (vendor) => `${vendor.id}|${vendor.name}`
                    ),
                  ]}
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
                    setForm((prev) => ({ ...prev, schedule: value }))
                  }
                />
                <SelectField
                  label="Priority"
                  value={form.priority}
                  onChange={(value) =>
                    setForm((prev) => ({ ...prev, priority: value }))
                  }
                  options={["", ...PRIORITY_OPTIONS]}
                />
                <InputField
                  label="Linked Proposal"
                  value={form.linkedProposal}
                  onChange={(value) =>
                    setForm((prev) => ({ ...prev, linkedProposal: value }))
                  }
                />
                <TextAreaField
                  label="Notes"
                  value={form.notes}
                  onChange={(value) =>
                    setForm((prev) => ({ ...prev, notes: value }))
                  }
                />
              </div>

              <div className="checkboxRow">
                <label>
                  <input
                    type="checkbox"
                    checked={form.requirements.photosRequired}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        requirements: {
                          ...prev.requirements,
                          photosRequired: event.target.checked,
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
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        requirements: {
                          ...prev.requirements,
                          operatorNameRequired: event.target.checked,
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
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        requirements: {
                          ...prev.requirements,
                          beforeAfterRequired: event.target.checked,
                        },
                      }))
                    }
                  />{" "}
                  Before and after required
                </label>
              </div>
            </div>
          ) : null}
        </section>
      )}

      <section className="card">
        <div className="sectionTitle">Work Orders</div>
        {visibleWorkOrders.length === 0 ? (
          <div className="emptyState">No work orders yet</div>
        ) : (
          <div className="listStack compactList">
            {visibleWorkOrders.map((workOrder) => {
              const site = appState.sites.find(
                (item) => item.id === workOrder.siteId
              );
              const vendor = appState.users.find(
                (user) => user.id === workOrder.vendorUserId
              );
              const linkedJob = appState.jobs.find(
                (job) => job.workOrderId === workOrder.id
              );

              return (
                <div key={workOrder.id} className="workOrderCard compactCard">
                  <div className="workOrderTop alignStartMobile">
                    <div>
                      <strong>{workOrder.workOrderId}</strong>
                      <div className="muted">
                        {site?.siteName || "Unknown site"}
                      </div>
                    </div>
                    <div className="pillRow wrapLeft">
                      <span className="statusPill">{workOrder.status}</span>
                      <span
                        className={`statusPill ${
                          workOrder.vendorUserId ? "" : "warningPill"
                        }`}
                      >
                        {vendor?.name || "Unassigned"}
                      </span>
                    </div>
                  </div>

                  <div className="muted">{workOrder.description}</div>
                  <div className="detailRow">
                    <span>Created</span>
                    <span>{formatDateTime(workOrder.createdAt)}</span>
                  </div>
                  <div className="detailRow">
                    <span>Service Type</span>
                    <span>{workOrder.serviceType || "Not set"}</span>
                  </div>
                  <div className="detailRow">
                    <span>Schedule</span>
                    <span>{workOrder.schedule || "Not scheduled"}</span>
                  </div>
                  <div className="detailRow">
                    <span>Priority</span>
                    <span>{workOrder.priority || "Not set"}</span>
                  </div>

                  {(currentUser.role === ROLES.ADMIN ||
                    currentUser.role === ROLES.AMS_ADMIN ||
                    currentUser.role === ROLES.AMS_USER) && (
                    <div className="inlineActions wrapLeft compactActions">
                      <button
                        className="primaryBtn"
                        onClick={() => createJobFromWorkOrder(workOrder.id)}
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
  vendorOpportunities,
  claimOpportunity,
}) {
  if (currentUser.role === ROLES.VENDOR) {
    const assignedJobs = visibleJobs.filter(
      (job) => job.vendorUserId === currentUser.id
    );
    const activeAssignedJobs = assignedJobs.filter(
      (job) => job.status !== "Completed"
    );

    return (
      <div className="pageGrid compactPageGrid">
        <section className="card">
          <div className="sectionTitle">
            {activeTab === "checkIn" ? "Check In" : "My Jobs"}
          </div>
          <div className="statsGrid vendorJobStats">
            <StatCard
              label="Open Opportunities"
              value={vendorOpportunities.length}
            />
            <StatCard label="Active Jobs" value={activeAssignedJobs.length} />
          </div>
        </section>

        <section className="card">
          <div className="sectionTitle">Job Opportunities</div>
          {vendorOpportunities.length === 0 ? (
            <div className="emptyState">
              No opportunities available for your service states
            </div>
          ) : (
            <div className="listStack compactList">
              {vendorOpportunities.map((workOrder) => {
                const site = appState.sites.find(
                  (item) => item.id === workOrder.siteId
                );
                return (
                  <div key={workOrder.id} className="jobCard compactCard">
                    <div className="workOrderTop alignStartMobile">
                      <div>
                        <strong>{workOrder.workOrderId}</strong>
                        <div className="muted">
                          {site?.siteName || "Unknown site"}
                        </div>
                      </div>
                      <div className="pillRow wrapLeft">
                        <span className="statusPill warningPill">
                          Opportunity
                        </span>
                        {site?.state ? (
                          <span className="statusPill">{site.state}</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="muted">{workOrder.description}</div>
                    <div className="detailRow">
                      <span>Service Type</span>
                      <span>{workOrder.serviceType || "Not set"}</span>
                    </div>
                    <div className="detailRow">
                      <span>Site</span>
                      <span>
                        {site?.address
                          ? `${site.address}, ${site.city} ${site.state}`
                          : "Not available"}
                      </span>
                    </div>
                    <div className="inlineActions wrapLeft compactActions">
                      <button
                        className="primaryBtn"
                        onClick={() => claimOpportunity(workOrder.id)}
                      >
                        Claim Opportunity
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="card">
          <div className="sectionTitle">Assigned Jobs</div>
          {assignedJobs.length === 0 ? (
            <div className="emptyState">No assigned jobs</div>
          ) : (
            <div className="listStack compactList">
              {assignedJobs.map((job) => {
                const site = appState.sites.find(
                  (item) => item.id === job.siteId
                );
                const workOrder = appState.workOrders.find(
                  (item) => item.id === job.workOrderId
                );

                return (
                  <div key={job.id} className="jobCard compactCard">
                    <div className="workOrderTop alignStartMobile">
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

                    <div className="inlineActions wrapLeft compactActions">
                      {job.status === "Scheduled" ? (
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
                      ) : null}

                      {job.status === "Checked In" ? (
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
                      ) : null}

                      {job.status === "In Progress" ? (
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
                      ) : null}

                      {job.status === "Checked Out" ? (
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
                      ) : null}
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

  return (
    <div className="pageGrid compactPageGrid">
      <section className="card">
        <div className="sectionTitle">
          {activeTab === "dispatch"
            ? "Dispatch"
            : activeTab === "actionRequired"
            ? "Action Required"
            : activeTab === "checkIn"
            ? "Check In"
            : "Jobs"}
        </div>

        {visibleJobs.length === 0 ? (
          <div className="emptyState">No active jobs</div>
        ) : (
          <div className="listStack compactList">
            {visibleJobs.map((job) => {
              const site = appState.sites.find(
                (item) => item.id === job.siteId
              );
              const workOrder = appState.workOrders.find(
                (item) => item.id === job.workOrderId
              );
              const vendor = appState.users.find(
                (item) => item.id === job.vendorUserId
              );

              return (
                <div key={job.id} className="jobCard compactCard">
                  <div className="workOrderTop alignStartMobile">
                    <div>
                      <strong>
                        {workOrder?.workOrderId || "Linked work order"}
                      </strong>
                      <div className="muted">
                        {site?.siteName || "Unknown site"}
                      </div>
                    </div>
                    <div className="pillRow wrapLeft">
                      <span className="statusPill">{job.status}</span>
                      <span className="statusPill">
                        {vendor?.name || "Unassigned"}
                      </span>
                    </div>
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

function VendorsPage({ appState, currentUser, updateUser }) {
  const vendors = appState.users.filter((user) => user.role === ROLES.VENDOR);
  const canManageVendors =
    currentUser.role === ROLES.ADMIN || currentUser.role === ROLES.AMS_ADMIN;
  const [selectedVendorId, setSelectedVendorId] = useState(
    vendors[0]?.id || ""
  );
  const [form, setForm] = useState({
    name: "",
    phone: "",
    serviceStates: [],
    primaryState: "",
  });

  useEffect(() => {
    if (!selectedVendorId && vendors[0]?.id) {
      setSelectedVendorId(vendors[0].id);
    }
  }, [selectedVendorId, vendors]);

  useEffect(() => {
    const selectedVendor = vendors.find(
      (vendor) => vendor.id === selectedVendorId
    );
    if (!selectedVendor) return;
    setForm({
      name: selectedVendor.name,
      phone: selectedVendor.phone || "",
      serviceStates: selectedVendor.serviceStates || [],
      primaryState: selectedVendor.primaryState || "",
    });
  }, [selectedVendorId, vendors]);

  const selectedVendor =
    vendors.find((vendor) => vendor.id === selectedVendorId) || null;

  return (
    <div className="pageGrid compactPageGrid vendorGrid">
      <section className="card">
        <div className="sectionTitle">Vendors</div>
        {vendors.length === 0 ? (
          <div className="emptyState">No vendors</div>
        ) : (
          <div className="listStack compactList">
            {vendors.map((vendor) => (
              <button
                key={vendor.id}
                className={`chatSelectBtn cardSelectBtn ${
                  selectedVendor?.id === vendor.id ? "active" : ""
                }`}
                onClick={() => setSelectedVendorId(vendor.id)}
              >
                <div>
                  <strong>{vendor.name}</strong>
                  <div className="muted">{vendor.email}</div>
                </div>
                <div className="pillRow wrapLeft">
                  <span className="statusPill">{vendor.accountStatus}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <div className="sectionTitle">Vendor Profile</div>
        {!selectedVendor ? (
          <div className="emptyState">Select a vendor</div>
        ) : (
          <div className="listStack compactList">
            <div className="userCard compactCard">
              <div className="userCardTop alignStartMobile">
                <div>
                  <strong>{selectedVendor.name}</strong>
                  <div className="muted">{selectedVendor.email}</div>
                  <div className="muted">
                    {selectedVendor.phone || "No phone"}
                  </div>
                </div>
                <span className="statusPill">
                  {selectedVendor.accountStatus}
                </span>
              </div>
              <StateBadges
                serviceStates={selectedVendor.serviceStates}
                primaryState={selectedVendor.primaryState}
              />
            </div>

            {canManageVendors ? (
              <div className="advancedBox tightBox">
                <div className="formGrid compactFormGrid">
                  <InputField
                    label="Vendor Name"
                    value={form.name}
                    onChange={(value) =>
                      setForm((prev) => ({ ...prev, name: value }))
                    }
                  />
                  <InputField
                    label="Phone"
                    value={form.phone}
                    onChange={(value) =>
                      setForm((prev) => ({ ...prev, phone: value }))
                    }
                  />
                </div>

                <StateSelector
                  selectedStates={form.serviceStates}
                  primaryState={form.primaryState}
                  onChangeStates={(serviceStates) =>
                    setForm((prev) => ({
                      ...prev,
                      serviceStates,
                      primaryState: serviceStates.includes(prev.primaryState)
                        ? prev.primaryState
                        : "",
                    }))
                  }
                  onChangePrimary={(primaryState) =>
                    setForm((prev) => ({ ...prev, primaryState }))
                  }
                />

                <div className="inlineActions wrapLeft compactActions">
                  <button
                    className="primaryBtn"
                    onClick={() => {
                      if (!form.name.trim()) {
                        alert("Vendor name is required");
                        return;
                      }
                      if (form.serviceStates.length === 0) {
                        alert("Select at least one service state");
                        return;
                      }
                      updateUser(selectedVendor.id, {
                        name: form.name.trim(),
                        phone: form.phone.trim(),
                        serviceStates: form.serviceStates,
                        primaryState: form.primaryState,
                      });
                    }}
                  >
                    Save Vendor
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
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
    visibleChats.find((chat) => chat.id === selectedChatId) || visibleChats[0];

  return (
    <div className="pageGrid chatGrid compactPageGrid">
      <section className="card">
        <div className="sectionTitle">Chat Channels</div>

        <div className="inlineActions compactActions">
          <button className="secondaryBtn" onClick={requestAmsHelpChat}>
            Request AMS Help
          </button>
        </div>

        {visibleChats.length === 0 ? (
          <div className="emptyState">No chats available</div>
        ) : (
          <div className="listStack compactList">
            {visibleChats.map((chat) => (
              <button
                key={chat.id}
                className={`chatSelectBtn cardSelectBtn ${
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
                selectedChat.messages.map((chatMessage) => {
                  const sender = appState.users.find(
                    (user) => user.id === chatMessage.senderId
                  );
                  const mine = chatMessage.senderId === currentUser.id;

                  return (
                    <div
                      key={chatMessage.id}
                      className={`chatBubble ${mine ? "mine" : ""}`}
                    >
                      <div className="chatSender">
                        {sender?.name || "Unknown"}
                      </div>
                      <div>{chatMessage.text}</div>
                      <div className="chatTime">
                        {formatDateTime(chatMessage.createdAt)}
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
                onChange={(event) => setMessage(event.target.value)}
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
    <div className="pageGrid compactPageGrid">
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
    <div className="pageGrid compactPageGrid">
      {currentUser.role === ROLES.VENDOR ? (
        <section className="card">
          <div className="sectionTitle">About AMS</div>
          <div className="copyBlock">
            Advanced Maintenance Services operational portal for field execution
            and communication.
          </div>
        </section>
      ) : null}

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

      {currentUser.role === ROLES.ADMIN ? (
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
      ) : null}
    </div>
  );
}

function ProfilePage({ currentUser, updateUser }) {
  const [name, setName] = useState(currentUser.name);
  const [phone, setPhone] = useState(currentUser.phone || "");

  return (
    <div className="pageGrid compactPageGrid">
      <section className="card">
        <div className="sectionTitle">Profile</div>

        <div className="profilePhotoMock" onClick={() => alert("Coming soon")}>
          Profile Photo
        </div>

        <div className="formGrid compactFormGrid">
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

        {currentUser.role === ROLES.VENDOR ? (
          <StateBadges
            serviceStates={currentUser.serviceStates}
            primaryState={currentUser.primaryState}
          />
        ) : null}

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

function StatCard({ label, value, onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      className={`statCard ${onClick ? "interactiveCard" : ""}`}
      onClick={onClick}
    >
      <div className="statValue">{value}</div>
      <div className="muted">{label}</div>
    </Tag>
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
        onChange={(event) => onChange(event.target.value)}
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
        onChange={(event) => onChange(event.target.value)}
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
        onChange={(event) => onChange(event.target.value)}
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

function StateSelector({
  selectedStates,
  primaryState,
  onChangeStates,
  onChangePrimary,
}) {
  const toggleState = (state) => {
    if (selectedStates.includes(state)) {
      onChangeStates(selectedStates.filter((item) => item !== state));
      return;
    }
    onChangeStates([...selectedStates, state]);
  };

  return (
    <div className="stateSelectorWrap">
      <div className="sectionSubTitle">Service States</div>
      <div className="stateGrid">
        {STATE_OPTIONS.map((state) => (
          <label
            key={state}
            className={`stateChip ${
              selectedStates.includes(state) ? "active" : ""
            }`}
          >
            <input
              type="checkbox"
              checked={selectedStates.includes(state)}
              onChange={() => toggleState(state)}
            />
            <span>{state}</span>
          </label>
        ))}
      </div>

      <div className="formGrid compactFormGrid smallTopGrid">
        <SelectField
          label="Primary State (Optional)"
          value={primaryState}
          onChange={onChangePrimary}
          options={["", ...selectedStates]}
          formatter={(item) => (item === "" ? "None" : item)}
        />
      </div>
    </div>
  );
}

function StateBadges({ serviceStates, primaryState }) {
  if (!serviceStates?.length) {
    return <div className="muted smallTop">No service states configured</div>;
  }

  return (
    <div className="stateBadgeRow">
      {serviceStates.map((state) => (
        <span
          key={state}
          className={`statusPill ${
            primaryState === state ? "primaryPill" : ""
          }`}
        >
          {primaryState === state ? `Primary ${state}` : state}
        </span>
      ))}
    </div>
  );
}

function getInitials(name) {
  return String(name || "U")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function Styles() {
  return (
    <style>{`
      * {
        box-sizing: border-box;
      }

      html,
      body,
      #root {
        margin: 0;
        min-height: 100%;
        width: 100%;
        overflow-x: hidden;
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

      button,
      input,
      select,
      textarea {
        font: inherit;
      }

      button {
        appearance: none;
      }

      .splashScreen,
      .loginShell {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }

      .splashLogoWrap,
      .loginHeader {
        text-align: center;
      }

      .splashLogo,
      .loginLogo {
        font-size: 56px;
        font-weight: 900;
        letter-spacing: 8px;
        color: #ffffff;
        text-shadow: 0 0 14px rgba(255, 128, 0, 0.32);
      }

      .splashSub,
      .loginSub {
        color: #bdbdbd;
        margin-top: 8px;
      }

      .loginPanel {
        width: 100%;
        max-width: 460px;
        display: grid;
        gap: 16px;
        background: #050505;
        border: 1px solid rgba(255, 128, 0, 0.5);
        border-radius: 22px;
        padding: 24px;
        box-shadow: 0 0 26px rgba(255, 128, 0, 0.14);
      }

      .loginTitle {
        font-size: 26px;
        font-weight: 800;
        text-align: center;
        margin-top: 4px;
      }

      .loginGrid {
        margin-top: 0;
      }

      .demoGroup {
        display: grid;
        gap: 10px;
      }

      .inputGrid,
      .formGrid {
        display: grid;
        gap: 14px;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }

      .compactFormGrid {
        gap: 12px;
      }

      .inputLabel {
        display: flex;
        flex-direction: column;
        gap: 8px;
        color: #f2f2f2;
        font-size: 14px;
        font-weight: 600;
      }

      .textInput,
      .textArea {
        width: 100%;
        background: #111111;
        color: #ffffff;
        border: 1px solid #2a2a2a;
        border-radius: 12px;
        padding: 12px 14px;
        outline: none;
      }

      .textInput:focus,
      .textArea:focus {
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
        margin: 2px 0;
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

      .drawerHeader {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .drawerTitle {
        font-size: 16px;
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
        margin-top: 18px;
      }

      .drawerUserCard,
      .card {
        background: #0b0b0b;
        border: 1px solid #1f1f1f;
        border-radius: 18px;
        padding: 16px;
      }

      .compactCard {
        padding: 13px;
      }

      .drawerUserName {
        font-size: 18px;
        font-weight: 800;
      }

      .drawerNav {
        margin-top: 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .drawerFooter {
        margin-top: auto;
      }

      .mainArea {
        width: 100%;
        min-width: 0;
      }

      .topBar {
        position: sticky;
        top: 0;
        z-index: 10;
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;
        gap: 8px;
        min-height: 58px;
        background: rgba(5, 5, 5, 0.96);
        backdrop-filter: blur(8px);
        padding: 8px 12px;
        border-bottom: 1px solid #1a1a1a;
      }

      .topBarSide {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }

      .leftAlign {
        justify-content: flex-start;
      }

      .rightAlign {
        justify-content: flex-end;
      }

      .topBarCenter {
        display: flex;
        justify-content: center;
        min-width: 0;
      }

      .headerLogo {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: none;
        padding: 0;
        cursor: pointer;
      }

      .headerLogoMark {
        color: #ffffff;
        font-size: 24px;
        font-weight: 900;
        letter-spacing: 4px;
        text-shadow: 0 0 10px rgba(255, 128, 0, 0.18);
      }

      .compactIconBtn,
      .iconCircle {
        position: relative;
        width: 40px;
        height: 40px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: #141414;
        color: #ffffff;
        border: 1px solid #2a2a2a;
        border-radius: 12px;
        cursor: pointer;
        flex-shrink: 0;
      }

      .profileCircle {
        font-size: 12px;
        font-weight: 800;
      }

      .iconBadge {
        position: absolute;
        top: -4px;
        right: -4px;
        min-width: 18px;
        height: 18px;
        padding: 0 4px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        background: #ff7a00;
        color: #111111;
        font-size: 11px;
        font-weight: 900;
      }

      .quickActions {
        position: sticky;
        top: 58px;
        z-index: 9;
        background: #070707;
        border-bottom: 1px solid #171717;
        display: flex;
        gap: 8px;
        overflow-x: auto;
        padding: 10px 12px;
      }

      .contentArea {
        padding: 14px;
      }

      .pageGrid {
        display: grid;
        gap: 14px;
      }

      .compactPageGrid {
        gap: 12px;
      }

      .chatGrid,
      .vendorGrid {
        grid-template-columns: 320px minmax(0, 1fr);
      }

      .sectionTitle {
        font-size: 18px;
        font-weight: 800;
        margin-bottom: 12px;
      }

      .sectionSubTitle {
        font-size: 14px;
        font-weight: 800;
        color: #e5e5e5;
        margin-bottom: 10px;
      }

      .statsGrid {
        display: grid;
        gap: 12px;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      }

      .vendorJobStats {
        grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      }

      .statCard {
        background: #111111;
        border: 1px solid #222222;
        border-radius: 14px;
        padding: 15px;
        color: #ffffff;
        text-align: left;
      }

      .interactiveCard {
        cursor: pointer;
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
        margin-top: 8px;
      }

      .smallTopGrid {
        margin-top: 10px;
      }

      .emptyState {
        background: #111111;
        border: 1px dashed #2e2e2e;
        border-radius: 14px;
        padding: 20px;
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

      .compactList {
        gap: 10px;
      }

      .listItem,
      .siteCard,
      .workOrderCard,
      .jobCard,
      .userCard,
      .cardSelectBtn {
        background: #111111;
        border: 1px solid #212121;
        border-radius: 14px;
        padding: 14px;
      }

      .cardSelectBtn {
        width: 100%;
        text-align: left;
      }

      .splitListItem,
      .siteHeader,
      .workOrderTop,
      .userCardTop,
      .detailRow,
      .inlineActions,
      .pillRow {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }

      .detailRow {
        color: #cfcfcf;
        padding-top: 8px;
        font-size: 14px;
      }

      .menuBtn,
      .profileBtn,
      .navBtn,
      .ghostBtn,
      .chatSelectBtn {
        background: #141414;
        color: #ffffff;
        border: 1px solid #2a2a2a;
        border-radius: 12px;
        padding: 10px 14px;
        cursor: pointer;
      }

      .navBtn.active,
      .chatSelectBtn.active,
      .cardSelectBtn.active {
        border-color: #ff7a00;
        background: #221307;
      }

      .primaryBtn,
      .secondaryBtn,
      .dangerBtn,
      .quickBtn {
        border: none;
        border-radius: 12px;
        padding: 11px 15px;
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
        margin-top: 14px;
        background: #0f0f0f;
        border: 1px solid #222222;
        border-radius: 16px;
        padding: 16px;
      }

      .tightBox {
        padding: 14px;
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

      .statusPill,
      .countPill {
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
        margin-bottom: 16px;
        cursor: pointer;
      }

      .lockedInfo {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin: 16px 0;
        color: #aaaaaa;
      }

      .stateSelectorWrap {
        display: grid;
        gap: 10px;
      }

      .stateGrid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(68px, 1fr));
        gap: 8px;
      }

      .stateChip {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        min-height: 38px;
        padding: 8px 10px;
        background: #141414;
        border: 1px solid #2a2a2a;
        border-radius: 12px;
        color: #ffffff;
        cursor: pointer;
      }

      .stateChip input {
        margin: 0;
      }

      .stateChip.active {
        border-color: #ff7a00;
        background: #221307;
      }

      .stateBadgeRow {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 10px;
      }

      .wrapLeft {
        flex-wrap: wrap;
        justify-content: flex-start;
      }

      .compactActions {
        margin-top: 10px;
      }

      @media (max-width: 980px) {
        .chatGrid,
        .vendorGrid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 880px) {
        .quickActions {
          top: 58px;
        }
      }

      @media (max-width: 720px) {
        .contentArea {
          padding: 12px;
        }

        .card,
        .drawerUserCard {
          padding: 14px;
        }

        .alignStartMobile,
        .detailRow {
          align-items: flex-start;
          flex-direction: column;
        }

        .detailRow span:last-child {
          text-align: left;
        }

        .chatComposer {
          flex-direction: column;
        }

        .splashScreen,
        .loginShell {
          padding: 16px;
        }

        .loginPanel {
          padding: 20px;
          gap: 14px;
        }

        .splashLogo,
        .loginLogo {
          font-size: 48px;
          letter-spacing: 6px;
        }

        .headerLogoMark {
          font-size: 21px;
          letter-spacing: 3px;
        }
      }
    `}</style>
  );
}

export default App;
