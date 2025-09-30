import React, { useState } from 'react';
import { 
  Edit3, 
  Save, 
  Trash2, 
  CheckCircle,
  Mic,
  ChevronDown,
  Plus
} from 'lucide-react';

interface PreScreenQuestion {
  id: number;
  question: string;
  answerType?: 'yes_no' | 'single' | 'text';
  options?: string[];
  estimatedTime: number; // in minutes
  expectedAnswer: string;
}

const PreScreenRecruiterPage: React.FC = () => {
  const [questions, setQuestions] = useState<PreScreenQuestion[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<PreScreenQuestion | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [enableResumeTrivia, setEnableResumeTrivia] = useState<boolean>(false);
  const [enableJdTrivia, setEnableJdTrivia] = useState<boolean>(false);
  const [openDefaultSection, setOpenDefaultSection] = useState<boolean>(true);
  const [openResumeSection, setOpenResumeSection] = useState<boolean>(true);
  const [openJdSection, setOpenJdSection] = useState<boolean>(true);
  const [basicResponses, setBasicResponses] = useState<Record<number, string>>({});
  const [showNewForm, setShowNewForm] = useState<boolean>(false);
  const [newPrompt, setNewPrompt] = useState<string>('');

  // Sample pre-screen questions (HR-focused) for demonstration
  const sampleQuestions: PreScreenQuestion[] = [
    {
      id: 1,
      question: "What is your expected CTC (total annual compensation)?",
      answerType: 'text',
      estimatedTime: 2,
      expectedAnswer: "A clear range or figure (e.g., 16–20 LPA) with flexibility notes if any."
    },
    {
      id: 2,
      question: "What is your preferred work location?",
      answerType: 'text',
      estimatedTime: 2,
      expectedAnswer: "Specific city/region preference; mention multiple acceptable locations if applicable."
    },
    {
      id: 3,
      question: "What work mode do you prefer (Remote / Hybrid / WFO)?",
      answerType: 'single',
      options: ['Remote','Hybrid','WFO'],
      estimatedTime: 2,
      expectedAnswer: "One of Remote/Hybrid/WFO; if Hybrid/WFO, include onsite days or commute constraints."
    },
    {
      id: 4,
      question: "Are you open to relocation if required?",
      answerType: 'yes_no',
      estimatedTime: 2,
      expectedAnswer: "Yes/No; if yes, specify cities; if no, provide constraints or required support."
    },
    {
      id: 5,
      question: "What is your notice period and earliest joining date?",
      answerType: 'text',
      estimatedTime: 2,
      expectedAnswer: "Exact notice period (e.g., 30/60/90 days) and any buyout/negotiation possibilities."
    }
  ];

  // Resume-based pre-screen questions (shown only when enabled)
  const resumeSamples: PreScreenQuestion[] = [
    {
      id: 101,
      question: "You mentioned leading Project X. What business KPI improved and by how much?",
      estimatedTime: 3,
      expectedAnswer: "Concrete impact with metrics (e.g., +18% conversion, -25% latency)."
    },
    {
      id: 102,
      question: "4+ years of React: share a perf issue you solved and how you measured it.",
      estimatedTime: 3,
      expectedAnswer: "Profiling steps, hooks/memoization, before/after metrics."
    },
    {
      id: 103,
      question: "Scaled APIs to high traffic: what was the bottleneck and the fix?",
      estimatedTime: 3,
      expectedAnswer: "Bottleneck identification, mitigation (caching, queues), and monitoring."
    }
  ];

  // JD-based pre-screen questions (only when enabled) – no expected answer shown
  const jdSamples: PreScreenQuestion[] = [
    {
      id: 201,
      question: "This role needs 3+ yrs React. Tell us about your largest React app and your role.",
      estimatedTime: 3,
      expectedAnswer: ""
    },
    {
      id: 202,
      question: "JD mentions REST + GraphQL. Which have you used more and why?",
      estimatedTime: 3,
      expectedAnswer: ""
    },
    {
      id: 203,
      question: "We require CI/CD. Describe a pipeline you've set up or maintained.",
      estimatedTime: 3,
      expectedAnswer: ""
    },
    {
      id: 204,
      question: "Role expects ownership. Share a project you led end‑to‑end.",
      estimatedTime: 3,
      expectedAnswer: ""
    },
    {
      id: 205,
      question: "Comfortable with on-call or production support? Describe an incident you resolved.",
      estimatedTime: 3,
      expectedAnswer: ""
    }
  ];

  const generateQuestions = async () => {
    setIsGenerating(true);
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    let combined = sampleQuestions.map(q => ({ ...q }));
    if (enableResumeTrivia) combined = [...combined, ...resumeSamples.map(q => ({ ...q }))];
    if (enableJdTrivia) combined = [...combined, ...jdSamples.map(q => ({ ...q }))];
    setQuestions(combined);
    setIsGenerating(false);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const startEditing = (question: PreScreenQuestion) => {
    setEditingQuestion({ ...question });
  };

  const saveQuestion = () => {
    if (!editingQuestion) return;
    
    setQuestions(prev => 
      prev.map(q => q.id === editingQuestion.id ? editingQuestion : q)
    );
    setEditingQuestion(null);
  };

  const deleteQuestion = (id: number) => {
    setQuestions(prev => prev.filter(q => q.id !== id));
  };

  // Reserved for future manual add; removed from UI to keep flow simple

  // Removed type pill; keeping category badge only

  const addNewQuestion = () => {
    const prompt = newPrompt.trim();
    if (!prompt) return;
    const newQuestion: PreScreenQuestion = {
      id: Date.now(),
      question: prompt,
      answerType: 'text',
      estimatedTime: 2,
      expectedAnswer: ''
    };
    setQuestions(prev => [newQuestion, ...prev]);
    setEditingQuestion(newQuestion);
    setShowNewForm(false);
    setNewPrompt('');
  };
  
  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pre-Screen Questions</h1>
            <p className="text-gray-600">Configure pre-screen interview questions for candidates.</p>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={generateQuestions}
              disabled={isGenerating}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
                isGenerating 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Mic size={16} />
                  <span>Generate Questions</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Config Panel (match technical page style) */}
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="w-full bg-white border border-blue-100 rounded-lg p-3">
              <div className="flex items-center">
                <input
                  id="enable-resume-trivia"
                  type="checkbox"
                  checked={enableResumeTrivia}
                  onChange={(e) => setEnableResumeTrivia(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-blue-300 rounded"
                />
                <label htmlFor="enable-resume-trivia" className="ml-2 text-sm font-medium text-blue-900">
                  Enable resume-based questions
                </label>
                <span className="ml-3 text-[11px] text-blue-800">
                  Tailor questions based on the candidate's resume highlights.
                </span>
              </div>
            </div>
            <div className="w-full bg-white border border-blue-100 rounded-lg p-3">
              <div className="flex items-center">
                <input
                  id="enable-jd-trivia"
                  type="checkbox"
                  checked={enableJdTrivia}
                  onChange={(e) => setEnableJdTrivia(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-blue-300 rounded"
                />
                <label htmlFor="enable-jd-trivia" className="ml-2 text-sm font-medium text-blue-900">
                  Enable JD-based questions
                </label>
                <span className="ml-3 text-[11px] text-blue-800">
                  Align questions to the specific job description requirements.
                </span>
              </div>
            </div>
          </div>
        </div>

        {showSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-800 flex items-center space-x-2">
            <CheckCircle size={16} />
            <span>Questions generated successfully!</span>
          </div>
        )}
      </div>

      {/* Questions List */}
      {questions.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {/* Default section */}
          <button
            onClick={() => setOpenDefaultSection(v => !v)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 border-b border-gray-200"
          >
            <span className="text-lg font-semibold text-gray-900">Questions</span>
            <ChevronDown size={18} className={`transition-transform ${openDefaultSection ? 'rotate-180' : ''}`} />
          </button>
          {openDefaultSection && (
            <div className="divide-y divide-gray-200">
              <div className="px-6 py-3 flex items-center justify-end">
                <button
                  onClick={() => setShowNewForm(v => !v)}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
                >
                  <Plus size={16} />
                  <span>{showNewForm ? 'Close' : 'Add Question'}</span>
                </button>
              </div>
              {showNewForm && (
                <div className="px-6 py-4 bg-blue-50/40">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Enter a prompt for question</label>
                      <textarea
                        value={newPrompt}
                        onChange={(e) => setNewPrompt(e.target.value)}
                        className="w-full h-24 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                        placeholder="e.g., What is your preferred work location?"
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center space-x-2">
                    <button
                      onClick={addNewQuestion}
                      disabled={!newPrompt.trim()}
                      className={`px-4 py-2 rounded-lg font-medium text-white ${!newPrompt.trim() ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                      Save Question
                    </button>
                    <button
                      onClick={() => { setShowNewForm(false); setNewPrompt(''); }}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {questions
                .filter((q) => q.id < 100)
                .map((question) => (
                  <div key={question.id} className="p-6">
                    {editingQuestion?.id === question.id ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Question</label>
                            <textarea
                              value={editingQuestion.question}
                              onChange={(e) => setEditingQuestion(prev => prev ? { ...prev, question: e.target.value } : null)}
                              className="w-full h-24 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                              placeholder="Enter your question..."
                            />
                          </div>
                          <div className="space-y-3"></div>
                        </div>
                        {/* Keep editor minimal for now; expectedAnswer not used for choice rendering */}
                        <div className="flex space-x-3">
                          <button
                            onClick={saveQuestion}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
                          >
                            <Save size={16} />
                            <span>Save Changes</span>
                          </button>
                          <button
                            onClick={() => setEditingQuestion(null)}
                            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-gray-900 font-medium mb-2">{question.question}</p>
                            <div className="mt-2">
                              <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Expected answer</div>
                              {question.answerType === 'yes_no' && (
                                <div className="flex items-center gap-6">
                                  <label className="inline-flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="radio"
                                      name={`q-${question.id}`}
                                      value="Yes"
                                      checked={basicResponses[question.id] === 'Yes'}
                                      onChange={() => setBasicResponses(prev => ({ ...prev, [question.id]: 'Yes' }))}
                                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                    />
                                    <span className="text-sm text-gray-800">Yes</span>
                                  </label>
                                  <label className="inline-flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="radio"
                                      name={`q-${question.id}`}
                                      value="No"
                                      checked={basicResponses[question.id] === 'No'}
                                      onChange={() => setBasicResponses(prev => ({ ...prev, [question.id]: 'No' }))}
                                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                    />
                                    <span className="text-sm text-gray-800">No</span>
                                  </label>
                                </div>
                              )}
                              {question.answerType === 'single' && (
                                <div className="flex items-center gap-6 flex-wrap">
                                  {(question.options || []).map(opt => (
                                    <label key={opt} className="inline-flex items-center gap-2 cursor-pointer">
                                      <input
                                        type="radio"
                                        name={`q-${question.id}`}
                                        value={opt}
                                        checked={basicResponses[question.id] === opt}
                                        onChange={() => setBasicResponses(prev => ({ ...prev, [question.id]: opt }))}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                      />
                                      <span className="text-sm text-gray-800">{opt}</span>
                                    </label>
                                  ))}
                                </div>
                              )}
                              {question.answerType === 'text' && (
                                <input
                                  type="text"
                                  value={basicResponses[question.id] || ''}
                                  onChange={(e) => setBasicResponses(prev => ({ ...prev, [question.id]: e.target.value }))}
                                  placeholder="Type expected answer"
                                  className="w-full max-w-md p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 ml-4">
                            <button
                              onClick={() => startEditing(question)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit question"
                            >
                              <Edit3 size={16} />
                            </button>
                            <button
                              onClick={() => deleteQuestion(question.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete question"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}

          {/* Resume section (only if present) */}
          {questions.some(q => q.id >= 100) && (
            <>
              <div className="h-px bg-gray-200" />
              <button
                onClick={() => setOpenResumeSection(v => !v)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 border-b border-gray-200"
              >
                <span className="text-lg font-semibold text-gray-900">Resume Trivia</span>
                <ChevronDown size={18} className={`transition-transform ${openResumeSection ? 'rotate-180' : ''}`} />
              </button>
              {openResumeSection && (
                <div className="divide-y divide-gray-200">
                  <div className="px-6 py-3 flex items-center justify-end">
                    <button
                      onClick={() => {
                        const newQuestion: PreScreenQuestion = {
                          id: 100 + Date.now(),
                          question: 'New resume trivia question...',
                          estimatedTime: 2,
                          expectedAnswer: ''
                        };
                        setQuestions(prev => [...prev, newQuestion]);
                        setEditingQuestion(newQuestion);
                      }}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
                    >
                      <Plus size={16} />
                      <span>Add Question</span>
                    </button>
                  </div>
                  {questions
                    .filter((q) => q.id >= 100)
                    .map((question) => (
                      <div key={question.id} className="p-6">
                        {editingQuestion?.id === question.id ? (
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Question</label>
                              <textarea
                                value={editingQuestion.question}
                                onChange={(e) => setEditingQuestion(prev => prev ? { ...prev, question: e.target.value } : null)}
                                className="w-full h-24 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                                placeholder="Enter your question..."
                              />
                            </div>
                            <div className="flex space-x-3">
                              <button
                                onClick={saveQuestion}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
                              >
                                <Save size={16} />
                                <span>Save Changes</span>
                              </button>
                              <button
                                onClick={() => setEditingQuestion(null)}
                                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-gray-900 font-medium">{question.question}</p>
                            </div>
                            <div className="flex items-center space-x-2 ml-4">
                              <button
                                onClick={() => startEditing(question)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit question"
                              >
                                <Edit3 size={16} />
                              </button>
                              <button
                                onClick={() => deleteQuestion(question.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete question"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </>
          )}

          {/* JD section (only if present) */}
          {questions.some(q => q.id >= 200 && q.id < 300) && (
            <>
              <div className="h-px bg-gray-200" />
              <button
                onClick={() => setOpenJdSection(v => !v)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 border-b border-gray-200"
              >
                <span className="text-lg font-semibold text-gray-900">JD Trivia</span>
                <ChevronDown size={18} className={`transition-transform ${openJdSection ? 'rotate-180' : ''}`} />
              </button>
              {openJdSection && (
                <div className="divide-y divide-gray-200">
                  <div className="px-6 py-3 flex items-center justify-end">
                    <button
                      onClick={() => {
                        const newQuestion: PreScreenQuestion = {
                          id: 200 + Date.now(),
                          question: 'New JD trivia question...',
                          estimatedTime: 2,
                          expectedAnswer: ''
                        };
                        setQuestions(prev => [...prev, newQuestion]);
                        setEditingQuestion(newQuestion);
                      }}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
                    >
                      <Plus size={16} />
                      <span>Add Question</span>
                    </button>
                  </div>
                  {questions
                    .filter((q) => q.id >= 200 && q.id < 300)
                    .map((question) => (
                      <div key={question.id} className="p-6">
                        {editingQuestion?.id === question.id ? (
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Question</label>
                              <textarea
                                value={editingQuestion.question}
                                onChange={(e) => setEditingQuestion(prev => prev ? { ...prev, question: e.target.value } : null)}
                                className="w-full h-24 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                                placeholder="Enter your question..."
                              />
                            </div>
                            <div className="flex space-x-3">
                              <button
                                onClick={saveQuestion}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
                              >
                                <Save size={16} />
                                <span>Save Changes</span>
                              </button>
                              <button
                                onClick={() => setEditingQuestion(null)}
                                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-gray-900 font-medium">{question.question}</p>
                            </div>
                            <div className="flex items-center space-x-2 ml-4">
                              <button
                                onClick={() => startEditing(question)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit question"
                              >
                                <Edit3 size={16} />
                              </button>
                              <button
                                onClick={() => deleteQuestion(question.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete question"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Empty State */}
      {questions.length === 0 && !isGenerating && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mic size={32} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No pre-screen questions yet</h3>
          <p className="text-gray-600 mb-6">
            Click "Generate Questions" to create a set of pre-screen interview questions for candidates.
          </p>
          <button
            onClick={generateQuestions}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center space-x-2 mx-auto"
          >
            <Mic size={16} />
            <span>Generate Questions</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default PreScreenRecruiterPage;
