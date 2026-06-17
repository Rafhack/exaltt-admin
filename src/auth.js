import { auth } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from "firebase/auth";

export { auth };

export async function signIn(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function signOut() {
  await firebaseSignOut(auth);
}

/**
 * Returns the current user's ID token (refreshed automatically by the SDK).
 * Attach this as `Authorization: Bearer <token>` on every API call.
 */
export async function getToken() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated.");
  return user.getIdToken();
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}
