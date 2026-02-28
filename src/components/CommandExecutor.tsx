import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useVMStore } from '../store/vmStore';
import { useEnvStore } from '../store/envStore';
import { Play, Terminal as TerminalIcon, RotateCcw } from 'lucide-react';

export const CommandExecutor: React.FC = () => {
  const logs = useVMStore(state => state.logs);
  const statuses = useVMStore(state => state.statuses);
  const activeTerminalVmId = useVMStore(state => state.activeTerminalVmId);

  const vmGroups = useVMStore(state => state.vmGroups);
  const selectedVmIds = useVMStore(state => state.selectedVmIds);

  const allVMs = useMemo(() => vmGroups.flatMap(g => g.vms), [vmGroups]);

  const setActiveTerminalVmId = useVMStore(state => state.setActiveTerminalVmId);
  const addLog = useVMStore(state => state.addLog);
  const updateStatus = useVMStore(state => state.updateStatus);
  const clearLogs = useVMStore(state => state.clearLogs);

  const { environments } = useEnvStore();

  const selectedVMs = allVMs.filter(v => selectedVmIds.includes(v.id));
  const activeVM = selectedVMs.find(v => v.id === activeTerminalVmId);

  const envCommandMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const env of environments) {
      map.set(env.id, env.command || '');
    }
    return map;
  }, [environments]);

  const vmCommands = useMemo(() => {
    return selectedVMs.map(vm => ({
      vm,
      command: envCommandMap.get(vm.environmentId || '') || ''
    }));
  }, [selectedVMs, envCommandMap]);

  const uniqueCommands = useMemo(() => {
    const commands = new Map<string, { envName: string; vmNames: string[] }>();
    for (const { vm, command } of vmCommands) {
      const envName = environments.find(e => e.id === vm.environmentId)?.name || 'Unknown';
      if (!commands.has(command)) {
        commands.set(command, { envName, vmNames: [] });
      }
      commands.get(command)!.vmNames.push(vm.name);
    }
    return commands;
  }, [vmCommands, environments]);

  const [isExecuting, setIsExecuting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL;
    let wsUrl: string;

    if (apiUrl) {
      const url = new URL(apiUrl);
      const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${url.host}/api/`;
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      wsUrl = `${protocol}//${host}/api/`;
    }

    console.log(`Connecting to WebSocket at: ${wsUrl}`);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connection established');
      addLog({ vmId: 'system', type: 'info', data: '>>> Connected to backend terminal server.\n', timestamp: Date.now() });
    };

    ws.onmessage = (event) => {
      try {
        const { type, payload } = JSON.parse(event.data);
        if (type === 'output') {
          addLog({ ...payload, timestamp: Date.now() });
        } else if (type === 'status') {
          updateStatus(payload);
        }
      } catch (error) {
        console.error('Failed to process WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      addLog({ vmId: 'system', type: 'error', data: '>>> Connection error. Unable to reach terminal server.\n', timestamp: Date.now() });
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed');
      addLog({ vmId: 'system', type: 'info', data: '>>> Connection lost. Trying to reconnect...\n', timestamp: Date.now() });
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [addLog, updateStatus]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const handleExecute = async () => {
    if (selectedVmIds.length === 0) return;

    setIsExecuting(true);
    clearLogs();

    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      await fetch(`${apiUrl}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ vmIds: selectedVmIds }),
      });
    } catch (error) {
      console.error('Execution failed', error);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 flex-1 min-w-0">
      <div className="p-3 md:p-4 border-b border-zinc-800 flex items-center justify-between gap-2">
        <h2 className="text-base md:text-lg font-semibold flex items-center gap-2 truncate">
          <TerminalIcon size={18} className="flex-shrink-0" /> 
          <span className="truncate">{activeVM ? `Terminal: ${activeVM.name}` : 'Execution'}</span>
        </h2>
        <div className="flex gap-1.5 md:gap-2 flex-shrink-0">
          <button
            onClick={clearLogs}
            className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1.5 text-xs md:text-sm bg-zinc-800 hover:bg-zinc-700 rounded transition-colors"
          >
            <RotateCcw size={14} /> <span className="hidden sm:inline">Clear</span>
          </button>
          <button
            onClick={handleExecute}
            disabled={isExecuting || selectedVmIds.length === 0}
            className="flex items-center gap-1 md:gap-2 px-2 md:px-4 py-1.5 text-xs md:text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-800 disabled:text-zinc-500 rounded transition-colors whitespace-nowrap"
          >
            <Play size={14} /> {isExecuting ? 'Running...' : `Run (${selectedVmIds.length})`}
          </button>
        </div>
      </div>

      <div className="p-3 md:p-4 space-y-3 md:space-y-4 flex-shrink-0">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wider">
            Commands to Execute (by Environment)
          </label>
          {selectedVMs.length === 0 ? (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded p-3 text-xs text-zinc-500">
              Select VMs from the sidebar to see commands
            </div>
          ) : (
            <div className="space-y-2">
              {Array.from(uniqueCommands.entries()).map(([cmd, info], idx) => (
                <div key={idx} className="bg-zinc-900/50 border border-zinc-800 rounded p-2 md:p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
                      {info.envName}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {info.vmNames.length} VM{info.vmNames.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="text-xs font-mono text-zinc-400 break-all bg-black/50 p-2 rounded">
                    {cmd || <span className="text-zinc-600 italic">No command configured</span>}
                  </div>
                  <div className="text-xs text-zinc-600 mt-1 truncate">
                    VMs: {info.vmNames.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 bg-black border-t border-zinc-800 min-w-0">
        <div className="flex flex-col border-b border-zinc-900 bg-zinc-900/50 w-full">
          <div className="flex items-center justify-between px-3 md:px-4 py-2">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Output</span>
            <div className="flex gap-2 md:gap-4 overflow-x-auto no-scrollbar">
              {selectedVMs.slice(0, 3).map((vm) => (
                <div key={vm.id} className="flex items-center gap-1.5 text-xs flex-shrink-0">
                  <div className={`w-2 h-2 rounded-full ${statuses[vm.id] === 'running' ? 'bg-blue-500 animate-pulse' :
                    statuses[vm.id] === 'success' ? 'bg-green-500' :
                      statuses[vm.id] === 'error' ? 'bg-red-500' : 'bg-zinc-600'
                    }`} />
                  <span className="text-zinc-400 truncate max-w-[60px] md:max-w-none">{vm.name}</span>
                </div>
              ))}
              {selectedVMs.length > 3 && (
                <span className="text-xs text-zinc-600">+{selectedVMs.length - 3}</span>
              )}
            </div>
          </div>

          {/* Terminal Tabs */}
          {selectedVMs.length > 0 && (
            <div className="flex overflow-x-auto px-2 border-t border-zinc-800/50 no-scrollbar w-full">
              {selectedVMs.map((vm) => (
                <button
                  key={vm.id}
                  onClick={() => setActiveTerminalVmId(vm.id)}
                  className={`px-3 md:px-4 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${activeTerminalVmId === vm.id
                    ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                    }`}
                >
                  <div className="flex items-center gap-1.5 md:gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${statuses[vm.id] === 'running' ? 'bg-blue-500 animate-pulse' :
                      statuses[vm.id] === 'success' ? 'bg-green-500' :
                        statuses[vm.id] === 'error' ? 'bg-red-500' : 'bg-zinc-600'
                      }`} />
                    <span className="truncate max-w-[80px] md:max-w-none">{vm.name}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1 selection:bg-blue-500/30"
        >
          {logs.filter(log => log.vmId === activeTerminalVmId || log.vmId === 'system').length === 0 && (
            <div className="text-zinc-700 italic">No output yet for this VM. Select VMs and click Run.</div>
          )}
          {logs
            .filter(log => log.vmId === activeTerminalVmId || log.vmId === 'system')
            .map((log, i) => (
              <div key={i} className={`whitespace-pre-wrap break-all border-l-2 pl-3 py-0.5 ${log.vmId === 'system' ? 'border-zinc-700 text-zinc-500' : 'border-zinc-800'
                }`}>
                {log.data}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};
