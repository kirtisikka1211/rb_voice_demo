import React, { useEffect } from 'react';
import { Bot, Loader2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiService } from '../services/api';

interface PreparingPageProps {
  userEmail: string;
}

const PreparingPage: React.FC<PreparingPageProps> = ({ userEmail }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const interviewType = searchParams.get('type') || 'pre-screen';

  useEffect(() => {
    // No backend bot preload. Realtime session will be configured on connect from InterviewPage.
    const timer = setTimeout(() => {
      navigate(`/interview/active?type=${interviewType}`);
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate, interviewType]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-4">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Bot size={24} className="text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-1">
            Preparing Your {interviewType === 'technical' ? 'Technical ' : ''}Interview
          </h3>
          <p className="text-sm text-gray-600">
            Our AI assistant is getting everything ready for you
          </p>
        </div>

        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <Loader2 size={32} className="text-blue-600 animate-spin" />
          </div>
        </div>

        <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">What's happening:</h4>
          <div className="space-y-2 text-xs text-blue-800">
            <div className="flex items-center space-x-2">
              
              
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
              <span>Loading interview questions</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
              <span>Setting up recording environment</span>
            </div>
          </div>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '75%' }}></div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center space-x-2 mb-3">
          <div className="w-4 h-4 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-xs font-medium text-blue-600">⏱</span>
          </div>
          <h4 className="text-sm font-semibold text-gray-900">Almost Ready</h4>
        </div>
        <div className="space-y-2 text-xs text-gray-600">
          <p>• This will only take a few moments</p>
          <p>• Please don't refresh the page</p>
          <p>• Your interview will start automatically</p>
        </div>
      </div>
    </div>
  );
};

export default PreparingPage;
