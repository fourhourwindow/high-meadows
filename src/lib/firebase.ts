import { initializeApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Populate via Netlify environment variables (VITE_ prefix required for
// Vite to expose them to client code).
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const auth = getAuth(app);

export const createBookingHold = httpsCallable(functions, "createBookingHold");
export const requestPackageChange = httpsCallable(functions, "requestPackageChange");
export const extendBookingHold = httpsCallable(functions, "extendBookingHold");
export const getRateSnapshot = httpsCallable(functions, "getRateSnapshot");
export const cancelBookingHold = httpsCallable(functions, "cancelBookingHold");
export const cancelConfirmedBooking = httpsCallable(functions, "cancelConfirmedBooking");
export const shrinkBookingDateRange = httpsCallable(functions, "shrinkBookingDateRange");
