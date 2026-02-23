import React, { useEffect, useState } from 'react';

interface UserEntry {
    _id: string;
    displayName: string;
    email: string;
    photo?: string;
    status: 'pending' | 'active' | 'rejected';
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
    rejected: 'bg-red-500/10 text-red-400 border border-red-500/20',
};

export default function AccessControlPanel() {
    const [users, setUsers] = useState<UserEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDuration, setSelectedDuration] = useState<Record<string, number | null>>({});

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/access-requests');
            const data = await res.json();
            setUsers(data);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchUsers(); }, []);

    const approve = async (userId: string) => {
        const durationDays = selectedDuration[userId] ?? null;
        await fetch(`/api/access-requests/${userId}/approve`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ durationDays }),
        });
        fetchUsers();
    };

    const reject = async (userId: string) => {
        await fetch(`/api/access-requests/${userId}/reject`, { method: 'PATCH' });
        fetchUsers();
    };

    const revoke = async (userId: string) => {
        await fetch(`/api/access-requests/${userId}/revoke`, { method: 'PATCH' });
        fetchUsers();
    };

    if (loading) {
        return <div className="flex items-center justify-center h-64 text-zinc-500 text-sm animate-pulse">Loading users...</div>;
    }

    const pending = users.filter(u => u.status === 'pending');
    const others = users.filter(u => u.status !== 'pending');

    const UserRow = ({ user }: { user: UserEntry }) => (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900 border border-zinc-800">
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
            <div className="flex items-center gap-1.5 flex-shrink-0">
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
                        <button onClick={() => approve(user._id)} className="text-xs px-2.5 py-1 bg-green-600 hover:bg-green-500 rounded text-white transition-colors">Approve</button>
                        <button onClick={() => reject(user._id)} className="text-xs px-2.5 py-1 bg-red-700 hover:bg-red-600 rounded text-white transition-colors">Reject</button>
                    </>
                )}
                {user.status === 'active' && (
                    <button onClick={() => revoke(user._id)} className="text-xs px-2.5 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-zinc-300 transition-colors">Revoke</button>
                )}
                {user.status === 'rejected' && (
                    <button onClick={() => approve(user._id)} className="text-xs px-2.5 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-zinc-300 transition-colors">Restore</button>
                )}
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
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

            {others.length > 0 && (
                <div>
                    <h3 className="text-xs uppercase tracking-wider text-zinc-500 font-semibold mb-3">All Platform Users</h3>
                    <div className="space-y-2">
                        {others.map(u => <UserRow key={u._id} user={u} />)}
                    </div>
                </div>
            )}

            {users.length === 0 && (
                <div className="text-center text-zinc-600 text-sm py-10">No users have signed up yet.</div>
            )}
        </div>
    );
}
