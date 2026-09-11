import React from 'react';
import type { PromptType, PromptLanguage, PromptStatus } from '../types';

interface SystemPromptFilterProps {
  filters: {
    type?: PromptType | '';
    language?: PromptLanguage | '';
    status?: PromptStatus | '';
  };
  onFilterChange: (key: string, value: string) => void;
}

export const SystemPromptFilter: React.FC<SystemPromptFilterProps> = ({ filters, onFilterChange }) => {
  return (
    <div className="flex flex-wrap gap-4 mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
      <div className="flex flex-col">
        <label className="text-sm font-medium text-gray-700 mb-1">Type</label>
        <select
          value={filters.type || ''}
          onChange={(e) => onFilterChange('type', e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Types</option>
          <option value="GENERATION">GENERATION</option>
          <option value="EVALUATION">EVALUATION</option>
          <option value="LEARNING_PATH">LEARNING_PATH</option>
        </select>
      </div>

      <div className="flex flex-col">
        <label className="text-sm font-medium text-gray-700 mb-1">Language</label>
        <select
          value={filters.language || ''}
          onChange={(e) => onFilterChange('language', e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Languages</option>
          <option value="EN">EN</option>
          <option value="VI">VI</option>
        </select>
      </div>

      <div className="flex flex-col">
        <label className="text-sm font-medium text-gray-700 mb-1">Status</label>
        <select
          value={filters.status || ''}
          onChange={(e) => onFilterChange('status', e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">DRAFT</option>
          <option value="PUBLISHED">PUBLISHED</option>
          <option value="ARCHIVED">ARCHIVED</option>
        </select>
      </div>
    </div>
  );
};
