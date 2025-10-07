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
from backend.database import Base, engine, get_db
from backend.models import Candidate, Agent, CandidateInterviewFeedback, FileRecord, Resume, Recruiter, Evaluation




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


class TranscriptCreate(BaseModel):
    transcript: str
    jd_id: Optional[int] = None
    resume_id: Optional[int] = None

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


# ------------------- Transcript ingest -------------------
@app.post("/evaluation/transcript")
def create_evaluation_transcript(payload: TranscriptCreate, db: Session = Depends(get_db)):
    if not payload.transcript or not payload.transcript.strip():
        raise HTTPException(status_code=400, detail="transcript is required")
    if payload.jd_id is None and payload.resume_id is None:
        raise HTTPException(status_code=400, detail="Provide jd_id or resume_id")

    # Upsert: update existing by jd_id (preferred) or resume_id; else insert new
    try:
        existing: Evaluation | None = None
        if payload.jd_id is not None:
            existing = (
                db.query(Evaluation)
                .filter(Evaluation.jd_id == payload.jd_id)
                .order_by(Evaluation.evaluation_id.desc())
                .first()
            )
        if existing is None and payload.resume_id is not None:
            existing = (
                db.query(Evaluation)
                .filter(Evaluation.resume_id == payload.resume_id)
                .order_by(Evaluation.evaluation_id.desc())
                .first()
            )

        if existing is not None:
            existing.transcript = payload.transcript.strip()
            # Optionally keep latest association fields consistent
            if payload.jd_id is not None:
                existing.jd_id = payload.jd_id
            if payload.resume_id is not None:
                existing.resume_id = payload.resume_id
            db.add(existing)
            db.commit()
            db.refresh(existing)
            return {
                "evaluation_id": existing.evaluation_id,
                "jd_id": existing.jd_id,
                "resume_id": existing.resume_id,
                "updated": True,
            }

        row = Evaluation(
            jd_id=payload.jd_id,
            resume_id=payload.resume_id,
            transcript=payload.transcript.strip(),
            parsed=None,
            created_at=datetime.utcnow(),
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return {
            "evaluation_id": row.evaluation_id,
            "jd_id": row.jd_id,
            "resume_id": row.resume_id,
            "updated": False,
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save transcript: {e}")


# ------------------- Evaluation fetch by resume_id -------------------
@app.get("/evaluation/{resume_id}")
def get_evaluation_by_resume(resume_id: int, db: Session = Depends(get_db)):
    try:
        # Fetch latest evaluation row for transcript
        row: Evaluation | None = (
            db.query(Evaluation)
            .filter(Evaluation.resume_id == resume_id)
            .order_by(Evaluation.evaluation_id.desc())
            .first()
        )
        if row is None:
            raise HTTPException(status_code=404, detail="No evaluation found for resume_id")

        transcript = (row.transcript or "").strip()

        # Determine JD/Resume text
        jd_txt = ""
        resume_txt = ""

        # Prefer parsed blob if available
        if row.parsed:
            try:
                jd_txt = (row.parsed or {}).get("jd_txt") or jd_txt
                resume_txt = (row.parsed or {}).get("resume_txt") or resume_txt
            except Exception:
                pass

        # If still missing, reconstruct from recruiter+resume
        if not jd_txt or not resume_txt:
            resume_row: Resume | None = db.query(Resume).filter(Resume.resume_id == resume_id).first()
            if resume_row is None:
                raise HTTPException(status_code=404, detail="resume row not found")

            recruiter_row: Recruiter | None = (
                db.query(Recruiter)
                .filter(Recruiter.resume_id == resume_id)
                .order_by(Recruiter.jd_id.desc())
                .first()
            )

            resume_path = resume_row.resume_path if resume_row else None
            jd_path = recruiter_row.jd_file_path if recruiter_row else None
            jd_dict = recruiter_row.jd if recruiter_row else None

            # JD text
            if not jd_txt:
                tmp = ""
                if jd_path:
                    try:
                        tmp = extract_text_from_path(jd_path)
                    except HTTPException:
                        tmp = ""
                if not tmp and jd_dict:
                    title = (jd_dict or {}).get("title") or ""
                    desc = (jd_dict or {}).get("description") or ""
                    tmp = f"{title}\n\n{desc}".strip()
                jd_txt = tmp

            # Resume text
            if not resume_txt and resume_path:
                try:
                    resume_txt = extract_text_from_path(resume_path)
                except HTTPException:
                    resume_txt = ""

        # Call evaluation function with transcript, JD, resume
        from backend.evaluation import call_comprehensive_evaluation

        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured")

        result = call_comprehensive_evaluation(
            api_key,
            transcript,
            jd_txt,
            resume_txt,
            None,
            None,
        )

        return {
            "evaluation_id": row.evaluation_id,
            "resume_id": row.resume_id,
            "jd_id": row.jd_id,
            "result": result,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to run evaluation: {e}")


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

    sb_url = os.getenv("SUPABASE_URL")
    sb_service_key = os.getenv("SUPABASE_SERVICE_KEY")
    sb_bucket = os.getenv("SUPABASE_BUCKET", "files")

    if sb_url and sb_service_key:
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

        sb_url = os.getenv("SUPABASE_URL")
        sb_service_key = os.getenv("SUPABASE_SERVICE_KEY")
        sb_bucket = os.getenv("SUPABASE_BUCKET", "files")
        if sb_url and sb_service_key:
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
        else:
            # Local filesystem fallback under project Data/uploads/jd
            project_root = os.path.dirname(os.path.dirname(__file__))
            local_dir = os.path.join(project_root, "Data", "uploads", "jd")
            try:
                os.makedirs(local_dir, exist_ok=True)
                local_path = os.path.join(local_dir, storage_filename)
                with open(local_path, "wb") as f:
                    f.write(file_bytes)
                jd_file_path = local_path
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Local save error: {e}")

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

        # Compute and persist parsed blob
        resume_row: Resume | None = db.query(Resume).filter(Resume.resume_id == existing.resume_id).first()
        resume_path = resume_row.resume_path if resume_row else None
        jd_path = existing.jd_file_path if existing else None
        jd_dict = existing.jd if existing else None
        try:
            jd_txt_val = extract_text_from_path(jd_path) if jd_path else ""
        except HTTPException:
            jd_txt_val = ""
        if not jd_txt_val and jd_dict:
            title = (jd_dict or {}).get("title") or ""
            desc = (jd_dict or {}).get("description") or ""
            jd_txt_val = f"{title}\n\n{desc}".strip()
        try:
            resume_txt_val = extract_text_from_path(resume_path) if resume_path else ""
        except HTTPException:
            resume_txt_val = ""
        existing.parsed = {
            "resume_path": resume_path,
            "jd_path": jd_path,
            "questions": existing.questions,
            "jd_dict": jd_dict,
            "resume_txt": resume_txt_val,
            "jd_txt": jd_txt_val,
        }

        # Also snapshot into evaluation table
    

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
            "parsed": existing.parsed,
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
    # Compute and persist parsed blob for new record
    resume_row: Resume | None = db.query(Resume).filter(Resume.resume_id == rec.resume_id).first()
    resume_path = resume_row.resume_path if resume_row else None
    jd_path = rec.jd_file_path if rec else None
    jd_dict = rec.jd if rec else None
    try:
        jd_txt_val = extract_text_from_path(jd_path) if jd_path else ""
    except HTTPException:
        jd_txt_val = ""
    if not jd_txt_val and jd_dict:
        title = (jd_dict or {}).get("title") or ""
        desc = (jd_dict or {}).get("description") or ""
        jd_txt_val = f"{title}\n\n{desc}".strip()
    try:
        resume_txt_val = extract_text_from_path(resume_path) if resume_path else ""
    except HTTPException:
        resume_txt_val = ""
    rec.parsed = {
        "resume_path": resume_path,
        "jd_path": jd_path,
        "questions": rec.questions,
        "jd_dict": jd_dict,
        "resume_txt": resume_txt_val,
        "jd_txt": jd_txt_val,
    }

    # Snapshot into evaluation table
   
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
        "parsed": rec.parsed,
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

    parsed_blob = {
        "resume_path": resume_path,
        "jd_path": jd_path,
        "questions": questions_dict,
        "jd_dict": jd_dict,
        "resume_txt": resume_txt,
        "jd_txt": jd_txt,
    }

    # Persist parsed blob on the recruiter row for future fast retrieval
    if recruiter_row is not None:
        try:
            recruiter_row.parsed = parsed_blob
            # Also snapshot into evaluation table (without transcript)
            try:
                eval_row = Evaluation(
                    resume_id=recruiter_row.resume_id,
                    jd_id=recruiter_row.jd_id,
                    parsed=parsed_blob,
                    transcript=None,
                    created_at=datetime.utcnow(),
                )
                db.add(eval_row)
            except Exception:
                pass
            # db.add(recruiter_row)
            db.commit()
        except Exception:
            db.rollback()

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
            "parsed": recruiter_row.parsed,
        },
        "parsed": parsed_blob,
    }





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
                from backend.bot import InterviewBot
                bot = InterviewBot(api_key=api_key, voice="marin", language="en", interview_duration=6)  # pyright: ignore[reportUndefinedVariable]
                bot.job_description = payload.jd_txt
                bot.candidate_resume = payload.resume_txt
                bot.interview_mode = True
                if payload.questions_dict:
                    questions_list = list(payload.questions_dict.values())
                    bot._categorize_custom_questions(questions_list)
                instructions = bot.get_interview_instructions()
                body["instructions"] = instructions
            except Exception as e:
                # leave body without instructions if bot import/setup fails
                print(f"[ERROR] Bot setup failed: {e}")
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