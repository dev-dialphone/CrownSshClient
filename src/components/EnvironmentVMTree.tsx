import React, { useState, useEffect } from 'react';
import { useVMStore } from '../store/vmStore';
import { useEnvStore } from '../store/envStore';
import { useAuthStore } from '../store/authStore';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Server,
  CheckSquare,
  Square,
  Edit2,
  X,
  Loader,
  Pin,
  Layers,
  LogOut,
  ShieldCheck,
  Shield,
  Settings,
  Save,
  RefreshCw
} from 'lucide-react';
import { VM } from '../types';
import { TwoFactorSetup } from './TwoFactorSetup';
import { TwoFactorModal } from './TwoFactorModal';

export const EnvironmentVMTree: React.FC = () => {
  const vmGroups = useVMStore(state => state.vmGroups);
  const selectedVmIds = useVMStore(state => state.selectedVmIds);
  const expandedEnvIds = useVMStore(state => state.expandedEnvIds);
  const isLoading = useVMStore(state => state.isLoading);
  const toggleVMSelection = useVMStore(state => state.toggleVMSelection);
  const selectAllVMsInEnv = useVMStore(state => state.selectAllVMsInEnv);
  const deselectAllVMsInEnv = useVMStore(state => state.deselectAllVMsInEnv);
  const toggleEnvExpand = useVMStore(state => state.toggleEnvExpand);
  const expandAllEnvs = useVMStore(state => state.expandAllEnvs);
  const collapseAllEnvs = useVMStore(state => state.collapseAllEnvs);
  const addVM = useVMStore(state => state.addVM);
  const updateVM = useVMStore(state => state.updateVM);
  const deleteVM = useVMStore(state => state.deleteVM);
  const fetchVMGroups = useVMStore(state => state.fetchVMGroups);

  const { environments, fetchEnvironments, addEnvironment, deleteEnvironment, updateEnvironment, resetCommands } = useEnvStore();
  const { user, logout, isAdmin } = useAuthStore();


  const [isAddingVM, setIsAddingVM] = useState(false);
  const [isAddingEnv, setIsAddingEnv] = useState(false);
  const [newEnvName, setNewEnvName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', ip: '', username: '', password: '', port: 22, environmentId: '' });
  const [editingEnv, setEditingEnv] = useState<string | null>(null);
  const [editCommand, setEditCommand] = useState('');
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [deletingEnvId, setDeletingEnvId] = useState<string | null>(null);
  const [deletingEnvName, setDeletingEnvName] = useState('');
  const [isResettingCommands, setIsResettingCommands] = useState(false);

  useEffect(() => {
    fetchVMGroups();
    fetchEnvironments();
  }, [fetchVMGroups, fetchEnvironments]);

  const resetForm = () => {
    setFormData({ name: '', ip: '', username: '', password: '', port: 22, environmentId: '' });
    setIsAddingVM(false);
    setEditingId(null);
  };

  const handleEditClick = (vm: VM, e: React.MouseEvent) => {
    e.stopPropagation();
    setFormData({
      name: vm.name,
      ip: vm.ip,
      username: vm.username,
      password: vm.password || '',
      port: vm.port,
      environmentId: vm.environmentId || '',
    });
    setEditingId(vm.id);
    setIsAddingVM(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      await updateVM(editingId, formData);
    } else {
      if (!formData.environmentId) {
        alert("Please select an environment");
        return;
      }
      await addVM(formData);
    }
    resetForm();
  };

  const handleAddEnv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newEnvName) {
      await addEnvironment(newEnvName);
      setNewEnvName('');
      setIsAddingEnv(false);
    }
  };

  const handleEditEnv = (env: { id: string; command?: string }) => {
    setEditingEnv(env.id);
    setEditCommand(env.command || '');
  };

  const saveCommand = async (id: string) => {
    await updateEnvironment(id, { command: editCommand });
    setEditingEnv(null);
  };

  const handleDeleteEnvRequest = (envId: string, envName: string) => {
    if (user?.isTotpEnabled) {
      setDeletingEnvId(envId);
      setDeletingEnvName(envName);
    } else {
      if (confirm(`Are you sure you want to delete the "${envName}" environment? We recommend enabling 2FA for added security.`)) {
        deleteEnvironment(envId);
      }
    }
  };

  const handleDeleteEnvConfirm = async (totpCode: string) => {
    if (!deletingEnvId) return { success: false, error: 'No environment selected' };
    const result = await deleteEnvironment(deletingEnvId, totpCode);
    if (result.success) {
      setDeletingEnvId(null);
      setDeletingEnvName('');
    }
    return result;
  };

  const handleResetCommands = async () => {
    if (!confirm('Reset all environment commands to their default values? This will update IVG, OPS, and VOSS commands.')) return;

    setIsResettingCommands(true);
    const result = await resetCommands();
    setIsResettingCommands(false);

    if (result.success) {
      alert(`Successfully updated ${result.updatedCount} environment(s)`);
    } else {
      alert(`Failed to reset commands: ${result.error}`);
    }
  };

  const getEnvVmIds = (envId: string): string[] => {
    const group = vmGroups.find(g => g.environmentId === envId);
    return group ? group.vms.map(v => v.id) : [];
  };

  const isEnvFullySelected = (envId: string): boolean => {
    const vmIds = getEnvVmIds(envId);
    return vmIds.length > 0 && vmIds.every(id => selectedVmIds.includes(id));
  };

  const isEnvPartiallySelected = (envId: string): boolean => {
    const vmIds = getEnvVmIds(envId);
    return vmIds.some(id => selectedVmIds.includes(id)) && !isEnvFullySelected(envId);
  };

  const handleEnvSelectClick = (envId: string) => {
    if (isEnvFullySelected(envId)) {
      deselectAllVMsInEnv(envId);
    } else {
      selectAllVMsInEnv(envId);
    }
  };

  const allExpanded = expandedEnvIds.length === vmGroups.length;

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 w-full md:w-80 border-r border-zinc-800">
      {/* User Info */}
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
              <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full flex-shrink-0 ${isAdmin ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-700/50 text-zinc-400'}`}>
                {user?.role || 'user'}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {isAdmin && (
                <>
                  <button
                    onClick={() => setShow2FASetup(true)}
                    className={`text-xs flex items-center gap-1 transition-colors ${user?.isTotpEnabled ? 'text-green-400 hover:text-green-300' : 'text-zinc-500 hover:text-blue-400'}`}
                    title={user?.isTotpEnabled ? '2FA Enabled' : 'Setup 2FA'}
                  >
                    {user?.isTotpEnabled ? <ShieldCheck size={10} /> : <Shield size={10} />}
                    <span className="hidden sm:inline">{user?.isTotpEnabled ? '2FA On' : '2FA'}</span>
                  </button>
                </>
              )}
              <button onClick={() => logout()} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
                <LogOut size={10} /> Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="p-3 border-b border-zinc-800 flex justify-between items-center">
        <h2 className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wider text-zinc-400">
          <Layers size={16} /> Environments & VMs
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => allExpanded ? collapseAllEnvs() : expandAllEnvs()}
            className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1 rounded hover:bg-zinc-800 transition-colors"
            title={allExpanded ? 'Collapse All' : 'Expand All'}
          >
            {allExpanded ? 'Collapse' : 'Expand'}
          </button>
          {isAdmin && (
            <>
              <button
                onClick={handleResetCommands}
                disabled={isResettingCommands}
                className="text-xs text-zinc-500 hover:text-blue-400 px-2 py-1 rounded hover:bg-zinc-800 transition-colors disabled:opacity-50"
                title="Reset Commands"
              >
                {isResettingCommands ? <Loader size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              </button>
              <button onClick={() => setIsAddingEnv(!isAddingEnv)} className="text-zinc-500 hover:text-white">
                <Plus size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Add Environment Form */}
      {isAddingEnv && isAdmin && (
        <form onSubmit={handleAddEnv} className="p-2 border-b border-zinc-800 bg-zinc-900/50">
          <input
            autoFocus
            className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-sm text-white mb-2"
            placeholder="Environment Name"
            value={newEnvName}
            onChange={(e) => setNewEnvName(e.target.value)}
          />
          <div className="flex justify-end gap-1">
            <button type="button" onClick={() => setIsAddingEnv(false)} className="text-xs px-2 py-1 text-zinc-400">Cancel</button>
            <button type="submit" className="text-xs px-2 py-1 bg-blue-600 rounded text-white">Add</button>
          </div>
        </form>
      )}

      {/* Add VM Form */}
      {isAddingVM && isAdmin && (
        <form onSubmit={handleSubmit} className="p-4 bg-zinc-800/50 border-b border-zinc-800 space-y-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold uppercase text-zinc-500">{editingId ? 'Edit VM' : 'Add VM'}</span>
            <button type="button" onClick={resetForm}><X size={14} className="text-zinc-500" /></button>
          </div>
          <select
            className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-sm"
            value={formData.environmentId}
            onChange={(e) => setFormData({ ...formData, environmentId: e.target.value })}
            required
          >
            <option value="">Select Environment</option>
            {environments.map(env => (
              <option key={env.id} value={env.id}>{env.name}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Name (Label)"
            className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-sm"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <input
            type="text"
            placeholder="IP Address"
            className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-sm"
            value={formData.ip}
            onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
            required
          />
          <input
            type="text"
            placeholder="Username"
            className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-sm"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            required
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-sm"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={resetForm} className="text-xs px-2 py-1 hover:text-zinc-300">Cancel</button>
            <button type="submit" className="text-xs bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-white">
              {editingId ? 'Update' : 'Save'}
            </button>
          </div>
        </form>
      )}

      {/* VM Groups */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <Loader className="animate-spin text-zinc-500" size={24} />
          </div>
        ) : (
          vmGroups.map((group) => {
            const isExpanded = expandedEnvIds.includes(group.environmentId);
            const fullySelected = isEnvFullySelected(group.environmentId);
            const partiallySelected = isEnvPartiallySelected(group.environmentId);

            return (
              <div key={group.environmentId} className="border-b border-zinc-900">
                {/* Environment Header */}
                <div
                  className={`flex items-center justify-between p-2 cursor-pointer hover:bg-zinc-900/50 ${isExpanded ? 'bg-zinc-900/30' : ''}`}
                  onClick={() => toggleEnvExpand(group.environmentId)}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEnvSelectClick(group.environmentId); }}
                      className="flex-shrink-0"
                    >
                      {fullySelected ? (
                        <CheckSquare size={16} className="text-blue-500" />
                      ) : partiallySelected ? (
                        <div className="w-4 h-4 rounded border border-blue-500 bg-blue-500/30 flex items-center justify-center">
                          <div className="w-2 h-0.5 bg-blue-500 rounded" />
                        </div>
                      ) : (
                        <Square size={16} className="text-zinc-600" />
                      )}
                    </button>
                    {isExpanded ? (
                      <ChevronDown size={16} className="text-zinc-500 flex-shrink-0" />
                    ) : (
                      <ChevronRight size={16} className="text-zinc-500 flex-shrink-0" />
                    )}
                    <span className="font-medium text-sm truncate">{group.environmentName}</span>
                    <span className="text-xs bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full">
                      {group.vmCount}
                    </span>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEditEnv({ id: group.environmentId, command: environments.find(env => env.id === group.environmentId)?.command }); }}
                        className="p-1 hover:text-blue-400 text-zinc-500 transition-colors"
                        title="Edit Command"
                      >
                        <Settings size={14} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteEnvRequest(group.environmentId, group.environmentName); }}
                        className="p-1 hover:text-red-400 text-zinc-500 transition-colors"
                        title="Delete Environment"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Edit Command Panel */}
                {editingEnv === group.environmentId && isAdmin && (
                  <div className="p-2 bg-zinc-900/50 space-y-2 border-b border-zinc-800">
                    <label className="text-xs text-zinc-500">Custom Command for {group.environmentName}</label>
                    <textarea
                      className="w-full bg-black border border-zinc-700 rounded p-2 text-xs font-mono h-20"
                      value={editCommand}
                      onChange={(e) => setEditCommand(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditingEnv(null)} className="text-xs text-zinc-400">Cancel</button>
                      <button onClick={() => saveCommand(group.environmentId)} className="flex items-center gap-1 text-xs text-blue-400">
                        <Save size={12} /> Save
                      </button>
                    </div>
                  </div>
                )}

                {/* VMs List */}
                {isExpanded && (
                  <div className="bg-zinc-950/50">
                    {group.vms.map((vm) => (
                      <div
                        key={vm.id}
                        className={`group flex items-center justify-between px-2 py-1.5 pl-8 cursor-pointer hover:bg-zinc-800/50 ${selectedVmIds.includes(vm.id) ? 'bg-zinc-800/50' : ''}`}
                        onClick={() => toggleVMSelection(vm.id)}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          {vm.isPinned && !selectedVmIds.includes(vm.id) ? (
                            <Pin size={14} className="text-yellow-500 flex-shrink-0" fill="currentColor" />
                          ) : selectedVmIds.includes(vm.id) ? (
                            <CheckSquare size={14} className="text-blue-500 flex-shrink-0" />
                          ) : (
                            <Square size={14} className="text-zinc-600 flex-shrink-0" />
                          )}
                          <Server size={14} className="text-zinc-500 flex-shrink-0" />
                          <div className="truncate">
                            <div className="text-sm truncate">{vm.name || 'VM'}</div>
                          </div>
                        </div>
                        {isAdmin && (
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateVM(vm.id, { isPinned: !vm.isPinned });
                              }}
                              className={`p-1 hover:text-yellow-400 transition-colors ${vm.isPinned ? 'text-yellow-500' : 'text-zinc-500'}`}
                              title={vm.isPinned ? "Unpin VM" : "Pin VM"}
                            >
                              <Pin size={12} fill={vm.isPinned ? "currentColor" : "none"} />
                            </button>
                            <button
                              onClick={(e) => handleEditClick(vm, e)}
                              className="p-1 hover:text-blue-400 transition-colors text-zinc-500"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm('Are you sure you want to delete this VM?')) deleteVM(vm.id);
                              }}
                              className="p-1 hover:text-red-400 transition-colors text-zinc-500"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                    {group.vms.length === 0 && (
                      <div className="text-center py-4 text-zinc-600 text-xs pl-8">No VMs</div>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => {
                          setFormData({ name: '', ip: '', username: '', password: '', port: 22, environmentId: group.environmentId });
                          setIsAddingVM(true);
                        }}
                        className="w-full text-left px-8 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 flex items-center gap-2"
                      >
                        <Plus size={12} /> Add VM
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        {!isLoading && vmGroups.length === 0 && (
          <div className="text-center p-4 text-zinc-600 text-sm">
            No environments found.
          </div>
        )}
      </div>

      {/* Add VM Button (Admin Only) */}
      {isAdmin && !isAddingVM && (
        <div className="p-2 border-t border-zinc-800">
          <button
            onClick={() => setIsAddingVM(true)}
            className="w-full flex items-center justify-center gap-2 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-sm transition-colors"
          >
            <Plus size={16} /> Add VM
          </button>
        </div>
      )}

      {/* 2FA Setup Modal */}
      {show2FASetup && (
        <TwoFactorSetup
          onClose={() => setShow2FASetup(false)}
          onSuccess={() => useAuthStore.getState().checkAuth()}
        />
      )}

      {/* 2FA Delete Confirmation Modal */}
      {deletingEnvId && (
        <TwoFactorModal
          title="Confirm Environment Deletion"
          description={`Enter your 2FA code to delete the "${deletingEnvName}" environment. This action cannot be undone.`}
          onConfirm={handleDeleteEnvConfirm}
          onCancel={() => {
            setDeletingEnvId(null);
            setDeletingEnvName('');
          }}
        />
      )}
    </div>
  );
};
