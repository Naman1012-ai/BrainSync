import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import {
  Zap,
  LogOut,
  User,
  Menu,
  Globe,
  Briefcase,
  LayoutDashboard,
  Flag,
} from 'lucide-react';
import { ReportIssueModal } from '../../features/reports/ReportIssueModal';

export function Navbar({ onMobileMenuToggle = () => {} }) {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.info('Signed out successfully.');
      navigate('/signin');
    } catch (err) {
      console.error('[Navbar] Sign out error:', err);
      toast.error('Failed to sign out.');
    }
  };

  const isCurrentPath = (path) => location.pathname === path;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between px-4 sm:px-8 max-w-7xl mx-auto">
        {/* Brand Logo & Mobile Toggle */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMobileMenuToggle}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 sm:hidden"
            aria-label="Toggle Navigation Menu"
          >
            <Menu className="h-6 w-6" />
          </button>

          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold shadow-md shadow-indigo-200">
              <Zap className="h-5 w-5 fill-current" />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-slate-900">
              Brain<span className="text-indigo-600">Sync</span>
            </span>
          </Link>
        </div>

        {/* Desktop Central Navigation Links */}
        {user && (
          <nav className="hidden md:flex items-center gap-1 font-medium text-sm">
            <Link
              to="/dashboard"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                isCurrentPath('/dashboard')
                  ? 'bg-indigo-50 text-indigo-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Dashboard</span>
            </Link>

            <Link
              to="/explore"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                isCurrentPath('/explore')
                  ? 'bg-indigo-50 text-indigo-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Globe className="h-4 w-4 text-indigo-500" />
              <span>Explore Ideas</span>
            </Link>

            <Link
              to="/workspaces"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                isCurrentPath('/workspaces')
                  ? 'bg-indigo-50 text-indigo-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Briefcase className="h-4 w-4 text-slate-500" />
              <span>Workspaces</span>
            </Link>
          </nav>
        )}

        {/* User Profile & Action Menu */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                className="flex items-center gap-2.5 rounded-full p-1 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                aria-label="User profile menu"
              >
                <Avatar name={user.displayName || user.email} size="sm" />
                <span className="hidden sm:inline-block text-sm font-semibold text-slate-700 max-w-[120px] truncate">
                  {user.displayName || user.email.split('@')[0]}
                </span>
              </button>

              {/* User Dropdown Menu */}
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl z-50">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {user.displayName || 'User'}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                  </div>

                  <Link
                    to="/profile"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    <User className="h-4 w-4 text-slate-400" />
                    <span>My Profile</span>
                  </Link>

                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setIsReportModalOpen(true);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-50 transition-colors"
                  >
                    <Flag className="h-4 w-4 text-purple-600" />
                    <span>Report Issue</span>
                  </button>

                  <div className="my-1 border-t border-slate-100" />

                  <button
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <LogOut className="h-4 w-4 text-rose-500" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/signin">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link to="/signup">
                <Button variant="primary" size="sm">
                  Get Started
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Global Report Issue Modal */}
      <ReportIssueModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
      />
    </header>
  );
}

Navbar.propTypes = {
  onMobileMenuToggle: PropTypes.func,
};
