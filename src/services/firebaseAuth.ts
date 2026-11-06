/**
 * Firebase Client-Side Authentication Service with Google Drive scope.
 * Access token is cached strictly in memory as mandated by Google Workspace guidelines.
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';

// Import the auto-provisioned configuration
import firebaseConfig from '../../firebase-applet-config.json';

let config: any = firebaseConfig;
try { config = JSON.parse(localStorage.getItem('drivegenie_firebase_config') || 'null') || firebaseConfig; } catch {}
export const auth = config.apiKey && config.authDomain && config.projectId ? getAuth(!getApps().length ? initializeApp(config) : getApp()) : null;

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive');
// Force Google account chooser so any user can connect their own Google Drive
provider.setCustomParameters({
  prompt: 'select_account',
});

// In-memory access token cache (NEVER put in localStorage/sessionStorage)
let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;
let isSigningIn = false;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  if (!auth) { onAuthFailure?.(); return () => {}; }
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // Token not yet cached in current memory session
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    if (!auth) throw new Error('Google Drive is not configured. Open Connections and add your Firebase web configuration.');
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('No access token returned from Google sign-in credential');
    }
    cachedAccessToken = credential.accessToken;
    tokenExpiresAt = Date.now() + 55 * 60 * 1000;
    window.dispatchEvent(new Event('connections-changed'));
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Google sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken && Date.now() >= tokenExpiresAt) { cachedAccessToken = null; window.dispatchEvent(new Event('connections-changed')); }
  return cachedAccessToken;
};

export const setMemoryAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  tokenExpiresAt = Date.now() + 55 * 60 * 1000;
};

export const logout = async () => {
  if (auth) await signOut(auth);
  cachedAccessToken = null;
  window.dispatchEvent(new Event('connections-changed'));
};

export const switchAccount = async (): Promise<{ user: User; accessToken: string } | null> => {
  await logout();
  return googleSignIn();
};

export const getCurrentUser = (): User | null => {
  return auth?.currentUser || null;
};
