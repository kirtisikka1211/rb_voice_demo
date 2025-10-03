import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic,
  Bot,
  Clock,
  CheckCircle,
  WifiOff,
  XCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AudioRealtimeClient from '../services/audioWebSocket';
import { apiService } from '../services/api';

interface InterviewQuestion {
  id: number;
  question: string;
  answer?: string;
  duration?: number;
}

interface ChatMessage {
  id: string;
  type: 'bot' | 'user' | 'system';
  content: string;
  timestamp: Date;
  status?: 'sending' | 'sent' | 'error';
}

interface InterviewPageProps {
  userEmail: string;
  onComplete: (script: any) => void;
  interviewType: 'pre-screen' | 'technical';
}

// NOTE: Previously hardcoded pre-screen questions kept for reference; now fetched from backend
const mockQuestions: InterviewQuestion[] = [
  { id: 1, question: "Tell me about yourself and your professional background." },
  { id: 2, question: "What ny?" },
  { id: 3, question: "Describe  you overcame obstacles." },
  { id: 4, question: "How do deadlines?" },
  { id: 5, question: "Where do you see yourself professionally in the next 3-5 years?" }
];

// Exactly 5 mock answers mapped 1:1 to the 5 questions above
const mockAnswers: string[] = [
  "My name is John Doe. I have five years of experience as a full‑stack developer, working primarily with React and Node.js, and I enjoy building reliable products end‑to‑end.",
  "I'm excited about this role because it combines user impact with technical depth. Your product focus on accessibility and performance aligns with how I like to build software.",
  "Recently, I led a migration to a new authentication system under a tight deadline. I broke the project into phases, wrote automated tests, and coordinated with stakeholders to ensure a smooth rollout.",
  "I prioritize, communicate trade‑offs, and focus on incremental delivery. I set short timeboxes, remove blockers early, and keep the team aligned on the next most valuable step.",
  "I see myself as a senior engineer mentoring others, owning key domains, and continuing to ship user‑centric features while improving system reliability."
];

const getMockAnswer = (index: number): string => mockAnswers[index] ?? '';

// Technical interview mock questions and answers
const technicalQuestions: InterviewQuestion[] = [
  { id: 1, question: "Explain the difference between synchronous and asynchronous code in JavaScript and when you'd use each." },
  { id: 2, question: "What is a closure in JavaScript? Provide a practical use case." },
  { id: 3, question: "How would you optimize a React application that re-renders too frequently?" },
  { id: 4, question: "Describe how you would design a REST API for a todo app. Include key endpoints and status codes." },
  { id: 5, question: "You're given a slow SQL query. What steps would you take to diagnose and improve its performance?" }
];

const technicalAnswers: string[] = [
  "Synchronous code blocks the thread until it finishes, while asynchronous code schedules work and continues executing. I'd use synchronous code for simple, quick operations and async for I/O-bound tasks like network requests, using promises/async-await to avoid blocking the UI.",
  "A closure is when a function captures variables from its lexical scope even after the outer function has returned. A common use case is encapsulating private state, like a function that returns increment/decrement handlers sharing the same counter variable.",
  "Profile components to find .",
  "Resources:....",
  "Inspect e....." 
];

const getTechnicalAnswer = (index: number): string => technicalAnswers[index] ?? '';

