import axios from 'axios';

// Base URL for the backend API
export const API_BASE_URL = 'http://localhost:8000';

// Axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Session ID (numeric) regenerated on every page load
const SESSION_ID: number = (() => {
  const sid = Math.floor(Math.random() * 900000) + 100000;
  try { sessionStorage.setItem('session_id', String(sid)); } catch {}
  return sid;
})();
function getSessionId(): number { return SESSION_ID; }

// Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  candidate_id: number;
  email: string;
  name?: string | null;
}

export interface SignUpRequest {
  name?: string | null;
  email: string;
  password: string;
}

export interface FeedbackRequest {
  response_id: number;
  feedback?: string;
  satisfaction: number;
}

// API
export const apiService = {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },

  async uploadResume(file: File): Promise<{ resume_id: number; resume_path: string; uploaded_at?: string }> {
    const formData = new FormData();
    formData.append('uploaded_file', file);
    const response = await api.post(`/resume/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async createRecruiter(payload: {
    resumeId: number;
    jdTitle: string;
    jdDescription: string;
    jdFile?: File | null;
    questionsJson?: any;
    linkedinUrl?: string | null;
  }): Promise<{
    jd_id: number;
    resume_id: number;
    jd: { title: string; description: string };
    jd_file_path?: string | null;
    questions?: any;
    linkedin_url?: string | null;
    created_at: string;
  }> {
    const form = new FormData();
    form.append('resume_id', String(payload.resumeId));
    form.append('jd_title', payload.jdTitle);
    form.append('jd_description', payload.jdDescription);
    if (payload.linkedinUrl != null) form.append('linkedin_url', payload.linkedinUrl);
    if (payload.questionsJson != null) form.append('questions_json', JSON.stringify(payload.questionsJson));
    if (payload.jdFile) form.append('jd_file', payload.jdFile);
    const response = await api.post(`/recruiter`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
    return response.data;
  },
  async getRecruiterByResumeId(resumeId: number): Promise<{
    resume: { resume_id: number; resume_path: string; uploaded_at: string };
    recruiter: null | { jd_id: number; jd: any; jd_file_path?: string | null; questions?: any; linkedin_url?: string | null; created_at: string };
    parsed?: { resume_path?: string | null; jd_path?: string | null; questions?: any; jd_dict?: any; resume_txt?: string; jd_txt?: string };
  }> {
    const response = await api.get(`/recruiter/${resumeId}`);
    return response.data;
  },

  async exportRecruiterBundle(resumeId: number): Promise<{ saved: boolean; path: string; resume_id: number }> {
    const response = await api.post(`/recruiter/${resumeId}/export`);
    return response.data;
  },

  async startBot(payload: { resume_txt: string; jd_txt: string; questions_dict?: Record<string, string> | null }): Promise<{ started: boolean }> {
    const response = await api.post('/bot/start', payload);
    return response.data;
  },

  async signup(payload: SignUpRequest): Promise<LoginResponse> {
    const response = await api.post('/auth/signup', payload);
    return response.data;
  },

  async submitFeedback(payload: FeedbackRequest): Promise<{ inserted: boolean; feedback_id?: number }> {
    const response = await api.post('/feedback', payload);
    const data = response.data;
    // Backend returns { feedback_id, response_id, feedback, satisfaction }
    return { inserted: Boolean(data?.feedback_id), feedback_id: data?.feedback_id };
  },

  async uploadFile(candidateId: number, fileType: 'resume' | 'jd' | 'question', file: File): Promise<{
    file_id: number;
    candidate_id: number;
    file_type: string;
    storage_path: string;
    uploaded_at?: string;
  }> {
    const formData = new FormData();
    formData.append('candidate_id', String(candidateId));
    formData.append('file_type', fileType);
    formData.append('uploaded_file', file);
    formData.append('session_id', String(getSessionId()));

    // Use a separate axios call to set multipart headers automatically
    const response = await api.post(`/files`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async saveJD(candidateId: number, title: string, description: string): Promise<{
    file_id: number;
    candidate_id: number;
    file_type: string;
    jd: { title: string; description: string };
    storage_path: string;
    uploaded_at: string;
  }> {
    const form = new FormData();
    form.append('candidate_id', String(candidateId));
    form.append('title', title);
    form.append('description', description);
    form.append('session_id', String(getSessionId()));
    const response = await api.post(`/files/jd`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
    return response.data;
  },

  async saveLinkedin(candidateId: number, linkedinUrl: string): Promise<{ file_id: number; candidate_id: number; file_type: string; linkedin_url: string; uploaded_at: string; }> {
    const form = new FormData();
    form.append('candidate_id', String(candidateId));
    form.append('linkedin_url', linkedinUrl);
    form.append('session_id', String(getSessionId()));
    const response = await api.post(`/files/linkedin`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
    return response.data;
  },

  async saveQuestions(candidateId: number, questions: Array<{ id: number; question: string }>): Promise<{ file_id: number; candidate_id: number; file_type: string; question: any; uploaded_at: string; }> {
    const form = new FormData();
    form.append('candidate_id', String(candidateId));
    form.append('file_type', 'question');
    form.append('question_json', JSON.stringify(questions));
    form.append('session_id', String(getSessionId()));
    const response = await api.post(`/files`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
    return response.data;
  },

  async submitDashboard(payload: {
    candidateId: number;
    jdTitle?: string | null;
    jdDescription?: string | null;
    questionsJson?: Array<{ id: number; question: string }> | null;
    linkedinUrl?: string | null;
  }): Promise<any> {
    const form = new FormData();
    form.append('candidate_id', String(payload.candidateId));
    form.append('session_id', String(getSessionId()));
    if (payload.jdTitle != null) form.append('jd_title', payload.jdTitle);
    if (payload.jdDescription != null) form.append('jd_description', payload.jdDescription);
    if (payload.questionsJson != null) form.append('questions_json', JSON.stringify(payload.questionsJson));
    if (payload.linkedinUrl != null) form.append('linkedin_url', payload.linkedinUrl);
    const response = await api.post(`/files/submit`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
    return response.data;
  },
};

export default apiService;
