import React, { useState } from 'react';
import { Layers, Eye, EyeOff, Copy, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useVMStore } from '../../store/vmStore';

interface BulkResult {
  vmId: string;
  vmName: string;
  success: boolean;
  error?: string;
}

interface EnvironmentBulkUpdateProps {
  onUpdate: (envId: string, password: string, testConnection: boolean) => Promise<{ results: BulkResult[]; successCount: number; failCount: number }>;
}

export function EnvironmentBulkUpdate({ onUpdate }: EnvironmentBulkUpdateProps) {
  const vmGroups = useVMStore(state => state.vmGroups);
  
  const [envBulkEnvId, setEnvBulkEnvId] = useState<string>('');
  const [envBulkPassword, setEnvBulkPassword] = useState('');
  const [envBulkPreviewPassword, setEnvBulkPreviewPassword] = useState<string | null>(null);
  const [envBulkUpdating, setEnvBulkUpdating] = useState(false);
  const [envBulkResults, setEnvBulkResults] = useState<BulkResult[] | null>(null);
  const [envBulkTestConnection, setEnvBulkTestConnection] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const selectedEnvGroup = vmGroups.find(g => g.environmentId === envBulkEnvId);
  const selectedEnvVMCount = selectedEnvGroup?.vms.length || 0;

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#%^*_+=[]{}:.<>?~';
    let password = '';
    const array = new Uint32Array(16);
    window.crypto.getRandomValues(array);
    for (let i = 0; i < 16; i++) {
      password += chars[array[i] % chars.length];
    }
    setEnvBulkPreviewPassword(password);
    setEnvBulkPassword(password);
  };

  const handleEnvBulkUpdate = async () => {
    if (!envBulkEnvId) {
      alert('Please select an environment');
      return;
    }
    
    if (!envBulkPassword || envBulkPassword.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }
    
    if (!confirm(`This will change the password for all ${selectedEnvVMCount} VMs in ${selectedEnvGroup?.environmentName}. Continue?`)) {
      return;
    }
    
    setEnvBulkUpdating(true);
    setEnvBulkResults(null);
    
    try {
      const result = await onUpdate(envBulkEnvId, envBulkPassword, envBulkTestConnection);
      setEnvBulkResults(result.results);
      setEnvBulkPassword('');
      setEnvBulkPreviewPassword(null);
      alert(`Environment update complete: ${result.successCount} succeeded, ${result.failCount} failed`);
    } catch {
      alert('Failed to update passwords');
    } finally {
      setEnvBulkUpdating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Layers size={18} className="text-cyan-400" />
        <h3 className="text-sm font-semibold text-zinc-300">Change Password by Environment</h3>
      </div>
      
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Select Environment</label>
          <select
            value={envBulkEnvId}
            onChange={(e) => {
              setEnvBulkEnvId(e.target.value);
              setEnvBulkResults(null);
            }}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="">-- Select Environment --</option>
            {vmGroups.map(group => (
              <option key={group.environmentId} value={group.environmentId}>
                {group.environmentName} ({group.vmCount} VMs)
              </option>
            ))}
          </select>
        </div>

        {envBulkEnvId && selectedEnvGroup && (
          <>
            <div className="bg-cyan-500/10 border border-cyan-500/20 rounded p-3 text-xs text-cyan-400">
              This will change the password on {selectedEnvVMCount} VMs in "{selectedEnvGroup.environmentName}" via SSH.
            </div>
            
            <div>
              <label className="block text-xs text-zinc-500 mb-1">New Password for Environment VMs</label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={envBulkPassword}
                    onChange={(e) => setEnvBulkPassword(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 pr-10"
                    placeholder="Enter password for environment VMs"
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

            {envBulkPreviewPassword && (
              <div className="bg-zinc-800/50 border border-zinc-700 rounded p-3">
                <div className="text-xs text-zinc-400 mb-1">Generated Password Preview:</div>
                <div className="flex items-center gap-2">
                  <code className="text-base font-mono text-zinc-200">{envBulkPreviewPassword}</code>
                  <button
                    onClick={() => copyToClipboard(envBulkPreviewPassword)}
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
                checked={envBulkTestConnection}
                onChange={(e) => setEnvBulkTestConnection(e.target.checked)}
                className="rounded border-zinc-700"
              />
              Test connection before updating
            </label>

            <button
              onClick={handleEnvBulkUpdate}
              disabled={envBulkUpdating || !envBulkPassword || envBulkPassword.length < 6}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-zinc-800 disabled:text-zinc-500 rounded text-sm transition-colors"
            >
              {envBulkUpdating ? <Loader2 size={14} className="animate-spin" /> : <Layers size={14} />}
              Update {selectedEnvVMCount} VMs in {selectedEnvGroup.environmentName}
            </button>

            {envBulkResults && (
              <div className="bg-zinc-800/50 border border-zinc-700 rounded p-3 max-h-60 overflow-y-auto">
                <div className="text-xs text-zinc-400 mb-2">Results:</div>
                <div className="space-y-1">
                  {envBulkResults.map((result) => (
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
          </>
        )}
      </div>
    </div>
  );
}
