import React, { useEffect, useState } from 'react';
import { TagRequest } from '../types';
import { Tag, CheckCircle, XCircle, Clock, RefreshCw, AlertCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '';

const TagRequestsPanel: React.FC = () => {
  const [requests, setRequests] = useState<TagRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/tags/requests/${filter === 'all' ? 'all' : 'pending'}?status=${filter !== 'all' ? filter : ''}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch (err) {
      console.error('Failed to fetch tag requests:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [filter]);

  const handleReview = async (requestId: string, approved: boolean) => {
    setProcessingId(requestId);
    try {
      const res = await fetch(`${API_URL}/api/tags/requests/${requestId}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ approved }),
      });

      if (res.ok) {
        fetchRequests();
      }
    } catch (err) {
      console.error('Failed to review request:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs">
            <Clock size={10} /> Pending
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">
            <CheckCircle size={10} /> Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs">
            <XCircle size={10} /> Rejected
          </span>
        );
      default:
        return null;
    }
  };

  const getRequestTypeBadge = (type: string) => {
    return type === 'add' ? (
      <span className="text-green-400 text-xs">Add</span>
    ) : (
      <span className="text-red-400 text-xs">Remove</span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-zinc-100">Tag Requests</h2>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-300 focus:outline-none focus:border-blue-500"
          >
            <option value="pending">Pending</option>
            <option value="all">All</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <button
            onClick={fetchRequests}
            disabled={isLoading}
            className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw size={24} className="animate-spin text-blue-400" />
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-zinc-500">
          <AlertCircle size={32} className="mb-2 opacity-50" />
          <p>No tag requests found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map((request) => (
            <div
              key={request._id}
              className="bg-zinc-900 border border-zinc-800 rounded-lg p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Tag size={14} className="text-zinc-500" />
                    <span className="text-sm font-medium text-zinc-200">{request.vmName}</span>
                    <span className="text-xs text-zinc-500">{request.vmIp}</span>
                    {getStatusBadge(request.status)}
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <div>
                      <span className="text-zinc-500">Requester:</span>
                      <span className="ml-1 text-zinc-300">{request.requestedByEmail}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500">Type:</span>
                      <span className="ml-1">{getRequestTypeBadge(request.requestType)}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500">Tag:</span>
                      <span className="ml-1 text-zinc-300">"{request.tagText}"</span>
                    </div>
                  </div>

                  <div className="text-xs text-zinc-500 mt-2">
                    Created: {new Date(request.createdAt).toLocaleString()}
                  </div>

                  {request.status !== 'pending' && request.reviewedByEmail && (
                    <div className="text-xs text-zinc-500 mt-1">
                      Reviewed by {request.reviewedByEmail} on{' '}
                      {request.reviewedAt ? new Date(request.reviewedAt).toLocaleString() : 'N/A'}
                    </div>
                  )}
                </div>

                {request.status === 'pending' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleReview(request._id, true)}
                      disabled={processingId === request._id}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-zinc-700 disabled:text-zinc-500 rounded text-sm font-medium transition-colors"
                    >
                      <CheckCircle size={14} /> Approve
                    </button>
                    <button
                      onClick={() => handleReview(request._id, false)}
                      disabled={processingId === request._id}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-zinc-700 disabled:text-zinc-500 rounded text-sm font-medium transition-colors"
                    >
                      <XCircle size={14} /> Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TagRequestsPanel;
