import { collection, getDocs } from "firebase/firestore";
import { db } from "./lib/firebase";

function toIsoString(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function normalizeJobStatus(status) {
  return status || "Assigned";
}

export function normalizeFirestoreJob(docSnapshot) {
  const data = docSnapshot.data() || {};
  const title = data.title || data.siteName || "Firestore Job";
  const normalizedSell = String(data.sell ?? data.sellPrice ?? "").trim();
  const cost = data.cost ?? data.price ?? "";
  const assignedVendorId = data.assignedVendorId || data.vendorId || "";
  const assignedVendorName = data.assignedVendorName || data.vendorName || "";

  return {
    id: docSnapshot.id,
    firestoreId: docSnapshot.id,
    workOrderId: data.workOrderId || "",
    siteId: data.siteId || "",
    siteName: data.siteName || title,
    title,
    status: normalizeJobStatus(data.status),
    assignedVendorId,
    assignedVendorName,
    vendorId: assignedVendorId,
    vendorName: assignedVendorName,
    cost,
    price: cost,
    sell: normalizedSell || null,
    sellPrice: normalizedSell,
    pricingStatus: data.pricingStatus || (normalizedSell ? "set" : "not_set"),
    sellSetBy: data.sellSetBy || null,
    sellSetAt: toIsoString(data.sellSetAt),
    serviceType: data.serviceType || "Snow",
    state: data.state || "",
    description: data.description || title,
    createdAt: toIsoString(data.createdAt),
    createdBy: data.createdBy || "",
    workType: data.workType || "one_time",
    recurringVendorCost: data.recurringVendorCost ?? "",
    startTime: toIsoString(data.startTime),
    completedTime: toIsoString(data.completedTime || data.completedAt),
    completedAt: toIsoString(data.completedAt || data.completedTime),
    canceledAt: toIsoString(data.canceledAt),
    serviceDate: toIsoString(data.serviceDate),
    servicePerformed: data.servicePerformed || data.serviceType || "",
    scope: data.scope || data.description || "",
    notes: data.notes || "",
  };
}

export async function loadFirestoreJobs() {
  try {
    const snapshot = await getDocs(collection(db, "jobs"));
    const jobs = snapshot.docs
      .map(normalizeFirestoreJob)
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });

    return { jobs, error: null };
  } catch (error) {
    return { jobs: [], error };
  }
}
