import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  UploadCloud, FileText, BrainCircuit, HelpCircle, Stethoscope, BookOpen, 
  Trash2, Loader2, Play, CheckCircle, AlertTriangle, ChevronRight, 
  Flame, Home, Plus, Settings, CheckSquare, Moon, Sun, 
  CalendarDays, X, Edit, Pause, RotateCcw, Clock, Minus, Activity, Key
} from 'lucide-react';
import { NormalizationEngine } from './utils/normalization';
import { Button, Card, ErrorBoundary } from './components/ui';
import { AnkiWorkspace, MCQRenderer, ClinicalCaseRenderer, SmartSummaryRenderer } from './components/renderers';
import MedPatientView from './components/MedPatientView';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

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

  const applyCustomEdit = useCallback(() => {
    const ms = (parseInt(customHours || 0) * 3600000) + (parseInt(customMinutes || 0) * 60000);
    if(ms > 0) { setRemainingMs(ms); if (isRunning) endTimeRef.current = Date.now() + ms; }
    setIsEditingCustom(false);
  }, [customHours, customMinutes, isRunning]);

  const { h, m, s } = useMemo(() => {
    const totalS = Math.floor(remainingMs / 1000);
    return {
      h: Math.floor(totalS / 3600).toString().padStart(2, '0'),
      m: Math.floor((totalS % 3600) / 60).toString().padStart(2, '0'),
      s: (totalS % 60).toString().padStart(2, '0')
    };
  }, [remainingMs]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in-95" dir="ltr">
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
           <div className="w-full flex items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-800">
             <span className="font-bold text-slate-700 dark:text-slate-300">Custom:</span>
             <input type="number" min="0" placeholder="HH" className="p-3 border rounded-xl w-24 bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white text-center font-bold outline-none" onChange={e => setCustomHours(e.target.value)} />
             <span className="font-bold text-slate-500">:</span>
             <input type="number" min="0" placeholder="MM" className="p-3 border rounded-xl w-24 bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white text-center font-bold outline-none" onChange={e => setCustomMinutes(e.target.value)} />
             <Button variant="primary" className="bg-teal-600 ml-auto" onClick={() => startTimer((customHours * 3600000) + (customMinutes * 60000))}>Start Custom</Button>
           </div>
           <Button variant="ghost" onClick={onClose} className="mt-8 text-slate-500">Cancel & Go Back</Button>
        </div>
      )}

      {stage === 'running' && (
        <div className="flex flex-col items-center w-full max-w-4xl mt-12 space-y-12">
           {!isEditingCustom ? (
             <div className="flex gap-4 md:gap-8 items-center justify-center text-7xl md:text-9xl font-mono font-bold tracking-tighter">
                <div className="relative bg-slate-800 dark:bg-slate-900 text-white rounded-2xl md:rounded-3xl w-28 md:w-48 h-36 md:h-64 flex flex-col items-center justify-center shadow-2xl border-b-4 md:border-b-8 border-slate-950 overflow-hidden">
                  <span className="z-10 relative">{h}</span><div className="absolute inset-0 h-1/2 bg-black/10 border-b-2 border-black/40"></div><span className="absolute bottom-2 text-xs md:text-sm text-slate-400 font-sans tracking-widest uppercase z-10">Hours</span>
                </div><span className="text-slate-400 dark:text-slate-600 animate-pulse">:</span>
                <div className="relative bg-slate-800 dark:bg-slate-900 text-white rounded-2xl md:rounded-3xl w-28 md:w-48 h-36 md:h-64 flex flex-col items-center justify-center shadow-2xl border-b-4 md:border-b-8 border-slate-950 overflow-hidden">
                  <span className="z-10 relative">{m}</span><div className="absolute inset-0 h-1/2 bg-black/10 border-b-2 border-black/40"></div><span className="absolute bottom-2 text-xs md:text-sm text-slate-400 font-sans tracking-widest uppercase z-10">Minutes</span>
                </div><span className="text-slate-400 dark:text-slate-600 animate-pulse">:</span>
                <div className="relative bg-slate-800 dark:bg-slate-900 text-teal-400 rounded-2xl md:rounded-3xl w-28 md:w-48 h-36 md:h-64 flex flex-col items-center justify-center shadow-2xl border-b-4 md:border-b-8 border-slate-950 overflow-hidden">
                  <span className="z-10 relative">{s}</span><div className="absolute inset-0 h-1/2 bg-black/10 border-b-2 border-black/40"></div><span className="absolute bottom-2 text-xs md:text-sm text-teal-700 font-sans tracking-widest uppercase z-10">Seconds</span>
                </div>
             </div>
           ) : (
             <div className="flex gap-4 items-center justify-center bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-xl border dark:border-slate-800">
               <input type="number" min="0" value={customHours} onChange={e => setCustomHours(e.target.value)} className="w-32 h-32 text-center text-6xl font-bold bg-slate-100 dark:bg-slate-800 dark:text-white rounded-2xl outline-none focus:ring-4 focus:ring-teal-500" />
               <span className="text-4xl font-bold text-slate-400">:</span>
               <input type="number" min="0" value={customMinutes} onChange={e => setCustomMinutes(e.target.value)} className="w-32 h-32 text-center text-6xl font-bold bg-slate-100 dark:bg-slate-800 dark:text-white rounded-2xl outline-none focus:ring-4 focus:ring-teal-500" />
               <Button variant="primary" className="h-32 px-8 text-xl bg-teal-600 rounded-2xl ml-4" onClick={applyCustomEdit}>Apply</Button>
             </div>
           )}

           {!isEditingCustom && (
             <div className="flex gap-4">
                <Button variant="secondary" onClick={() => adjustTime(-5)} className="px-6 py-3 font-bold bg-slate-200 dark:bg-slate-800 hover:bg-slate-300"><Minus size={18} className="mr-2"/> 5 min</Button>
                <Button variant="secondary" onClick={() => { setIsRunning(false); setCustomHours(Math.floor(remainingMs/3600000)); setCustomMinutes(Math.floor((remainingMs%3600000)/60000)); setIsEditingCustom(true); }} className="px-6 py-3 font-bold bg-slate-200 dark:bg-slate-800 hover:bg-slate-300"><Edit size={18} className="mr-2"/> Edit Time</Button>
                <Button variant="secondary" onClick={() => adjustTime(5)} className="px-6 py-3 font-bold bg-slate-200 dark:bg-slate-800 hover:bg-slate-300"><Plus size={18} className="mr-2"/> 5 min</Button>
             </div>
           )}

           <div className="flex gap-4">
              {isRunning ? (
                 <Button variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 px-8 py-4 text-lg font-bold" onClick={() => setIsRunning(false)}><Pause size={20} className="mr-2"/> Pause</Button>
              ) : (
                 <Button variant="primary" className="bg-emerald-600 px-8 py-4 text-lg font-bold" onClick={() => setIsRunning(true)}><Play size={20} className="mr-2"/> Resume</Button>
              )}
              <Button variant="secondary" className="px-8 py-4 text-lg font-bold" onClick={() => { setIsRunning(false); setRemainingMs(durationMs); }}><RotateCcw size={20} className="mr-2"/> Reset</Button>
              <Button variant="ghost" className="px-8 py-4 text-lg font-bold text-slate-500 hover:text-rose-500" onClick={onClose}><X size={20} className="mr-2"/> Exit Focus</Button>
           </div>
        </div>
      )}

      {stage === 'completed' && (
        <div className="flex flex-col items-center text-center space-y-8 animate-in zoom-in">
           <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center rounded-full mb-4"><CheckCircle size={48} /></div>
           <h2 className="text-4xl font-bold text-slate-900 dark:text-white">🎉 Focus Session Complete</h2>
           <p className="text-xl text-slate-600 dark:text-slate-400 font-medium">Great job. Your study session is finished.</p>
           
           <div className="flex flex-col sm:flex-row gap-4 mt-8 w-full max-w-xl">
             <Button variant="secondary" className="flex-1 py-4 font-bold bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/20 dark:border-teal-800 hover:bg-teal-100" onClick={() => startTimer(5 * 60000)}>+ 5 min</Button>
             <Button variant="secondary" className="flex-1 py-4 font-bold bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/20 dark:border-teal-800 hover:bg-teal-100" onClick={() => startTimer(10 * 60000)}>+ 10 min</Button>
             <Button variant="primary" className="flex-1 py-4 font-bold bg-slate-900 dark:bg-slate-800" onClick={() => setStage('select')}>Start Another</Button>
           </div>
           <Button variant="ghost" className="text-slate-500 mt-4 font-bold" onClick={onClose}>Back to Tasks</Button>
        </div>
      )}
    </div>
  );
});

