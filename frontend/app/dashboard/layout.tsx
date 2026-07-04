'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Layers, Cpu, Play, AlertTriangle, LogOut, FolderGit2 } from 'lucide-react';
import { clearAuthToken, api } from '../../lib/api';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        setUserName(JSON.parse(userData).name);
      } catch (e) {
        setUserName('User');
      }
    }

    // Load projects list
    const fetchProjects = async () => {
      try {
        const profileRes = await api.get('/auth/profile');
        const orgs = profileRes.data.organizations || [];
        if (orgs.length > 0) {
          const firstOrg = orgs[0];
          setProjects(firstOrg.projects || []);
          
          const storedProjId = localStorage.getItem('selectedProjectId');
          if (storedProjId) {
            setSelectedProjectId(storedProjId);
          } else if (firstOrg.projects && firstOrg.projects.length > 0) {
            const firstProjId = firstOrg.projects[0].id;
            setSelectedProjectId(firstProjId);
            localStorage.setItem('selectedProjectId', firstProjId);
          }
        }
      } catch (err) {
        console.error('Failed to load profile/projects:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [router]);

  const handleProjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedProjectId(val);
    localStorage.setItem('selectedProjectId', val);
    // Reload dashboard state by dispatching a storage/custom event
    window.dispatchEvent(new Event('projectChanged'));
  };

  const handleLogout = () => {
    clearAuthToken();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-white font-medium">
        Loading workspace environment...
      </div>
    );
  }

  const navItems = [
    { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Queues', href: '/dashboard/queues', icon: Layers },
    { name: 'Workers', href: '/dashboard/workers', icon: Cpu },
    { name: 'Jobs', href: '/dashboard/jobs', icon: Play },
    { name: 'Dead Letters (DLQ)', href: '/dashboard/dlq', icon: AlertTriangle },
  ];

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-800 bg-zinc-900/40 p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-600/30">
              D
            </div>
            <div>
              <h1 className="font-semibold text-white leading-tight">Job Scheduler</h1>
              <span className="text-xs text-zinc-500">v1.0.0 (Core Engine)</span>
            </div>
          </div>

          {/* Project Switcher */}
          <div className="mb-6">
            <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block mb-1">
              Active Project
            </label>
            <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-300">
              <FolderGit2 className="h-4 w-4 text-indigo-400 shrink-0" />
              <select
                value={selectedProjectId}
                onChange={handleProjectChange}
                className="bg-transparent text-sm w-full outline-none font-medium cursor-pointer"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id} className="bg-zinc-900 text-white">
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20'
                      : 'text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200 border border-transparent'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-indigo-400' : 'text-zinc-500'}`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="border-t border-zinc-800 pt-4 mt-4 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-white max-w-[120px] truncate">{userName}</span>
            <span className="text-[10px] text-zinc-500">Developer Profile</span>
          </div>
          <button
            onClick={handleLogout}
            title="Log out"
            className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
