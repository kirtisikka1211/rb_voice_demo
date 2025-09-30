import React from 'react';
import { Mic, CheckCircle } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

interface IdlePageProps {
  userEmail: string;
}

const IdlePage: React.FC<IdlePageProps> = ({ userEmail }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const interviewType = searchParams.get('type') || 'pre-screen';

  const beginInterview = () => {
    navigate(`/interview/preparing?type=${interviewType}`);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'rgba(59, 125, 211, 0.1)' }}>
            <Mic size={32} style={{ color: 'rgb(51, 97, 158)' }} />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-3">
            Ready to Begin Your {interviewType === 'technical' ? 'Technical ' : ''}Interview?
          </h3>
          <p className="text-sm text-gray-600 mb-6 max-w-xl mx-auto">
            You're all set! Click the button below to start your {interviewType === 'technical' ? 'technical assessment' : 'AI-powered interview'}. 
            Make sure you're in a quiet environment and your microphone is working properly.
          </p>
          
          <div className="bg-blue-50 rounded-lg p-4 mb-6 max-w-xl mx-auto">
            <h4 className="font-medium text-blue-900 mb-2">Quick Checklist:</h4>
            <ul className="text-left text-blue-800 space-y-1">
              <li className="flex items-center space-x-2">
                <CheckCircle size={14} className="text-green-600" />
                <span className="text-sm">Find a quiet, private location</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle size={14} className="text-green-600" />
                <span className="text-sm">Test your microphone</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle size={14} className="text-green-600" />
                <span className="text-sm">Have a glass of water ready</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle size={14} className="text-green-600" />
                <span className="text-sm">Take a deep breath and relax</span>
              </li>
            </ul>
          </div>

          {/* Browser Compatibility & Validity */}
          <div className="bg-yellow-50 rounded-lg p-4 mb-6 max-w-xl mx-auto">
            <h4 className="font-medium text-yellow-900 mb-2">Instructions:</h4>
            <div className="space-y-3">
              <div>

                <ul className="text-left text-yellow-700 space-y-1 text-sm">
                  <li>• Use Chrome  (Recommended) or Firefox</li>
                  
                
                  <li>• Must be completed in one session</li>
                </ul>
              </div>
              <div>

              
              </div>
            </div>
          </div>

          <button
            onClick={beginInterview}
            className="text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 mx-auto bg-[#2B5EA1] hover:bg-[#244E85]"
          >
            <Mic size={16} className="text-white" />
            <span>Begin </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default IdlePage;
