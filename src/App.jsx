import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { UserProvider } from './contexts/UserContext';
import { ToastProvider } from './contexts/ToastContext';
import { AuthLayout } from './layouts/AuthLayout';
import { AppLayout } from './layouts/AppLayout';
import { OrgLayout } from './layouts/OrgLayout';
import { AuthGuard } from './features/auth/AuthGuard';
import { PublicOnlyGuard } from './features/auth/PublicOnlyGuard';
import { Spinner } from './components/feedback/Spinner';
import { ErrorBoundary } from './components/feedback/ErrorBoundary';

// Route Code Splitting (Lazy Loading)
const SignUpPage = lazy(() => import('./pages/auth/SignUpPage'));
const SignInPage = lazy(() => import('./pages/auth/SignInPage'));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const ExploreIdeasPage = lazy(() => import('./pages/explore/ExploreIdeasPage'));
const WorkspacesPage = lazy(() => import('./pages/organization/WorkspacesPage'));
const ProfilePage = lazy(() => import('./pages/profile/ProfilePage'));
const OrgDashboardPage = lazy(() => import('./pages/organization/OrgDashboardPage'));
const IdeaBoardPage = lazy(() => import('./pages/organization/IdeaBoardPage'));
const IdeaDetailPage = lazy(() => import('./pages/organization/IdeaDetailPage'));
const BlueprintPage = lazy(() => import('./pages/organization/BlueprintPage'));
const TaskBoardPage = lazy(() => import('./pages/organization/TaskBoardPage'));
const ProgressDashboardPage = lazy(() => import('./pages/organization/ProgressDashboardPage'));
const MembersPage = lazy(() => import('./pages/organization/MembersPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const SettingsPage = lazy(() => import('./pages/organization/SettingsPage'));

export function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <UserProvider>
          <BrowserRouter>
          <Suspense
            fallback={
              <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
                <Spinner size="lg" />
              </div>
            }
          >
            <Routes>
              {/* Redirect root to dashboard */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              {/* Public-Only Auth Routes */}
              <Route element={<PublicOnlyGuard />}>
                <Route element={<AuthLayout />}>
                  <Route path="/signup" element={<SignUpPage />} />
                  <Route path="/signin" element={<SignInPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                </Route>
              </Route>

              {/* Authenticated Protected Routes */}
              <Route element={<AuthGuard />}>
                <Route element={<AppLayout />}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/explore" element={<ExploreIdeasPage />} />
                  <Route path="/workspaces" element={<WorkspacesPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                </Route>

                  {/* Organization/Workspace-Scoped Routes */}
                <Route path="/org/:orgId" element={<ErrorBoundary><OrgLayout /></ErrorBoundary>}>
                  <Route index element={<OrgDashboardPage />} />
                  <Route path="ideas" element={<IdeaBoardPage />} />
                  <Route path="ideas/:ideaId">
                    <Route index element={<IdeaDetailPage />} />
                    <Route path="blueprint" element={<BlueprintPage />} />
                    <Route path="tasks" element={<TaskBoardPage />} />
                    <Route path="dashboard" element={<ProgressDashboardPage />} />
                  </Route>
                  <Route path="members" element={<MembersPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                </Route>

                <Route path="/workspaces/:orgId" element={<ErrorBoundary><OrgLayout /></ErrorBoundary>}>
                  <Route index element={<OrgDashboardPage />} />
                  <Route path="ideas" element={<IdeaBoardPage />} />
                  <Route path="ideas/:ideaId">
                    <Route index element={<IdeaDetailPage />} />
                    <Route path="blueprint" element={<BlueprintPage />} />
                    <Route path="tasks" element={<TaskBoardPage />} />
                    <Route path="dashboard" element={<ProgressDashboardPage />} />
                  </Route>
                  <Route path="members" element={<MembersPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                </Route>
              </Route>

              {/* 404 Fallback */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </UserProvider>
    </AuthProvider>
  </ToastProvider>
  );
}

export default App;
