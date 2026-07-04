'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { Layers, Play, Pause, Plus, Sliders, ToggleLeft, ToggleRight, AlertCircle } from 'lucide-react';

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
    if (!projectId) return;

    try {
      const res = await api.get(`/queues?projectId=${projectId}`);
      setQueues(res.data);
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

  const handleCreateQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    const projectId = localStorage.getItem('selectedProjectId');
    if (!projectId) return;

    try {
      const res = await api.post('/queues', {
        name,
        description,
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

  if (loading) return <div className="text-zinc-400">Loading queues...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Queues</h2>
          <p className="text-sm text-zinc-400">Manage message queues, concurrency throttling, and priority dispatching</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-all cursor-pointer"
        >
          <Plus className="h-4 w-4" /> Create Queue
        </button>
      </div>

      {/* Queues List */}
      {queues.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/10 p-12 text-center">
          <Layers className="h-8 w-8 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white">No queues found</h3>
          <p className="text-sm text-zinc-500 max-w-sm mx-auto mt-1">Create your first queue to start scheduling background workers.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {queues.map((queue) => (
            <div key={queue.id} className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-5 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-semibold text-white truncate max-w-[180px]">{queue.name}</h3>
                  <button
                    onClick={() => handleToggleState(queue.id, queue.isActive)}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold border cursor-pointer transition-all ${
                      queue.isActive
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-amber-500/10 hover:text-amber-400 hover:border-amber-500/20'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/20'
                    }`}
                  >
                    {queue.isActive ? (
                      <>
                        <Pause className="h-3 w-3" /> Active
                      </>
                    ) : (
                      <>
                        <Play className="h-3 w-3" /> Paused
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-zinc-500 min-h-[32px] line-clamp-2 mb-4">{queue.description || 'No description provided.'}</p>
              </div>

              <div className="border-t border-zinc-800/60 pt-4 space-y-2">
                <div className="flex justify-between text-xs text-zinc-400">
                  <span className="flex items-center gap-1"><Sliders className="h-3 w-3" /> Max Concurrency</span>
                  <span className="font-semibold text-white">{queue.concurrencyLimit} active jobs</span>
                </div>
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>Priority Sorting</span>
                  <span className="font-semibold text-indigo-400">{queue.priorityEnabled ? 'Enabled' : 'Disabled'}</span>
                </div>
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>Scheduled Jobs</span>
                  <span className="font-semibold text-white">{queue._count.jobs} total</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white">Create New Queue</h3>
              <p className="text-xs text-zinc-500">Add a queue to throttle and run specific background workloads</p>
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
                    <span>{priorityEnabled ? 'High priority first' : 'FIFO'}</span>
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
