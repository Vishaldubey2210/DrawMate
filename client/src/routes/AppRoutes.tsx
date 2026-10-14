import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { LandingPage } from '../pages/LandingPage.js';
import { LoginPage } from '../pages/auth/LoginPage.js';
import { RegisterPage } from '../pages/auth/RegisterPage.js';
import { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage.js';
import { ResetPasswordPage } from '../pages/auth/ResetPasswordPage.js';
import { VerifyEmailPage } from '../pages/auth/VerifyEmailPage.js';
import { OnboardingPage } from '../pages/onboarding/OnboardingPage.js';
import { AppLayout } from '../components/layout/AppLayout.js';
import { DashboardPage } from '../pages/dashboard/DashboardPage.js';
import { ProfilePage } from '../pages/profile/ProfilePage.js';
import { SettingsPage } from '../pages/settings/SettingsPage.js';
import { RoomsPage } from '../pages/rooms/RoomsPage.js';
import { RoomLobbyPage } from '../pages/rooms/RoomLobbyPage.js';
import { LeaderboardsPage } from '../pages/leaderboards/LeaderboardsPage.js';
import { FriendsPage } from '../pages/friends/FriendsPage.js';
import { WordPacksPage } from '../pages/wordpacks/WordPacksPage.js';
import { MatchHistoryPage } from '../pages/history/MatchHistoryPage.js';
import { NotFoundPage } from '../pages/NotFoundPage.js';
import { PracticePage } from '../pages/practice/PracticePage.js';
import { AdminDashboardPage } from '../pages/admin/AdminDashboardPage.js';
import { Paintbrush, Loader2 } from 'lucide-react';

const FullPageLoader: React.FC = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-[#0B0F19] text-slate-800 dark:text-slate-100">
    <div className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-xl shadow-indigo-600/30 mb-4 animate-pulse">
      <Paintbrush className="w-7 h-7" />
    </div>
    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
      <span>Loading DrawMate session...</span>
    </div>
  </div>
);

// Protected route wrapper
export const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <FullPageLoader />;
  }

  if (!isAuthenticated) {
    const redirectParam = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirectParam}`} replace />;
  }

  // If user hasn't verified their email, block access to app and force OTP verification
  if (user && !user.isEmailVerified && location.pathname !== '/verify-email') {
    return <Navigate to={`/verify-email?email=${encodeURIComponent(user.email)}`} replace />;
  }

  // If user hasn't completed onboarding and is attempting to enter dashboard
  if (user && !user.isOnboarded && location.pathname !== '/onboarding') {
    const redirectParam = location.pathname.startsWith('/rooms')
      ? `?redirect=${encodeURIComponent(location.pathname + location.search)}`
      : '';
    return <Navigate to={`/onboarding${redirectParam}`} replace />;
  }

  return children;
};

// Role-based route guard
export const RoleGuard: React.FC<{
  allowedRoles: ('admin' | 'moderator' | 'user')[];
  children: React.ReactElement;
}> = ({ allowedRoles, children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <FullPageLoader />;
  }

  if (!user || !allowedRoles.includes(user.role || 'user')) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// Public only route wrapper (e.g. login/register)
const PublicOnlyRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <FullPageLoader />;
  }

  if (isAuthenticated) {
    if (user && !user.isOnboarded) {
      return <Navigate to="/onboarding" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Pages */}
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnlyRoute>
            <RegisterPage />
          </PublicOnlyRoute>
        }
      />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />

      {/* Onboarding Wizard */}
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <OnboardingPage />
          </ProtectedRoute>
        }
      />

      {/* Protected App Layout */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/rooms" element={<RoomsPage />} />
        <Route path="/rooms/:roomCode" element={<RoomLobbyPage />} />
        <Route path="/leaderboards" element={<LeaderboardsPage />} />
        <Route path="/friends" element={<FriendsPage />} />
        <Route path="/word-packs" element={<WordPacksPage />} />
        <Route path="/history" element={<MatchHistoryPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/:username" element={<ProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route
          path="/admin"
          element={
            <RoleGuard allowedRoles={['admin', 'moderator']}>
              <AdminDashboardPage />
            </RoleGuard>
          }
        />
        <Route path="/practice" element={<PracticePage />} />
      </Route>

      {/* 404 Catch-All */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};
