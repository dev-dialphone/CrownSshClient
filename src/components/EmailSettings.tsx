import React, { useEffect, useState } from 'react';
import { Mail, Plus, X, Send, RefreshCw, CheckCircle, XCircle, Loader, Settings, Bell, Clock, BarChart3 } from 'lucide-react';

interface EmailSettings {
    enabled: boolean;
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean;
    smtpUser: string;
    smtpPassword: string;
    fromName: string;
    fromEmail: string;
    recipients: string[];
    notifyVmDown: boolean;
    notifyVmRecovered: boolean;
    notifyNewUser: boolean;
    notifyUserApproved: boolean;
    notifyUserRejected: boolean;
    cooldownMinutes: number;
    dailyCap: number;
}

interface EmailLog {
    _id: string;
    type: string;
    to: string[];
    subject: string;
    status: string;
    error?: string;
    createdAt: string;
}

interface EmailStats {
    today: number;
    total: number;
    failed: number;
}

const DEFAULT_SETTINGS: EmailSettings = {
    enabled: false,
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: '',
    smtpPassword: '',
    fromName: 'SSH Manager',
    fromEmail: '',
    recipients: ['crownsolution.noc@gmail.com'],
    notifyVmDown: true,
    notifyVmRecovered: true,
    notifyNewUser: true,
    notifyUserApproved: true,
    notifyUserRejected: true,
    cooldownMinutes: 15,
    dailyCap: 100,
};

const TYPE_LABELS: Record<string, string> = {
    VM_DOWN: 'VM Down',
    VM_RECOVERED: 'VM Recovered',
    USER_REQUEST: 'User Request',
    USER_APPROVED: 'User Approved',
    USER_REJECTED: 'User Rejected',
    TEST: 'Test Email',
};

const STATUS_STYLES: Record<string, string> = {
    pending: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
    sent: 'bg-green-500/10 text-green-400 border border-green-500/20',
    failed: 'bg-red-500/10 text-red-400 border border-red-500/20',
};

