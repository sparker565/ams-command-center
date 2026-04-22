import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { normalizeServiceType } from "./constants";
import { createOrLinkFirestoreJobForWorkOrder } from "./firestoreJobs";
import { db } from "./lib/firebase";

function toIsoString(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export function normalizeProposalStatus(status) {
  const normalized = String(status || "Submitted").trim().toLowerCase();
  if (normalized === "approved") return "approved";
  if (normalized === "rejected") return "rejected";
  if (normalized === "revision requested" || normalized === "revision_requested") return "revision_requested";
  if (normalized === "withdrawn") return "withdrawn";
  return "submitted";
}

export function toFirestoreProposalStatus(status) {
  const normalized = normalizeProposalStatus(status);
  if (normalized === "approved") return "Approved";
  if (normalized === "rejected") return "Rejected";
  if (normalized === "revision_requested") return "Revision Requested";
  if (normalized === "withdrawn") return "Withdrawn";
  return "Submitted";
}

function normalizeProposalData(id, data = {}) {
  const status = normalizeProposalStatus(data.status);
  const submittedPrice = data.submittedPrice ?? data.price ?? "";
  const submittedNotes = data.submittedNotes ?? data.notes ?? "";
  const submittedAt = toIsoString(data.submittedAt || data.createdAt);
  const vendorName = data.vendorName || data.vendorCompanyName || "";

  return {
    id,
    firestoreId: id,
    workOrderId: data.workOrderId || "",
    siteId: data.siteId || "",
    siteName: data.siteName || "",
    vendorId: data.vendorId || "",
    vendorName,
    vendorCompanyName: vendorName,
    vendorUserEmail: data.vendorUserEmail || "",
    serviceType: normalizeServiceType(data.serviceType) || "",
    price: submittedPrice,
    submittedPrice,
    notes: submittedNotes,
    submittedNotes,
    submittedAt,
    createdAt: submittedAt,
    createdBy: data.createdBy || "",
    status,
    revisionNumber: data.revisionNumber || data.revisionCount || 1,
    revisionCount: data.revisionCount || data.revisionNumber || 1,
    reviewedPrice: data.reviewedPrice ?? "",
    amsNotes: data.amsNotes || "",
    lastReviewedAt: toIsoString(data.lastReviewedAt),
    approvedAt: toIsoString(data.approvedAt),
    rejectedAt: toIsoString(data.rejectedAt),
    requestedRevisionAt: toIsoString(data.requestedRevisionAt),
    supersedesProposalId: data.supersedesProposalId || null,
    isActivePath: data.isActivePath ?? ["submitted", "revision_requested"].includes(status),
  };
}

export function normalizeFirestoreProposal(docSnapshot) {
  return normalizeProposalData(docSnapshot.id, docSnapshot.data() || {});
}

export async function loadFirestoreProposals() {
  try {
    const snapshot = await getDocs(collection(db, "proposals"));
    const proposals = snapshot.docs
      .map(normalizeFirestoreProposal)
      .sort((a, b) => {
        const aTime = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
        const bTime = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
        return bTime - aTime;
      });

    return { proposals, error: null };
  } catch (error) {
    return { proposals: [], error };
  }
}

function serializeProposalCreate(proposal) {
  return {
    workOrderId: proposal.workOrderId || "",
    siteId: proposal.siteId || "",
    siteName: proposal.siteName || "",
    vendorId: proposal.vendorId || "",
    vendorName: proposal.vendorName || proposal.vendorCompanyName || "",
    vendorUserEmail: proposal.vendorUserEmail || "",
    serviceType: normalizeServiceType(proposal.serviceType) || "",
    price: proposal.price ?? proposal.submittedPrice ?? "",
    notes: proposal.notes ?? proposal.submittedNotes ?? "",
    status: toFirestoreProposalStatus(proposal.status),
    createdAt: proposal.createdAt || proposal.submittedAt || new Date().toISOString(),
    createdBy: proposal.createdBy || "",
    revisionNumber: proposal.revisionNumber || proposal.revisionCount || 1,
  };
}

function serializeProposalUpdate(updates = {}) {
  const payload = { ...updates };
  if (Object.prototype.hasOwnProperty.call(payload, "status")) {
    payload.status = toFirestoreProposalStatus(payload.status);
  }
  return payload;
}

export async function createFirestoreProposal(proposal) {
  try {
    const ref = await addDoc(collection(db, "proposals"), serializeProposalCreate(proposal));
    return { proposal: normalizeProposalData(ref.id, serializeProposalCreate(proposal)), error: null };
  } catch (error) {
    return { proposal: null, error };
  }
}

export async function updateFirestoreProposal(proposalId, updates) {
  try {
    await updateDoc(doc(db, "proposals", proposalId), serializeProposalUpdate(updates));
    return { error: null };
  } catch (error) {
    return { error };
  }
}

export async function approveFirestoreProposalForWorkOrder({ proposal, workOrder, updates, approvedBy }) {
  try {
    const approvedAt = updates.approvedAt || new Date().toISOString();
    const proposalWorkOrderId = proposal.workOrderId || workOrder.firestoreId || workOrder.id;
    const jobResult = await createOrLinkFirestoreJobForWorkOrder({
      workOrder: {
        ...workOrder,
        firestoreId: workOrder.firestoreId || workOrder.id || proposalWorkOrderId,
        id: workOrder.id || proposalWorkOrderId,
        siteId: proposal.siteId || workOrder.siteId || "",
        siteName: proposal.siteName || workOrder.siteName || "",
        serviceType: normalizeServiceType(proposal.serviceType || workOrder.serviceType) || "",
        proposalAwardedAt: approvedAt,
      },
      vendor: {
        id: proposal.vendorId || "",
        name: proposal.vendorName || proposal.vendorCompanyName || "",
        companyName: proposal.vendorName || proposal.vendorCompanyName || "",
      },
      price: updates.reviewedPrice || proposal.price || proposal.submittedPrice || "",
      sell: workOrder.sell ?? workOrder.sellPrice ?? "",
      createdBy: approvedBy,
    });

    if (jobResult.error) throw jobResult.error;
    if (!jobResult.jobId) throw new Error("Job creation did not return a Firestore job ID.");

    const jobId = jobResult.jobId;
    const batch = writeBatch(db);
    const proposalsQuery = query(collection(db, "proposals"), where("workOrderId", "==", proposalWorkOrderId));
    const snapshot = await getDocs(proposalsQuery);

    snapshot.docs.forEach((proposalDoc) => {
      const current = normalizeFirestoreProposal(proposalDoc);
      const ref = doc(db, "proposals", proposalDoc.id);

      if (proposalDoc.id === proposal.firestoreId || proposalDoc.id === proposal.id) {
        batch.update(ref, serializeProposalUpdate({ ...updates, status: "approved", approvedAt, isActivePath: false }));
        return;
      }

      if (["submitted", "revision_requested"].includes(current.status)) {
        batch.update(ref, serializeProposalUpdate({
          status: "rejected",
          rejectedAt: current.rejectedAt || approvedAt,
          isActivePath: false,
          lastReviewedAt: approvedAt,
        }));
      }
    });

    batch.update(doc(db, "workOrders", workOrder.firestoreId || workOrder.id), {
      assignedVendorId: proposal.vendorId || "",
      assignedVendorName: proposal.vendorName || proposal.vendorCompanyName || "",
      status: "Assigned",
      proposalAwardedAt: approvedAt,
      jobId,
    });

    await batch.commit();
    return {
      approvedAt,
      jobId,
      jobAlreadyExisted: jobResult.jobAlreadyExisted,
      job: jobResult.job,
      error: null,
    };
  } catch (error) {
    return { approvedAt: "", jobId: "", jobAlreadyExisted: false, job: null, error };
  }
}
