# session_manager.py
import json
from datetime import datetime
from evaluation import save_json

class SessionManager:
    def __init__(self, voice: str, interview_mode: bool):
        self.voice = voice
        self.interview_mode = interview_mode
        self.session_start_time = datetime.now()
        self.conversation = []
        self.conversation_count = 0
        self.input_audio_seconds = 0.0
        self.output_audio_seconds = 0.0
        self.performance_metrics = {
            'response_times': [], 'audio_chunks_sent': 0, 'audio_chunks_received': 0,
            'total_audio_input_bytes': 0, 'total_audio_output_bytes': 0,
            'connection_errors': 0, 'transcription_errors': 0
        }

    def add_conversation_entry(self, user_text: str, bot_text: str, interview_phase: str = None):
        """Add a conversation exchange"""
        self.conversation_count += 1
        timestamp = datetime.now().strftime('%H:%M:%S')
        
        entry = {
            'exchange_id': self.conversation_count,
            'timestamp': timestamp,
            'user_label': 'CANDIDATE' if self.interview_mode else 'SPEAKER',
            'assistant_label': 'INTERVIEWER' if self.interview_mode else 'ANALYST',
            'user': user_text,
            'bot': bot_text,
            'voice_used': self.voice
        }
        
        if self.interview_mode and interview_phase:
            entry.update({'interview_phase': interview_phase, 'phase_progress': ''})
            
        self.conversation.append(entry)
        return entry

    def print_summary(self, interview_start_time=None):
        """Enhanced summary with interview metrics and usage tracking"""
        if not self.conversation:
            print("📝 No conversation recorded.")
            return
            
        session_duration = datetime.now() - self.session_start_time
        
        print(f"\n🎯 SESSION SUMMARY")
        print(f"📅 Date: {self.session_start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"⏱️  Total duration: {session_duration}")
        print(f"🎵 Voice used: {self.voice}")
        print(f"💬 Exchanges: {len(self.conversation)}")
        print(f"🎤 Input audio: {self.input_audio_seconds/60:.1f} minutes")
        print(f"🔊 Output audio: {self.output_audio_seconds/60:.1f} minutes")
        
        # Add latency metrics
        if self.performance_metrics['response_times']:
            avg_latency = sum(self.performance_metrics['response_times']) / len(self.performance_metrics['response_times'])
            min_latency = min(self.performance_metrics['response_times'])
            max_latency = max(self.performance_metrics['response_times'])
            print(f"⚡ Avg Response Latency: {avg_latency:.2f}s")
            print(f"⚡ Min/Max Latency: {min_latency:.2f}s / {max_latency:.2f}s")
        
        if self.interview_mode and interview_start_time:
            interview_duration = datetime.now() - interview_start_time
            print(f"⏰ Interview duration: {interview_duration}")

    def save_transcript(self):
        """Save enhanced transcript with interview details"""
        if not self.conversation:
            print("📝 No conversation to save.")
            return None

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"{'interview_session' if self.interview_mode else 'conversation'}_{timestamp}.txt"

        try:
            session_duration = datetime.now() - self.session_start_time
            with open(filename, 'w', encoding='utf-8') as f:
                f.write(f"🎯 AI {'TECHNICAL INTERVIEW' if self.interview_mode else 'CONVERSATION'} SESSION\n")
                f.write(f"📅 Date: {self.session_start_time.strftime('%Y-%m-%d %H:%M:%S')}\n")
                f.write(f"⏱️  Duration: {session_duration}\n")
                f.write(f"🎵 Voice: {self.voice}\n")
                f.write(f"💬 Total exchanges: {len(self.conversation)}\n")
                f.write(f"🎤 Input audio: {self.input_audio_seconds/60:.1f} minutes\n")
                f.write(f"🔊 Output audio: {self.output_audio_seconds/60:.1f} minutes\n")
                f.write("=" * 80 + "\n\n")
                
                for exchange in self.conversation:
                    f.write(f"Exchange #{exchange['exchange_id']} [{exchange['timestamp']}]\n")
                    f.write(f"{exchange['user_label']}: {exchange['user']}\n")
                    f.write(f"{exchange['assistant_label']}: {exchange['bot']}\n")
                    f.write("-" * 70 + "\n\n")
                    
            print(f"💾 Transcript saved: {filename}")
            return filename
        except Exception as e:
            print(f"❌ Failed to save transcript: {e}")
            return None

    def save_performance_metrics(self):
        """Save performance and cost metrics to JSON file"""
        avg_response_time = (sum(self.performance_metrics['response_times'])/len(self.performance_metrics['response_times'])) if self.performance_metrics['response_times'] else 0
        session_duration = (datetime.now()-self.session_start_time).total_seconds()
        
        report = {
            "session_metadata": {
                "timestamp": self.session_start_time.strftime('%Y-%m-%d %H:%M:%S'),
                "session_duration_seconds": session_duration,
                "voice_model": self.voice,
                "interview_mode": self.interview_mode,
                "total_exchanges": len(self.conversation)
            },
            "performance_metrics": {
                "latency": {
                    "average_response_time_seconds": round(avg_response_time, 2),
                    "total_responses": len(self.performance_metrics['response_times'])
                },
                "audio_metrics": {
                    "input_chunks_sent": self.performance_metrics['audio_chunks_sent'],
                    "output_chunks_received": self.performance_metrics['audio_chunks_received'],
                    "total_input_bytes": self.performance_metrics['total_audio_input_bytes'],
                    "total_output_bytes": self.performance_metrics['total_audio_output_bytes']
                }
            },
            "raw_metrics": self.performance_metrics
        }
        save_json(report, "performance_metrics")