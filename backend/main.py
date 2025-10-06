from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Response
from fastapi import WebSocket, WebSocketDisconnect
from fastapi.websockets import WebSocketState
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from typing import List, Any
import os
from datetime import datetime
from io import BytesIO
import requests
import asyncio
import json
import base64
import contextlib
try:
    import websockets
except Exception:
    websockets = None
import PyPDF2
try:
    from docx import Document as DocxDocument
except Exception:
    DocxDocument = None
try:
    from backend.database import Base, engine, get_db
    from backend.models import Candidate, Agent, CandidateInterviewFeedback, FileRecord, Resume, Recruiter
except Exception:  # Fallback when running as a script
    from database import Base, engine, get_db
    from models import Candidate, Agent, Resume, Recruiter

try:
    from backend.bot_service import bot_service
except Exception:
    bot_service = None


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    candidate_id: int
    email: str
    name: str | None = None

class SignUpRequest(BaseModel):
    name: Optional[str] = None
    email: str
    password: str

class JDCreate(BaseModel):
    candidate_id: int
    title: str
    description: str

class FeedbackRequest(BaseModel):
    response_id: int
    feedback: Optional[str] = None
    satisfaction: int


class QuestionsRequest(BaseModel):
    candidate_id: int
    interview_type: str
    questions: dict | list

class BotStartRequest(BaseModel):
    resume_txt: str
    jd_txt: str
    questions_dict: Optional[dict[str, str]] = None

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
# --------------- Helpers: extract text from URL or filesystem ---------------
def _fetch_bytes(path_or_url: str) -> bytes:
    if path_or_url.startswith("http://") or path_or_url.startswith("https://"):
        resp = requests.get(path_or_url, timeout=30)
        if resp.status_code >= 400:
            raise HTTPException(status_code=400, detail=f"Failed to fetch URL: {path_or_url} - {resp.status_code}")
        return resp.content
    # local file path
    try:
        with open(path_or_url, "rb") as f:
            return f.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {path_or_url} - {e}")


def _guess_ext(path_or_url: str) -> str:
    base = path_or_url.split("?")[0]
    dot = base.rfind(".")
    return base[dot:].lower() if dot != -1 else ""


def extract_text_from_path(path_or_url: str) -> str:
    if not path_or_url:
        return ""
    data = _fetch_bytes(path_or_url)
    ext = _guess_ext(path_or_url)
    # PDF
    if ext == ".pdf":
        try:
            reader = PyPDF2.PdfReader(BytesIO(data))
            text_parts: list[str] = []
            for page in reader.pages:
                page_text = page.extract_text() or ""
                text_parts.append(page_text)
            return "\n".join(text_parts)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"PDF parse error: {e}")
    # DOCX
    if ext == ".docx" and DocxDocument is not None:
        try:
            doc = DocxDocument(BytesIO(data))
            return "\n".join(p.text for p in doc.paragraphs)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"DOCX parse error: {e}")
    # TXT or unknown: try utf-8
    try:
        return data.decode("utf-8")
    except Exception:
        return data.decode("latin-1", errors="ignore")



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