const InterviewPage: React.FC<InterviewPageProps> = ({ userEmail: _userEmail, onComplete, interviewType }) => {
  const navigate = useNavigate();
  const [isRecording, setIsRecording] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [connectionStatus, _setConnectionStatus] = useState<'connected' | 'disconnected'>('connected');
  const [technicalTimeRemaining, setTechnicalTimeRemaining] = useState(1800); // 30 minutes in seconds
  const [showCompletePopup, setShowCompletePopup] = useState(false);
  const [shouldHideMic, setShouldHideMic] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [fetchedPreScreenQuestions, setFetchedPreScreenQuestions] = useState<InterviewQuestion[] | null>(null);
  const audioClientRef = useRef<AudioRealtimeClient | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  useEffect(() => {
    // Initial system message only; live bot handles speaking
    setChatMessages([
      {
        id: 'system-welcome',
        type: 'system',
        content: interviewType === 'technical' ? 'Technical interview. Click to start when ready.' : 'Interview. Click to start when ready.',
        timestamp: new Date(),
        status: 'sent'
      }
    ]);
  }, [interviewType]);

  // Removed local question fetching; live bot manages the conversation
  useEffect(() => {}, [interviewType]);

  useEffect(() => {
    // Technical interview countdown timer
    if (!(isRecording && interviewType === 'technical')) return;
    let interval: number;
    interval = setInterval(() => {
      setTechnicalTimeRemaining(prev => {
        if (prev <= 1) {
          // Time's up - auto complete technical interview
          completeTechnicalInterview();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isRecording, interviewType]);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, liveTranscript]);

  // No local questions; live bot manages the dialogue

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleRecording = async () => {
    if (!isRecording) {
      setIsRecording(true);
      try {
        // Debug: show what is being sent to AI
        const resumeTxt = sessionStorage.getItem('rb_resume_txt') || '';
        const jdTxt = sessionStorage.getItem('rb_jd_txt') || '';
        const qDictRaw = sessionStorage.getItem('rb_questions_dict');
        const qDict = qDictRaw ? JSON.parse(qDictRaw) : undefined;
        console.log('[AI Debug] resume_txt length:', resumeTxt.length);
        console.log('[AI Debug] jd_txt length:', jdTxt.length);
        console.log('[AI Debug] questions_dict keys:', qDict ? Object.keys(qDict).length : 0);
        console.log('[AI Debug] resume_txt preview:', resumeTxt.slice(0, 300));
        console.log('[AI Debug] jd_txt preview:', jdTxt.slice(0, 300));
        // Optionally re-trigger start (idempotent) if needed for debugging
        if (interviewType === 'technical' && (resumeTxt || jdTxt)) {
          apiService.startBot({ resume_txt: resumeTxt, jd_txt: jdTxt, questions_dict: qDict }).catch(() => {});
        }
      } catch {}
      // Establish realtime connection and start capture only for technical mode
      if (interviewType === 'technical') {
        const client = new AudioRealtimeClient((evt) => {
          try {
            if (evt?.type === 'response.delta' && typeof evt?.delta === 'string') {
              setLiveTranscript(prev => prev + evt.delta);
            }
            if (evt?.type === 'response.output_text.delta' && typeof evt?.delta === 'string') {
              setLiveTranscript(prev => prev + evt.delta);
            }
            // You can handle audio events here if you want to play audio sent by server as JSON
          } catch {}
        });
        audioClientRef.current = client;
        client.connect().then(() => {
          setWsConnected(true);
          return client.startCapture(48000);
        }).catch(() => {
          setWsConnected(false);
        });
      }

      setChatMessages(prev => [
        ...prev,
        {
          id: Date.now().toString() + '-ai-start',
          type: 'system',
          content: 'AI is now active. You can begin speaking.',
          timestamp: new Date(),
          status: 'sent'
        }
      ]);
    } else {
      setIsRecording(false);
      setLiveTranscript('');
      // Stop capture and request response if technical
      if (interviewType === 'technical') {
        const c = audioClientRef.current;
        audioClientRef.current = null;
        if (c) {
          try { await c.stopCapture(); } catch {}
          try { c.commitAndCreateResponse({ voice: 'alloy', instructions: 'Answer concisely.' }); } catch {}
          // Delay a bit before closing to allow events to flow
          setTimeout(() => { c.disconnect().catch(() => {}); setWsConnected(false); }, 1500);
        }
      }
    }
  };



  const completeInterview = () => {
    setIsRecording(false);
    onComplete({ type: 'pre-screen', version: 1, timestamp: new Date().toLocaleString() });
    navigate('/interview/completed?type=pre-screen');
  };



  const completeTechnicalInterview = () => {
    setIsRecording(false);
    onComplete({ type: 'technical', version: 1, timestamp: new Date().toLocaleString() });
    navigate('/interview/completed?type=technical');
  };

  const endSession = () => {
    const confirmed = window.confirm('End session now? Your current progress will be saved.');
    if (!confirmed) return;
    if (interviewType === 'technical') {
      completeTechnicalInterview();
    } else {
      completeInterview();
    }
  };



  return (
    <div className="h-full flex flex-col">
      {/* Interview Type Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          {interviewType === 'technical' && (
            <div className="flex items-center space-x-2">
              <Clock size={16} className="text-gray-500" />
              <span className="text-sm text-gray-600">Time remaining:</span>
              <span className={`font-medium ${technicalTimeRemaining <= 300 ? 'text-red-600' : 'text-gray-900'}`}>
                {formatTime(technicalTimeRemaining)}
              </span>
            </div>
          )}
          {/* Pre-screen progress removed */}
          {interviewType === 'technical' && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Technical Interview</span>
              <div className="w-2 h-2 rounded-full bg-blue-500" />
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {chatMessages.map((message) => (
            <div key={message.id} className={`flex ${message.type === 'bot' ? 'justify-start' : 'justify-end'}`}>
              <div className={`flex items-start gap-3 max-w-3xl ${message.type === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  message.type === 'bot' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                }`}>
                  {message.type === 'bot' ? <Bot size={16} /> : '👤'}
                </div>
                <div className={`rounded-xl px-4 py-3 shadow-sm ${
                  message.type === 'bot' 
                    ? 'bg-white border border-gray-200' 
                    : 'bg-[#2B5EA1] text-white'
                }`}>
                  {message.type === 'bot' && (
                    <div className="text-xs text-gray-500 mb-1">AI Interviewer</div>
                  )}
                  <p className="text-sm leading-relaxed">{message.content}</p>
                </div>
              </div>
            </div>
          ))}
          


          {/* System Messages */}
          {connectionStatus === 'disconnected' && (
            <div className="flex justify-center">
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-800 flex items-center gap-2">
                <WifiOff size={14} />
                Connection lost
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Sticky Recorder Dock */}
      <div className="border-t border-gray-200 bg-white px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Mic Button - show for both interview types, hide after completion/popup */}
            {!shouldHideMic && !showCompletePopup && (
              <button
                onClick={toggleRecording}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                  isRecording 
                    ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' 
                    : 'bg-[#2B5EA1] hover:bg-[#244E85] text-white'
                }`}
              >
                <Mic size={20} />
              </button>
            )}

            {/* Status */}
            <div className="text-sm text-gray-600">
              { (showCompletePopup || shouldHideMic)
                ? 'Interview completed!'
                : (isRecording ? 'Recording ...' : 'Click to start')
              }
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center space-x-2">
            {!showCompletePopup && (
              <button
                onClick={endSession}
                className="px-3 py-2 rounded-md border border-red-200 text-red-600 hover:bg-red-50 flex items-center space-x-2 text-sm"
              >
                <XCircle size={16} />
                <span>End Session</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Complete Interview Popup */}
      {showCompletePopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Interview Completed!
              </h3>
              <p className="text-sm text-gray-600">
                Thank you for completing the interview. You can now review and submit your responses.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <button
                onClick={interviewType === 'technical' ? completeTechnicalInterview : completeInterview}
                className="flex-1 px-4 py-2 bg-[#2B5EA1] text-white rounded-md hover:bg-[#244E85] transition-colors"
              >
                Complete Interview
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default InterviewPage;
