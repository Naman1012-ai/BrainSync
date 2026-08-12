import React from 'react';
import { Navigate, useSearchParams, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Spinner } from '../../components/feedback/Spinner';

/**
 * Route Guard for public-only pages (sign up, sign in, reset password).
 * Redirects authenticated users away to dashboard or returnUrl.
 */
export function PublicOnlyGuard({ children }) {
  const { user, loading } = useAuth();
  const [searchParams] = useSearchParams();

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
        <Spinner size="lg" />
      </div>
    );
  }

  if (user) {
    const returnUrl = searchParams.get('returnUrl');
    const target = returnUrl ? decodeURIComponent(returnUrl) : '/dashboard';
    return <Navigate to={target} replace />;
  }

  return children ? children : <Outlet />;
}
