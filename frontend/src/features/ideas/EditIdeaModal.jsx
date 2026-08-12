import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Modal } from '../../components/ui/Modal';
import { IdeaForm } from './IdeaForm';
import { useIdeas } from '../../hooks/useIdeas';

export function EditIdeaModal({ isOpen, idea, onClose, onSuccess = () => {} }) {
  const { updateIdea } = useIdeas();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  const handleSubmit = async (formData) => {
    if (!idea) return;
    setServerError('');
    setIsSubmitting(true);

    try {
      await updateIdea(idea.ideaId, formData);
      onSuccess('Idea updated successfully!');
      onClose();
    } catch (err) {
      setServerError(err.message || 'Failed to update idea.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Proposal" size="lg">
      {serverError && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 font-medium">
          {serverError}
        </div>
      )}
      <IdeaForm
        initialValues={idea}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        onCancel={onClose}
      />
    </Modal>
  );
}

EditIdeaModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  idea: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func,
};
