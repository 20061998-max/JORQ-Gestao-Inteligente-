import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  BOOTSTRAPPED_ADMIN_EMAIL,
  OperationType,
  handleFirestoreError,
} from '../firebase';
import type { Company, UserProfile } from '../types';

interface AuthContextValue {
  firebaseUser: User | null;
  userProfile: UserProfile | null;
  company: Company | null;
  isAdmin: boolean;
  authReady: boolean;
  emailVerified: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (name: string, email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
  createCompany: (payload: {
    name: string;
    tradeName?: string;
    document?: string;
    phone?: string;
    address?: string;
    sector?: string;
    monthlyGoal?: number;
  }) => Promise<Company>;
  refreshCompany: () => Promise<void>;
  getIdToken: () => Promise<string>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const LOCAL_USERS_STORAGE_KEY = 'jorq_local_users_v1';
const LOCAL_ACTIVE_UID_KEY = 'jorq_local_active_user_uid_v1';

interface LocalUserProfileRecord extends UserProfile {
  authProvider: string;
  lastLoginAt: string;
}

function readLocalUsersMap(): Record<string, LocalUserProfileRecord> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_USERS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, LocalUserProfileRecord>) : {};
  } catch {
    return {};
  }
}

function writeLocalUsersMap(map: Record<string, LocalUserProfileRecord>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_USERS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage quota errors
  }
}

