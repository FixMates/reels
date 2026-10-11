import React, { useState, useEffect } from 'react';
import { Project, SystemHealth } from './types/project';
import { api } from './api/client';
import { Navbar } from './components/Navbar';
import { SystemHealthModal } from './components/SystemHealthModal';
import { NewProjectModal } from './pages/NewProjectModal';
import { DashboardPage } from './pages/DashboardPage';
import { StudioPage } from './pages/StudioPage';

export function App() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'studio'>('dashboard');
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<string>('browser');
  const [isHealthOpen, setIsHealthOpen] = useState(false);
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [health, setHealth] = useState<SystemHealth | null>(null);

  const refreshHealth = async () => {
    try {
      const h = await api.getSystemHealth();
      setHealth(h);
    } catch (err) {
      console.error('Failed to get system health:', err);
    }
  };

  useEffect(() => {
    refreshHealth();
  }, []);

  const handleOpenProject = async (projectId: string) => {
    try {
      const p = await api.getProject(projectId);
      setActiveProject(p);
      setActiveTab(p.scenes.length > 0 ? 'editor' : 'browser');
      setCurrentView('studio');
    } catch (err: any) {
      alert(`Could not open project: ${err.message}`);
    }
  };

  const handleProjectCreated = (newProject: Project) => {
    setActiveProject(newProject);
    setActiveTab('browser'); // Start with media upload
    setCurrentView('studio');
  };

  return (
    <div className="min-h-screen bg-studio-950 text-slate-100 flex flex-col">
      {/* Universal Top Studio Navbar */}
      <Navbar
        project={currentView === 'studio' ? activeProject : null}
        onBackToDashboard={() => setCurrentView('dashboard')}
        onOpenHealth={() => setIsHealthOpen(true)}
        onTriggerRender={() => setActiveTab('export')}
        health={health}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        {currentView === 'dashboard' && (
          <DashboardPage
            onOpenNewProjectModal={() => setIsNewProjectOpen(true)}
            onOpenProject={handleOpenProject}
            onOpenHealth={() => setIsHealthOpen(true)}
            health={health}
          />
        )}

        {currentView === 'studio' && activeProject && (
          <StudioPage
            project={activeProject}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onProjectUpdate={setActiveProject}
          />
        )}
      </main>

      {/* Diagnostics Modal */}
      <SystemHealthModal
        health={health}
        isOpen={isHealthOpen}
        onClose={() => setIsHealthOpen(false)}
        onRefresh={refreshHealth}
      />

      {/* New Project Wizard Modal */}
      <NewProjectModal
        isOpen={isNewProjectOpen}
        onClose={() => setIsNewProjectOpen(false)}
        onProjectCreated={handleProjectCreated}
      />
    </div>
  );
}

export default App;
