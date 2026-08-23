import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  UploadCloud, FileText, BrainCircuit, HelpCircle, Stethoscope, BookOpen, 
  Trash2, Loader2, Play, CheckCircle, ChevronRight, 
  Home, Plus, Settings, CheckSquare, Moon, Sun, 
  CalendarDays, X, Pause, RotateCcw, Activity, Key,
  Check, ArrowRight
} from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Button, Card, ErrorBoundary } from './components/ui';
import { MCQRenderer, ClinicalCaseRenderer, SmartSummaryRenderer, AnkiWorkspace } from './components/renderers';
import MedPatientView from './components/MedPatientView';
import { extractTextFromFile } from './utils/pdfExtractor';
import { NormalizationEngine, safeParseJson } from './utils/normalization';

const getTodayStr = () => {
  const d = new Date(); 
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
};

const formatDate = (isoString) => {
  if (!isoString) return '';
  return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const getReviewConfig = (num) => {
  const configs = {
    0: { title: "Day 0: Initial Learning", icon: "🟣", color: "text-purple-500" },
    1: { title: "Day 1: Active Recall", icon: "🧠", color: "text-blue-500" },
    2: { title: "Day 3: Weak Points Review", icon: "⚡", color: "text-amber-500" },
    3: { title: "Day 7: Consolidation", icon: "🔗", color: "text-teal-500" },
    4: { title: "Day 14: Long-Term Recall", icon: "🎯", color: "text-indigo-500" },
    5: { title: "Day 30: Mastery Test", icon: "🏆", color: "text-emerald-500" },
    6: { title: "Day 60: Permanent Retention", icon: "🛡️", color: "text-cyan-500" }
  };
  return configs[num] || configs[6];
};

// Fullscreen Focus Timer Overlay Component
const FocusTimerOverlay = React.memo(({ task, onClose }) => {
  const [stage, setStage] = useState('select'); 
  const [durationMs, setDurationMs] = useState(25 * 60 * 1000);
  const [remainingMs, setRemainingMs] = useState(25 * 60 * 1000);
  const [isRunning, setIsRunning] = useState(false);

  const endTimeRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (isRunning) {
      endTimeRef.current = Date.now() + remainingMs;
      timerRef.current = setInterval(() => {
        const left = Math.max(0, endTimeRef.current - Date.now());
        setRemainingMs(left);
        if (left <= 0) {
          clearInterval(timerRef.current);
          setIsRunning(false);
          setStage('completed');
        }
      }, 100);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRunning]);

  const startTimer = useCallback((ms) => {
    setDurationMs(ms); 
    setRemainingMs(ms); 
    setStage('running'); 
    setIsRunning(true);
  }, []);

  const { h, m, s } = useMemo(() => {
    const totalS = Math.floor(remainingMs / 1000);
    return {
      h: Math.floor(totalS / 3600).toString().padStart(2, '0'),
      m: Math.floor((totalS % 3600) / 60).toString().padStart(2, '0'),
      s: (totalS % 60).toString().padStart(2, '0')
    };
  }, [remainingMs]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in fade-in" dir="ltr">
      <div className="absolute top-8 text-center px-4 w-full">
         <p className="text-teal-400 font-bold tracking-widest uppercase text-xs mb-1">MedOS Focus Mode</p>
         <h2 className="text-2xl md:text-3xl font-bold text-white max-w-2xl mx-auto truncate">
           {task?.title || task?.name || 'Medical Study Session'}
         </h2>
      </div>

      {stage === 'select' && (
        <div className="flex flex-col items-center space-y-8 mt-12 w-full max-w-xl">
           <h3 className="text-xl font-bold text-slate-200">Select Session Duration</h3>
           <div className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full">
              {[15, 25, 30, 45, 60, 90].map(mins => (
                <Button 
                  key={mins} 
                  variant="secondary" 
                  className="py-6 text-lg font-bold bg-slate-900 border-2 border-slate-800 text-white hover:border-teal-500" 
                  onClick={() => startTimer(mins * 60000)}
                >
                  {mins} min
                </Button>
              ))}
           </div>
           <Button variant="ghost" onClick={onClose} className="mt-8 text-slate-400 hover:text-white">
             Cancel & Go Back
           </Button>
        </div>
      )}

      {stage === 'running' && (
        <div className="flex flex-col items-center w-full max-w-4xl mt-12 space-y-10">
           <div className="flex gap-4 md:gap-6 items-center justify-center text-6xl md:text-8xl font-mono font-bold tracking-tighter text-white">
              <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl w-24 md:w-36 h-28 md:h-48 flex items-center justify-center shadow-2xl"><span>{h}</span></div>:
              <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl w-24 md:w-36 h-28 md:h-48 flex items-center justify-center shadow-2xl"><span>{m}</span></div>:
              <div className="bg-slate-900 border border-slate-800 text-teal-400 rounded-3xl w-24 md:w-36 h-28 md:h-48 flex items-center justify-center shadow-2xl"><span>{s}</span></div>
           </div>
           <div className="flex gap-4 flex-wrap justify-center">
              {isRunning ? (
                 <Button variant="secondary" className="bg-amber-500/20 border-amber-500/40 text-amber-300 px-8 py-3.5 text-base font-bold" onClick={() => setIsRunning(false)}>
                   <Pause size={18} className="mr-2"/> Pause
                 </Button>
              ) : (
                 <Button variant="primary" className="bg-emerald-600 px-8 py-3.5 text-base font-bold" onClick={() => setIsRunning(true)}>
                   <Play size={18} className="mr-2"/> Resume
                 </Button>
              )}
              <Button variant="secondary" className="bg-slate-900 text-slate-300 border-slate-800 px-6 py-3.5 text-base font-bold" onClick={() => { setIsRunning(false); setRemainingMs(durationMs); }}>
                <RotateCcw size={18} className="mr-2"/> Reset
              </Button>
              <Button variant="ghost" className="px-6 py-3.5 text-base font-bold text-slate-400 hover:text-rose-400" onClick={onClose}>
                <X size={18} className="mr-2"/> Exit
              </Button>
           </div>
        </div>
      )}

      {stage === 'completed' && (
        <div className="flex flex-col items-center text-center space-y-6 animate-in fade-in">
           <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 flex items-center justify-center rounded-full border border-emerald-500/40">
             <CheckCircle size={44} />
           </div>
           <h2 className="text-3xl font-bold text-white">🎉 Focus Session Complete!</h2>
           <p className="text-sm text-slate-400 max-w-sm">Great job staying focused. Keep up the high retention streak.</p>
           <Button variant="primary" className="bg-teal-600 px-8 py-3.5 text-base font-bold" onClick={onClose}>
             Back to Workspace
           </Button>
        </div>
      )}
    </div>
  );
});

