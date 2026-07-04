'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlayCircle, ShieldAlert, Cpu, Layers } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      setHasToken(!!token);
    }
  }, []);

  const handleLaunch = () => {
    if (hasToken) {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
  };

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-950 font-sans min-h-screen relative overflow-hidden">
      {/* Decorative gradient glowing orb */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />
      
      <main className="relative flex flex-col items-center justify-center max-w-4xl text-center px-6 py-20 space-y-12">
        {/* Branding header */}
        <div className="space-y-4">
          <div className="mx-auto h-12 w-12 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-white shadow-xl shadow-indigo-600/30 text-xl">
            D
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Distributed <span className="text-indigo-400">Job Scheduler</span>
          </h1>
          <p className="max-w-2xl mx-auto text-sm sm:text-base text-zinc-400 font-medium leading-relaxed">
            A state-of-the-art telemetry-driven background job scheduler. Scale your execution workflows, configure concurrency limits, monitor live worker nodes, and recover dead letter quarantined tasks.
          </p>
        </div>

        {/* Action Button */}
        <div>
          <button
            onClick={handleLaunch}
            className="group relative inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white hover:bg-indigo-500 transition-all duration-300 cursor-pointer shadow-lg hover:shadow-indigo-600/20 active:scale-95"
          >
            Launch Developer Console
            <PlayCircle className="h-4.5 w-4.5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl border-t border-zinc-900/60 pt-12 text-left">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-white font-semibold text-sm">
              <Cpu className="h-4 w-4 text-indigo-400" />
              <span>Telemetry Monitoring</span>
            </div>
            <p className="text-xs text-zinc-500 leading-normal">
              Inspect worker CPU/Memory usage metrics over time using live diagnostic visualizers.
            </p>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-white font-semibold text-sm">
              <Layers className="h-4 w-4 text-indigo-400" />
              <span>Workload Throttling</span>
            </div>
            <p className="text-xs text-zinc-500 leading-normal">
              Change queue parameters and concurrency limits dynamically without deployment rebuilds.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-white font-semibold text-sm">
              <ShieldAlert className="h-4 w-4 text-indigo-400" />
              <span>Fault Failover</span>
            </div>
            <p className="text-xs text-zinc-500 leading-normal">
              Sweep dead workers, recover interrupted attempts automatically, and debug with standard trace logs.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="absolute bottom-6 text-[10px] text-zinc-600 font-mono tracking-wider">
        CORE SCHEDULING PLATFORM v1.0.0
      </footer>
    </div>
  );
}
