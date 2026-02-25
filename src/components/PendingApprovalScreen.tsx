import React from 'react';
import { Clock, XCircle, Ban } from 'lucide-react';

interface PendingApprovalScreenProps {
    status: 'pending' | 'rejected' | 'blocked';
    email: string;
    onLogout: () => void;
}

export default function PendingApprovalScreen({ status, email, onLogout }: PendingApprovalScreenProps) {
    const getStatusContent = () => {
        switch (status) {
            case 'pending':
                return {
                    icon: <Clock size={32} className="text-yellow-400" />,
                    bgColor: 'bg-yellow-500/10',
                    title: 'Approval Pending',
                    message: 'Your account request has been received. An administrator will review and grant access shortly.',
                };
            case 'rejected':
                return {
                    icon: <XCircle size={32} className="text-orange-400" />,
                    bgColor: 'bg-orange-500/10',
                    title: 'Access Rejected',
                    message: 'Your access request has been declined. You may try again later or contact your administrator.',
                };
            case 'blocked':
                return {
                    icon: <Ban size={32} className="text-red-400" />,
                    bgColor: 'bg-red-500/10',
                    title: 'Account Blocked',
                    message: 'Your account has been blocked. Please contact your administrator for assistance.',
                };
        }
    };

    const content = getStatusContent();

    return (
        <div className="flex h-screen items-center justify-center bg-zinc-950 text-white px-4">
            <div className="max-w-md w-full text-center space-y-6">
                <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${content.bgColor}`}>
                    {content.icon}
                </div>
                <div>
                    <h1 className="text-2xl font-bold mb-2">{content.title}</h1>
                    <p className="text-zinc-400 text-sm">{content.message}</p>
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
