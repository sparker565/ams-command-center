import { addDoc, collection, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
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
    startedAt: toIsoString(data.startedAt || data.startTime),
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

function serializeJobCreate(job) {
  return {
    workOrderId: job.workOrderId || "",
    siteId: job.siteId || "",
    siteName: job.siteName || "",
    title: job.title || job.siteName || "Assigned Job",
    status: job.status || "Assigned",
    assignedVendorId: job.assignedVendorId || job.vendorId || "",
    assignedVendorName: job.assignedVendorName || job.vendorName || "",
    vendorId: job.vendorId || job.assignedVendorId || "",
    vendorName: job.vendorName || job.assignedVendorName || "",
    cost: job.cost ?? job.price ?? "",
    price: job.price ?? job.cost ?? "",
    sell: job.sell ?? job.sellPrice ?? "",
    sellPrice: job.sellPrice ?? job.sell ?? "",
    serviceType: job.serviceType || "",
    state: job.state || "",
    description: job.description || "",
    createdAt: job.createdAt || new Date().toISOString(),
    createdBy: job.createdBy || "",
    workType: job.workType || "one_time",
    recurringVendorCost: job.recurringVendorCost ?? "",
    servicePerformed: job.servicePerformed || job.serviceType || "",
    scope: job.scope || job.description || "",
    notes: job.notes || "",
  };
}

export function buildFirestoreJobPayload({ workOrder, vendor, price, sell, createdBy }) {
  const siteName = workOrder.siteName || "";
  const serviceType = workOrder.serviceType || "";
  const vendorName = vendor.companyName || vendor.name || vendor.vendorName || "";
  const cost = price ?? workOrder.vendorCost ?? workOrder.recurringVendorCost ?? "";
  const sellValue = sell ?? workOrder.sell ?? workOrder.sellPrice ?? "";

  return serializeJobCreate({
    workOrderId: workOrder.firestoreId || workOrder.id || "",
    siteId: workOrder.siteId || "",
    siteName,
    title: workOrder.title || (serviceType && siteName ? `${serviceType} - ${siteName}` : siteName || "Assigned Job"),
    status: "Assigned",
    assignedVendorId: vendor.id || vendor.vendorId || "",
    assignedVendorName: vendorName,
    vendorId: vendor.id || vendor.vendorId || "",
    vendorName,
    cost,
    price: cost,
    sell: sellValue,
    sellPrice: sellValue,
    serviceType,
    state: workOrder.state || "",
    description: workOrder.description || "",
    createdAt: new Date().toISOString(),
    createdBy: createdBy || "",
    workType: workOrder.workType || "one_time",
    recurringVendorCost: workOrder.recurringVendorCost ?? "",
    servicePerformed: serviceType,
    scope: workOrder.description || "",
    notes: "",
  });
}

export async function getFirestoreJobByWorkOrderId(workOrderId) {
  try {
    const jobsQuery = query(collection(db, "jobs"), where("workOrderId", "==", workOrderId));
    const snapshot = await getDocs(jobsQuery);
    if (snapshot.empty) return { job: null, error: null };
    return { job: normalizeFirestoreJob(snapshot.docs[0]), error: null };
  } catch (error) {
    return { job: null, error };
  }
}

export async function createFirestoreJob(job) {
  try {
    const payload = serializeJobCreate(job);
    const ref = await addDoc(collection(db, "jobs"), payload);
    return {
      job: normalizeFirestoreJob({
        id: ref.id,
        data: () => payload,
      }),
      error: null,
    };
  } catch (error) {
    return { job: null, error };
  }
}

export async function updateFirestoreJob(jobId, updates) {
  try {
    if (!jobId) throw new Error("Cannot update a job without a job ID.");
    await updateDoc(doc(db, "jobs", jobId), updates);
    return { error: null };
  } catch (error) {
    return { error };
  }
}

export async function createOrLinkFirestoreJobForWorkOrder({ workOrder, vendor, price, sell, createdBy }) {
  try {
    const workOrderId = workOrder.firestoreId || workOrder.id || "";
    if (!workOrderId) throw new Error("Cannot create a job without a work order ID.");

    const existing = await getFirestoreJobByWorkOrderId(workOrderId);
    if (existing.error) throw existing.error;

    let job = existing.job;
    let jobAlreadyExisted = Boolean(job);

    if (!job) {
      const created = await createFirestoreJob(buildFirestoreJobPayload({ workOrder, vendor, price, sell, createdBy }));
      if (created.error) throw created.error;
      job = created.job;
      jobAlreadyExisted = false;
    }

    if (!job?.id) throw new Error("Job creation did not return a Firestore job ID.");

    await updateDoc(doc(db, "workOrders", workOrderId), {
      jobId: job.id,
      assignedVendorId: vendor.id || vendor.vendorId || "",
      assignedVendorName: vendor.companyName || vendor.name || vendor.vendorName || "",
      status: "Assigned",
      proposalAwardedAt: workOrder.proposalAwardedAt || "",
      proposalRequired: false,
    });

    return { job, jobId: job.id, jobAlreadyExisted, error: null };
  } catch (error) {
    return { job: null, jobId: "", jobAlreadyExisted: false, error };
  }
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
