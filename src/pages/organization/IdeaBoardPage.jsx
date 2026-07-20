import React, { useState } from 'react';
import { useOrg } from '../../hooks/useOrg';
import { usePlatformSettings } from '../../hooks/usePlatformSettings';
import { IdeaProvider, IdeaContext } from '../../contexts/IdeaContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Toast } from '../../components/feedback/Toast';
import { IdeaList } from '../../features/ideas/IdeaList';
import { CreateIdeaModal } from '../../features/ideas/CreateIdeaModal';
import { Plus, Search } from 'lucide-react';
import { ErrorBoundary } from '../../components/feedback/ErrorBoundary';

function IdeaBoardContent() {
  const { isFrozen } = useOrg();
  const { canCreateIdea } = usePlatformSettings();
  const ideaContext = React.useContext(IdeaContext);
  const { searchQuery, setSearchQuery, sortBy, setSortBy } = ideaContext;

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const handleOpenCreateModal = () => {
    const check = canCreateIdea();
    if (!check.allowed) {
      setToastMessage(`⚠️ ${check.reason}`);
      return;
    }
    setIsCreateModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Search, Filter & Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Input
            placeholder="Search ideas or tech stack..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider shrink-0">
            Sort By:
          </span>
          <Select
            options={[
              { value: 'most_voted', label: 'Most Voted' },
              { value: 'newest', label: 'Newest First' },
            ]}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-40 py-1 text-xs"
          />

          {!isFrozen && (
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              onClick={handleOpenCreateModal}
              className="shrink-0"
            >
              Propose Idea
            </Button>
          )}
        </div>
      </div>

      {/* Real-time Idea Cards Grid */}
      <IdeaList
        onToast={(msg) => setToastMessage(msg)}
        onCreateClick={!isFrozen ? () => setIsCreateModalOpen(true) : null}
      />

      {/* Create Idea Modal */}
      <CreateIdeaModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={(msg) => setToastMessage(msg)}
      />

      {/* Feedback Toast */}
      <Toast
        type="success"
        message={toastMessage}
        isOpen={Boolean(toastMessage)}
        onClose={() => setToastMessage('')}
      />
    </div>
  );
}

export default function IdeaBoardPage() {
  return (
    <ErrorBoundary>
      <IdeaProvider>
        <IdeaBoardContent />
      </IdeaProvider>
    </ErrorBoundary>
  );
}
