import { addDoc, collection, deleteDoc, doc, getDocs, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "./lib/firebase";

function toIsoString(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return String(value);
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

export function normalizeFirestoreSite(docSnapshot) {
  const data = docSnapshot.data() || {};
  const streetAddress = data.streetAddress || data.address || data.addressLine1 || "";
  const city = data.city || "";
  const state = String(data.state || "").trim().toUpperCase();
  const zip = data.zip || data.zipCode || "";
  const notes = data.notes || data.internalNotes || "";
  const contactName = data.contactName || data.contact || "";

  return {
    id: docSnapshot.id,
    firestoreId: docSnapshot.id,
    name: data.name || data.siteName || "Firestore Site",
    client: data.client || "",
    streetAddress,
    city,
    state,
    zip,
    address: buildAddressLine({ streetAddress, city, state, zip, fallbackAddress: data.address || "" }),
    status: data.status || "Active",
    siteNumber: data.siteNumber || "",
    serviceTypes: Array.isArray(data.serviceTypes)
      ? data.serviceTypes
      : String(data.serviceTypes || "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
    manager: data.manager || "",
    contact: contactName,
    contactName,
    contactPhone: data.contactPhone || "",
    contactEmail: data.contactEmail || "",
    internalNotes: notes,
    notes,
    assignedVendorId: data.assignedVendorId || "",
    assignedVendorName: data.assignedVendorName || "",
    assignedCrewContactId: data.assignedCrewContactId || "",
    assignedCrewContactName: data.assignedCrewContactName || "",
    siteMapStatus: data.siteMapStatus || "Upload Coming Soon",
    geoFenceStatus: data.geoFenceStatus || "Geo Fence Setup Coming Soon",
    createdAt: toIsoString(data.createdAt),
    createdBy: data.createdBy || "",
  };
}

function serializeSiteCreate(site) {
  const state = String(site.state || "").trim().toUpperCase();
  const streetAddress = site.streetAddress || site.address || "";
  const city = site.city || "";
  const zip = site.zip || "";
  const serviceTypes = Array.isArray(site.serviceTypes)
    ? site.serviceTypes.map((value) => String(value || "").trim()).filter(Boolean)
    : String(site.serviceTypes || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
  const notes = site.notes ?? site.internalNotes ?? "";
  const contactName = site.contactName || site.contact || "";

  return {
    name: site.name || site.siteName || "Site",
    siteName: site.name || site.siteName || "Site",
    client: site.client || "",
    streetAddress,
    city,
    state,
    zip,
    address: buildAddressLine({ streetAddress, city, state, zip, fallbackAddress: site.address || "" }),
    status: site.status || "Active",
    siteNumber: site.siteNumber || "",
    serviceTypes,
    manager: site.manager || "",
    contact: contactName,
    contactName,
    contactPhone: site.contactPhone || "",
    contactEmail: site.contactEmail || "",
    internalNotes: notes,
    notes,
    assignedVendorId: site.assignedVendorId || "",
    assignedVendorName: site.assignedVendorName || "",
    assignedCrewContactId: site.assignedCrewContactId || "",
    assignedCrewContactName: site.assignedCrewContactName || "",
    siteMapStatus: site.siteMapStatus || "Upload Coming Soon",
    geoFenceStatus: site.geoFenceStatus || "Geo Fence Setup Coming Soon",
    createdAt: site.createdAt || new Date().toISOString(),
    createdBy: site.createdBy || "",
  };
}

export async function createFirestoreSite(site) {
  try {
    const payload = serializeSiteCreate(site);
    const ref = await addDoc(collection(db, "sites"), payload);
    return {
      site: normalizeFirestoreSite({
        id: ref.id,
        data: () => payload,
      }),
      error: null,
    };
  } catch (error) {
    return { site: null, error };
  }
}

export async function createFirestoreSitesBatch(sites) {
  try {
    if (!sites.length) throw new Error("No sites were provided for import.");

    const batch = writeBatch(db);
    const createdSites = sites.map((site) => {
      const payload = serializeSiteCreate(site);
      const ref = doc(collection(db, "sites"));
      batch.set(ref, payload);
      return normalizeFirestoreSite({
        id: ref.id,
        data: () => payload,
      });
    });

    await batch.commit();
    return { sites: createdSites, error: null };
  } catch (error) {
    return { sites: [], error };
  }
}

export async function updateFirestoreSite(siteId, updates) {
  try {
    if (!siteId) throw new Error("Cannot update a site without a site ID.");
    await updateDoc(doc(db, "sites", siteId), serializeSiteCreate(updates));
    return { site: normalizeFirestoreSite({ id: siteId, data: () => serializeSiteCreate(updates) }), error: null };
  } catch (error) {
    return { site: null, error };
  }
}

export async function deleteFirestoreSite(siteId) {
  try {
    if (!siteId) throw new Error("Cannot delete a site without a site ID.");
    await deleteDoc(doc(db, "sites", siteId));
    return { error: null };
  } catch (error) {
    return { error };
  }
}

export async function loadFirestoreSites() {
  try {
    const snapshot = await getDocs(collection(db, "sites"));
    const sites = snapshot.docs
      .map(normalizeFirestoreSite)
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    return { sites, error: null };
  } catch (error) {
    return { sites: [], error };
  }
}
