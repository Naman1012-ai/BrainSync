import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { orgService } from '../../services/orgService';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { LogIn } from 'lucide-react';

export function JoinOrgForm({ initialCode = '', onSuccess = null }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [inviteCode, setInviteCode] = useState(initialCode);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanCode = inviteCode.trim().toUpperCase();
    if (!cleanCode || cleanCode.length !== 8) {
      const msg = 'Please enter a valid 8-character invite code.';
      setError(msg);
      toast.warning(msg);
      return;
    }

    setIsSubmitting(true);

    try {
      const orgId = await orgService.joinOrganization(user.uid, cleanCode);
      toast.success('Joined workspace successfully!');
      if (onSuccess) {
        onSuccess(orgId);
      } else {
        navigate(`/workspaces/${orgId}/ideas`);
      }
    } catch (err) {
      const msg = err.message || 'Failed to join organization.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 font-medium">
          {error}
        </div>
      )}

      <Input
        label="Invite Code"
        placeholder="e.g., BX7K9M2P"
        value={inviteCode}
        onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
        maxLength={8}
        className="font-mono uppercase tracking-widest text-center text-lg"
        required
      />

      <Button
        type="submit"
        variant="secondary"
        fullWidth
        isLoading={isSubmitting}
        icon={<LogIn className="h-4 w-4" />}
      >
        Join Workspace
      </Button>
    </form>
  );
}

JoinOrgForm.propTypes = {
  initialCode: PropTypes.string,
  onSuccess: PropTypes.func,
};