const HighYieldTrackerView = ({ onGenerateMistakes }) => {
  const [mistakes, setMistakes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    let isMounted = true;
    fetch(`${API_URL}/api/high-yield/mistakes`).then(res => res.json()).then(data => { if(isMounted && data.success) { setMistakes(data.data || []); setLoading(false); } }).catch(() => { if(isMounted) setLoading(false); });
    return () => { isMounted = false; };
  }, []);

  const handleGenerate = () => {
     if(mistakes.length === 0) { alert("لا توجد أخطاء مسجلة بعد."); return; }
     const mistakesText = mistakes.map(m => `- Topic: ${m.topic}, Concept: ${m.concept}`).join("\n");
     onGenerateMistakes(mistakesText);
  };

  return (
    <div className="space-y-8 animate-in fade-in max-w-4xl">
      <div className="flex justify-between items-center">
         <div>
           <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 flex items-center"><Flame className="mr-3 text-rose-500" size={32}/> High-Yield Review</h2>
           <p className="text-slate-500 dark:text-slate-400 text-sm">Personalized review of your most frequent MCQ mistakes.</p>
         </div>
         <Button className="bg-rose-600 hover:bg-rose-700 text-white" onClick={handleGenerate}><BrainCircuit className="mr-2" size={16}/> Test My Mistakes</Button>
      </div>
      {loading ? <div className="flex justify-center p-10"><Loader2 className="animate-spin text-teal-600" size={32}/></div> : mistakes.length === 0 ? <Card className="text-center p-10 bg-slate-50 dark:bg-slate-900 border-dashed dark:border-slate-700"><p className="font-semibold text-slate-700 dark:text-slate-300">Your High-Yield list will build as you practice MCQs.</p></Card> : (
        <div className="space-y-4">
          {mistakes.map((m, idx) => (
            <Card className="p-6 border-l-4 border-l-rose-500 dark:bg-slate-800 dark:border-slate-700" key={idx}><h3 className="font-bold text-lg mb-1 text-slate-800 dark:text-slate-100">{m.priority_label}</h3><p className="text-slate-700 dark:text-slate-300 font-medium mb-1">{m.topic} — {m.concept}</p><p className="text-sm text-rose-500 font-semibold">You missed this {m.mistakeCount} times.</p></Card>
          ))}
        </div>
      )}
    </div>
  );
};

