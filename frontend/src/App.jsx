import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  UploadCloud, FileText, BrainCircuit, HelpCircle, Stethoscope, BookOpen, 
  Trash2, Loader2, Play, CheckCircle, AlertTriangle, ChevronRight, 
  Flame, Home, Plus, Settings, CheckSquare, Moon, Sun, 
  CalendarDays, X, Edit, Pause, RotateCcw, Clock, Minus, Activity, Key
} from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Button, Card, ErrorBoundary } from './components/ui';
import { AnkiWorkspace, MCQRenderer, ClinicalCaseRenderer, SmartSummaryRenderer } from './components/renderers';
import MedPatientView from './components/MedPatientView';

const getTodayStr = () => {
  const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
};

const formatDate = (isoString) => {
  if (!isoString) return '';
  return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const getReviewConfig = (num) => {
  const configs = {
    0: { title: "Initial Learning", icon: "🟣" },
    1: { title: "Active Recall", icon: "🧠" },
    2: { title: "Recall + Weak Points", icon: "🧠" },
    3: { title: "Consolidation", icon: "🔗" },
    4: { title: "Long-Term Recall", icon: "🧠" },
    5: { title: "Retention", icon: "🏆" },
    6: { title: "Maintenance", icon: "🛠️" }
  };
  return configs[num] || configs[6];
};

const FocusTimerOverlay = React.memo(({ task, onClose }) => {
  const [stage, setStage] = useState('select'); 
  const [durationMs, setDurationMs] = useState(25 * 60 * 1000);
  const [remainingMs, setRemainingMs] = useState(25 * 60 * 1000);
  const [isRunning, setIsRunning] = useState(false);
  const [isEditingCustom, setIsEditingCustom] = useState(false);
  const [customHours, setCustomHours] = useState(0);
  const [customMinutes, setCustomMinutes] = useState(0);

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
    setDurationMs(ms); setRemainingMs(ms); setStage('running'); setIsRunning(true);
  }, []);

  const adjustTime = useCallback((minutes) => {
    const deltaMs = minutes * 60 * 1000;
    setRemainingMs(prev => {
      const next = Math.max(0, prev + deltaMs);
      if (isRunning) endTimeRef.current = Date.now() + next;
      return next;
    });
  }, [isRunning]);

  const { h, m, s } = useMemo(() => {
    const totalS = Math.floor(remainingMs / 1000);
    return {
      h: Math.floor(totalS / 3600).toString().padStart(2, '0'),
      m: Math.floor((totalS % 3600) / 60).toString().padStart(2, '0'),
      s: (totalS % 60).toString().padStart(2, '0')
    };
  }, [remainingMs]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 animate-in fade-in" dir="ltr">
      <div className="absolute top-8 text-center px-4 w-full">
         <p className="text-slate-500 font-bold tracking-widest uppercase text-sm mb-2">Focus Mode</p>
         <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white max-w-4xl mx-auto truncate">{task.title}</h2>
      </div>

      {stage === 'select' && (
        <div className="flex flex-col items-center space-y-8 mt-12 w-full max-w-3xl">
           <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-4">Choose Duration</h3>
           <div className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full">
              {[15, 25, 30, 45, 60, 90].map(mins => (
                <Button key={mins} variant="secondary" className="py-8 text-xl font-bold bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 hover:border-teal-500" onClick={() => startTimer(mins * 60000)}>{mins} min</Button>
              ))}
           </div>
           <Button variant="ghost" onClick={onClose} className="mt-8 text-slate-500">Cancel & Go Back</Button>
        </div>
      )}

      {stage === 'running' && (
        <div className="flex flex-col items-center w-full max-w-4xl mt-12 space-y-12">
           <div className="flex gap-4 md:gap-8 items-center justify-center text-7xl md:text-9xl font-mono font-bold tracking-tighter">
              <div className="relative bg-slate-800 dark:bg-slate-900 text-white rounded-3xl w-28 md:w-48 h-36 md:h-64 flex flex-col items-center justify-center shadow-2xl"><span>{h}</span></div>:
              <div className="relative bg-slate-800 dark:bg-slate-900 text-white rounded-3xl w-28 md:w-48 h-36 md:h-64 flex flex-col items-center justify-center shadow-2xl"><span>{m}</span></div>:
              <div className="relative bg-slate-800 dark:bg-slate-900 text-teal-400 rounded-3xl w-28 md:w-48 h-36 md:h-64 flex flex-col items-center justify-center shadow-2xl"><span>{s}</span></div>
           </div>
           <div className="flex gap-4">
              {isRunning ? (
                 <Button variant="secondary" className="bg-amber-100 text-amber-800 px-8 py-4 text-lg font-bold" onClick={() => setIsRunning(false)}><Pause size={20} className="mr-2"/> Pause</Button>
              ) : (
                 <Button variant="primary" className="bg-emerald-600 px-8 py-4 text-lg font-bold" onClick={() => setIsRunning(true)}><Play size={20} className="mr-2"/> Resume</Button>
              )}
              <Button variant="secondary" className="px-8 py-4 text-lg font-bold" onClick={() => { setIsRunning(false); setRemainingMs(durationMs); }}><RotateCcw size={20} className="mr-2"/> Reset</Button>
              <Button variant="ghost" className="px-8 py-4 text-lg font-bold text-slate-500 hover:text-rose-500" onClick={onClose}><X size={20} className="mr-2"/> Exit</Button>
           </div>
        </div>
      )}

      {stage === 'completed' && (
        <div className="flex flex-col items-center text-center space-y-8">
           <div className="w-24 h-24 bg-emerald-100 text-emerald-600 flex items-center justify-center rounded-full"><CheckCircle size={48} /></div>
           <h2 className="text-4xl font-bold text-slate-900 dark:text-white">🎉 Focus Session Complete</h2>
           <Button variant="primary" className="bg-slate-900 dark:bg-teal-600 px-8 py-4" onClick={onClose}>Back to Tasks</Button>
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

  const [file, setFile] = useState(null);
  const [pdfText, setPdfText] = useState('');
  const [selectedTask, setSelectedTask] = useState('mcqs');
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [normalizedData, setNormalizedData] = useState(null);

  // LocalStorage states for full persistence
  const [tasks, setTasks] = useState(JSON.parse(localStorage.getItem('medos_tasks') || '[]'));
  const [plans, setPlans] = useState(JSON.parse(localStorage.getItem('medos_plans') || '[]'));
  const [mistakes, setMistakes] = useState(JSON.parse(localStorage.getItem('medos_mistakes') || '[]'));

  const [settings, setSettings] = useState({ mcqCount: '5', maxPages: '8' });
  const [newTaskInput, setNewTaskInput] = useState('');
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

  const saveApiKey = () => {
    if (tempKeyInput.trim()) {
      localStorage.setItem('medos_api_key', tempKeyInput.trim());
      setApiKey(tempKeyInput.trim());
      setShowApiKeyModal(false);
    } else {
      alert("Please enter a valid API Key.");
    }
  };

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;
    setFile(uploadedFile);
    setNormalizedData(null);
    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = (event) => setPdfText(event.target.result || "Lecture notes content.");
    reader.readAsText(uploadedFile);
  };

  const handleGenerate = async () => {
    if (!apiKey) { setShowApiKeyModal(true); return; }
    setIsGenerating(true);
    setErrorMsg(null);

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      let prompt = "";
      if (selectedTask === 'mcqs') {
        prompt = `Generate ${settings.mcqCount} USMLE-style Multiple Choice Questions based on: ${pdfText || 'Medical Study'}. Return strictly valid JSON array format: [{"question": "...", "choices": ["A", "B", "C", "D"], "correct": "A", "explanation": "...", "concept": "Cardiology"}]`;
      } else if (selectedTask === 'cases') {
        prompt = `Generate 5 USMLE clinical vignettes based on: ${pdfText || 'Clinical Case'}. Return strictly valid JSON array.`;
      } else if (selectedTask === 'summary') {
        prompt = `Explain this medical lecture in clear Egyptian Arabic medical style with English terms based on: ${pdfText || 'Lecture'}. Return valid JSON object.`;
      } else {
        prompt = `Generate high-yield Anki flashcards for ${selectedTask} based on: ${pdfText || 'Lecture'}. Return valid JSON array.`;
      }

      const result = await model.generateContent(prompt);
      const cleaned = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
      const data = JSON.parse(cleaned);
      setNormalizedData(Array.isArray(data) ? data : [data]);
    } catch (err) {
      setErrorMsg("Generation error: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const addStudyPlanLocally = () => {
    if (!newLecture.trim()) return;
    const baseDate = new Date();
    const reviews = [0, 1, 3, 7, 14, 30, 60].map((days, idx) => ({
      id: Date.now() + idx,
      review_number: idx,
      scheduled_date: new Date(baseDate.getTime() + days * 86400000).toISOString(),
      is_completed: false
    }));

    setPlans([...plans, {
      id: Date.now(),
      name: newLecture,
      module_name: newModule || 'General',
      subject_name: newSubject || 'General',
      study_date: baseDate.toISOString(),
      reviews: reviews
    }]);
    setNewLecture(''); setNewModule(''); setNewSubject('');
  };

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
    { id: 'mcqs', name: 'MCQ Engine', desc: 'Generate high-yield active-recall MCQs.', icon: <HelpCircle size={28} /> },
    { id: 'cases', name: 'Clinical Cases', desc: 'USMLE-style clinical vignettes.', icon: <Stethoscope size={28} /> },
    { id: 'summary', name: 'Smart Summary', desc: 'Lecture explained in Egyptian Arabic.', icon: <BookOpen size={28} /> },
    { id: 'anki', name: 'Anki Flashcards', desc: 'Active recall flashcards for retention.', icon: <BrainCircuit size={28} /> },
  ];

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans" dir="ltr">
      {showApiKeyModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <Card className="p-6 w-full max-w-md shadow-2xl dark:bg-slate-900">
            <h3 className="text-xl font-bold mb-2 flex items-center gap-2"><Key className="text-teal-600"/> Gemini API Key Setup</h3>
            <p className="text-sm text-slate-500 mb-4">Enter your Gemini API Key for direct client-side generation.</p>
            <input type="password" placeholder="AIzaSy..." value={tempKeyInput} onChange={e => setTempKeyInput(e.target.value)} className="w-full border p-3 rounded-xl dark:bg-slate-800 mb-4 outline-none dark:border-slate-700 dark:text-white" />
            <Button variant="primary" onClick={saveApiKey} className="w-full bg-teal-600">Save Key</Button>
          </Card>
        </div>
      )}

      <aside className="w-[260px] bg-white dark:bg-slate-900 border-r dark:border-slate-800 flex-col justify-between hidden md:flex shrink-0">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3"><div className="bg-teal-600 text-white p-2 rounded-xl"><Stethoscope size={20}/></div><h1 className="font-bold text-base">MedOS</h1></div>
            <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800">{theme === 'light' ? <Moon size={18}/> : <Sun size={18}/>}</button>
          </div>
          <nav className="space-y-1">
            {navItems.map(item => (
              <button key={item.id} onClick={() => setCurrentRoute(item.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-colors ${currentRoute === item.id ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 font-bold' : 'text-slate-600 dark:text-slate-400'}`}>
                {item.icon} {item.label}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6 md:p-12">
        <div className="max-w-[1100px] mx-auto">
          {currentRoute === 'dashboard' && (
            <div className="space-y-8">
              <h2 className="text-3xl font-bold">Welcome Back 👋</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-6 bg-teal-50 dark:bg-teal-900/20"><h3 className="text-3xl font-bold text-teal-700">{tasks.filter(t=>!t.is_completed).length}</h3><p>Pending Tasks</p></Card>
                <Card className="p-6 bg-blue-50 dark:bg-blue-900/20"><h3 className="text-3xl font-bold text-blue-700">{plans.length}</h3><p>Study Plans</p></Card>
                <Card className="p-6 bg-rose-50 dark:bg-rose-900/20"><h3 className="text-3xl font-bold text-rose-700">{mistakes.length}</h3><p>Mistakes Tracked</p></Card>
              </div>
            </div>
          )}

          {currentRoute === 'study_hub' && (
            <div className="space-y-8">
              <h2 className="text-3xl font-bold">📚 Study Tools</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {tools.map(t => (
                  <Card key={t.id} onClick={() => { setSelectedTask(t.id); setCurrentRoute('study'); }} className="p-6 cursor-pointer hover:border-teal-500 dark:bg-slate-900">
                    <div className="text-teal-600 mb-4">{t.icon}</div>
                    <h3 className="font-bold text-xl mb-2">{t.name}</h3>
                    <p className="text-sm text-slate-500">{t.desc}</p>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {currentRoute === 'study' && (
            <div className="space-y-6 max-w-4xl">
              <div className="flex items-center gap-4"><Button variant="ghost" onClick={() => setCurrentRoute('study_hub')}><ChevronRight className="rotate-180"/></Button><h2 className="text-3xl font-bold capitalize">{selectedTask} Generator</h2></div>
              {!file ? (
                <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-2xl cursor-pointer bg-white dark:bg-slate-900 dark:border-slate-700">
                  <UploadCloud size={32} className="text-teal-600 mb-2"/>
                  <span className="text-sm font-semibold">Upload Study Material</span>
                  <input type="file" className="hidden" onChange={handleFileUpload} />
                </label>
              ) : (
                <Card className="p-4 flex justify-between items-center bg-teal-50 dark:bg-teal-900/20">
                  <span>{file.name}</span>
                  <Button variant="danger" onClick={()=>setFile(null)}>Remove</Button>
                </Card>
              )}
              {file && (
                <Button variant="primary" onClick={handleGenerate} disabled={isGenerating} className="w-full bg-teal-600 py-4 font-bold">
                  {isGenerating ? <Loader2 className="animate-spin mr-2"/> : <Play className="mr-2"/>} Generate Content with AI
                </Button>
              )}
              {errorMsg && <div className="p-4 bg-rose-50 text-rose-600 rounded-xl">{errorMsg}</div>}
              {normalizedData && (
                <div className="space-y-4">
                  {normalizedData.map((item, idx) => (
                    <Card key={idx} className="p-6 dark:bg-slate-900">
                      <h4 className="font-bold text-lg text-teal-600 mb-3">Item #{idx+1}</h4>
                      <pre className="whitespace-pre-wrap font-sans text-sm dark:text-slate-300">{JSON.stringify(item, null, 2)}</pre>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {currentRoute === 'medpatient' && <MedPatientView apiKey={apiKey} />}

          {currentRoute === 'tasks' && (
            <div className="space-y-6 max-w-3xl">
              <h2 className="text-3xl font-bold">Tasks Management</h2>
              <div className="flex gap-4">
                <input type="text" placeholder="Add task..." value={newTaskInput} onChange={e=>setNewTaskInput(e.target.value)} className="flex-1 p-3 border rounded-xl dark:bg-slate-900 dark:border-slate-700 dark:text-white outline-none" />
                <Button variant="primary" onClick={() => { if(newTaskInput.trim()) { setTasks([...tasks, {id: Date.now(), title: newTaskInput, is_completed: false}]); setNewTaskInput(''); } }} className="bg-teal-600">Add</Button>
              </div>
              <div className="space-y-3">
                {tasks.map(t => (
                  <Card key={t.id} className="p-4 flex justify-between items-center dark:bg-slate-900">
                    <span className={t.is_completed ? 'line-through text-slate-400' : 'font-bold'}>{t.title}</span>
                    <Button variant="danger" onClick={()=>setTasks(tasks.filter(x => x.id !== t.id))}><Trash2 size={16}/></Button>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {currentRoute === 'planner' && (
            <div className="space-y-6 max-w-4xl">
              <h2 className="text-3xl font-bold">Spaced Repetition Planner</h2>
              <Card className="p-6 space-y-4 dark:bg-slate-900">
                <input type="text" placeholder="Lecture Name" value={newLecture} onChange={e=>setNewLecture(e.target.value)} className="w-full p-3 border rounded-xl dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none"/>
                <Button variant="primary" onClick={addStudyPlanLocally} className="bg-teal-600">Create Plan</Button>
              </Card>
            </div>
          )}

          {currentRoute === 'highyield_track' && (
            <div className="space-y-6 max-w-3xl">
              <h2 className="text-3xl font-bold">High-Yield Tracker</h2>
              <Card className="p-6 dark:bg-slate-900 border-dashed"><p className="text-sm text-slate-500">Tracked mistakes will appear here as you practice.</p></Card>
            </div>
          )}

          {currentRoute === 'settings' && (
            <div className="space-y-6 max-w-xl">
              <h2 className="text-3xl font-bold">Settings</h2>
              <Card className="p-6 space-y-4 dark:bg-slate-900">
                <h3 className="font-bold flex items-center gap-2"><Key className="text-teal-600"/> Gemini API Key</h3>
                <input type="password" value={apiKey} onChange={e => { setApiKey(e.target.value); localStorage.setItem('medos_api_key', e.target.value); }} className="w-full border p-3 rounded-xl dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none" />
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}