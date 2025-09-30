# phase_manager.py
from datetime import datetime
from interview_utils import extract_candidate_name

class PhaseManager:
    def __init__(self, interview_duration: int):
        self.interview_duration = interview_duration
        self.interview_phase = "introduction"
        self.interview_start_time = None
        self.phase_start_time = None
        self.interview_questions_data = {}
        
        # Phase durations for interview management
        if self.interview_duration <= 10:
            self.phase_durations = {
                "introduction": 1,
                "technical": self.interview_duration - 2,
                "wrap_up": 1
            }
        elif self.interview_duration <= 20:
            self.phase_durations = {
                "introduction": 2,
                "technical": self.interview_duration - 5,
                "wrap_up": 1
            }
        else:
            self.phase_durations = {
                "introduction": 3,
                "technical": self.interview_duration - 7,
                "wrap_up": 2
            }

    def start_interview(self):
        """Start the interview timer"""
        self.interview_start_time = datetime.now()
        self.phase_start_time = datetime.now()

    def is_interview_time_exceeded(self) -> bool:
        """Check if total interview time limit is exceeded"""
        if not self.interview_start_time:
            return False
        total_elapsed = (datetime.now() - self.interview_start_time).total_seconds() / 60
        return total_elapsed >= self.interview_duration
    
    def should_transition_phase(self) -> bool:
        """Check if it's time to transition to next interview phase"""
        if not self.phase_start_time:
            return False
        phase_elapsed = (datetime.now() - self.phase_start_time).total_seconds() / 60
        phase_duration = self.phase_durations.get(self.interview_phase, 30)
        return phase_elapsed >= phase_duration
    
    def get_next_phase(self) -> str:
        """Get the next interview phase"""
        phases = ["introduction", "technical", "wrap_up"]
        try:
            current_index = phases.index(self.interview_phase)
            if current_index < len(phases) - 1:
                return phases[current_index + 1]
            else:
                return "completed"
        except ValueError:
            return "completed"

    def transition_to_phase(self, new_phase: str):
        """Transition to a new phase"""
        self.interview_phase = new_phase
        self.phase_start_time = datetime.now()

    def get_phase_transition_instruction(self, old_phase: str, new_phase: str, candidate_resume: str) -> str:
        """Get phase transition instruction referencing LLM-generated questions"""
        candidate_name = extract_candidate_name(candidate_resume)
        
        tech_questions = self.interview_questions_data.get('technical_questions', [])
        
        if old_phase == "introduction" and new_phase == "technical":
            tech_focus = ", ".join([q.get('category', '') for q in tech_questions[:3]]) if tech_questions else "technical skills"
            return f"PHASE TRANSITION: Move to technical discussion. Transition naturally: 'Great, {candidate_name}! Now let's dive into your technical experience.' Focus on {tech_focus} and reference the generated technical and project questions. Ask about their most relevant project first, then use behavioral questions about teamwork, problem-solving, and learning from the generated question bank. Use {candidate_name}'s name frequently."
        elif old_phase == "technical" and new_phase == "wrap_up":
            return f"PHASE TRANSITION: Move to conclusion. Transition: 'Thank you for sharing those details, {candidate_name}. Before we wrap up, let me ask a couple final questions.' Use any remaining behavioral questions from the generated set about motivation, growth, and cultural fit. Then ask if they have questions and conclude warmly."
        elif old_phase == "introduction" and new_phase == "wrap_up":
            return f"PHASE TRANSITION: Direct to conclusion. Transition: 'Thank you, {candidate_name}. Do you have any questions about the role or company?' Conclude warmly using their name."
        return f"Continue naturally with {candidate_name} in the {new_phase} phase using generated questions as reference."