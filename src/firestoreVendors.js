import { collection, getDocs } from "firebase/firestore";
import { db } from "./lib/firebase";

function toArray(value) {
  if (Array.isArray(value)) return value.map((entry) => String(entry || "").trim()).filter(Boolean);
  if (!value) return [];
  return String(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeVendorStatus(status) {
  const normalized = String(status || "active").trim().toLowerCase();
  return !["inactive", "disabled", "archived"].includes(normalized);
}

export function normalizeFirestoreVendor(docSnapshot) {
  const data = docSnapshot.data() || {};
  const companyName = String(data.companyName || data.name || "Firestore Vendor").trim();
  const serviceTypes = toArray(data.serviceTypes);
  const states = toArray(data.states || data.state);
  const email = String(data.email || data.userEmail || "").trim();
  const userEmail = String(data.userEmail || email).trim();

  return {
    id: docSnapshot.id,
    firestoreId: docSnapshot.id,
    userId: String(data.userId || "").trim(),
    userEmail,
    name: companyName,
    companyName,
    contactName: String(data.contactName || "").trim(),
    email,
    phone: data.phone || "",
    state: states[0] || "",
    states,
    serviceType: data.serviceType || serviceTypes[0] || "",
    serviceTypes,
    status: data.status || "active",
    active: normalizeVendorStatus(data.status),
    notes: data.notes || "",
    internalNotes: data.notes || data.internalNotes || "",
    streetAddress: data.streetAddress || "",
    city: data.city || "",
    zip: data.zip || "",
    address: data.address || "",
    password: data.password || "",
    accessStatus: normalizeVendorStatus(data.status) ? "Active" : "Inactive",
    authStatus: data.authStatus || "Active",
  };
}

export async function loadFirestoreVendors() {
  try {
    const snapshot = await getDocs(collection(db, "vendors"));
    const vendors = snapshot.docs
      .map(normalizeFirestoreVendor)
      .sort((a, b) => (a.companyName || "").localeCompare(b.companyName || ""));

    return { vendors, error: null };
  } catch (error) {
    return { vendors: [], error };
  }
}
