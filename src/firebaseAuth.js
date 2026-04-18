import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { app } from "./firebase";

const firebaseAuth = getAuth(app);

export async function signIn(email, password) {
  try {
    const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
    return { user: credential.user, error: null };
  } catch (error) {
    return { user: null, error };
  }
}

export async function signOutUser() {
  try {
    await signOut(firebaseAuth);
    return { error: null };
  } catch (error) {
    return { error };
  }
}
