import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const OWNER_ADMIN_EMAIL = 'rinaldiharisma28@gmail.com';

export const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Standard Google Login Provider (no sensitive Sheets scope -> zero 403 unverified app block)
const loginProvider = new GoogleAuthProvider();
loginProvider.setCustomParameters({
  prompt: 'select_account',
});

// Optional Google Sheets OAuth Provider (used only if user enables direct OAuth Sheet write)
const sheetsProvider = new GoogleAuthProvider();
for (const scope of SCOPES) {
  sheetsProvider.addScope(scope);
}
sheetsProvider.setCustomParameters({
  prompt: 'consent',
});

let cachedAccessToken: string | null = null;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on boot (matches firebase-integration-rpc requirement)
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export type AccountRole = 'admin' | 'staff';

export interface AllowedAccountDoc {
  id: string;
  email: string;
  displayName: string;
  role: AccountRole;
  active: boolean;
  notes?: string;
  addedByUid: string;
  addedByEmail: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface WorkspaceSettingsDoc {
  spreadsheetId: string;
  scriptUrl: string;
  updatedByUid: string;
  updatedByEmail: string;
  updatedAt?: Timestamp | null;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emailToAccountId(email: string): string {
  return normalizeEmail(email).replace(/[^a-z0-9_-]/g, '_');
}

export function isValidEmailFormat(email: string): boolean {
  const clean = normalizeEmail(email);
  return (
    clean.length >= 5 &&
    clean.length <= 120 &&
    /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(clean)
  );
}

/**
 * Listen to persistent Firebase Auth state across reloads and PWA restarts.
 */
export const initAuth = (onUserChanged: (user: User | null) => void) => {
  return onAuthStateChanged(auth, (user) => {
    if (!user) {
      cachedAccessToken = null;
    }
    onUserChanged(user);
  });
};

/**
 * Standard Google Login for Gate Authentication (does not request sensitive Sheets API scope).
 */
export const signInWithGoogleGate = async (): Promise<User> => {
  const result = await signInWithPopup(auth, loginProvider);
  return result.user;
};

/**
 * Optional Google Login requesting Spreadsheets OAuth token (for direct OAuth write fallback).
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  const result = await signInWithPopup(auth, sheetsProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.accessToken) {
    throw new Error(
      'Gagal mendapatkan access token dari Google Auth. Silakan coba masuk kembali.'
    );
  }
  cachedAccessToken = credential.accessToken;
  return { user: result.user, accessToken: cachedAccessToken };
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

export type AuthorizationCheckResult =
  | {
      authorized: true;
      isOwner: boolean;
      account: AllowedAccountDoc;
    }
  | {
      authorized: false;
      reason: string;
      email: string;
    };

/**
 * Verify that the signed-in Google user is registered & active in Firestore (or Owner Admin).
 */
export async function verifyUserAuthorization(
  user: User
): Promise<AuthorizationCheckResult> {
  const cleanEmail = normalizeEmail(user.email || '');
  if (!cleanEmail || !user.emailVerified) {
    return {
      authorized: false,
      email: cleanEmail || '(Tanpa Email)',
      reason:
        'Alamat email Google Anda belum terverifikasi atau tidak tersedia. Gunakan akun Google yang valid.',
    };
  }

  const accountId = emailToAccountId(cleanEmail);
  const path = `allowed_accounts/${accountId}`;
  const docRef = doc(db, 'allowed_accounts', accountId);
  const isOwner = cleanEmail === OWNER_ADMIN_EMAIL;

  try {
    const snap = await getDocFromServer(docRef);

    if (isOwner) {
      if (!snap.exists()) {
        const displayName = (user.displayName || 'Rinaldy Harisma').trim().slice(0, 80);
        try {
          await setDoc(docRef, {
            email: cleanEmail,
            displayName,
            role: 'admin',
            active: true,
            notes: 'Owner & Admin Utama Serasa Salam',
            addedByUid: user.uid,
            addedByEmail: cleanEmail,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (createErr) {
          handleFirestoreError(createErr, OperationType.CREATE, path);
        }
        return {
          authorized: true,
          isOwner: true,
          account: {
            id: accountId,
            email: cleanEmail,
            displayName,
            role: 'admin',
            active: true,
            notes: 'Owner & Admin Utama Serasa Salam',
            addedByUid: user.uid,
            addedByEmail: cleanEmail,
          },
        };
      }

      const data = snap.data();
      return {
        authorized: true,
        isOwner: true,
        account: {
          id: accountId,
          email: cleanEmail,
          displayName: String(data.displayName || user.displayName || 'Owner'),
          role: 'admin',
          active: true,
          notes: data.notes ? String(data.notes) : undefined,
          addedByUid: String(data.addedByUid || user.uid),
          addedByEmail: String(data.addedByEmail || cleanEmail),
          createdAt: data.createdAt || null,
          updatedAt: data.updatedAt || null,
        },
      };
    }

    if (!snap.exists()) {
      return {
        authorized: false,
        email: cleanEmail,
        reason:
          'Akun Google ini belum terdaftar oleh Admin Serasa Salam. Hanya akun yang sudah didaftarkan Admin yang dapat masuk ke sistem.',
      };
    }

    const data = snap.data();
    if (data.active !== true) {
      return {
        authorized: false,
        email: cleanEmail,
        reason:
          'Akses akun Google ini sedang dinonaktifkan oleh Admin. Hubungi Admin jika Anda memerlukan akses kembali.',
      };
    }

    return {
      authorized: true,
      isOwner: false,
      account: {
        id: accountId,
        email: String(data.email || cleanEmail),
        displayName: String(data.displayName || user.displayName || cleanEmail),
        role: data.role === 'admin' ? 'admin' : 'staff',
        active: true,
        notes: data.notes ? String(data.notes) : undefined,
        addedByUid: String(data.addedByUid || ''),
        addedByEmail: String(data.addedByEmail || ''),
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null,
      },
    };
  } catch (err) {
    // If Owner encounters offline error, rethrow readable error; otherwise surface Firestore error details
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('permission-denied') || msg.includes('Missing or insufficient permissions')) {
      if (!isOwner) {
        return {
          authorized: false,
          email: cleanEmail,
          reason:
            'Akun Google ini belum terdaftar di sistem Serasa Salam. Silakan hubungi Admin untuk mendaftarkan email Anda.',
        };
      }
      handleFirestoreError(err, OperationType.GET, path);
    }
    throw err;
  }
}

/**
 * Subscribe to the registered Google accounts directory (Admin only).
 */
export function subscribeAllowedAccounts(
  onData: (accounts: AllowedAccountDoc[]) => void,
  onError: (message: string) => void
) {
  const q = query(collection(db, 'allowed_accounts'), orderBy('createdAt', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: AllowedAccountDoc[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          email: String(data.email || ''),
          displayName: String(data.displayName || ''),
          role: data.role === 'admin' ? 'admin' : 'staff',
          active: data.active === true,
          notes: data.notes ? String(data.notes) : undefined,
          addedByUid: String(data.addedByUid || ''),
          addedByEmail: String(data.addedByEmail || ''),
          createdAt: data.createdAt || null,
          updatedAt: data.updatedAt || null,
        };
      });
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'allowed_accounts');
      } catch (wrapped) {
        onError(
          wrapped instanceof Error
            ? wrapped.message
            : 'Gagal memuat daftar akun terdaftar.'
        );
      }
    }
  );
}

