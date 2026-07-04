'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { AlertTriangle, Play, Trash2, ShieldAlert, Activity, RefreshCw } from 'lucide-react';

export default function DeadLetterQueuePage() {
  const [deadJobs, setDeadJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedReason, setSelectedReason] = useState<string | null>(null);

  const fetchDeadJobs = async () => {
    const projectId = localStorage.getItem('selectedProjectId');
    if (!projectId) return;

    try {
      const res = await api.get(`/jobs/dlq?projectId=${projectId}`);
      setDeadJobs(res.data);
    } catch (err: any) {
      console.error(err);
      setError('Failed to fetch dead letter jobs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeadJobs();

    const handleProjectChange = () => {
      setLoading(true);
      fetchDeadJobs();
    };

    window.addEventListener('projectChanged', handleProjectChange);
    return () => window.removeEventListener('projectChanged', handleProjectChange);
  }, []);

  const handleRetry = async (jobId: string) => {
    try {
      await api.post(`/jobs/dlq/${jobId}/retry`);
      setDeadJobs(deadJobs.filter((dj) => dj.jobId !== jobId));
      alert('Job successfully returned to queue for retry.');
    } catch (err) {
      console.error(err);
      alert('Failed to retry job.');
    }
  };

  const handleDelete = async (jobId: string) => {
    if (!confirm('Are you sure you want to permanently delete this dead job?')) return;

    try {
      await api.patch(`/jobs/dlq/${jobId}`);
      setDeadJobs(deadJobs.filter((dj) => dj.jobId !== jobId));
    } catch (err) {
      console.error(err);
      alert('Failed to delete job.');
    }
  };

  if (loading) return <div className="text-zinc-400">Loading Dead Letter Queue...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-rose-500" /> Dead Letter Queue (DLQ)
        </h2>
        <p className="text-sm text-zinc-400">Manage jobs that exceeded maximum execution attempts and require manual inspection</p>
      </div>

      {deadJobs.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/10 p-12 text-center">
          <ShieldAlert className="h-8 w-8 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white font-medium">All clear! No dead lettered jobs</h3>
          <p className="text-sm text-zinc-500 max-w-sm mx-auto mt-1">Jobs that fail repeatedly after retries will be quarantined here.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-400">
              <thead className="text-xs uppercase text-zinc-500 border-b border-zinc-800 font-semibold">
                <tr>
                  <th className="pb-3">Job Name</th>
                  <th className="pb-3">Queue</th>
                  <th className="pb-3 text-right">Attempts</th>
                  <th className="pb-3 text-right">Failed At</th>
                  <th className="pb-3 text-right">Reason</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {deadJobs.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-900/10">
                    <td className="py-3 font-semibold text-white">{item.job.name}</td>
                    <td className="py-3 text-zinc-400">{item.job.queue.name}</td>
                    <td className="py-3 text-right font-mono">{item.retryCount}</td>
                    <td className="py-3 text-right text-xs">
                      {new Date(item.failedAt).toLocaleString()}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => setSelectedReason(item.reason)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer underline"
                      >
                        Inspect Error
                      </button>
                    </td>
                    <td className="py-3 text-right space-x-2">
                      <button
                        onClick={() => handleRetry(item.jobId)}
                        title="Retry/Re-queue Job"
                        className="inline-flex items-center p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded-lg cursor-pointer transition-colors"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.jobId)}
                        title="Delete Job"
                        className="inline-flex items-center p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg cursor-pointer transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Inspect Reason Modal */}
      {selectedReason && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-semibold text-white">Execution Error Stacktrace</h3>
              <button
                onClick={() => setSelectedReason(null)}
                className="rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold px-3 py-1 cursor-pointer"
              >
                Close
              </button>
            </div>
            <div className="rounded-lg bg-zinc-950 p-4 font-mono text-xs text-rose-400 border border-zinc-800 overflow-y-auto max-h-60 break-words whitespace-pre-wrap">
              {selectedReason}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
