import React, { useEffect } from 'react';
import { Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PendingTaskPageProps {
  userEmail: string;
}

const PendingTaskPage: React.FC<PendingTaskPageProps> = ({ userEmail }) => {
  const navigate = useNavigate();

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (userEmail) {
        navigate('/interview/idle');
      } else {
        navigate('/login');
      }
    }, 1500);
    return () => clearTimeout(timeout);
  }, [navigate, userEmail]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-6 w-full max-w-md text-center">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: 'rgba(43, 94, 161, 0.12)' }}>
          <Clock size={24} className="text-blue-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">You have a pending task</h2>
        <p className="text-sm text-gray-600 mb-4">Redirecting you {userEmail ? 'to your interview' : 'to sign in'}...</p>
        <div className="flex items-center justify-center space-x-2 text-blue-600">
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Please wait</span>
        </div>
      </div>
    </div>
  );
};

export default PendingTaskPage;


