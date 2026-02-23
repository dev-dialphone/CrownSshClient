import React from 'react';

interface PendingApprovalScreenProps {
    status: 'pending' | 'rejected';
    email: string;
    onLogout: () => void;
}

export default function PendingApprovalScreen({ status, email, onLogout }: PendingApprovalScreenProps) {
    const isPending = status === 'pending';

    return (
        <div className="flex h-screen items-center justify-center bg-zinc-950 text-white px-4">
            <div className="max-w-md w-full text-center space-y-6">
                <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center text-3xl ${isPending ? 'bg-yellow-500/10' : 'bg-red-500/10'}`}>
                    {isPending ? '⏳' : '🚫'}
                </div>
                <div>
                    <h1 className="text-2xl font-bold mb-2">
                        {isPending ? 'Approval Pending' : 'Access Denied'}
                    </h1>
                    <p className="text-zinc-400 text-sm">
                        {isPending
                            ? 'Your account request has been received. An administrator will review and grant access shortly.'
                            : 'Your access to this platform has been revoked. Please contact your administrator.'}
                    </p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-left text-sm">
                    <div className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Logged in as</div>
                    <div className="text-zinc-200 font-mono truncate">{email}</div>
                </div>
                <button
                    onClick={onLogout}
                    className="w-full py-2.5 px-4 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-300 transition-colors"
                >
                    Sign out and use a different account
                </button>
            </div>
        </div>
    );
}
