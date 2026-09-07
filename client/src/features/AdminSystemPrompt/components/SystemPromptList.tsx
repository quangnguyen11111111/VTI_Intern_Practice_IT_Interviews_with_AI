import React from 'react';
import type { SystemPrompt } from '../types';

interface SystemPromptListProps {
  prompts: SystemPrompt[];
  loading: boolean;
  onViewPrompt: (prompt: SystemPrompt) => void;
  onPublishPrompt: (id: string) => void;
  onRollbackPrompt: (id: string) => void;
}

export const SystemPromptList: React.FC<SystemPromptListProps> = ({
  prompts,
  loading,
  onViewPrompt,
  onPublishPrompt,
  onRollbackPrompt
}) => {
  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading prompts...</div>;
  }

  if (prompts.length === 0) {
    return <div className="text-center py-8 text-gray-500">No prompts found matching the criteria.</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200 text-gray-700">
            <th className="py-3 px-4 text-sm font-medium">Prompt Key</th>
            <th className="py-3 px-4 text-sm font-medium">Type</th>
            <th className="py-3 px-4 text-sm font-medium">Lang</th>
            <th className="py-3 px-4 text-sm font-medium">Version</th>
            <th className="py-3 px-4 text-sm font-medium">Status</th>
            <th className="py-3 px-4 text-sm font-medium">Updated At</th>
            <th className="py-3 px-4 text-sm font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {prompts.map((prompt) => (
            <tr key={prompt._id} className="hover:bg-gray-50 transition-colors">
              <td className="py-3 px-4 text-sm font-medium text-gray-900">{prompt.promptKey}</td>
              <td className="py-3 px-4 text-sm text-gray-600">{prompt.type}</td>
              <td className="py-3 px-4 text-sm text-gray-600">{prompt.language}</td>
              <td className="py-3 px-4 text-sm text-gray-600">v{prompt.version}</td>
              <td className="py-3 px-4 text-sm">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                  ${prompt.status === 'PUBLISHED' ? 'bg-green-100 text-green-800' : 
                    prompt.status === 'DRAFT' ? 'bg-yellow-100 text-yellow-800' : 
                    'bg-gray-100 text-gray-800'}`}
                >
                  {prompt.status}
                </span>
              </td>
              <td className="py-3 px-4 text-sm text-gray-500">
                {new Date(prompt.updatedAt).toLocaleDateString()}
              </td>
              <td className="py-3 px-4 text-sm">
                <div className="flex gap-2">
                  <button 
                    onClick={() => onViewPrompt(prompt)}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    View/Edit
                  </button>
                  {prompt.status === 'DRAFT' && (
                    <button 
                      onClick={() => onPublishPrompt(prompt._id)}
                      className="text-green-600 hover:text-green-800 font-medium"
                    >
                      Publish
                    </button>
                  )}
                  {prompt.status === 'PUBLISHED' && prompt.version > 1 && (
                    <button 
                      onClick={() => onRollbackPrompt(prompt._id)}
                      className="text-orange-600 hover:text-orange-800 font-medium"
                    >
                      Rollback
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
