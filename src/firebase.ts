import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider, getToken, type AppCheck } from 'firebase/app-check';
import { getDatabase } from 'firebase/database';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY;
let appCheckInstance: AppCheck | null = null;

// 로컬 개발 시 App Check 디버그 토큰 사용 (Firebase Console → App Check → 디버그 토큰 관리)
if (import.meta.env.DEV && import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG === 'true') {
  (globalThis as typeof globalThis & { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

if (appCheckSiteKey) {
  appCheckInstance = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
} else if (import.meta.env.PROD) {
  console.warn(
    '[Firebase] VITE_FIREBASE_APPCHECK_SITE_KEY가 없습니다. App Check가 적용된 Realtime Database 요청은 거부됩니다.'
  );
}

/** App Check 토큰이 준비될 때까지 대기 (Realtime Database 요청 전 호출) */
export async function ensureAppCheckReady(): Promise<void> {
  if (!appCheckInstance) return;
  await getToken(appCheckInstance, false);
}

// Initialize Realtime Database and Auth
export const db = getDatabase(app);
export const auth = getAuth(app);
export const firebaseDiagnostics = {
  databaseURL: firebaseConfig.databaseURL || '(missing database URL)',
  projectId: firebaseConfig.projectId || '(missing project ID)',
  appCheckConfigured: Boolean(appCheckSiteKey),
};
