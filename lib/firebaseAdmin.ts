import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { getStorage } from "firebase-admin/storage";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing env var: ${name}`);
  }

  return value;
}

function getOptionalFirebaseStorageBucket() {
  return (
    process.env.FIREBASE_STORAGE_BUCKET?.trim() ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() ||
    ""
  );
}

function getFirebaseAdminApp() {
  if (!getApps().length) {
    const serviceAccountBase64 = requireEnv(
      "FIREBASE_SERVICE_ACCOUNT_JSON_BASE64"
    );
    const serviceAccountJson = Buffer.from(
      serviceAccountBase64,
      "base64"
    ).toString("utf8");
    const serviceAccount = JSON.parse(serviceAccountJson) as {
      project_id: string;
      client_email: string;
      private_key: string;
    };

    const storageBucket = getOptionalFirebaseStorageBucket();

    initializeApp({
      credential: cert({
        projectId: serviceAccount.project_id,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key,
      }),
      ...(storageBucket ? { storageBucket } : {}),
    });
  }

  return getApps()[0];
}

export function getAdminAuth() {
  return getAuth(getFirebaseAdminApp());
}

export function getAdminDb() {
  return getFirestore(getFirebaseAdminApp());
}

export function getAdminMessaging() {
  return getMessaging(getFirebaseAdminApp());
}

export function getAdminStorageBucket() {
  const storageBucket = getOptionalFirebaseStorageBucket();

  if (!storageBucket) {
    throw new Error(
      "Missing Firebase Storage bucket. Add FIREBASE_STORAGE_BUCKET or NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET to .env.local."
    );
  }

  return getStorage(getFirebaseAdminApp()).bucket(storageBucket);
}