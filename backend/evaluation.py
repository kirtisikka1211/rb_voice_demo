# evaluation.py
import json
import openai
from datetime import datetime
from backend.prompts_repo import EVALUATION_PROMPT
import logging
import os

logger = logging.getLogger(__name__)

def call_comprehensive_evaluation(api_key: str, conversation_text: str, job_description: str = "", resume: str = "", audio_file_path: str = None, interview_start_time=None):
    """Enhanced evaluation using transcript for comprehensive assessment"""
    client = openai.OpenAI(api_key=api_key)
    
    # Note: Audio analysis not supported in Chat Completions API
    audio_note = " (Note: Audio file provided but analysis limited to transcript)" if audio_file_path else ""
    
    messages = [
        {
            "role": "system", 
            "content": f"You are an expert technical interviewer and communication evaluator. Analyze the interview transcript for comprehensive assessment.{audio_note}"
        },
        {
            "role": "user",
            "content": EVALUATION_PROMPT.format(
                conversation_text=conversation_text,
                job_description=job_description[:1000] if job_description else "Not provided",
                resume=resume[:1000] if resume else "Not provided"
            )
        }
    ]
    
    try:
        resp = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            temperature=0.3,
            max_tokens=2500
        )
        
        txt = resp.choices[0].message.content.strip()
        if '```json' in txt:
            txt = txt.split('```json')[1].split('```')[0].strip()
        elif '```' in txt:
            txt = txt.split('```')[1].split('```')[0].strip()
        
        data = json.loads(txt)
        
        # Add metadata
        data['evaluation_metadata'] = {
            'timestamp': datetime.now().isoformat(),
            'evaluation_type': 'transcript_only',
            'duration_seconds': (datetime.now() - interview_start_time).total_seconds() if interview_start_time else None
        }
        
        return data
        
    except Exception as e:
        logger.error(f"Comprehensive evaluation failed: {e}")
        return None

def call_interview_evaluation(api_key: str, conversation_text: str, job_description: str, resume: str, interview_start_time=None):
    """Legacy function - redirects to comprehensive evaluation"""
    return call_comprehensive_evaluation(api_key, conversation_text, job_description, resume, None, interview_start_time)





def _ensure_folder(folder_name: str):
    """Create folder if it doesn't exist"""
    if not os.path.exists(folder_name):
        os.makedirs(folder_name)

# Audio saving removed - using transcript-only evaluation

def save_json(data, prefix: str):
    folder_map = {
        "interview_evaluation": "Data/evaluations",
        "performance_metrics": "Data/metrics"
    }
    folder = folder_map.get(prefix, "Data")
    _ensure_folder(folder)
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"{folder}/{prefix}_{timestamp}.json"
    try:
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        logger.info(f"Saved {filename}")
        return filename
    except Exception as e:
        logger.error(f"Failed saving {filename}: {e}")
        return None
