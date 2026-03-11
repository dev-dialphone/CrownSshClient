import React from 'react';
import { Phone, Gauge, TrendingUp, Activity, CheckCircle, XCircle } from 'lucide-react';

interface Summary {
  totalActive: number;
  totalCapacity: number;
  totalCPS: number;
  maxCPS: number;
  usagePercent: number;
  healthyVMs: number;
  errorVMs: number;
  totalVMs: number;
}

interface EnvironmentSummaryProps {
  summary: Summary;
}

export function EnvironmentSummary({ summary }: EnvironmentSummaryProps) {
  const getUsageBarColor = (percent: number) => {
    if (percent >= 90) return 'bg-red-500';
    if (percent >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const showCPS = summary.totalCPS > 0 || summary.maxCPS > 0;
  const showCapacity = summary.totalCapacity > 0;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
        Environment Summary
      </h3>
      <div className={`grid gap-4 ${showCPS && showCapacity ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-3'}`}>
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-zinc-400 text-xs">
            <Phone size={12} />
            Active Calls
          </div>
          <p className="text-2xl font-bold text-zinc-100">
            {summary.totalActive.toLocaleString()}
          </p>
          {showCapacity && (
            <p className="text-xs text-zinc-500">/ {summary.totalCapacity.toLocaleString()} capacity</p>
          )}
        </div>

        {showCPS && (
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-zinc-400 text-xs">
              <Gauge size={12} />
              Total CPS
            </div>
            <p className="text-2xl font-bold text-zinc-100">
              {summary.totalCPS}
            </p>
            <p className="text-xs text-zinc-500">/ {summary.maxCPS}</p>
          </div>
        )}

        {showCapacity && (
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-zinc-400 text-xs">
              <TrendingUp size={12} />
              Usage
            </div>
            <p className="text-2xl font-bold text-zinc-100">
              {summary.usagePercent}%
            </p>
            <div className="w-full bg-zinc-800 rounded-full h-2 mt-1">
              <div
                className={`h-2 rounded-full transition-all ${getUsageBarColor(summary.usagePercent)}`}
                style={{ width: `${Math.min(summary.usagePercent, 100)}%` }}
              />
            </div>
          </div>
        )}

        <div className="space-y-1">
          <div className="flex items-center gap-1 text-zinc-400 text-xs">
            <Activity size={12} />
            VM Status
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="flex items-center gap-1 text-xs text-green-400">
              <CheckCircle size={12} /> {summary.healthyVMs}
            </span>
            {summary.errorVMs > 0 && (
              <span className="flex items-center gap-1 text-xs text-red-400">
                <XCircle size={12} /> {summary.errorVMs}
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-1">{summary.totalVMs} total</p>
        </div>
      </div>
    </div>
  );
}
