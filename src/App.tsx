import React, { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AdminDashboard } from './components/AdminDashboard';
import { PortalGateway } from './components/PortalGateway';
import { RoleAuthPortal } from './components/RoleAuthPortal';
import { StudentDashboard } from './components/StudentDashboard';
import { TeacherDashboard } from './components/TeacherDashboard';
import { getActiveEditionClass, getEditionLabel } from './config/appEdition';
import { UserRole } from './types';

function AppContent() {
  const { authReady, firebaseUser, userProfile, profileLoaded, isAdmin, ensureBootstrappedAdmin } =
    useAuth();
  const [selectedPortal, setSelectedPortal] = useState<UserRole | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const activeEdition = getActiveEditionClass();

  useEffect(() => {
    if (activeEdition === 'All') {
      document.title = 'MeritExam — Academic MCQ Examination Portal';
    } else {
      document.title = `MeritExam — ${getEditionLabel(activeEdition)} Examination Portal`;
    }
  }, [activeEdition]);

  useEffect(() => {
    if (firebaseUser && isAdmin && (selectedPortal === 'admin' || selectedPortal === null)) {
      void ensureBootstrappedAdmin(firebaseUser);
    }
  }, [firebaseUser, isAdmin, selectedPortal, ensureBootstrappedAdmin]);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-8 h-8 border-2 border-blue-700 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // If user already has an authenticated session on reload and hasn't picked a portal yet,
  // route approved users cleanly or show their verification portal.
  const effectivePortal: UserRole | null =
    selectedPortal ??
    (firebaseUser && profileLoaded
      ? isAdmin
        ? 'admin'
        : userProfile?.role ?? null
      : null);

  if (!effectivePortal) {
    return (
      <PortalGateway
        onSelectPortal={(role, mode = 'login') => {
          setSelectedPortal(role);
          setAuthMode(mode);
        }}
      />
    );
  }

  // Admin Portal route
  if (effectivePortal === 'admin') {
    if (firebaseUser && isAdmin) {
      return <AdminDashboard />;
    }
    return (
      <RoleAuthPortal
        portalRole="admin"
        initialMode="login"
        onBack={() => setSelectedPortal(null)}
        onSwitchPortal={(role) => {
          setSelectedPortal(role);
          setAuthMode('login');
        }}
      />
    );
  }

  // Teacher Portal route
  if (effectivePortal === 'teacher') {
    if (
      firebaseUser &&
      profileLoaded &&
      userProfile?.role === 'teacher' &&
      userProfile.status === 'approved'
    ) {
      return <TeacherDashboard />;
    }
    return (
      <RoleAuthPortal
        portalRole="teacher"
        initialMode={authMode}
        onBack={() => setSelectedPortal(null)}
        onSwitchPortal={(role) => {
          setSelectedPortal(role);
          setAuthMode('login');
        }}
      />
    );
  }

  // Student Portal route
  if (
    firebaseUser &&
    profileLoaded &&
    userProfile?.role === 'student' &&
    userProfile.status === 'approved'
  ) {
    return <StudentDashboard />;
  }

  return (
    <RoleAuthPortal
      portalRole="student"
      initialMode={authMode}
      onBack={() => setSelectedPortal(null)}
      onSwitchPortal={(role) => {
        setSelectedPortal(role);
        setAuthMode('login');
      }}
    />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
