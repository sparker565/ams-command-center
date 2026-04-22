import { addDoc, collection, deleteDoc, doc, getDocs, updateDoc } from "firebase/firestore";
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
    password: "",
    accessStatus: normalizeVendorStatus(data.status) ? "Active" : "Inactive",
    authStatus: data.authStatus || "Active",
  };
}

function buildAddressLine({ streetAddress, city, state, zip, fallbackAddress }) {
  const parts = [streetAddress, city, state, zip].filter(Boolean);
  if (parts.length) {
    if (streetAddress && (city || state || zip)) {
      return `${streetAddress}, ${[city, state, zip].filter(Boolean).join(" ")}`.trim();
    }
    return parts.join(", ");
  }
  return fallbackAddress || "";
}

function serializeVendor(vendor) {
  const serviceTypes = toArray(vendor.serviceTypes || vendor.serviceType);
  const states = toArray(vendor.states || vendor.state).map((state) => state.toUpperCase());
  const state = String(vendor.state || states[0] || "").trim().toUpperCase();
  const streetAddress = vendor.streetAddress || "";
  const city = vendor.city || "";
  const zip = vendor.zip || "";
  const email = String(vendor.email || vendor.userEmail || "").trim();

  return {
    companyName: vendor.companyName || vendor.name || "Vendor",
    contactName: vendor.contactName || "",
    email,
    userEmail: String(vendor.userEmail || email).trim(),
    phone: vendor.phone || "",
    state,
    states: states.length ? states : state ? [state] : [],
    serviceType: vendor.serviceType || serviceTypes[0] || "",
    serviceTypes,
    status: vendor.status || (vendor.active === false ? "inactive" : "active"),
    notes: vendor.internalNotes || vendor.notes || "",
    streetAddress,
    city,
    zip,
    address: buildAddressLine({ streetAddress, city, state, zip, fallbackAddress: vendor.address || "" }),
  };
}

export async function createFirestoreVendor(vendor) {
  try {
    const payload = serializeVendor(vendor);
    const ref = await addDoc(collection(db, "vendors"), payload);
    return {
      vendor: normalizeFirestoreVendor({ id: ref.id, data: () => payload }),
      error: null,
    };
  } catch (error) {
    return { vendor: null, error };
  }
}

export async function updateFirestoreVendor(vendorId, updates) {
  try {
    if (!vendorId) throw new Error("Cannot update a vendor without a vendor ID.");
    const payload = serializeVendor(updates);
    await updateDoc(doc(db, "vendors", vendorId), payload);
    return {
      vendor: normalizeFirestoreVendor({ id: vendorId, data: () => payload }),
      error: null,
    };
  } catch (error) {
    return { vendor: null, error };
  }
}

export async function deleteFirestoreVendor(vendorId) {
  try {
    if (!vendorId) throw new Error("Cannot delete a vendor without a vendor ID.");
    await deleteDoc(doc(db, "vendors", vendorId));
    return { error: null };
  } catch (error) {
    return { error };
  }
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
