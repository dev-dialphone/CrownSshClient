import React from 'react';
import { Download, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { PasswordHistoryEntry } from '../../hooks/password/usePasswordHistory';

interface PasswordHistoryProps {
  history: PasswordHistoryEntry[];
  loading: boolean;
  onExport: (format: 'csv' | 'json') => Promise<void>;
}

export function PasswordHistory({ history, loading, onExport }: PasswordHistoryProps) {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-300">Password Change History</h3>
        <div className="flex gap-2">
          <button
            onClick={() => onExport('csv')}
            className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs transition-colors"
          >
            <Download size={12} /> CSV
          </button>
          <button
            onClick={() => onExport('json')}
            className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs transition-colors"
          >
            <Download size={12} /> JSON
          </button>
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-zinc-500" size={20} />
        </div>
      ) : history.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-800">
                <th className="pb-2 pr-4">VM</th>
                <th className="pb-2 pr-4">IP</th>
                <th className="pb-2 pr-4">New Password</th>
                <th className="pb-2 pr-4">Type</th>
                <th className="pb-2 pr-4">By</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2">Time</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr key={entry.id} className="border-b border-zinc-800/50">
                  <td className="py-2 pr-4 text-zinc-200">{entry.vmName}</td>
                  <td className="py-2 pr-4 text-zinc-400">{entry.vmIp}</td>
                  <td className="py-2 pr-4 font-mono text-zinc-300">
                    {entry.success ? '••••••••' : '-'}
                  </td>
                  <td className="py-2 pr-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] ${
                      entry.operationType === 'auto' ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {entry.operationType}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-zinc-400">{entry.changedBy}</td>
                  <td className="py-2 pr-4">
                    {entry.success ? (
                      <CheckCircle size={12} className="text-green-400" />
                    ) : (
                      <XCircle size={12} className="text-red-400" />
                    )}
                  </td>
                  <td className="py-2 text-zinc-500">{formatDate(entry.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 text-zinc-600 text-sm">No password history yet</div>
      )}
    </div>
  );
}
