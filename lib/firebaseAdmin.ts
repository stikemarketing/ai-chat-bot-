import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing env var: ${name}`);
  }

  return value;
}

function getFirebaseAdminApp() {
  if (!getApps().length) {
    const serviceAccountBase64 = requireEnv("FIREBASE_SERVICE_ACCOUNT_JSON_BASE64");
    const serviceAccountJson = Buffer.from(serviceAccountBase64, "base64").toString("utf8");
    const serviceAccount = JSON.parse(serviceAccountJson) as {
      project_id: string;
      client_email: string;
      private_key: string;
    };

    initializeApp({
      credential: cert({
        projectId: serviceAccount.project_id,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key,
      }),
    });
  }

  return getApps()[0];
}

export function getAdminDb() {
  return getFirestore(getFirebaseAdminApp());
}