const TasksView = () => {
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState("");
  const [dueDate, setDueDate] = useState(getTodayStr());
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeFocusTask, setActiveFocusTask] = useState(null); 

  const fetchTasks = useCallback(() => {
    fetch(`${API_URL}/api/tasks`).then(r => r.json()).then(data => { if(data.success) setTasks(data.data || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);
  
  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleAddTask = async () => {
    if(!newTask.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await fetch(`${API_URL}/api/tasks/add`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: newTask, due_date: dueDate, priority: "Normal", category: "Study" }) });
      setNewTask(""); fetchTasks();
    } catch(e) { console.error(e); } finally { setIsSubmitting(false); }
  };

  const toggleTask = async (id, is_completed) => {
    await fetch(`${API_URL}/api/tasks/update`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task_id: id, is_completed: !is_completed }) });
    fetchTasks();
  };

  const deleteTask = async (id) => { await fetch(`${API_URL}/api/tasks/${id}`, { method: 'DELETE' }); fetchTasks(); };

  const pendingTasks = tasks.filter(t => !t.is_completed);

  return (
    <>
      {activeFocusTask && <FocusTimerOverlay task={activeFocusTask} onClose={() => setActiveFocusTask(null)} />}
      <div className="space-y-8 animate-in fade-in max-w-4xl">
        <div><h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-2 flex items-center"><CheckSquare className="mr-3 text-teal-600" size={32} /> Tasks</h2><p className="text-slate-500 dark:text-slate-400 text-sm">Manage your daily study tasks and track your focus.</p></div>
        <Card className="p-6 bg-slate-50 dark:bg-slate-900 border-dashed dark:border-slate-700">
          <div className="flex flex-col md:flex-row gap-4">
            <input type="text" placeholder="Add new task" value={newTask} onChange={e=>setNewTask(e.target.value)} className="flex-1 p-3 rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-teal-500" />
            <div className="flex items-center gap-3">
              <input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} className="p-3 rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white outline-none" />
              <Button variant="primary" disabled={isSubmitting} className="bg-teal-600 px-6" onClick={handleAddTask}>Add Task</Button>
            </div>
          </div>
        </Card>
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white border-b dark:border-slate-800 pb-2">Pending Tasks</h3>
          {loading ? <Loader2 className="animate-spin text-teal-600 mx-auto" /> : pendingTasks.length === 0 ? <p className="text-slate-500">No pending tasks.</p> : (
            pendingTasks.map(t => (
              <Card key={t.id} className="p-4 flex justify-between items-center bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-4 flex-1">
                  <button onClick={() => toggleTask(t.id, t.is_completed)} className="w-6 h-6 rounded border-2 border-slate-300 dark:border-slate-600 hover:border-teal-500 transition-colors shrink-0"></button>
                  <div><h4 className="font-bold text-slate-800 dark:text-slate-100 text-lg">{t.title}</h4><div className="flex gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400"><span>📅 {t.due_date}</span></div></div>
                </div>
                <div className="flex items-center gap-2">
                   <Button variant="primary" className="bg-slate-900 dark:bg-teal-600 text-sm py-1.5 px-4" onClick={() => setActiveFocusTask(t)}><Clock size={14} className="mr-2"/> Focus</Button>
                   <button onClick={() => deleteTask(t.id)} className="text-slate-400 hover:text-rose-500 p-2"><Trash2 size={18}/></button>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </>
  );
};

const PlannerView = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('schedule'); 
  const [newLecture, setNewLecture] = useState("");
  const [newModule, setNewModule] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [editingPlan, setEditingPlan] = useState(null); 
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchPlans = useCallback(() => { 
    fetch(`${API_URL}/api/planner/plans`).then(res => res.json()).then(data => { if(data.success) setPlans(data.data || []); setLoading(false); }).catch(() => setLoading(false)); 
  }, []);
  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const handleAddPlan = async () => {
    if(!newLecture.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/planner/add`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newLecture, module: newModule.trim() || "General", subject: newSubject.trim() || "General" }) });
      if((await res.json()).success) { setNewLecture(""); setNewModule(""); setNewSubject(""); fetchPlans(); setActiveTab('schedule'); }
    } catch (e) { console.error(e); } finally { setIsSubmitting(false); }
  };

  const handleUpdatePlan = async () => {
    if(!editingPlan || !editingPlan.name.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/planner/update`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan_id: editingPlan.id, name: editingPlan.name, module: editingPlan.module_name || "General", subject: editingPlan.subject_name || "General" }) });
      if((await res.json()).success) { setEditingPlan(null); fetchPlans(); }
    } catch (e) { console.error(e); } finally { setIsSubmitting(false); }
  };

  const handleDeletePlan = async (plan_id) => {
    if(!window.confirm("Are you sure you want to delete this lecture and its entire review schedule?")) return;
    try { await fetch(`${API_URL}/api/planner/plans/${plan_id}`, { method: 'DELETE' }); fetchPlans(); } catch (e) { console.error(e); }
  };

  const submitRating = async (review_id, rating) => {
    await fetch(`${API_URL}/api/planner/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ review_id: review_id, rating: rating }) });
    fetchPlans();
  };

  const todayNormalized = new Date(); todayNormalized.setHours(0,0,0,0);
  
  const scheduleGroups = useMemo(() => {
    let all = [];
    plans.forEach(plan => {
      plan.reviews.forEach(rev => {
        if(!rev.is_completed) {
          const d = new Date(rev.scheduled_date); d.setHours(0,0,0,0);
          all.push({ plan, review: rev, diff: (d - todayNormalized) / 86400000, dateObj: d });
        }
      });
    });
    all.sort((a,b) => a.dateObj - b.dateObj);
    const groups = {};
    all.forEach(item => {
       let key = formatDate(item.review.scheduled_date);
       if (item.diff === 0) key = `TODAY — ${key}`;
       else if (item.diff === 1) key = `TOMORROW — ${key}`;
       else if (item.diff < 0) key = `OVERDUE (Needs Review)`;
       if(!groups[key]) groups[key] = [];
       groups[key].push(item);
    });
    return groups;
  }, [plans]);

  return (
    <div className="space-y-10 animate-in fade-in max-w-5xl" dir="ltr">
      {editingPlan && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
           <Card className="p-6 bg-white dark:bg-slate-900 w-full max-w-md animate-in zoom-in-95 border-slate-200 dark:border-slate-800">
              <h3 className="text-xl font-bold mb-4 dark:text-white">Edit Lecture</h3>
              <div className="space-y-4">
                 <div><label className="text-sm font-bold text-slate-500">Lecture Name</label><input type="text" value={editingPlan.name} onChange={e=>setEditingPlan({...editingPlan, name: e.target.value})} className="w-full p-2.5 mt-1 rounded-lg border dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none"/></div>
                 <div><label className="text-sm font-bold text-slate-500">Module</label><input type="text" value={editingPlan.module_name} onChange={e=>setEditingPlan({...editingPlan, module_name: e.target.value})} className="w-full p-2.5 mt-1 rounded-lg border dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none"/></div>
                 <div><label className="text-sm font-bold text-slate-500">Subject</label><input type="text" value={editingPlan.subject_name} onChange={e=>setEditingPlan({...editingPlan, subject_name: e.target.value})} className="w-full p-2.5 mt-1 rounded-lg border dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none"/></div>
              </div>
              <div className="flex justify-end gap-3 mt-8">
                 <Button variant="ghost" onClick={()=>setEditingPlan(null)}>Cancel</Button>
                 <Button variant="primary" disabled={isSubmitting} className="bg-teal-600" onClick={handleUpdatePlan}>Save Changes</Button>
              </div>
           </Card>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div><h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center"><CalendarDays className="mr-3 text-teal-600" size={32} /> Spaced Repetition</h2></div>
        <div className="flex gap-2 p-1 bg-slate-200 dark:bg-slate-800 rounded-xl">
           <button onClick={()=>setActiveTab('schedule')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab==='schedule' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}>Global Schedule</button>
           <button onClick={()=>setActiveTab('lectures')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab==='lectures' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}>My Lectures</button>
        </div>
      </div>

      {loading ? <div className="text-center p-10"><Loader2 className="animate-spin text-teal-600 mx-auto" size={32}/></div> : (
        <>
          {activeTab === 'schedule' && (
             <div className="space-y-8 animate-in slide-in-from-bottom-4">
                <Card className="p-6 bg-slate-50 dark:bg-slate-900 border-dashed dark:border-slate-700">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <input type="text" placeholder="Lecture Name" value={newLecture} onChange={e=>setNewLecture(e.target.value)} className="col-span-2 p-3 rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white outline-none focus:border-teal-500" />
                    <input type="text" placeholder="Module" value={newModule} onChange={e=>setNewModule(e.target.value)} className="p-3 rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white outline-none focus:border-teal-500" />
                    <input type="text" placeholder="Subject" value={newSubject} onChange={e=>setNewSubject(e.target.value)} className="p-3 rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white outline-none focus:border-teal-500" />
                  </div>
                  <div className="mt-4 flex justify-end"><Button variant="primary" disabled={isSubmitting} className="bg-teal-600 px-8" onClick={handleAddPlan}>Add & Plan</Button></div>
                </Card>

                {Object.keys(scheduleGroups).length === 0 ? <p className="text-slate-500">No scheduled reviews.</p> : (
                   Object.keys(scheduleGroups).map(dateKey => (
                      <div key={dateKey} className="mb-8">
                         <h3 className={`text-sm font-bold uppercase tracking-widest mb-4 border-b pb-2 ${dateKey.includes('TODAY') ? 'text-amber-600 border-amber-200 dark:border-amber-900/50' : dateKey.includes('OVERDUE') ? 'text-rose-600 border-rose-200 dark:border-rose-900/50' : 'text-slate-500 border-slate-200 dark:border-slate-700'}`}>{dateKey}</h3>
                         <div className="space-y-4">
                            {scheduleGroups[dateKey].map((item, i) => {
                               const config = getReviewConfig(item.review.review_number);
                               return (
                                  <Card key={i} className={`p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-l-4 ${item.diff < 0 ? 'border-l-rose-500 bg-rose-50/30 dark:bg-rose-900/10' : item.diff === 0 ? 'border-l-amber-500 dark:bg-slate-800' : 'border-l-blue-500 dark:bg-slate-800'} dark:border-slate-700`}>
                                     <div>
                                        <p className="text-xs text-slate-500 font-bold mb-1 tracking-wider uppercase">{item.plan.subject_name} • {item.plan.module_name}</p>
                                        <h4 className="font-bold text-slate-900 dark:text-slate-100 text-lg mb-1">{item.plan.name}</h4>
                                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{config.icon} {config.title} (Review #{item.review.review_number + 1})</p>
                                     </div>
                                     {(item.diff <= 0) && (
                                        <div className="flex gap-2">
                                           <Button variant="secondary" className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 border-none" onClick={()=>submitRating(item.review.id, "Good")}>✓ Good</Button>
                                           <Button variant="secondary" className="bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-900/40 dark:text-orange-400 border-none" onClick={()=>submitRating(item.review.id, "Hard")}>! Hard</Button>
                                        </div>
                                     )}
                                  </Card>
                               )
                            })}
                         </div>
                      </div>
                   ))
                )}
             </div>
          )}

          {activeTab === 'lectures' && (
             <div className="space-y-4 animate-in slide-in-from-bottom-4">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">📖 All Lectures</h2>
                {plans.length === 0 ? <p className="text-slate-500">No lectures added yet.</p> : (
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {plans.map((p, idx) => {
                         const comp = p.reviews.filter(r=>r.is_completed).length;
                         return (
                           <Card key={idx} className="p-6 dark:bg-slate-800 dark:border-slate-700">
                             <div className="flex justify-between items-start mb-2">
                               <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{p.module_name} • {p.subject_name}</p>
                               <div className="flex gap-2">
                                 <button onClick={()=>setEditingPlan(p)} className="text-slate-400 hover:text-teal-600"><Edit size={16}/></button>
                                 <button onClick={()=>handleDeletePlan(p.id)} className="text-slate-400 hover:text-rose-500"><Trash2 size={16}/></button>
                               </div>
                             </div>
                             <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 truncate">{p.name}</h3>
                             <div className="flex gap-4 mt-4 text-sm text-slate-500 dark:text-slate-400 font-medium border-t dark:border-slate-700 pt-4">
                               <span>Started: {formatDate(p.study_date)}</span><span>Progress: {comp}/7</span>
                             </div>
                           </Card>
                         )
                      })}
                   </div>
                )}
             </div>
          )}
        </>
      )}
    </div>
  );
};

const DashboardView = ({ navigate }) => {
  const [plans, setPlans] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      fetch(`${API_URL}/api/planner/plans`).then(r => r.json()).catch(() => ({success: false, data: []})),
      fetch(`${API_URL}/api/tasks`).then(r => r.json()).catch(() => ({success: false, data: []}))
    ]).then(([plansData, tasksData]) => {
      if(isMounted) {
        if(plansData?.success) setPlans(plansData.data || []);
        if(tasksData?.success) setTasks(tasksData.data || []);
        setLoading(false);
      }
    });
    return () => { isMounted = false; };
  }, []);

  const todayStr = getTodayStr();
  const todayNormalized = new Date(); todayNormalized.setHours(0,0,0,0);

  const pendingTasks = tasks.filter(t => !t.is_completed);
  const todayTasks = pendingTasks.filter(t => t.due_date === todayStr);
  const overdueTasks = pendingTasks.filter(t => t.due_date && t.due_date < todayStr);

  let todayReviews = [];
  let overdueReviewsCount = 0;
  plans.forEach(plan => {
    plan.reviews.forEach(rev => {
      if(rev.is_completed) return;
      const d = new Date(rev.scheduled_date); d.setHours(0,0,0,0);
      const diff = (d - todayNormalized) / 86400000;
      if(diff <= 0) { todayReviews.push({ plan, review: rev }); if (diff < 0) overdueReviewsCount++; }
    });
  });

  const toggleTask = async (id, is_completed) => {
    await fetch(`${API_URL}/api/tasks/update`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task_id: id, is_completed: !is_completed }) });
    const res = await fetch(`${API_URL}/api/tasks`); const data = await res.json();
    if(data.success) setTasks(data.data || []);
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-teal-600" size={48}/></div>;

  return (
    <div className="space-y-10 animate-in fade-in">
      <div><h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">Welcome Back 👋</h2></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 bg-teal-50 dark:bg-teal-900/20 border-teal-100 dark:border-teal-800 text-center"><CalendarDays className="text-teal-600 dark:text-teal-400 mb-2 mx-auto" size={28}/><h3 className="text-3xl font-bold text-teal-800 dark:text-teal-300">{todayReviews.length}</h3><p className="text-teal-700 dark:text-teal-400 font-medium">Today's Reviews</p></Card>
        <Card className="p-6 bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800 text-center"><CheckSquare className="text-blue-600 dark:text-blue-400 mb-2 mx-auto" size={28}/><h3 className="text-3xl font-bold text-blue-800 dark:text-blue-300">{todayTasks.length}</h3><p className="text-blue-700 dark:text-blue-400 font-medium">Today's Tasks</p></Card>
        <Card className="p-6 bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800 text-center"><AlertTriangle className="text-rose-600 dark:text-rose-400 mb-2 mx-auto" size={28}/><h3 className="text-3xl font-bold text-rose-800 dark:text-rose-300">{overdueTasks.length + overdueReviewsCount}</h3><p className="text-rose-700 dark:text-rose-400 font-medium">Overdue Items</p></Card>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">📚 Due Today</h3>
          {todayReviews.length === 0 ? <p className="text-slate-500">No reviews required today.</p> : todayReviews.slice(0,5).map((r, i) => (
             <Card key={i} className="p-5 border-l-4 border-l-teal-500 dark:bg-slate-800 border-slate-200 dark:border-slate-700"><h4 className="font-bold text-lg text-slate-800 dark:text-slate-100">{r.plan.name}</h4><p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">Review #{r.review.review_number + 1}</p></Card>
          ))}
        </div>
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">✅ Today's Tasks</h3>
          {[...overdueTasks, ...todayTasks].length === 0 ? <p className="text-slate-500">No tasks for today.</p> : [...overdueTasks, ...todayTasks].map((tsk, i) => (
             <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${tsk.due_date < todayStr ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
               <button onClick={() => toggleTask(tsk.id, tsk.is_completed)} className="w-5 h-5 rounded border-2 border-slate-300 dark:border-slate-600 hover:border-teal-500"></button><span className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{tsk.title}</span>
             </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [currentRoute, setCurrentRoute] = useState('dashboard');
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  
  const [apiKey, setApiKey] = useState(localStorage.getItem('medos_api_key') || '');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [tempKeyInput, setTempKeyInput] = useState('');

  const [file, setFile] = useState(null);
  const [selectedTask, setSelectedTask] = useState('mcqs');
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [resultData, setResultData] = useState(null);
  const [normalizedData, setNormalizedData] = useState(null);
  
  const [settings, setSettings] = useState({ 
    mcqCount: '5', mcqDiff: 'USMLE Step 1', 
    caseCount: '5', caseDiff: 'USMLE Step 1', 
    ankiCount: '10', ankiType: 'Mixed', 
    summaryDetail: 'Standard', highyieldFocus: 'Exam-Focused',
    maxPages: '8' 
  });
  
  const abortControllerRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [theme]);

  useEffect(() => {
    if (!apiKey) {
      setShowApiKeyModal(true);
    }
  }, [apiKey]);

  const saveApiKey = () => {
    if (tempKeyInput.trim()) {
      localStorage.setItem('medos_api_key', tempKeyInput.trim());
      setApiKey(tempKeyInput.trim());
      setShowApiKeyModal(false);
    } else {
      alert("Please enter a valid API Key.");
    }
  };

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile || uploadedFile.type !== 'application/pdf') return;
    setFile(uploadedFile); setResultData(null); setNormalizedData(null); setErrorMsg(null);
  };

  const handleGenerate = async () => {
    if(isGenerating) return;
    setIsGenerating(true); setResultData(null); setNormalizedData(null); setErrorMsg(null);
    let targetCount = 5;
    if(selectedTask === 'mcqs' || selectedTask === 'mistake_mcqs') targetCount = settings.mcqCount;
    if(selectedTask === 'cases') targetCount = settings.caseCount;
    if(selectedTask === 'anki') targetCount = settings.ankiCount;
    if(selectedTask === 'summary') targetCount = 1;
    if(selectedTask === 'highyield') targetCount = 5;
    
    const formData = new FormData(); 
    if (selectedTask !== 'mistake_mcqs') {
      if(!file) { setErrorMsg("PDF file is required for this task."); setIsGenerating(false); return; }
      formData.append('file', file);
    }
    formData.append('task', selectedTask); 
    formData.append('count', targetCount); 
    formData.append('settings', JSON.stringify(settings));
    
    if (selectedTask === 'mistake_mcqs') {
      try {
        const res = await fetch(`${API_URL}/api/high-yield/mistakes`);
        const mData = await res.json();
        if (mData.success && mData.data.length > 0) {
          const mistakesContext = mData.data.map(m => `- Topic: ${m.topic}, Concept: ${m.concept}`).join("\n");
          formData.append('mistake_context', mistakesContext);
        } else {
          setErrorMsg("لا توجد أخطاء مسجلة كفاية لتوليد أسئلة الضعف.");
          setIsGenerating(false);
          return;
        }
      } catch (err) {
        setErrorMsg("فشل جلب الأخطاء المسجلة.");
        setIsGenerating(false);
        return;
      }
    }
    
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`${API_URL}/generate/`, { 
        method: 'POST', 
        headers: { 'X-API-Key': apiKey },
        body: formData, 
        signal: abortControllerRef.current.signal 
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Generation failed. Please try again.");
      
      const rawPayload = data.result?.data?.valid || data.result?.data || data.result || [];
      setNormalizedData(Array.isArray(rawPayload) ? rawPayload : [rawPayload]);
    } catch (error) { 
      if(error.name !== 'AbortError') setErrorMsg(error.message);
    } finally { setIsGenerating(false); abortControllerRef.current = null; }
  };

  const handleGenerateMistakes = async (mistakesContext) => {
    setIsGenerating(true); setResultData(null); setNormalizedData(null); setErrorMsg(null);
    setCurrentRoute('study'); setSelectedTask('mistake_mcqs');
    
    const formData = new FormData(); 
    formData.append('task', 'mistake_mcqs'); 
    formData.append('count', 5); 
    formData.append('mistake_context', mistakesContext); 
    formData.append('settings', JSON.stringify(settings));
    
    try {
      const response = await fetch(`${API_URL}/generate/`, { 
        method: 'POST', headers: { 'X-API-Key': apiKey }, body: formData 
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Generation failed.");
      
      const rawPayload = data.result?.data || [];
      setNormalizedData(Array.isArray(rawPayload) ? rawPayload : [rawPayload]);
    } catch (error) { 
      setErrorMsg(error.message);
    } finally { setIsGenerating(false); }
  };

  useEffect(() => {
    return () => { if (abortControllerRef.current) abortControllerRef.current.abort(); };
  }, []);

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
    { id: 'mcqs', name: 'MCQ Engine', desc: 'Generate high-yield active-recall MCQs with 4 choices and explanations.', icon: <HelpCircle size={28} /> },
    { id: 'mistake_mcqs', name: 'Targeted Weakness Quiz', desc: 'Auto-generate targeted quiz questions directly from your registered MCQ mistakes.', icon: <Flame size={28} /> },
    { id: 'cases', name: 'Clinical Cases', desc: 'USMLE-style vignettes with diagnostic reasoning MCQs.', icon: <Stethoscope size={28} /> },
    { id: 'summary', name: 'Smart Summary', desc: 'Lecture explained in natural Egyptian Arabic with Chat-with-PDF.', icon: <BookOpen size={28} /> },
    { id: 'mindmap', name: 'AI Mind Maps', desc: 'Generate interactive mind maps from text to visualize disease relationships.', icon: <BrainCircuit size={28} /> },
    { id: 'anki', name: 'Anki Flashcards', desc: 'Active recall cards for long-term retention.', icon: <BrainCircuit size={28} /> },
    { id: 'highyield', name: 'High-Yield Content', desc: 'Extract the most important exam-relevant points from the PDF.', icon: <Flame size={28} /> }
  ];

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200" dir="ltr">
      
      {showApiKeyModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-teal-100 dark:bg-teal-900/30 text-teal-600 rounded-xl">
                <Key size={24} />
              </div>
              <h3 className="text-xl font-bold dark:text-white">Gemini API Key Setup</h3>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
              Enter your Google Gemini API Key to use MedPatient AI and all study tools.
              <br/>
              <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-teal-600 dark:text-teal-400 hover:underline font-bold mt-2 inline-block">
                🔗 خد ال api بتاعك من هنا
              </a>
            </p>
            <input 
              type="password" 
              placeholder="AIzaSy..." 
              value={tempKeyInput}
              onChange={(e) => setTempKeyInput(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-teal-500 mb-6"
            />
            <div className="flex gap-3">
              {apiKey && <Button variant="ghost" onClick={() => setShowApiKeyModal(false)} className="flex-1">Cancel</Button>}
              <Button variant="primary" onClick={saveApiKey} className="flex-1 bg-teal-600">Save Key</Button>
            </div>
          </div>
        </div>
      )}

      <aside className="w-[260px] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex-col justify-between hidden md:flex shrink-0 z-40">
        <div className="p-6 h-full flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3"><div className="bg-teal-600 text-white p-2 rounded-xl"><Stethoscope size={20}/></div><h1 className="font-bold text-base tracking-tight leading-none text-slate-900 dark:text-white">MedOS</h1></div>
            <button onClick={toggleTheme} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:text-teal-600 transition-colors">{theme === 'light' ? <Moon size={18}/> : <Sun size={18}/>}</button>
          </div>

          {/* API & Quota Status Indicator */}
          <div className="mb-6 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${apiKey ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                {apiKey ? 'API Connected' : 'No API Key'}
              </span>
            </div>
            <button onClick={() => setShowApiKeyModal(true)} className="text-xs text-teal-600 dark:text-teal-400 font-bold hover:underline">
              {apiKey ? 'Change' : 'Setup'}
            </button>
          </div>

          <nav className="space-y-1 flex-1">
            {navItems.map(item => (
              <button key={item.id} onClick={() => setCurrentRoute(item.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-colors ${currentRoute === item.id || (currentRoute === 'study' && item.id === 'study_hub') ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 font-bold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                {item.icon} {item.label}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-12">
        <div className="max-w-[1100px] mx-auto">
          {currentRoute === 'dashboard' && <DashboardView navigate={setCurrentRoute} />}
          {currentRoute === 'tasks' && <TasksView />}
          {currentRoute === 'planner' && <PlannerView />}
          {currentRoute === 'highyield_track' && <HighYieldTrackerView onGenerateMistakes={handleGenerateMistakes} />}
          
          {currentRoute === 'settings' && (
             <div className="space-y-8 animate-in fade-in max-w-3xl">
               <div>
                 <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-2 flex items-center">
                   <Settings className="mr-3 text-teal-600" size={32} /> Settings
                 </h2>
                 <p className="text-slate-500 dark:text-slate-400 text-sm">Customize your Medical OS experience.</p>
               </div>
               <Card className="p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                 <div className="flex flex-col space-y-6">
                   <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                     <div className="flex items-center gap-3">
                       <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg"><Moon size={20}/></div>
                       <div>
                         <h3 className="font-bold text-slate-800 dark:text-slate-100">Theme (Dark Mode)</h3>
                         <p className="text-sm text-slate-500 dark:text-slate-400">Switch application colors for eye comfort.</p>
                       </div>
                     </div>
                     <div className="flex gap-2">
                       <Button variant={theme === 'light' ? 'primary' : 'secondary'} onClick={() => setTheme('light')} className={theme==='light' ? 'bg-teal-600' : ''}><Sun size={16} className="mr-2"/> Light</Button>
                       <Button variant={theme === 'dark' ? 'primary' : 'secondary'} onClick={() => setTheme('dark')} className={theme==='dark' ? 'bg-slate-800 text-white' : ''}><Moon size={16} className="mr-2"/> Dark</Button>
                     </div>
                   </div>
                   <div className="border-t dark:border-slate-800 pt-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                     <div className="flex items-center gap-3">
                       <div className="p-2 bg-teal-50 dark:bg-teal-900/20 text-teal-600 rounded-lg"><Key size={20}/></div>
                       <div>
                         <h3 className="font-bold text-slate-800 dark:text-slate-100">API Key Management</h3>
                         <p className="text-sm text-slate-500 dark:text-slate-400">Update your Gemini API key.</p>
                         <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-teal-600 dark:text-teal-400 hover:underline text-xs font-bold mt-1 inline-block">
                           🔗 خد ال api بتاعك من هنا
                         </a>
                       </div>
                     </div>
                     <div className="flex gap-2">
                       <Button variant="secondary" onClick={() => { setTempKeyInput(apiKey); setShowApiKeyModal(true); }}>Edit API Key</Button>
                     </div>
                   </div>
                 </div>
               </Card>
             </div>
          )}

          {currentRoute === 'medpatient' && (
            <div className="space-y-8 animate-in fade-in max-w-5xl">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-2 flex items-center">
                  <Stethoscope className="mr-3 text-teal-600" size={32} /> Virtual Patient
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm">Practice clinical reasoning with an interactive AI patient.</p>
              </div>
              <MedPatientView apiKey={apiKey} />
            </div>
          )}

          {currentRoute === 'study_hub' && (
            <div className="space-y-8 animate-in fade-in">
              <div><h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">📚 Study Tools</h2><p className="text-slate-500 dark:text-slate-400 text-sm">Select an AI tool to generate study materials from your medical PDFs.</p></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {tools.map(toolItem => (
                  <Card key={toolItem.id} className="p-6 flex flex-col hover:border-teal-500 dark:bg-slate-900 dark:border-slate-800 transition-colors cursor-pointer" onClick={() => { setSelectedTask(toolItem.id); setCurrentRoute('study'); }}>
                    <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-900/30 text-teal-600 flex items-center justify-center mb-4">{toolItem.icon}</div>
                    <h3 className="font-bold text-xl text-slate-800 dark:text-slate-100 mb-2">{toolItem.name}</h3><p className="text-slate-600 dark:text-slate-400 text-sm mb-6 flex-1">{toolItem.desc}</p>
                    <div className="font-bold text-sm text-teal-600 flex items-center mt-auto">Open Tool <ChevronRight size={16} className="ml-1"/></div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {currentRoute === 'study' && (
            <div className="space-y-8 animate-in fade-in max-w-4xl">
              <div className="flex items-center gap-4"><Button variant="ghost" onClick={() => setCurrentRoute('study_hub')}><ChevronRight className="rotate-180"/></Button><h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white capitalize">{selectedTask === 'mistake_mcqs' ? 'Targeted Weakness Quiz' : `${selectedTask} Generator`}</h2></div>
              
              {selectedTask !== 'mistake_mcqs' && (!file ? (
                <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-slate-300 dark:border-slate-700 border-dashed rounded-3xl cursor-pointer bg-white dark:bg-slate-900 hover:bg-slate-50 transition-colors shadow-sm group">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6"><div className="p-4 bg-teal-50 dark:bg-teal-900/30 rounded-2xl text-teal-600 mb-4"><UploadCloud size={32} /></div><p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Click to upload medical PDF</p></div>
                  <input type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} />
                </label>
              ) : (
                <Card className="p-5 flex justify-between items-center bg-teal-50/50 dark:bg-teal-900/10 border-teal-100 dark:border-teal-900/50">
                  <div className="flex items-center gap-4"><div className="p-3 bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 text-teal-600"><FileText size={20}/></div><div><p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{file.name}</p></div></div>
                  <Button variant="danger" disabled={isGenerating} onClick={() => { setFile(null); setResultData(null); setNormalizedData(null); setErrorMsg(null); }} icon={<Trash2 size={16}/>}>Remove</Button>
                </Card>
              ))}

              {selectedTask === 'mistake_mcqs' && (
                <Card className="p-6 bg-rose-50/50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-800">
                  <h3 className="font-bold text-lg text-rose-800 dark:text-rose-300 mb-2">🎯 Targeted Weakness Quiz</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">هذه الأداة ستولد أسئلة مخصصة بناءً على الأخطاء السابقة المسجلة في الـ High-Yield Tracker تلقائياً دون الحاجة لرفع ملف PDF.</p>
                </Card>
              )}
              
              {((selectedTask === 'mistake_mcqs') || (file && !isGenerating && !normalizedData)) && (
                <Card className="p-6 mt-6 animate-in fade-in dark:bg-slate-900 dark:border-slate-800">
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-6 flex items-center"><Settings size={16} className="mr-2 text-slate-400"/> Configuration & Quota Saver</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {(selectedTask === 'mcqs' || selectedTask === 'cases' || selectedTask === 'mistake_mcqs') && (
                       <>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase">Amount</label>
                            <select onChange={e => setSettings(s => ({...s, mcqCount: e.target.value, caseCount: e.target.value}))} className="w-full p-3 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white text-sm outline-none">
                              <option value="5">5 Items</option><option value="10">10 Items</option><option value="15">15 Items</option><option value="20">20 Items</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase">Difficulty</label>
                            <select onChange={e => setSettings(s => ({...s, mcqDiff: e.target.value, caseDiff: e.target.value}))} className="w-full p-3 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white text-sm outline-none">
                              <option value="USMLE Step 1">USMLE Step 1</option>
                              <option value="USMLE Step 2 CK">USMLE Step 2 CK</option>
                              <option value="Basic Recall">Basic Recall</option>
                            </select>
                          </div>
                       </>
                    )}
                    {selectedTask !== 'mistake_mcqs' && (
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase">Max Pages (Quota Saver)</label>
                        <select value={settings.maxPages} onChange={e => setSettings(s => ({...s, maxPages: e.target.value}))} className="w-full p-3 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white text-sm outline-none">
                          <option value="5">First 5 Pages (Fastest)</option>
                          <option value="8">First 8 Pages (Recommended)</option>
                          <option value="15">First 15 Pages</option>
                        </select>
                      </div>
                    )}
                  </div>
                  {errorMsg && <div className="mt-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 flex items-center"><AlertTriangle className="mr-3" size={20}/> {errorMsg}</div>}
                  <div className="mt-8 flex justify-end"><Button variant="primary" disabled={isGenerating} onClick={handleGenerate} className="bg-slate-900 dark:bg-teal-600" icon={<Play size={16}/>}>{selectedTask === 'mistake_mcqs' ? 'Generate Weakness Quiz' : 'Generate Content'}</Button></div>
                </Card>
              )}

              {isGenerating && (
                <Card className="p-16 text-center border-dashed dark:border-slate-700 dark:bg-slate-900 flex flex-col items-center justify-center">
                  <Loader2 className="animate-spin text-teal-600 mb-6" size={48} />
                  <h3 className="font-bold text-xl text-slate-800 dark:text-slate-100 mb-2">Generating Content...</h3>
                </Card>
              )}

              {normalizedData && (
                <div className="space-y-6 animate-in slide-in-from-bottom-4">
                  <div className="flex justify-between items-center p-6 rounded-2xl border bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800">
                    <h3 className="font-bold text-lg mb-1 flex items-center text-teal-800 dark:text-teal-400"><CheckCircle size={18} className="mr-2"/>{normalizedData.length} Items Generated</h3>
                    <Button variant="secondary" onClick={() => {setResultData(null); setNormalizedData(null); setErrorMsg(null);}}>Generate More</Button>
                  </div>
                  <ErrorBoundary>
                     {selectedTask === 'anki' && <AnkiWorkspace initialCards={normalizedData} fileName={file?.name.replace('.pdf', '')} />}
                     {normalizedData.map((item, idx) => (
                       <div key={idx}>
                          {(selectedTask === 'mcqs' || selectedTask === 'mistake_mcqs') && <MCQRenderer data={item} idx={idx + 1} />}
                          {selectedTask === 'cases' && <ClinicalCaseRenderer data={item} />}
                          {selectedTask === 'summary' && <SmartSummaryRenderer data={item} rawPdfText={file?.name} apiKey={apiKey} />}
                          {selectedTask === 'highyield' && (
                             <Card className="p-6 mb-4 dark:bg-slate-900 dark:border-slate-700 border-l-4 border-l-rose-500">
                               <h4 className="font-bold text-rose-600 dark:text-rose-400 mb-2">{item.priority || "🔥 High Priority"}</h4>
                               <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 mb-2">{item.concept || "Key Concept"}</h3>
                               <p className="text-slate-600 dark:text-slate-400 text-sm">{item.explanation || item.content}</p>
                             </Card>
                          )}
                       </div>
                     ))}
                  </ErrorBoundary>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}