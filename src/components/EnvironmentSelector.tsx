import React, { useState, useEffect } from 'react';
import { useEnvStore } from '../store/envStore';
import { useVMStore } from '../store/vmStore';
import { useAuthStore } from '../store/authStore';
import { Layers, Plus, Trash2, Settings, Save, LogOut, ShieldCheck, Shield } from 'lucide-react';
import { TwoFactorSetup } from './TwoFactorSetup';
import { TwoFactorModal } from './TwoFactorModal';

export const EnvironmentSelector: React.FC = () => {
  const { environments, selectedEnvId, fetchEnvironments, addEnvironment, deleteEnvironment, selectEnvironment, updateEnvironment } = useEnvStore();
  const { fetchVMs } = useVMStore();
  const { user, logout, isAdmin } = useAuthStore();

  const [isAdding, setIsAdding] = useState(false);
  const [newEnvName, setNewEnvName] = useState('');
  const [editingEnv, setEditingEnv] = useState<string | null>(null);
  const [editCommand, setEditCommand] = useState('');
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [showReset2FA, setShowReset2FA] = useState(false);
  // 2FA modal for delete confirmation
  const [deletingEnvId, setDeletingEnvId] = useState<string | null>(null);
  const [deletingEnvName, setDeletingEnvName] = useState('');

  useEffect(() => {
    fetchEnvironments();

    const handleVMChange = () => {
      fetchEnvironments();
    };

    window.addEventListener('vm-added', handleVMChange);
    window.addEventListener('vm-deleted', handleVMChange);

    return () => {
      window.removeEventListener('vm-added', handleVMChange);
      window.removeEventListener('vm-deleted', handleVMChange);
    };
  }, [fetchEnvironments]);

  useEffect(() => {
    if (selectedEnvId) {
      fetchVMs(selectedEnvId);
    }
  }, [selectedEnvId, fetchVMs]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newEnvName) {
      await addEnvironment(newEnvName);
      setNewEnvName('');
      setIsAdding(false);
    }
  };

  const handleEdit = (env: { id: string; command?: string }) => {
    setEditingEnv(env.id);
    setEditCommand(env.command || '');
  };

  const saveCommand = async (id: string) => {
    await updateEnvironment(id, { command: editCommand });
    setEditingEnv(null);
  };

  const handleDeleteRequest = (envId: string, envName: string) => {
    if (user?.isTotpEnabled) {
      // Show 2FA modal
      setDeletingEnvId(envId);
      setDeletingEnvName(envName);
    } else {
      // No 2FA set up — ask for confirmation with simple confirm dialog
      if (confirm(`Are you sure you want to delete the "${envName}" environment? We recommend enabling 2FA for added security.`)) {
        deleteEnvironment(envId);
      }
    }
  };

  const handleDeleteConfirm = async (totpCode: string) => {
    if (!deletingEnvId) return { success: false, error: 'No environment selected' };
    const result = await deleteEnvironment(deletingEnvId, totpCode);
    if (result.success) {
      setDeletingEnvId(null);
      setDeletingEnvName('');
    }
    return result;
  };

  return (
    <>
      <div className="w-full md:w-64 bg-zinc-950 border-b md:border-b-0 md:border-r border-zinc-800 flex flex-col h-full">
        {/* User Info Section */}
        <div className="p-3 md:p-4 border-b border-zinc-800 bg-zinc-900/30">
          <div className="flex items-center gap-2 md:gap-3">
            {user?.photos?.[0]?.value ? (
              <img src={user.photos[0].value} alt="User" className="w-8 h-8 rounded-full border border-zinc-700 flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                {user?.displayName?.charAt(0) || 'U'}
              </div>
            )}
            <div className="flex-1 overflow-hidden min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium truncate">{user?.displayName || 'User'}</span>
                <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full flex-shrink-0 ${isAdmin ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-700/50 text-zinc-400'
                  }`}>
                  {user?.role || 'user'}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {isAdmin && (
                  <>
                    <button
                      onClick={() => setShow2FASetup(true)}
                      className={`text-xs flex items-center gap-1 transition-colors ${user?.isTotpEnabled ? 'text-green-400 hover:text-green-300' : 'text-zinc-500 hover:text-blue-400'
                        }`}
                      title={user?.isTotpEnabled ? '2FA Enabled' : 'Setup 2FA'}
                    >
                      {user?.isTotpEnabled ? <ShieldCheck size={10} /> : <Shield size={10} />}
                      <span className="hidden sm:inline">{user?.isTotpEnabled ? '2FA On' : '2FA'}</span>
                    </button>
                    {user?.isTotpEnabled && (
                      <button
                        onClick={() => setShowReset2FA(true)}
                        className="text-xs text-amber-500 hover:text-amber-400 flex items-center gap-1 transition-colors"
                        title="Reset 2FA"
                      >
                        Reset
                      </button>
                    )}
                  </>
                )}
                <button
                  onClick={() => logout()}
                  className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                >
                  <LogOut size={10} /> Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
          <h2 className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wider text-zinc-400">
            <Layers size={16} /> Environments
          </h2>
          {isAdmin && (
            <button onClick={() => setIsAdding(!isAdding)} className="text-zinc-500 hover:text-white">
              <Plus size={16} />
            </button>
          )}
        </div>

        {isAdding && isAdmin && (
          <form onSubmit={handleAdd} className="p-2 border-b border-zinc-800">
            <input
              autoFocus
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-white mb-2"
              placeholder="Env Name"
              value={newEnvName}
              onChange={(e) => setNewEnvName(e.target.value)}
            />
            <div className="flex justify-end gap-1">
              <button type="button" onClick={() => setIsAdding(false)} className="text-xs px-2 py-1 text-zinc-400">Cancel</button>
              <button type="submit" className="text-xs px-2 py-1 bg-blue-600 rounded text-white">Add</button>
            </div>
          </form>
        )}

        <div className="flex-1 overflow-y-auto">
          {environments.map((env) => (
            <div key={env.id} className="border-b border-zinc-900">
              <div
                className={`group flex items-center justify-between p-3 cursor-pointer hover:bg-zinc-900 ${selectedEnvId === env.id ? 'bg-zinc-900 border-l-2 border-blue-500' : 'border-l-2 border-transparent'
                  }`}
                onClick={() => selectEnvironment(env.id)}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="font-medium text-sm truncate">{env.name}</span>
                  {env.vmCount !== undefined && (
                    <span className="text-xs bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full">
                      {env.vmCount}
                    </span>
                  )}
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEdit(env); }}
                      className="p-1 hover:text-blue-400 text-zinc-500 transition-colors"
                      title="Edit Command"
                    >
                      <Settings size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteRequest(env.id, env.name);
                      }}
                      className="p-1 hover:text-red-400 text-zinc-500 transition-colors"
                      title="Delete Environment"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>

              {editingEnv === env.id && isAdmin && (
                <div className="p-2 bg-zinc-900/50 space-y-2">
                  <label className="text-xs text-zinc-500">Custom Command for {env.name}</label>
                  <textarea
                    className="w-full bg-black border border-zinc-700 rounded p-2 text-xs font-mono h-20"
                    value={editCommand}
                    onChange={(e) => setEditCommand(e.target.value)}
                  />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditingEnv(null)} className="text-xs text-zinc-400">Cancel</button>
                    <button onClick={() => saveCommand(env.id)} className="flex items-center gap-1 text-xs text-blue-400">
                      <Save size={12} /> Save
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 2FA Setup Modal */}
      {show2FASetup && (
        <TwoFactorSetup
          onClose={() => setShow2FASetup(false)}
          onSuccess={() => {
            // Refresh user data to update isTotpEnabled
            useAuthStore.getState().checkAuth();
          }}
        />
      )}

      {/* 2FA Delete Confirmation Modal */}
      {deletingEnvId && (
        <TwoFactorModal
          title="Confirm Environment Deletion"
          description={`Enter your 2FA code to delete the "${deletingEnvName}" environment. This action cannot be undone.`}
          onConfirm={handleDeleteConfirm}
          onCancel={() => {
            setDeletingEnvId(null);
            setDeletingEnvName('');
          }}
        />
      )}

      {/* Reset 2FA Modal */}
      {showReset2FA && (
        <TwoFactorModal
          title="Reset Two-Factor Authentication"
          description="Enter your current 2FA code to disable it. You can then set up 2FA again with a new device."
          onConfirm={async (totpCode: string) => {
            const apiUrl = import.meta.env.VITE_API_URL || '';
            try {
              const res = await fetch(`${apiUrl}/api/totp/disable`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ token: totpCode }),
              });
              if (!res.ok) {
                const err = await res.json();
                return { success: false, error: err.error || 'Failed to reset 2FA' };
              }
              setShowReset2FA(false);
              useAuthStore.getState().checkAuth();
              return { success: true };
            } catch {
              return { success: false, error: 'Network error' };
            }
          }}
          onCancel={() => setShowReset2FA(false)}
        />
      )}
    </>
  );
};
