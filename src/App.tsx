import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import Login from './Login';
import Layout from './components/Layout';
import LandingPage from './components/LandingPage';
// import ModernLandingPage from './components/ModernLandingPage';
import CandidateDashboard from './components/CandidateDashboard';
import RecruiterDashboard from './components/RecruiterDashboard';
import IdlePage from './components/IdlePage';
import PreparingPage from './components/PreparingPage';
import InterviewPage from './components/InterviewPage';
import CompletedPage from './components/CompletedPage';
// import RecruiterPage from './components/RecruiterPage';
// import PreScreenRecruiterPage from './components/PreScreenRecruiterPage';
import apiService from './services/api';
import InterviewWebRTC from './components/InterviewWebRTC';

interface InterviewScript {
  questions?: Array<{
    id: number;
    question: string;
    answer?: string;
    duration?: number;
  }>;
  totalDuration: number;
  feedback?: string;
  timestamp: string;
  type?: 'pre-screen' | 'technical';
  version?: number;
  transcript?: string;
}

// Wrapper component to handle search params and disallow retake per type
const InterviewPageWrapper: React.FC<{ userEmail: string; onComplete: (script: InterviewScript) => void }> = ({ userEmail, onComplete }) => {
  const [searchParams] = useSearchParams();
  const interviewType = searchParams.get('type') as 'pre-screen' | 'technical' || 'pre-screen';
  const storageKey = (email: string, type?: 'pre-screen' | 'technical') => `interviewScript:${email}:${type || 'pre-screen'}`;
  const hasScript = (() => {
    try {
      return !!localStorage.getItem(storageKey(userEmail, interviewType));
    } catch {
      return false;
    }
  })();
  if (hasScript) {
    return <Navigate to={`/interview/completed?type=${interviewType}`} replace />
  }
  
  return (
    <InterviewPage 
      userEmail={userEmail} 
      onComplete={onComplete}
      interviewType={interviewType}
    />
  );
};

// Wrapper to pick the correct script per type
const CompletedPageWrapper: React.FC<{
  userEmail: string;
  preScreenScript: InterviewScript | null;
  technicalScript: InterviewScript | null;
  onReset: (type: 'pre-screen' | 'technical') => void;
  onUpdateScript: (script: InterviewScript) => void;
}> = ({ userEmail, preScreenScript, technicalScript, onReset, onUpdateScript }) => {
  const [searchParams] = useSearchParams();
  const type = (searchParams.get('type') as 'pre-screen' | 'technical') || (preScreenScript ? 'pre-screen' : 'technical');
  const script = type === 'technical' ? technicalScript : preScreenScript;
  if (!script) {
    return <Navigate to="/" replace />
  }
  return (
    <CompletedPage
      userEmail={userEmail}
      interviewScript={script}
      onReset={() => onReset(type)}
      onUpdateScript={onUpdateScript}
    />
  );
};

