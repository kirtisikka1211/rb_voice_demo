from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from backend.database import Base


# ------------------- Candidate -------------------
class Candidate(Base):
    __tablename__ = "candidate"

    candidate_id = Column(Integer, primary_key=True, index=True)
    name = Column(Text)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)

    # Relationships
    agents = relationship("Agent", back_populates="candidate", cascade="all, delete-orphan")
    responses = relationship("InterviewResponse", back_populates="candidate", cascade="all, delete-orphan")


# ------------------- Agent / Interviewer -------------------
class Agent(Base):
    __tablename__ = "agent"

    viewer_id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidate.candidate_id", ondelete="CASCADE"), nullable=False)
    interview_type = Column(Text, nullable=False)
    questions = Column(JSON)

    # Relationships
    candidate = relationship("Candidate", back_populates="agents")
    responses = relationship("InterviewResponse", back_populates="interviewer", cascade="all, delete-orphan")


# ------------------- Interview Responses -------------------
class InterviewResponse(Base):
    __tablename__ = "interview_responses"

    response_id = Column(Integer, primary_key=True, index=True)
    response = Column(JSON)
    annotated_response = Column(JSON)
    edit_count = Column(Integer)
    last_edited_at = Column(DateTime)
    tab_switch_count = Column(Integer)
    validity = Column(DateTime)
    is_completed = Column(Boolean)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    is_ended = Column(Boolean)
    is_terminated = Column(Boolean)
    audio_url = Column(String)
    transcription_url = Column(String)

    # Foreign keys
    candidate_id = Column(Integer, ForeignKey("candidate.candidate_id", ondelete="CASCADE"))
    interviewer_id = Column(Integer, ForeignKey("agent.viewer_id", ondelete="SET NULL"))

    # Relationships
    candidate = relationship("Candidate", back_populates="responses")
    interviewer = relationship("Agent", back_populates="responses")
    feedbacks = relationship("CandidateInterviewFeedback", back_populates="response", cascade="all, delete-orphan")


# ------------------- Feedback -------------------
class CandidateInterviewFeedback(Base):
    __tablename__ = "candidate_interview_feedback"

    feedback_id = Column(Integer, primary_key=True, index=True)
    response_id = Column(Integer, ForeignKey("interview_responses.response_id", ondelete="CASCADE"))
    feedback = Column(Text)
    satisfaction = Column(Integer)

    # Relationships
    response = relationship("InterviewResponse", back_populates="feedbacks")


# ------------------- Files -------------------
class FileRecord(Base):
    __tablename__ = "files"

    file_id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidate.candidate_id", ondelete="CASCADE"), nullable=False)
    file_type = Column(String, nullable=False)  # e.g., 'resume' | 'jd'
    question = Column(Text)
    linkedin_url = Column(Text)
    storage_path = Column(Text, nullable=False)  # relative path or public URL
    uploaded_at = Column(DateTime)
    jd = Column(JSON)  # { title, description }
    session_id = Column(Integer)

    # Relationships
    # If needed in future, we can add: candidate = relationship("Candidate")


# ------------------- Resume -------------------
class Resume(Base):
    __tablename__ = "resume"

    resume_id = Column(Integer, primary_key=True, index=True)
    resume_path = Column(Text, nullable=False)
    uploaded_at = Column(DateTime)


# ------------------- Recruiter -------------------
class Recruiter(Base):
    __tablename__ = "recruiter"

    jd_id = Column(Integer, primary_key=True, index=True)
    resume_id = Column(Integer, ForeignKey("resume.resume_id", ondelete="CASCADE"))
    jd = Column(JSON)  # { title, description }
    jd_file_path = Column(Text)
    questions = Column(JSON)
    linkedin_url = Column(Text)
    created_at = Column(DateTime)
    # Stores parsed context blob returned by /recruiter/{resume_id}
    # shape: { resume_path, jd_path, questions, jd_dict, resume_txt, jd_txt }
    parsed = Column(JSON)


# ------------------- Evaluation -------------------
class Evaluation(Base):
    __tablename__ = "evaluation"

    evaluation_id = Column(Integer, primary_key=True, index=True)
    # Optional references for traceability
    resume_id = Column(Integer, ForeignKey("resume.resume_id", ondelete="SET NULL"))
    jd_id = Column(Integer, ForeignKey("recruiter.jd_id", ondelete="SET NULL"))
    # Core payloads
    parsed = Column(JSON)  # parsed blob (resume_path, jd_path, jd_dict, questions, resume_txt, jd_txt)
    transcript = Column(Text)  # optional transcript text/json string
    created_at = Column(DateTime)
