import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { usePlatformSettings } from '../../hooks/usePlatformSettings';
import { orgService } from '../../services/orgService';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Button } from '../../components/ui/Button';
import { validateOrgName } from '../../utils/validation';
import { Plus } from 'lucide-react';

export function CreateOrgForm({ onSuccess = null }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { canCreateWorkspace } = usePlatformSettings();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [hackathonName, setHackathonName] = useState('');
  const [hackathonDescription, setHackathonDescription] = useState('');
  const [teamSizeLimit, setTeamSizeLimit] = useState(5);
  const [hackathonDate, setHackathonDate] = useState('');
  const [hackathonLocation, setHackathonLocation] = useState('');

  const [error, setError] = useState('');
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    const check = canCreateWorkspace();
    if (!check.allowed) {
      setServerError(check.reason);
      toast.error(check.reason);
      return;
    }

    const val = validateOrgName(name);
    if (!val.valid) {
      setError(val.error);
      return;
    }

    if (teamSizeLimit < 2 || teamSizeLimit > 20) {
      setError('Team size limit must be between 2 and 20 members.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const newOrg = await orgService.createOrganization(user.uid, {
        name,
        hackathonName,
        hackathonDescription,
        teamSizeLimit,
        hackathonDate,
        hackathonLocation,
      });

      toast.success('Workspace created successfully!');

      if (onSuccess) {
        onSuccess(newOrg);
      } else {
        navigate(`/workspaces/${newOrg.orgId}/ideas`);
      }
    } catch (err) {
      const msg = err.message || 'Failed to create workspace.';
      setServerError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {serverError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 font-medium">
          {serverError}
        </div>
      )}

      <Input
        label="Organization Name"
        placeholder="e.g., Team Quantum"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={error}
        maxLength={100}
        required
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Hackathon Name"
          placeholder="e.g., Global AI Hackathon 2026"
          value={hackathonName}
          onChange={(e) => setHackathonName(e.target.value)}
        />

        <Input
          label="Team Size Limit (Max 20)"
          type="number"
          min={2}
          max={20}
          value={teamSizeLimit}
          onChange={(e) => setTeamSizeLimit(Number(e.target.value))}
          required
        />
      </div>

      <Textarea
        label="Hackathon Description"
        placeholder="Brief description of the challenge or theme..."
        value={hackathonDescription}
        onChange={(e) => setHackathonDescription(e.target.value)}
        rows={3}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Event Date"
          type="date"
          value={hackathonDate}
          onChange={(e) => setHackathonDate(e.target.value)}
        />

        <Input
          label="Location"
          placeholder="e.g., San Francisco / Hybrid"
          value={hackathonLocation}
          onChange={(e) => setHackathonLocation(e.target.value)}
        />
      </div>

      <Button
        type="submit"
        variant="primary"
        fullWidth
        isLoading={isSubmitting}
        icon={<Plus className="h-4 w-4" />}
        className="mt-4"
      >
        Create Workspace
      </Button>
    </form>
  );
}

CreateOrgForm.propTypes = {
  onSuccess: PropTypes.func,
};
