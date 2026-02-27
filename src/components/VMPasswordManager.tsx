import React, { useState, useEffect } from 'react';
import { useVMStore } from '../store/vmStore';
import { 
  Key, 
  Play, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  Download, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Copy,
  Loader2
} from 'lucide-react';

interface RateLimitInfo {
  vmRemaining: number;
  adminRemaining: number;
}

interface PasswordHistoryEntry {
  id: string;
  vmId: string;
  vmName: string;
  vmIp: string;
  vmUsername: string;
  newPassword: string;
  operationType: 'manual' | 'auto';
  changedBy: string;
  success: boolean;
  errorMessage?: string;
  createdAt: string;
}

export default function VMPasswordManager() {
  const vms = useVMStore(state => state.vms);
  const fetchVMs = useVMStore(state => state.fetchVMs);
  
  const [selectedVmId, setSelectedVmId] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [connectionMessage, setConnectionMessage] = useState('');
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [manualRateLimit, setManualRateLimit] = useState<RateLimitInfo | null>(null);
  const [autoRateLimit, setAutoRateLimit] = useState<RateLimitInfo | null>(null);
  
  const [autoResetLength, setAutoResetLength] = useState(16);
  const [includeSpecialChars, setIncludeSpecialChars] = useState(true);
  const [autoResetting, setAutoResetting] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  
  const [history, setHistory] = useState<PasswordHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  useEffect(() => {
    fetchVMs();
    loadHistory();
  }, [fetchVMs]);
  
  useEffect(() => {
    if (selectedVmId) {
      loadRateLimitInfo();
    }
  }, [selectedVmId]);
  
  const selectedVM = vms.find(v => v.id === selectedVmId);
  
  const loadRateLimitInfo = async () => {
    try {
      const res = await fetch(`/api/vms/${selectedVmId}/password/rate-limit`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setManualRateLimit(data.manual);
        setAutoRateLimit(data.auto);
      }
    } catch (error) {
      console.error('Failed to load rate limit info:', error);
    }
  };
  
  const loadHistory = async (offset = 0) => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/vms/passwords/history?limit=50&offset=${offset}`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.data);
      }
    } catch {
      console.error('Failed to load history');
    } finally {
      setHistoryLoading(false);
    }
  };
  
  const testConnection = async () => {
    if (!selectedVmId) return;
    
    setTestingConnection(true);
    setConnectionStatus('idle');
    
    try {
      const res = await fetch(`/api/vms/${selectedVmId}/password/test`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      
      setConnectionStatus(data.success ? 'success' : 'error');
      setConnectionMessage(data.message);
    } catch {
      setConnectionStatus('error');
      setConnectionMessage('Failed to test connection');
    } finally {
      setTestingConnection(false);
    }
  };
  
  const generateRandomPassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const allChars = includeSpecialChars ? chars + special : chars;
    
    let password = '';
    const array = new Uint32Array(autoResetLength);
    window.crypto.getRandomValues(array);
    
    for (let i = 0; i < autoResetLength; i++) {
      password += allChars[array[i] % allChars.length];
    }
    
    setNewPassword(password);
    setConfirmPassword(password);
  };
  
  const handleManualUpdate = async (testFirst: boolean) => {
    if (!selectedVmId || !newPassword) return;
    if (newPassword !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    
    setUpdatingPassword(true);
    
    try {
      const res = await fetch(`/api/vms/${selectedVmId}/password/manual`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ newPassword, testConnection: testFirst })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        alert('Password updated successfully');
        setNewPassword('');
        setConfirmPassword('');
        fetchVMs();
        loadRateLimitInfo();
        loadHistory();
      } else {
        alert(data.message || data.error);
      }
    } catch {
      alert('Failed to update password');
    } finally {
      setUpdatingPassword(false);
    }
  };
  
  const handleAutoReset = async () => {
    if (!selectedVmId) return;
    
    if (!confirm('This will change the password on the VM directly. Make sure you have console access as backup. Continue?')) {
      return;
    }
    
    setAutoResetting(true);
    setGeneratedPassword(null);
    
    try {
      const res = await fetch(`/api/vms/${selectedVmId}/password/auto-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          length: autoResetLength, 
          includeSpecialChars,
          testBeforeChange: true 
        })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setGeneratedPassword(data.newPassword);
        fetchVMs();
        loadRateLimitInfo();
        loadHistory();
      } else {
        alert(data.message || data.error);
      }
    } catch {
      alert('Failed to reset password');
    } finally {
      setAutoResetting(false);
    }
  };
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };
  
  const exportHistory = async (format: 'csv' | 'json') => {
    try {
      const res = await fetch(`/api/vms/passwords/export?format=${format}`, {
        credentials: 'include'
      });
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `password-history.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      alert('Failed to export history');
    }
  };
  
  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <Key size={20} className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-200">VM Password Manager</h2>
            <p className="text-xs text-zinc-500">Manage and reset VM passwords securely</p>
          </div>
        </div>
      </div>
      
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <label className="block text-xs font-medium text-zinc-500 mb-2">Select VM</label>
        <select
          value={selectedVmId}
          onChange={(e) => {
            setSelectedVmId(e.target.value);
            setConnectionStatus('idle');
            setGeneratedPassword(null);
          }}
          className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
        >
          <option value="">-- Select a VM --</option>
          {vms.map(vm => (
            <option key={vm.id} value={vm.id}>{vm.name} ({vm.ip})</option>
          ))}
        </select>
      </div>
      
      {selectedVM && (
        <>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-300">Current Credentials</h3>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-zinc-500">Name:</span>
                <span className="text-zinc-200 ml-2">{selectedVM.name}</span>
              </div>
              <div>
                <span className="text-zinc-500">IP:</span>
                <span className="text-zinc-200 ml-2">{selectedVM.ip}</span>
              </div>
              <div>
                <span className="text-zinc-500">Username:</span>
                <span className="text-zinc-200 ml-2">{selectedVM.username}</span>
              </div>
              <div>
                <span className="text-zinc-500">Password:</span>
                <span className="text-zinc-200 ml-2 font-mono">
                  {showPassword ? (selectedVM.password || '••••••••') : '••••••••'}
                </span>
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="ml-2 text-zinc-500 hover:text-zinc-300"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={testConnection}
                disabled={testingConnection}
                className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-sm transition-colors"
              >
                {testingConnection ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                Test Connection
              </button>
              
              {connectionStatus !== 'idle' && (
                <div className={`flex items-center gap-2 text-sm ${
                  connectionStatus === 'success' ? 'text-green-400' : 'text-red-400'
                }`}>
                  {connectionStatus === 'success' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                  {connectionMessage}
                </div>
              )}
            </div>
            
            {manualRateLimit && (
              <div className="text-xs text-zinc-500 pt-2 border-t border-zinc-800">
                Rate limits: {manualRateLimit.vmRemaining}/5 manual changes per VM, {manualRateLimit.adminRemaining}/20 per admin (hourly)
              </div>
            )}
          </div>
          
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-300">Manual Password Update</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">New Password</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    placeholder="Enter new password"
                  />
                  <button
                    onClick={generateRandomPassword}
                    className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-sm transition-colors"
                  >
                    Generate
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  placeholder="Confirm new password"
                />
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => handleManualUpdate(true)}
                  disabled={updatingPassword || !newPassword || newPassword !== confirmPassword}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-800 disabled:text-zinc-500 rounded text-sm transition-colors"
                >
                  {updatingPassword ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  Test & Save
                </button>
                <button
                  onClick={() => handleManualUpdate(false)}
                  disabled={updatingPassword || !newPassword || newPassword !== confirmPassword}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800 disabled:text-zinc-500 rounded text-sm transition-colors"
                >
                  Save Without Test
                </button>
              </div>
            </div>
          </div>
          
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-zinc-300">Automatic Password Reset</h3>
              <AlertTriangle size={14} className="text-yellow-500" />
            </div>
            
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded p-3 text-xs text-yellow-400">
              Warning: This will change the password directly on the VM. Make sure you have console access as backup.
            </div>
            
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Password Length</label>
                <input
                  type="number"
                  value={autoResetLength}
                  onChange={(e) => setAutoResetLength(Math.max(8, Math.min(64, parseInt(e.target.value) || 16)))}
                  className="w-20 bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  min={8}
                  max={64}
                />
              </div>
              
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={includeSpecialChars}
                  onChange={(e) => setIncludeSpecialChars(e.target.checked)}
                  className="rounded border-zinc-700"
                />
                Include special characters
              </label>
            </div>
            
            <button
              onClick={handleAutoReset}
              disabled={autoResetting}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-zinc-800 disabled:text-zinc-500 rounded text-sm transition-colors"
            >
              {autoResetting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Reset Password
            </button>
            
            {generatedPassword && (
              <div className="bg-green-500/10 border border-green-500/20 rounded p-3">
                <div className="text-xs text-green-400 mb-1">New Password Generated:</div>
                <div className="flex items-center gap-2">
                  <code className="text-lg font-mono text-green-300">{generatedPassword}</code>
                  <button
                    onClick={() => copyToClipboard(generatedPassword)}
                    className="p-1 text-green-400 hover:text-green-300"
                  >
                    <Copy size={14} />
                  </button>
                </div>
                <div className="text-xs text-yellow-400 mt-2">
                  Please save this password securely. It will not be shown again.
                </div>
              </div>
            )}
            
            {autoRateLimit && (
              <div className="text-xs text-zinc-500 pt-2 border-t border-zinc-800">
                Rate limits: {autoRateLimit.vmRemaining}/3 auto resets per VM, {autoRateLimit.adminRemaining}/10 per admin (hourly)
              </div>
            )}
          </div>
        </>
      )}
      
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-300">Password Change History</h3>
          <div className="flex gap-2">
            <button
              onClick={() => exportHistory('csv')}
              className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs transition-colors"
            >
              <Download size={12} /> CSV
            </button>
            <button
              onClick={() => exportHistory('json')}
              className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs transition-colors"
            >
              <Download size={12} /> JSON
            </button>
          </div>
        </div>
        
        {historyLoading ? (
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
    </div>
  );
}
