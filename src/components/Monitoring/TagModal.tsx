import React, { useState } from 'react';
import { X, Plus, Loader } from 'lucide-react';
import { VMTag, TagRequest } from '../../types';

interface TagModalProps {
  vmId: string;
  vmName: string;
  currentTag: VMTag | null;
  onClose: () => void;
  onAddTag: (tagText: string) => Promise<void>;
  onRequestChange: (tagText: string, requestType: 'add' | 'remove') => Promise<void>;
}

export function TagModal({
  vmId,
  vmName,
  currentTag,
  onClose,
  onAddTag,
  onRequestChange,
}: TagModalProps) {
  const [tagInput, setTagInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddTag = async () => {
    if (!tagInput.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      await onAddTag(tagInput.trim());
      onClose();
    } catch (err) {
      setError('Failed to add tag');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestChange = async (requestType: 'add' | 'remove') => {
    if (!tagInput.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      await onRequestChange(tagInput.trim(), requestType);
      onClose();
    } catch (err) {
      setError('Failed to request tag change');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-zinc-100">
            {currentTag ? 'Request Tag Change' : 'Add Tag'}
          </h3>
          <button onClick={onClose}>
            <X size={16} className="text-zinc-500 hover:text-zinc-300" />
          </button>
        </div>

        <p className="text-xs text-zinc-400 mb-3">
          VM: {vmName}
        </p>

        {currentTag && (
          <div className="mb-3 p-2 bg-zinc-800 rounded text-xs">
            <span className="text-zinc-500">Your current tag:</span>
            <span className="ml-2 text-zinc-300">{currentTag.text}</span>
          </div>
        )}

        <input
          type="text"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          placeholder="Enter tag text..."
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
          maxLength={50}
        />

        {error && (
          <p className="text-xs text-red-400 mt-2">{error}</p>
        )}

        <div className="flex gap-2 mt-4">
          {currentTag ? (
            <>
              <button
                onClick={() => handleRequestChange('remove')}
                disabled={submitting || !tagInput.trim()}
                className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-zinc-700 disabled:text-zinc-500 rounded text-sm font-medium transition-colors"
              >
                Request Remove
              </button>
              <button
                onClick={() => handleRequestChange('add')}
                disabled={submitting || !tagInput.trim()}
                className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 rounded text-sm font-medium transition-colors"
              >
                Request Change
              </button>
            </>
          ) : (
            <button
              onClick={handleAddTag}
              disabled={submitting || !tagInput.trim()}
              className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 rounded text-sm font-medium transition-colors"
            >
              Add Tag
            </button>
          )}
          <button
            onClick={onClose}
            className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded text-sm font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
