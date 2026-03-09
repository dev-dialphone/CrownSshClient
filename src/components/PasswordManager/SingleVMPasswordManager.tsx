import React, { useState } from 'react';
import { Key, Eye, EyeOff, Play, Loader2, CheckCircle, XCircle, RefreshCw, AlertTriangle, Copy, RotateCcw } from 'lucide-react';
import { RateLimitInfo, getRateLimitText } from '../../hooks/password/useRateLimit';
import { PasswordHistoryEntry } from '../../hooks/password/usePasswordHistory';

interface VM {
  id: string;
  name: string;
  ip: string;
  username: string;
  password?: string;
}

interface SingleVMPasswordManagerProps {
  vm: VM;
  manualRateLimit: RateLimitInfo | null;
  autoRateLimit: RateLimitInfo | null;
  vmHistory: PasswordHistoryEntry[];
  vmHistoryLoading: boolean;
  onTestConnection: () => Promise<{ success: boolean; message: string }>;
  onManualUpdate: (password: string, testFirst: boolean) => Promise<void>;
  onAutoReset: (length: number, includeSpecial: boolean) => Promise<string | null>;
  onSyncPassword: (password: string) => Promise<void>;
  onRestorePassword: (historyId: string, oldPassword: string) => Promise<void>;
}

export function SingleVMPasswordManager({
  vm,
  manualRateLimit,
  autoRateLimit,
  vmHistory,
  vmHistoryLoading,
  onTestConnection,
  onManualUpdate,
  onAutoReset,
  onSyncPassword,
  onRestorePassword,
}: SingleVMPasswordManagerProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [connectionMessage, setConnectionMessage] = useState('');
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [previewPassword, setPreviewPassword] = useState<string | null>(null);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  
  const [autoResetLength, setAutoResetLength] = useState(16);
  const [includeSpecialChars, setIncludeSpecialChars] = useState(true);
  const [autoResetting, setAutoResetting] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  
  const [syncPassword, setSyncPassword] = useState('');
  const [syncing, setSyncing] = useState(false);
  
  const [showVmHistory, setShowVmHistory] = useState(false);
  const [restoringPassword, setRestoringPassword] = useState(false);

  const generatePassword = (length: number, special: boolean) => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const safeSpecialChars = '@#%^*_+=[]{}:.<>?~';
    const allChars = special ? chars + safeSpecialChars : chars;
    
    let password = '';
    const array = new Uint32Array(length);
    window.crypto.getRandomValues(array);
    
    for (let i = 0; i < length; i++) {
      password += allChars[array[i] % allChars.length];
    }
    
    return password;
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus('idle');
    
    try {
      const result = await onTestConnection();
      setConnectionStatus(result.success ? 'success' : 'error');
      setConnectionMessage(result.message);
    } catch {
      setConnectionStatus('error');
      setConnectionMessage('Failed to test connection');
    } finally {
      setTestingConnection(false);
    }
  };

  const handlePreviewPassword = () => {
    const generated = generatePassword(autoResetLength, includeSpecialChars);
    setPreviewPassword(generated);
    setNewPassword(generated);
    setConfirmPassword(generated);
  };

  const handleManualUpdate = async (testFirst: boolean) => {
    if (!newPassword || newPassword !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    
    setUpdatingPassword(true);
    
    try {
      await onManualUpdate(newPassword, testFirst);
      setNewPassword('');
      setConfirmPassword('');
      setPreviewPassword(null);
    } catch (error) {
      console.error('Manual update error:', error);
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleAutoReset = async () => {
    if (!confirm('This will change the password on the VM directly. Make sure you have console access as backup. Continue?')) {
      return;
    }
    
    setAutoResetting(true);
    setGeneratedPassword(null);
    
    try {
      const newPass = await onAutoReset(autoResetLength, includeSpecialChars);
      if (newPass) {
        setGeneratedPassword(newPass);
      }
    } catch (error) {
      console.error('Auto reset error:', error);
    } finally {
      setAutoResetting(false);
    }
  };

  const handleSyncPassword = async () => {
    if (!syncPassword) {
      alert('Please enter the actual VM password');
      return;
    }

    if (!confirm('This will test the password and update the database if it works. Continue?')) {
      return;
    }

    setSyncing(true);
    try {
      await onSyncPassword(syncPassword);
      setSyncPassword('');
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setSyncing(false);
    }
  };

  const handleRestorePassword = async (historyId: string, oldPassword: string) => {
    if (!confirm(`This will restore the password to: "${oldPassword}". Continue?`)) {
      return;
    }

    setRestoringPassword(true);
    try {
      await onRestorePassword(historyId, oldPassword);
    } catch (error) {
      console.error('Restore error:', error);
    } finally {
      setRestoringPassword(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  const manualLimitText = getRateLimitText(manualRateLimit, 'manual');
  const autoLimitText = getRateLimitText(autoRateLimit, 'auto');

  return (
    <>
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-4">
        <h3 className="text-sm font-semibold text-zinc-300">Current Credentials</h3>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-zinc-500">Name:</span>
            <span className="text-zinc-200 ml-2">{vm.name}</span>
          </div>
          <div>
            <span className="text-zinc-500">IP:</span>
            <span className="text-zinc-200 ml-2">{vm.ip}</span>
          </div>
          <div>
            <span className="text-zinc-500">Username:</span>
            <span className="text-zinc-200 ml-2">{vm.username}</span>
          </div>
          <div>
            <span className="text-zinc-500">Password:</span>
            <span className="text-zinc-200 ml-2 font-mono">
              {showPassword ? (vm.password || '••••••••') : '••••••••'}
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
            onClick={handleTestConnection}
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
        
        {manualLimitText && (
          <div className={`text-xs pt-2 border-t border-zinc-800 ${manualLimitText.isAdmin ? 'text-green-400' : 'text-zinc-500'}`}>
            {manualLimitText.text}
          </div>
        )}
      </div>
      
      <div className="bg-zinc-900 border border-orange-500/30 rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-orange-400" />
          <h3 className="text-sm font-semibold text-zinc-300">Sync Database with VM</h3>
        </div>
        
        <div className="bg-orange-500/10 border border-orange-500/20 rounded p-3 text-xs text-orange-400">
          If the password in the database doesn't match the actual VM password, enter the correct password below to sync.
        </div>
        
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Actual VM Password</label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={syncPassword}
                  onChange={(e) => setSyncPassword(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-orange-500 pr-10"
                  placeholder="Enter the actual password on the VM"
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button
                onClick={handleSyncPassword}
                disabled={syncing || !syncPassword}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-zinc-800 disabled:text-zinc-500 rounded text-sm transition-colors"
              >
                {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Sync
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-4">
        <h3 className="text-sm font-semibold text-zinc-300">Change Password on VM</h3>
        <p className="text-xs text-zinc-500">This will change the password on the VM via SSH and update the database.</p>
        
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">New Password</label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setPreviewPassword(null);
                  }}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  placeholder="Enter new password"
                />
              </div>
              <button
                onClick={handlePreviewPassword}
                className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-sm transition-colors whitespace-nowrap"
              >
                Generate
              </button>
            </div>
          </div>

          {previewPassword && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded p-3">
              <div className="text-xs text-blue-400 mb-1">Generated Password Preview:</div>
              <div className="flex items-center gap-2">
                <code className="text-base font-mono text-blue-300">{previewPassword}</code>
                <button
                  onClick={() => copyToClipboard(previewPassword)}
                  className="p-1 text-blue-400 hover:text-blue-300"
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>
          )}
          
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Confirm Password</label>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              placeholder="Confirm new password"
            />
          </div>
          
          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-2 text-zinc-300">
              <input
                type="checkbox"
                checked={includeSpecialChars}
                onChange={(e) => setIncludeSpecialChars(e.target.checked)}
                className="rounded border-zinc-700"
              />
              Special chars
            </label>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Length</label>
              <input
                type="number"
                value={autoResetLength}
                onChange={(e) => setAutoResetLength(Math.max(8, Math.min(64, parseInt(e.target.value) || 16)))}
                className="w-16 bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                min={8}
                max={64}
              />
            </div>
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RotateCcw size={18} className="text-green-400" />
            <h3 className="text-sm font-semibold text-zinc-300">Password History & Restore</h3>
          </div>
          <button
            onClick={() => setShowVmHistory(!showVmHistory)}
            className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors"
          >
            {showVmHistory ? 'Hide' : 'Show'} History
          </button>
        </div>
        
        <div className="bg-green-500/10 border border-green-500/20 rounded p-3 text-xs text-green-400">
          If the password was changed in the database but not on the VM, you can restore an old password from history.
        </div>
        
        {showVmHistory && (
          <>
            {vmHistoryLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="animate-spin text-zinc-500" size={20} />
              </div>
            ) : vmHistory.length > 0 ? (
              <div className="space-y-2">
                <div className="text-xs text-zinc-500 mb-2">Previous passwords (click to restore):</div>
                {vmHistory.map((entry, index) => (
                  <div 
                    key={entry.id} 
                    className={`p-3 rounded border ${
                      entry.success 
                        ? 'bg-zinc-800/50 border-zinc-700' 
                        : 'bg-red-900/20 border-red-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-xs mb-1">
                          <span className="text-zinc-400">#{vmHistory.length - index}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                            entry.operationType === 'auto' 
                              ? 'bg-orange-500/20 text-orange-400' 
                              : 'bg-blue-500/20 text-blue-400'
                          }`}>
                            {entry.operationType}
                          </span>
                          <span className="text-zinc-500">{formatDate(entry.createdAt)}</span>
                          {!entry.success && (
                            <span className="text-red-400">Failed: {entry.errorMessage}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          {entry.oldPassword && (
                            <div className="flex items-center gap-1">
                              <span className="text-zinc-500">Old:</span>
                              <code className="text-zinc-300 font-mono bg-zinc-900 px-1 rounded">
                                {showPassword ? entry.oldPassword : '••••••••'}
                              </code>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <span className="text-zinc-500">New:</span>
                            <code className="text-zinc-300 font-mono bg-zinc-900 px-1 rounded">
                              {showPassword ? entry.newPassword : '••••••••'}
                            </code>
                          </div>
                        </div>
                      </div>
                      {entry.oldPassword && (
                        <button
                          onClick={() => handleRestorePassword(entry.id, entry.oldPassword)}
                          disabled={restoringPassword}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-zinc-800 disabled:text-zinc-500 rounded text-xs transition-colors ml-3"
                        >
                          {restoringPassword ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <RotateCcw size={12} />
                          )}
                          Restore
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-zinc-600 text-sm">No password history for this VM</div>
            )}
          </>
        )}
      </div>
      
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-zinc-300">Automatic Password Reset</h3>
          <AlertTriangle size={14} className="text-yellow-500" />
        </div>
        
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded p-3 text-xs text-yellow-400">
          Warning: This will change the password directly on the VM. Make sure you have console access as backup.
        </div>
        
        <button
          onClick={handleAutoReset}
          disabled={autoResetting}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-zinc-800 disabled:text-zinc-500 rounded text-sm transition-colors"
        >
          {autoResetting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Reset Password on VM
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
        
        {autoLimitText && (
          <div className={`text-xs pt-2 border-t border-zinc-800 ${autoLimitText.isAdmin ? 'text-green-400' : 'text-zinc-500'}`}>
            {autoLimitText.text}
          </div>
        )}
      </div>
    </>
  );
}
