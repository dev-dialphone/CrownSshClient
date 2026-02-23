import { useState, useEffect } from "react";
import { EnvironmentSelector } from "@/components/EnvironmentSelector";
import { VMList } from "@/components/VMList";
import { CommandExecutor } from "@/components/CommandExecutor";
import { GlobalSearch } from "@/components/GlobalSearch";
import AccessControlPanel from "@/components/AccessControlPanel";
import AuditLogView from "@/components/AuditLogView";
import { useVMStore } from "../store/vmStore";
import { useEnvStore } from "../store/envStore";
import { useAuthStore } from "../store/authStore";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { Layers, Server, Terminal, Users, ScrollText } from "lucide-react";

type TabId = 'env' | 'vm' | 'exec' | 'access' | 'logs';

interface TabConfig {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  adminOnly: boolean;
}

const TABS: TabConfig[] = [
  { id: 'env', label: 'Env', icon: <Layers size={20} />, adminOnly: false },
  { id: 'vm', label: 'VMs', icon: <Server size={20} />, adminOnly: false },
  { id: 'exec', label: 'Exec', icon: <Terminal size={20} />, adminOnly: false },
  { id: 'access', label: 'Access', icon: <Users size={20} />, adminOnly: true },
  { id: 'logs', label: 'Logs', icon: <ScrollText size={20} />, adminOnly: true },
];

export default function Home() {
  const { fetchVMs } = useVMStore();
  const { fetchEnvironments, selectedEnvId } = useEnvStore();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const [activeTab, setActiveTab] = useState<TabId>('env');

  // Register admin browser for push notifications
  usePushNotifications();

  useEffect(() => { fetchEnvironments(); }, [fetchEnvironments]);
  useEffect(() => {
    if (selectedEnvId) fetchVMs(selectedEnvId);
  }, [fetchVMs, selectedEnvId]);

  const visibleTabs = TABS.filter(t => !t.adminOnly || isAdmin);

  return (
    <div className="flex flex-col h-screen bg-black text-white overflow-hidden font-sans">

      {/* Top Bar */}
      <div className="h-14 border-b border-zinc-800 flex items-center px-4 bg-zinc-950 shrink-0">
        <div className="font-bold text-lg mr-8 tracking-tight text-zinc-200">SSH<span className="text-blue-500">Manager</span></div>
        <div className="flex-1 max-w-2xl mx-auto">
          <GlobalSearch />
        </div>
        <div className="w-20" />
      </div>

      <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
        {/* Standard panels — hide on non-matching mobile tab */}
        <div className={`${activeTab === 'env' ? 'flex' : 'hidden'} md:flex flex-1 md:flex-none h-full overflow-hidden`}>
          <EnvironmentSelector />
        </div>
        <div className={`${activeTab === 'vm' ? 'flex' : 'hidden'} md:flex flex-1 md:flex-none h-full overflow-hidden`}>
          <VMList />
        </div>
        <div className={`${activeTab === 'exec' ? 'flex' : 'hidden'} md:flex flex-1 h-full overflow-hidden`}>
          <CommandExecutor />
        </div>

        {/* Admin-only panels */}
        {isAdmin && (
          <>
            <div className={`${activeTab === 'access' ? 'flex' : 'hidden'} md:hidden flex-1 h-full overflow-y-auto p-4`}>
              <AccessControlPanel />
            </div>
            <div className={`${activeTab === 'logs' ? 'flex' : 'hidden'} md:hidden flex-1 h-full overflow-y-auto p-4`}>
              <AuditLogView />
            </div>
          </>
        )}
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden flex items-center justify-around bg-zinc-950 border-t border-zinc-800 p-2 shrink-0 z-50">
        {visibleTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${activeTab === tab.id ? 'text-blue-500 bg-zinc-900' : 'text-zinc-500 hover:text-zinc-300'
              }`}
          >
            {tab.icon}
            <span className="text-[10px] font-medium uppercase tracking-wide">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
