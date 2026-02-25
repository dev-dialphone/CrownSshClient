import React, { useEffect, useState } from 'react';
import { Lock, Save, CheckCircle, Ban, UserCheck, UserX, RefreshCw } from 'lucide-react';

interface UserEntry {
    _id: string;
    displayName: string;
    email: string;
    photo?: string;
    status: 'pending' | 'active' | 'rejected' | 'blocked';
    accessExpiresAt?: string;
    isTempAccess: boolean;
    createdAt: string;
}

const DURATION_OPTIONS = [
    { label: 'Permanent', days: null },
    { label: '1 Week', days: 7 },
    { label: '2 Weeks', days: 14 },
    { label: '1 Month', days: 30 },
];

const STATUS_BADGE: Record<string, string> = {
    pending: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
    active: 'bg-green-500/10 text-green-400 border border-green-500/20',
    rejected: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
    blocked: 'bg-red-500/10 text-red-400 border border-red-500/20',
};

export default function AccessControlPanel() {
    const [users, setUsers] = useState<UserEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDuration, setSelectedDuration] = useState<Record<string, number | null>>({});
    const [approvalRequired, setApprovalRequired] = useState(false);
    const [currentPin, setCurrentPin] = useState('');
    const [newPin, setNewPin] = useState('');
    const [pinSaving, setPinSaving] = useState(false);
    const [pinSaved, setPinSaved] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [usersRes, settingsRes, pinRes] = await Promise.all([
                fetch('/api/access-requests'),
                fetch('/api/settings'),
                fetch('/api/auth/pin'),
            ]);
            const [usersData, settingsData] = await Promise.all([
                usersRes.json(),
                settingsRes.json()
            ]);
            setUsers(usersData);
            setApprovalRequired(settingsData.accessRequestsRequired || false);
            if (pinRes.ok) {
                const pinData = await pinRes.json();
                setCurrentPin(pinData.pin || '');
                setNewPin(pinData.pin || '');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const toggleApprovalRequired = async (newValue: boolean) => {
        setApprovalRequired(newValue);
        await fetch('/api/settings/accessRequestsRequired', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: newValue }),
        });
    };

    const savePin = async () => {
        if (!newPin || newPin.length < 4) return;
        setPinSaving(true);
        setPinSaved(false);
        try {
            const res = await fetch('/api/auth/pin', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin: newPin }),
            });
            if (res.ok) {
                setCurrentPin(newPin);
                setPinSaved(true);
                setTimeout(() => setPinSaved(false), 3000);
            }
        } finally {
            setPinSaving(false);
        }
    };

    const approve = async (userId: string) => {
        const durationDays = selectedDuration[userId] ?? null;
        await fetch(`/api/access-requests/${userId}/approve`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ durationDays }),
        });
        fetchData();
    };

    const reject = async (userId: string) => {
        await fetch(`/api/access-requests/${userId}/reject`, { method: 'PATCH' });
        fetchData();
    };

    const block = async (userId: string) => {
        await fetch(`/api/access-requests/${userId}/block`, { method: 'PATCH' });
        fetchData();
    };

    const unblock = async (userId: string) => {
        await fetch(`/api/access-requests/${userId}/unblock`, { method: 'PATCH' });
        fetchData();
    };

    const revoke = async (userId: string) => {
        await fetch(`/api/access-requests/${userId}/revoke`, { method: 'PATCH' });
        fetchData();
    };

    if (loading) {
        return <div className="flex items-center justify-center h-64 text-zinc-500 text-sm animate-pulse">Loading users...</div>;
    }

    const pending = users.filter(u => u.status === 'pending');
    const active = users.filter(u => u.status === 'active');
    const rejected = users.filter(u => u.status === 'rejected');
    const blocked = users.filter(u => u.status === 'blocked');

    const UserRow = ({ user, showActions = true }: { user: UserEntry; showActions?: boolean }) => (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-lg bg-zinc-900 border border-zinc-800">
            <div className="flex items-center gap-3 flex-1 min-w-0">
                <img
                    src={user.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName)}&background=27272a&color=a1a1aa`}
                    className="w-9 h-9 rounded-full flex-shrink-0"
                    alt={user.displayName}
                />
                <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-zinc-100 truncate">{user.displayName}</div>
                    <div className="text-xs text-zinc-500 truncate">{user.email}</div>
                    {user.accessExpiresAt && (
                        <div className="text-xs text-zinc-600 mt-0.5">
                            Expires: {new Date(user.accessExpiresAt).toLocaleDateString()}
                        </div>
                    )}
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0 ${STATUS_BADGE[user.status]}`}>
                    {user.status}
                </span>
            </div>
            {showActions && (
                <div className="flex items-center gap-1.5 flex-shrink-0 sm:ml-auto overflow-x-auto pb-1 sm:pb-0">
                    {user.status === 'pending' && (
                        <>
                            <select
                                value={selectedDuration[user._id] === undefined ? 'null' : String(selectedDuration[user._id])}
                                onChange={e => setSelectedDuration(prev => ({ ...prev, [user._id]: e.target.value === 'null' ? null : Number(e.target.value) }))}
                                className="text-xs bg-zinc-800 border border-zinc-700 rounded px-1.5 py-1 text-zinc-300 focus:outline-none"
                            >
                                {DURATION_OPTIONS.map(opt => (
                                    <option key={opt.label} value={opt.days === null ? 'null' : String(opt.days)}>{opt.label}</option>
                                ))}
                            </select>
                            <button onClick={() => approve(user._id)} className="text-xs px-2 py-1 bg-green-600 hover:bg-green-500 rounded text-white transition-colors flex items-center gap-1" title="Approve">
                                <UserCheck size={12} /> <span className="hidden sm:inline">Approve</span>
                            </button>
                            <button onClick={() => reject(user._id)} className="text-xs px-2 py-1 bg-orange-600 hover:bg-orange-500 rounded text-white transition-colors flex items-center gap-1" title="Reject">
                                <UserX size={12} /> <span className="hidden sm:inline">Reject</span>
                            </button>
                            <button onClick={() => block(user._id)} className="text-xs px-2 py-1 bg-red-700 hover:bg-red-600 rounded text-white transition-colors" title="Block">
                                <Ban size={12} />
                            </button>
                        </>
                    )}
                    {user.status === 'active' && (
                        <>
                            <button onClick={() => revoke(user._id)} className="text-xs px-2.5 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-zinc-300 transition-colors flex items-center gap-1" title="Revoke Access">
                                <RefreshCw size={12} /> <span className="hidden sm:inline">Revoke</span>
                            </button>
                            <button onClick={() => block(user._id)} className="text-xs px-2 py-1 bg-red-700 hover:bg-red-600 rounded text-white transition-colors" title="Block">
                                <Ban size={12} />
                            </button>
                        </>
                    )}
                    {user.status === 'rejected' && (
                        <>
                            <button onClick={() => approve(user._id)} className="text-xs px-2 py-1 bg-green-600 hover:bg-green-500 rounded text-white transition-colors flex items-center gap-1" title="Approve">
                                <UserCheck size={12} /> <span className="hidden sm:inline">Approve</span>
                            </button>
                            <button onClick={() => block(user._id)} className="text-xs px-2 py-1 bg-red-700 hover:bg-red-600 rounded text-white transition-colors" title="Block Permanently">
                                <Ban size={12} />
                            </button>
                        </>
                    )}
                    {user.status === 'blocked' && (
                        <button onClick={() => unblock(user._id)} className="text-xs px-2.5 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-zinc-300 transition-colors flex items-center gap-1" title="Unblock">
                            <RefreshCw size={12} /> <span className="hidden sm:inline">Unblock</span>
                        </button>
                    )}
                </div>
            )}
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Global Settings Section */}
            <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-semibold text-zinc-200">Require Access Approval</h3>
                        <p className="text-xs text-zinc-500 mt-1">If enabled, new users who sign in via Google will be placed in a 'pending' state until approved here.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={approvalRequired}
                            onChange={(e) => toggleApprovalRequired(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>
            </div>

            {/* Security PIN Section */}
            <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                        <Lock size={18} className="text-blue-400" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-zinc-200">Security PIN</h3>
                        <p className="text-xs text-zinc-500">Users must enter this PIN to access the dashboard after login</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <input
                        type="text"
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500 font-mono tracking-wider"
                        placeholder="Enter PIN"
                        maxLength={10}
                    />
                    <button
                        onClick={savePin}
                        disabled={pinSaving || newPin.length < 4 || newPin === currentPin}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg text-sm transition-colors flex items-center gap-2"
                    >
                        {pinSaving ? 'Saving...' : pinSaved ? <><CheckCircle size={16} /> Saved</> : <><Save size={16} /> Save</>}
                    </button>
                </div>
                {pinSaved && (
                    <p className="text-xs text-green-400 mt-2">PIN updated successfully!</p>
                )}
            </div>

            {/* Pending Users */}
            {pending.length > 0 && (
                <div>
                    <h3 className="text-xs uppercase tracking-wider text-yellow-500 font-semibold mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                        Awaiting Approval ({pending.length})
                    </h3>
                    <div className="space-y-2">
                        {pending.map(u => <UserRow key={u._id} user={u} />)}
                    </div>
                </div>
            )}

            {/* Active Users */}
            {active.length > 0 && (
                <div>
                    <h3 className="text-xs uppercase tracking-wider text-green-500 font-semibold mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        Active Users ({active.length})
                    </h3>
                    <div className="space-y-2">
                        {active.map(u => <UserRow key={u._id} user={u} />)}
                    </div>
                </div>
            )}

            {/* Rejected Users */}
            {rejected.length > 0 && (
                <div>
                    <h3 className="text-xs uppercase tracking-wider text-orange-500 font-semibold mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-orange-500" />
                        Rejected ({rejected.length})
                    </h3>
                    <p className="text-xs text-zinc-500 mb-2">These users were rejected but can be approved later.</p>
                    <div className="space-y-2">
                        {rejected.map(u => <UserRow key={u._id} user={u} />)}
                    </div>
                </div>
            )}

            {/* Blocked Users */}
            {blocked.length > 0 && (
                <div>
                    <h3 className="text-xs uppercase tracking-wider text-red-500 font-semibold mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        Blocked ({blocked.length})
                    </h3>
                    <p className="text-xs text-zinc-500 mb-2">Permanently blocked users cannot login.</p>
                    <div className="space-y-2">
                        {blocked.map(u => <UserRow key={u._id} user={u} />)}
                    </div>
                </div>
            )}

            {users.length === 0 && (
                <div className="text-center text-zinc-600 text-sm py-10">No users have signed up yet.</div>
            )}
        </div>
    );
}
