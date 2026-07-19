import React from 'react';
import { Outlet } from 'react-router-dom';
import { Zap } from 'lucide-react';

export function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-emerald-50 p-4 sm:p-6">
      {/* Branding Header */}
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-200">
          <Zap className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">BrainSync</h1>
        <p className="mt-1 text-sm text-slate-500 font-medium">From brainstorm to blueprint in minutes</p>
      </div>

      {/* Main Form Container */}
      <div className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xl shadow-slate-200/50">
        <Outlet />
      </div>

      <footer className="mt-8 text-xs text-slate-400">
        BrainSync Hackathon Collaboration Platform &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
