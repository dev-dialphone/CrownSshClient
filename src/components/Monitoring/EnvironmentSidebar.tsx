import React from 'react';
import { ChevronDown, ChevronRight, Activity } from 'lucide-react';
import { useVMStore } from '../../store/vmStore';

interface EnvironmentSidebarProps {
  selectedEnvId: string | null;
  onSelectEnvironment: (envId: string) => void;
}

export function EnvironmentSidebar({ selectedEnvId, onSelectEnvironment }: EnvironmentSidebarProps) {
  const vmGroups = useVMStore(state => state.vmGroups);

  return (
    <div className="w-64 border-r border-zinc-800 bg-zinc-950 flex flex-col">
      <div className="p-3 border-b border-zinc-800">
        <h2 className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wider text-zinc-400">
          <Activity size={16} /> Environments
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {vmGroups.map(group => {
          const isSelected = selectedEnvId === group.environmentId;

          return (
            <button
              key={group.environmentId}
              onClick={() => onSelectEnvironment(group.environmentId)}
              className={`w-full flex items-center justify-between p-3 text-left transition-colors ${
                isSelected
                  ? 'bg-blue-600/20 border-l-2 border-blue-500'
                  : 'hover:bg-zinc-900 border-l-2 border-transparent'
              }`}
            >
              <div className="flex items-center gap-2">
                {isSelected ? (
                  <ChevronDown size={14} className="text-blue-400" />
                ) : (
                  <ChevronRight size={14} className="text-zinc-500" />
                )}
                <span className={`text-sm ${isSelected ? 'text-blue-400 font-medium' : 'text-zinc-300'}`}>
                  {group.environmentName}
                </span>
              </div>
              <span className="text-xs text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
                {group.vmCount}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