/**
 * Admin action: Register a new Google email into the allowlist.
 */
export async function registerAllowedAccount(
  adminUser: User,
  payload: {
    email: string;
    displayName: string;
    role: AccountRole;
    notes?: string;
  }
): Promise<void> {
  const cleanEmail = normalizeEmail(payload.email);
  if (!isValidEmailFormat(cleanEmail)) {
    throw new Error('Format alamat email Google tidak valid (contoh: nama@gmail.com).');
  }

  const cleanName = payload.displayName.trim().slice(0, 80);
  if (!cleanName) {
    throw new Error('Nama pengguna wajib diisi.');
  }

  const cleanNotes = (payload.notes || '').trim().slice(0, 200);
  const accountId = emailToAccountId(cleanEmail);
  const path = `allowed_accounts/${accountId}`;
  const docRef = doc(db, 'allowed_accounts', accountId);

  try {
    const existingSnap = await getDocFromServer(docRef);
    if (existingSnap.exists()) {
      throw new Error(`Akun Google "${cleanEmail}" sudah terdaftar dalam sistem.`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('sudah terdaftar')) throw err;
  }

  const adminEmail = normalizeEmail(adminUser.email || OWNER_ADMIN_EMAIL);

  const docPayload: Record<string, unknown> = {
    email: cleanEmail,
    displayName: cleanName,
    role: payload.role === 'admin' ? 'admin' : 'staff',
    active: true,
    addedByUid: adminUser.uid,
    addedByEmail: adminEmail,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (cleanNotes) {
    docPayload.notes = cleanNotes;
  }

  try {
    await setDoc(docRef, docPayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Admin action: Update displayName, role, active status, or notes on a registered account.
 */
export async function updateAllowedAccount(
  accountId: string,
  updates: {
    displayName?: string;
    role?: AccountRole;
    active?: boolean;
    notes?: string;
  }
): Promise<void> {
  const path = `allowed_accounts/${accountId}`;
  const docRef = doc(db, 'allowed_accounts', accountId);

  const patch: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (updates.displayName !== undefined) {
    const cleanName = updates.displayName.trim().slice(0, 80);
    if (!cleanName) throw new Error('Nama pengguna tidak boleh kosong.');
    patch.displayName = cleanName;
  }
  if (updates.role !== undefined) {
    patch.role = updates.role === 'admin' ? 'admin' : 'staff';
  }
  if (updates.active !== undefined) {
    patch.active = Boolean(updates.active);
  }
  if (updates.notes !== undefined) {
    patch.notes = updates.notes.trim().slice(0, 200);
  }

  try {
    await updateDoc(docRef, patch);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Admin action: Delete a registered account from the allowlist (primary Owner cannot be deleted).
 */
export async function removeAllowedAccount(accountId: string): Promise<void> {
  if (accountId === emailToAccountId(OWNER_ADMIN_EMAIL)) {
    throw new Error('Akun Owner Utama tidak dapat dihapus dari sistem.');
  }
  const path = `allowed_accounts/${accountId}`;
  try {
    await deleteDoc(doc(db, 'allowed_accounts', accountId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Shared Workspace Settings (Spreadsheet ID & Apps Script URL synced across authorized devices).
 */
export async function fetchWorkspaceSettings(): Promise<WorkspaceSettingsDoc | null> {
  const path = 'app_settings/workspace';
  try {
    const snap = await getDocFromServer(doc(db, 'app_settings', 'workspace'));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      spreadsheetId: String(data.spreadsheetId || ''),
      scriptUrl: String(data.scriptUrl || ''),
      updatedByUid: String(data.updatedByUid || ''),
      updatedByEmail: String(data.updatedByEmail || ''),
      updatedAt: data.updatedAt || null,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('permission-denied') || msg.includes('Missing or insufficient permissions')) {
      handleFirestoreError(error, OperationType.GET, path);
    }
    return null;
  }
}

export async function saveWorkspaceSettings(
  adminUser: User,
  spreadsheetId: string,
  scriptUrl: string
): Promise<void> {
  const path = 'app_settings/workspace';
  const cleanSheetId = spreadsheetId.trim().slice(0, 128);
  if (cleanSheetId.length < 10) {
    throw new Error('ID Google Spreadsheet tidak valid.');
  }
  const cleanScript = scriptUrl.trim().slice(0, 300);
  const adminEmail = normalizeEmail(adminUser.email || OWNER_ADMIN_EMAIL);

  try {
    await setDoc(doc(db, 'app_settings', 'workspace'), {
      spreadsheetId: cleanSheetId,
      scriptUrl: cleanScript,
      updatedByUid: adminUser.uid,
      updatedByEmail: adminEmail,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
