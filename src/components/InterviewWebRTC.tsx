import React, { useCallback, useEffect, useRef, useState } from 'react';
import { 
  Mic,
  Bot,
  Clock,
  CheckCircle,
  WifiOff,
  XCircle,
  Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../services/api';

interface ChatMessage {
  id: string;
  type: 'bot' | 'user' | 'system';
  content: string;
  timestamp: Date;
  status?: 'sending' | 'sent' | 'error';
}

interface Props {
  userEmail: string;
  onComplete: (script: any) => void;
  interviewType: 'pre-screen' | 'technical';
  voice?: string;
}

// WebRTC-backed interview page reusing the InterviewPage UI
const InterviewWebRTC: React.FC<Props> = ({ userEmail: _userEmail, onComplete, interviewType, voice = 'marin' }) => {
  const navigate = useNavigate();

  // UI state (mirror InterviewPage)
  const [isRecording, setIsRecording] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [liveUserTranscript, setLiveUserTranscript] = useState('');
  const [liveAiTranscript, setLiveAiTranscript] = useState('');
  const [technicalTimeRemaining, setTechnicalTimeRemaining] = useState(1800);
  const [showCompletePopup, setShowCompletePopup] = useState(false);
  const [shouldHideMic, setShouldHideMic] = useState(false);
  const [connectionStatus, _setConnectionStatus] = useState<'connected' | 'disconnected'>('connected');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // WebRTC state
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  // Local phase flow: idle -> preparing -> active
  const [phase, setPhase] = useState<'idle' | 'preparing' | 'active'>('idle');
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);

  const addSystemMessage = useCallback((text: string) => {
    setChatMessages(prev => ([...prev, { id: `${Date.now()}-sys`, type: 'system', content: text, timestamp: new Date(), status: 'sent' }]));
  }, []);

  const addBotMessage = useCallback((text: string) => {
    setChatMessages(prev => ([...prev, { id: `${Date.now()}-bot`, type: 'bot', content: text, timestamp: new Date(), status: 'sent' }]));
  }, []);

  useEffect(() => {
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

  useEffect(() => {
    if (!(isRecording && interviewType === 'technical')) return;
    let interval: number;
    interval = setInterval(() => {
      setTechnicalTimeRemaining(prev => {
        if (prev <= 1) {
          completeTechnicalInterview();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isRecording, interviewType]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Auto-advance from preparing -> active
  useEffect(() => {
    if (phase !== 'preparing') return;
    const t = setTimeout(() => setPhase('active'), 3000);
    return () => clearTimeout(t);
  }, [phase]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Save transcript to backend evaluation table
  async function saveTranscript(params: { transcript: string; jdId?: number; resumeId?: number }) {
    try {
      const payload: any = { transcript: params.transcript };
      if (params.jdId) payload.jd_id = params.jdId;
      if (params.resumeId) payload.resume_id = params.resumeId;
      const res = await fetch(`${API_BASE_URL}/evaluation/transcript`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        try { console.error('Transcript save failed', res.status, await res.text()); } catch {}
      }
    } catch (e) {
      console.error('Transcript save error', e);
    }
  }

  const disconnect = useCallback(() => {
    try { dcRef.current?.close(); } catch {}
    dcRef.current = null;
    try { pcRef.current?.close(); } catch {}
    pcRef.current = null;
    try { micStreamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
    micStreamRef.current = null;
    setConnected(false);
    setConnecting(false);
    setIsRecording(false);
    addSystemMessage('Disconnected');
  }, [addSystemMessage]);

  useEffect(() => () => { disconnect(); }, [disconnect]);

  const connect = useCallback(async () => {
    if (connecting || connected) return;
    setConnecting(true);
    addSystemMessage('Connecting...');

    try {
      // Get interview context from sessionStorage
      const resumeTxt = sessionStorage.getItem('rb_resume_txt') || '';
      const jdTxt = sessionStorage.getItem('rb_jd_txt') || '';
      const qDictRaw = sessionStorage.getItem('rb_questions_dict');
      const qDict = qDictRaw ? JSON.parse(qDictRaw) : undefined;

      // Prepare POST request body
      const requestBody = {
        voice: voice,
        jd_txt: jdTxt,
        resume_txt: resumeTxt,
        questions_dict: qDict,
        interview_duration: 30
      };

      console.log('[WebRTC Debug] Sending context:', {
        voice: voice,
        jd_txt_length: jdTxt.length,
        resume_txt_length: resumeTxt.length,
        questions_count: qDict ? Object.keys(qDict).length : 0
      });

      const sessionRes = await fetch(`${API_BASE_URL}/webrtc/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!sessionRes.ok) {
        const text = await sessionRes.text();
        throw new Error(`Session failed: ${sessionRes.status} ${text}`);
      }
      const sessionJson = await sessionRes.json();
      const ephemeralKey: string | undefined = sessionJson?.client_secret?.value;
      if (!ephemeralKey) throw new Error('No ephemeral token returned');

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setConnected(true);
          setConnecting(false);
          addSystemMessage('Connected');
        }
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          disconnect();
        }
      };

      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = mic;
      mic.getTracks().forEach(track => pc.addTrack(track, mic));

      pc.ontrack = (evt) => {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = evt.streams[0];
        }
      };

      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;
      dc.onopen = () => {
        try {
          const transcription_prompt= 
         `
            PRIORITY:
            1. Transcribe ONLY clear speech. If audio is unclear or contains only noise, return empty. Never guess or add words not clearly spoken.
            2. Keep natural speech patterns: um, uh, like, you know, so, well, actually, basically
            3. Mark hesitations with (...)
            4. Show repetitions: I, I mean
            5. Mark false starts: I was—I mean
            6. NEVER add content not spoken
            7. NEVER clean up or interpret - raw speech only
            8. Focus on accuracy over emotional markers.
            `;
          const sessionUpdate = {
            type: 'session.update',
            session: {
              modalities: ['text', 'audio'],
              output_audio_format: 'pcm16',
              input_audio_transcription: {
                model: 'gpt-4o-transcribe',
                prompt:transcription_prompt,
                language: 'en'
              },
              turn_detection: {
                type: 'server_vad',
                threshold: 0.7,
                prefix_padding_ms: 900,
                silence_duration_ms: 1200,
                create_response: true
              }
            }
          } as any;
          dc.send(JSON.stringify(sessionUpdate));
          // addSystemMessage('Transcription enabled');
        } catch (e: any) {
          addSystemMessage(`Failed to enable transcription: ${e?.message || e}`);
        }
      };
      dc.onmessage = (e) => {
        try {
          const obj = JSON.parse(e.data);
          if (obj?.type) {
            // surface important events into chat
            
            // AI transcript streaming
            if (obj.type === 'response.audio_transcript.delta' && obj?.delta) {
              setLiveAiTranscript(prev => prev + obj.delta);
            }
            if (obj.type === 'response.audio_transcript.done') {
              const finalAi = obj?.transcript || liveAiTranscript;
              if (finalAi) addBotMessage(`Interviewer: "${finalAi}"`);
              setLiveAiTranscript('');
            }
            // User transcript streaming
            if (obj.type === 'conversation.item.input_audio_transcription.delta' && obj?.delta) {
              setLiveUserTranscript(prev => prev + obj.delta);
            }
            if (obj.type === 'conversation.item.input_audio_transcription.completed') {
              const finalUser = obj?.transcript || liveUserTranscript;
              if (finalUser) setChatMessages(prev => ([...prev, { id: `${Date.now()}-user`, type: 'user', content: finalUser, timestamp: new Date(), status: 'sent' }]));
              setLiveUserTranscript('');
            }
          }
        } catch {
          addSystemMessage(`DC: ${e.data}`);
        }
      };

      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
      await pc.setLocalDescription(offer);

      const baseUrl = 'https://api.openai.com/v1/realtime';
      const model = 'gpt-realtime';
      const resp = await fetch(`${baseUrl}?model=${model}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp',
          'OpenAI-Beta': 'realtime=v1'
        },
        body: offer.sdp || ''
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`SDP exchange failed: ${resp.status} ${text}`);
      }
      const answerSdp = await resp.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

     
      setIsRecording(true);
      // setChatMessages(prev => ([...prev, { id: `${Date.now()}-ai-start`, type: 'system', content: 'AI is now active. You can begin speaking.', timestamp: new Date(), status: 'sent' }]));
    } catch (err: any) {
      // addSystemMessage(`Error: ${err?.message || String(err)}`);
      setConnecting(false);
      disconnect();
    }
  }, [addSystemMessage, addBotMessage, connected, connecting, disconnect, voice]);

  // Build a structured script from chat messages and live transcripts
  const buildInterviewScript = (type: 'pre-screen' | 'technical') => {
    // Incorporate any in-progress live transcripts into the final transcript
    const finalizedMessages: ChatMessage[] = [...chatMessages];
    if (liveUserTranscript) {
      finalizedMessages.push({ id: `${Date.now()}-user-live`, type: 'user', content: liveUserTranscript, timestamp: new Date(), status: 'sent' });
    }
    if (liveAiTranscript) {
      finalizedMessages.push({ id: `${Date.now()}-bot-live`, type: 'bot', content: liveAiTranscript, timestamp: new Date(), status: 'sent' });
    }

    // Create human-readable transcript
    const transcript = finalizedMessages
      .filter(m => m.type !== 'system')
      .map(m => (m.type === 'bot' ? ` ${m.content}` : `Applicant: ${m.content}`))
      .join('\n');
    console.log('transcript', transcript);
    
    // Derive Q&A pairs: pair each bot message with the next user message
    const questions: { id: number; question: string; answer?: string }[] = [];
    let qId = 1;
    for (let i = 0; i < finalizedMessages.length; i++) {
      const m = finalizedMessages[i];
      if (m.type === 'bot') {
        // Find the next user reply after this bot message
        let answer: string | undefined;
        for (let j = i + 1; j < finalizedMessages.length; j++) {
          if (finalizedMessages[j].type === 'user') {
            answer = finalizedMessages[j].content;
            break;
          }
        }
        questions.push({ id: qId++, question: m.content, answer });
      }
    }

    // Compute an approximate total duration
    const totalDuration = interviewType === 'technical' 
      ? Math.max(0, 1800 - technicalTimeRemaining)
      : Math.max(questions.length * 45, 60); // simple heuristic for pre-screen

    return {
      type,
      version: 1,
      timestamp: new Date().toLocaleString(),
      transcript,
      questions,
      totalDuration
    } as any;
  };

  const completeInterview = () => {
    setIsRecording(false);
    const script = buildInterviewScript('pre-screen');
    const transcript = script.transcript as string;
    const jdId = Number(sessionStorage.getItem('rb_jd_id') || '') || undefined;
    const resumeId = Number(sessionStorage.getItem('rb_resume_id') || '') || undefined;
    void saveTranscript({ transcript, jdId, resumeId });
    onComplete(script);
    navigate('/interview/completed?type=pre-screen');
  };

  const completeTechnicalInterview = () => {
    setIsRecording(false);
    const script = buildInterviewScript('technical');
    const transcript = script.transcript as string;
    const jdId = Number(sessionStorage.getItem('rb_jd_id') || '') || undefined;
    const resumeId = Number(sessionStorage.getItem('rb_resume_id') || '') || undefined;
    void saveTranscript({ transcript, jdId, resumeId });
    onComplete(script);
    navigate('/interview/completed?type=technical');
  };

  const endSession = () => {
    const confirmed = window.confirm('End session now? Your current progress will be saved.');
    if (!confirmed) return;
    disconnect();
    if (interviewType === 'technical') {
      completeTechnicalInterview();
    } else {
      completeInterview();
    }
  };


  // Idle screen
  if (phase === 'idle') {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="max-w-3xl w-full">
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
                onClick={() => setPhase('preparing')}
                className="text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 mx-auto bg-[#2B5EA1] hover:bg-[#244E85]"
              >
                <Mic size={16} className="text-white" />
                <span>Begin</span>
              </button>
        </div>
      </div>
      </div>
      </div>
    );
  }

  // Preparing screen
  if (phase === 'preparing') {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="max-w-4xl w-full">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-4">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Bot size={24} className="text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-1">
                Preparing Your {interviewType === 'technical' ? 'Technical ' : ''}Interview
              </h3>
              <p className="text-sm text-gray-600">Our AI assistant is getting everything ready for you</p>
            </div>

            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <Loader2 size={32} className="text-blue-600 animate-spin" />
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4 mb-6">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">What's happening:</h4>
              <div className="space-y-2 text-xs text-blue-800">
                <div className="flex items-center space-x-2"><div className="w-2 h-2 bg-blue-600 rounded-full"></div><span>Loading interview questions</span></div>
                <div className="flex items-center space-x-2"><div className="w-2 h-2 bg-blue-600 rounded-full"></div><span>Setting up recording environment</span></div>
              </div>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '75%' }}></div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center space-x-2 mb-3">
              <div className="w-4 h-4 bg-blue-100 rounded-full flex items-center justify-center"><span className="text-xs font-medium text-blue-600">⏱</span></div>
              <h4 className="text-sm font-semibold text-gray-900">Almost Ready</h4>
            </div>
            <div className="space-y-2 text-xs text-gray-600">
              <p>• This will only take a few moments</p>
              <p>• Please don't refresh the page</p>
              <p>• Your interview will start automatically</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          {interviewType === 'technical' && (
            <div className="flex items-center space-x-2">
              <Clock size={16} className="text-gray-500" />
              <span className="text-sm text-gray-600">Time remaining:</span>
              <span className={`${technicalTimeRemaining <= 300 ? 'text-red-600' : 'text-gray-900'} font-medium`}>
                {formatTime(technicalTimeRemaining)}
              </span>
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

      <div className="flex-1 flex flex-col overflow-hidden">
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

          {liveUserTranscript && (
            <div className="flex justify-end">
              <div className="flex items-start gap-3 max-w-3xl flex-row-reverse">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-gray-100 text-gray-600">👤</div>
                <div className="rounded-xl px-4 py-3 shadow-sm bg-[#2B5EA1] text-white opacity-80">
                  <p className="text-sm leading-relaxed">{liveUserTranscript}</p>
                </div>
              </div>
            </div>
          )}
          {liveAiTranscript && (
            <div className="flex justify-start">
              <div className="flex items-start gap-3 max-w-3xl">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-blue-100 text-blue-600"><Bot size={16} /></div>
                <div className="rounded-xl px-4 py-3 shadow-sm bg-white border border-gray-200 opacity-80">
                  <div className="text-xs text-gray-500 mb-1">AI Interviewer</div>
                  <p className="text-sm leading-relaxed">{liveAiTranscript}</p>
                </div>
              </div>
            </div>
          )}

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

      <div className="border-t border-gray-200 bg-white px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {!shouldHideMic && !showCompletePopup && (
              <button
                onClick={() => {
                  if (!isRecording) {
                    connect();
                  } else {
                    disconnect();
                  }
                }}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                  isRecording 
                    ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' 
                    : 'bg-[#2B5EA1] hover:bg-[#244E85] text-white'
                }`}
              >
                <Mic size={20} />
              </button>
            )}

            <div className="text-sm text-gray-600">
              { (showCompletePopup || shouldHideMic)
                ? 'Interview completed!'
                : (isRecording ? 'Recording ...' : 'Click to start')
              }
            </div>
          </div>

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

      <audio ref={remoteAudioRef} autoPlay />
    </div>
  );
};

export default InterviewWebRTC;


