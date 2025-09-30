import React, { useState } from 'react';
import { Home, User, ChevronLeft, ChevronRight, LogOut, FileText, Mic, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
  userEmail: string;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, userEmail, onLogout }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div
        className={`text-white flex flex-col h-full transition-all duration-300 ease-in-out overflow-hidden ${
          isCollapsed ? 'w-16' : 'w-56'
        }`}
        style={{ backgroundColor: 'rgb(52, 77, 109)' }}
      >
        {/* Branding */}
        <div className="p-4 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
          <div className="flex flex-col items-center text-center gap-2">
            <div
              className="w-8 h-8 bg-white rounded flex items-center justify-center font-bold text-sm"
              style={{ color: 'rgb(52, 77, 109)' }}
            >
              R
            </div>
            {!isCollapsed && (
              <>
                <h1 className="font-bold text-sm">RBvoice</h1>
                <p className="text-[10px]" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                  AI-Based Platform
                </p>
              </>
            )}
            {/* Centered toggle button below branding */}
            <button
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="mt-1 w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              title={isCollapsed ? 'Expand' : 'Collapse'}
            >
              {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3">
          <div className="space-y-1">
            {/* Active Navigation Item */}
            <button
              onClick={() => navigate('/')}
              className="w-full flex items-center px-2 py-1.5 rounded bg-white text-[rgb(52,77,109)] hover:bg-white/80 transition-colors"
              title="Home"
            >
              <Home size={16} />
              {!isCollapsed && <span className="text-sm font-medium ml-2">Home</span>}
            </button>
            
            {/* Recruiter Navigation Items */}
            <div className="space-y-1">
              <button
                onClick={() => navigate('/recruiter')}
                className="w-full flex items-center px-2 py-1.5 rounded text-white hover:bg-white/10 transition-colors"
                title="Technical Questions"
              >
                <FileText size={16} />
                {!isCollapsed && <span className="text-sm ml-2">Technical Questions</span>}
              </button>
              <button
                onClick={() => navigate('/pre-screen-recruiter')}
                className="w-full flex items-center px-2 py-1.5 rounded text-white hover:bg-white/10 transition-colors"
                title="Pre-Screen Questions"
              >
                <Mic size={16} />
                {!isCollapsed && <span className="text-sm ml-2">Pre-Screen Questions</span>}
              </button>
              <button
                onClick={() => navigate('/candidate-dashboard')}
                className="w-full flex items-center px-2 py-1.5 rounded text-white hover:bg-white/10 transition-colors"
                title="Candidate Dashboard"
              >
                <User size={16} />
                {!isCollapsed && <span className="text-sm ml-2">Candidate Dashboard</span>}
              </button>
              <button
                onClick={() => navigate('/home-modern')}
                className="w-full flex items-center px-2 py-1.5 rounded text-white hover:bg-white/10 transition-colors"
                title="Modern Landing"
              >
                <Zap size={16} />
                {!isCollapsed && <span className="text-sm ml-2">Modern Landing</span>}
              </button>
              <button
                onClick={() => navigate('/recruiter-dashboard')}
                className="w-full flex items-center px-2 py-1.5 rounded text-white hover:bg-white/10 transition-colors"
                title="Recruiter Dashboard"
              >
                <FileText size={16} />
                {!isCollapsed && <span className="text-sm ml-2">Recruiter Dashboard</span>}
              </button>
            </div>
            
            {/* Inactive Navigation Item */}
            <div className="flex items-center px-2 py-1.5 rounded text-white hover:bg-white/10 transition-colors cursor-pointer">
              <User size={16} />
              {!isCollapsed && <span className="text-sm ml-2">Profile</span>}
            </div>
          </div>
        </nav>

        {/* User Section */}
        <div className="p-3 border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
          <div className="mb-3 p-2 rounded-lg" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
            <div className="flex items-center space-x-2 mb-2">
              <User size={14} style={{ color: 'rgba(255, 255, 255, 0.7)' }} />
              {!isCollapsed && (
                <span className="text-xs" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                  Signed in as
                </span>
              )}
            </div>
            {!isCollapsed && (
              <div className="text-xs text-white font-medium mb-2">
                {userEmail || 'candidate@example.com'}
              </div>
            )}
            <button
              onClick={handleLogout}
              className={`w-full ${isCollapsed ? 'justify-center' : ''} flex items-center text-xs px-2 py-1.5 rounded transition-colors hover:bg-white/20`}
              style={{ color: 'rgba(255, 255, 255, 0.9)', backgroundColor: 'rgba(255, 255, 255, 0.12)' }}
              title="Sign out"
            >
              <LogOut size={14} className={isCollapsed ? '' : 'mr-2'} />
              {!isCollapsed && 'Sign Out'}
            </button>
          </div>
          {!isCollapsed && (
            <div className="text-xs" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
              RBvoice <br />
              Copyright © 2025
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

export default Layout;
