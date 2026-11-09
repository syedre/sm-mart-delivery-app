import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { Database, getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const requiredConfig: Array<keyof typeof firebaseConfig> = [
  "apiKey",
  "authDomain",
  "databaseURL",
  "projectId",
  "appId",
];

export const isFirebaseConfigured = requiredConfig.every((key) =>
  Boolean(firebaseConfig[key])
);

let firebaseApp: FirebaseApp | null = null;
let realtimeDatabase: Database | null = null;

if (isFirebaseConfigured) {
  firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  realtimeDatabase = getDatabase(firebaseApp);
}

export { firebaseApp, realtimeDatabase };
