import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../hooks/useToast';
import { Trophy, AlertTriangle, CheckCircle2 } from 'lucide-react';

export function SelectMvpModal({ isOpen, idea, onClose, onConfirm }) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!idea) return null;

  const handleConfirm = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      await onConfirm(idea.ideaId);
      toast.success('Winning MVP selected! Sprint Phase initiated.');
      onClose();
    } catch (err) {
      const msg = err.message || 'Failed to select MVP project.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Select Winning MVP Project" size="md">
      <div className="space-y-6">
        <div className="flex items-center gap-4 bg-amber-50 p-4 rounded-xl border border-amber-200">
          <div className="rounded-full bg-amber-500 p-3 text-white shrink-0">
            <Trophy className="h-6 w-6" />
          </div>
          <div>
            <h4 className="font-extrabold text-amber-900 text-base">Confirm Final Selection</h4>
            <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
              This will lock the Ideation Phase and generate the official Project Blueprint.
            </p>
          </div>
        </div>

        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Selected Proposal
          </span>
          <h3 className="text-lg font-bold text-slate-900 mt-1">{idea.title}</h3>
          <p className="text-sm text-slate-600 line-clamp-2 mt-1">{idea.problemStatement}</p>
        </div>

        {error && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-700 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        <div className="bg-slate-50 p-3.5 rounded-xl text-xs text-slate-600 space-y-1.5">
          <p className="font-semibold text-slate-800">What happens next?</p>
          <ul className="list-disc list-inside space-y-1 text-slate-500">
            <li>This idea becomes the <strong>Active Project</strong>.</li>
            <li>Other workspace proposals will be archived.</li>
            <li>All team members will be redirected to the Project Blueprint.</li>
          </ul>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            isLoading={isSubmitting}
            icon={<CheckCircle2 className="h-4 w-4" />}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Confirm & Generate Blueprint
          </Button>
        </div>
      </div>
    </Modal>
  );
}

SelectMvpModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  idea: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
};
