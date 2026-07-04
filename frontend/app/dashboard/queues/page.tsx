'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { Layers, Play, Pause, Plus, Sliders, ToggleLeft, ToggleRight, Loader2, ArrowUpDown, X } from 'lucide-react';

export default function QueuesPage() {
  const [queues, setQueues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Form State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [concurrencyLimit, setConcurrencyLimit] = useState(5);
  const [priorityEnabled, setPriorityEnabled] = useState(true);
  const [formLoading, setFormLoading] = useState(false);

  const fetchQueues = async () => {
    const projectId = localStorage.getItem('selectedProjectId');
    if (!projectId) {
      setLoading(false);
      return;
    }

    try {
      const res = await api.get(`/queues?projectId=${projectId}`);
      setQueues(res.data);
      setError('');
    } catch (err: any) {
      console.error(err);
      setError('Failed to load project queues.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueues();

    const handleProjectChange = () => {
      setLoading(true);
      fetchQueues();
    };

    window.addEventListener('projectChanged', handleProjectChange);
    return () => window.removeEventListener('projectChanged', handleProjectChange);
  }, []);

  const handleToggleState = async (queueId: string, currentActive: boolean) => {
    try {
      await api.patch(`/queues/${queueId}`, { isActive: !currentActive });
      setQueues(queues.map(q => q.id === queueId ? { ...q, isActive: !currentActive } : q));
    } catch (err) {
      console.error('Failed to toggle queue state:', err);
      alert('Error updating queue status');
    }
  };

  const handleTogglePriority = async (queueId: string, currentPriority: boolean) => {
    try {
      await api.patch(`/queues/${queueId}`, { priorityEnabled: !currentPriority });
      setQueues(queues.map(q => q.id === queueId ? { ...q, priorityEnabled: !currentPriority } : q));
    } catch (err) {
      console.error('Failed to toggle priority:', err);
      alert('Error updating priority mode');
    }
  };

  const handleAdjustConcurrency = async (queueId: string, newLimit: number) => {
    if (newLimit < 1) return;
    try {
      // Optimistic update
      setQueues(queues.map(q => q.id === queueId ? { ...q, concurrencyLimit: newLimit } : q));
      await api.patch(`/queues/${queueId}`, { concurrencyLimit: newLimit });
    } catch (err) {
      console.error('Failed to adjust concurrency:', err);
      alert('Error adjusting concurrency limit');
      fetchQueues(); // rollback
    }
  };

  const handleCreateQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    const projectId = localStorage.getItem('selectedProjectId');
    if (!projectId) return;

    try {
      const res = await api.post('/queues', {
        name: name.trim(),
        description: description.trim(),
        concurrencyLimit,
        priorityEnabled,
        projectId,
      });
      setQueues([...queues, { ...res.data, _count: { jobs: 0 } }]);
      setShowCreateModal(false);
      setName('');
      setDescription('');
      setConcurrencyLimit(5);
      setPriorityEnabled(true);
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to create queue');
    } finally {
      setFormLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-zinc-400">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500 mr-2" />
        <span>Loading queues...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-6 text-center text-rose-400">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Queues</h2>
          <p className="text-sm text-zinc-400">Manage message queues, concurrency throttling, and priority dispatching</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-all cursor-pointer shadow-md"
        >
          <Plus className="h-4 w-4" /> Create Queue
        </button>
      </div>

      {/* Queues List */}
      {queues.length === 0 ? (
        <div className="rounded-xl border border-zinc-900 bg-zinc-900/10 p-16 text-center">
          <Layers className="h-10 w-10 text-zinc-700 mx-auto mb-4" />
          <h3 className="text-base font-semibold text-white">No active queues found</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1.5">Create your first queue to start scheduling background workers.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {queues.map((queue) => (
            <div key={queue.id} className="rounded-xl border border-zinc-900 bg-zinc-900/10 hover:border-zinc-800 p-5 flex flex-col justify-between transition-all duration-300 transform hover:-translate-y-1 shadow-sm">
              <div>
                <div className="flex justify-between items-start mb-3 gap-4">
                  <h3 className="text-base font-semibold text-white truncate" title={queue.name}>
                    {queue.name}
                  </h3>
                  <button
                    onClick={() => handleToggleState(queue.id, queue.isActive)}
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold border cursor-pointer transition-all ${
                      queue.isActive
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-amber-500/10 hover:text-amber-400 hover:border-amber-500/20'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/20'
                    }`}
                  >
                    <span className={`h-1 w-1 rounded-full ${queue.isActive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                    {queue.isActive ? 'Active' : 'Paused'}
                  </button>
                </div>
                <p className="text-xs text-zinc-500 min-h-[32px] line-clamp-2 mb-4 leading-normal">
                  {queue.description || 'No description provided.'}
                </p>
              </div>

              <div className="border-t border-zinc-900/60 pt-4 space-y-3.5">
                {/* Concurrency Inline Editor */}
                <div className="flex justify-between items-center text-xs text-zinc-400">
                  <span className="flex items-center gap-1.5"><Sliders className="h-3.5 w-3.5 text-zinc-500" /> Max Concurrency</span>
                  <div className="flex items-center gap-1.5 bg-zinc-950 px-2 py-0.5 rounded-lg border border-zinc-900">
                    <button
                      onClick={() => handleAdjustConcurrency(queue.id, queue.concurrencyLimit - 1)}
                      className="text-zinc-500 hover:text-white px-1 font-bold text-sm cursor-pointer select-none transition-colors"
                      title="Decrease"
                    >
                      -
                    </button>
                    <span className="font-mono text-white font-bold min-w-[20px] text-center">{queue.concurrencyLimit}</span>
                    <button
                      onClick={() => handleAdjustConcurrency(queue.id, queue.concurrencyLimit + 1)}
                      className="text-zinc-500 hover:text-white px-1 font-bold text-sm cursor-pointer select-none transition-colors"
                      title="Increase"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Priority Sorting Inline Toggle */}
                <div className="flex justify-between items-center text-xs text-zinc-400">
                  <span className="flex items-center gap-1.5"><ArrowUpDown className="h-3.5 w-3.5 text-zinc-500" /> Dispatch Order</span>
                  <button
                    onClick={() => handleTogglePriority(queue.id, queue.priorityEnabled)}
                    className={`font-semibold cursor-pointer text-[10px] uppercase px-2 py-0.5 rounded border transition-colors ${
                      queue.priorityEnabled 
                        ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20' 
                        : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700'
                    }`}
                  >
                    {queue.priorityEnabled ? 'Priority Weight' : 'FIFO'}
                  </button>
                </div>

                {/* Scheduled Jobs Counter */}
                <div className="flex justify-between items-center text-xs text-zinc-400">
                  <span>Active Jobs</span>
                  <span className="font-bold text-white font-mono">{queue._count.jobs} total</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 space-y-6 shadow-2xl">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-semibold text-white">Create New Queue</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Add a queue to throttle and run specific background workloads</p>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="text-zinc-400 hover:text-white p-1 rounded cursor-pointer transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreateQueue} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1">Queue Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                  placeholder="e.g. email-delivery-queue"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 h-20 resize-none"
                  placeholder="What tasks run in this queue?"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-400 block mb-1">Max Concurrency</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={concurrencyLimit}
                    onChange={(e) => setConcurrencyLimit(parseInt(e.target.value))}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="flex flex-col justify-end pb-1">
                  <label className="text-xs font-semibold text-zinc-400 block mb-2">Enable Priority</label>
                  <button
                    type="button"
                    onClick={() => setPriorityEnabled(!priorityEnabled)}
                    className="flex items-center gap-2 text-sm text-zinc-300 font-medium select-none cursor-pointer"
                  >
                    {priorityEnabled ? (
                      <ToggleRight className="h-6 w-6 text-indigo-500" />
                    ) : (
                      <ToggleLeft className="h-6 w-6 text-zinc-600" />
                    )}
                    <span>{priorityEnabled ? 'Priority sorting' : 'FIFO'}</span>
                  </button>
                </div>
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
                  {formLoading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
