import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Zap, ArrowLeft } from 'lucide-react';

export function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-emerald-50 p-4 sm:p-6 relative">
      {/* Top Left "Back to Home" Button */}
      <div className="w-full max-w-md mb-4 flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/90 border border-slate-200 text-xs font-bold text-slate-700 hover:text-indigo-600 hover:border-indigo-300 shadow-sm transition-all hover:-translate-x-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-label="Back to Home"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Home</span>
        </Link>
      </div>

      {/* Branding Header */}
      <Link to="/" className="mb-6 flex flex-col items-center text-center group focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-xl p-1">
        <div className="mb-2.5 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-200 group-hover:scale-105 transition-transform">
          <Zap className="h-6 w-6 fill-current" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">BrainSync</h1>
        <p className="mt-0.5 text-xs text-slate-500 font-medium">From brainstorm to blueprint in minutes</p>
      </Link>

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
