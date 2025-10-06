# interview_utils.py
import re
import json
from datetime import datetime
import openai
from prompts_repo import QUESTION_GENERATION_PROMPT, INTERVIEW_BASE_INSTRUCTIONS, TRANSCRIPTION_PROMPT_TEMPLATE

def extract_resume_content(resume_text: str) -> str:
    project_patterns = [
        r'PROJECTS?[:\s]+(.*?)(?=\n[A-Z]{2,}|$)',
        r'EXPERIENCE[:\s]+(.*?)(?=\n[A-Z]{2,}|$)'
    ]
    for pattern in project_patterns:
        match = re.search(pattern, resume_text, re.IGNORECASE | re.DOTALL)
        if match:
            return match.group(1).strip()[:800]
    return "Ask about technical projects mentioned in resume"

def extract_job_title(jd_text: str) -> str:
    print("job title extracted", jd_text)
    match = re.search(r'(?:job title|position)\s*:?\s*([^\n]+)', jd_text, re.I)
  
    return match.group(1).strip() if match else "Ai engineer Intern"

def extract_candidate_name(resume_text: str) -> str:
    lines = resume_text.split('\n')[:5]
    for line in lines:
        line = line.strip()
        # Check for name patterns - all caps or title case
        if re.match(r'^[A-Z][A-Z\s]+$', line) and len(line.split()) >= 2:
            full_name = line.title()  # Convert to title case
            return full_name.split()[0]  # Return only first name
        elif re.match(r'^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})$', line):
            return line.split()[0]  # Return only first name
    return "Candidate"

def get_time_greeting() -> str:
    hour = datetime.now().hour
    return "morning" if hour < 12 else "afternoon" if hour < 17 else "evening"

def generate_interview_questions(api_key: str, jd: str, resume: str) -> dict:
    client = openai.OpenAI(api_key=api_key)
    prompt = QUESTION_GENERATION_PROMPT.format(job_description=jd[:2000], candidate_resume=resume[:2000])
    try:
        resp = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "system", "content": "You are an expert technical interviewer who creates challenging, fair, and role-appropriate interview questions. Always respond with valid JSON."},
                      {"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=2000
        )
        txt = resp.choices[0].message.content.strip()
        # attempt to extract embedded json as in original
        if '```json' in txt:
            txt = txt.split('```json')[1].split('```')[0].strip()
        elif '```' in txt:
            txt = txt.split('```')[1].split('```')[0].strip()
        if not txt:
            return fallback_questions()
        questions = json.loads(txt)
        return questions
    except Exception:
        return fallback_questions()

def fallback_questions() -> dict:
    return {
        "technical_questions": [
            {"category": "General", "question": "Walk me through your most challenging technical project", "difficulty": "medium"},
            {"category": "Problem Solving", "question": "How do you approach debugging complex issues?", "difficulty": "medium"}
        ],
        "behavioral_questions": [
            {"category": "Teamwork", "question": "Describe a time you had to work with a difficult team member", "context": "General"}
        ],
        "project_questions": [
            {"project": "Recent Project", "question": "What was the most challenging aspect of your recent project?", "follow_up": "How did you overcome it?"}
        ]
    }

def build_interview_instructions(voice_title: str, job_title: str, candidate_name: str, candidate_resume: str, job_description: str, interview_structure: str, tech_section: str, resume_projects: str):
    return INTERVIEW_BASE_INSTRUCTIONS.format(
        voice_title=voice_title,
        job_title=job_title,
        candidate_resume=candidate_resume,
        job_description=job_description,
        interview_structure=interview_structure,
        tech_section=tech_section,
        resume_projects=resume_projects
    )