function App() {
  const [userEmail, setUserEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [preScreenScript, setPreScreenScript] = useState<InterviewScript | null>(null);
  const [technicalScript, setTechnicalScript] = useState<InterviewScript | null>(null);

  const storageKey = (email: string, type?: 'pre-screen' | 'technical') => `interviewScript:${email}:${type || 'pre-screen'}`;

  const handleLogin = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const result = await apiService.login({ email, password });
      if (result?.email) {
        setUserEmail(result.email);
        try {
          localStorage.setItem('lastUserEmail', result.email);
          if (typeof result.candidate_id === 'number') {
            localStorage.setItem('candidate_id', String(result.candidate_id));
          }
        } catch {}
      }
    } catch (err) {
      console.error('Login failed', err);
      // Optionally show a toast or inline error
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setUserEmail('');
    setPreScreenScript(null);
    setTechnicalScript(null);
  };

  const handleInterviewComplete = (script: InterviewScript) => {
    if (script.type === 'technical') {
      setTechnicalScript(script);
    } else {
      setPreScreenScript(script);
    }
    try {
      if (userEmail) {
        localStorage.setItem(storageKey(userEmail, script.type), JSON.stringify(script));
      }
    } catch {}
  };

  const handleUpdateScript = (updatedScript: InterviewScript) => {
    if (updatedScript.type === 'technical') {
      setTechnicalScript(updatedScript);
    } else {
      setPreScreenScript(updatedScript);
    }
    try {
      if (userEmail) {
        localStorage.setItem(storageKey(userEmail, updatedScript.type), JSON.stringify(updatedScript));
      }
    } catch {}
  };

  const handleReset = (type: 'pre-screen' | 'technical') => {
    if (type === 'technical') {
      setTechnicalScript(null);
      try { if (userEmail) localStorage.removeItem(storageKey(userEmail, 'technical')); } catch {}
    } else {
      setPreScreenScript(null);
      try { if (userEmail) localStorage.removeItem(storageKey(userEmail, 'pre-screen')); } catch {}
    }
  };

  // Load any existing interview for this user when they log in
  useEffect(() => {
    if (!userEmail) return;
    try {
      const pre = localStorage.getItem(storageKey(userEmail, 'pre-screen'));
      if (pre) setPreScreenScript(JSON.parse(pre));
    } catch {}
    try {
      const tech = localStorage.getItem(storageKey(userEmail, 'technical'));
      if (tech) setTechnicalScript(JSON.parse(tech));
    } catch {}
  }, [userEmail]);

  return (
    <Router>
      <div className="h-screen">
        <Routes>
          {/* Login Route */}
          <Route 
            path="/login" 
            element={
              userEmail ? (
                <Navigate to="/" replace />
              ) : (
            <Login onLogin={handleLogin} isLoading={isLoading} />
              )
            } 
          />

          {/* Protected Routes */}
          <Route 
            path="/" 
            element={
              !userEmail ? (
                <Navigate to="/login" replace />
              ) : (
                <Layout userEmail={userEmail} onLogout={handleLogout}>
                  <LandingPage userEmail={userEmail} preScreenScript={preScreenScript} technicalScript={technicalScript} />
                </Layout>
              )
            } 
          />

          {/* New Modern Landing Route */}
          {/* <Route 
            path="/home-modern" 
            element={
              !userEmail ? (
                <Navigate to="/login" replace />
              ) : (
                <Layout userEmail={userEmail} onLogout={handleLogout}>
                  <ModernLandingPage />
                </Layout>
              )
            } 
          /> */}

          <Route 
            path="/interview/idle" 
            element={
              !userEmail ? (
                <Navigate to="/login" replace />
              ) : (
                <Layout userEmail={userEmail} onLogout={handleLogout}>
                  <IdlePage userEmail={userEmail} />
                </Layout>
              )
            } 
          />

          <Route 
            path="/interview/preparing" 
            element={
              !userEmail ? (
                <Navigate to="/login" replace />
              ) : (
                <Layout userEmail={userEmail} onLogout={handleLogout}>
                  <PreparingPage userEmail={userEmail} />
                </Layout>
              )
            } 
          />

          <Route 
            path="/interview/active" 
            element={
              !userEmail ? (
                <Navigate to="/login" replace />
              ) : (
                <Layout userEmail={userEmail} onLogout={handleLogout}>
                  <InterviewPageWrapper 
                    userEmail={userEmail} 
                    onComplete={handleInterviewComplete}
                  />
                </Layout>
              )
            } 
          />

          <Route 
            path="/interview/completed" 
            element={
              !userEmail ? (
                <Navigate to="/login" replace />
              ) : (
                <Layout userEmail={userEmail} onLogout={handleLogout}>
                  <CompletedPageWrapper
                    userEmail={userEmail}
                    preScreenScript={preScreenScript}
                    technicalScript={technicalScript}
                    onReset={handleReset}
                    onUpdateScript={handleUpdateScript}
                  />
                </Layout>
              )
            } 
          />

          {/* Recruiter Route */}
          {/* <Route 
            path="/recruiter" 
            element={
              !userEmail ? (
                <Navigate to="/login" replace />
              ) : (
                <Layout userEmail={userEmail} onLogout={handleLogout}>
                  <RecruiterPage />
                </Layout>
              )
            } 
          />

          {/* Pre-Screen Recruiter Route */}
          <Route 
            path="/webRTC" 
            element={
              !userEmail ? (
                <Navigate to="/login" replace />
              ) : (
                <Layout userEmail={userEmail} onLogout={handleLogout}>
                  <InterviewWebRTC/>
                </Layout>
              )
            } 
          /> 

      
          <Route 
            path="/candidate-dashboard" 
            element={
              !userEmail ? (
                <Navigate to="/login" replace />
              ) : (
                <Layout userEmail={userEmail} onLogout={handleLogout}>
                  <CandidateDashboard />
                </Layout>
              )
            }
          />

          {/* Recruiter Dashboard */}
          <Route 
            path="/recruiter-dashboard" 
            element={
              !userEmail ? (
                <Navigate to="/login" replace />
              ) : (
                <Layout userEmail={userEmail} onLogout={handleLogout}>
                  <RecruiterDashboard />
                </Layout>
              )
            }
          />

          {/* Default redirect */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;