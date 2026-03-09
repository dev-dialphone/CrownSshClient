import React, { useState } from 'react';
import { Layers, Eye, EyeOff, Copy, Loader2, CheckCircle, XCircle } from 'lucide-react';

interface BulkResult {
  vmId: string;
  vmName: string;
  success: boolean;
  error?: string;
}

interface BulkPasswordUpdateProps {
  allVMsCount: number;
  onBulkUpdate: (password: string, testConnection: boolean) => Promise<{ results: BulkResult[]; successCount: number; failCount: number }>;
}

export function BulkPasswordUpdate({ allVMsCount, onBulkUpdate }: BulkPasswordUpdateProps) {
  const [bulkPassword, setBulkPassword] = useState('');
  const [bulkPreviewPassword, setBulkPreviewPassword] = useState<string | null>(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkResults, setBulkResults] = useState<BulkResult[] | null>(null);
  const [bulkTestConnection, setBulkTestConnection] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#%^*_+=[]{}:.<>?~';
    let password = '';
    const array = new Uint32Array(16);
    window.crypto.getRandomValues(array);
    for (let i = 0; i < 16; i++) {
      password += chars[array[i] % chars.length];
    }
    setBulkPreviewPassword(password);
    setBulkPassword(password);
  };

  const handleBulkUpdate = async () => {
    if (!bulkPassword || bulkPassword.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }
    
    if (!confirm(`This will change the password for ALL ${allVMsCount} VMs. Continue?`)) {
      return;
    }
    
    setBulkUpdating(true);
    setBulkResults(null);
    
    try {
      const result = await onBulkUpdate(bulkPassword, bulkTestConnection);
      setBulkResults(result.results);
      setBulkPassword('');
      setBulkPreviewPassword(null);
      alert(`Bulk update complete: ${result.successCount} succeeded, ${result.failCount} failed`);
    } catch {
      alert('Failed to update passwords');
    } finally {
      setBulkUpdating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Layers size={18} className="text-purple-400" />
        <h3 className="text-sm font-semibold text-zinc-300">Change Password on All VMs</h3>
      </div>
      
      <div className="bg-purple-500/10 border border-purple-500/20 rounded p-3 text-xs text-purple-400">
        This will change the password on ALL {allVMsCount} VMs via SSH and update the database.
      </div>
      
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-zinc-500 mb-1">New Password for All VMs</label>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type={showPassword ? "text" : "password"}
                value={bulkPassword}
                onChange={(e) => setBulkPassword(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-purple-500 pr-10"
                placeholder="Enter password for all VMs"
              />
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <button
              onClick={generatePassword}
              className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-sm transition-colors whitespace-nowrap"
            >
              Generate
            </button>
          </div>
        </div>
        
        {bulkPreviewPassword && (
          <div className="bg-zinc-800/50 border border-zinc-700 rounded p-3">
            <div className="text-xs text-zinc-400 mb-1">Generated Password Preview:</div>
            <div className="flex items-center gap-2">
              <code className="text-base font-mono text-zinc-200">{bulkPreviewPassword}</code>
              <button
                onClick={() => copyToClipboard(bulkPreviewPassword)}
                className="p-1 text-zinc-400 hover:text-zinc-200"
              >
                <Copy size={14} />
              </button>
            </div>
          </div>
        )}
        
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={bulkTestConnection}
            onChange={(e) => setBulkTestConnection(e.target.checked)}
            className="rounded border-zinc-700"
          />
          Test connection before updating
        </label>
        
        <button
          onClick={handleBulkUpdate}
          disabled={bulkUpdating || !bulkPassword || bulkPassword.length < 6}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-800 disabled:text-zinc-500 rounded text-sm transition-colors"
        >
          {bulkUpdating ? <Loader2 size={14} className="animate-spin" /> : <Layers size={14} />}
          Update All {allVMsCount} VMs
        </button>
        
        {bulkResults && (
          <div className="bg-zinc-800/50 border border-zinc-700 rounded p-3 max-h-60 overflow-y-auto">
            <div className="text-xs text-zinc-400 mb-2">Results:</div>
            <div className="space-y-1">
              {bulkResults.map((result) => (
                <div key={result.vmId} className="flex items-center gap-2 text-xs">
                  {result.success ? (
                    <CheckCircle size={12} className="text-green-400" />
                  ) : (
                    <XCircle size={12} className="text-red-400" />
                  )}
                  <span className="text-zinc-200">{result.vmName}</span>
                  {!result.success && result.error && (
                    <span className="text-red-400">- {result.error}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
