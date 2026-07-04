'use client';

import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Play, CheckCircle2, XCircle, Clock, AlertTriangle, Cpu, Layers } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function DashboardOverview() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = async () => {
    const projectId = localStorage.getItem('selectedProjectId');
    if (!projectId) return;

    try {
      const res = await api.get(`/metrics/dashboard?projectId=${projectId}`);
      setStats(res.data);
    } catch (err: any) {
      console.error(err);
      setError('Failed to fetch dashboard metrics.');
    } finally {
      setLoading(false);
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
    return <div className="text-zinc-400">Loading dashboard data...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
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
    { title: 'Running', count: jobStats.RUNNING, icon: Cpu, color: 'text-indigo-400 border-indigo-500/20 bg-indigo-500/5' },
    { title: 'Pending', count: jobStats.PENDING, icon: Clock, color: 'text-amber-400 border-amber-500/20 bg-amber-500/5' },
    { title: 'Completed', count: jobStats.COMPLETED, icon: CheckCircle2, color: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' },
    { title: 'Failed (Retrying)', count: jobStats.RETRYING, icon: Clock, color: 'text-orange-400 border-orange-500/20 bg-orange-500/5' },
    { title: 'Dead (DLQ)', count: jobStats.DEAD, icon: AlertTriangle, color: 'text-rose-400 border-rose-500/20 bg-rose-500/5' },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Overview</h2>
        <p className="text-sm text-zinc-400">Real-time throughput and execution metrics for active workloads</p>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className={`rounded-xl border p-5 transition-all ${card.color}`}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium opacity-80">{card.title}</span>
                <Icon className="h-4 w-4 opacity-60" />
              </div>
              <span className="text-3xl font-bold tracking-tight text-white">{card.count}</span>
            </div>
          );
        })}
      </div>

      {/* Chart & Queue Depth */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recharts Area Chart */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-5 lg:col-span-2">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-white">Execution Throughput</h3>
            <span className="text-xs text-zinc-500">Succeeded vs failed job runs over the last 24 hours</span>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.throughput || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="hour" stroke="#71717a" fontSize={11} />
                <YAxis stroke="#71717a" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#fff' }} />
                <Area type="monotone" dataKey="success" name="Completed" stroke="#10b981" fillOpacity={1} fill="url(#colorSuccess)" />
                <Area type="monotone" dataKey="failed" name="Failed" stroke="#ef4444" fillOpacity={1} fill="url(#colorFailed)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Worker Pool Status */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-5 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">Worker Pool</h3>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400 font-semibold border border-emerald-500/20">
                {workerStats.active} / {workerStats.total} Active
              </span>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                <span className="text-sm text-zinc-400 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 inline-block" /> Busy Workers
                </span>
                <span className="font-semibold text-white">{workerStats.busy}</span>
              </div>
              <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                <span className="text-sm text-zinc-400 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block" /> Idle Workers
                </span>
                <span className="font-semibold text-white">{workerStats.idle}</span>
              </div>
              <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                <span className="text-sm text-zinc-400 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-zinc-600 inline-block" /> Offline Workers
                </span>
                <span className="font-semibold text-white">{workerStats.offline}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-lg bg-zinc-900/50 border border-zinc-800 p-3 text-xs text-zinc-500 flex justify-between items-center">
            <span>Pool Load Capacity</span>
            <span className="font-mono text-zinc-300 font-bold">
              {workerStats.workerList.reduce((acc: number, w: any) => acc + w.currentLoad, 0)} /{' '}
              {workerStats.workerList.reduce((acc: number, w: any) => acc + w.concurrencyLimit, 0)} slots
            </span>
          </div>
        </div>
      </div>

      {/* Active Workers Table */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-5">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">Active Workers</h3>
          <span className="text-xs text-zinc-500">Instance parameters and telemetry history</span>
        </div>

        {workerStats.workerList.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-6">No workers currently registered. Start the worker service to begin.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-400">
              <thead className="text-xs uppercase text-zinc-500 border-b border-zinc-800 font-semibold">
                <tr>
                  <th className="pb-3">Worker Name</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Job Capacity</th>
                  <th className="pb-3 text-right">Last Telemetry Check-in</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {workerStats.workerList.map((worker: any) => (
                  <tr key={worker.id} className="hover:bg-zinc-900/10">
                    <td className="py-3 font-semibold text-white">{worker.name}</td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold border ${
                          worker.status === 'IDLE'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : worker.status === 'BUSY'
                            ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                            : 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'
                        }`}
                      >
                        {worker.status}
                      </span>
                    </td>
                    <td className="py-3 text-right font-mono">
                      {worker.currentLoad} / {worker.concurrencyLimit}
                    </td>
                    <td className="py-3 text-right text-xs">
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
