import React, { useState, useEffect, useRef } from 'react';
import { useVMStore } from '../store/vmStore';
import { useEnvStore } from '../store/envStore';
import { useAuthStore } from '../store/authStore';
import { Plus, Trash2, Server, CheckSquare, Square, Edit2, X, Loader, Pin } from 'lucide-react';
import { VM } from '../types';


export const VMList: React.FC = () => {
  // Optimize selector to prevent unnecessary re-renders
  const vms = useVMStore(state => state.vms);
  const selectedVmIds = useVMStore(state => state.selectedVmIds);
  const toggleVMSelection = useVMStore(state => state.toggleVMSelection);
  const selectAllVMs = useVMStore(state => state.selectAllVMs);
  const deselectAllVMs = useVMStore(state => state.deselectAllVMs);
  const addVM = useVMStore(state => state.addVM);
  const updateVM = useVMStore(state => state.updateVM);
  const deleteVM = useVMStore(state => state.deleteVM);
  const fetchVMs = useVMStore(state => state.fetchVMs);
  const page = useVMStore(state => state.page);
  const hasMore = useVMStore(state => state.hasMore);
  const isLoading = useVMStore(state => state.isLoading);

  const { selectedEnvId } = useEnvStore();
  const { isAdmin } = useAuthStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({ name: '', ip: '', username: '', password: '', port: 22 });

  // Infinite Scroll Observer
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          fetchVMs(selectedEnvId || undefined, page + 1);
        }
      },
      {
        threshold: 0.1,
        rootMargin: '100px'
      }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoading, page, selectedEnvId, fetchVMs]);

  const resetForm = () => {
    setFormData({ name: '', ip: '', username: '', password: '', port: 22 });
    setIsEditing(false);
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
    });
    setEditingId(vm.id);
    setIsEditing(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      await updateVM(editingId, formData);
    } else {
      if (!selectedEnvId) {
        alert("Please select an environment first");
        return;
      }
      await addVM({ ...formData, environmentId: selectedEnvId });
    }
    resetForm();
  };

  // Derived state for selection toggle
  const allSelected = vms.length > 0 && selectedVmIds.length === vms.length;

  const handleToggleSelectAll = () => {
    if (allSelected) {
      deselectAllVMs();
    } else {
      selectAllVMs();
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900 text-zinc-100 border-b md:border-b-0 md:border-r border-zinc-800 w-full md:w-80">
      <div className="p-3 md:p-4 border-b border-zinc-800 flex justify-between items-center gap-2">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <h2 className="text-base md:text-lg font-semibold flex items-center gap-2 flex-shrink-0">
            <Server size={18} /> <span className="hidden sm:inline">VMs</span>
          </h2>
          {/* Smart Selection Toggle */}
          {vms.length > 0 && (
            <button
              onClick={handleToggleSelectAll}
              className="flex items-center gap-1 text-zinc-500 hover:text-blue-400 transition-colors flex-shrink-0"
              title={allSelected ? "Unselect All" : "Select All"}
            >
              {allSelected ? <CheckSquare size={16} className="text-blue-500" /> : <Square size={16} />}
              <span className="text-xs font-medium hidden sm:inline">{allSelected ? "Unselect" : "Select"}</span>
            </button>
          )}
        </div>
        {isAdmin && (
          <button
            onClick={() => { resetForm(); setIsEditing(!isEditing); }}
            className={`p-1.5 rounded transition-colors flex-shrink-0 ${isEditing && !editingId ? 'bg-zinc-700 text-white' : 'hover:bg-zinc-800'}`}
          >
            {isEditing && !editingId ? <X size={18} /> : <Plus size={18} />}
          </button>
        )}
      </div>

      {isEditing && isAdmin && (
        <form onSubmit={handleSubmit} className="p-4 bg-zinc-800/50 border-b border-zinc-800 space-y-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold uppercase text-zinc-500">{editingId ? 'Edit VM' : 'Add VM'}</span>
            <button type="button" onClick={resetForm}><X size={14} className="text-zinc-500" /></button>
          </div>
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
            <button
              type="button"
              onClick={resetForm}
              className="text-xs px-2 py-1 hover:text-zinc-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="text-xs bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-white"
            >
              {editingId ? 'Update' : 'Save'}
            </button>
          </div>
        </form>
      )}

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {vms.map((vm) => (
          <div
            key={vm.id}
            className={`group flex items-center justify-between p-2 rounded cursor-pointer ${selectedVmIds.includes(vm.id) ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
              }`}
            onClick={() => toggleVMSelection(vm.id)}
          >
            <div className="flex items-center gap-3 overflow-hidden">
              {/* Always show Pin if pinned, otherwise show selection checkbox */}
              {vm.isPinned && !selectedVmIds.includes(vm.id) ? (
                <Pin size={16} className="text-yellow-500 flex-shrink-0" fill="currentColor" />
              ) : selectedVmIds.includes(vm.id) ? (
                <CheckSquare size={16} className="text-blue-500 flex-shrink-0" />
              ) : (
                <Square size={16} className="text-zinc-600 flex-shrink-0" />
              )}
              <div className="truncate">
                <div className="font-medium text-sm truncate">{vm.name || vm.ip}</div>
                <div className="text-xs text-zinc-500 truncate">{vm.username}@{vm.ip}</div>
              </div>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    updateVM(vm.id, { isPinned: !vm.isPinned });
                  }}
                  className={`p-1 hover:text-yellow-400 transition-colors ${vm.isPinned ? 'text-yellow-500' : 'text-zinc-500'}`}
                  title={vm.isPinned ? "Unpin VM" : "Pin VM"}
                >
                  <Pin size={14} fill={vm.isPinned ? "currentColor" : "none"} />
                </button>
                <button
                  onClick={(e) => handleEditClick(vm, e)}
                  className="p-1 hover:text-blue-400 transition-colors text-zinc-500"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Are you sure you want to delete this VM?')) deleteVM(vm.id);
                  }}
                  className="p-1 hover:text-red-400 transition-colors text-zinc-500"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Loading Indicator & Observer Target */}
        <div ref={observerTarget} className="p-4 flex justify-center">
          {isLoading && <Loader className="animate-spin text-zinc-500" size={20} />}
        </div>

        {!isLoading && vms.length === 0 && (
          <div className="text-center p-4 text-zinc-600 text-sm">
            No VMs in this environment.
          </div>
        )}
      </div>
    </div>
  );
};
