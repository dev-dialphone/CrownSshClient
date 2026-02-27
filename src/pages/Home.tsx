import { useState, useEffect } from "react";
import { EnvironmentVMTree } from "@/components/EnvironmentVMTree";
import { CommandExecutor } from "@/components/CommandExecutor";
import { GlobalSearch } from "@/components/GlobalSearch";
import AccessControlPanel from "@/components/AccessControlPanel";
import AuditLogView from "@/components/AuditLogView";
import EmailSettings from "@/components/EmailSettings";
import VMPasswordManager from "@/components/VMPasswordManager";
import { useVMStore } from "../store/vmStore";
import { useEnvStore } from "../store/envStore";
import { useAuthStore } from "../store/authStore";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { Terminal, Users, ScrollText, Mail, Search, Key } from "lucide-react";

type TabId = 'env' | 'exec' | 'access' | 'logs' | 'email' | 'passwords' | 'search';

interface TabConfig {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  adminOnly: boolean;
  mobileOnly?: boolean;
}

const TABS: TabConfig[] = [
  { id: 'env', label: 'Env & VMs', icon: null, adminOnly: false },
  { id: 'exec', label: 'Exec', icon: <Terminal size={20} />, adminOnly: false },
  { id: 'access', label: 'Access', icon: <Users size={20} />, adminOnly: true },
  { id: 'passwords', label: 'Passwords', icon: <Key size={20} />, adminOnly: true },
  { id: 'logs', label: 'Logs', icon: <ScrollText size={20} />, adminOnly: true },
  { id: 'email', label: 'Email', icon: <Mail size={20} />, adminOnly: true },
  { id: 'search', label: 'Search', icon: <Search size={20} />, adminOnly: false, mobileOnly: true },
];

export default function Home() {
  const fetchVMGroups = useVMStore(state => state.fetchVMGroups);
  const { fetchEnvironments } = useEnvStore();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const [activeTab, setActiveTab] = useState<TabId>('env');

  usePushNotifications();

  useEffect(() => { fetchEnvironments(); }, [fetchEnvironments]);
  useEffect(() => { fetchVMGroups(); }, [fetchVMGroups]);

  const visibleTabs = TABS.filter(t => !t.adminOnly || isAdmin);

  return (
    <div className="flex flex-col h-screen bg-black text-white overflow-hidden font-sans">

      {/* Top Bar */}
      <div className="h-14 border-b border-zinc-800 flex items-center px-3 md:px-4 bg-zinc-950 shrink-0">
        <div className="font-bold text-base md:text-lg tracking-tight text-zinc-200">SSH<span className="text-blue-500">Manager</span></div>
        <div className="flex-1 max-w-2xl mx-auto hidden md:block">
          <GlobalSearch />
        </div>

        {/* Desktop Admin Tabs */}
        <div className="hidden md:flex items-center gap-2 ml-4 w-auto justify-end">
          {isAdmin && (
            <>
              <button
                onClick={() => setActiveTab('access')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm ${activeTab === 'access' ? 'bg-zinc-800 text-blue-400' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
              >
                <Users size={16} /> Access
              </button>
              <button
                onClick={() => setActiveTab('passwords')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm ${activeTab === 'passwords' ? 'bg-zinc-800 text-blue-400' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
              >
                <Key size={16} /> Passwords
              </button>
              <button
                onClick={() => setActiveTab('logs')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm ${activeTab === 'logs' ? 'bg-zinc-800 text-blue-400' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
              >
                <ScrollText size={16} /> Logs
              </button>
              <button
                onClick={() => setActiveTab('email')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm ${activeTab === 'email' ? 'bg-zinc-800 text-blue-400' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
              >
                <Mail size={16} /> Email
              </button>
            </>
          )}
        </div>

        {/* Mobile Search Toggle */}
        <div className="flex-1 flex justify-end md:hidden">
          <button
            onClick={() => setActiveTab(activeTab === 'search' ? 'env' : 'search')}
            className={`p-2 rounded-lg transition-colors ${activeTab === 'search' ? 'bg-zinc-800 text-blue-400' : 'text-zinc-400'}`}
          >
            <Search size={20} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
        {/* Mobile Search Panel */}
        {activeTab === 'search' ? (
          <div className="flex-1 flex flex-col h-full bg-black overflow-hidden p-4">
            <GlobalSearch />
          </div>
        ) : isAdmin && ['access', 'passwords', 'logs', 'email'].includes(activeTab) ? (
          /* Admin Panels (Desktop & Mobile) */
          <div className="flex-1 flex flex-col h-full bg-black overflow-hidden relative">
            <div className="absolute top-2 right-2 md:top-4 md:right-4 z-10">
              <button
                onClick={() => setActiveTab('env')}
                className="px-3 py-1.5 md:px-4 md:py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-colors"
              >
                ← Back
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-5xl mx-auto w-full pt-12 md:pt-8">
              {activeTab === 'access' && <AccessControlPanel />}
              {activeTab === 'passwords' && <VMPasswordManager />}
              {activeTab === 'logs' && <AuditLogView />}
              {activeTab === 'email' && <EmailSettings />}
            </div>
          </div>
        ) : (
          /* Standard Dashboard Panels (Env & VMs / Exec) */
          <>
            <div className={`${activeTab === 'env' ? 'flex' : 'hidden'} md:flex flex-1 md:flex-none h-full overflow-hidden`}>
              <EnvironmentVMTree />
            </div>
            <div className={`${activeTab === 'exec' ? 'flex' : 'hidden'} md:flex flex-1 h-full overflow-hidden`}>
              <CommandExecutor />
            </div>
          </>
        )}
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden flex items-center justify-around bg-zinc-950 border-t border-zinc-800 p-2 shrink-0 z-50">
        {visibleTabs.filter(t => !t.mobileOnly).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${activeTab === tab.id ? 'text-blue-500 bg-zinc-900' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            {tab.icon}
            <span className="text-[10px] font-medium uppercase tracking-wide">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
