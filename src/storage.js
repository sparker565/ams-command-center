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
    return {
      ...createSeedData(),
      ...parsed,
      ui: {
        ...createSeedData().ui,
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
