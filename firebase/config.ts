// firebase/config.ts
import { getApp, getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCtm-vD0drZ2Ym78TYRiwfEvbLbGf4AoWU",
  authDomain: "ai-companion-mvp-f01e4.firebaseapp.com",
  projectId: "ai-companion-mvp-f01e4",
  storageBucket: "ai-companion-mvp-f01e4.firebasestorage.app",
  messagingSenderId: "927725018231",
  appId: "1:927725018231:web:54f227ba1f7c5b11aaba72",
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp);