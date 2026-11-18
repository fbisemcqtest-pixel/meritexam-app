import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  BOOTSTRAPPED_ADMIN_EMAILS,
  OperationType,
  auth,
  db,
  googleProvider,
  handleFirestoreError,
} from '../lib/firebase';
import {
  GradeLevel,
  MAX_IDENTIFIER_LENGTH,
  MAX_NAME_LENGTH,
  SubjectName,
  SystemSettings,
  UserAccount,
} from '../types';

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  resultMode: 'instant',
  testAccessMode: 'instant_open',
  allowStudentInstantPractice: true,
  allowTeacherPaperCreation: true,
  defaultTimeLimitMinutes: 15,
  passingPercentage: 50,
  updatedBy: '',
};

interface RegisterPayload {
  role: 'student' | 'teacher';
  fullName: string;
  grade: GradeLevel | 'All';
  subject: SubjectName | 'All';
  identifier: string;
}

interface AuthContextValue {
  authReady: boolean;
  firebaseUser: User | null;
  userProfile: UserAccount | null;
  profileLoaded: boolean;
  isAdmin: boolean;
  isMainAdmin: boolean;
  isPausedAdmin: boolean;
  systemSettings: SystemSettings;
  signInWithGoogle: () => Promise<User>;
  registerRoleAccount: (payload: RegisterPayload) => Promise<UserAccount>;
  ensureBootstrappedAdmin: (user: User) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserAccount | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [hasAdminDoc, setHasAdminDoc] = useState(false);
  const [adminDocStatus, setAdminDocStatus] = useState<'active' | 'paused' | null>(null);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(DEFAULT_SYSTEM_SETTINGS);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (!user) {
        setUserProfile(null);
        setHasAdminDoc(false);
        setAdminDocStatus(null);
        setProfileLoaded(true);
        setSystemSettings(DEFAULT_SYSTEM_SETTINGS);
      } else {
        setProfileLoaded(false);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !firebaseUser) {
      return;
    }

