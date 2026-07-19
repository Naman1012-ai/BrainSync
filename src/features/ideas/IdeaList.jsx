import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useOrg } from '../../hooks/useOrg';
import { useIdeas } from '../../hooks/useIdeas';
import { ideaService } from '../../services/ideaService';
import { blueprintService } from '../../services/blueprintService';
import { IdeaCard } from './IdeaCard';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { EmptyState } from '../../components/feedback/EmptyState';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import { EditIdeaModal } from './EditIdeaModal';
import { SelectMvpModal } from '../organizations/SelectMvpModal';
import { Lightbulb } from 'lucide-react';

export function IdeaList({ onToast = () => {}, onCreateClick = null }) {
  const { orgId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isLeader } = useOrg();
  const { filteredIdeas, loading, deleteIdea } = useIdeas();

  const [editingIdea, setEditingIdea] = useState(null);
  const [deletingIdea, setDeletingIdea] = useState(null);
  const [selectingMvpIdea, setSelectingMvpIdea] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmSelectMvp = async (targetIdeaId) => {
    if (!orgId || !targetIdeaId) return;
    try {
      await ideaService.updateIdeaStatus(orgId, targetIdeaId, 'Selected MVP');
      onToast('✓ Idea selected as the Workspace MVP.');
      setSelectingMvpIdea(null);
    } catch (err) {
      onToast(err.message || 'Unable to select MVP.');
      throw err;
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingIdea) return;
    setIsDeleting(true);
    try {
      const isMvp = Boolean(deletingIdea.isSelected);
      await deleteIdea(deletingIdea.ideaId, isMvp);
      onToast(isMvp ? '✓ Selected MVP and associated sprint specs deleted.' : '✓ Idea deleted successfully.');
      setDeletingIdea(null);
    } catch (err) {
      onToast(err.message || 'Unable to delete idea. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const isDeletingMvp = Boolean(deletingIdea?.isSelected);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredIdeas.map((idea) => (
          <IdeaCard
            key={idea.ideaId}
            idea={idea}
            onEdit={(target) => setEditingIdea(target)}
            onDelete={(target) => setDeletingIdea(target)}
            onSelectMvp={isLeader ? (target) => setSelectingMvpIdea(target) : null}
          />
        ))}
      </div>

      {/* Edit Idea Modal */}
      {editingIdea && (
        <EditIdeaModal
          isOpen={Boolean(editingIdea)}
          idea={editingIdea}
          onClose={() => setEditingIdea(null)}
          onSuccess={(msg) => onToast(msg)}
        />
      )}

      {/* Select MVP Confirmation Modal */}
      {selectingMvpIdea && (
        <SelectMvpModal
          isOpen={Boolean(selectingMvpIdea)}
          idea={selectingMvpIdea}
          onClose={() => setSelectingMvpIdea(null)}
          onConfirm={handleConfirmSelectMvp}
        />
      )}

      {/* Delete Idea Confirmation Modal */}
      <ConfirmDialog
        isOpen={Boolean(deletingIdea)}
        title={isDeletingMvp ? 'Delete Selected MVP Project?' : 'Delete Idea?'}
        description={
          isDeletingMvp
            ? `This idea is currently the selected MVP for this workspace. Deleting it will also delete its Blueprint, Tasks, and reset sprint progress. This action cannot be undone.`
            : `Are you sure you want to remove "${deletingIdea?.title}"? This action cannot be undone.`
        }
        confirmLabel={isDeletingMvp ? 'Delete Anyway' : 'Delete'}
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingIdea(null)}
      />
    </>
  );
}

IdeaList.propTypes = {
  onToast: PropTypes.func,
  onCreateClick: PropTypes.func,
};
