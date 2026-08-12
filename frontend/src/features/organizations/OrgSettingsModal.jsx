import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useOrg } from '../../hooks/useOrg';
import { orgService } from '../../services/orgService';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Button } from '../../components/ui/Button';
import { validateOrgName } from '../../utils/validation';

export function OrgSettingsModal({ isOpen, onClose, onSuccess = () => {} }) {
  const { org } = useOrg();

  const [name, setName] = useState('');
  const [hackathonName, setHackathonName] = useState('');
  const [hackathonDescription, setHackathonDescription] = useState('');
  const [teamSizeLimit, setTeamSizeLimit] = useState(5);
  const [hackathonDate, setHackathonDate] = useState('');
  const [hackathonLocation, setHackathonLocation] = useState('');

  const [error, setError] = useState('');
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (org) {
      setName(org.name || '');
      setHackathonName(org.hackathonName || '');
      setHackathonDescription(org.hackathonDescription || '');
      setTeamSizeLimit(org.teamSizeLimit || 5);
      setHackathonDate(org.hackathonDate || '');
      setHackathonLocation(org.hackathonLocation || '');
    }
  }, [org, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

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
      await orgService.updateOrganization(org.orgId, {
        name: name.trim(),
        hackathonName: hackathonName.trim(),
        hackathonDescription: hackathonDescription.trim(),
        teamSizeLimit,
        hackathonDate,
        hackathonLocation: hackathonLocation.trim(),
      });

      onSuccess('Organization settings updated successfully!');
      onClose();
    } catch (err) {
      setServerError(err.message || 'Failed to update settings.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Organization Settings" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {serverError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 font-medium">
            {serverError}
          </div>
        )}

        <Input
          label="Organization Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={error}
          maxLength={100}
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Hackathon Name"
            value={hackathonName}
            onChange={(e) => setHackathonName(e.target.value)}
          />

          <Input
            label="Team Size Limit"
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
            value={hackathonLocation}
            onChange={(e) => setHackathonLocation(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            Save Settings
          </Button>
        </div>
      </form>
    </Modal>
  );
}

OrgSettingsModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func,
};
