import { STORAGE_KEY } from "./constants";
import { createSeedData } from "./data";

export function loadAppState() {
  if (typeof window === "undefined") {
    return createSeedData();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSeedData();

    const parsed = JSON.parse(raw);
    const seed = createSeedData();
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
      },
    };
  } catch {
    return createSeedData();
  }
}

export function saveAppState(state) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