function upsertLocalUserProfile(user: User, companyId?: string): LocalUserProfileRecord {
  const map = readLocalUsersMap();
  const existing = map[user.uid];
  const cleanName = (user.displayName || user.email?.split('@')[0] || existing?.name || 'Gestor JORQ').slice(0, 120);
  const provider = user.providerData?.[0]?.providerId || existing?.authProvider || 'google.com';
  const next: LocalUserProfileRecord = {
    uid: user.uid,
    name: cleanName.length >= 2 ? cleanName : 'Gestor JORQ',
    email: (user.email || existing?.email || '').slice(0, 200),
    role: 'client',
    status: existing?.status || 'active',
    companyId: companyId ?? existing?.companyId,
    authProvider: provider,
    lastLoginAt: new Date().toISOString(),
  };
  map[user.uid] = next;
  writeLocalUsersMap(map);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LOCAL_ACTIVE_UID_KEY, user.uid);
    } catch {
      // ignore storage quota errors
    }
  }
  return next;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  const loadUserAndCompany = useCallback(async (user: User | null) => {
    if (!user) {
      setUserProfile(null);
      setCompany(null);
      setIsAdmin(false);
      setAuthReady(true);
      return;
    }

    try {
      const isBootAdmin =
        user.emailVerified && user.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();

      let profileData: UserProfile | undefined;

      if (isBootAdmin) {
        // ONLY the platform owner's login is persisted in the real Firestore database
        const userRef = doc(db, 'users', user.uid);
        let profileSnap;
        try {
          profileSnap = await getDoc(userRef);
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
        }

        if (!profileSnap.exists()) {
          const cleanName = (user.displayName || user.email?.split('@')[0] || 'Josuel Roque').slice(0, 120);
          const newProfile = {
            uid: user.uid,
            name: cleanName.length >= 2 ? cleanName : 'Josuel Roque',
            email: (user.email || '').slice(0, 200),
            role: 'admin',
            status: 'active',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          try {
            await setDoc(userRef, newProfile);
            profileSnap = await getDoc(userRef);
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}`);
          }
        }
        profileData = profileSnap.data() as UserProfile | undefined;
      } else {
        // Client logins (Google OAuth and client sessions) are stored solely in localStorage
        profileData = upsertLocalUserProfile(user);
      }

      setUserProfile(profileData || null);

      // Check admin status securely
      let adminVerified = false;
      if (isBootAdmin) {
        adminVerified = true;
        try {
          const adminRef = doc(db, 'admins', user.uid);
          const adminSnap = await getDoc(adminRef);
          if (!adminSnap.exists()) {
            await setDoc(adminRef, {
              uid: user.uid,
              email: user.email || BOOTSTRAPPED_ADMIN_EMAIL,
              grantedAt: serverTimestamp(),
            });
          }
        } catch {
          // Ignore if already exists or pending
        }
      } else if (user.emailVerified && user.email?.toLowerCase() !== 'josuelroque786@gmail.com') {
        try {
          const adminSnap = await getDoc(doc(db, 'admins', user.uid));
          adminVerified = adminSnap.exists();
        } catch {
          adminVerified = false;
        }
      }
      setIsAdmin(adminVerified);

      // Load user's company if email is verified
      if (user.emailVerified) {
        try {
          const q = query(
            collection(db, 'companies'),
            where('ownerId', '==', user.uid),
            limit(1)
          );
          const compSnaps = await getDocs(q);
          if (!compSnaps.empty) {
            const first = compSnaps.docs[0];
            const compObj = { id: first.id, ...(first.data() as Omit<Company, 'id'>) };
            setCompany(compObj);
            if (!isBootAdmin) {
              upsertLocalUserProfile(user, compObj.id);
            }
          } else {
            setCompany(null);
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.LIST, 'companies');
        }
      } else {
        setCompany(null);
      }
    } finally {
      setAuthReady(true);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      loadUserAndCompany(user);
    });
    return () => unsub();
  }, [loadUserAndCompany]);

  // Keep client company status & Cliente Teste trial synced in real time without page reload
  useEffect(() => {
    if (!firebaseUser || !firebaseUser.emailVerified) return;
    const q = query(
      collection(db, 'companies'),
      where('ownerId', '==', firebaseUser.uid),
      limit(1)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        if (!snap.empty) {
          const first = snap.docs[0];
          setCompany({ id: first.id, ...(first.data() as Omit<Company, 'id'>) });
        } else {
          setCompany(null);
        }
      },
      () => {
        // ignore transient listener error; initial load handles primary read
      }
    );
    return () => unsub();
  }, [firebaseUser?.uid, firebaseUser?.emailVerified]);

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const signInWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  };

  const registerWithEmail = async (name: string, email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await updateProfile(cred.user, { displayName: name.trim().slice(0, 120) });
    await sendEmailVerification(cred.user);
    await loadUserAndCompany(cred.user);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  };

  const resendVerification = async () => {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
    }
  };

  const refreshSession = async () => {
    if (auth.currentUser) {
      await auth.currentUser.reload();
      setFirebaseUser({ ...auth.currentUser } as User);
      await loadUserAndCompany(auth.currentUser);
    }
  };

  const logout = async () => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(LOCAL_ACTIVE_UID_KEY);
      } catch {
        // ignore storage errors
      }
    }
    await signOut(auth);
  };

  const refreshCompany = async () => {
    if (auth.currentUser) {
      await loadUserAndCompany(auth.currentUser);
    }
  };

  const createCompany: AuthContextValue['createCompany'] = async (payload) => {
    if (!auth.currentUser) {
      throw new Error('Usuário não autenticado.');
    }
    const uid = auth.currentUser.uid;
    const companyId = `comp_${uid.slice(0, 12)}_${Date.now()}`;
    const cleanData: Record<string, unknown> = {
      ownerId: uid,
      name: payload.name.trim().slice(0, 140),
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (payload.tradeName?.trim()) cleanData.tradeName = payload.tradeName.trim().slice(0, 140);
    if (payload.document?.trim()) cleanData.document = payload.document.trim().slice(0, 32);
    if (payload.phone?.trim()) cleanData.phone = payload.phone.trim().slice(0, 32);
    if (payload.address?.trim()) cleanData.address = payload.address.trim().slice(0, 240);
    if (payload.sector?.trim()) cleanData.sector = payload.sector.trim().slice(0, 80);

    try {
      await setDoc(doc(db, 'companies', companyId), cleanData);
      await setDoc(doc(db, 'company_members', `${companyId}_${uid}`), {
        companyId,
        userId: uid,
        email: (auth.currentUser.email || '').slice(0, 200),
        name: (userProfile?.name || auth.currentUser.displayName || 'Proprietário').slice(0, 120),
        role: 'owner',
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      if (typeof payload.monthlyGoal === 'number' && payload.monthlyGoal >= 0) {
        await setDoc(doc(db, 'company_goals', companyId), {
          companyId,
          userId: uid,
          monthlyGoal: payload.monthlyGoal,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      const isOwnerAccount =
        Boolean(auth.currentUser.emailVerified) &&
        auth.currentUser.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();
      if (isOwnerAccount) {
        await updateDoc(doc(db, 'users', uid), {
          companyId,
          updatedAt: serverTimestamp(),
        });
      } else {
        const updatedLocal = upsertLocalUserProfile(auth.currentUser, companyId);
        setUserProfile(updatedLocal);
      }
      const snap = await getDoc(doc(db, 'companies', companyId));
      const created = { id: snap.id, ...(snap.data() as Omit<Company, 'id'>) };
      setCompany(created);
      return created;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `companies/${companyId}`);
    }
  };

  const getIdToken = async () => {
    if (!auth.currentUser) throw new Error('Sessão não autenticada.');
    return auth.currentUser.getIdToken();
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        userProfile,
        company,
        isAdmin,
        authReady,
        emailVerified: Boolean(firebaseUser?.emailVerified),
        signInWithGoogle,
        signInWithEmail,
        registerWithEmail,
        resetPassword,
        resendVerification,
        refreshSession,
        logout,
        createCompany,
        refreshCompany,
        getIdToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser utilizado dentro de AuthProvider.');
  return ctx;
}
