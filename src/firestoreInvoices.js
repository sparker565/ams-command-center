import { addDoc, collection, doc, getDocs, query, updateDoc, where, writeBatch } from "firebase/firestore";
import { db } from "./lib/firebase";

function toIsoString(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export function normalizeInvoiceStatus(status) {
  const value = String(status || "Submitted").trim().toLowerCase();
  if (value === "invoice submitted" || value === "under review" || value === "submitted") return "Submitted";
  if (value === "approved") return "Approved";
  if (value === "rejected") return "Rejected";
  if (value === "paid") return "Paid";
  return "Submitted";
}

function normalizeInvoiceData(id, data = {}) {
  const amount = data.amount ?? data.total ?? "";
  const submittedAt = toIsoString(data.submittedAt || data.createdAt);

  return {
    id,
    firestoreId: id,
    amount,
    total: data.total ?? amount,
    jobId: data.jobId || "",
    workOrderId: data.workOrderId || "",
    siteId: data.siteId || "",
    siteName: data.siteName || "",
    vendorId: data.vendorId || "",
    vendorName: data.vendorName || "",
    vendorUserEmail: data.vendorUserEmail || "",
    notes: data.notes || "",
    serviceType: data.serviceType || "",
    state: data.state || "",
    status: normalizeInvoiceStatus(data.status),
    submittedAt,
    submittedBy: data.submittedBy || "",
    approvedAt: toIsoString(data.approvedAt),
    approvedBy: data.approvedBy || "",
    paidAt: toIsoString(data.paidAt),
    invoiceNumber: data.invoiceNumber || data.reference || id,
    invoiceDate: toIsoString(data.invoiceDate || submittedAt),
    dueDate: toIsoString(data.dueDate),
    terms: data.terms || "Net 30",
    completedAt: toIsoString(data.completedAt),
    lineItems: data.lineItems || [],
    vendorCompany: data.vendorCompany || {},
  };
}

export function normalizeFirestoreInvoice(docSnapshot) {
  return normalizeInvoiceData(docSnapshot.id, docSnapshot.data() || {});
}

function serializeInvoice(invoice) {
  return {
    amount: invoice.amount ?? invoice.total ?? "",
    total: invoice.total ?? invoice.amount ?? "",
    jobId: invoice.jobId || "",
    workOrderId: invoice.workOrderId || "",
    siteId: invoice.siteId || "",
    siteName: invoice.siteName || "",
    vendorId: invoice.vendorId || "",
    vendorName: invoice.vendorName || "",
    vendorUserEmail: invoice.vendorUserEmail || "",
    notes: invoice.notes || "",
    serviceType: invoice.serviceType || "",
    state: invoice.state || "",
    status: normalizeInvoiceStatus(invoice.status),
    submittedAt: invoice.submittedAt || new Date().toISOString(),
    submittedBy: invoice.submittedBy || "",
    approvedAt: invoice.approvedAt || "",
    approvedBy: invoice.approvedBy || "",
    paidAt: invoice.paidAt || "",
    invoiceNumber: invoice.invoiceNumber || "",
    invoiceDate: invoice.invoiceDate || "",
    dueDate: invoice.dueDate || "",
    terms: invoice.terms || "Net 30",
    completedAt: invoice.completedAt || "",
    lineItems: invoice.lineItems || [],
    vendorCompany: invoice.vendorCompany || {},
  };
}

export async function getFirestoreInvoiceByJobId(jobId) {
  try {
    const invoicesQuery = query(collection(db, "invoices"), where("jobId", "==", jobId));
    const snapshot = await getDocs(invoicesQuery);
    if (snapshot.empty) return { invoice: null, error: null };
    return { invoice: normalizeFirestoreInvoice(snapshot.docs[0]), error: null };
  } catch (error) {
    return { invoice: null, error };
  }
}

export async function createFirestoreInvoice(invoice) {
  try {
    const existing = await getFirestoreInvoiceByJobId(invoice.jobId);
    if (existing.error) throw existing.error;
    if (existing.invoice) return { invoice: existing.invoice, alreadyExists: true, error: null };

    const payload = serializeInvoice(invoice);
    const ref = await addDoc(collection(db, "invoices"), payload);
    return {
      invoice: normalizeInvoiceData(ref.id, payload),
      alreadyExists: false,
      error: null,
    };
  } catch (error) {
    return { invoice: null, alreadyExists: false, error };
  }
}

export async function createFirestoreInvoiceAndMarkJob({ invoice, jobId }) {
  try {
    if (!jobId) throw new Error("Cannot submit an invoice without a job ID.");
    const existing = await getFirestoreInvoiceByJobId(invoice.jobId);
    if (existing.error) throw existing.error;
    if (existing.invoice) return { invoice: existing.invoice, alreadyExists: true, error: null };

    const payload = serializeInvoice(invoice);
    const invoiceRef = doc(collection(db, "invoices"));
    const batch = writeBatch(db);
    batch.set(invoiceRef, payload);
    batch.update(doc(db, "jobs", jobId), { status: "Invoiced" });
    await batch.commit();

    return {
      invoice: normalizeInvoiceData(invoiceRef.id, payload),
      alreadyExists: false,
      error: null,
    };
  } catch (error) {
    return { invoice: null, alreadyExists: false, error };
  }
}

export async function updateFirestoreInvoice(invoiceId, updates) {
  try {
    if (!invoiceId) throw new Error("Cannot update an invoice without an invoice ID.");
    const payload = { ...updates };
    if (Object.prototype.hasOwnProperty.call(payload, "status")) {
      payload.status = normalizeInvoiceStatus(payload.status);
    }
    await updateDoc(doc(db, "invoices", invoiceId), payload);
    return { error: null };
  } catch (error) {
    return { error };
  }
}

export async function updateFirestoreInvoiceAndJob(invoiceId, invoiceUpdates, jobId, jobUpdates) {
  try {
    if (!invoiceId) throw new Error("Cannot update an invoice without an invoice ID.");
    if (!jobId) throw new Error("Cannot update the linked job without a job ID.");
    const payload = { ...invoiceUpdates };
    if (Object.prototype.hasOwnProperty.call(payload, "status")) {
      payload.status = normalizeInvoiceStatus(payload.status);
    }

    const batch = writeBatch(db);
    batch.update(doc(db, "invoices", invoiceId), payload);
    batch.update(doc(db, "jobs", jobId), jobUpdates);
    await batch.commit();
    return { error: null };
  } catch (error) {
    return { error };
  }
}

export async function loadFirestoreInvoices() {
  try {
    const snapshot = await getDocs(collection(db, "invoices"));
    const invoices = snapshot.docs
      .map(normalizeFirestoreInvoice)
      .sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime());

    return { invoices, error: null };
  } catch (error) {
    return { invoices: [], error };
  }
}
