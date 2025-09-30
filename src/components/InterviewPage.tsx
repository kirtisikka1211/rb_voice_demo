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

  useEffect(() => {
    // Initialize with bot greeting based on interview type
    if (interviewType === 'technical') {
      setChatMessages([
        {
          id: '1',
          type: 'bot',
          content: "Welcome to the technical interview! You have 30 minutes to work on the problem. Good luck!",
          timestamp: new Date(),
          status: 'sent'
        }
      ]);
    } else {
      setChatMessages([
        {
          id: '1',
          type: 'bot',
          content: "Hello! I'm your AI interviewer. I'll be asking you a few questions to understand your background and experience.",
          timestamp: new Date(),
          status: 'sent'
        }
      ]);
    }
  }, [interviewType]);

  useEffect(() => {
    // Fetch pre-screen questions from backend
    if (interviewType !== 'pre-screen') return;
    (async () => {
      try {
        const res = await fetch('http://localhost:8000/questions?interview_type=pre_screen');
        if (!res.ok) return;
        const data = await res.json();
        // Expecting an array of rows with a `questions` array
        const questionsArray = Array.isArray(data) && data.length > 0 ? (data[0]?.questions || []) : [];
        if (Array.isArray(questionsArray)) {
          const normalized: InterviewQuestion[] = questionsArray.map((q: any, idx: number) => ({
            id: idx + 1,
            question: typeof q === 'string' ? q : (q?.question ?? '')
          })).filter(q => q.question && String(q.question).trim().length > 0);
          if (normalized.length > 0) setFetchedPreScreenQuestions(normalized);
        }
      } catch (e) {
      
      }
    })();
  }, [interviewType]);

  useEffect(() => {
    // Technical interview countdown timer
    if (!(isRecording && interviewType === 'technical')) return;
    let interval: NodeJS.Timeout;
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

  // Prefer fetched questions; fallback to mocks
  const preQuestions: InterviewQuestion[] = fetchedPreScreenQuestions ?? mockQuestions;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleRecording = () => {
    if (!isRecording) {
      // Start recording and begin interview flow
      setIsRecording(true);
      
      if (interviewType === 'pre-screen') {
        // For pre-screen interview, start the automatic question flow (now using backend questions if available)
        
        // Function to show question and answer
        const showQuestionAndAnswer = (index: number) => {
          if (index >= preQuestions.length) {
            // Interview is over, bot asks if candidate has questions
            setTimeout(() => {
              setChatMessages(prev => [...prev, {
                id: Date.now().toString() + 'interview-over',
                type: 'bot',
                content: "Great! That concludes our interview. Do you have any questions for me?",
                timestamp: new Date(),
                status: 'sent'
              }]);
              
              // Candidate says no after 2 seconds
              setTimeout(() => {
                setChatMessages(prev => [...prev, {
                  id: Date.now().toString() + 'candidate-no',
                  type: 'user',
                  content: "No, I don't have any questions. Thank you.",
                  timestamp: new Date(),
                  status: 'sent'
                }]);
                
                // Bot wishes good luck after 1 second
                setTimeout(() => {
                  // Hide mic as soon as the AI says goodbye
                  setShouldHideMic(true);
                  setChatMessages(prev => [...prev, {
                    id: Date.now().toString() + 'bot-goodbye',
                    type: 'bot',
                    content: "Perfect! Thank you for your time. I wish you the best of luck with your application. Have a great day!",
                    timestamp: new Date(),
                    status: 'sent'
                  }]);
                  
                  // Show complete interview popup after 1 second
                  setTimeout(() => {
                    setShowCompletePopup(true);
                  }, 1000);
                }, 1000);
              }, 2000);
            }, 1000);
            return;
          }
          
          // Show question
          setChatMessages(prev => [...prev, {
            id: Date.now().toString() + index,
            type: 'bot',
            content: preQuestions[index].question,
            timestamp: new Date(),
            status: 'sent'
          }]);
          
          // Update current question
          setCurrentQuestion(index);
          
          // Show answer after 2 seconds
          setTimeout(() => {
            const answer = getMockAnswer(index);
            
            // Save answer directly to chat (no live transcript needed)
            setChatMessages(prev => [...prev, {
              id: Date.now().toString() + index + 'answer',
              type: 'user',
              content: answer,
              timestamp: new Date(),
              status: 'sent'
            }]);
            
            // Show next question after 2 more seconds
            setTimeout(() => {
              showQuestionAndAnswer(index + 1);
            }, 2000);
          }, 2000);
        };
        
        // Start with first question
        showQuestionAndAnswer(0);
      } else {
        // For technical interview, run an automatic Q&A flow similar to pre-screen

        const showTechQuestionAndAnswer = (index: number) => {
          if (index >= technicalQuestions.length) {
            // Wrap up the technical session
            setTimeout(() => {
              setChatMessages(prev => [...prev, {
                id: Date.now().toString() + 'technical-over',
                type: 'bot',
                content: "Great! That concludes the technical interview.",
                timestamp: new Date(),
                status: 'sent'
              }]);
              // Stop recording, hide mic, and show completion popup
              setTimeout(() => {
                setIsRecording(false);
                setShouldHideMic(true);
                setShowCompletePopup(true);
              }, 1000);
            }, 500);
            return;
          }

          // Show question
          setChatMessages(prev => [...prev, {
            id: Date.now().toString() + 't' + index,
            type: 'bot',
            content: technicalQuestions[index].question,
            timestamp: new Date(),
            status: 'sent'
          }]);

          // Track progress index
          setCurrentQuestion(index);

          // Show answer after 2 seconds
          setTimeout(() => {
            const answer = getTechnicalAnswer(index);
            setChatMessages(prev => [...prev, {
              id: Date.now().toString() + 't' + index + 'answer',
              type: 'user',
              content: answer,
              timestamp: new Date(),
              status: 'sent'
            }]);

            // Next question after 2 seconds
            setTimeout(() => showTechQuestionAndAnswer(index + 1), 2000);
          }, 2000);
        };

        // Start technical flow
        showTechQuestionAndAnswer(0);
      }
    } else {
      // Stop recording
      setIsRecording(false);
      setLiveTranscript('');
    }
  };



  const completeInterview = () => {
    setIsRecording(false);
    
    // Generate script with exactly 5 mock Q&A mapped to questions
    const script = {
      type: 'pre-screen' as const,
      questions: preQuestions.map((q, index) => ({
        ...q,
        answer: getMockAnswer(index),
        duration: Math.floor(Math.random() * 120) + 30
      })),
      totalDuration: 0, // No timer for pre-screen interview
      feedback: "Strong communication skills demonstrated throughout the interview. Good technical knowledge and problem-solving approach.",
      timestamp: new Date().toLocaleString(),
      version: 1
    };
    
    onComplete(script);
    navigate('/interview/completed?type=pre-screen');
  };



  const completeTechnicalInterview = () => {
    setIsRecording(false);
    
    // Generate structured Q&A data for technical interview
    const questions = technicalQuestions.map((q, index) => ({
      ...q,
      answer: getTechnicalAnswer(index),
      duration: Math.floor(Math.random() * 120) + 60
    }));
    const totalDuration = questions.reduce((acc, q) => acc + (q.duration || 0), 0);
    
    // Keep transcript for backward compatibility, but now we have structured Q&A
    let transcript = chatMessages
      .filter(m => m.type === 'bot' || m.type === 'user')
      .map(m => `${m.type === 'bot' ? 'AI' : 'You'}: ${m.content}`)
      .join('\n');
    if (!transcript || transcript.trim().length === 0) {
      // Fallback to AI/You formatted log from questions/answers
      transcript = technicalQuestions
        .map((q, idx) => {
          const answer = getTechnicalAnswer(idx);
          return `AI: ${q.question}\nYou: ${answer}`;
        })
        .join('\n');
    }
    
    const script = {
      type: 'technical' as const,
      questions, // Now includes structured Q&A data
      totalDuration,
      feedback: "Technical interview completed. Candidate demonstrated problem-solving skills.",
      timestamp: new Date().toLocaleString(),
      transcript, // Keep for backward compatibility
      version: 1
    };
    
    onComplete(script);
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
          {interviewType === 'pre-screen' && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Question {currentQuestion + 1} of {mockQuestions.length}</span>
              <div className="flex items-center space-x-1">
                {mockQuestions.map((_, index) => (
                  <div key={index} className={`w-2 h-2 rounded-full ${
                    index < currentQuestion ? 'bg-green-500' :
                    index === currentQuestion ? 'bg-blue-500' :
                    'bg-gray-300'
                  }`} />
                ))}
              </div>
            </div>
          )}
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
                : interviewType === 'pre-screen'
                  ? (currentQuestion < mockQuestions.length ? (isRecording ? 'Recording ...' : 'Click to start') : 'Interview complete')
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
