import React, { useState } from 'react';
import { Bot, Mic, Clock, FileText, ChevronDown, ChevronUp, Upload, Calendar, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface InterviewQuestion {
  id: number;
  question: string;
  answer?: string;
  duration?: number;
}

interface InterviewScript {
  questions?: InterviewQuestion[];
  totalDuration: number;
  feedback?: string;
  timestamp: string;
  type?: 'pre-screen' | 'technical';
}

interface LandingPageProps {
  userEmail: string;
  preScreenScript: InterviewScript | null;
  technicalScript: InterviewScript | null;
}

const LandingPage: React.FC<LandingPageProps> = ({ userEmail, preScreenScript, technicalScript }) => {
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(true);
  const [expandedTask, setExpandedTask] = useState<string | null>('interview');

  const hasCompletedPre = Boolean(preScreenScript);
  const hasCompletedTech = Boolean(technicalScript);
  const isSubmittedPre = (() => {
    try {
      const key = `interviewSubmitted:${userEmail}:pre-screen`;
      return localStorage.getItem(key) === 'true';
    } catch {
      return false;
    }
  })();
  const isSubmittedTech = (() => {
    try {
      const key = `interviewSubmitted:${userEmail}:technical`;
      return localStorage.getItem(key) === 'true';
    } catch {
      return false;
    }
  })();

  const startInterview = () => {
    navigate('/interview/idle');
  };

  const toggleTask = (taskId: string) => {
    setExpandedTask(expandedTask === taskId ? null : taskId);
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Main Dropdown */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Dropdown Header */}
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="w-full p-8 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
        >
          <div className="flex items-center space-x-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <Bot size={32} className="text-blue-600" />
            </div>
            <div>
              <h3 className="text-2xl font-semibold text-gray-900">You have a pending task</h3>
              <p className="text-base text-gray-600">Complete the steps below to continue</p>
            </div>
          </div>
          {isDropdownOpen ? <ChevronUp size={24} className="text-gray-400" /> : <ChevronDown size={24} className="text-gray-400" />}
        </button>

        {/* Dropdown Content */}
        {isDropdownOpen && (
          <div className="border-t border-gray-200 p-8 bg-gray-50">
            <div className="space-y-6">
              {/* Task 1: Pre-screen Interview */}
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <button
                  onClick={() => toggleTask('interview')}
                  className="w-full p-6 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <Mic size={24} className="text-blue-600" />
                    </div>
                    <div>
                      <h4 className="text-lg font-medium text-gray-900">Pre-screen Interview</h4>
                      <p className="text-base text-gray-600">Answer a short set of questions so we can understand your background and experience.</p>
                      <div className="mt-1 flex items-center text-sm text-gray-500">
                        <Clock size={16} className="mr-2 text-blue-600" />
                        Estimated 15–20 minutes
                      </div>
                    </div>
                  </div>
                  {expandedTask === 'interview' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
                
                {expandedTask === 'interview' && (
                  <div className="border-t border-gray-200 p-6 bg-gray-50">
                    <div className="space-y-4">
                      {/* <p className="text-gray-700 text-base leading-relaxed">
                        Make sure you are in a quiet place with a stable internet connection. You can pause between
                        questions. Your responses help us personalize the evaluation and speed up the process.
                      </p> */}
                      <div className="flex items-center space-x-3 text-base text-gray-600">
                        <Calendar size={18} className="text-blue-600" />
                        <span>3 day validity of link</span>
                      </div>
                      <div className="flex items-center space-x-3 text-base text-gray-600">
                        <Eye size={18} className="text-blue-600" />
                        <span>Only can review for 3 days</span>
                      </div>
                      <div className="pt-4">
                        {hasCompletedPre && !isSubmittedPre ? (
                          <button
                            onClick={() => navigate('/interview/completed?type=pre-screen')}
                            className="bg-[#2B5EA1] hover:bg-[#244E85] text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2 text-base"
                          >
                            <FileText size={18} />
                            <span>Review & Submit</span>
                          </button>
                        ) : !hasCompletedPre ? (
                          <button
                            onClick={startInterview}
                            className="bg-[#2B5EA1] hover:bg-[#244E85] text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2 text-base"
                          >
                            <Bot size={18} />
                            <span>Start Interview</span>
                          </button>
                        ) : (
                          <div className="text-sm text-gray-600">Submission received.</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Task 2: Technical Interview */}
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <button
                  onClick={() => toggleTask('technical')}
                  className="w-full p-6 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <FileText size={24} className="text-blue-600" />
                    </div>
                    <div>
                      <h4 className="text-lg font-medium text-gray-900">Technical Interview</h4>
                      <p className="text-base text-gray-600">Complete a technical assessment within the time limit.</p>
                      <div className="mt-1 flex items-center text-sm text-gray-500">
                        <Clock size={16} className="mr-2 text-blue-600" />
                        Timed: 30 minutes
                      </div>
                    </div>
                  </div>
                  {expandedTask === 'technical' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
                
                {expandedTask === 'technical' && (
                  <div className="border-t border-gray-200 p-6 bg-gray-50">
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3 text-base text-gray-600">
                        <Clock size={18} className="text-blue-600" />
                        <span>30-minute time limit</span>
                      </div>
                      <div className="flex items-center space-x-3 text-base text-gray-600">
                        <FileText size={18} className="text-blue-600" />
                        <span>Problem-solving assessment</span>
                      </div>
                      <div className="pt-4">
                        {hasCompletedTech && !isSubmittedTech ? (
                          <button
                            onClick={() => navigate('/interview/completed?type=technical')}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2 text-base"
                          >
                            <FileText size={18} />
                            <span>Review & Submit</span>
                          </button>
                        ) : !hasCompletedTech ? (
                          <button
                            onClick={() => navigate('/interview/idle?type=technical')}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2 text-base"
                          >
                            <FileText size={18} />
                            <span>Start Technical Interview</span>
                          </button>
                        ) : (
                          <div className="text-sm text-gray-600">Submission received.</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Task 3: Upload Documents */}
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <button
                  onClick={() => toggleTask('documents')}
                  className="w-full p-6 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <Upload size={24} className="text-blue-600" />
                    </div>
                    <div>
                      <h4 className="text-lg font-medium text-gray-900">Upload Documents</h4>
                      <p className="text-base text-gray-600">Submit required documents</p>
                    </div>
                  </div>
                  {expandedTask === 'documents' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
                
                {expandedTask === 'documents' && (
                  <div className="border-t border-gray-200 p-6 bg-gray-50">
                    <div className="space-y-4">
                      <div className="text-base text-gray-600">
                        <p>Please upload the following documents:</p>
                        <ul className="mt-3 space-y-2 ml-4">
                          <li>• Resume/CV</li>
                          <li>• Cover Letter</li>
                          <li>• Portfolio (if applicable)</li>
                        </ul>
                      </div>
                      <div className="pt-4">
                        <button className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2 text-base">
                          <Upload size={18} />
                          <span>Upload Documents</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Tips / Reduce vacancy */}
              {/* <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-start space-x-3">
                  <CheckCircle size={18} className="text-green-600 mt-0.5" />
                  <div>
                    <div className="font-medium text-gray-900">Quiet environment</div>
                    <div className="text-sm text-gray-600">Find a calm place to record without interruptions.</div>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle size={18} className="text-green-600 mt-0.5" />
                  <div>
                    <div className="font-medium text-gray-900">Stable internet</div>
                    <div className="text-sm text-gray-600">Ensure your connection is reliable during the interview.</div>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle size={18} className="text-green-600 mt-0.5" />
                  <div>
                    <div className="font-medium text-gray-900">Working microphone</div>
                    <div className="text-sm text-gray-600">Test your mic and speak clearly and naturally.</div>
                  </div>
                </div>
              </div> */}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LandingPage;
