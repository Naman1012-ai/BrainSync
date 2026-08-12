import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { authService } from '../../services/authService';
import { dashboardService } from '../../services/dashboardService';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { AlertTriangle, Trash2, ShieldAlert } from 'lucide-react';

export function DeleteAccountModal({ isOpen, onClose }) {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isPasswordUser = Boolean(
    user?.providerData?.some((provider) => provider.providerId === 'password')
  );

  const handleClose = () => {
    if (isSubmitting) return;
    setPassword('');
    setError('');
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isPasswordUser) {
      if (!password || !password.trim()) {
        const msg = 'Current password is required.';
        setError(msg);
        return;
      }
      if (password.trim().length < 6) {
        const msg = 'Password must be at least 6 characters long.';
        setError(msg);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      await authService.deleteUserAccount(isPasswordUser ? password.trim() : null);

      toast.success('Your account has been permanently deleted.');

      if (user?.uid) {
        dashboardService.clearCachedDashboardData(user.uid);
      }

      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {
        console.warn('[DeleteAccountModal] Error clearing local storage:', e);
      }

      await signOut();
      handleClose();
      navigate('/');
    } catch (err) {
      console.error('[DeleteAccountModal] Deletion error:', err);
      const userMsg = err.message || 'The account could not be deleted. Please try again.';
      setError(userMsg);
      toast.error(userMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Delete Account Permanently" size="md">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Warning Banner */}
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs leading-relaxed space-y-2">
          <div className="flex items-center gap-2 font-extrabold text-rose-700 text-sm">
            <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
            <span>Warning: Permanent & Irreversible Action</span>
          </div>
          <p>
            Deleting your account will permanently remove your profile, workspace memberships, authored ideas, votes, comments, and settings. This action <strong>cannot be undone</strong>.
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-100 border border-rose-300 text-rose-800 text-xs font-bold flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isPasswordUser ? (
          <div className="space-y-2">
            <Input
              type="password"
              label="Current Password *"
              placeholder="Enter your current password to confirm deletion"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError('');
              }}
              disabled={isSubmitting}
              required
            />
            <p className="text-[11px] text-slate-500 font-medium">
              Please enter your password to verify your identity before proceeding.
            </p>
          </div>
        ) : (
          <p className="text-xs font-semibold text-slate-600">
            Please click <strong>Delete Account Permanently</strong> below to confirm permanent removal of your account.
          </p>
        )}

        {/* Action Controls */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-xs font-semibold"
          >
            Cancel
          </Button>

          <Button
            type="submit"
            variant="danger"
            isLoading={isSubmitting}
            disabled={isSubmitting}
            icon={<Trash2 className="h-4 w-4" />}
            className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-md shadow-rose-500/20"
          >
            {isSubmitting ? 'Deleting Account...' : 'Delete Account Permanently'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

DeleteAccountModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};
