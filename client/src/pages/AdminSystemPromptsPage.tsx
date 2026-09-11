import React, { useEffect, useState } from 'react';
import { useSystemPrompts } from '../features/AdminSystemPrompt/hooks/useSystemPrompts';
import { usePromptMutations } from '../features/AdminSystemPrompt/hooks/usePromptMutations';
import { SystemPromptFilter } from '../features/AdminSystemPrompt/components/SystemPromptFilter';
import { SystemPromptList } from '../features/AdminSystemPrompt/components/SystemPromptList';
import { SystemPromptFormModal } from '../features/AdminSystemPrompt/components/SystemPromptFormModal';
import type { SystemPrompt, CreateSystemPromptDto, PromptType, PromptLanguage, PromptStatus } from '../features/AdminSystemPrompt/types';

const AdminSystemPromptsPage: React.FC = () => {
  const { prompts, loading, error: fetchError, fetchPrompts } = useSystemPrompts();
  const { createDraft, publishPrompt, rollbackPrompt, isMutating, error: mutationError } = usePromptMutations();

  const [filters, setFilters] = useState<{
    type?: PromptType | '';
    language?: PromptLanguage | '';
    status?: PromptStatus | '';
  }>({});

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<SystemPrompt | null>(null);

  useEffect(() => {
    fetchPrompts({
      type: filters.type || undefined,
      language: filters.language || undefined,
      status: filters.status || undefined,
    });
  }, [fetchPrompts, filters]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleOpenCreateModal = () => {
    setEditingPrompt(null);
    setIsModalOpen(true);
  };

  const handleViewPrompt = (prompt: SystemPrompt) => {
    setEditingPrompt(prompt);
    setIsModalOpen(true);
  };

  const getCleanFilters = () => {
    return {
      type: filters.type || undefined,
      language: filters.language || undefined,
      status: filters.status || undefined,
    };
  };

  const handlePublish = async (id: string) => {
    if (!window.confirm('Are you sure you want to publish this prompt version? It will become the active version.')) {
      return;
    }
    const result = await publishPrompt(id);
    if (result) {
      fetchPrompts(getCleanFilters());
    }
  };

  const handleRollback = async (id: string) => {
    if (!window.confirm('Are you sure you want to rollback to this previous version? A new draft will be created from it.')) {
      return;
    }
    const result = await rollbackPrompt(id);
    if (result) {
      fetchPrompts(getCleanFilters());
    }
  };

  const handleModalSubmit = async (data: CreateSystemPromptDto) => {
    const result = await createDraft(data);
    if (result) {
      setIsModalOpen(false);
      fetchPrompts(getCleanFilters());
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Prompts Management</h1>
          <p className="text-gray-500 mt-1 text-sm">Manage, version, and deploy AI instruction templates.</p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium text-sm transition-colors shadow-sm"
        >
          + New Prompt Draft
        </button>
      </div>

      {(fetchError || mutationError) && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-md">
          <p className="text-red-700 font-medium">Error: {fetchError || mutationError}</p>
        </div>
      )}

      <SystemPromptFilter filters={filters} onFilterChange={handleFilterChange} />

      <SystemPromptList
        prompts={prompts}
        loading={loading}
        onViewPrompt={handleViewPrompt}
        onPublishPrompt={handlePublish}
        onRollbackPrompt={handleRollback}
      />

      <SystemPromptFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleModalSubmit}
        initialData={editingPrompt}
        isSubmitting={isMutating}
      />
    </div>
  );
};

export default AdminSystemPromptsPage;
