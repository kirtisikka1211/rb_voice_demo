import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, MessageSquare, Settings, Upload } from 'lucide-react';
import FileUpload from './FileUpload';
import { apiService } from '../services/api';

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = '', children, ...props }) => (
  <button {...props} className={`inline-flex items-center justify-center rounded-md bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 ${className}`}>{children}</button>
);
const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...props }) => (
  <div {...props} className={`bg-white border border-gray-200 rounded-xl ${className}`}>{children}</div>
);
const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...props }) => (
  <div {...props} className={`p-6 ${className}`}>{children}</div>
);
const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className = '', children, ...props }) => (
  <h3 {...props} className={`text-lg font-medium ${className}`}>{children}</h3>
);
const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ className = '', children, ...props }) => (
  <p {...props} className={`text-sm text-gray-600 ${className}`}>{children}</p>
);
const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...props }) => (
  <div {...props} className={`p-6 ${className}`}>{children}</div>
);

const Badge: React.FC<{ variant?: 'default' | 'secondary' | 'outline'; className?: string; children?: React.ReactNode }> = ({ variant = 'outline', className = '', children }) => {
  const base = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs border';
  const variants: Record<string, string> = {
    default: 'bg-blue-600 text-white border-transparent',
    secondary: 'bg-gray-100 text-gray-800 border-transparent',
    outline: 'bg-transparent text-gray-800 border-gray-300',
  };
  return <span className={`${base} ${variants[variant]} ${className}`}>{children}</span>;
};

function SegmentedTabs({ value, onChange }: { value: 'jobs' | 'questions' | 'prompts' | 'candidates'; onChange: (v: 'jobs' | 'questions' | 'prompts' | 'candidates') => void }) {
  const base = 'flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm border transition-colors';
  const selected = 'bg-white text-[rgb(18,24,40)] border-gray-300 shadow-sm';
  const unselected = 'bg-transparent text-gray-600 border-gray-300/60 hover:bg-white/50';
  return (
    <div className="grid w-full grid-cols-4 gap-3">
         <button className={`${base} ${value==='candidates'?selected:unselected}`} onClick={() => onChange('candidates')}>
        <FileText className="w-4 h-4" /> Candidate Info
      </button>
      <button className={`${base} ${value==='jobs'?selected:unselected}`} onClick={() => onChange('jobs')}>
        <FileText className="w-4 h-4" /> Job Descriptions
      </button>
   
      <button className={`${base} ${value==='questions'?selected:unselected}`} onClick={() => onChange('questions')}>
        <MessageSquare className="w-4 h-4" /> Questions
      </button>
      <button className={`${base} ${value==='prompts'?selected:unselected}`} onClick={() => onChange('prompts')}>
        <Settings className="w-4 h-4" /> Custom Prompts
      </button>

    </div>
  );
}

