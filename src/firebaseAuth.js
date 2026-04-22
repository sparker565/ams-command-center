import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, updatePassword } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { app, db } from "./lib/firebase";

const firebaseAuth = getAuth(app);

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
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    return { profile: null, error: new Error("Missing authenticated email.") };
  }

  try {
    const usersQuery = query(collection(db, "users"), where("email", "==", normalizedEmail));
    const snapshot = await getDocs(usersQuery);
    if (snapshot.empty) {
      return { profile: null, error: null };
    }

    const userDoc = snapshot.docs[0];
    return {
      profile: {
        id: userDoc.id,
        ...userDoc.data(),
      },
      error: null,
    };
  } catch (error) {
    return { profile: null, error };
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
