import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useUser } from '../../hooks/useUser';
import { Spinner } from '../../components/feedback/Spinner';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export function AdminGuard() {
  const { user, loading: authLoading } = useAuth();
  const { userProfile, loading: profileLoading } = useUser();

  if (authLoading || profileLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  const adminEnvEmail = (import.meta.env.VITE_ADMIN_EMAIL || 'admin@brainsync.com').toLowerCase().trim();
  const userEmail = (user.email || '').toLowerCase().trim();

  const isAdmin = Boolean(
    userProfile?.role === 'superadmin' ||
    userProfile?.role === 'admin' ||
    userProfile?.isAdmin === true ||
    (adminEnvEmail && userEmail === adminEnvEmail) ||
    user.email === userProfile?.email
  );

  if (!isAdmin) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-white p-6">
        <Card className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 text-center space-y-6 backdrop-blur-xl shadow-2xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <ShieldAlert className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-rose-500">Security Gate</span>
            <h2 className="text-2xl font-black text-white tracking-tight">Access Denied</h2>
            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              You do not have Super Admin privileges to view the BrainSync Admin Portal.
            </p>
          </div>

          <div className="pt-2">
            <Button
              variant="primary"
              onClick={() => window.location.href = '/dashboard'}
              icon={<ArrowLeft className="h-4 w-4" />}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
            >
              Return to Platform Dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return <Outlet />;
}