    const userPath = `users/${firebaseUser.uid}`;
    const unsubUser = onSnapshot(
      doc(db, 'users', firebaseUser.uid),
      (snap) => {
        if (snap.exists()) {
          setUserProfile(snap.data() as UserAccount);
        } else {
          setUserProfile(null);
        }
        setProfileLoaded(true);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, userPath);
      },
    );

    const adminPath = `admins/${firebaseUser.uid}`;
    const unsubAdmin = onSnapshot(
      doc(db, 'admins', firebaseUser.uid),
      (snap) => {
        if (snap.exists()) {
          setHasAdminDoc(true);
          const data = snap.data() as { status?: string };
          setAdminDocStatus(data.status === 'paused' ? 'paused' : 'active');
        } else {
          setHasAdminDoc(false);
          setAdminDocStatus(null);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, adminPath);
      },
    );

    const settingsPath = 'systemSettings/global';
    const unsubSettings = onSnapshot(
      doc(db, 'systemSettings', 'global'),
      (snap) => {
        if (snap.exists()) {
          setSystemSettings(snap.data() as SystemSettings);
        } else {
          setSystemSettings(DEFAULT_SYSTEM_SETTINGS);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, settingsPath);
      },
    );

    return () => {
      unsubUser();
      unsubAdmin();
      unsubSettings();
    };
  }, [authReady, firebaseUser]);

  const isMainAdmin =
    Boolean(firebaseUser?.emailVerified) &&
    Boolean(firebaseUser?.email && BOOTSTRAPPED_ADMIN_EMAILS.includes(firebaseUser.email.toLowerCase()));

  const isPausedAdmin = Boolean(
    !isMainAdmin &&
      (adminDocStatus === 'paused' ||
        (userProfile?.role === 'admin' && userProfile?.status === 'paused')),
  );

  const isAdmin = Boolean(
    isMainAdmin ||
      (hasAdminDoc && adminDocStatus !== 'paused' && userProfile?.status !== 'paused'),
  );

  async function signInWithGoogle(): Promise<User> {
    googleProvider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  }

  async function ensureBootstrappedAdmin(user: User): Promise<boolean> {
    const isSuperAdmin = Boolean(
      user.emailVerified &&
      user.email &&
      BOOTSTRAPPED_ADMIN_EMAILS.includes(user.email.toLowerCase()),
    );
    let adminRecordExists = false;
    let adminRecordPaused = false;
    try {
      const adminSnap = await getDoc(doc(db, 'admins', user.uid));
      adminRecordExists = adminSnap.exists();
      if (adminRecordExists) {
        const data = adminSnap.data() as { status?: string };
        adminRecordPaused = data.status === 'paused';
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `admins/${user.uid}`);
    }

    if (!isSuperAdmin && (!adminRecordExists || adminRecordPaused)) {
      return false;
    }

    if (!adminRecordExists && isSuperAdmin) {
      try {
        await setDoc(doc(db, 'admins', user.uid), {
          uid: user.uid,
          email: user.email ?? '',
          grantedBy: 'system_bootstrap',
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `admins/${user.uid}`);
      }
    }

    try {
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      if (!userSnap.exists()) {
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email ?? '',
          fullName: (user.displayName || 'System Administrator').trim().slice(0, MAX_NAME_LENGTH),
          role: 'admin',
          status: 'approved',
          grade: 'All',
          subject: 'All',
          identifier: 'ADMIN-01',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else if (isSuperAdmin) {
        const existingData = userSnap.data() as UserAccount;
        if (existingData.role !== 'admin' || existingData.status !== 'approved') {
          await updateDoc(doc(db, 'users', user.uid), {
            role: 'admin',
            status: 'approved',
            approvedBy: 'system_bootstrap',
            updatedAt: serverTimestamp(),
          });
        }
      } else {
        const existingData = userSnap.data() as UserAccount;
        if (existingData.status === 'paused') {
          return false;
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }

    try {
      const settingsSnap = await getDoc(doc(db, 'systemSettings', 'global'));
      if (!settingsSnap.exists()) {
        await setDoc(doc(db, 'systemSettings', 'global'), {
          resultMode: 'instant',
          testAccessMode: 'instant_open',
          allowStudentInstantPractice: true,
          allowTeacherPaperCreation: true,
          defaultTimeLimitMinutes: 15,
          passingPercentage: 50,
          updatedBy: user.uid,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'systemSettings/global');
    }

    return true;
  }

  async function registerRoleAccount(payload: RegisterPayload): Promise<UserAccount> {
    const user = auth.currentUser ?? (await signInWithGoogle());
    const userRef = doc(db, 'users', user.uid);
    let existingSnap;
    try {
      existingSnap = await getDoc(userRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    }

    if (existingSnap.exists()) {
      return existingSnap.data() as UserAccount;
    }

    const cleanName = payload.fullName.trim().slice(0, MAX_NAME_LENGTH);
    const cleanIdentifier = payload.identifier.trim().slice(0, MAX_IDENTIFIER_LENGTH);

    const newAccount: UserAccount = {
      uid: user.uid,
      email: user.email ?? '',
      fullName: cleanName.length >= 2 ? cleanName : (user.displayName || 'Applicant').slice(0, MAX_NAME_LENGTH),
      role: payload.role,
      status: 'pending',
      grade: payload.grade,
      subject: payload.subject,
      identifier: cleanIdentifier,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(userRef, newAccount);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}`);
    }

    return newAccount;
  }

  async function logout(): Promise<void> {
    await signOut(auth);
  }

  return (
    <AuthContext.Provider
      value={{
        authReady,
        firebaseUser,
        userProfile,
        profileLoaded,
        isAdmin,
        isMainAdmin,
        isPausedAdmin,
        systemSettings,
        signInWithGoogle,
        registerRoleAccount,
        ensureBootstrappedAdmin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