export default function App() {
  const [currentRoute, setCurrentRoute] = useState('dashboard');
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [apiKey, setApiKey] = useState(localStorage.getItem('medos_api_key') || '');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [tempKeyInput, setTempKeyInput] = useState('');

  // Active focus timer state
  const [activeFocusTask, setActiveFocusTask] = useState(null);

  // File and AI Generation States
  const [file, setFile] = useState(null);
  const [lectureText, setLectureText] = useState('');
  const [isExtractingPdf, setIsExtractingPdf] = useState(false);
  const [pdfExtractionProgress, setPdfExtractionProgress] = useState(null);
  const [selectedTask, setSelectedTask] = useState('mcqs');
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [generatedPayload, setGeneratedPayload] = useState(null);

  // LocalStorage states for full client-side persistence
  const [tasks, setTasks] = useState(() => JSON.parse(localStorage.getItem('medos_tasks') || '[]'));
  const [plans, setPlans] = useState(() => JSON.parse(localStorage.getItem('medos_plans') || '[]'));
  const [mistakes, setMistakes] = useState(() => JSON.parse(localStorage.getItem('medos_mistakes') || '[]'));

  // Form Inputs
  const [settings, setSettings] = useState({ 
    mcqCount: '5', 
    difficulty: 'Medium', 
    quizType: 'Mixed' 
  });
  const [newTaskInput, setNewTaskInput] = useState('');
  const [taskFilter, setTaskFilter] = useState('all'); // all, active, completed
  const [newLecture, setNewLecture] = useState('');
  const [newModule, setNewModule] = useState('');
  const [newSubject, setNewSubject] = useState('');

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [theme]);

  useEffect(() => { if (!apiKey) setShowApiKeyModal(true); }, [apiKey]);
  useEffect(() => { localStorage.setItem('medos_tasks', JSON.stringify(tasks)); }, [tasks]);
  useEffect(() => { localStorage.setItem('medos_plans', JSON.stringify(plans)); }, [plans]);
  useEffect(() => { localStorage.setItem('medos_mistakes', JSON.stringify(mistakes)); }, [mistakes]);

  // Refresh mistakes from storage when opening the tracker
  useEffect(() => {
    if (currentRoute === 'highyield_track') {
      const stored = JSON.parse(localStorage.getItem('medos_mistakes') || '[]');
      setMistakes(stored);
    }
  }, [currentRoute]);

  const saveApiKey = () => {
    if (tempKeyInput.trim()) {
      localStorage.setItem('medos_api_key', tempKeyInput.trim());
      setApiKey(tempKeyInput.trim());
      setShowApiKeyModal(false);
    } else {
      alert("Please enter a valid Gemini API Key.");
    }
  };

  const handleFileUpload = async (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setGeneratedPayload(null);
    setErrorMsg(null);
    setIsExtractingPdf(true);
    setPdfExtractionProgress({ current: 0, total: 0 });

    try {
      const extracted = await extractTextFromFile(uploadedFile, 25, (prog) => {
        setPdfExtractionProgress(prog);
      });
      setLectureText(extracted);
    } catch (err) {
      console.error("Extraction error:", err);
      setErrorMsg("Failed to read file: " + err.message);
    } finally {
      setIsExtractingPdf(false);
      setPdfExtractionProgress(null);
    }
  };

  const handleGenerate = async () => {
    if (!apiKey) { setShowApiKeyModal(true); return; }
    if (!lectureText.trim()) {
      setErrorMsg("Please upload a file or paste lecture notes first.");
      return;
    }

    setIsGenerating(true);
    setErrorMsg(null);

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      let prompt = "";
      const textSnippet = lectureText.substring(0, 12000);

      if (selectedTask === 'mcqs') {
        prompt = `You are an expert medical board examiner. Your task is to generate ${settings.mcqCount} high-yield Multiple Choice Questions (MCQs) based STRICTLY on the provided lecture notes.

### CONFIGURATION ###
- Difficulty Level: ${settings.difficulty}
- Question Type Focus: ${settings.quizType}

### DIFFICULTY GUIDELINES ###
- If "Easy": Write first-order questions. Direct associations and 1-step reasoning (e.g., Presentation -> Diagnosis).
- If "Medium": Write second-order questions. 2-step reasoning (e.g., Presentation -> Diagnosis -> Mechanism or Treatment).
- If "Hard": Write third-order questions. Complex clinical scenarios, subtle differences between options, and classic exam traps. All options should seem plausible.

### QUESTION TYPE GUIDELINES ###
- If "Direct Recall": Focus on memorization facts, pathognomonic signs, normal ranges, drug side effects, or direct associations. Do not use long clinical vignettes.
- If "Conceptual": Focus on pathophysiology, mechanisms of action, "why" something happens, or what happens if a physiological pathway is blocked.
- If "Except / Least Likely": Write questions testing exclusion. Format must be "All of the following are true EXCEPT..." or "Which of the following is the LEAST likely...". Provide 3 correct statements and 1 false statement.
- If "Mixed": Create a balanced mix of Direct Recall, Conceptual, and Except questions.

### OUTPUT FORMAT ###
Return a STRICTLY VALID JSON array. Do NOT wrap in markdown blocks like \`\`\`json.
[
  {
    "question": "The question text...",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": "Exact text of the correct choice",
    "explanation": {
      "correct": "Clinical reasoning explaining why this choice is correct...",
      "distractors": {
        "Option X": "Why X is incorrect...",
        "Option Y": "Why Y is incorrect...",
        "Option Z": "Why Z is incorrect..."
      }
    },
    "topic": "Main medical topic",
    "concept": "The core concept being tested",
    "type": "Identify the type used (Recall, Conceptual, Except)",
    "difficulty": "${settings.difficulty}"
  }
]

### LECTURE NOTES ###
${textSnippet}`;
      } else if (selectedTask === 'cases') {
        prompt = `Generate 4 realistic USMLE clinical vignette cases based on this lecture:
        ${textSnippet}
        
        Return strictly valid JSON array format:
        [
          {
            "vignette": "A 45-year-old male presents with...",
            "question": "What is the most appropriate next step in management or most likely diagnosis?",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correctAnswer": "Option A",
            "explanation": {
              "clinical_reasoning": "Step-by-step diagnostic reasoning..."
            },
            "key_takeaway": "Crucial high-yield clinical pearl",
            "topic": "Internal Medicine",
            "difficulty": "USMLE Step 2 CK"
          }
        ]`;
      } else if (selectedTask === 'summary') {
        prompt = `Generate a smart, high-yield summary for medical students in Egyptian Arabic mixed with English medical terminology based on this lecture:
        ${textSnippet}
        
        Return strictly valid JSON object:
        {
          "topic": "Lecture Core Topic",
          "what_it_means": "شرح مبسط وواضح للمرض والمفهوم الأساسي بالعامية الطبية والمصطلحات...",
          "why_it_happens": "Pathophysiology and Mechanism explained simply...",
          "presentation": "Classic Symptoms, Signs, Triads...",
          "diagnosis": "Best Initial Test, Gold Standard, Lab findings...",
          "management": "First-line Treatment, Urgent interventions...",
          "exam_traps": "فخاخ الامتحانات وأشهر أخطاء الأسئلة..."
        }`;
      } else {
        // Anki Flashcards
        prompt = `Generate 8 high-yield active-recall Anki flashcards for spaced repetition retention based on:
        ${textSnippet}
        
        Return strictly valid JSON array:
        [
          {
            "front": "Specific Question / Pathophysiology trigger...",
            "back": "Concise high-yield answer / mechanism...",
            "topic": "Medicine"
          }
        ]`;
      }

      const result = await model.generateContent(prompt);
      const rawText = result.response.text();
      const parsed = safeParseJson(rawText);

      // Normalize through NormalizationEngine
      let normalized = [];
      if (selectedTask === 'mcqs') normalized = NormalizationEngine.mcqs(parsed);
      else if (selectedTask === 'cases') normalized = NormalizationEngine.cases(parsed);
      else if (selectedTask === 'summary') normalized = NormalizationEngine.summary(parsed);
      else normalized = NormalizationEngine.anki(parsed);

      setGeneratedPayload(normalized);
    } catch (err) {
      console.error("Generation error:", err);
      setErrorMsg("Generation error: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // Planner Functions
  const addStudyPlanLocally = () => {
    if (!newLecture.trim()) return;
    const baseDate = new Date();
    const reviewIntervals = [0, 1, 3, 7, 14, 30, 60];
    const reviews = reviewIntervals.map((days, idx) => ({
      id: Date.now() + idx,
      review_number: idx,
      scheduled_date: new Date(baseDate.getTime() + days * 86400000).toISOString(),
      is_completed: false
    }));

    setPlans([
      {
        id: Date.now(),
        name: newLecture,
        module_name: newModule || 'General',
        subject_name: newSubject || 'General Medicine',
        study_date: baseDate.toISOString(),
        reviews: reviews
      },
      ...plans
    ]);
    setNewLecture(''); 
    setNewModule(''); 
    setNewSubject('');
  };

  const toggleReviewCompletion = (planId, reviewId) => {
    setPlans(plans.map(plan => {
      if (plan.id === planId) {
        return {
          ...plan,
          reviews: plan.reviews.map(r => r.id === reviewId ? { ...r, is_completed: !r.is_completed } : r)
        };
      }
      return plan;
    }));
  };

  const deletePlan = (planId) => {
    setPlans(plans.filter(p => p.id !== planId));
  };

  // Task Management Functions
  const addTask = () => {
    if (!newTaskInput.trim()) return;
    setTasks([
      { id: Date.now(), title: newTaskInput.trim(), is_completed: false, created_at: new Date().toISOString() },
      ...tasks
    ]);
    setNewTaskInput('');
  };

  const toggleTaskCompletion = (taskId) => {
    setTasks(tasks.map(t => t.id === taskId ? { ...t, is_completed: !t.is_completed } : t));
  };

  const deleteTask = (taskId) => {
    setTasks(tasks.filter(t => t.id !== taskId));
  };

  const filteredTasks = tasks.filter(t => {
    if (taskFilter === 'active') return !t.is_completed;
    if (taskFilter === 'completed') return t.is_completed;
    return true;
  });

  // Calculate Due Reviews Today
  const dueReviewsCount = useMemo(() => {
    const today = getTodayStr();
    let count = 0;
    plans.forEach(plan => {
      plan.reviews?.forEach(r => {
        if (!r.is_completed && r.scheduled_date && r.scheduled_date.split('T')[0] <= today) {
          count++;
        }
      });
    });
    return count;
  }, [plans]);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <Home size={18}/> },
    { id: 'study_hub', label: 'Study Tools', icon: <BookOpen size={18}/> },
    { id: 'medpatient', label: 'Virtual Patient', icon: <Stethoscope size={18}/> },
    { id: 'planner', label: 'Spaced Repetition', icon: <CalendarDays size={18}/> },
    { id: 'tasks', label: 'Tasks', icon: <CheckSquare size={18}/> },
    { id: 'highyield_track', label: 'High-Yield Tracker', icon: <Activity size={18}/> },
    { id: 'settings', label: 'Settings', icon: <Settings size={18}/> },
  ];

  const tools = [
    { id: 'mcqs', name: 'MCQ Engine', desc: 'Generate USMLE-style active-recall questions with rich explanations.', icon: <HelpCircle size={28} /> },
    { id: 'cases', name: 'Clinical Cases', desc: 'USMLE Step 2 CK vignettes and diagnostic decision trees.', icon: <Stethoscope size={28} /> },
    { id: 'summary', name: 'Smart Summary', desc: 'Egyptian Arabic medical tutoring and interactive PDF chat.', icon: <BookOpen size={28} /> },
    { id: 'anki', name: 'Anki Flashcards', desc: 'Active recall spaced-repetition flashcards with CSV export.', icon: <BrainCircuit size={28} /> },
  ];

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans" dir="ltr">
        
        {/* Focus Timer Modal */}
        {activeFocusTask && (
          <FocusTimerOverlay task={activeFocusTask} onClose={() => setActiveFocusTask(null)} />
        )}

        {/* API Key Modal */}
        {showApiKeyModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <Card className="p-6 w-full max-w-md shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95">
              <h3 className="text-xl font-bold mb-2 flex items-center gap-2 text-slate-900 dark:text-white">
                <Key className="text-teal-600"/> Gemini API Key Setup
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                Enter your Google Gemini API key to enable high-speed AI medical generation and virtual patient simulation directly in your browser.
              </p>
              <input 
                type="password" 
                placeholder="AIzaSy..." 
                value={tempKeyInput} 
                onChange={e => setTempKeyInput(e.target.value)} 
                className="w-full border p-3 rounded-xl bg-white dark:bg-slate-800 mb-4 outline-none border-slate-200 dark:border-slate-700 text-sm focus:border-teal-500" 
              />
              <Button variant="primary" onClick={saveApiKey} className="w-full bg-teal-600 py-3 font-bold">
                Save & Continue
              </Button>
            </Card>
          </div>
        )}

        {/* Sidebar Navigation */}
        <aside className="w-[260px] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between hidden md:flex shrink-0">
          <div className="p-6">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="bg-teal-600 text-white p-2 rounded-xl shadow-md shadow-teal-600/20">
                  <Stethoscope size={22}/>
                </div>
                <div>
                  <h1 className="font-bold text-base tracking-tight leading-none">MedOS</h1>
                  <span className="text-[10px] text-teal-600 font-bold uppercase tracking-wider">Medical AI</span>
                </div>
              </div>
              <button 
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} 
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                {theme === 'light' ? <Moon size={16}/> : <Sun size={16}/>}
              </button>
            </div>
            
            <nav className="space-y-1.5">
              {navItems.map(item => (
                <button 
                  key={item.id} 
                  onClick={() => setCurrentRoute(item.id)} 
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                    currentRoute === item.id 
                      ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 font-bold shadow-sm' 
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  {item.icon} {item.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6 border-t border-slate-100 dark:border-slate-800/60">
            <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span>Gemini 1.5 Flash</span>
              </div>
              <Button variant="ghost" className="text-xs p-1" onClick={() => setShowApiKeyModal(true)}>
                <Key size={14}/>
              </Button>
            </div>
          </div>
        </aside>

        {/* Main Content Viewport */}
        <main className="flex-1 overflow-y-auto p-6 md:p-10">
          <div className="max-w-[1100px] mx-auto">
            
            {/* Dashboard View */}
            {currentRoute === 'dashboard' && (
              <div className="space-y-8 animate-in fade-in">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h2 className="text-3xl font-bold tracking-tight">Medical Study Command Center</h2>
                    <p className="text-sm text-slate-500 mt-1">Track spaced repetition retention, practice high-yield vignettes, and master clinical cases.</p>
                  </div>
                  <Button 
                    variant="primary" 
                    onClick={() => setActiveFocusTask({ title: "Deep Medical Study Session" })} 
                    className="bg-teal-600 hover:bg-teal-700 shadow-md"
                  >
                    <Play size={16} className="mr-2"/> Quick Focus Session
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  <Card className="p-5 bg-teal-50/70 dark:bg-teal-950/20 border-teal-200 dark:border-teal-900/40">
                    <span className="text-xs font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wider">Pending Tasks</span>
                    <h3 className="text-3xl font-bold text-teal-800 dark:text-teal-300 mt-2">
                      {tasks.filter(t => !t.is_completed).length}
                    </h3>
                  </Card>
                  
                  <Card className="p-5 bg-blue-50/70 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40">
                    <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">Due Reviews Today</span>
                    <h3 className="text-3xl font-bold text-blue-800 dark:text-blue-300 mt-2">
                      {dueReviewsCount}
                    </h3>
                  </Card>

                  <Card className="p-5 bg-purple-50/70 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900/40">
                    <span className="text-xs font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider">Active Study Plans</span>
                    <h3 className="text-3xl font-bold text-purple-800 dark:text-purple-300 mt-2">
                      {plans.length}
                    </h3>
                  </Card>

                  <Card className="p-5 bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40">
                    <span className="text-xs font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider">Mistakes Tracked</span>
                    <h3 className="text-3xl font-bold text-rose-800 dark:text-rose-300 mt-2">
                      {mistakes.length}
                    </h3>
                  </Card>
                </div>

                {/* Quick Navigation Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <Card className="p-6 space-y-4 hover:border-teal-500 transition-all cursor-pointer" onClick={() => setCurrentRoute('study_hub')}>
                    <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-900/30 text-teal-600 flex items-center justify-center">
                      <BookOpen size={24}/>
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">AI Study Material Generator</h3>
                      <p className="text-sm text-slate-500 mt-1">Upload lecture PDFs or notes to instantly generate MCQs, Clinical Vignettes, Summaries, and Flashcards.</p>
                    </div>
                    <span className="text-sm font-bold text-teal-600 flex items-center gap-1">Open Study Tools <ArrowRight size={14}/></span>
                  </Card>

                  <Card className="p-6 space-y-4 hover:border-teal-500 transition-all cursor-pointer" onClick={() => setCurrentRoute('medpatient')}>
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center">
                      <Stethoscope size={24}/>
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Virtual Patient Clinic (Egyptian Dialect)</h3>
                      <p className="text-sm text-slate-500 mt-1">Practice realistic clinical history taking and diagnostic reasoning with interactive AI patients in Egyptian Arabic.</p>
                    </div>
                    <span className="text-sm font-bold text-blue-600 flex items-center gap-1">Start Patient Case <ArrowRight size={14}/></span>
                  </Card>
                </div>
              </div>
            )}

            {/* Study Hub View */}
            {currentRoute === 'study_hub' && (
              <div className="space-y-8 animate-in fade-in">
                <div>
                  <h2 className="text-3xl font-bold">📚 High-Yield Study Suite</h2>
                  <p className="text-sm text-slate-500 mt-1">Select an AI tool to transform your medical lectures into active learning engines.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {tools.map(t => (
                    <Card 
                      key={t.id} 
                      onClick={() => { setSelectedTask(t.id); setCurrentRoute('study'); }} 
                      className="p-6 cursor-pointer hover:border-teal-500 transition-all space-y-3 dark:bg-slate-900"
                    >
                      <div className="text-teal-600 mb-2">{t.icon}</div>
                      <h3 className="font-bold text-xl">{t.name}</h3>
                      <p className="text-sm text-slate-500">{t.desc}</p>
                      <span className="text-xs font-bold text-teal-600 flex items-center gap-1 pt-2">Launch Generator <ChevronRight size={14}/></span>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Study Material Generator View */}
            {currentRoute === 'study' && (
              <div className="space-y-6 max-w-4xl animate-in fade-in">
                <div className="flex items-center gap-4">
                  <Button variant="ghost" onClick={() => setCurrentRoute('study_hub')} className="p-2">
                    <ChevronRight className="rotate-180" size={20}/>
                  </Button>
                  <div>
                    <h2 className="text-3xl font-bold capitalize">{selectedTask} Generator</h2>
                    <p className="text-xs text-slate-500">Transform your medical material with AI active recall</p>
                  </div>
                </div>

                {/* Upload or Direct Paste Section */}
                <div className="space-y-4">
                  {!file ? (
                    <div className="space-y-4">
                      <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-3xl cursor-pointer bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-teal-500 transition-all">
                        <UploadCloud size={36} className="text-teal-600 mb-2"/>
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Upload Medical Lecture (PDF, TXT, MD)</span>
                        <span className="text-xs text-slate-400 mt-1">Client-side text extraction & processing</span>
                        <input type="file" accept=".pdf,.txt,.md" className="hidden" onChange={handleFileUpload} />
                      </label>
                      <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
                        <span className="flex-shrink mx-4 text-xs uppercase font-bold text-slate-400">Or Paste Lecture Text Directly</span>
                        <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
                      </div>
                      <textarea 
                        rows={4}
                        placeholder="Paste lecture notes, pathology summary, or clinical guidelines here..."
                        value={lectureText}
                        onChange={e => setLectureText(e.target.value)}
                        className="w-full p-4 border rounded-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-sm outline-none focus:border-teal-500"
                      />
                    </div>
                  ) : (
                    <Card className="p-5 flex justify-between items-center bg-teal-50/70 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800">
                      <div className="flex items-center gap-3">
                        <FileText className="text-teal-600" size={24}/>
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">{file.name}</h4>
                          <p className="text-xs text-slate-500">
                            {isExtractingPdf ? `Extracting text: ${pdfExtractionProgress?.current || 0}/${pdfExtractionProgress?.total || 0} pages...` : `Extracted ${lectureText.length} characters`}
                          </p>
                        </div>
                      </div>
                      <Button variant="danger" onClick={() => { setFile(null); setLectureText(''); setGeneratedPayload(null); }}>
                        Remove
                      </Button>
                    </Card>
                  )}

                  {/* MCQ Configuration Panel */}
                  {selectedTask === 'mcqs' && (
                    <Card className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 block">
                        ⚙️ MCQ Configuration
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs font-bold text-slate-500 mb-1 block">Question Count</label>
                          <select 
                            value={settings.mcqCount} 
                            onChange={e => setSettings(prev => ({ ...prev, mcqCount: e.target.value }))}
                            className="w-full p-2.5 border rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-sm outline-none focus:border-teal-500 text-slate-900 dark:text-slate-100"
                          >
                            <option value="3">3 Questions</option>
                            <option value="5">5 Questions</option>
                            <option value="10">10 Questions</option>
                            <option value="15">15 Questions</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500 mb-1 block">Quiz Type</label>
                          <select 
                            value={settings.quizType} 
                            onChange={e => setSettings(prev => ({ ...prev, quizType: e.target.value }))}
                            className="w-full p-2.5 border rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-sm outline-none focus:border-teal-500 text-slate-900 dark:text-slate-100"
                          >
                            <option value="Mixed">Mixed</option>
                            <option value="Direct Recall">Direct Recall</option>
                            <option value="Conceptual">Conceptual</option>
                            <option value="Except / Least Likely">Except / Least Likely</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500 mb-1 block">Difficulty</label>
                          <select 
                            value={settings.difficulty} 
                            onChange={e => setSettings(prev => ({ ...prev, difficulty: e.target.value }))}
                            className="w-full p-2.5 border rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-sm outline-none focus:border-teal-500 text-slate-900 dark:text-slate-100"
                          >
                            <option value="Easy">Easy</option>
                            <option value="Medium">Medium</option>
                            <option value="Hard">Hard</option>
                          </select>
                        </div>
                      </div>
                    </Card>
                  )}

                  {/* Generation Trigger Button */}
                  {(file || lectureText.trim().length > 0) && (
                    <Button 
                      variant="primary" 
                      onClick={handleGenerate} 
                      disabled={isGenerating || isExtractingPdf} 
                      className="w-full bg-teal-600 hover:bg-teal-700 py-4 font-bold text-base shadow-lg shadow-teal-600/20"
                    >
                      {isGenerating ? <Loader2 className="animate-spin mr-2"/> : <Play className="mr-2"/>} 
                      Generate {selectedTask.toUpperCase()} with Gemini AI
                    </Button>
                  )}
                </div>

                {errorMsg && (
                  <div className="p-4 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 rounded-2xl border border-rose-200 dark:border-rose-900/40 text-sm">
                    {errorMsg}
                  </div>
                )}

                {/* Interactive Renderers Output */}
                {generatedPayload && (
                  <div className="space-y-6 pt-4">
                    {selectedTask === 'mcqs' && (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h3 className="font-bold text-xl">Generated Practice MCQs ({generatedPayload.length})</h3>
                        </div>
                        {generatedPayload.map((item, idx) => (
                          <MCQRenderer key={item.id || idx} data={item} idx={idx + 1} />
                        ))}
                      </div>
                    )}

                    {selectedTask === 'cases' && (
                      <div className="space-y-4">
                        <h3 className="font-bold text-xl">Clinical Vignettes & Decision Trees ({generatedPayload.length})</h3>
                        {generatedPayload.map((item, idx) => (
                          <ClinicalCaseRenderer key={item.id || idx} data={item} idx={idx + 1} />
                        ))}
                      </div>
                    )}

                    {selectedTask === 'summary' && (
                      <div>
                        {generatedPayload.map((item, idx) => (
                          <SmartSummaryRenderer key={idx} data={item} rawPdfText={lectureText} apiKey={apiKey} />
                        ))}
                      </div>
                    )}

                    {selectedTask === 'anki' && (
                      <div className="space-y-4">
                        <h3 className="font-bold text-xl">Anki Active Recall Flashcards ({generatedPayload.length})</h3>
                        <AnkiWorkspace initialCards={generatedPayload} fileName={file?.name?.replace(/\.[^/.]+$/, '') || 'MedOS_Anki_Deck'} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Virtual Patient View */}
            {currentRoute === 'medpatient' && (
              <MedPatientView apiKey={apiKey} onShowKeyModal={() => setShowApiKeyModal(true)} />
            )}

            {/* Tasks Management View */}
            {currentRoute === 'tasks' && (
              <div className="space-y-6 max-w-3xl animate-in fade-in">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-3xl font-bold">Study Tasks</h2>
                    <p className="text-sm text-slate-500">Plan your clinical study sessions and track daily medical objectives.</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Add a new medical study task (e.g. Master Cardiology murmurs)..." 
                    value={newTaskInput} 
                    onChange={e => setNewTaskInput(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && addTask()}
                    className="flex-1 p-3.5 border rounded-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-sm outline-none focus:border-teal-500" 
                  />
                  <Button variant="primary" onClick={addTask} className="bg-teal-600 px-6 rounded-2xl">
                    <Plus size={18} className="mr-1"/> Add
                  </Button>
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                  {['all', 'active', 'completed'].map(tab => (
                    <button 
                      key={tab} 
                      onClick={() => setTaskFilter(tab)} 
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-colors ${
                        taskFilter === tab 
                          ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300' 
                          : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {tab} ({tab === 'all' ? tasks.length : tab === 'active' ? tasks.filter(t => !t.is_completed).length : tasks.filter(t => t.is_completed).length})
                    </button>
                  ))}
                </div>

                {/* Task List */}
                <div className="space-y-3">
                  {filteredTasks.length === 0 ? (
                    <Card className="p-8 text-center text-slate-400 border-dashed">
                      <p className="text-sm">No tasks found in this view.</p>
                    </Card>
                  ) : (
                    filteredTasks.map(t => (
                      <Card key={t.id} className="p-4 flex items-center justify-between gap-4 dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition-all">
                        <div className="flex items-center gap-3 flex-1">
                          <button 
                            onClick={() => toggleTaskCompletion(t.id)} 
                            className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all ${
                              t.is_completed 
                                ? 'bg-teal-600 border-teal-600 text-white' 
                                : 'border-slate-300 dark:border-slate-700 hover:border-teal-500'
                            }`}
                          >
                            {t.is_completed && <Check size={14}/>}
                          </button>
                          <span className={`text-sm font-medium ${t.is_completed ? 'line-through text-slate-400' : 'text-slate-900 dark:text-slate-100'}`}>
                            {t.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="secondary" 
                            className="text-xs py-1.5 px-3 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 hover:bg-teal-100" 
                            onClick={() => setActiveFocusTask(t)}
                          >
                            <Play size={12} className="mr-1"/> Focus
                          </Button>
                          <Button variant="danger" className="p-2" onClick={() => deleteTask(t.id)}>
                            <Trash2 size={15}/>
                          </Button>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Spaced Repetition Planner View */}
            {currentRoute === 'planner' && (
              <div className="space-y-8 max-w-4xl animate-in fade-in">
                <div>
                  <h2 className="text-3xl font-bold">🧠 Spaced Repetition Planner</h2>
                  <p className="text-sm text-slate-500 mt-1">Automatic interval schedule: Day 0, Day 1, Day 3, Day 7, Day 14, Day 30, Day 60 for long-term retention.</p>
                </div>

                {/* Add New Plan */}
                <Card className="p-6 space-y-4 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <h3 className="font-bold text-base flex items-center gap-2"><Plus size={16} className="text-teal-600"/> Add Lecture Study Plan</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input 
                      type="text" 
                      placeholder="Lecture / Topic Name" 
                      value={newLecture} 
                      onChange={e => setNewLecture(e.target.value)} 
                      className="p-3 border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-sm outline-none focus:border-teal-500"
                    />
                    <input 
                      type="text" 
                      placeholder="Module (e.g. CVS, CNS)" 
                      value={newModule} 
                      onChange={e => setNewModule(e.target.value)} 
                      className="p-3 border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-sm outline-none focus:border-teal-500"
                    />
                    <input 
                      type="text" 
                      placeholder="Subject (e.g. Pathology)" 
                      value={newSubject} 
                      onChange={e => setNewSubject(e.target.value)} 
                      className="p-3 border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-sm outline-none focus:border-teal-500"
                    />
                  </div>
                  <Button variant="primary" onClick={addStudyPlanLocally} disabled={!newLecture.trim()} className="bg-teal-600 w-full font-bold py-3">
                    Create 7-Stage Spaced Repetition Schedule
                  </Button>
                </Card>

                {/* Active Plans List */}
                <div className="space-y-6">
                  {plans.length === 0 ? (
                    <Card className="p-8 text-center text-slate-400 border-dashed">
                      <p className="text-sm">No active spaced repetition schedules yet. Create your first lecture plan above!</p>
                    </Card>
                  ) : (
                    plans.map(plan => {
                      const completedCount = plan.reviews?.filter(r => r.is_completed).length || 0;
                      const progressPct = Math.round((completedCount / (plan.reviews?.length || 7)) * 100);

                      return (
                        <Card key={plan.id} className="p-6 space-y-4 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300">
                                  {plan.module_name} • {plan.subject_name}
                                </span>
                                <span className="text-xs text-slate-400">Started: {formatDate(plan.study_date)}</span>
                              </div>
                              <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1">{plan.name}</h3>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <span className="text-xs font-bold text-teal-600">{completedCount}/7 Reviews</span>
                                <div className="w-28 bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-1 overflow-hidden">
                                  <div className="bg-teal-600 h-full rounded-full transition-all" style={{ width: `${progressPct}%` }}></div>
                                </div>
                              </div>
                              <Button variant="danger" className="p-2" onClick={() => deletePlan(plan.id)}>
                                <Trash2 size={15}/>
                              </Button>
                            </div>
                          </div>

                          {/* Reviews Schedule Grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-2">
                            {plan.reviews?.map(rev => {
                              const config = getReviewConfig(rev.review_number);
                              const isPastOrToday = rev.scheduled_date && rev.scheduled_date.split('T')[0] <= getTodayStr();

                              return (
                                <div 
                                  key={rev.id} 
                                  onClick={() => toggleReviewCompletion(plan.id, rev.id)}
                                  className={`p-3 rounded-xl border text-center cursor-pointer transition-all select-none ${
                                    rev.is_completed 
                                      ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' 
                                      : isPastOrToday 
                                        ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-300 ring-2 ring-amber-400/20' 
                                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                                  }`}
                                >
                                  <div className="text-lg mb-1">{rev.is_completed ? '✅' : config.icon}</div>
                                  <span className="text-[11px] font-bold block truncate">{config.title.split(':')[0]}</span>
                                  <span className="text-[10px] block opacity-80 mt-0.5">{formatDate(rev.scheduled_date)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </Card>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* High-Yield Mistakes Tracker View */}
            {currentRoute === 'highyield_track' && (
              <div className="space-y-6 max-w-4xl animate-in fade-in">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h2 className="text-3xl font-bold">🎯 High-Yield Mistakes Tracker</h2>
                    <p className="text-sm text-slate-500 mt-1">Questions and cases you missed are automatically captured here for targeted revision.</p>
                  </div>
                  {mistakes.length > 0 && (
                    <Button 
                      variant="danger" 
                      onClick={() => {
                        if (confirm("Clear all recorded mistakes?")) {
                          localStorage.setItem('medos_mistakes', '[]');
                          setMistakes([]);
                        }
                      }}
                      className="text-xs"
                    >
                      <Trash2 size={14} className="mr-1.5"/> Clear All Mistakes
                    </Button>
                  )}
                </div>

                {mistakes.length === 0 ? (
                  <Card className="p-12 text-center space-y-3 dark:bg-slate-900 border-dashed">
                    <CheckCircle className="mx-auto text-emerald-500" size={40}/>
                    <h3 className="font-bold text-lg">No Mistakes Logged Yet</h3>
                    <p className="text-sm text-slate-500 max-w-sm mx-auto">
                      As you practice MCQs and clinical cases in the Study Hub, any missed concepts will automatically be tracked here for active recall.
                    </p>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {mistakes.map((m, idx) => (
                      <Card key={m.id || idx} className="p-5 dark:bg-slate-900 border-l-4 border-l-rose-500 border-slate-200 dark:border-slate-800 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400">
                            {m.topic || "Core Medicine"}
                          </span>
                          <span className="text-xs text-slate-400">{formatDate(m.timestamp)}</span>
                        </div>
                        <h4 className="font-bold text-base text-slate-900 dark:text-white leading-relaxed">
                          {m.concept || "Question details"}
                        </h4>
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs space-y-1">
                          {m.user_answer && <p className="text-rose-600 font-medium">Your Answer: {m.user_answer}</p>}
                          {m.correct_answer && <p className="text-emerald-600 font-bold">Correct Answer: {m.correct_answer}</p>}
                          {m.explanation && <p className="text-slate-600 dark:text-slate-300 pt-1 leading-relaxed">{m.explanation}</p>}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Settings View */}
            {currentRoute === 'settings' && (
              <div className="space-y-6 max-w-xl animate-in fade-in">
                <div>
                  <h2 className="text-3xl font-bold">Settings & API Configuration</h2>
                  <p className="text-sm text-slate-500 mt-1">Configure your Gemini AI token and study preferences.</p>
                </div>
                <Card className="p-6 space-y-4 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <h3 className="font-bold flex items-center gap-2 text-base"><Key className="text-teal-600"/> Gemini API Key</h3>
                  <p className="text-xs text-slate-500">Your key is stored securely in your browser's LocalStorage and used directly for client-side AI requests.</p>
                  <input 
                    type="password" 
                    value={apiKey} 
                    onChange={e => { setApiKey(e.target.value); localStorage.setItem('medos_api_key', e.target.value); }} 
                    placeholder="Enter API Key"
                    className="w-full border p-3 rounded-xl dark:bg-slate-800 dark:border-slate-700 text-sm outline-none focus:border-teal-500" 
                  />
                  <Button variant="primary" onClick={() => alert("Settings saved successfully.")} className="bg-teal-600 w-full font-bold">
                    Save Key
                  </Button>
                </Card>
              </div>
            )}

          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}