import React, { useEffect, useState } from 'react';

interface AuditEntry {
    _id: string;
    actorEmail: string;
    actorRole: string;
    action: string;
    target?: string;
    metadata?: Record<string, unknown>;
    createdAt: string;
}

const ACTION_STYLES: Record<string, string> = {
    LOGIN: 'text-blue-400',
    LOGOUT: 'text-zinc-500',
    COMMAND_EXECUTED: 'text-emerald-400',
    VM_CREATED: 'text-green-400',
    VM_UPDATED: 'text-yellow-400',
    VM_DELETED: 'text-red-400',
    ENV_DELETED: 'text-red-400',
    USER_APPROVED: 'text-green-400',
    USER_REJECTED: 'text-red-400',
    USER_REVOKED: 'text-orange-400',
    SETTING_UPDATED: 'text-purple-400',
};

export default function AuditLogView() {
    const [logs, setLogs] = useState<AuditEntry[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const LIMIT = 50;

    const fetchLogs = async (pg: number) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/audit-logs?page=${pg}&limit=${LIMIT}`);
            const data = await res.json();
            setLogs(data.logs || []);
            setTotal(data.total || 0);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchLogs(page); }, [page]);

    const totalPages = Math.ceil(total / LIMIT);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Platform Activity</h3>
                <span className="text-xs text-zinc-600">{total} total events</span>
            </div>

            {loading ? (
                <div className="text-center text-zinc-600 text-sm py-10 animate-pulse">Loading logs...</div>
            ) : logs.length === 0 ? (
                <div className="text-center text-zinc-600 text-sm py-10">No activity logged yet.</div>
            ) : (
                <div className="space-y-1.5">
                    {logs.map(log => (
                        <div key={log._id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800/60 text-xs">
                            <span className="text-zinc-600 font-mono flex-shrink-0 pt-0.5 w-32 truncate" title={new Date(log.createdAt).toLocaleString()}>
                                {new Date(log.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                <span className="text-zinc-700 ml-1">{new Date(log.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                            </span>
                            <span className={`font-mono font-semibold flex-shrink-0 w-36 truncate ${ACTION_STYLES[log.action] ?? 'text-zinc-300'}`}>
                                {log.action}
                            </span>
                            <span className="text-zinc-400 truncate flex-1">
                                <span className="text-zinc-200">{log.actorEmail}</span>
                                {log.target && <> → <span className="text-zinc-300 italic">{log.target}</span></>}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${log.actorRole === 'admin' ? 'bg-purple-500/10 text-purple-400' : 'bg-zinc-800 text-zinc-500'}`}>
                                {log.actorRole}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                    <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                        className="text-xs px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 transition-colors">
                        ← Prev
                    </button>
                    <span className="text-xs text-zinc-500">{page} / {totalPages}</span>
                    <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                        className="text-xs px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 transition-colors">
                        Next →
                    </button>
                </div>
            )}
        </div>
    );
}
