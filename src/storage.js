import { SESSION_STORAGE_KEY, STORAGE_KEY } from "./constants";
import { createSeedData } from "./data";

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

export function loadAppState() {
  if (typeof window === "undefined") {
    return createSeedData();
  }

  const seed = createSeedData();
  const parsed = loadLocalData();
  const session = loadSessionData();

  return {
    ...seed,
    ...parsed,
    companyProfiles: {
      ...seed.companyProfiles,
      ...(parsed.companyProfiles || {}),
      vendors: {
        ...(seed.companyProfiles?.vendors || {}),
        ...(parsed.companyProfiles?.vendors || {}),
      },
    },
    ui: {
      ...seed.ui,
      ...(parsed.ui || {}),
      ...(session.ui || {}),
    },
  };
}

export function saveAppState(state) {
  if (typeof window === "undefined") return;

  const persistedState = {
    ...state,
    ui: {
      ...state.ui,
      currentUserId: null,
      activeScreenByRole: {},
    },
  };

  const sessionState = {
    ui: {
      currentUserId: state.ui?.currentUserId || null,
      activeScreenByRole: state.ui?.activeScreenByRole || {},
    },
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState));
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionState));
}
