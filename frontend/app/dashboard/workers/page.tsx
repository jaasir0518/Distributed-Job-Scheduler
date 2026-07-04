'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { Cpu, RefreshCw, Activity, Database, AlertCircle, HardDrive } from 'lucide-react';

export default function WorkersPage() {
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<any>(null);

  const fetchWorkers = async () => {
    try {
      const res = await api.get('/workers');
      setWorkers(res.data);
    } catch (err: any) {
      console.error(err);
      setError('Failed to fetch worker list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkers();
    
    // Poll every 5s for real-time telemetry updates
    const interval = setInterval(fetchWorkers, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCleanup = async () => {
    setCleanupLoading(true);
    setCleanupResult(null);
    try {
      const res = await api.post('/workers/cleanup');
      setCleanupResult(res.data);
      fetchWorkers();
    } catch (err) {
      console.error(err);
      alert('Orphan cleanup command failed');
    } finally {
      setCleanupLoading(false);
    }
  };

  if (loading && workers.length === 0) return <div className="text-zinc-400">Loading worker telemetry...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Workers</h2>
          <p className="text-sm text-zinc-400">Monitor worker instances, memory limits, and trigger orphan failover sweeps</p>
        </div>
        <button
          onClick={handleCleanup}
          disabled={cleanupLoading}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-all cursor-pointer"
        >
          <RefreshCw className={`h-4 w-4 ${cleanupLoading ? 'animate-spin' : ''}`} />
          {cleanupLoading ? 'Sweeping...' : 'Sweep Dead Workers'}
        </button>
      </div>

      {cleanupResult && (
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4 flex items-start gap-3">
          <Activity className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-emerald-400">Sweep Completed Successfully</h4>
            <p className="text-xs text-zinc-300 mt-1">
              Marked <span className="font-bold text-white">{cleanupResult.recoveredWorkers}</span> offline worker(s) and re-queued{' '}
              <span className="font-bold text-white">{cleanupResult.recoveredJobs}</span> job(s) back to the pending state.
            </p>
          </div>
        </div>
      )}

      {/* Workers Grid */}
      {workers.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/10 p-12 text-center">
          <Cpu className="h-8 w-8 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white">No worker instances connected</h3>
          <p className="text-sm text-zinc-500 max-w-sm mx-auto mt-1">Run the worker service (`npm run start` inside the worker folder) to hook it into the cluster.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {workers.map((worker) => {
            const isOffline = worker.status === 'OFFLINE';
            return (
              <div key={worker.id} className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-5 space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center border ${
                      isOffline ? 'bg-zinc-800/40 border-zinc-700 text-zinc-500' : 'bg-indigo-600/10 border-indigo-500/20 text-indigo-400'
                    }`}>
                      <Cpu className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-white">{worker.name}</h3>
                      <span className="text-[10px] text-zinc-500 font-mono">ID: {worker.id}</span>
                    </div>
                  </div>

                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                    worker.status === 'IDLE'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : worker.status === 'BUSY'
                      ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                      : 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'
                  }`}>
                    {worker.status}
                  </span>
                </div>

                {/* Resource utilization */}
                <div className="grid grid-cols-2 gap-4 border-t border-zinc-800/60 pt-4">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block">Job Capacity Load</span>
                    <div className="flex justify-between text-xs text-zinc-400 mb-1">
                      <span>Utilization</span>
                      <span className="font-mono text-zinc-200">{worker.currentLoad} / {worker.concurrencyLimit} active</span>
                    </div>
                    <div className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden border border-zinc-800">
                      <div
                        className="bg-indigo-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (worker.currentLoad / worker.concurrencyLimit) * 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block">Heartbeat Status</span>
                    <div className="flex justify-between text-xs text-zinc-400">
                      <span>Last Seen</span>
                      <span className="text-zinc-200">{new Date(worker.lastHeartbeatAt).toLocaleTimeString()}</span>
                    </div>
                    <span className="text-[10px] text-zinc-500 block mt-1">
                      {isOffline ? 'Instance considered disconnected.' : 'Responding normally.'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
