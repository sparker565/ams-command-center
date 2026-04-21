import { collection, getDocs } from "firebase/firestore";
import { db } from "./lib/firebase";

function toIsoString(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function normalizeWorkOrderStatus(status) {
  const normalized = String(status || "Needs Review").trim();
  const lookup = normalized.toLowerCase();
  if (lookup === "open opportunity") return "Open";
  if (lookup === "proposal needed") return "Needs Vendor";
  return normalized;
}

export function normalizeFirestoreWorkOrder(docSnapshot) {
  const data = docSnapshot.data() || {};
  const title = data.title || data.siteName || "Firestore Work Order";
  const createdAt = toIsoString(data.createdAt);

  return {
    id: docSnapshot.id,
    firestoreId: docSnapshot.id,
    title,
    siteId: data.siteId || "",
    siteName: data.siteName || title,
    state: data.state || "",
    status: normalizeWorkOrderStatus(data.status),
    priority: data.priority || "",
    description: data.description || title,
    createdAt,
    createdBy: data.createdBy || "",
    serviceType: data.serviceType || "Snow",
    triggerDepth: data.triggerDepth ?? "",
    assignedVendorId: data.assignedVendorId || "",
    assignedVendorName: data.assignedVendorName || "",
    amsWorkOrderNumber: data.amsWorkOrderNumber || data.workOrderNumber || docSnapshot.id,
    externalWorkOrderNumber: data.externalWorkOrderNumber || "",
    proposalRequired: Boolean(data.proposalRequired),
    proposalRequestedAt: toIsoString(data.proposalRequestedAt),
    proposalAwardedAt: toIsoString(data.proposalAwardedAt),
    jobId: data.jobId || "",
    requireBeforeAfterPhotos: Boolean(data.requireBeforeAfterPhotos),
    workType: data.workType || "one_time",
    recurringFrequency: data.recurringFrequency || "",
    recurringVendorCost: data.recurringVendorCost ?? "",
    recurringPricingNotes: data.recurringPricingNotes || "",
    seasonStart: toIsoString(data.seasonStart),
    seasonEnd: toIsoString(data.seasonEnd),
    seasonalServiceType: data.seasonalServiceType || "",
  };
}

export async function loadFirestoreWorkOrders() {
  try {
    const snapshot = await getDocs(collection(db, "workOrders"));
    const workOrders = snapshot.docs
      .map(normalizeFirestoreWorkOrder)
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });

    return { workOrders, error: null };
  } catch (error) {
    return { workOrders: [], error };
  }
}
