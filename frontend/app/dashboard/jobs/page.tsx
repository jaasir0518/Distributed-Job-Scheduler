'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { Play, PlayCircle, Clock, CheckCircle2, XCircle, AlertTriangle, HelpCircle, Terminal, Plus, Eye, Ban } from 'lucide-react';

export default function JobsPage() {
  const [queues, setQueues] = useState<any[]>([]);
  const [selectedQueueId, setSelectedQueueId] = useState('');
  const [jobs, setJobs] = useState<any[]>([]);
  const [loadingQueues, setLoadingQueues] = useState(true);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [error, setError] = useState('');

  // Dispatch Form State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [jobName, setJobName] = useState('SEND_EMAIL');
  const [payloadStr, setPayloadStr] = useState('{\n  "to": "user@example.com",\n  "shouldFail": false,\n  "data": {\n    "message": "Welcome back!"\n  }\n}');
  const [priority, setPriority] = useState(0);
  const [delayMs, setDelayMs] = useState(0);
  const [formLoading, setFormLoading] = useState(false);

  // Drilldown Modal
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [executions, setExecutions] = useState<any[]>([]);
  const [selectedExecutionId, setSelectedExecutionId] = useState('');
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const fetchQueues = async () => {
    const projectId = localStorage.getItem('selectedProjectId');
    if (!projectId) return;

    try {
      const res = await api.get(`/queues?projectId=${projectId}`);
      setQueues(res.data);
      if (res.data.length > 0) {
        setSelectedQueueId(res.data[0].id);
      }
    } catch (err: any) {
      console.error(err);
      setError('Failed to fetch project queues.');
    } finally {
      setLoadingQueues(false);
    }
  };

  const fetchJobs = async (qId: string) => {
    if (!qId) return;
    setLoadingJobs(true);
    try {
      const res = await api.get(`/jobs?queueId=${qId}`);
      setJobs(res.data.items || []);
    } catch (err) {
      console.error('Failed to load jobs:', err);
    } finally {
      setLoadingJobs(false);
    }
  };

  useEffect(() => {
    fetchQueues();

    const handleProjectChange = () => {
      setLoadingQueues(true);
      fetchQueues();
    };

    window.addEventListener('projectChanged', handleProjectChange);
    return () => window.removeEventListener('projectChanged', handleProjectChange);
  }, []);

  useEffect(() => {
    if (selectedQueueId) {
      fetchJobs(selectedQueueId);
      const poll = setInterval(() => fetchJobs(selectedQueueId), 3000);
      return () => clearInterval(poll);
    } else {
      setJobs([]);
    }
  }, [selectedQueueId]);

  const handleDispatchJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError('');

    let parsedPayload = {};
    try {
      parsedPayload = JSON.parse(payloadStr);
    } catch (err) {
      alert('Invalid payload format. Must be valid JSON string.');
      setFormLoading(false);
      return;
    }

    try {
      await api.post('/jobs', {
        name: jobName,
        payload: parsedPayload,
        priority,
        queueId: selectedQueueId,
        delayMs: delayMs > 0 ? delayMs : undefined,
      });
      setShowCreateModal(false);
      setPayloadStr('{\n  "to": "user@example.com",\n  "shouldFail": false,\n  "data": {\n    "message": "Welcome back!"\n  }\n}');
      setDelayMs(0);
      setPriority(0);
      fetchJobs(selectedQueueId);
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to dispatch job');
    } finally {
      setFormLoading(false);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to cancel this pending job?')) return;
    try {
      await api.patch(`/jobs/${jobId}/cancel`);
      fetchJobs(selectedQueueId);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to cancel job');
    }
  };

  const handleViewJobDetails = async (job: any) => {
    setSelectedJob(job);
    setSelectedExecutionId('');
    setLogs([]);
    try {
      const res = await api.get(`/jobs/${job.id}/executions`);
      setExecutions(res.data);
      if (res.data.length > 0) {
        handleViewLogs(res.data[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleViewLogs = async (executionId: string) => {
    setSelectedExecutionId(executionId);
    setLoadingLogs(true);
    try {
      const res = await api.get(`/jobs/executions/${executionId}/logs`);
      setLogs(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string, color: string, icon: any }> = {
      PENDING: { label: 'Pending', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: Clock },
      RUNNING: { label: 'Running', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20', icon: PlayCircle },
      COMPLETED: { label: 'Completed', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: CheckCircle2 },
      FAILED: { label: 'Failed', color: 'bg-red-500/10 text-red-400 border-red-500/20', icon: XCircle },
      RETRYING: { label: 'Retrying', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20', icon: Clock },
      CANCELLED: { label: 'Cancelled', color: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20', icon: Ban },
      DEAD: { label: 'Dead (DLQ)', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20', icon: AlertTriangle },
    };

    const target = map[status] || { label: status, color: 'bg-zinc-500/10 text-zinc-400 border-zinc-800', icon: HelpCircle };
    const Icon = target.icon;
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold border ${target.color}`}>
        <Icon className="h-3 w-3" />
        {target.label}
      </span>
    );
  };

  if (loadingQueues) return <div className="text-zinc-400">Loading queues...</div>;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Jobs</h2>
          <p className="text-sm text-zinc-400">Monitor scheduler tasks state transitions and inspect execution outputs</p>
        </div>
        {selectedQueueId && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Dispatch Job
          </button>
        )}
      </div>

      {/* Queue selector */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/15 p-5">
        <label className="text-xs font-semibold text-zinc-400 block mb-2">Select Active Queue</label>
        <select
          value={selectedQueueId}
          onChange={(e) => setSelectedQueueId(e.target.value)}
          className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 outline-none w-full max-w-md focus:border-indigo-500 cursor-pointer"
        >
          {queues.length === 0 ? (
            <option value="">No queues available</option>
          ) : (
            queues.map((q) => (
              <option key={q.id} value={q.id}>
                {q.name} ({q.isActive ? 'Active' : 'Paused'})
              </option>
            ))
          )}
        </select>
      </div>

      {/* Jobs table */}
      {!selectedQueueId ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/10 p-12 text-center">
          <p className="text-sm text-zinc-500">Create a queue first to browse and dispatch jobs.</p>
        </div>
      ) : loadingJobs && jobs.length === 0 ? (
        <div className="text-zinc-500">Querying job records...</div>
      ) : jobs.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/10 p-12 text-center">
          <Terminal className="h-8 w-8 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white">No jobs in queue</h3>
          <p className="text-xs text-zinc-500 max-w-xs mx-auto mt-1">Dispatch an immediate or delayed task using the button above.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-400">
              <thead className="text-xs uppercase text-zinc-500 border-b border-zinc-800 font-semibold">
                <tr>
                  <th className="pb-3">Job Name</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Priority</th>
                  <th className="pb-3 text-right">Execute At</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-zinc-900/10">
                    <td className="py-3 font-semibold text-white">
                      {job.name}
                      {job.scheduledJob && (
                        <span className="ml-2 rounded bg-indigo-500/10 border border-indigo-500/20 text-[10px] px-1 text-indigo-400 font-medium font-mono">
                          {job.scheduledJob.cronExpression ? 'CRON' : 'INTERVAL'}
                        </span>
                      )}
                    </td>
                    <td className="py-3">{getStatusBadge(job.status)}</td>
                    <td className="py-3 text-right font-mono">{job.priority}</td>
                    <td className="py-3 text-right text-xs">
                      {new Date(job.runAt).toLocaleTimeString()}
                    </td>
                    <td className="py-3 text-right space-x-2">
                      <button
                        onClick={() => handleViewJobDetails(job)}
                        title="View Details"
                        className="inline-flex items-center p-1.5 text-indigo-400 hover:bg-indigo-500/10 rounded-lg cursor-pointer transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {(job.status === 'PENDING' || job.status === 'RETRYING') && (
                        <button
                          onClick={() => handleCancelJob(job.id)}
                          title="Cancel Job"
                          className="inline-flex items-center p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg cursor-pointer transition-colors"
                        >
                          <Ban className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dispatch Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white">Dispatch New Job</h3>
              <p className="text-xs text-zinc-500">Submit a job execution task directly to the active queue</p>
            </div>
            <form onSubmit={handleDispatchJob} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-400 block mb-1">Job Type / Name</label>
                  <select
                    value={jobName}
                    onChange={(e) => setJobName(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="SEND_EMAIL">SEND_EMAIL</option>
                    <option value="GENERATE_REPORT">GENERATE_REPORT</option>
                    <option value="SYNC_DATA">SYNC_DATA</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-400 block mb-1">Priority Weight</label>
                  <input
                    type="number"
                    value={priority}
                    onChange={(e) => setPriority(parseInt(e.target.value))}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                    placeholder="0 (higher run first)"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1">Delay Execution (ms)</label>
                <input
                  type="number"
                  min={0}
                  value={delayMs}
                  onChange={(e) => setDelayMs(parseInt(e.target.value))}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                  placeholder="0 (run instantly)"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1">JSON Payload Parameters</label>
                <textarea
                  required
                  value={payloadStr}
                  onChange={(e) => setPayloadStr(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 outline-none focus:border-indigo-500 h-32 font-mono"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-all cursor-pointer disabled:opacity-50"
                >
                  {formLoading ? 'Dispatching...' : 'Dispatch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details / Logs Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl rounded-2xl border border-zinc-800 bg-zinc-900 p-6 space-y-6 flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  Job Audit Details: {selectedJob.name}
                </h3>
                <span className="text-[10px] text-zinc-500 font-mono">Job ID: {selectedJob.id}</span>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold px-3 py-1 cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3 flex-1 overflow-hidden">
              {/* Left Column: Attempt History list */}
              <div className="border-r border-zinc-800 pr-4 space-y-4 overflow-y-auto max-h-[50vh]">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Run Attempt Logs</h4>
                {executions.length === 0 ? (
                  <p className="text-xs text-zinc-600">No attempts recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {executions.map((exec) => (
                      <button
                        key={exec.id}
                        onClick={() => handleViewLogs(exec.id)}
                        className={`w-full text-left p-3 rounded-lg border text-xs font-medium transition-all cursor-pointer block ${
                          selectedExecutionId === exec.id
                            ? 'bg-indigo-600/10 border-indigo-500/20 text-white'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-800/40'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span>Attempt #{exec.attempt}</span>
                          <span className={`text-[10px] font-bold ${
                            exec.status === 'SUCCESS' ? 'text-emerald-400' : 'text-red-400'
                          }`}>{exec.status}</span>
                        </div>
                        <span className="text-[10px] text-zinc-500">
                          Duration: {exec.duration ? `${exec.duration}ms` : 'running...'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Column: Console Log Viewer */}
              <div className="md:col-span-2 flex flex-col overflow-hidden max-h-[50vh]">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-4 flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-indigo-400" /> Log Console Output
                </h4>

                <div className="flex-1 rounded-xl bg-zinc-950 border border-zinc-800 p-4 font-mono text-xs overflow-y-auto max-h-[40vh] flex flex-col gap-1.5">
                  {loadingLogs ? (
                    <span className="text-zinc-600">Syncing live stdout...</span>
                  ) : logs.length === 0 ? (
                    <span className="text-zinc-600">No console output logs found.</span>
                  ) : (
                    logs.map((log) => {
                      const colorMap: Record<string, string> = {
                        INFO: 'text-zinc-300',
                        DEBUG: 'text-indigo-400',
                        WARN: 'text-amber-400',
                        ERROR: 'text-red-400 font-bold',
                      };
                      return (
                        <div key={log.id} className="flex gap-4">
                          <span className="text-zinc-600 shrink-0 select-none">
                            [{new Date(log.timestamp).toLocaleTimeString()}]
                          </span>
                          <span className={`shrink-0 select-none font-bold uppercase w-12 text-[10px] ${
                            log.level === 'ERROR' ? 'text-red-500' : 'text-zinc-500'
                          }`}>
                            {log.level}
                          </span>
                          <span className={colorMap[log.level] || 'text-zinc-300'}>
                            {log.message}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