# ------------------- Auth: Sign up -------------------
@app.post("/auth/signup", response_model=LoginResponse)
def signup(payload: SignUpRequest, db: Session = Depends(get_db)):
    existing = db.query(Candidate).filter(Candidate.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    candidate = Candidate(name=payload.name, email=payload.email, password_hash=payload.password)
    db.add(candidate)
    db.commit()
    db.refresh(candidate)
    return LoginResponse(candidate_id=candidate.candidate_id, email=candidate.email, name=candidate.name)

# #
# ------------------- Resume upload -------------------
@app.post("/resume/upload")
async def upload_resume(
    uploaded_file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    safe_name = uploaded_file.filename or "resume"
    safe_name = os.path.basename(safe_name)
    storage_filename = f"resume_{timestamp}_{safe_name}"

    file_bytes = await uploaded_file.read()

    sb_url = ""
    sb_service_key = ""
    sb_bucket = os.getenv("SUPABASE_BUCKET", "files")
    if not sb_url or not sb_service_key:
        raise HTTPException(status_code=500, detail="Supabase configuration missing. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.")

    try:
        import requests
        object_path = f"resumes/{storage_filename}"
        upload_endpoint = f"{sb_url}/storage/v1/object/{sb_bucket}/{object_path}"
        headers = {
            "Authorization": f"Bearer {sb_service_key}",
            "apikey": sb_service_key,
            "Content-Type": uploaded_file.content_type or "application/octet-stream",
            "x-upsert": "true",
        }
        resp = requests.post(upload_endpoint, data=file_bytes, headers=headers, timeout=30)
        if resp.status_code not in (200, 201):
            raise HTTPException(status_code=500, detail=f"Supabase upload failed: {resp.status_code} {resp.text}")
        public_url = f"{sb_url}/storage/v1/object/public/{sb_bucket}/{object_path}"
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Supabase upload error: {e}")

    rec = Resume(resume_path=public_url, uploaded_at=datetime.utcnow())
    db.add(rec)
    db.commit()
    db.refresh(rec)

    return {"resume_id": rec.resume_id, "resume_path": rec.resume_path, "uploaded_at": rec.uploaded_at}


# ------------------- Recruiter create (JD) -------------------
@app.post("/recruiter")
async def create_recruiter(
    resume_id: int = Form(...),
    jd_title: str = Form(...),
    jd_description: str = Form(...),
    linkedin_url: Optional[str] = Form(None),
    questions_json: Optional[str] = Form(None),
    jd_file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
):
    resume_row: Resume | None = db.query(Resume).filter(Resume.resume_id == resume_id).first()
    if resume_row is None:
        raise HTTPException(status_code=404, detail="resume_id not found")

    jd_file_path = None
    if jd_file is not None:
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        safe_name = os.path.basename(jd_file.filename or "jd")
        storage_filename = f"jd_{timestamp}_{safe_name}"
        file_bytes = await jd_file.read()

        sb_url = "https://ceywatgfpiyfdhrqfbip.supabase.co"
        sb_service_key = ""
        sb_bucket = os.getenv("SUPABASE_BUCKET", "files")
        if not sb_url or not sb_service_key:
            raise HTTPException(status_code=500, detail="Supabase configuration missing. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.")
        try:
            import requests
            object_path = f"jd/{storage_filename}"
            upload_endpoint = f"{sb_url}/storage/v1/object/{sb_bucket}/{object_path}"
            headers = {
                "Authorization": f"Bearer {sb_service_key}",
                "apikey": sb_service_key,
                "Content-Type": jd_file.content_type or "application/octet-stream",
                "x-upsert": "true",
            }
            resp = requests.post(upload_endpoint, data=file_bytes, headers=headers, timeout=30)
            if resp.status_code not in (200, 201):
                raise HTTPException(status_code=500, detail=f"Supabase upload failed: {resp.status_code} {resp.text}")
            jd_file_path = f"{sb_url}/storage/v1/object/public/{sb_bucket}/{object_path}"
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Supabase upload error: {e}")

    # Parse questions from JSON if provided
    parsed_questions = None
    if questions_json is not None:
        try:
            import json
            parsed_questions = json.loads(questions_json)
        except Exception:
            raise HTTPException(status_code=400, detail="questions_json must be valid JSON")

    # Normalize questions into a dictionary: {"1": "...", "2": "..."}
    questions_dict = None
    if parsed_questions is not None:
        try:
            items = parsed_questions
            if isinstance(items, dict):
                # Already a dictionary; convert keys to strings to be safe
                questions_dict = {str(k): v for k, v in items.items()}
            elif isinstance(items, list):
                normalized: dict[str, str] = {}
                index = 1
                for it in items:
                    text = None
                    if isinstance(it, str):
                        text = it
                    elif isinstance(it, dict):
                        # Common shapes: { id, question } or { question }
                        if "question" in it and isinstance(it["question"], str):
                            text = it["question"]
                        elif "text" in it and isinstance(it["text"], str):
                            text = it["text"]
                    if text is not None:
                        normalized[str(index)] = text
                        index += 1
                questions_dict = normalized
            else:
                # Unsupported shape; store raw as string under key "1"
                questions_dict = {"1": str(items)}
        except Exception:
            questions_dict = None

    # Upsert: update existing recruiter row by resume_id; otherwise create new
    existing: Recruiter | None = (
        db.query(Recruiter)
        .filter(Recruiter.resume_id == resume_id)
        .order_by(Recruiter.jd_id.desc())
        .first()
    )

    if existing is not None:
        # Append questions if provided
        if questions_dict:
            try:
                current = existing.questions or {}
                # Determine next index
                if isinstance(current, dict) and current:
                    try:
                        next_idx = max(int(k) for k in current.keys() if str(k).isdigit()) + 1
                    except Exception:
                        next_idx = len(current) + 1
                else:
                    next_idx = 1
                for k in sorted(questions_dict.keys(), key=lambda x: int(x) if str(x).isdigit() else 1_000_000):
                    v = questions_dict[k]
                    current[str(next_idx)] = v
                    next_idx += 1
                existing.questions = current
            except Exception:
                # If merge fails, fall back to replacing
                existing.questions = questions_dict

        # Update JD/linkedin only if provided (non-empty)
        if (jd_title or jd_description):
            existing.jd = {"title": jd_title or "", "description": jd_description or ""}
        if jd_file_path:
            existing.jd_file_path = jd_file_path
        if linkedin_url:
            existing.linkedin_url = linkedin_url
        existing.created_at = existing.created_at or datetime.utcnow()

        db.add(existing)
        db.commit()
        db.refresh(existing)

        return {
            "jd_id": existing.jd_id,
            "resume_id": existing.resume_id,
            "jd": existing.jd,
            "jd_file_path": existing.jd_file_path,
            "questions": existing.questions,
            "linkedin_url": existing.linkedin_url,
            "created_at": existing.created_at,
        }

    # Create new if none exists
    rec = Recruiter(
        resume_id=resume_id,
        jd={"title": jd_title, "description": jd_description},
        jd_file_path=jd_file_path,
        questions=questions_dict,
        linkedin_url=linkedin_url,
        created_at=datetime.utcnow(),
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)

    return {
        "jd_id": rec.jd_id,
        "resume_id": rec.resume_id,
        "jd": rec.jd,
        "jd_file_path": rec.jd_file_path,
        "questions": rec.questions,
        "linkedin_url": rec.linkedin_url,
        "created_at": rec.created_at,
    }


# ------------------- Fetch recruiter by resume_id -------------------
@app.get("/recruiter/{resume_id}")
def get_recruiter_by_resume(resume_id: int, db: Session = Depends(get_db)):
    resume_row: Resume | None = db.query(Resume).filter(Resume.resume_id == resume_id).first()
    if resume_row is None:
        raise HTTPException(status_code=404, detail="resume_id not found")

    recruiter_row: Recruiter | None = (
        db.query(Recruiter)
        .filter(Recruiter.resume_id == resume_id)
        .order_by(Recruiter.jd_id.desc())
        .first()
    )

    resume_path = resume_row.resume_path if resume_row else None
    jd_path = recruiter_row.jd_file_path if recruiter_row else None
    jd_dict = recruiter_row.jd if recruiter_row else None
    questions_dict = recruiter_row.questions if recruiter_row else None

    # Build jd_txt: prefer file path, else use jd dict
    jd_txt = ""
    if jd_path:
        try:
            jd_txt = extract_text_from_path(jd_path)
        except HTTPException:
            jd_txt = ""
    if not jd_txt and jd_dict:
        title = (jd_dict or {}).get("title") or ""
        desc = (jd_dict or {}).get("description") or ""
        jd_txt = f"{title}\n\n{desc}".strip()

    # Build resume_txt
    resume_txt = ""
    if resume_path:
        try:
            resume_txt = extract_text_from_path(resume_path)
        except HTTPException:
            resume_txt = ""

    return {
        "resume": {
            "resume_id": resume_row.resume_id,
            "resume_path": resume_path,
            "uploaded_at": resume_row.uploaded_at,
        },
        "recruiter": None if recruiter_row is None else {
            "jd_id": recruiter_row.jd_id,
            "jd": jd_dict,
            "jd_file_path": jd_path,
            "questions": questions_dict,
            "linkedin_url": recruiter_row.linkedin_url,
            "created_at": recruiter_row.created_at,
        },
        "parsed": {
            "resume_path": resume_path,
            "jd_path": jd_path,
            "questions": questions_dict,
            "jd_dict": jd_dict,
            "resume_txt": resume_txt,
            "jd_txt": jd_txt,
        },
    }


# ------------------- Bot control (Interview evaluation integration) -------------------
class BotStartPayload(BaseModel):
    jd_txt: Optional[str] = None
    resume_txt: Optional[str] = None


class BotTranscriptPayload(BaseModel):
    session_id: str
    text: str


class BotStopPayload(BaseModel):
    session_id: str


@app.post("/bot/start")
def bot_start(payload: BotStartPayload):
    if bot_service is None:
        raise HTTPException(status_code=500, detail="Bot service unavailable")
    session_id = bot_service.start(jd_txt=payload.jd_txt or "", resume_txt=payload.resume_txt or "")
    return {"session_id": session_id}


@app.post("/bot/transcript")
def bot_transcript(payload: BotTranscriptPayload):
    if bot_service is None:
        raise HTTPException(status_code=500, detail="Bot service unavailable")
    try:
        bot_service.add_transcript(payload.session_id, payload.text or "")
    except KeyError:
        raise HTTPException(status_code=404, detail="Invalid session_id")
    return {"ok": True}


@app.post("/bot/stop")
def bot_stop(payload: BotStopPayload):
    if bot_service is None:
        raise HTTPException(status_code=500, detail="Bot service unavailable")
    try:
        evaluation = bot_service.stop_and_evaluate(payload.session_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Invalid session_id")
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"evaluation": evaluation}


@app.get("/bot/evaluation/{session_id}")
def bot_get_evaluation(session_id: str):
    if bot_service is None:
        raise HTTPException(status_code=500, detail="Bot service unavailable")
    evaluation = bot_service.get_evaluation(session_id)
    if evaluation is None:
        raise HTTPException(status_code=404, detail="Not found")
    return {"evaluation": evaluation}

# ------------------- WebRTC: Create ephemeral Realtime session token -------------------
class WebRTCSessionRequest(BaseModel):
    voice: Optional[str] = None
    jd_txt: Optional[str] = None
    resume_txt: Optional[str] = None
    questions_dict: Optional[dict] = None
    candidate_id: Optional[int] = None
    interview_duration: Optional[int] = 30

@app.options("/webrtc/session")
def webrtc_session_options(response: Response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return {"message": "OK"}

@app.post("/webrtc/session")
def create_webrtc_session(payload: WebRTCSessionRequest, response: Response):
    # Explicitly set CORS headers
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "*"
    
    try:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured on server")

        # Default model mirrors the Node demo fallback
        model = os.getenv("OPENAI_REALTIME_MODEL", "gpt-realtime")
        url = "https://api.openai.com/v1/realtime/sessions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "OpenAI-Beta": "realtime=v1",
        }
        body = {
            "model": model,
            "voice": payload.voice or "marin",
        }

        # Add interview instructions if context is provided
        if payload.jd_txt and payload.resume_txt:
            try:
                # Import bot components
                import sys
                sys.path.append('/Users/kirtisikka/Downloads/voice/backend')
                print(f"[DEBUG] Added path: /Users/kirtisikka/Downloads/voice/backend")
                print(f"[DEBUG] Python path: {sys.path}")
                
                from bot import InterviewBot
                print(f"[DEBUG] Successfully imported InterviewBot")
                
                # Create bot instance to generate instructions
                bot = InterviewBot(api_key=api_key, voice="marin",language="en", interview_duration=payload.interview_duration or 6,)  # pyright: ignore[reportUndefinedVariable]
                
                # Set the context directly
                bot.job_description = payload.jd_txt
              
                bot.candidate_resume = payload.resume_txt
                bot.interview_mode = True
                
                # Load custom questions if provided
                if payload.questions_dict:
                    questions_list = list(payload.questions_dict.values())
                    bot._categorize_custom_questions(questions_list)
                
                # Generate comprehensive interview instructions
                instructions = bot.get_interview_instructions()
                body["instructions"] = instructions
            
            except ImportError as e:
                print(f"[ERROR] Import failed: {e}")
                print(f"[ERROR] Import error type: {type(e).__name__}")
                # Fallback to simple instructions if bot import fails
               
            except Exception as e:
                print(f"[ERROR] Bot setup failed: {e}")
                print(f"[ERROR] Error type: {type(e).__name__}")
                import traceback
                print(f"[ERROR] Traceback: {traceback.format_exc()}")
                # Fallback to simple instructions if bot setup fails
                
        
        try:
            r = requests.post(url, headers=headers, json=body, timeout=30)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Failed to reach OpenAI: {e}")

        if r.status_code >= 400:
            # Pass through error text for easier debugging
            raise HTTPException(status_code=r.status_code, detail=r.text)

        try:
            return r.json()
        except Exception:
            raise HTTPException(status_code=502, detail="Invalid JSON from OpenAI")
    except Exception as e:
        print(f"Error in create_webrtc_session: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

