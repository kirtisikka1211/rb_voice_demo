import React, { useState } from 'react';
import apiService from '../services/api';
import { 
  Plus, 
  Edit3, 
  Save, 
  Trash2, 
  FileText,
  Bot,
  Sliders,
  Layers,
  Upload,
  ChevronDown
} from 'lucide-react';

interface TechnicalQuestion {
  id: number;
  question: string;
  category: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  estimatedTime: number; // in minutes
  isFollowUp?: boolean;
}

type SkillLevelCounts = { Beginner: number; Intermediate: number; Advanced: number };

const RecruiterPage: React.FC = () => {
  const [questions, setQuestions] = useState<TechnicalQuestion[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<TechnicalQuestion | null>(null);
  const [showNewForm, setShowNewForm] = useState<boolean>(false);
  const [newPrompt, setNewPrompt] = useState<string>('');
  const [newDifficulty, setNewDifficulty] = useState<'Beginner' | 'Intermediate' | 'Advanced'>('Intermediate');
  const difficultyToIndex = (d: 'Beginner' | 'Intermediate' | 'Advanced') => d === 'Beginner' ? 0 : d === 'Intermediate' ? 1 : 2;
  const indexToDifficulty = (i: number): 'Beginner' | 'Intermediate' | 'Advanced' => (i <= 0 ? 'Beginner' : i === 1 ? 'Intermediate' : 'Advanced');

  // Configuration state
  const availableSkills = ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Express', 'SQL', 'NoSQL', 'System Design'];
  const [selectedSkills, setSelectedSkills] = useState<Record<string, SkillLevelCounts>>({});
  const [enableFollowUps, setEnableFollowUps] = useState<boolean>(false);

  // Upload dropdown state
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jdFile, setJdFile] = useState<File | null>(null);

  const resumeInputRef = React.useRef<HTMLInputElement | null>(null);
  const jdInputRef = React.useRef<HTMLInputElement | null>(null);

  const openResumePicker = () => resumeInputRef.current?.click();
  const openJdPicker = () => jdInputRef.current?.click();

  const onResumeSelected: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0] || null;
    setResumeFile(file);
    setIsUploadOpen(false);
    if (file) {
      void uploadSelectedFile('resume', file);
    }
  };

  const onJdSelected: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0] || null;
    setJdFile(file);
    setIsUploadOpen(false);
    if (file) {
      void uploadSelectedFile('jd', file);
    }
  };

  const uploadSelectedFile = async (fileType: 'resume' | 'jd', file: File) => {
    try {
      const idStr = (() => { try { return localStorage.getItem('candidate_id'); } catch { return null; } })();
      const candidateId = idStr ? parseInt(idStr, 10) : NaN;
      if (!candidateId || Number.isNaN(candidateId)) {
        console.warn('Missing candidate_id in localStorage; cannot upload');
        return;
      }
      await apiService.uploadFile(candidateId, fileType, file);
    } catch (err) {
      console.error('Upload failed', err);
    }
  };

  // Sample technical questions for demonstration / fallback
  const sampleQuestions: TechnicalQuestion[] = [
    {
      id: 1,
      question: "Explain the difference between synchronous and asynchronous code in JavaScript and when you'd use each.",
      category: "JavaScript",
      difficulty: "Intermediate",
      estimatedTime: 5
    },
    {
      id: 2,
      question: "What is a closure in JavaScript? Provide a practical use case.",
      category: "JavaScript",
      difficulty: "Intermediate",
      estimatedTime: 4
    },
    {
      id: 3,
      question: "How would you optimize a React application that re-renders too frequently?",
      category: "React",
      difficulty: "Advanced",
      estimatedTime: 6
    },
    {
      id: 4,
      question: "Describe how you would design a REST API for a todo app. Include key endpoints and status codes.",
      category: "Backend",
      difficulty: "Intermediate",
      estimatedTime: 5
    },
    {
      id: 5,
      question: "You're given a slow SQL query. What steps would you take to diagnose and improve its performance?",
      category: "Database",
      difficulty: "Advanced",
      estimatedTime: 7
    }
  ];

  const toggleSkill = (skill: string) => {
    setSelectedSkills(prev => {
      const copy = { ...prev };
      if (copy[skill]) {
        delete copy[skill];
      } else {
        copy[skill] = { Beginner: 1, Intermediate: 2, Advanced: 1 };
      }
      return copy;
    });
  };

  // Reserved for future per-skill counts configuration

  const generateFromConfig = async () => {
    setIsGenerating(true);
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1200));

    const generated: TechnicalQuestion[] = [];
    const templates: Record<'Beginner' | 'Intermediate' | 'Advanced', string[]> = {
      Beginner: [
        'Define KEY in SKILL and give a simple example.',
        'What problem does SKILL solve? Provide a one-line explanation.',
        'Name two common use-cases for SKILL.'
      ],
      Intermediate: [
        'How would you debug ISSUE related to SKILL in a live app?',
        'Explain PATTERN in SKILL and when to apply it.',
        'Compare SKILL with ALTERNATIVE and discuss trade-offs.'
      ],
      Advanced: [
        'Design a scalable solution using SKILL for SCENARIO; detail components and failure handling.',
        'Optimize a bottleneck in SKILL-heavy service: outline profiling and improvements.',
        'Deep dive into internals of SKILL: how does FEATURE work under the hood?'
      ]
    };

    const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

    Object.entries(selectedSkills).forEach(([skill, counts]) => {
      (['Beginner', 'Intermediate', 'Advanced'] as const).forEach(level => {
        const n = counts[level];
        for (let i = 0; i < n; i++) {
          const questionText = pick(templates[level])
            .replace(/SKILL/g, skill)
            .replace('KEY', skill === 'React' ? 'component' : 'concept')
            .replace('ISSUE', 'a performance issue')
            .replace('PATTERN', 'a common pattern')
            .replace('ALTERNATIVE', 'an alternative')
            .replace('SCENARIO', 'high traffic and strict latency')
            .replace('FEATURE', 'its core feature');
          const base: TechnicalQuestion = {
            id: Date.now() + generated.length,
            question: questionText,
            category: skill,
            difficulty: level,
            estimatedTime: level === 'Beginner' ? 3 : level === 'Intermediate' ? 5 : 7
          };
          generated.push(base);
        }
      });
    });

    setQuestions(generated.length > 0 ? generated : sampleQuestions);
    setIsGenerating(false);
  };

  const generateQuestions = async () => {
    // If user configured skills, use that flow; otherwise fallback samples
    if (Object.keys(selectedSkills).length > 0) {
      return generateFromConfig();
    }
    setIsGenerating(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setQuestions(sampleQuestions);
    setIsGenerating(false);
  };

  const startEditing = (question: TechnicalQuestion) => {
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

  const addNewQuestion = () => {
    const prompt = newPrompt.trim();
    if (!prompt) return;
    const newQuestion: TechnicalQuestion = {
      id: Date.now(),
      question: prompt,
      category: 'General',
      difficulty: newDifficulty,
      estimatedTime: newDifficulty === 'Beginner' ? 3 : newDifficulty === 'Intermediate' ? 5 : 7
    };
    setQuestions(prev => [newQuestion, ...prev]);
    setEditingQuestion(newQuestion);
    setShowNewForm(false);
    setNewPrompt('');
    setNewDifficulty('Intermediate');
  };

  const getDifficultyColor = (difficulty: string) => {
    // Standardize to blue/white theme across difficulty levels
    switch (difficulty) {
      case 'Beginner': return 'bg-blue-50 text-blue-700 border border-blue-200';
      case 'Intermediate': return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'Advanced': return 'bg-blue-200 text-blue-900 border border-blue-300';
      default: return 'bg-blue-50 text-blue-700 border border-blue-200';
    }
  };

  const getCategoryColor = (category: string) => {
    // Keep categories within blue palette for consistency
    const blueVariants = [
      'bg-blue-50 text-blue-700 border border-blue-200',
      'bg-blue-100 text-blue-800 border border-blue-200',
      'bg-blue-200 text-blue-900 border border-blue-300',
      'bg-blue-50 text-blue-700 border border-blue-200',
      'bg-blue-100 text-blue-800 border border-blue-200'
    ];
    return blueVariants[Math.abs(category.length) % blueVariants.length];
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Layers size={18} className="text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Level 1 Questions</h1>
              <p className="text-gray-600">Configure assessment questions for candidates.</p>
            </div>
          </div>
        <div className="flex items-center space-x-2 relative">
            <button
              onClick={generateQuestions}
              disabled={isGenerating}
              className={`px-4 py-2 rounded-lg font-Intermediate transition-colors flex items-center space-x-2 ${
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
                  <Bot size={16} />
                  <span>Generate Questions</span>
                </>
              )}
            </button>
          <button
            onClick={() => setIsUploadOpen(v => !v)}
            className="px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 font-Intermediate transition-colors flex items-center space-x-2"
          >
            <Upload size={16} />
            <span>Upload</span>
            <ChevronDown size={16} />
          </button>
          {isUploadOpen && (
            <div className="absolute right-0 top-12 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
              <div className="p-3 border-b border-gray-100">
                <div className="text-sm font-semibold text-gray-900">Upload Files</div>
                <div className="text-xs text-gray-500">Supported: PDF, DOCX, TXT, CSV</div>
              </div>
              <div className="p-2">
                <button
                  onClick={openResumePicker}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-50 text-gray-800"
                >
                  Upload Resume
                </button>
                <button
                  onClick={openJdPicker}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-50 text-gray-800"
                >
                  Upload JD
                </button>
              </div>
            </div>
          )}
          {/* Hidden inputs for file selection */}
          <input
            ref={resumeInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt,.csv"
            className="hidden"
            onChange={onResumeSelected}
          />
          <input
            ref={jdInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt,.csv"
            className="hidden"
            onChange={onJdSelected}
          />
            {/* <button
              onClick={() => setShowNewForm(prev => !prev)}
              className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {showNewForm ? 'Close' : 'Add Question'}
            </button> */}
          </div>
        </div>

        {/* Config Panel */}
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
          <div className="flex items-center space-x-2 mb-3">
            <Sliders size={16} className="text-blue-700" />
            <h3 className="text-blue-900 font-semibold">Configuration</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Skill selector */}
            <div>
              <div className="text-sm font-Intermediate text-blue-900 mb-2"></div>
              <div className="flex flex-wrap gap-2">
                {availableSkills.map(skill => {
                  const active = !!selectedSkills[skill];
                  return (
                    <button
                      key={skill}
                      onClick={() => toggleSkill(skill)}
                      className={`px-3 py-1.5 rounded-full text-xs font-Intermediate border transition-colors ${
                        active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'
                      }`}
                    >
                      {skill}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Per-skill counts
            <div>
              <div className="text-sm font-Intermediate text-blue-900 mb-2">Per-skill question counts</div>
              <div className="space-y-3 max-h-40 overflow-auto pr-2">
                {Object.entries(selectedSkills).length === 0 && (
                  <div className="text-xs text-blue-800">Select at least one skill to configure counts.</div>
                )}
                {Object.entries(selectedSkills).map(([skill, counts]) => (
                  <div key={skill} className="bg-white rounded-md border border-blue-100 p-2">
                    <div className="text-xs font-semibold text-blue-900 mb-2">{skill}</div>
                    <div className="grid grid-cols-3 gap-2">
                      {(['Beginner','Intermediate','Advanced'] as const).map(level => (
                        <div key={level} className="flex items-center space-x-2">
                          <span className={`text-[11px] px-1.5 py-0.5 rounded ${
                            level==='Beginner' ? 'bg-blue-50 text-blue-700 border border-blue-200' : level==='Intermediate' ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-blue-200 text-blue-900 border border-blue-300'
                          }`}>{level}</span>
                          <input
                            type="number"
                            min={0}
                            max={20}
                            value={counts[level]}
                            onChange={(e) => updateSkillCount(skill, level, parseInt(e.target.value))}
                            className="w-16 px-2 py-1 border border-blue-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div> */}
          </div>

          {/* Resume-based questions toggle */}
          {/* <div className="mt-4">
            <div className="w-full bg-white border border-blue-100 rounded-lg p-3">
              <div className="flex items-center">
                <input
                  id="enable-resume"
                  type="checkbox"
                  checked={enableResumeQuestions}
                  onChange={(e) => setEnableResumeQuestions(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-blue-300 rounded"
                />
                <label htmlFor="enable-resume" className="ml-2 text-sm font-Intermediate text-blue-900">
                  Enable resume-based questions
                </label>
                <span className="ml-3 text-[11px] text-blue-800">
                  Tailor questions based on the candidate's resume highlights.
                </span>
              </div>
            </div>
          </div> */}

          {/* Follow-up questions toggle */}
          <div className="mt-2">
            <div className="w-full bg-white border border-blue-100 rounded-lg p-3">
              <div className="flex items-center">
                <input
                  id="enable-followups"
                  type="checkbox"
                  checked={enableFollowUps}
          
                  onChange={(e) => setEnableFollowUps(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-blue-300 rounded"
                />
                <label htmlFor="enable-followups" className="ml-2 text-sm font-Intermediate text-blue-900">
                  Enable follow-up questions
                </label>
                <span className="ml-3 text-[11px] text-blue-800">
                  Adds one deeper follow-up per question with higher difficulty.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Questions List */}
      {(questions.length > 0 || showNewForm) && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Level 1 Questions ({questions.length})
              </h2>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowNewForm(true)}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-Intermediate transition-colors flex items-center space-x-2"
                >
                  <Plus size={16} />
                  <span>Add Question</span>
                </button>
              </div>
            </div>
          </div>

          {showNewForm && (
            <div className="px-6 py-5 border-b border-gray-200 bg-blue-50/40">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-700 mb-1">Enter a prompt for question</label>
                  <textarea
                    value={newPrompt}
                    onChange={(e) => setNewPrompt(e.target.value)}
                    className="w-full h-24 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    placeholder="e.g., Explain event loop in Node.js with an example."
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Level</label>
                  <div className="p-3 border border-gray-300 rounded-lg">
                    <input
                      type="range"
                      min={0}
                      max={2}
                      step={1}
                      value={difficultyToIndex(newDifficulty)}
                      onChange={(e) => setNewDifficulty(indexToDifficulty(parseInt(e.target.value)))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-[11px] text-gray-600 mt-1">
                      <span>Beginner</span>
                      <span>Intermediate</span>
                      <span>Advanced</span>
                    </div>
                    <div className="mt-1 text-xs text-blue-700">Selected: {newDifficulty}</div>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center space-x-2">
                <button
                  onClick={addNewQuestion}
                  disabled={!newPrompt.trim()}
                  className={`px-4 py-2 rounded-lg font-Intermediate text-white ${!newPrompt.trim() ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
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

          <div className="divide-y divide-gray-200">
            {questions.map((question) => (
              <div key={question.id} className="p-6">
                {editingQuestion?.id === question.id ? (
                  // Editing Mode
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-Intermediate text-gray-700 mb-1">Question</label>
                        <textarea
                          value={editingQuestion.question}
                          onChange={(e) => setEditingQuestion(prev => prev ? { ...prev, question: e.target.value } : null)}
                          className="w-full h-24 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                          placeholder="Enter your question..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-Intermediate text-gray-700 mb-1">Category</label>
                        <input
                          type="text"
                          value={editingQuestion.category}
                          onChange={(e) => setEditingQuestion(prev => prev ? { ...prev, category: e.target.value } : null)}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="e.g., JavaScript, React"
                        />
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-Intermediate text-gray-700 mb-1">Difficulty</label>
                          <select
                            value={editingQuestion.difficulty}
                            onChange={(e) => setEditingQuestion(prev => prev ? { ...prev, difficulty: e.target.value as 'Beginner' | 'Intermediate' | 'Advanced' } : null)}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="Beginner">Beginner</option>
                            <option value="Intermediate">Intermediate</option>
                            <option value="Advanced">Advanced</option>
                          </select>
                        </div>
                        <div>
                          {/* <label className="block text-sm font-Intermediate text-gray-700 mb-1">Time (minutes)</label> */}
                          {/* <input
                            type="number"
                            value={editingQuestion.estimatedTime}
                            onChange={(e) => setEditingQuestion(prev => prev ? { ...prev, estimatedTime: parseInt(e.target.value) || 0 } : null)}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            min="1"
                            max="60"
                          /> */}


                        </div>
                      </div>
                    </div>
                    <div className="flex space-x-3">
                      <button
                        onClick={saveQuestion}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-Intermediate transition-colors flex items-center space-x-2"
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
                  // Display Mode
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-gray-900 font-Intermediate mb-2">{question.question}</p>
                        <div className="flex items-center space-x-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-Intermediate ${getCategoryColor(question.category)}`}>
                            {question.category}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-Intermediate ${getDifficultyColor(question.difficulty)}`}>
                            {question.difficulty.charAt(0).toUpperCase() + question.difficulty.slice(1)}
                          </span>
                          {/* Follow-up tag removed as follow-ups are no longer auto-generated */}
                          {/* <span className="text-sm text-gray-500">
                            {question.estimatedTime} min
                          </span> */}
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
        </div>
      )}

      {/* Empty State */}
      {questions.length === 0 && !isGenerating && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText size={32} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-Intermediate text-gray-900 mb-2">No technical questions yet</h3>
          <p className="text-gray-600 mb-6">
            Select skills and levels in the configuration panel, or click "Generate Questions" to use defaults.
          </p>
          {(resumeFile || jdFile) && (
            <div className="max-w-xl mx-auto mb-6 text-left">
              <div className="bg-blue-50 border border-blue-100 rounded-md p-3">
                <div className="text-sm font-semibold text-blue-900 mb-1">Selected files</div>
                <ul className="text-sm text-blue-800 list-disc pl-5 space-y-1">
                  {resumeFile && (<li>Resume: {resumeFile.name}</li>)}
                  {jdFile && (<li>Job Description: {jdFile.name}</li>)}
                </ul>
              </div>
            </div>
          )}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button
              onClick={generateQuestions}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-Intermediate transition-colors flex items-center space-x-2"
            >
              <Bot size={16} />
              <span>Generate Questions</span>
            </button>
            {/* <button
              onClick={() => setShowNewForm(true)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Add Question
            </button> */}
          </div>
          {showNewForm && (
            <div className="mt-6 text-left max-w-3xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-700 mb-1">Enter a prompt for question</label>
                  <textarea
                    value={newPrompt}
                    onChange={(e) => setNewPrompt(e.target.value)}
                    className="w-full h-24 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    placeholder="e.g., Explain event loop in Node.js with an example."
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Level</label>
                  <div className="p-3 border border-gray-300 rounded-lg">
                    <input
                      type="range"
                      min={0}
                      max={2}
                      step={1}
                      value={difficultyToIndex(newDifficulty)}
                      onChange={(e) => setNewDifficulty(indexToDifficulty(parseInt(e.target.value)))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-[11px] text-gray-600 mt-1">
                      <span>Beginner</span>
                      <span>Intermediate</span>
                      <span>Advanced</span>
                    </div>
                    <div className="mt-1 text-xs text-blue-700">Selected: {newDifficulty}</div>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center space-x-2">
                {/* <button
                  onClick={addNewQuestion}
                  disabled={!newPrompt.trim()}
                  className={`px-4 py-2 rounded-lg font-Intermediate text-white ${!newPrompt.trim() ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  Save Question
                </button>
                <button
                  onClick={() => { setShowNewForm(false); setNewPrompt(''); }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button> */}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RecruiterPage;
