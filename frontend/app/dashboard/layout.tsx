'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Layers, Cpu, Play, AlertTriangle, LogOut, FolderGit2, Building2, Plus, X } from 'lucide-react';
import { clearAuthToken, api } from '../../lib/api';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  
  // Org and Project State
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  
  // Creation Modals
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  const router = useRouter();
  const pathname = usePathname();

  const fetchProfileAndOrgs = async () => {
    try {
      const profileRes = await api.get('/auth/profile');
      const orgs = profileRes.data.organizations || [];
      setOrganizations(orgs);
      
      let orgId = localStorage.getItem('selectedOrgId');
      if (!orgId && orgs.length > 0) {
        orgId = orgs[0].id;
        if (orgId) {
          localStorage.setItem('selectedOrgId', orgId);
        }
      }
      setSelectedOrgId(orgId || '');

      if (orgId) {
        const currentOrg = orgs.find((o: any) => o.id === orgId);
        const projs = currentOrg ? currentOrg.projects : [];
        setProjects(projs);
        
        let projId = localStorage.getItem('selectedProjectId');
        if (!projId && projs.length > 0) {
          projId = projs[0].id;
          if (projId) {
            localStorage.setItem('selectedProjectId', projId);
          }
        }
        setSelectedProjectId(projId || '');
      }
    } catch (err) {
      console.error('Failed to load profile/projects:', err);
    } finally {
      setLoading(false);
    }
  };

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

    fetchProfileAndOrgs();
  }, [router]);

  const handleOrgChange = (orgId: string) => {
    setSelectedOrgId(orgId);
    localStorage.setItem('selectedOrgId', orgId);
    
    const currentOrg = organizations.find((o: any) => o.id === orgId);
    const projs = currentOrg ? currentOrg.projects : [];
    setProjects(projs);
    
    if (projs.length > 0) {
      const projId = projs[0].id;
      setSelectedProjectId(projId);
      localStorage.setItem('selectedProjectId', projId);
    } else {
      setSelectedProjectId('');
      localStorage.removeItem('selectedProjectId');
    }
    
    // Notify components of workspace change
    window.dispatchEvent(new Event('projectChanged'));
  };

  const handleProjectChange = (projId: string) => {
    setSelectedProjectId(projId);
    localStorage.setItem('selectedProjectId', projId);
    window.dispatchEvent(new Event('projectChanged'));
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    setCreateLoading(true);
    try {
      const res = await api.post('/organizations', { name: newOrgName });
      const newOrg = { ...res.data, projects: [] };
      const updatedOrgs = [...organizations, newOrg];
      setOrganizations(updatedOrgs);
      setShowOrgModal(false);
      setNewOrgName('');
      handleOrgChange(newOrg.id);
    } catch (err) {
      console.error('Failed to create organization:', err);
      alert('Failed to create organization');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || !selectedOrgId) return;
    setCreateLoading(true);
    try {
      const res = await api.post('/projects', {
        name: newProjectName,
        description: newProjectDesc,
        organizationId: selectedOrgId,
      });
      
      const newProj = res.data;
      const updatedOrgs = organizations.map((o: any) => {
        if (o.id === selectedOrgId) {
          return { ...o, projects: [...(o.projects || []), newProj] };
        }
        return o;
      });
      setOrganizations(updatedOrgs);
      
      const updatedProjects = [...projects, newProj];
      setProjects(updatedProjects);
      
      setShowProjectModal(false);
      setNewProjectName('');
      setNewProjectDesc('');
      
      handleProjectChange(newProj.id);
    } catch (err) {
      console.error('Failed to create project:', err);
      alert('Failed to create project');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleLogout = () => {
    clearAuthToken();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-indigo-400 font-medium">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading workspace environment...</span>
        </div>
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
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-900 bg-zinc-900/10 p-5 flex flex-col justify-between shrink-0">
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-600/30">
              D
            </div>
            <div>
              <h1 className="font-semibold text-white leading-tight">Job Scheduler</h1>
              <span className="text-[10px] text-zinc-500 font-medium tracking-wide">v1.0.0 (Core Engine)</span>
            </div>
          </div>

          {/* Org Selector */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">
                Organization
              </label>
              <button 
                onClick={() => setShowOrgModal(true)} 
                title="Create New Org"
                className="text-zinc-500 hover:text-indigo-400 p-0.5 rounded cursor-pointer transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-1.5 text-zinc-300 focus-within:border-indigo-500 transition-colors">
              <Building2 className="h-4 w-4 text-indigo-400 shrink-0" />
              <select
                value={selectedOrgId}
                onChange={(e) => handleOrgChange(e.target.value)}
                className="bg-transparent text-sm w-full outline-none font-medium cursor-pointer"
              >
                {organizations.length === 0 ? (
                  <option value="" className="bg-zinc-900">No Orgs</option>
                ) : (
                  organizations.map((o) => (
                    <option key={o.id} value={o.id} className="bg-zinc-900 text-white">
                      {o.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Project Selector */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">
                Active Project
              </label>
              <button 
                onClick={() => setShowProjectModal(true)} 
                title="Create New Project"
                className="text-zinc-500 hover:text-indigo-400 p-0.5 rounded cursor-pointer transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-1.5 text-zinc-300 focus-within:border-indigo-500 transition-colors">
              <FolderGit2 className="h-4 w-4 text-indigo-400 shrink-0" />
              <select
                value={selectedProjectId}
                onChange={(e) => handleProjectChange(e.target.value)}
                className="bg-transparent text-sm w-full outline-none font-medium cursor-pointer"
              >
                {projects.length === 0 ? (
                  <option value="" className="bg-zinc-900">No Projects</option>
                ) : (
                  projects.map((p) => (
                    <option key={p.id} value={p.id} className="bg-zinc-900 text-white">
                      {p.name}
                    </option>
                  ))
                )}
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
        <div className="border-t border-zinc-800/60 pt-4 mt-4 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-white max-w-[120px] truncate">{userName}</span>
            <span className="text-[10px] text-zinc-500">Developer Profile</span>
          </div>
          <button
            onClick={handleLogout}
            title="Log out"
            className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="h-4.5 w-4.5" />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8 bg-zinc-950">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>

      {/* Organization Creation Modal */}
      {showOrgModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-semibold text-white">Create Organization</h3>
              <button 
                onClick={() => setShowOrgModal(false)}
                className="text-zinc-400 hover:text-white p-1 rounded cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreateOrg} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1">Organization Name</label>
                <input
                  type="text"
                  required
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                  placeholder="e.g. Acme Corp"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOrgModal(false)}
                  className="rounded-lg bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 cursor-pointer disabled:opacity-50"
                >
                  {createLoading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Project Creation Modal */}
      {showProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-semibold text-white">Create Project Workspace</h3>
              <button 
                onClick={() => setShowProjectModal(false)}
                className="text-zinc-400 hover:text-white p-1 rounded cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                  placeholder="e.g. Email Processing"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1">Description (Optional)</label>
                <textarea
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 h-20 resize-none"
                  placeholder="Brief description of the workspace tasks"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowProjectModal(false)}
                  className="rounded-lg bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 cursor-pointer disabled:opacity-50"
                >
                  {createLoading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