export default function RecruiterDashboard() {
  const navigate = useNavigate();
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [customQuestion, setCustomQuestion] = useState('');
  const [activeTab, setActiveTab] = useState<'jobs' | 'questions' | 'prompts' | 'candidates'>('jobs');

  const mockJobs = [
    { id: 1, title: 'Senior Frontend Developer', department: 'Engineering', candidates: 12, status: 'active' },
    { id: 2, title: 'Product Manager', department: 'Product', candidates: 8, status: 'draft' },
    { id: 3, title: 'UX Designer', department: 'Design', candidates: 15, status: 'active' },
  ];

  const mockQuestions = [
    { id: 1, question: 'Tell me about your experience with React and modern JavaScript frameworks', category: 'Technical', type: 'Open-ended' },
    { id: 2, question: "Describe a challenging project you've worked on and how you overcame obstacles", category: 'Behavioral', type: 'Situational' },
    { id: 3, question: 'How do you approach debugging complex issues in production?', category: 'Technical', type: 'Problem-solving' },
  ];

  const [questions] = useState(mockQuestions);
  const [questionMode, setQuestionMode] = useState<'add' | 'upload'>('add');
  const [expandedQuestionId, setExpandedQuestionId] = useState<number | null>(null);
  const [editText, setEditText] = useState<string>('');
  const [customQuestions, setCustomQuestions] = useState<{ id: number; question: string }[]>([]);
  const [candidateMode, setCandidateMode] = useState<'resume' | 'linkedin'>('resume');
  const [linkedinProfile, setLinkedinProfile] = useState('');
  const [jdUploads, setJdUploads] = useState<Array<{ file_id: number; storage_path: string }>>([]);
  const [resumeUploads, setResumeUploads] = useState<Array<{ file_id: number; storage_path: string }>>([]);
  const [questionUploads, setQuestionUploads] = useState<Array<{ file_id: number; storage_path: string }>>([]);
  const candidateId = Number(localStorage.getItem('candidate_id') || '0');
  const [resumeId, setResumeId] = useState<number | null>(null);
  const [pendingJdFiles, setPendingJdFiles] = useState<File[]>([]);
  const [modal, setModal] = useState<{ message: string; open: boolean; onClose?: () => void }>({ message: '', open: false });
  const openModal = (message: string, onClose?: () => void) => setModal({ message, open: true, onClose });
  const closeModal = () => {
    try { modal.onClose && modal.onClose(); } catch {}
    setModal({ message: '', open: false });
  };
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const closePreview = () => setPreviewUrl(null);

  const handleSaveJob = async () => {
    try {
      if (!resumeId) {
        openModal('Please upload a resume first to generate resume_id.');
        return;
      }
      await apiService.createRecruiter({
        resumeId,
        jdTitle: jobTitle,
        jdDescription: jobDescription,
        jdFile: pendingJdFiles[0] || null,
        questionsJson: customQuestions,
        linkedinUrl: linkedinProfile || null,
      });
      setPendingJdFiles([]);
      openModal('Recruiter record ');
    } catch (e) {
      console.error('Failed to create recruiter record', e);
    }
  };
  const handleSavePrompt = () => { console.log('Saving custom prompt:', customPrompt); };
  const handleSaveQuestion = () => {
    const text = customQuestion.trim();
    if (!text) return;
    const nextId = customQuestions.length + 1;
    const newItem = { id: nextId, question: text } as const;
    setCustomQuestions(prev => [ newItem, ...prev ]);
    setCustomQuestion('');
    setExpandedQuestionId(newItem.id);
    setEditText(newItem.question);
  };

  const toggleExpand = (id: number, currentText: string) => {
    if (expandedQuestionId === id) {
      setExpandedQuestionId(null);
      return;
    }
    setExpandedQuestionId(id);
    setEditText(currentText);
  };

  const saveEdit = (id: number) => {
    const trimmed = editText.trim();
    if (!trimmed) return;
    setCustomQuestions(prev => prev.map(q => q.id === id ? { ...q, question: trimmed } : q));
    setExpandedQuestionId(null);
  };

  const cancelEdit = () => {
    setExpandedQuestionId(null);
    setEditText('');
  };

  const handleSaveLinkedin = async () => {
    if (!candidateId) { console.warn('No candidate_id found'); return; }
    try {
      await apiService.saveLinkedin(candidateId, linkedinProfile.trim());
      openModal('LinkedIn profile saved successfully.');
    } catch (e) {
      console.error('Failed to save LinkedIn profile', e);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Success Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeModal}></div>
          <div className="relative bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-sm mx-4 p-6">
            <div className="text-center">
              <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" className="text-green-600"><path fill="currentColor" d="M9 16.2l-3.5-3.5 1.4-1.4L9 13.4l7.1-7.1 1.4 1.4z"/></svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Success</h3>
              <p className="text-sm text-gray-600">{modal.message}</p>
            </div>
            <div className="mt-6 flex justify-center">
              <Button onClick={closeModal} className="px-6">OK</Button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal (PDF/Images) */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={closePreview}></div>
          <div className="relative bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-5xl h-[80vh] mx-4">
            <div className="flex items-center justify-between p-3 border-b">
              <div className="text-sm text-gray-700 truncate pr-2">{previewUrl}</div>
              <Button className="px-3 py-1" onClick={closePreview}>Close</Button>
            </div>
            <div className="w-full h-[calc(80vh-48px)]">
              <iframe title="Preview" src={previewUrl} className="w-full h-full" />
            </div>
          </div>
        </div>
      )}
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Recruiter Dashboard</h1>
          <p className="text-gray-600">Manage job descriptions, questions, and interview settings</p>
        </div>
        <div>
          <Button
            className="px-6 py-2"
            onClick={async () => {
              if (!resumeId) { openModal('Please upload a resume first to get resume_id.'); return; }
              try {
                const data = await apiService.getRecruiterByResumeId(resumeId);
                // Print the full JSON bundle
                console.log('Recruiter Bundle JSON:', JSON.stringify(data, null, 2));
                // Stash ids and parsed texts in sessionStorage for Preparing/Active pages
                try {
                  if (data?.resume?.resume_id) sessionStorage.setItem('rb_resume_id', String(data.resume.resume_id));
                  if (data?.recruiter?.jd_id) sessionStorage.setItem('rb_jd_id', String(data.recruiter.jd_id));
                  if (data?.parsed?.resume_txt) sessionStorage.setItem('rb_resume_txt', data.parsed.resume_txt);
                  if (data?.parsed?.jd_txt) sessionStorage.setItem('rb_jd_txt', data.parsed.jd_txt);
                  if (data?.parsed?.questions) sessionStorage.setItem('rb_questions_dict', JSON.stringify(data.parsed.questions));
                } catch {}
                openModal('', () => {
                  try {
                    navigate('/webRTC');
                  } catch {
                    window.location.href = 'http://localhost:5173/interview/idle?type=technical';
                  }
                });
              } catch (e) {
                console.error('Failed to fetch recruiter by resume_id', e);
              }
            }}
          >
            Get Link
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        <SegmentedTabs value={activeTab} onChange={setActiveTab} />

        {activeTab === 'jobs' && (
          <Card>
            <CardHeader>
              <CardTitle>Create New Job Description</CardTitle>
              <CardDescription>Add a new job posting with detailed requirements</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label htmlFor="job-title" className="block text-sm font-medium text-gray-700 mb-2">Job Title</label>
                <input 
                  id="job-title" 
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors" 
                  placeholder="e.g., Senior Frontend Developer" 
                  value={jobTitle} 
                  onChange={(e) => setJobTitle(e.target.value)} 
                />
              </div>
              
              <div>
                <label htmlFor="job-description" className="block text-sm font-medium text-gray-700 mb-2">Job Description</label>
                <textarea 
                  id="job-description" 
                  className="w-full min-h-48 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors resize-none" 
                  placeholder="Describe the role, responsibilities, requirements, and what makes this opportunity unique..." 
                  value={jobDescription} 
                  onChange={(e) => setJobDescription(e.target.value)} 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Additional Documents</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-gray-400 transition-colors">
                  <div className="flex flex-col items-center text-center text-gray-600">
                    <Upload className="w-10 h-10 mb-3 text-gray-500" />
                    {/* <div className="text-base font-medium mb-1">Upload Job-related Files</div>
                    <div className="text-sm text-gray-500 mb-4">Upload additional job requirements, team info, or company documents</div> */}
                    <div className="w-full max-w-md">
                      <FileUpload
                        accept=".pdf,.doc,.docx,.txt"
                        multiple
                        onFilesSelected={async (files) => {
                          if (!resumeId) {
                            openModal('Please upload a resume first to generate resume_id.');
                            return;
                          }
                          const list = Array.from(files as unknown as FileList);
                          const uploaded: Array<{ file_id: number; storage_path: string }> = [];
                          for (const f of list) {
                            try {
                              const res = await apiService.createRecruiter({
                                resumeId,
                                jdTitle: '',
                                jdDescription: '',
                                jdFile: f,
                                questionsJson: null,
                                linkedinUrl: null,
                              });
                              if (res.jd_file_path) {
                                uploaded.push({ file_id: res.jd_id, storage_path: res.jd_file_path });
                              }
                            } catch (e) {
                              console.error('JD upload failed', e);
                            }
                          }
                          if (uploaded.length) {
                            setJdUploads(prev => [...uploaded, ...prev]);
                            setPreviewUrl(uploaded[0].storage_path);
                            openModal('JD uploaded');
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
                {jdUploads.length > 0 && (
                  <div className="mt-3">
                    <div className="text-sm text-gray-700 mb-2">Uploaded JD Files</div>
                    <ul className="space-y-2">
                      {jdUploads.map(item => {
                        const name = item.storage_path.split('/').pop() || item.storage_path;
                        const lower = name.toLowerCase();
                        const isInline = lower.endsWith('.pdf') || lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.gif') || lower.endsWith('.webp');
                        return (
                          <li key={item.file_id} className="text-sm">
                            <div className="flex items-center gap-3">
                              <a href={item.storage_path} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                                {name}
                              </a>
                              {isInline ? (
                                <button
                                  className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-50"
                                  onClick={() => setPreviewUrl(item.storage_path)}
                                >
                                  Preview
                                </button>
                              ) : (
                                <button
                                  className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-50"
                                  onClick={() => {
                                    const gdoc = `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(item.storage_path)}`;
                                    window.open(gdoc, '_blank');
                                  }}
                                >
                                  Open Viewer
                                </button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end">
                <Button onClick={handleSaveJob} className="px-8 py-3 text-base font-medium">Save Job Description</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'questions' && (
          <Card>
            <CardHeader>
              <CardTitle>Interview Questions</CardTitle>
              <CardDescription>Create custom interview questions and manage your question bank</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Toggle buttons */}
              <div className="flex gap-3">
                <button
                  className={`flex-1 px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${questionMode==='add' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                  onClick={() => setQuestionMode('add')}
                >
                  Add Question
                </button>
                <button
                  className={`flex-1 px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${questionMode==='upload' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                  onClick={() => setQuestionMode('upload')}
                >
                  Upload Files
                </button>
              </div>

              {questionMode === 'add' && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="custom-question" className="block text-sm font-medium text-gray-700 mb-2">Question</label>
                    <textarea 
                      id="custom-question" 
                      className="w-full min-h-24 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors resize-none" 
                      placeholder="Enter your custom interview question..." 
                      value={customQuestion} 
                      onChange={(e) => setCustomQuestion(e.target.value)} 
                    />
                  </div>
                  <div className="flex justify-end">
                    <div className="flex gap-2">
                      <Button onClick={handleSaveQuestion} data-testid="button-save-question" className="px-6 py-2">
                        <Plus className="w-4 h-4 mr-2" /> Add Question
                      </Button>
                      <Button
                        onClick={async () => {
                          if (!resumeId) {
                            openModal('Please upload a resume first to generate resume_id.');
                            return;
                          }
                          try {
                            await apiService.createRecruiter({
                              resumeId,
                              jdTitle: '',
                              jdDescription: '',
                              questionsJson: customQuestions,
                              linkedinUrl: null,
                            });
                            openModal('Questions appended ');
                          } catch (e) {
                            console.error('Failed to append questions to recruiter', e);
                          }
                        }}
                        className="px-6 py-2"
                      >
                        Submit
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {questionMode === 'upload' && (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 hover:border-gray-400 transition-colors">
                  <div className="flex flex-col items-center text-center text-gray-600">
                    <Upload className="w-12 h-12 mb-4 text-gray-500" />
                    <FileUpload
                      accept=".pdf,.doc,.docx,.txt,.csv"
                      multiple
                      onFilesSelected={async (files) => {
                        if (!candidateId) { console.warn('No candidate_id found'); return; }
                        const uploaded: Array<{ file_id: number; storage_path: string }> = [];
                        for (const f of files) {
                          try {
                            const res = await apiService.uploadFile(candidateId, 'question', f);
                            uploaded.push({ file_id: res.file_id, storage_path: res.storage_path });
                          } catch (e) {
                            console.error('Question file upload failed', e);
                          }
                        }
                        if (uploaded.length) setQuestionUploads(prev => [...uploaded, ...prev]);
                        openModal('Question file(s) uploaded successfully.');
                      }}
                    />
                  </div>
                </div>
              )}

              {questionUploads.length > 0 && (
                <div className="mt-3">
                  <div className="text-sm text-gray-700 mb-2">Uploaded Question Files</div>
                  <ul className="space-y-2">
                    {questionUploads.map(item => {
                      const name = item.storage_path.split('/').pop() || item.storage_path;
                      const lower = name.toLowerCase();
                      const isInline = lower.endsWith('.pdf') || lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.gif') || lower.endsWith('.webp');
                      return (
                        <li key={item.file_id} className="text-sm">
                          <div className="flex items-center gap-3">
                            <a href={item.storage_path} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                              {name}
                            </a>
                            {isInline ? (
                              <button
                                className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-50"
                                onClick={() => setPreviewUrl(item.storage_path)}
                              >
                                Preview
                              </button>
                            ) : (
                              <button
                                className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-50"
                                onClick={() => {
                                  const gdoc = `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(item.storage_path)}`;
                                  window.open(gdoc, '_blank');
                                }}
                              >
                                Open Viewer
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Custom Questions list */}
              {customQuestions.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">Custom Questions</h3>
                    <span className="text-sm text-gray-500">{customQuestions.length} questions</span>
                  </div>
                  <div className="space-y-3">
                    {customQuestions.map((q) => (
                      <div key={q.id} className="border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
                        <button
                          className="w-full text-left px-4 py-4 hover:bg-gray-50 flex items-start justify-between gap-3 rounded-lg"
                          onClick={() => toggleExpand(q.id, q.question)}
                          aria-expanded={expandedQuestionId === q.id}
                        >
                          <span className="text-sm text-gray-900 flex-1 leading-relaxed">{q.question}</span>
                          <svg width="16" height="16" viewBox="0 0 24 24" className={`mt-1 text-gray-500 transition-transform flex-shrink-0 ${expandedQuestionId===q.id ? 'rotate-180' : ''}`}><path fill="currentColor" d="M7 10l5 5 5-5z"/></svg>
                        </button>
                        {expandedQuestionId === q.id && (
                          <div className="border-t border-gray-200 px-4 py-4 bg-gray-50">
                            <label htmlFor={`edit-${q.id}`} className="block text-xs font-medium text-gray-600 mb-2">Edit question</label>
                            <textarea
                              id={`edit-${q.id}`}
                              className="w-full min-h-24 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors resize-none"
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                            />
                            <div className="mt-3 flex items-center gap-2">
                              <Button onClick={() => saveEdit(q.id)} className="px-4 py-2">Save</Button>
                              <button onClick={cancelEdit} className="px-4 py-2 border border-gray-300 rounded-md text-gray-800 hover:bg-gray-50 transition-colors">Cancel</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'prompts' && (
          <Card>
            <CardHeader>
              <CardTitle>Custom Interview Prompts</CardTitle>
              <CardDescription>Configure custom prompts and instructions for the interview process</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label htmlFor="custom-prompt" className="block text-sm font-medium text-gray-700 mb-2">Custom Prompt</label>
                <textarea 
                  id="custom-prompt" 
                  className="w-full min-h-48 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors resize-none" 
                  placeholder="Enter custom instructions for the interview process. For example: 'Please focus on technical skills and ask follow-up questions about specific technologies mentioned.'" 
                  value={customPrompt} 
                  onChange={(e) => setCustomPrompt(e.target.value)} 
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSavePrompt} className="px-8 py-3 text-base font-medium">Save Custom Prompt</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'candidates' && (
          <Card>
            <CardHeader>
              <CardTitle>Candidate Information</CardTitle>
              <CardDescription>Upload resume or add LinkedIn profile for candidate evaluation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Toggle buttons */}
              <div className="flex gap-3">
                <button
                  className={`flex-1 px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${candidateMode==='resume' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                  onClick={() => setCandidateMode('resume')}
                >
                  Resume Upload
                </button>
                <button
                  className={`flex-1 px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${candidateMode==='linkedin' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                  onClick={() => setCandidateMode('linkedin')}
                >
                  LinkedIn Profile
                </button>
              </div>

              {candidateMode === 'resume' && (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 hover:border-gray-400 transition-colors">
                  <div className="flex flex-col items-center text-center text-gray-600">
                    <Upload className="w-12 h-12 mb-4 text-gray-500" />
                    <FileUpload
                      accept=".pdf,.doc,.docx,.txt"
                      multiple
                      onFilesSelected={async (files) => {
                        // Only take first resume for linking; get resume_id from backend
                        try {
                          const first = files[0];
                          if (!first) return;
                          const res = await apiService.uploadResume(first);
                          setResumeId(res.resume_id);
                          setResumeUploads(prev => [{ file_id: res.resume_id, storage_path: res.resume_path }, ...prev]);
                          openModal('Resume uploaded.');
                        } catch (e) {
                          console.error('Resume upload failed', e);
                        }
                      }}
                    />
                  </div>
                </div>
              )}

              {resumeUploads.length > 0 && (
                <div className="mt-3">
                  <div className="text-sm text-gray-700 mb-2">Uploaded Resume Files</div>
                  <ul className="space-y-2">
                    {resumeUploads.map(item => {
                      const name = item.storage_path.split('/').pop() || item.storage_path;
                      const lower = name.toLowerCase();
                      const isInline = lower.endsWith('.pdf') || lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.gif') || lower.endsWith('.webp');
                      return (
                        <li key={item.file_id} className="text-sm">
                          <div className="flex items-center gap-3">
                            <a href={item.storage_path} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                              {name}
                            </a>
                            {isInline ? (
                              <button
                                className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-50"
                                onClick={() => setPreviewUrl(item.storage_path)}
                              >
                                Preview
                              </button>
                            ) : (
                              <button
                                className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-50"
                                onClick={() => {
                                  const gdoc = `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(item.storage_path)}`;
                                  window.open(gdoc, '_blank');
                                }}
                              >
                                Open Viewer
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {candidateMode === 'linkedin' && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="linkedin-profile" className="block text-sm font-medium text-gray-700 mb-2">LinkedIn Profile URL</label>
                    <input 
                      id="linkedin-profile" 
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors" 
                      placeholder="https://linkedin.com/in/candidate-profile" 
                      value={linkedinProfile} 
                      onChange={(e) => setLinkedinProfile(e.target.value)} 
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={handleSaveLinkedin} className="px-6 py-2">Save LinkedIn Profile</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}


