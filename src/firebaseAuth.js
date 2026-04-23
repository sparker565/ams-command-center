import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, updatePassword } from "firebase/auth";
import { addDoc, collection, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { getApprovedAuthUserByEmail } from "./approvedAuthUsers";
import { app, db } from "./lib/firebase";

const firebaseAuth = getAuth(app);

function normalizeEmail(email = "") {
  return String(email).trim().toLowerCase();
}

export async function signIn(email, password) {
  try {
    const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
    return { user: credential.user, error: null };
  } catch (error) {
    return { user: null, error };
  }
}

export function subscribeToAuthState(callback) {
  return onAuthStateChanged(firebaseAuth, callback);
}

export async function loadFirestoreUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return { profile: null, error: new Error("Missing authenticated email.") };
  }

  try {
    const usersQuery = query(collection(db, "users"), where("email", "==", normalizedEmail));
    const snapshot = await getDocs(usersQuery);
    if (!snapshot.empty) {
      const userDoc = snapshot.docs[0];
      return {
        profile: {
          id: userDoc.id,
          ...userDoc.data(),
        },
        error: null,
      };
    }

    const allUsersSnapshot = await getDocs(collection(db, "users"));
    const matchedUserDoc =
      allUsersSnapshot.docs.find(
        (docSnapshot) => normalizeEmail(docSnapshot.data()?.email) === normalizedEmail
      ) || null;
    if (!matchedUserDoc) return { profile: null, error: null };

    return {
      profile: {
        id: matchedUserDoc.id,
        ...matchedUserDoc.data(),
      },
      error: null,
    };
  } catch (error) {
    return { profile: null, error };
  }
}

function buildApprovedProfilePayload({ authUser, approvedUser, existingProfile }) {
  const email = normalizeEmail(authUser?.email || approvedUser?.email || existingProfile?.email || "");
  const timestamp = new Date().toISOString();

  return {
    name: approvedUser?.name || existingProfile?.name || authUser?.displayName || email,
    email,
    role: approvedUser?.role || existingProfile?.role || "",
    displayRole: approvedUser?.role || existingProfile?.displayRole || "",
    companyName: approvedUser?.companyName || existingProfile?.companyName || "",
    company: approvedUser?.companyName || existingProfile?.company || "",
    status: "active",
    active: true,
    accessStatus: "Active",
    authStatus: "Active",
    portal: approvedUser?.defaultPortal || existingProfile?.portal || "",
    defaultPortal: approvedUser?.defaultPortal || existingProfile?.defaultPortal || "",
    firebaseUid: authUser?.uid || existingProfile?.firebaseUid || "",
    createdAt: existingProfile?.createdAt || timestamp,
    updatedAt: timestamp,
  };
}

export async function ensureFirestoreUserProfile(authUser) {
  const email = normalizeEmail(authUser?.email);
  if (!email) {
    return { profile: null, error: new Error("Authenticated Firebase user is missing an email address.") };
  }

  const approvedUser = getApprovedAuthUserByEmail(email);
  const existingResult = await loadFirestoreUserByEmail(email);
  if (existingResult.error) return existingResult;

  if (existingResult.profile) {
    if (!approvedUser) return existingResult;

    const payload = buildApprovedProfilePayload({
      authUser,
      approvedUser,
      existingProfile: existingResult.profile,
    });
    const result = await updateDocProfile(existingResult.profile.id, payload);
    return result.error ? { profile: null, error: result.error } : { profile: { ...existingResult.profile, ...payload }, error: null };
  }

  if (!approvedUser) {
    return { profile: null, error: null };
  }

  const payload = buildApprovedProfilePayload({ authUser, approvedUser });
  try {
    const ref = await addDoc(collection(db, "users"), payload);
    return {
      profile: {
        id: ref.id,
        ...payload,
      },
      error: null,
    };
  } catch (error) {
    return { profile: null, error };
  }
}

async function updateDocProfile(profileId, payload) {
  try {
    await updateDoc(doc(db, "users", profileId), payload);
    return { error: null };
  } catch (error) {
    return { error };
  }
}

export function getFirebaseErrorMessage(error) {
  const code = error?.code || "";

  if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
    return "Invalid email or password.";
  }
  if (code === "auth/network-request-failed" || code === "unavailable") {
    return "Network connection failed. Check your connection and try again.";
  }
  if (code === "permission-denied") {
    return "Permission denied loading your user profile. Confirm Firestore rules allow authenticated access to users.";
  }
  if (code === "auth/invalid-api-key" || code === "auth/app-not-authorized") {
    return "Firebase configuration is missing or invalid.";
  }
  if (code === "auth/requires-recent-login") {
    return "Please log out and log back in before changing your password.";
  }
  if (code === "auth/weak-password") {
    return "Password must be at least 6 characters.";
  }

  return error?.message || "Firebase sign-in failed. Please try again.";
}

export async function signOutUser() {
  try {
    await signOut(firebaseAuth);
    return { error: null };
  } catch (error) {
    return { error };
  }
}

export async function updateCurrentUserPassword(password) {
  try {
    if (!firebaseAuth.currentUser) throw new Error("No authenticated Firebase user is active.");
    await updatePassword(firebaseAuth.currentUser, password);
    return { error: null };
  } catch (error) {
    return { error };
  }
}