export default function EmailSettingsPanel() {
    const [settings, setSettings] = useState<EmailSettings>(DEFAULT_SETTINGS);
    const [originalSettings, setOriginalSettings] = useState<EmailSettings>(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testEmail, setTestEmail] = useState('');
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [activeTab, setActiveTab] = useState<'settings' | 'logs'>('settings');
    const [logs, setLogs] = useState<EmailLog[]>([]);
    const [stats, setStats] = useState<EmailStats>({ today: 0, total: 0, failed: 0 });
    const [newRecipient, setNewRecipient] = useState('');

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/email/settings');
            const data = await res.json();
            setSettings(data);
            setOriginalSettings(data);
        } finally {
            setLoading(false);
        }
    };

    const fetchLogs = async () => {
        const res = await fetch('/api/email/logs?limit=100');
        const data = await res.json();
        setLogs(data.logs || []);
    };

    const fetchStats = async () => {
        const res = await fetch('/api/email/stats');
        const data = await res.json();
        setStats(data);
    };

    useEffect(() => {
        fetchSettings();
        fetchStats();
    }, []);

    useEffect(() => {
        if (activeTab === 'logs') {
            fetchLogs();
        }
    }, [activeTab]);

    const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);

    const updateSetting = <K extends keyof EmailSettings>(key: K, value: EmailSettings[K]) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const addRecipient = () => {
        if (newRecipient && !settings.recipients.includes(newRecipient)) {
            updateSetting('recipients', [...settings.recipients, newRecipient]);
            setNewRecipient('');
        }
    };

    const removeRecipient = (email: string) => {
        if (email !== 'crownsolution.noc@gmail.com') {
            updateSetting('recipients', settings.recipients.filter(r => r !== email));
        }
    };

    const saveSettings = async () => {
        setSaving(true);
        try {
            const updates: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(settings)) {
                updates[`email.${key}`] = value;
            }

            const res = await fetch('/api/email/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });

            if (res.ok) {
                setOriginalSettings(settings);
                setTestResult({ success: true, message: 'Settings saved successfully!' });
                setTimeout(() => setTestResult(null), 3000);
            } else {
                const err = await res.json();
                setTestResult({ success: false, message: err.error || 'Failed to save settings' });
            }
        } finally {
            setSaving(false);
        }
    };

    const sendTestEmail = async () => {
        if (!testEmail) return;
        setTesting(true);
        setTestResult(null);
        try {
            const res = await fetch('/api/email/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to: testEmail }),
            });

            const data = await res.json();
            setTestResult({
                success: res.ok,
                message: res.ok ? 'Test email sent successfully!' : data.error || 'Failed to send test email',
            });
            fetchStats();
        } finally {
            setTesting(false);
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center h-64 text-zinc-500 text-sm animate-pulse">Loading email settings...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Header with Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                <div className="p-3 md:p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                            <Mail size={18} className="text-blue-400" />
                        </div>
                        <div>
                            <p className="text-xs text-zinc-500">Today</p>
                            <p className="text-lg font-semibold text-white">{stats.today}</p>
                        </div>
                    </div>
                </div>
                <div className="p-3 md:p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-500/20 rounded-lg">
                            <Send size={18} className="text-green-400" />
                        </div>
                        <div>
                            <p className="text-xs text-zinc-500">Total Sent</p>
                            <p className="text-lg font-semibold text-white">{stats.total}</p>
                        </div>
                    </div>
                </div>
                <div className="p-3 md:p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-500/20 rounded-lg">
                            <XCircle size={18} className="text-red-400" />
                        </div>
                        <div>
                            <p className="text-xs text-zinc-500">Failed</p>
                            <p className="text-lg font-semibold text-white">{stats.failed}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2 border-b border-zinc-800 pb-2">
                <button
                    onClick={() => setActiveTab('settings')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${activeTab === 'settings' ? 'bg-zinc-800 text-blue-400' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                    <Settings size={16} /> Settings
                </button>
                <button
                    onClick={() => setActiveTab('logs')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${activeTab === 'logs' ? 'bg-zinc-800 text-blue-400' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                    <BarChart3 size={16} /> Email Logs
                </button>
            </div>

            {testResult && (
                <div className={`p-3 rounded-lg flex items-center gap-2 ${testResult.success ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                    {testResult.success ? <CheckCircle size={16} /> : <XCircle size={16} />}
                    {testResult.message}
                </div>
            )}

            {activeTab === 'settings' && (
                <div className="space-y-6">
                    {/* Enable Toggle */}
                    <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-semibold text-zinc-200">Email Notifications</h3>
                                <p className="text-xs text-zinc-500 mt-1">Enable or disable all email notifications</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={settings.enabled}
                                    onChange={(e) => updateSetting('enabled', e.target.checked)}
                                />
                                <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>
                    </div>

                    {/* SMTP Configuration */}
                    <div className="p-3 md:p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4">
                        <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                            <Mail size={16} className="text-blue-400" /> SMTP Configuration
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                            <div>
                                <label className="block text-xs text-zinc-500 mb-1">SMTP Host</label>
                                <input
                                    type="text"
                                    value={settings.smtpHost}
                                    onChange={(e) => updateSetting('smtpHost', e.target.value)}
                                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
                                    placeholder="smtp.gmail.com"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-zinc-500 mb-1">Port</label>
                                <input
                                    type="number"
                                    value={settings.smtpPort}
                                    onChange={(e) => updateSetting('smtpPort', parseInt(e.target.value))}
                                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-zinc-500 mb-1">Username</label>
                                <input
                                    type="text"
                                    value={settings.smtpUser}
                                    onChange={(e) => updateSetting('smtpUser', e.target.value)}
                                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
                                    placeholder="your@gmail.com"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-zinc-500 mb-1">Password</label>
                                <input
                                    type="password"
                                    value={settings.smtpPassword}
                                    onChange={(e) => updateSetting('smtpPassword', e.target.value)}
                                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="smtpSecure"
                                checked={settings.smtpSecure}
                                onChange={(e) => updateSetting('smtpSecure', e.target.checked)}
                                className="rounded border-zinc-700 bg-zinc-950 text-blue-600 focus:ring-blue-500"
                            />
                            <label htmlFor="smtpSecure" className="text-xs text-zinc-400">Use SSL/TLS (port 465)</label>
                        </div>
                    </div>

                    {/* Sender Details */}
                    <div className="p-3 md:p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4">
                        <h3 className="text-sm font-semibold text-zinc-200">Sender Details</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                            <div>
                                <label className="block text-xs text-zinc-500 mb-1">From Name</label>
                                <input
                                    type="text"
                                    value={settings.fromName}
                                    onChange={(e) => updateSetting('fromName', e.target.value)}
                                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-zinc-500 mb-1">From Email</label>
                                <input
                                    type="email"
                                    value={settings.fromEmail}
                                    onChange={(e) => updateSetting('fromEmail', e.target.value)}
                                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Recipients */}
                    <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4">
                        <h3 className="text-sm font-semibold text-zinc-200">Alert Recipients</h3>
                        <div className="flex flex-wrap gap-2">
                            {settings.recipients.map((email) => (
                                <div key={email} className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 rounded-lg">
                                    <span className="text-sm text-zinc-200">{email}</span>
                                    {email === 'crownsolution.noc@gmail.com' ? (
                                        <span className="text-[10px] text-blue-400 bg-blue-500/20 px-1.5 py-0.5 rounded">Admin</span>
                                    ) : (
                                        <button onClick={() => removeRecipient(email)} className="text-zinc-500 hover:text-red-400">
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="email"
                                value={newRecipient}
                                onChange={(e) => setNewRecipient(e.target.value)}
                                className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
                                placeholder="Add email address"
                                onKeyDown={(e) => e.key === 'Enter' && addRecipient()}
                            />
                            <button
                                onClick={addRecipient}
                                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-colors flex items-center gap-2"
                            >
                                <Plus size={16} /> Add
                            </button>
                        </div>
                    </div>

                    {/* Notification Toggles */}
                    <div className="p-3 md:p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4">
                        <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                            <Bell size={16} className="text-blue-400" /> Notification Types
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {[
                                { key: 'notifyVmDown', label: 'VM Down Alerts', desc: 'Notify when VM is unreachable' },
                                { key: 'notifyVmRecovered', label: 'VM Recovered', desc: 'Notify when VM is back online' },
                                { key: 'notifyNewUser', label: 'New User Requests', desc: 'Notify when user requests access' },
                                { key: 'notifyUserApproved', label: 'User Approved', desc: 'Notify user when approved' },
                                { key: 'notifyUserRejected', label: 'User Rejected', desc: 'Notify user when rejected' },
                            ].map(({ key, label, desc }) => (
                                <label key={key} className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings[key as keyof EmailSettings] as boolean}
                                        onChange={(e) => updateSetting(key as keyof EmailSettings, e.target.checked)}
                                        className="rounded border-zinc-700 bg-zinc-950 text-blue-600 focus:ring-blue-500"
                                    />
                                    <div>
                                        <p className="text-sm text-zinc-200">{label}</p>
                                        <p className="text-xs text-zinc-500">{desc}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Rate Limiting */}
                    <div className="p-3 md:p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4">
                        <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                            <Clock size={16} className="text-blue-400" /> Rate Limiting
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                            <div>
                                <label className="block text-xs text-zinc-500 mb-1">VM Alert Cooldown (minutes)</label>
                                <input
                                    type="number"
                                    value={settings.cooldownMinutes}
                                    onChange={(e) => updateSetting('cooldownMinutes', parseInt(e.target.value))}
                                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
                                    min={5}
                                    max={60}
                                />
                                <p className="text-xs text-zinc-600 mt-1">Prevents duplicate alerts for same VM</p>
                            </div>
                            <div>
                                <label className="block text-xs text-zinc-500 mb-1">Daily Email Cap</label>
                                <input
                                    type="number"
                                    value={settings.dailyCap}
                                    onChange={(e) => updateSetting('dailyCap', parseInt(e.target.value))}
                                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
                                    min={10}
                                    max={500}
                                />
                                <p className="text-xs text-zinc-600 mt-1">Gmail limit is ~500/day</p>
                            </div>
                        </div>
                    </div>

                    {/* Test Email */}
                    <div className="p-3 md:p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4">
                        <h3 className="text-sm font-semibold text-zinc-200">Test Configuration</h3>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <input
                                type="email"
                                value={testEmail}
                                onChange={(e) => setTestEmail(e.target.value)}
                                className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
                                placeholder="Enter email to send test"
                            />
                            <button
                                onClick={sendTestEmail}
                                disabled={testing || !testEmail}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                            >
                                {testing ? <Loader className="animate-spin" size={16} /> : <Send size={16} />}
                                Send Test
                            </button>
                        </div>
                    </div>

                    {/* Save Button */}
                    {hasChanges && (
                        <div className="sticky bottom-4 p-3 md:p-4 bg-zinc-900/95 backdrop-blur border border-zinc-800 rounded-xl">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <p className="text-sm text-yellow-400">You have unsaved changes</p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setSettings(originalSettings)}
                                        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-colors"
                                    >
                                        Reset
                                    </button>
                                    <button
                                        onClick={saveSettings}
                                        disabled={saving}
                                        className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-zinc-700 text-white rounded-lg text-sm transition-colors flex items-center gap-2"
                                    >
                                        {saving ? <Loader className="animate-spin" size={16} /> : null}
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'logs' && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Email History</h3>
                        <button
                            onClick={fetchLogs}
                            className="p-1.5 text-zinc-400 hover:text-zinc-200 transition-colors"
                        >
                            <RefreshCw size={14} />
                        </button>
                    </div>
                    {logs.length === 0 ? (
                        <div className="text-center text-zinc-600 text-sm py-10">No emails sent yet</div>
                    ) : (
                        <div className="space-y-1.5">
                            {logs.map((log) => (
                                <div key={log._id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800/60 text-xs">
                                    <span className="text-zinc-600 font-mono flex-shrink-0 pt-0.5 w-32 truncate" title={new Date(log.createdAt).toLocaleString()}>
                                        {new Date(log.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                        <span className="text-zinc-700 ml-1">{new Date(log.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                    </span>
                                    <span className="text-zinc-400 truncate">{TYPE_LABELS[log.type] || log.type}</span>
                                    <span className="text-zinc-500 truncate flex-1" title={log.to.join(', ')}>
                                        → {log.to.join(', ')}
                                    </span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${STATUS_STYLES[log.status]}`}>
                                        {log.status}
                                    </span>
                                    {log.error && (
                                        <span className="text-red-400 text-[10px] truncate max-w-[200px]" title={log.error}>
                                            {log.error}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
