import { SESSION_STORAGE_KEY, STORAGE_KEY } from "./constants";

const FIRESTORE_COLLECTION_DEFAULTS = {
  sites: [],
  workOrders: [],
  jobs: [],
  vendors: [],
  proposals: [],
};

const BASE_STATE_DEFAULTS = {
  users: [],
  sites: [],
  invoices: [],
  customers: [],
  operators: [],
  companyProfiles: {
    vendors: {},
  },
  ui: {
    currentUserId: null,
    selectedSiteId: null,
    activeScreenByRole: {},
  },
};

function loadLocalData() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function loadSessionData() {
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function sanitizeAppState(state = {}) {
  return {
    ...BASE_STATE_DEFAULTS,
    ...state,
    ...FIRESTORE_COLLECTION_DEFAULTS,
    users: state.users || [],
    sites: FIRESTORE_COLLECTION_DEFAULTS.sites,
    proposals: FIRESTORE_COLLECTION_DEFAULTS.proposals,
    invoices: state.invoices || [],
    customers: state.customers || [],
    operators: state.operators || [],
    companyProfiles: {
      ...(BASE_STATE_DEFAULTS.companyProfiles || {}),
      ...(state.companyProfiles || {}),
      vendors: {},
    },
    ui: {
      ...(BASE_STATE_DEFAULTS.ui || {}),
      ...(state.ui || {}),
    },
  };
}

export function loadAppState() {
  if (typeof window === "undefined") {
    return sanitizeAppState();
  }

  const parsed = loadLocalData();
  const session = loadSessionData();

  return sanitizeAppState({
    ...parsed,
    proposals: [],
    ui: {
      ...(parsed.ui || {}),
      ...(session.ui || {}),
    },
  });
}

export function saveAppState(state) {
  if (typeof window === "undefined") return;

  const sanitizedState = sanitizeAppState(state);
  const persistedState = {
    ...sanitizedState,
    ui: {
      ...sanitizedState.ui,
      currentUserId: null,
      activeScreenByRole: {},
    },
  };

  const sessionState = {
    ui: {
      currentUserId: sanitizedState.ui?.currentUserId || null,
      activeScreenByRole: sanitizedState.ui?.activeScreenByRole || {},
    },
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState));
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionState));
}
