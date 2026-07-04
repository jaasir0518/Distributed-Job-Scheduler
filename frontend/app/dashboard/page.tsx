'use client';

import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Play, CheckCircle2, XCircle, Clock, AlertTriangle, Cpu, Layers, RefreshCw } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function DashboardOverview() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async (isManual = false) => {
    const projectId = localStorage.getItem('selectedProjectId');
    if (!projectId) {
      setLoading(false);
      return;
    }

    if (isManual) setRefreshing(true);
    try {
      const res = await api.get(`/metrics/dashboard?projectId=${projectId}`);
      setStats(res.data);
      setError('');
    } catch (err: any) {
      console.error(err);
      setError('Failed to fetch dashboard metrics. Is the backend running?');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();

    // Setup custom event listener for project changes
    const handleProjectChange = () => {
      setLoading(true);
      fetchStats();
    };

    window.addEventListener('projectChanged', handleProjectChange);
    
    // Auto-refresh every 5 seconds for real-time monitoring
    const pollInterval = setInterval(() => {
      fetchStats();
    }, 5000);

    return () => {
      window.removeEventListener('projectChanged', handleProjectChange);
      clearInterval(pollInterval);
    };
  }, []);

  if (loading && !stats) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="flex justify-between items-center">
          <div className="h-8 bg-zinc-900 rounded w-1/4"></div>
          <div className="h-8 bg-zinc-900 rounded w-24"></div>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-28 bg-zinc-900/60 rounded-xl border border-zinc-900"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="h-80 bg-zinc-900/60 rounded-xl border border-zinc-900 lg:col-span-2"></div>
          <div className="h-80 bg-zinc-900/60 rounded-xl border border-zinc-900"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 border border-zinc-900 rounded-xl bg-zinc-950/40 p-8 text-center max-w-lg mx-auto">
        <AlertTriangle className="h-10 w-10 text-rose-500 mb-4" />
        <h3 className="text-base font-semibold text-white">Metrics Connection Offline</h3>
        <p className="text-sm text-zinc-400 mt-2">{error}</p>
        <button
          onClick={() => { setLoading(true); fetchStats(); }}
          className="mt-6 flex items-center gap-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-4 py-2 text-xs font-semibold text-white transition-all cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Try Reconnecting
        </button>
      </div>
    );
  }

  const jobStats = stats?.jobStats || {
    PENDING: 0,
    RUNNING: 0,
    COMPLETED: 0,
    FAILED: 0,
    RETRYING: 0,
    CANCELLED: 0,
    DEAD: 0,
  };

  const workerStats = stats?.workerStats || {
    total: 0,
    active: 0,
    idle: 0,
    busy: 0,
    offline: 0,
    workerList: [],
  };

  const statCards = [
    { 
      title: 'Running', 
      count: jobStats.RUNNING, 
      icon: Cpu, 
      color: 'text-indigo-400 border-indigo-500/10 bg-indigo-950/10 hover:border-indigo-500/20 hover:shadow-[0_0_15px_-3px_rgba(99,102,241,0.15)]' 
    },
    { 
      title: 'Pending', 
      count: jobStats.PENDING, 
      icon: Clock, 
      color: 'text-amber-400 border-amber-500/10 bg-amber-950/10 hover:border-amber-500/20 hover:shadow-[0_0_15px_-3px_rgba(245,158,11,0.15)]' 
    },
    { 
      title: 'Completed', 
      count: jobStats.COMPLETED, 
      icon: CheckCircle2, 
      color: 'text-emerald-400 border-emerald-500/10 bg-emerald-950/10 hover:border-emerald-500/20 hover:shadow-[0_0_15px_-3px_rgba(16,185,129,0.15)]' 
    },
    { 
      title: 'Retrying', 
      count: jobStats.RETRYING, 
      icon: RefreshCw, 
      color: 'text-orange-400 border-orange-500/10 bg-orange-950/10 hover:border-orange-500/20 hover:shadow-[0_0_15px_-3px_rgba(249,115,22,0.15)]' 
    },
    { 
      title: 'Dead (DLQ)', 
      count: jobStats.DEAD, 
      icon: AlertTriangle, 
      color: 'text-rose-400 border-rose-500/10 bg-rose-950/10 hover:border-rose-500/20 hover:shadow-[0_0_15px_-3px_rgba(244,63,94,0.15)]' 
    },
  ];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 shadow-xl">
          <p className="text-[10px] text-zinc-500 font-semibold mb-1.5 uppercase tracking-wider">Hourly Throughput</p>
          <div className="space-y-1 text-xs">
            <p className="flex justify-between gap-6 font-medium">
              <span className="text-emerald-400">Completed:</span>
              <span className="text-white font-mono">{payload[0].value}</span>
            </p>
            <p className="flex justify-between gap-6 font-medium">
              <span className="text-rose-400">Failed:</span>
              <span className="text-white font-mono">{payload[1].value}</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Overview</h2>
          <p className="text-sm text-zinc-400">Real-time throughput and execution metrics for active workloads</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 border border-emerald-500/20 text-[10px] font-semibold text-emerald-400 select-none">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping inline-block" /> Live Syncing
          </div>
          <button
            onClick={() => fetchStats(true)}
            disabled={refreshing}
            className="p-2 border border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900 rounded-lg text-zinc-400 hover:text-white transition-all duration-200 cursor-pointer disabled:opacity-50"
            title="Manual Reload"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className={`rounded-xl border p-5 shadow-sm transition-all duration-300 transform hover:-translate-y-1 ${card.color}`}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold opacity-70 uppercase tracking-wider">{card.title}</span>
                <Icon className="h-4 w-4 opacity-70" />
              </div>
              <span className="text-3xl font-extrabold tracking-tight text-white font-mono">{card.count}</span>
            </div>
          );
        })}
      </div>

      {/* Chart & Queue Depth */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recharts Area Chart */}
        <div className="rounded-xl border border-zinc-900 bg-zinc-900/10 p-6 lg:col-span-2 shadow-sm">
          <div className="mb-6 flex justify-between items-start">
            <div>
              <h3 className="text-base font-semibold text-white">Execution Throughput</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Succeeded vs failed job runs over the last 24 hours</p>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.throughput || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f23" vertical={false} />
                <XAxis dataKey="hour" stroke="#52525b" fontSize={10} className="font-mono" />
                <YAxis stroke="#52525b" fontSize={10} className="font-mono" allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="success" name="Completed" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorSuccess)" />
                <Area type="monotone" dataKey="failed" name="Failed" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorFailed)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Worker Pool Status */}
        <div className="rounded-xl border border-zinc-900 bg-zinc-900/10 p-6 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-base font-semibold text-white">Worker Pool</h3>
              <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[10px] text-indigo-400 font-bold border border-indigo-500/20">
                {workerStats.active} / {workerStats.total} Active
              </span>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
                <span className="text-xs text-zinc-400 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-indigo-500 inline-block shadow-[0_0_6px_rgba(99,102,241,0.5)]" /> Busy Workers
                </span>
                <span className="font-bold text-white font-mono text-sm">{workerStats.busy}</span>
              </div>
              <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
                <span className="text-xs text-zinc-400 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block shadow-[0_0_6px_rgba(16,185,129,0.5)]" /> Idle Workers
                </span>
                <span className="font-bold text-white font-mono text-sm">{workerStats.idle}</span>
              </div>
              <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
                <span className="text-xs text-zinc-400 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-zinc-600 inline-block" /> Offline Workers
                </span>
                <span className="font-bold text-white font-mono text-sm">{workerStats.offline}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-lg bg-zinc-950/60 border border-zinc-900 p-4 text-xs text-zinc-500 flex justify-between items-center">
            <span>Pool Capacity Slots</span>
            <span className="font-mono text-zinc-300 font-bold">
              {workerStats.workerList.reduce((acc: number, w: any) => acc + w.currentLoad, 0)} /{' '}
              {workerStats.workerList.reduce((acc: number, w: any) => acc + w.concurrencyLimit, 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Active Workers Table */}
      <div className="rounded-xl border border-zinc-900 bg-zinc-900/10 p-6 shadow-sm">
        <div className="mb-5">
          <h3 className="text-base font-semibold text-white">Connected Worker Nodes</h3>
          <p className="text-xs text-zinc-500 mt-0.5">Telemetry metrics and slot concurrency of all workers</p>
        </div>

        {workerStats.workerList.length === 0 ? (
          <div className="py-8 text-center">
            <Cpu className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
            <p className="text-xs text-zinc-500 font-medium">No workers currently registered. Start the worker service to begin.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-400">
              <thead className="text-[10px] uppercase text-zinc-500 border-b border-zinc-900 font-bold tracking-wider">
                <tr>
                  <th className="pb-3 font-semibold">Worker Name</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 text-right font-semibold">Capacity Utilized</th>
                  <th className="pb-3 text-right font-semibold">Last Heatbeat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900/40">
                {workerStats.workerList.map((worker: any) => (
                  <tr key={worker.id} className="hover:bg-zinc-900/20 transition-colors">
                    <td className="py-3.5 font-semibold text-white flex items-center gap-2">
                      <Cpu className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                      {worker.name}
                    </td>
                    <td className="py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                          worker.status === 'IDLE'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : worker.status === 'BUSY'
                            ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                            : 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'
                        }`}
                      >
                        <span className={`h-1 w-1 rounded-full ${
                          worker.status === 'IDLE' ? 'bg-emerald-400 animate-pulse' : worker.status === 'BUSY' ? 'bg-indigo-400' : 'bg-zinc-600'
                        }`} />
                        {worker.status}
                      </span>
                    </td>
                    <td className="py-3.5 text-right font-mono font-medium text-white">
                      {worker.currentLoad} <span className="text-zinc-600">/</span> {worker.concurrencyLimit}
                    </td>
                    <td className="py-3.5 text-right text-zinc-500 font-mono">
                      {new Date(worker.lastHeartbeatAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

