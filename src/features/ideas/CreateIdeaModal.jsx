import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Modal } from '../../components/ui/Modal';
import { IdeaForm } from './IdeaForm';
import { useIdeas } from '../../hooks/useIdeas';
import { useToast } from '../../hooks/useToast';

export function CreateIdeaModal({ isOpen, onClose, onSuccess = () => {} }) {
  const { createIdea } = useIdeas();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  const handleSubmit = async (formData) => {
    setServerError('');
    setIsSubmitting(true);

    try {
      await createIdea(formData);
      toast.success('Idea published successfully!');
      onSuccess('Idea published successfully!');
      onClose();
    } catch (err) {
      const msg = err.message || 'Failed to publish idea.';
      setServerError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Propose an Idea" size="lg">
      {serverError && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 font-medium">
          {serverError}
        </div>
      )}
      <IdeaForm onSubmit={handleSubmit} isSubmitting={isSubmitting} onCancel={onClose} />
    </Modal>
  );
}

CreateIdeaModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func,
};
