import axios from 'axios';

// Base URL for the backend API
const API_BASE_URL = 'http://localhost:8000';

// Axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

  async submitFeedback(payload: FeedbackRequest): Promise<{ inserted: boolean; feedback_id?: number }> {
    const response = await api.post('/feedback', payload);
    const data = response.data;
    // Backend returns { feedback_id, response_id, feedback, satisfaction }
    return { inserted: Boolean(data?.feedback_id), feedback_id: data?.feedback_id };
  },

  async uploadFile(candidateId: number, fileType: 'resume' | 'jd', file: File): Promise<{
    file_id: number;
    candidate_id: number;
    file_type: string;
    original_filename: string;
    content_type?: string;
    storage_path: string;
    size_bytes?: number;
  }> {
    const formData = new FormData();
    formData.append('candidate_id', String(candidateId));
    formData.append('file_type', fileType);
    formData.append('uploaded_file', file);

    // Use a separate axios call to set multipart headers automatically
    const response = await axios.post(`${API_BASE_URL}/files`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};

export default apiService;
