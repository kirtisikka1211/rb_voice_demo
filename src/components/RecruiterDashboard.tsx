import React, { useState } from 'react';
import { Plus, FileText, MessageSquare, Settings, Upload } from 'lucide-react';
import FileUpload from './FileUpload';

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
      <button className={`${base} ${value==='jobs'?selected:unselected}`} onClick={() => onChange('jobs')}>
        <FileText className="w-4 h-4" /> Job Descriptions
      </button>
      <button className={`${base} ${value==='questions'?selected:unselected}`} onClick={() => onChange('questions')}>
        <MessageSquare className="w-4 h-4" /> Questions
      </button>
      <button className={`${base} ${value==='prompts'?selected:unselected}`} onClick={() => onChange('prompts')}>
        <Settings className="w-4 h-4" /> Custom Prompts
      </button>
      <button className={`${base} ${value==='candidates'?selected:unselected}`} onClick={() => onChange('candidates')}>
        <FileText className="w-4 h-4" /> Candidate Info
      </button>
    </div>
  );
}

export default function RecruiterDashboard() {
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

  const handleSaveJob = () => { console.log('Saving job:', { jobTitle, jobDescription }); };
  const handleSavePrompt = () => { console.log('Saving custom prompt:', customPrompt); };
  const handleSaveQuestion = () => {
    const text = customQuestion.trim();
    if (!text) return;
    const newItem = { id: Date.now(), question: text, category: 'Custom', type: 'Open-ended' } as const;
    setCustomQuestions(prev => [ { id: newItem.id, question: newItem.question }, ...prev ]);
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

  const handleSaveLinkedin = () => {
    console.log('Saving LinkedIn profile:', linkedinProfile);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Recruiter Dashboard</h1>
        <p className="text-gray-600">Manage job descriptions, questions, and interview settings</p>
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
                      <FileUpload accept=".pdf,.doc,.docx,.txt" multiple onFilesSelected={(files) => console.log('Job files uploaded:', files)} />
                    </div>
                  </div>
                </div>
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
                    <Button onClick={handleSaveQuestion} data-testid="button-save-question" className="px-6 py-2">
                      <Plus className="w-4 h-4 mr-2" /> Add Question
                    </Button>
                  </div>
                </div>
              )}

              {questionMode === 'upload' && (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 hover:border-gray-400 transition-colors">
                  <div className="flex flex-col items-center text-center text-gray-600">
                    <Upload className="w-12 h-12 mb-4 text-gray-500" />
                    {/* <div className="text-lg font-medium mb-2">Upload Question Files</div>
                    <div className="text-sm text-gray-500 mb-4">Upload documents containing interview questions</div> */}
                    <FileUpload accept=".pdf,.doc,.docx,.txt,.csv" multiple onFilesSelected={(files) => console.log('Question files uploaded:', files)} />
                  </div>
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
                    {/* <div className="text-lg font-medium mb-2">Upload Resume</div>
                    <div className="text-sm text-gray-500 mb-4">Upload candidate's resume for evaluation and analysis</div> */}
                    <FileUpload accept=".pdf,.doc,.docx,.txt" multiple onFilesSelected={(files) => console.log('Resume uploaded:', files)} />
                  </div>
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


