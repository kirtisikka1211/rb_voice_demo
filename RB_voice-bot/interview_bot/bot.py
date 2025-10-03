# bot.py
import asyncio
import json
import base64
import time
import threading
import queue
import os
import hashlib
from datetime import datetime
import openai
import websockets
import numpy as np
import logging
from audio_manager import AudioManager
from interview_utils import (
    extract_resume_content,
    extract_job_title,
    extract_candidate_name,
    get_time_greeting,
    generate_interview_questions
)
from phase_manager import PhaseManager
from session_manager import SessionManager
from evaluation import call_comprehensive_evaluation, save_json
from prompts_repo import (
    INTERVIEW_BASE_INSTRUCTIONS,
    SHORT_INTERVIEW_STRUCTURE,
    MEDIUM_INTERVIEW_STRUCTURE, 
    FULL_INTERVIEW_STRUCTURE,
    STANDARD_CONVERSATION_INSTRUCTIONS,
    TRANSCRIPTION_PROMPT_TEMPLATE
)
from logger_config import get_logger

logger = get_logger("InterviewBot")

class InterviewBot:
    def __init__(self, api_key: str, voice: str = "cedar", language: str = "en", interview_duration: int = 30):
        # keep same attribute names and defaults as original
        self.api_key = api_key
        self.voice = voice
        self.language = language
        self.interview_duration = interview_duration
        self.websocket = None
        print
        # Reuse AudioManager
        self.audio_manager = AudioManager(sample_rate=24000, chunk_size=512)
        self.input_stream = None
        self.output_stream = None
        self.audio_queue = self.audio_manager.audio_queue

        # Initialize managers
        self.phase_manager = PhaseManager(interview_duration)
        self.session_manager = SessionManager(voice, False)  # Will be updated when interview_mode is set
        
        # conversation state (kept same)
        self.running = True
        self.interview_mode = False
        self.job_description = ""
        self.candidate_resume = ""
        self.interview_questions_data = {}
        self.custom_questions = []
        self.prescreening_questions = []
        self.technical_custom_questions = []
        self.evaluation_data = None
        self.audio_buffer = []  # Store bot audio for evaluation
        self.user_audio_buffer = []  # Store user audio for evaluation
        self.raw_user_audio_buffer = []  # Store all raw user audio
        self.session_id = datetime.now().strftime('%Y%m%d_%H%M%S')

        # response accumulation and locks
        self._current_response_text = ""
        self._accumulated_user_text = ""
        self._last_user_speech_time = None
        self._response_start_time = None
        self._response_in_progress = False
        self._response_lock = threading.Lock()
        
        # Exit phrases for interview context
        self.exit_phrases = ['end interview', 'stop interview', 'finish interview', 'conclude interview']
        
        # Question caching
        self.questions_cache_dir = "Data/cache"
        os.makedirs(self.questions_cache_dir, exist_ok=True)

    def _get_content_hash(self, jd_content: str, resume_content: str) -> str:
        """Generate hash for JD and resume content to check for changes"""
        combined_content = f"{jd_content.strip()}|||{resume_content.strip()}"
        return hashlib.md5(combined_content.encode()).hexdigest()
    
    def _load_cached_questions(self, content_hash: str) -> dict:
        """Load cached questions if available"""
        cache_file = os.path.join(self.questions_cache_dir, f"questions_{content_hash}.json")
        if os.path.exists(cache_file):
            try:
                with open(cache_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"Failed to load cached questions: {e}")
        return None
    
    def _save_questions_to_cache(self, content_hash: str, questions_data: dict):
        """Save generated questions to cache"""
        cache_file = os.path.join(self.questions_cache_dir, f"questions_{content_hash}.json")
        try:
            with open(cache_file, 'w', encoding='utf-8') as f:
                json.dump(questions_data, f, ensure_ascii=False, indent=2)
            print(f"💾 Questions saved to: {cache_file}")
            logger.info(f"Questions cached: {cache_file}")
        except Exception as e:
            logger.warning(f"Failed to cache questions: {e}")

    # ---------------------------
    # Context loading
    # ---------------------------
    def load_interview_context(self, jd_file: str = None, resume_file: str = None, custom_questions_file: str = None):
        try:
            if jd_file:
                with open(jd_file, 'r', encoding='utf-8') as f:
                    self.job_description = f.read()
            if resume_file:
                with open(resume_file, 'r', encoding='utf-8') as f:
                    self.candidate_resume = f.read()
            if custom_questions_file:
                with open(custom_questions_file, 'r', encoding='utf-8') as f:
                    questions = [l.strip() for l in f.readlines() if l.strip()]
                    self._categorize_custom_questions(questions)
            self.interview_mode = bool(self.job_description and self.candidate_resume)
            if self.interview_mode:
                print("🎯 Interview mode activated!")
                # Update session manager for interview mode
                self.session_manager.interview_mode = True
                
                # Check for cached questions first
                content_hash = self._get_content_hash(self.job_description, self.candidate_resume)
                cached_questions = self._load_cached_questions(content_hash)
                
                if cached_questions:
                    cache_file = os.path.join(self.questions_cache_dir, f"questions_{content_hash}.json")
                    print(f"💾 Using cached questions from: {cache_file}")
                    self.interview_questions_data = cached_questions
                    self.phase_manager.interview_questions_data = cached_questions
                else:
                    print("🤖 Generating new questions with GPT-4o...")
                    self.interview_questions_data = generate_interview_questions(self.api_key, self.job_description, self.candidate_resume)
                    if self.interview_questions_data:
                        self._save_questions_to_cache(content_hash, self.interview_questions_data)
                        self.phase_manager.interview_questions_data = self.interview_questions_data
                
                # Log question results
                if self.interview_questions_data:
                    tech_count = len(self.interview_questions_data.get('technical_questions', []))
                    behavioral_count = len(self.interview_questions_data.get('behavioral_questions', []))
                    project_count = len(self.interview_questions_data.get('project_questions', []))
                    print(f"✅ Loaded {tech_count} technical, {behavioral_count} behavioral, {project_count} project questions")
                
                total_custom = len(self.custom_questions) + len(self.prescreening_questions) + len(self.technical_custom_questions)
                if total_custom > 0:
                    print(f"✅ Loaded {total_custom} custom questions ({len(self.prescreening_questions)} pre-screening, {len(self.technical_custom_questions)} technical, {len(self.custom_questions)} general)")
                    
        except Exception as e:
            logger.exception("Error loading context")
            self.interview_mode = False

    def get_interview_instructions(self):
        """Generate context-aware interview instructions using prompts_repo templates"""
        if not self.interview_mode:
            return STANDARD_CONVERSATION_INSTRUCTIONS
            
        # Extract dynamic elements
        resume_projects = extract_resume_content(self.candidate_resume)
        job_title = extract_job_title(self.job_description)
        candidate_name = extract_candidate_name(self.candidate_resume)
        time_greeting = get_time_greeting()
        voice_title = self.voice.title()
        
        # Use cached questions if available, otherwise generate
        if not self.interview_questions_data:
            content_hash = self._get_content_hash(self.job_description, self.candidate_resume)
            cached_questions = self._load_cached_questions(content_hash)
            
            if cached_questions:
                self.interview_questions_data = cached_questions
                self.phase_manager.interview_questions_data = cached_questions
            else:
                self.interview_questions_data = generate_interview_questions(
                    self.api_key, self.job_description, self.candidate_resume
                )
                if self.interview_questions_data:
                    self._save_questions_to_cache(content_hash, self.interview_questions_data)
                    self.phase_manager.interview_questions_data = self.interview_questions_data
        
        tech_categories = [q.get('category', '') for q in self.interview_questions_data.get('technical_questions', [])]
        skills_focus = ', '.join(set(tech_categories[:5])) if tech_categories else 'general technical skills'
        tech_section = skills_focus if skills_focus != 'general technical skills' else 'Core technical skills, problem-solving'
        
        # Format generated questions for prompt
        generated_questions_section = self._format_generated_questions()
        
        # Format custom questions for prompt
        custom_questions_section = self._format_custom_questions()
        
        # Select appropriate interview structure template
        if self.interview_duration <= 10:
            interview_structure = SHORT_INTERVIEW_STRUCTURE.format(
                duration=self.interview_duration,
                time_greeting=time_greeting,
                candidate_name=candidate_name,
                voice_title=voice_title,
                job_title=job_title,
                focused_time=self.interview_duration - 2
            )
        elif self.interview_duration <= 20:
            interview_structure = MEDIUM_INTERVIEW_STRUCTURE.format(
                duration=self.interview_duration,
                time_greeting=time_greeting,
                candidate_name=candidate_name,
                voice_title=voice_title,
                job_title=job_title,
                project_time=self.interview_duration - 5
            )
        else:
            interview_structure = FULL_INTERVIEW_STRUCTURE.format(
                duration=self.interview_duration,
                time_greeting=time_greeting,
                candidate_name=candidate_name,
                voice_title=voice_title,
                job_title=job_title
            )
        
        # Use template from prompts_repo
        return INTERVIEW_BASE_INSTRUCTIONS.format(
            voice_title=voice_title,
            job_title=job_title,
            candidate_name=candidate_name,
            time_greeting=time_greeting,
            candidate_resume=self.candidate_resume[:1500],
            job_description=self.job_description[:1500],
            interview_structure=interview_structure,
            tech_section=tech_section,
            resume_projects=resume_projects,
            generated_questions_section=generated_questions_section,
            custom_questions_section=custom_questions_section
        )
    
    def _all_custom_questions_covered(self):
        """Check if all custom questions have been mentioned in conversation"""
        if not self.custom_questions:
            return True
        
        conversation_text = " ".join([ex.get('bot', '') for ex in self.session_manager.conversation]).lower()
        covered_count = 0
        
        for question in self.custom_questions:
            # More strict matching - need substantial overlap
            question_lower = question.lower()
            if len(question_lower) > 20:  # For longer questions, check if significant portion appears
                question_parts = [part.strip() for part in question_lower.split() if len(part) > 4]
                matches = sum(1 for part in question_parts if part in conversation_text)
                if matches >= len(question_parts) * 0.6:  # 60% of significant words must match
                    covered_count += 1
            else:  # For shorter questions, need exact phrase match
                if question_lower in conversation_text:
                    covered_count += 1
        
        return covered_count >= len(self.custom_questions)  # All questions must be covered
    
    def _get_remaining_custom_questions(self):
        """Get custom questions that haven't been covered yet"""
        if not self.custom_questions:
            return []
        
        conversation_text = " ".join([ex.get('bot', '') for ex in self.session_manager.conversation]).lower()
        remaining = []
        
        for question in self.custom_questions:
            question_lower = question.lower()
            covered = False
            
            if len(question_lower) > 20:  # For longer questions
                question_parts = [part.strip() for part in question_lower.split() if len(part) > 4]
                matches = sum(1 for part in question_parts if part in conversation_text)
                if matches >= len(question_parts) * 0.6:
                    covered = True
            else:  # For shorter questions
                if question_lower in conversation_text:
                    covered = True
            
            if not covered:
                remaining.append(question)
        
        return remaining
    
    def _format_generated_questions(self):
        """Format LLM-generated questions for prompt inclusion"""
        if not self.interview_questions_data:
            return "No generated questions available - use general interview approach."
        
        sections = []
        
        # Technical Questions
        tech_questions = self.interview_questions_data.get('technical_questions', [])
        if tech_questions:
            sections.append("TECHNICAL QUESTIONS (LLM-Generated):")
            for i, q in enumerate(tech_questions[:5], 1):
                category = q.get('category', 'General')
                question = q.get('question', '')
                difficulty = q.get('difficulty', 'medium')
                follow_up = q.get('follow_up', '')
                sections.append(f"{i}. [{category}] {question} (Difficulty: {difficulty})")
                if follow_up:
                    sections.append(f"   Follow-up: {follow_up}")
        
        # Project Questions
        project_questions = self.interview_questions_data.get('project_questions', [])
        if project_questions:
            sections.append("\nPROJECT-SPECIFIC QUESTIONS (LLM-Generated):")
            for i, q in enumerate(project_questions[:3], 1):
                project = q.get('project', 'Recent Project')
                question = q.get('question', '')
                follow_up = q.get('follow_up', '')
                sections.append(f"{i}. [Project: {project}] {question}")
                if follow_up:
                    sections.append(f"   Follow-up: {follow_up}")
        
        # Behavioral Questions
        behavioral_questions = self.interview_questions_data.get('behavioral_questions', [])
        if behavioral_questions:
            sections.append("\nBEHAVIORAL QUESTIONS (LLM-Generated):")
            for i, q in enumerate(behavioral_questions[:3], 1):
                category = q.get('category', 'General')
                question = q.get('question', '')
                context = q.get('context', '')
                sections.append(f"{i}. [{category}] {question}")
                if context:
                    sections.append(f"   Context: {context}")
        
        if not sections:
            return "No generated questions available - use general interview approach."
        
        sections.append("\nUSAGE: Reference these questions systematically during the interview. Use them as your primary question bank.")
        return "\n".join(sections)
    
    def _format_custom_questions(self):
        """Format custom recruiter questions for prompt inclusion"""
        if not self.custom_questions and not self.prescreening_questions and not self.technical_custom_questions:
            return "No custom recruiter questions provided."
        
        sections = []
        
        if self.prescreening_questions:
            sections.append("PRE-SCREENING QUESTIONS (Ask after introduction):")
            for i, question in enumerate(self.prescreening_questions, 1):
                sections.append(f"{i}. {question}")
        
        if self.technical_custom_questions:
            sections.append("\nTECHNICAL CUSTOM QUESTIONS (Ask during technical phase):")
            for i, question in enumerate(self.technical_custom_questions, 1):
                sections.append(f"{i}. {question}")
        
        if self.custom_questions:
            sections.append("\nGENERAL CUSTOM QUESTIONS (Ask during appropriate phases):")
            for i, question in enumerate(self.custom_questions, 1):
                sections.append(f"{i}. {question}")
        
        sections.append("\nUSAGE: Integrate these questions naturally during specified interview phases. These are recruiter-specific requirements that must be covered.")
        return "\n".join(sections)

    def check_exit_condition(self, text):
        if self.interview_mode:
            text_lower = text.lower().strip()
            return any(phrase in text_lower for phrase in self.exit_phrases)
        else:
            text_lower = text.lower().strip()
            analysis_exits = ['bye', 'goodbye', 'exit', 'quit', 'end analysis', 'stop analysis', 'finish session']
            return any(phrase in text_lower for phrase in analysis_exits)

    # ---------------------------
    # Connect & session config
    # ---------------------------
    async def connect(self):
        url = "wss://api.openai.com/v1/realtime?model=gpt-realtime"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "OpenAI-Beta": "realtime=v1"
        }
        try:
            self.websocket = await websockets.connect(url, additional_headers=headers)
            mode = "Interview" if self.interview_mode else "Conversation"
            print(f"✅ Connected to OpenAI Realtime API ({mode} mode)")

            # Session configuration optimized for interview accuracy
            turn_detection_config = {
                "type": "server_vad",
                "threshold": 0.76, # Slightly less sensitive for cleaner audio
                "prefix_padding_ms": 900,  # More padding for complete speech capture
                "silence_duration_ms": 1500, # Longer pause for technical explanations
                "create_response": True
            }
            
            # Use semantic turn detection for non-interview mode for better conversation flow
            if not self.interview_mode:
                turn_detection_config = {
                    "type": "server_vad",
                    "threshold": 0.3,  # Very sensitive for natural conversation
                    "prefix_padding_ms": 600,  # Extra padding for natural speech
                    "silence_duration_ms": 1000 
                }

            # Enhanced transcription optimized for technical accuracy
            transcription_prompt = """PRIORITY:
    1 Transcribe ONLY clear speech. If audio is unclear or contains only noise, return empty. Never guess or add words not clearly spoken.
    2. Keep natural speech patterns: um, uh, like, you know, so, well, actually, basically
    3) Mark hesitations with (...)
    4) Show repetitions: I, I mean
    5) Mark false starts: I was—I mean
    6) NEVER add content not spoken
    7) NEVER clean up or interpret - raw speech only
    8) Focus on accuracy over emotional markers.
    """

            session_config = {
                "type": "session.update",
                "session": {
                    "modalities": ["text", "audio"],
                    "instructions": self.get_interview_instructions(),
                    "voice": self.voice,
                    "input_audio_format": "pcm16",
                    "output_audio_format": "pcm16",
                    "input_audio_transcription": {
                        "model": "gpt-4o-transcribe",
                        "prompt": transcription_prompt,
                        "language": "en"
                    },
                    "input_audio_noise_reduction": {
                        "type": "near_field"
                    },
                    "turn_detection": turn_detection_config
                }
            }

            await self.send_event(session_config)
            print(f"🔧 Session configured for {'interview' if self.interview_mode else 'conversation'} with {self.voice} voice")
            if self.interview_mode:
                self.phase_manager.start_interview()
        except Exception as e:
            logger.exception("Connect failed")
            raise

    async def send_event(self, event: dict):
        try:
            if self.websocket:
                await self.websocket.send(json.dumps(event))
        except (websockets.exceptions.ConnectionClosed, websockets.exceptions.ConnectionClosedError):
            logger.warning("WebSocket connection closed, stopping bot")
            self.running = False
        except Exception:
            logger.exception("Failed to send event")

    # ---------------------------
    # Audio & event loops
    # ---------------------------
    def start_audio_stream(self):
        self.audio_manager.start_streams()
        # local input_stream / output_stream point to audio_manager streams for compatibility
        self.input_stream = self.audio_manager.input_stream
        self.output_stream = self.audio_manager.output_stream
        print("🎵 Audio streams ready")

    async def handle_audio_input(self):
        print("🎤 Listening...")
        while self.running:
            try:
                data = self.input_stream.read(self.audio_manager.chunk_size, exception_on_overflow=False)
                # Store all raw user audio for evaluation
                if self.interview_mode:
                    self.raw_user_audio_buffer.append(data)
                audio_array = np.frombuffer(data, dtype=np.int16)
                energy = np.sqrt((audio_array.astype(np.float32) / 32768.0) ** 2).mean()
                if energy > 0.008:
                    # Store filtered user audio for evaluation
                    if self.interview_mode:
                        self.user_audio_buffer.append(data)
                # metrics
                self.session_manager.performance_metrics['audio_chunks_sent'] += 1
                self.session_manager.performance_metrics['total_audio_input_bytes'] += len(data)
                self.session_manager.input_audio_seconds += len(data) / (self.audio_manager.sample_rate * 2)
                # send
                await self.send_event({"type":"input_audio_buffer.append","audio": base64.b64encode(data).decode()})
                await asyncio.sleep(0.0001)
            except Exception:
                logger.exception("Audio input handling error")
                break

    async def handle_openai_events(self):
        while self.running:
            try:
                msg = await self.websocket.recv()
                event = json.loads(msg)
                event_type = event.get("type")
                if event_type == "session.created":
                    print("🎯 Session ready")
                elif event_type == "conversation.item.input_audio_transcription.completed":
                    transcript = event.get("transcript","").strip()
                    if transcript:
                        # Accumulate user speech across pauses
                        if self._accumulated_user_text:
                            self._accumulated_user_text += " " + transcript
                        else:
                            self._accumulated_user_text = transcript
                        
                        self._last_user_speech_time = time.time()
                        
                        # Check exit condition
                        if self.check_exit_condition(transcript):
                            if self.interview_mode:
                                print("\n🔄 Generating evaluation before exit...")
                                self._generate_evaluation_sync()
                            await asyncio.sleep(1.0)
                            self.running = False
                            return
                elif event_type == "input_audio_buffer.speech_started":
                    print("🗣️  Speaking...", end='\r')
                elif event_type == "input_audio_buffer.speech_stopped":
                    print("🤖 Processing...", end='\r')
                elif event_type == "response.created":
                    self._response_in_progress = True
                    self._response_start_time = time.time()
                elif event_type == "response.audio.delta":
                    audio_delta = event.get("delta","")
                    if audio_delta:
                        self.session_manager.performance_metrics['audio_chunks_received'] += 1
                        audio_data = base64.b64decode(audio_delta)
                        if audio_data:
                            self.session_manager.performance_metrics['total_audio_output_bytes'] += len(audio_data)
                            self.session_manager.output_audio_seconds += len(audio_data) / (self.audio_manager.sample_rate * 2)
                            self.audio_manager.audio_queue.put(audio_data)
                            # Store audio for evaluation
                            if self.interview_mode:
                                self.audio_buffer.append(audio_data)
                elif event_type == "response.audio_transcript.delta":
                    with self._response_lock:
                        self._current_response_text += event.get("delta","")
                elif event_type == "response.done":
                    # finalize response
                    if self._response_start_time:
                        self.session_manager.performance_metrics['response_times'].append(time.time()-self._response_start_time)
                        self._response_start_time = None
                    with self._response_lock:
                        self._response_in_progress = False
                        if self._current_response_text.strip() and self._accumulated_user_text:
                            resp_text = self._current_response_text.strip()
                            user_text = self._accumulated_user_text.strip()
                            
                            # Only process if we have both user and bot text
                            print("\n\n" + "="*80)
                            print(f"Exchange #{self.session_manager.conversation_count + 1} [{datetime.now().strftime('%H:%M:%S')}]")
                            print(f"\n🗣️  {'CANDIDATE' if self.interview_mode else 'SPEAKER'}:")
                            print(f"   {user_text}")
                            print(f"\n🤖 {'INTERVIEWER' if self.interview_mode else 'ANALYST'}:")
                            print(f"   {resp_text}")
                            print("-"*70)
                            
                            # Add conversation entry using session manager
                            current_phase = self.phase_manager.interview_phase if self.interview_mode else None
                            self.session_manager.add_conversation_entry(
                                user_text, resp_text, current_phase
                            )
                            
                            # Natural interview flow - only end on time limit
                            if self.interview_mode and self.phase_manager.is_interview_time_exceeded():
                                self.phase_manager.transition_to_phase("completed")
                                self._generate_evaluation_sync()
                                self.running = False
                                return
                        # reset
                        self._accumulated_user_text = ""
                        self._current_response_text = ""
                elif event_type == "error":
                    logger.error(f"OpenAI error event: {event}")
                    self.session_manager.performance_metrics['connection_errors'] += 1
            except (websockets.exceptions.ConnectionClosed, websockets.exceptions.ConnectionClosedError):
                print("\n🔌 Connection closed")
                self.running = False
                break
            except Exception:
                logger.exception("OpenAI event handling error")
                self.running = False
                break

    # ---------------------------
    # Evaluation wrapper
    # ---------------------------
    def _prepare_conversation_for_analysis(self):
        conversation_text = "INTERVIEW CONVERSATION:\n\n"
        for ex in self.session_manager.conversation:
            conversation_text += f"INTERVIEWER: {ex['bot']}\nCANDIDATE: {ex['user']}\n\n"
        context_text = f"""
JOB DESCRIPTION CONTEXT:
{self.job_description[:1000]}...

CANDIDATE RESUME CONTEXT:
{self.candidate_resume[:1000]}...

INTERVIEW METADATA:
- Duration: {self.interview_duration} minutes
- Total Exchanges: {len(self.session_manager.conversation)}
- Interview Phase Completed: {self.phase_manager.interview_phase}
"""
        return conversation_text + context_text

    def _save_audio_files(self):
        """Audio saving removed - using transcript-only evaluation"""
        return None

    def _generate_evaluation_sync(self):
        if not self.interview_mode or not self.session_manager.conversation:
            return
        print("🔄 Generating AI evaluation (transcript-based)...")
        
        # Prepare conversation text
        conversation_text = self._prepare_conversation_for_analysis()
        
        # Call evaluation with transcript only
        eval_result = call_comprehensive_evaluation(
            self.api_key, 
            conversation_text, 
            self.job_description, 
            self.candidate_resume, 
            None,
            self.phase_manager.interview_start_time
        )
        
        if eval_result:
            self.evaluation_data = eval_result
            print("✅ AI evaluation completed successfully")
        else:
            print("⚠️ Evaluation failed or empty")
            
        self._save_evaluation_json()
        self.session_manager.save_performance_metrics()

    def _save_evaluation_json(self):
        if not getattr(self, "evaluation_data", None):
            return
        report = {
            "interview_metadata": {
                "date": self.session_manager.session_start_time.strftime('%Y-%m-%d %H:%M:%S'),
                "duration_planned": f"{self.interview_duration} minutes",
                "voice_used": self.voice,
                "total_exchanges": len(self.session_manager.conversation),
                "final_phase": self.phase_manager.interview_phase
            },
            **self.evaluation_data
        }
        save_json(report, "interview_evaluation")




    
    def _categorize_custom_questions(self, questions):
        """Categorize custom questions based on keywords"""
        prescreening_keywords = ['availability', 'notice period', 'salary', 'location', 'visa', 'authorization', 'relocate', 'travel', 'interested', 'why', 'motivation']
        technical_keywords = ['experience', 'worked', 'architect', 'deploy', 'difference', 'manage', 'technical', 'programming', 'coding', 'algorithm', 'database', 'system']
        
        for question in questions:
            question_lower = question.lower()
            
            if any(keyword in question_lower for keyword in prescreening_keywords):
                self.prescreening_questions.append(question)
            elif any(keyword in question_lower for keyword in technical_keywords):
                self.technical_custom_questions.append(question)
            else:
                self.custom_questions.append(question)

    def print_summary(self):
        """Enhanced summary with interview metrics and usage tracking"""
        self.session_manager.print_summary(self.phase_manager.interview_start_time if self.interview_mode else None)
    
    def save_transcript(self):
        """Save enhanced transcript with interview details"""
        return self.session_manager.save_transcript()

    # ---------------------------
    # Run loop
    # ---------------------------
    async def run(self):
        try:
            print(f"🚀 Starting AI {'Interview' if self.interview_mode else 'Conversation'} Bot...")
            await self.connect()
            self.start_audio_stream()
            print("🎙️ Start speaking naturally...")
            await asyncio.gather(self.handle_audio_input(), self.handle_openai_events())
        except Exception:
            logger.exception("Bot run error")
        finally:
            await self.cleanup()

    async def cleanup(self):
        self.running = False
        # Generate evaluation if interview mode and not already done
        if self.interview_mode and self.session_manager.conversation and not self.evaluation_data:
            print("\n🔄 Generating final evaluation...")
            self._generate_evaluation_sync()
        self.audio_manager.stop()
        if self.websocket:
            try:
                await self.websocket.close()
            except Exception:
                pass
        print("✅ Cleanup complete")
