from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from typing import List, Any
try:
    from backend.database import Base, engine, get_db
    from backend.models import Candidate, Agent, CandidateInterviewFeedback, FileRecord
except Exception:  # Fallback when running as a script
    from database import Base, engine, get_db
    from models import Candidate, Agent


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    candidate_id: int
    email: str
    name: str | None = None

class FeedbackRequest(BaseModel):
    response_id: int
    feedback: Optional[str] = None
    satisfaction: int


class QuestionsRequest(BaseModel):
    candidate_id: int
    interview_type: str
    questions: dict | list

app = FastAPI(title="RBvoice ", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Create tables if they do not exist
Base.metadata.create_all(bind=engine)


# @app.get("/health")
# def health():
#     return {"ok": True}


@app.post("/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    candidate: Candidate | None = (
        db.query(Candidate).filter(Candidate.email == payload.email).first()
    )
    if candidate is None:
        raise HTTPException(status_code=401, detail="Invalid email or password")

   
    if not candidate.password_hash or candidate.password_hash != payload.password:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return LoginResponse(
        candidate_id=candidate.candidate_id,
        email=candidate.email,
        name=candidate.name,
    )


@app.get("/questions")
def get_questions(candidate_id: int | None = None, interview_type: str | None = None, db: Session = Depends(get_db)):
    query = db.query(Agent)
    if interview_type is not None:
        query = query.filter(Agent.interview_type == interview_type)
    if candidate_id is not None:
        query = query.filter(Agent.candidate_id == candidate_id)
    rows = query.order_by(Agent.viewer_id.desc()).limit(100).all()
    return [
        {
            "viewer_id": r.viewer_id,
            "candidate_id": r.candidate_id,
            "interview_type": r.interview_type,
            "questions": r.questions,
        }
        for r in rows
    ]


class QuestionCreate(BaseModel):
    candidate_id: int
    interview_type: str
    questions: List[Any]  # Can be List[str] if only strings are stored


# --- POST endpoint ---
@app.post("/questions")
def create_question(question: QuestionCreate, db: Session = Depends(get_db)):
    new_question = Agent(
        candidate_id=question.candidate_id,
        interview_type=question.interview_type,
        questions=question.questions,
    )
    db.add(new_question)
    db.commit()
    db.refresh(new_question)

    return {
        "viewer_id": new_question.viewer_id,
        "candidate_id": new_question.candidate_id,
        "interview_type": new_question.interview_type,
        "questions": new_question.questions,
    }

@app.post("/feedback")
def submit_feedback(payload: FeedbackRequest, db: Session = Depends(get_db)):
    # Check if response_id exists
    response_exists = db.execute(
        f"SELECT 1 FROM interview_responses WHERE response_id = {payload.response_id}"
    ).first()
    if not response_exists:
        raise HTTPException(status_code=400, detail="Invalid response_id")

    feedback = CandidateInterviewFeedback(
        response_id=payload.response_id,
        feedback=payload.feedback,
        satisfaction=payload.satisfaction,
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)

    return {
        "feedback_id": feedback.feedback_id,
        "response_id": feedback.response_id,
        "feedback": feedback.feedback,
        "satisfaction": feedback.satisfaction,
    }


# ------------------- Files Upload -------------------
@app.post("/files")
async def upload_file(
    candidate_id: int = Form(...),
    file_type: str = Form(...),  # 'resume' | 'jd'
    uploaded_file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    # Basic validation
    if file_type not in {"resume", "jd"}:
        raise HTTPException(status_code=400, detail="Invalid file_type. Use 'resume' or 'jd'.")

    # Ensure candidate exists
    candidate: Candidate | None = db.query(Candidate).filter(Candidate.candidate_id == candidate_id).first()
    if candidate is None:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Store file to local filesystem under ./files/
    import os
    from datetime import datetime

    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "files"))
    os.makedirs(base_dir, exist_ok=True)

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    safe_name = uploaded_file.filename or "upload"
    # Avoid path traversal
    safe_name = os.path.basename(safe_name)
    storage_filename = f"{candidate_id}_{file_type}_{timestamp}_{safe_name}"
    storage_path = os.path.join(base_dir, storage_filename)

    file_bytes = await uploaded_file.read()
    try:
        with open(storage_path, "wb") as f:
            f.write(file_bytes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {e}")

    rel_path = f"files/{storage_filename}"

    # Create DB record
    record = FileRecord(
        candidate_id=candidate_id,
        file_type=file_type,
        original_filename=safe_name,
        content_type=uploaded_file.content_type,
        storage_path=rel_path,
        size_bytes=len(file_bytes),
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return {
        "file_id": record.file_id,
        "candidate_id": record.candidate_id,
        "file_type": record.file_type,
        "original_filename": record.original_filename,
        "content_type": record.content_type,
        "storage_path": record.storage_path,
        "size_bytes": record.size_bytes,
    }

