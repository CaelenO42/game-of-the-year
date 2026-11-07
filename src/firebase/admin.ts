import { initializeApp, cert } from "firebase-admin/app";
import { requireEnv } from "../env.js";
import { readFileSync } from "node:fs";
import { getAuth } from "firebase-admin/auth";

const firebaseKeyLoc = requireEnv("FIREBASE_SERVICE_ACCOUNT_PATH");
const firebaseKey = JSON.parse(readFileSync(firebaseKeyLoc, 'utf-8'));

initializeApp({
  credential: cert(firebaseKey)
});

export const adminAuth = getAuth();