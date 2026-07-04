'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { AlertTriangle, Play, Trash2, ShieldAlert, Activity, RefreshCw, X, Copy, Check } from 'lucide-react';

export default function DeadLetterQueuePage() {
  const [deadJobs, setDeadJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Inspect Error Modal State
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchDeadJobs = async () => {
    const projectId = localStorage.getItem('selectedProjectId');
    if (!projectId) {
      setLoading(false);
      return;
    }

    try {
      const res = await api.get(`/jobs/dlq?projectId=${projectId}`);
      setDeadJobs(res.data);
      setError('');
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

  const handleCopyStacktrace = () => {
    if (!selectedReason) return;
    navigator.clipboard.writeText(selectedReason).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) return <div className="text-zinc-400 animate-pulse">Loading Dead Letter Queue...</div>;
  if (error) return <div className="text-rose-500">{error}</div>;

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
          <AlertTriangle className="h-6 w-6 text-rose-500" /> Dead Letter Queue (DLQ)
        </h2>
        <p className="text-sm text-zinc-400">Inspect quarantined jobs that exceeded maximum execution attempts and require manual retry</p>
      </div>

      {deadJobs.length === 0 ? (
        <div className="rounded-xl border border-zinc-900 bg-zinc-900/10 p-16 text-center">
          <ShieldAlert className="h-10 w-10 text-zinc-700 mx-auto mb-4" />
          <h3 className="text-base font-semibold text-white font-medium">All clear! No dead lettered jobs</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1.5">Jobs that fail repeatedly after retries will be quarantined here.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-900 bg-zinc-900/10 p-5 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-400">
              <thead className="text-[10px] uppercase text-zinc-500 border-b border-zinc-900 font-bold tracking-wider">
                <tr>
                  <th className="pb-3">Job Name</th>
                  <th className="pb-3">Queue</th>
                  <th className="pb-3 text-right">Attempts</th>
                  <th className="pb-3 text-right">Failed At</th>
                  <th className="pb-3 text-right">Diagnostic</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900/40">
                {deadJobs.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-900/20 transition-colors">
                    <td className="py-3.5">
                      <div className="font-semibold text-white">{item.job.name}</div>
                      <span className="text-[9px] text-zinc-600 font-mono block mt-0.5">ID: {item.jobId}</span>
                    </td>
                    <td className="py-3.5 text-zinc-400">{item.job.queue.name}</td>
                    <td className="py-3.5 text-right font-mono font-bold text-rose-400">{item.retryCount}</td>
                    <td className="py-3.5 text-right font-mono text-zinc-500">
                      {new Date(item.failedAt).toLocaleString()}
                    </td>
                    <td className="py-3.5 text-right">
                      <button
                        onClick={() => setSelectedReason(item.reason)}
                        className="text-[10px] uppercase font-bold text-indigo-400 hover:text-indigo-300 cursor-pointer underline hover:no-underline"
                      >
                        Inspect Error
                      </button>
                    </td>
                    <td className="py-3.5 text-right space-x-1.5">
                      <button
                        onClick={() => handleRetry(item.jobId)}
                        title="Re-queue and Retry Job"
                        className="inline-flex items-center p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded-lg cursor-pointer transition-colors"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.jobId)}
                        title="Delete Permanently"
                        className="inline-flex items-center p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg cursor-pointer transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900 p-6 space-y-4 shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-semibold text-white">Execution Error Stacktrace</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Exceptions recorded during final execution failure</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyStacktrace}
                  className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 hover:text-white bg-zinc-950 border border-zinc-800 hover:border-zinc-700 px-2 py-1 rounded cursor-pointer transition-colors"
                  title="Copy stacktrace to clipboard"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </>
                  )}
                </button>
                <button
                  onClick={() => setSelectedReason(null)}
                  className="rounded-lg bg-zinc-805 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-bold p-1.5 cursor-pointer transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 rounded-xl bg-zinc-950 p-4 font-mono text-xs text-rose-400 border border-zinc-800 overflow-y-auto shadow-inner break-all whitespace-pre-wrap leading-relaxed select-all">
              {selectedReason}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
