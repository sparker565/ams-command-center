import { addDoc, collection, doc, getDocs, updateDoc } from "firebase/firestore";
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
    vendorCost: data.vendorCost ?? "",
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

function serializeWorkOrderCreate(workOrder) {
  const title = workOrder.title || workOrder.siteName || "Work Order";
  return {
    title,
    siteId: workOrder.siteId || "",
    siteName: workOrder.siteName || title,
    state: workOrder.state || "",
    status: normalizeWorkOrderStatus(workOrder.status),
    priority: workOrder.priority || "Normal",
    description: workOrder.description || title,
    createdAt: workOrder.createdAt || new Date().toISOString(),
    createdBy: workOrder.createdBy || "",
    serviceType: workOrder.serviceType || "General Maintenance",
    triggerDepth: workOrder.triggerDepth ?? "",
    assignedVendorId: workOrder.assignedVendorId || "",
    assignedVendorName: workOrder.assignedVendorName || "",
    amsWorkOrderNumber: workOrder.amsWorkOrderNumber || "",
    workOrderNumber: workOrder.amsWorkOrderNumber || "",
    externalWorkOrderNumber: workOrder.externalWorkOrderNumber || "",
    proposalRequired: Boolean(workOrder.proposalRequired),
    proposalRequestedAt: workOrder.proposalRequestedAt || "",
    proposalAwardedAt: workOrder.proposalAwardedAt || "",
    jobId: workOrder.jobId || "",
    requireBeforeAfterPhotos: Boolean(workOrder.requireBeforeAfterPhotos),
    workType: workOrder.workType || "one_time",
    recurringFrequency: workOrder.recurringFrequency || "",
    recurringVendorCost: workOrder.recurringVendorCost ?? "",
    vendorCost: workOrder.vendorCost ?? "",
    recurringPricingNotes: workOrder.recurringPricingNotes || "",
    seasonStart: workOrder.seasonStart || "",
    seasonEnd: workOrder.seasonEnd || "",
    seasonalServiceType: workOrder.seasonalServiceType || "",
  };
}

export async function createFirestoreWorkOrder(workOrder) {
  try {
    const payload = serializeWorkOrderCreate(workOrder);
    const ref = await addDoc(collection(db, "workOrders"), payload);
    return {
      workOrder: normalizeFirestoreWorkOrder({
        id: ref.id,
        data: () => payload,
      }),
      error: null,
    };
  } catch (error) {
    return { workOrder: null, error };
  }
}

export async function updateFirestoreWorkOrder(workOrderId, updates) {
  try {
    if (!workOrderId) throw new Error("Cannot update a work order without a work order ID.");
    await updateDoc(doc(db, "workOrders", workOrderId), updates);
    return { error: null };
  } catch (error) {
    return { error };
  }
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
