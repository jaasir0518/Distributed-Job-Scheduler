'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { Cpu, RefreshCw, Activity, AlertCircle, HardDrive, LineChart, X, PlayCircle, CheckCircle2, XCircle } from 'lucide-react';
import { ResponsiveContainer, LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip } from 'recharts';

export default function WorkersPage() {
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<any>(null);

  // Detail Modal State
  const [detailedWorkerId, setDetailedWorkerId] = useState<string | null>(null);
  const [detailedWorker, setDetailedWorker] = useState<any>(null);
  const [detailedLoading, setDetailedLoading] = useState(false);

  const fetchWorkers = async () => {
    try {
      const res = await api.get('/workers');
      setWorkers(res.data);
      setError('');
    } catch (err: any) {
      console.error(err);
      setError('Failed to fetch worker list.');
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkerDetails = async (id: string) => {
    try {
      const res = await api.get(`/workers/${id}`);
      setDetailedWorker(res.data);
    } catch (err) {
      console.error('Failed to load worker details:', err);
    }
  };

  useEffect(() => {
    fetchWorkers();
    
    // Poll every 5s for real-time telemetry updates
    const interval = setInterval(fetchWorkers, 5000);
    return () => clearInterval(interval);
  }, []);

  // Poll worker details if modal is open
  useEffect(() => {
    if (!detailedWorkerId) {
      setDetailedWorker(null);
      return;
    }

    setDetailedLoading(true);
    fetchWorkerDetails(detailedWorkerId).finally(() => setDetailedLoading(false));

    const interval = setInterval(() => {
      fetchWorkerDetails(detailedWorkerId);
    }, 5000);

    return () => clearInterval(interval);
  }, [detailedWorkerId]);

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

  const getStatusBadge = (status: string) => {
    const isOffline = status === 'OFFLINE';
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
        status === 'IDLE'
          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
          : status === 'BUSY'
          ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
          : 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'
      }`}>
        <span className={`h-1 w-1 rounded-full ${
          status === 'IDLE' ? 'bg-emerald-400 animate-pulse' : status === 'BUSY' ? 'bg-indigo-400 animate-pulse' : 'bg-zinc-600'
        }`} />
        {status}
      </span>
    );
  };

  if (loading && workers.length === 0) {
    return <div className="text-zinc-400 animate-pulse">Loading worker telemetry...</div>;
  }
  if (error) {
    return <div className="text-rose-500">{error}</div>;
  }

  // Format heartbeats chronologically for charts
  const chartData = detailedWorker?.heartbeats 
    ? [...detailedWorker.heartbeats].reverse().map((hb: any) => ({
        time: new Date(hb.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        cpu: hb.systemLoad != null ? Math.round(hb.systemLoad * 100) : 0,
        memory: hb.memoryUsage != null ? Math.round(hb.memoryUsage) : 0,
      }))
    : [];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Workers</h2>
          <p className="text-sm text-zinc-400">Monitor worker instances, telemetry resource graphs, and execute orphan sweep commands</p>
        </div>
        <button
          onClick={handleCleanup}
          disabled={cleanupLoading}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-all cursor-pointer shadow-md"
        >
          <RefreshCw className={`h-4 w-4 ${cleanupLoading ? 'animate-spin' : ''}`} />
          {cleanupLoading ? 'Sweeping...' : 'Sweep Dead Workers'}
        </button>
      </div>

      {cleanupResult && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 flex items-start gap-3 shadow-lg">
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
        <div className="rounded-xl border border-zinc-900 bg-zinc-900/10 p-16 text-center">
          <Cpu className="h-10 w-10 text-zinc-700 mx-auto mb-4" />
          <h3 className="text-base font-semibold text-white">No active worker instances connected</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1.5">Run the worker service to hook it into the cluster.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {workers.map((worker) => {
            const isOffline = worker.status === 'OFFLINE';
            return (
              <div 
                key={worker.id} 
                onClick={() => setDetailedWorkerId(worker.id)}
                className="rounded-xl border border-zinc-900 bg-zinc-900/10 hover:border-zinc-800 p-5 space-y-5 transition-all duration-300 transform hover:-translate-y-1 shadow-sm cursor-pointer select-none"
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center border ${
                      isOffline ? 'bg-zinc-800/40 border-zinc-800 text-zinc-500' : 'bg-indigo-600/10 border-indigo-500/20 text-indigo-400'
                    }`}>
                      <Cpu className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">{worker.name}</h3>
                      <span className="text-[10px] text-zinc-500 font-mono">ID: {worker.id.slice(0, 8)}...</span>
                    </div>
                  </div>

                  {getStatusBadge(worker.status)}
                </div>

                {/* Resource utilization summary */}
                <div className="grid grid-cols-2 gap-4 border-t border-zinc-900/60 pt-4">
                  <div className="space-y-1.5">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-500 block">Concurrency Capacity</span>
                    <div className="flex justify-between text-xs text-zinc-400 mb-1">
                      <span>Utilized</span>
                      <span className="font-mono text-zinc-200 font-bold">{worker.currentLoad} / {worker.concurrencyLimit}</span>
                    </div>
                    <div className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden border border-zinc-900">
                      <div
                        className="bg-indigo-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (worker.currentLoad / worker.concurrencyLimit) * 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-500 block">Telemetry Contact</span>
                    <div className="flex justify-between text-xs text-zinc-400">
                      <span>Last Seen</span>
                      <span className="text-zinc-200 font-mono">{new Date(worker.lastHeartbeatAt).toLocaleTimeString()}</span>
                    </div>
                    <span className="text-[10px] text-zinc-500 block mt-1">
                      {isOffline ? 'Node considered offline.' : 'Active telemetry stream.'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Telemetry Detail Modal */}
      {detailedWorkerId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-4xl rounded-2xl border border-zinc-800 bg-zinc-900 p-6 space-y-6 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Cpu className="h-5 w-5 text-indigo-400" />
                  Worker Diagnostics: {detailedWorker?.name || 'Loading...'}
                </h3>
                <span className="text-xs text-zinc-500 font-mono">Telemetry Node UUID: {detailedWorkerId}</span>
              </div>
              <button
                onClick={() => setDetailedWorkerId(null)}
                className="rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold p-2 cursor-pointer transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {detailedLoading && !detailedWorker ? (
              <div className="flex items-center justify-center py-16 text-zinc-400">
                <RefreshCw className="h-6 w-6 animate-spin text-indigo-500 mr-2" />
                <span>Fetching heartbeat histories...</span>
              </div>
            ) : (
              <div className="space-y-6 overflow-y-auto flex-1 pr-1">
                {/* Visual Resource Charts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* CPU Usage Chart */}
                  <div className="border border-zinc-800/80 bg-zinc-950/40 p-4 rounded-xl space-y-4">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">System Load (CPU)</h4>
                      <span className="text-2xl font-extrabold text-white font-mono">
                        {chartData.length > 0 ? `${chartData[chartData.length - 1].cpu}%` : '0%'}
                      </span>
                    </div>
                    <div className="h-44 w-full">
                      {chartData.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-xs text-zinc-600">No CPU data</div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <RechartsLineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f1f23" vertical={false} />
                            <XAxis dataKey="time" hide />
                            <YAxis domain={[0, 100]} stroke="#52525b" fontSize={9} className="font-mono" />
                            <RechartsTooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', color: '#fff', fontSize: 11 }} />
                            <Line type="monotone" dataKey="cpu" name="CPU %" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                          </RechartsLineChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  {/* Memory Usage Chart */}
                  <div className="border border-zinc-800/80 bg-zinc-950/40 p-4 rounded-xl space-y-4">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Memory Usage</h4>
                      <span className="text-2xl font-extrabold text-white font-mono">
                        {chartData.length > 0 ? `${chartData[chartData.length - 1].memory} MB` : '0 MB'}
                      </span>
                    </div>
                    <div className="h-44 w-full">
                      {chartData.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-xs text-zinc-600">No memory data</div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <RechartsLineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f1f23" vertical={false} />
                            <XAxis dataKey="time" hide />
                            <YAxis stroke="#52525b" fontSize={9} className="font-mono" />
                            <RechartsTooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', color: '#fff', fontSize: 11 }} />
                            <Line type="monotone" dataKey="memory" name="RAM (MB)" stroke="#06b6d4" strokeWidth={2} dot={false} />
                          </RechartsLineChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                </div>

                {/* Attempt History List */}
                <div className="border border-zinc-800/80 rounded-xl p-5 bg-zinc-950/20">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-4">Latest Handled Attempt Runs</h4>
                  {!detailedWorker?.executions || detailedWorker.executions.length === 0 ? (
                    <p className="text-xs text-zinc-500 py-4 text-center">No runs recorded on this worker node.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-zinc-400">
                        <thead className="text-[10px] uppercase text-zinc-500 border-b border-zinc-800 font-bold tracking-wider">
                          <tr>
                            <th className="pb-2">Attempt Date</th>
                            <th className="pb-2">Status</th>
                            <th className="pb-2 text-right">Attempt Number</th>
                            <th className="pb-2 text-right">Run Duration</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-900/40">
                          {detailedWorker.executions.map((exec: any) => (
                            <tr key={exec.id} className="hover:bg-zinc-900/20 transition-colors">
                              <td className="py-2.5 font-medium text-white font-mono">
                                {new Date(exec.startedAt).toLocaleString()}
                              </td>
                              <td className="py-2.5">
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                                  exec.status === 'SUCCESS'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : exec.status === 'FAILED'
                                    ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                    : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                                }`}>
                                  {exec.status}
                                </span>
                              </td>
                              <td className="py-2.5 text-right font-mono font-medium">#{exec.attempt}</td>
                              <td className="py-2.5 text-right font-mono text-zinc-300">
                                {exec.duration ? `${exec.duration}ms` : 'Pending...'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
