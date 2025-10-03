import React, { useCallback, useEffect, useRef, useState } from 'react';
import { 
  Mic,
  Bot,
  Clock,
  CheckCircle,
  WifiOff,
  XCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
const InterviewWebRTC: React.FC<Props> = ({ userEmail: _userEmail, onComplete, interviewType, voice = 'ash' }) => {
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
      const sessionRes = await fetch(`http://localhost:8000/webrtc/session?voice=${encodeURIComponent(voice)}`);
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
          const sessionUpdate = {
            type: 'session.update',
            session: {
              modalities: ['text', 'audio'],
              output_audio_format: 'pcm16',
              input_audio_transcription: {
                model: 'gpt-4o-transcribe',
                language: 'en'
              },
              turn_detection: {
                type: 'server_vad',
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 800,
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
            if (obj.type === 'session.created') addSystemMessage('Session created successfully');
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
      setChatMessages(prev => ([...prev, { id: `${Date.now()}-ai-start`, type: 'system', content: 'AI is now active. You can begin speaking.', timestamp: new Date(), status: 'sent' }]));
    } catch (err: any) {
      // addSystemMessage(`Error: ${err?.message || String(err)}`);
      setConnecting(false);
      disconnect();
    }
  }, [addSystemMessage, addBotMessage, connected, connecting, disconnect, voice]);

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
    disconnect();
    if (interviewType === 'technical') {
      completeTechnicalInterview();
    } else {
      completeInterview();
    }
  };

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


