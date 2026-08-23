import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  UploadCloud, FileText, Loader2, Play, CheckCircle, ChevronRight,
  Home, Plus, Settings, Moon, Sun,
  CalendarDays, X, Pause, RotateCcw, Activity, Key,
  Check, ArrowRight, Sparkles, Languages, Globe,
  BookOpen, Stethoscope, CheckSquare, HelpCircle, BrainCircuit, Trash2, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Button, Card, ErrorBoundary } from './components/ui';
import KnowledgeBrain3D from './components/KnowledgeBrain3D';
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

const getReviewConfig = (num, lang = 'en') => {
  const isAr = lang === 'ar';
  const configs = {
    0: { 
      title: isAr ? "يوم 0: التعلم الأولي" : "Day 0: Initial Learning", 
      task_type: 'summary', 
      task_name: isAr ? "ملخص ذكي (Summary)" : "Smart Summary", 
      focus: isAr ? "نظرة عامة والأساسيات" : "Overview & Foundations",
      iconName: "circle", 
      color: "text-purple-500" 
    },
    1: { 
      title: isAr ? "يوم 1: استرجاع نشط" : "Day 1: Active Recall", 
      task_type: 'mcqs', 
      task_name: isAr ? "بنك أسئلة (MCQs)" : "MCQ Quiz", 
      focus: isAr ? "استرجاع مباشر وفهم عميق" : "Direct Active Recall",
      iconName: "brain", 
      color: "text-blue-500" 
    },
    2: { 
      title: isAr ? "يوم 3: نقاط الضعف والفخاخ" : "Day 3: Weak Points", 
      task_type: 'summary', 
      task_name: isAr ? "مراجعة مكثفة (Summary)" : "Deep Summary", 
      focus: isAr ? "تركيز على الفخاخ والمفاهيم الصعبة" : "Traps & Pitfalls",
      iconName: "zap", 
      color: "text-amber-500" 
    },
    3: { 
      title: isAr ? "يوم 7: تطبيق سريري" : "Day 7: Clinical Application", 
      task_type: 'cases', 
      task_name: isAr ? "حالات سريرية (Cases)" : "Clinical Cases", 
      focus: isAr ? "تطبيق في سيناريوهات مرضى" : "Vignettes & Management",
      iconName: "stethoscope", 
      color: "text-teal-500" 
    },
    4: { 
      title: isAr ? "يوم 14: استرجاع بعيد المدى" : "Day 14: Long-Term Recall", 
      task_type: 'anki', 
      task_name: isAr ? "بطاقات أنكي (Anki)" : "Anki Flashcards", 
      focus: isAr ? "تثبيت الذاكرة طويلة المدى" : "Spaced Retrieval",
      iconName: "target", 
      color: "text-indigo-500" 
    },
    5: { 
      title: isAr ? "يوم 30: اختبار الإتقان" : "Day 30: Mastery Test", 
      task_type: 'anki', 
      task_name: isAr ? "بطاقات أنكي (Anki)" : "Anki Flashcards", 
      focus: isAr ? "اختبار التمكن الشامل" : "Mastery Consolidation",
      iconName: "trophy", 
      color: "text-emerald-500" 
    },
    6: { 
      title: isAr ? "يوم 60: التثبيت الدائم" : "Day 60: Permanent Retention", 
      task_type: 'anki', 
      task_name: isAr ? "بطاقات أنكي (Anki)" : "Anki Flashcards", 
      focus: isAr ? "حفظ دائم في الذاكرة" : "Permanent Mastery",
      iconName: "shield", 
      color: "text-cyan-500" 
    }
  };
  return configs[num] || configs[6];
};

// Icon mapper for review config — maps iconName strings to Lucide components
const REVIEW_ICON_MAP = {
  circle: <Activity size={14} className="text-purple-400"/>,
  brain: <BrainCircuit size={14} className="text-blue-400"/>,
  zap: <Sparkles size={14} className="text-amber-400"/>,
  stethoscope: <Stethoscope size={14} className="text-teal-400"/>,
  target: <CheckCircle size={14} className="text-indigo-400"/>,
  trophy: <CheckCircle size={14} className="text-emerald-400"/>,
  shield: <CheckCircle size={14} className="text-cyan-400"/>
};

const UI_TEXT = {
  en: {
    nav: {
      dashboard: 'Dashboard',
      study_hub: 'Study Tools',
      medpatient: 'Virtual Patient',
      planner: 'Spaced Repetition',
      tasks: 'Tasks',
      highyield_track: 'Mistake Tracker',
      settings: 'Settings'
    },
    tools: {
      mcqs: { name: 'MCQ Engine', desc: 'Generate USMLE-style active-recall questions with detailed explanations.' },
      cases: { name: 'Clinical Cases', desc: 'Step 2 CK vignettes and diagnostic decision trees.' },
      summary: { name: 'Smart Summary', desc: 'AI-powered medical tutoring and interactive PDF chat.' },
      anki: { name: 'Anki Flashcards', desc: 'Spaced-repetition flashcards with CSV export for Anki.' },
      mnemonics: { name: 'Mnemonics Generator', desc: 'Creative memory aids, acronyms, and medical mnemonics.' }
    },
    dashboard: {
      title: 'Welcome back, Doctor',
      subtitle: 'Keep track of your study plans, practice clinical cases, and crush your exams.',
      quickFocus: 'Quick Focus Session',
      pendingTasks: 'Pending Tasks',
      dueReviews: 'Due Reviews',
      activePlans: 'Active Plans',
      mistakesTracked: 'Mistakes',
      generatorCardTitle: 'AI Study Generator',
      generatorCardDesc: 'Upload lecture PDFs or notes to instantly generate MCQs, vignettes, summaries, and flashcards.',
      openStudyTools: 'Open Study Tools',
      patientCardTitle: 'Virtual Patient Clinic',
      patientCardDesc: 'Practice clinical history taking and diagnostic reasoning with AI patients.',
      startPatientCase: 'Start a Case'
    },
    studyHub: {
      title: 'Study Suite',
      subtitle: 'Pick an AI tool and turn your lectures into active learning material.',
      launch: 'Launch Generator'
    },
    timer: {
      mode: 'Focus Mode',
      defaultTitle: 'Study Session',
      selectDuration: 'Pick a Duration',
      min: 'min',
      customPlaceholder: 'Custom minutes...',
      startCustom: 'Start Custom',
      cancel: 'Cancel',
      pause: 'Pause',
      resume: 'Resume',
      reset: 'Reset',
      exit: 'Exit',
      completeTitle: 'Nice work! Session done.',
      completeDesc: 'Great job staying focused. Take a quick break and come back stronger.',
      backWorkspace: 'Back to Workspace'
    },
    apiKeyModal: {
      title: 'Gemini API Key Setup',
      desc: 'Enter your Google Gemini API key to enable AI-powered generation. Your key stays in your browser only.',
      save: 'Save & Continue'
    },
    generator: {
      titleSuffix: 'Generator',
      subtitle: 'Transform your medical material with AI active recall',
      uploadTitle: 'Upload Lecture (PDF, TXT, MD)',
      uploadSubtitle: 'Client-side text extraction',
      orPaste: 'Or Paste Text Directly',
      pastePlaceholder: 'Paste lecture notes, pathology summary, or clinical guidelines here...',
      extracting: 'Extracting text:',
      pages: 'pages...',
      extractedChars: 'Extracted characters:',
      remove: 'Remove',
      settingsTitle: 'Generation Settings',
      difficulty: 'Difficulty',
      easy: 'Easy',
      medium: 'Medium',
      hard: 'Hard',
      summaryDepth: 'Summary Depth',
      quickReview: 'Quick Review',
      deepDive: 'Deep Dive',
      mcqType: 'MCQ Type',
      directRecall: 'Direct Recall',
      conceptual: 'Conceptual',
      except: 'Except / Least Likely',
      mixed: 'Mixed',
      mcqCount: 'Question Count',
      questionsCountSuffix: 'Questions',
      generateBtn: 'Generate with Gemini AI',
      generatedMCQs: 'Generated MCQs',
      generatedCases: 'Clinical Vignettes',
      generatedAnki: 'Anki Flashcards',
      generatedMnemonics: 'Medical Mnemonics',
      mnemonicBadge: 'Mnemonic #',
      memoryHook: 'Memory Hook',
      breakdown: 'Breakdown:'
    },
    tasks: {
      title: 'Study Tasks',
      subtitle: 'Plan your sessions and track daily objectives.',
      placeholder: 'Task Name',
      add: 'Add',
      tabAll: 'All',
      tabActive: 'Active',
      tabCompleted: 'Completed',
      empty: 'No tasks here yet.',
      focus: 'Focus'
    },
    planner: {
      title: 'Spaced Repetition Planner',
      subtitle: 'Progressive active recall: Day 0 (Overview), Day 1 (MCQs), Day 3 (Summary), Day 7 (Cases), Day 14+ (Anki).',
      addTitle: 'Add Lecture Study Plan',
      namePlaceholder: 'Lecture Name',
      modulePlaceholder: 'Module',
      subjectPlaceholder: 'Subject',
      notesPlaceholder: 'Lecture Notes',
      uploadPdfBtn: 'Upload Lecture PDF',
      extractingPdf: 'Extracting PDF text...',
      submit: 'Create 7-Stage Recall Schedule',
      empty: 'No active schedules yet. Create your first lecture plan above!',
      started: 'Started:',
      reviewsCount: 'Reviews',
      calendarBtn: 'Study Calendar',
      calendarModalTitle: 'Monthly Study Calendar',
      todayAgendaTitle: 'Today\'s Reviews',
      todayAgendaSub: 'Lectures and tasks due today. Click to generate and start active recall.',
      allPlansTab: 'All Active Schedules',
      noTasksToday: 'Nothing due today! You\'re on track.',
      triageButton: 'TRIAGE (Auto-Catchup)',
      triageBadge: 'Overdue:',
      triageConfirm: 'Triage will clear overdue Day 0-3 reviews across all schedules so you can catch up. Proceed?',
      triageAlert: 'Triage complete! Overdue reviews cleared. Generate a mixed MCQ test to check your progress.',
      modalTitle: 'Active Recall Review',
      stageLabel: 'Review Stage:',
      assignedTask: 'Assigned Task:',
      focusLabel: 'Focus:',
      generateAndStart: 'Generate & Start Review',
      feedbackHeading: 'How was this review?',
      hardBtn: 'Hard (Repeat in 2 Days)',
      easyBtn: 'Easy (Schedule Normally)',
      closeModal: 'Close',
      taskBreakdown: 'Scheduled Task:'
    },
    mistakes: {
      title: 'Mistake Tracker',
      subtitle: 'Missed questions and cases show up here automatically for targeted review.',
      clearAll: 'Clear All',
      clearConfirm: 'Clear all recorded mistakes?',
      emptyTitle: 'No Mistakes Yet',
      emptyDesc: 'As you practice, any missed concepts will automatically appear here.',
      yourAnswer: 'Your Answer:',
      correctAnswer: 'Correct Answer:'
    },
    settings: {
      title: 'Settings',
      subtitle: 'Configure your API key, theme, language, and preferences.',
      themeTitle: 'Theme',
      themeDesc: 'Switch between Dark and Light mode.',
      themeLight: 'Light Mode',
      themeDark: 'Dark Mode',
      languageTitle: 'Language',
      languageDesc: 'Toggle between English and Egyptian Arabic.',
      apiKeyTitle: 'Gemini API Key',
      apiKeyDesc: 'Your key is stored in your browser and used for client-side AI requests only.',
      saveKey: 'Save Key',
      savedAlert: 'Settings saved.',
      dangerZoneTitle: 'Danger Zone',
      dangerZoneDesc: 'Wipe out all your study data and reset the app.',
      wipeDataBtn: 'Wipe All Data',
      wipeConfirm: 'Are you absolutely sure? This will delete all your tasks, study plans, mistakes, XP, and settings. This cannot be undone.'
    }
  },
  ar: {
    nav: {
      dashboard: 'المركز الرئيسي يا ريس',
      study_hub: 'ورشة المذاكرة يا نجم',
      medpatient: 'عيادة المريض',
      planner: 'جدول التكرار',
      tasks: 'لسته الشغل',
      highyield_track: 'سجل الغلطات',
      settings: 'ظبط الابليكيشن'
    },
    tools: {
      mcqs: { name: 'بنك الاسئلة MCQs', desc: 'اسئلة نمط USMLE مع شرح بالمصري عشان تفهم مش تحفظ.' },
      cases: { name: 'حالات سريرية', desc: 'سيناريوهات Step 2 CK تشخيص وعلاج.. زي الامتحان بالظبط.' },
      summary: { name: 'الملخص الذكي', desc: 'شرح مبسط بالمصري وشات تفاعلي مع المحاضرة.' },
      anki: { name: 'كروت آنكي', desc: 'كروت استرجاع نشط جاهزة للتصدير لآنكي.. مش هتنسى تاني.' },
      mnemonics: { name: 'مولد التحشيشات', desc: 'اختصارات ذهنية وتحشيشات مصرية تخلي المعلومة تلزق.' }
    },
    dashboard: {
      title: 'يلا نذاكر يا دكتور!',
      subtitle: 'تابع جدولك، حل حالات، واتقن الـ High-Yield قبل الامتحان.',
      quickFocus: 'ركز معايا شوية',
      pendingTasks: 'مهام مستنياك',
      dueReviews: 'مراجعات النهارده',
      activePlans: 'جداول شغالة',
      mistakesTracked: 'غلطات',
      generatorCardTitle: 'مولد المذاكرة بالذكاء الاصطناعي',
      generatorCardDesc: 'ارفع محاضرتك والـ AI يعملك اسئلة وحالات وملخصات وكروت في ثانية.',
      openStudyTools: 'افتح ورشة المذاكرة',
      patientCardTitle: 'عيادة المريض الافتراضي',
      patientCardDesc: 'اتكلم مع مريض AI بالمصري واتدرب على التشخيص والعلاج.',
      startPatientCase: 'ابدأ حالة'
    },
    studyHub: {
      title: 'ورشة المذاكرة الشاملة',
      subtitle: 'اختار الاداة وحول اي محاضرة لمواد مراجعة تفاعلية فوري.',
      launch: 'يلا نبدأ'
    },
    timer: {
      mode: 'وضع التركيز',
      defaultTitle: 'جلسة مذاكرة',
      selectDuration: 'اختار المدة',
      min: 'دقيقة',
      customPlaceholder: 'عدد دقائق مخصص...',
      startCustom: 'ابدأ',
      cancel: 'الغاء',
      pause: 'وقف',
      resume: 'كمل',
      reset: 'من الاول',
      exit: 'اخرج',
      completeTitle: 'برافو عليك يا معلم! خلصت الجلسة زي الفل',
      completeDesc: 'خد راحة قصيرة واشرب حاجة دافية.. وارجع كمل يا بطل.',
      backWorkspace: 'ارجع للمذاكرة'
    },
    apiKeyModal: {
      title: 'محتاجين مفتاح Gemini API',
      desc: 'عشان الذكاء الاصطناعي يشتغل معاك، حط مفتاح Gemini API بتاعك هنا. المفتاح بيتحفظ في المتصفح بتاعك بس.',
      save: 'احفظ وكمل'
    },
    generator: {
      titleSuffix: 'المولد',
      subtitle: 'حول محاضرتك لمواد مراجعة بالذكاء الاصطناعي',
      uploadTitle: 'ارفع المحاضرة (PDF, TXT, MD)',
      uploadSubtitle: 'بنقرأ الملف عندك في المتصفح مباشرة',
      orPaste: 'او الصق النص هنا',
      pastePlaceholder: 'الصق ملاحظات المحاضرة هنا...',
      extracting: 'بنقرأ الملف:',
      pages: 'صفحات...',
      extractedChars: 'عدد الحروف المستخرجة:',
      remove: 'امسح',
      settingsTitle: 'اعدادات التوليد',
      difficulty: 'الصعوبة',
      easy: 'سهل',
      medium: 'متوسط',
      hard: 'صعب',
      summaryDepth: 'عمق الملخص',
      quickReview: 'مراجعة سريعة',
      deepDive: 'شرح عميق',
      mcqType: 'نوع الاسئلة',
      directRecall: 'استرجاع مباشر',
      conceptual: 'مفاهيمي',
      except: 'ما عدا / الاقل احتمالا',
      mixed: 'مشكل ومنوع',
      mcqCount: 'عدد الاسئلة',
      questionsCountSuffix: 'اسئلة',
      generateBtn: 'يلا ولد بالـ Gemini',
      generatedMCQs: 'الاسئلة اللي اتولدت',
      generatedCases: 'الحالات السريرية',
      generatedAnki: 'كروت آنكي',
      generatedMnemonics: 'التحشيشات الطبية',
      mnemonicBadge: 'تحشيشة #',
      memoryHook: 'مفتاح الحفظ',
      breakdown: 'الشرح:'
    },
    tasks: {
      title: 'لسته الشغل والمذاكرة',
      subtitle: 'نظم جلساتك وتابع اللي عليك يوم بيوم.',
      placeholder: 'اسم المهمة',
      add: 'يلا ضيفها',
      tabAll: 'الكل',
      tabActive: 'لسه شغال',
      tabCompleted: 'خلصانة',
      empty: 'مفيش حاجه هنا لسه.. ضيف مهمة وابدأ.',
      focus: 'ركز'
    },
    planner: {
      title: 'جدول التكرار المتباعد',
      subtitle: 'استرجاع نشط متدرج: يوم 0 نظرة عامة، يوم 1 اسئلة، يوم 3 ملخص فخاخ، يوم 7 حالات، يوم 14+ آنكي.',
      addTitle: 'ضيف خطة محاضرة جديدة',
      namePlaceholder: 'اسم المحاضرة',
      modulePlaceholder: 'الموديول',
      subjectPlaceholder: 'المادة',
      notesPlaceholder: 'نص المحاضرة',
      uploadPdfBtn: 'ارفع PDF المحاضرة',
      extractingPdf: 'بنقرأ الـ PDF...',
      submit: 'اعمل جدول استرجاع 7 مراحل',
      empty: 'مفيش جداول لسه! اعمل اول خطة من الفورم فوق.',
      started: 'تاريخ البدء:',
      reviewsCount: 'مراجعات',
      calendarBtn: 'تقويم المذاكرة',
      calendarModalTitle: 'التقويم الشهري',
      todayAgendaTitle: 'اللي عليك النهارده',
      todayAgendaSub: 'المحاضرات والمراجعات المستحقة.. اضغط وابدأ فوري.',
      allPlansTab: 'كل الجداول النشطة',
      noTasksToday: 'مفيش حاجه عليك النهارده.. روح العب شوية!',
      triageButton: 'وضع الطوارئ (Triage)',
      triageBadge: 'متراكمة:',
      triageConfirm: 'هنصفي المراجعات المتراكمة لأيام 0 و1 و3 عشان تلحق جدولك. متأكد؟',
      triageAlert: 'تم! المراجعات المتراكمة اتصفت. ولد اختبار MCQ شامل عشان تشوف مستواك.',
      modalTitle: 'مراجعة الاسترجاع النشط',
      stageLabel: 'المرحلة:',
      assignedTask: 'المهمة:',
      focusLabel: 'التركيز:',
      generateAndStart: 'ولد وابدأ المراجعة',
      feedbackHeading: 'ايه رأيك في المراجعة دي؟',
      hardBtn: 'صعبة اوي.. كرر تاني',
      easyBtn: 'خلصانة بشياكة',
      closeModal: 'اقفل',
      taskBreakdown: 'المهمة المطلوبة:'
    },
    mistakes: {
      title: 'سجل الغلطات والـ High-Yield',
      subtitle: 'اي سؤال تجاوبه غلط بيتسجل هنا اوتوماتيك عشان تراجعه.',
      clearAll: 'امسح الكل',
      clearConfirm: 'متأكد من مسح كل الغلطات؟',
      emptyTitle: 'انت لسه مغلطتش.. يا عيني عليك',
      emptyDesc: 'لما تحل اسئلة وتغلط، هتتسجل هنا تلقائي للمراجعة المركزة.',
      yourAnswer: 'اجابتك:',
      correctAnswer: 'الاجابة الصح:'
    },
    settings: {
      title: 'ظبط الابليكيشن على مزاجك',
      subtitle: 'غير المظهر واللغة ومفتاح الـ AI.',
      themeTitle: 'المظهر',
      themeDesc: 'اختار الوضع الليلي ولا الفاتح.',
      themeLight: 'الوضع الفاتح',
      themeDark: 'الوضع الليلي',
      languageTitle: 'اللغة',
      languageDesc: 'بدل بين الانجليزي والمصري.',
      apiKeyTitle: 'مفتاح Gemini API',
      apiKeyDesc: 'المفتاح بيتحفظ في المتصفح بتاعك وبيتستخدم مباشرة.',
      saveKey: 'احفظ المفتاح',
      savedAlert: 'تم الحفظ!',
      dangerZoneTitle: 'منطقة الخطر',
      dangerZoneDesc: 'امسح كل بياناتك ورستت الابليكيشن بالكامل.',
      wipeDataBtn: 'امسح كل حاجة',
      wipeConfirm: 'أنت متأكد؟ ده هيمسح كل المهام وخطط المذاكرة ونقاط الـ XP والإعدادات بالكامل ومفيش رجوع.'
    }
  }
};


// Fullscreen Focus Timer Overlay Component
const FocusTimerOverlay = React.memo(({ task, onClose, appLanguage = 'en' }) => {
  const t = UI_TEXT[appLanguage]?.timer || UI_TEXT.en.timer;
  const [stage, setStage] = useState('select'); 
  const [durationMs, setDurationMs] = useState(25 * 60 * 1000);
  const [remainingMs, setRemainingMs] = useState(25 * 60 * 1000);
  const [isRunning, setIsRunning] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('');

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
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in fade-in" dir={appLanguage === 'ar' ? 'rtl' : 'ltr'}>
      <div className="absolute top-8 text-center px-4 w-full">
         <p className="text-teal-400 font-bold tracking-widest uppercase text-xs mb-1">{t.mode}</p>
         <h2 className="text-2xl md:text-3xl font-bold text-white max-w-2xl mx-auto truncate">
           {task?.title || task?.name || t.defaultTitle}
         </h2>
      </div>

      {stage === 'select' && (
        <div className="flex flex-col items-center space-y-6 mt-12 w-full max-w-xl">
           <h3 className="text-xl font-bold text-slate-200">{t.selectDuration}</h3>
           <div className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full" dir="ltr">
              {[15, 25, 30, 45, 60, 90].map(mins => (
                <Button 
                  key={mins} 
                  variant="secondary" 
                  className="py-6 text-lg font-bold bg-slate-900 border-2 border-slate-800 text-white hover:border-teal-500" 
                  onClick={() => startTimer(mins * 60000)}
                >
                  {mins} {t.min}
                </Button>
              ))}
           </div>

           {/* Custom Numeric Minutes Input */}
           <div className="flex items-center gap-3 w-full bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
             <input
               type="number"
               min="1"
               max="300"
               placeholder={t.customPlaceholder}
               value={customMinutes}
               onChange={e => setCustomMinutes(e.target.value)}
               className="flex-1 bg-slate-800 border border-slate-700 text-white px-4 py-2.5 rounded-xl text-sm outline-none focus:border-teal-500"
             />
             <Button
               variant="primary"
               onClick={() => {
                 const num = parseInt(customMinutes, 10);
                 if (num > 0) startTimer(num * 60000);
               }}
               disabled={!customMinutes || parseInt(customMinutes, 10) <= 0}
               className="bg-teal-600 hover:bg-teal-700 font-bold px-5"
             >
               {t.startCustom}
             </Button>
           </div>

           <Button variant="ghost" onClick={onClose} className="mt-4 text-slate-400 hover:text-white">
             {t.cancel}
           </Button>
        </div>
      )}

      {stage === 'running' && (
        <div className="flex flex-col items-center w-full max-w-4xl mt-12 space-y-10">
           <div className="flex gap-4 md:gap-6 items-center justify-center text-6xl md:text-8xl font-mono font-bold tracking-tighter text-white" dir="ltr">
              <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl w-24 md:w-36 h-28 md:h-48 flex items-center justify-center shadow-2xl"><span>{h}</span></div>:
              <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl w-24 md:w-36 h-28 md:h-48 flex items-center justify-center shadow-2xl"><span>{m}</span></div>:
              <div className="bg-slate-900 border border-slate-800 text-teal-400 rounded-3xl w-24 md:w-36 h-28 md:h-48 flex items-center justify-center shadow-2xl"><span>{s}</span></div>
           </div>
           <div className="flex gap-4 flex-wrap justify-center">
              {isRunning ? (
                 <Button variant="secondary" className="bg-amber-500/20 border-amber-500/40 text-amber-300 px-8 py-3.5 text-base font-bold" onClick={() => setIsRunning(false)}>
                   <Pause size={18} className="mx-1"/> {t.pause}
                 </Button>
              ) : (
                 <Button variant="primary" className="bg-emerald-600 px-8 py-3.5 text-base font-bold" onClick={() => setIsRunning(true)}>
                   <Play size={18} className="mx-1"/> {t.resume}
                 </Button>
              )}
              <Button variant="secondary" className="bg-slate-900 text-slate-300 border-slate-800 px-6 py-3.5 text-base font-bold" onClick={() => { setIsRunning(false); setRemainingMs(durationMs); }}>
                <RotateCcw size={18} className="mx-1"/> {t.reset}
              </Button>
              <Button variant="ghost" className="px-6 py-3.5 text-base font-bold text-slate-400 hover:text-rose-400" onClick={onClose}>
                <X size={18} className="mx-1"/> {t.exit}
              </Button>
           </div>
        </div>
      )}

      {stage === 'completed' && (
        <div className="flex flex-col items-center text-center space-y-6 animate-in fade-in">
           <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 flex items-center justify-center rounded-full border border-emerald-500/40">
             <CheckCircle size={44} />
           </div>
           <h2 className="text-3xl font-bold text-white">{t.completeTitle}</h2>
           <p className="text-sm text-slate-400 max-w-sm">{t.completeDesc}</p>
           <Button variant="primary" className="bg-teal-600 px-8 py-3.5 text-base font-bold" onClick={onClose}>
             {t.backWorkspace}
           </Button>
        </div>
      )}
    </div>
  );
});

export default function App() {
  const [currentRoute, setCurrentRoute] = useState('dashboard');
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
  const [appLanguage, setAppLanguage] = useState(() => localStorage.getItem('medos_app_lang') || 'en');

  // Form Inputs
  const [settings, setSettings] = useState({ 
    mcqCount: '5', 
    difficulty: 'Medium', 
    quizType: 'Mixed',
    summaryDepth: 'Deep Dive'
  });
  const [newTaskInput, setNewTaskInput] = useState('');
  const [taskFilter, setTaskFilter] = useState('all'); // all, active, completed
  const [newLecture, setNewLecture] = useState('');
  const [newModule, setNewModule] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newLectureText, setNewLectureText] = useState('');
  const [activeReviewModal, setActiveReviewModal] = useState(null); // { plan, review }
  const [isExtractingPlannerPdf, setIsExtractingPlannerPdf] = useState(false);
  const [plannerPdfProgress, setPlannerPdfProgress] = useState(null);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(null);
  const [plannerTab, setPlannerTab] = useState('today'); // 'today' | 'all'

  // --- GAMIFICATION ENGINE ---
  const [userStats, setUserStats] = useState(() => {
    const saved = localStorage.getItem('medos_user_stats');
    return saved ? JSON.parse(saved) : {
      xp: 0,
      level: 1,
      title: 'Medical Student',
      streak: 0,
      lastActiveDate: new Date().toISOString().split('T')[0]
    };
  });

  useEffect(() => {
    localStorage.setItem('medos_user_stats', JSON.stringify(userStats));
  }, [userStats]);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const lastActive = new Date(userStats.lastActiveDate);
    const todayDate = new Date(today);
    const diffDays = Math.floor((todayDate - lastActive) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      setUserStats(prev => ({ ...prev, streak: prev.streak + 1, lastActiveDate: today }));
    } else if (diffDays > 1) {
      setUserStats(prev => ({ ...prev, streak: 0, lastActiveDate: today }));
    } else if (diffDays === 0 && userStats.lastActiveDate !== today) {
      // Just to sync if it's the same day but missing something
      setUserStats(prev => ({ ...prev, lastActiveDate: today }));
    }
  }, []);

  const gainXP = (amount) => {
    setUserStats(prev => {
      const newXp = prev.xp + amount;
      const newLevel = Math.floor(newXp / 500) + 1;
      let newTitle = prev.title;

      if (newLevel !== prev.level) {
        if (newLevel >= 20) newTitle = 'Consultant';
        else if (newLevel >= 10) newTitle = 'Specialist';
        else if (newLevel >= 5) newTitle = 'Resident';
        else newTitle = 'Medical Student';
      }

      return { ...prev, xp: newXp, level: newLevel, title: newTitle };
    });
  };
  // ---------------------------

  const t = UI_TEXT[appLanguage] || UI_TEXT.en;

  const wipeAllData = () => {
    if (window.confirm(t.settings.wipeConfirm)) {
      localStorage.clear();
      window.location.reload();
    }
  };

  useEffect(() => {
    localStorage.setItem('medos_app_lang', appLanguage);
    document.documentElement.dir = appLanguage === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = appLanguage === 'ar' ? 'ar' : 'en';
  }, [appLanguage]);

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

  const handleGenerate = async (overrideText = null, overrideTask = null) => {
    if (!apiKey) { setShowApiKeyModal(true); return; }
    const activeText = overrideText !== null ? overrideText : lectureText;
    const activeTask = overrideTask !== null ? overrideTask : selectedTask;

    if (!activeText.trim()) {
      setErrorMsg("Please upload a file or paste lecture notes first.");
      return;
    }

    setIsGenerating(true);
    setErrorMsg(null);

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      let prompt = "";
      const textSnippet = activeText.substring(0, 12000);

      if (activeTask === 'mcqs') {
        prompt = `You are an expert USMLE medical board examiner and a top-tier medical professor in Egypt. Your task is to generate ${settings.mcqCount} high-yield Multiple Choice Questions (MCQs) based STRICTLY on the provided lecture notes.

### LANGUAGE & STYLE REQUIREMENTS ###
- The \`question\`, \`options\`, and \`correctAnswer\` MUST be written in formal Medical English.
- The \`explanation\` (for both the correct answer and distractors) MUST be written in a friendly, engaging Egyptian Arabic dialect, while keeping all medical terms, disease names, and drugs in English. Act like a friendly Egyptian doctor explaining the concepts clearly to a medical student.

### CONFIGURATION ###
- Difficulty Level: ${settings.difficulty}
- Question Type Focus: ${settings.quizType}

### DIFFICULTY & DISTRACTOR GUIDELINES ###
- Easy: First-order questions (e.g., Presentation -> Diagnosis).
- Medium: Second-order questions (e.g., Presentation -> Diagnosis -> Mechanism/Treatment).
- Hard: Third-order questions. Complex clinical scenarios with extremely plausible distractors based on common student misconceptions.
- ALL distractors MUST be realistic clinical entities, not fabricated or obvious throwaway terms.

### QUESTION TYPE GUIDELINES ###
- Direct Recall: Focus on memorization facts, pathognomonic signs, normal ranges, drug side effects, or direct associations. Do not use long clinical vignettes.
- Conceptual: Focus on pathophysiology, mechanisms of action, "why" something happens, or what happens if a physiological pathway is blocked.
- Except / Least Likely: Write questions testing exclusion. Format must be "All of the following are true EXCEPT..." or "Which of the following is the LEAST likely...". Provide 3 correct statements and 1 false statement.
- Mixed: Create a balanced mix of Direct Recall, Conceptual, and Except questions.

### OUTPUT FORMAT ###
Return a STRICTLY VALID JSON array. Do NOT wrap in markdown blocks like \`\`\`json.
[
  {
    "question": "The question text in English...",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": "Exact text of the correct choice",
    "explanation": {
      "correct": "شرح تفصيلي بالعامية المصرية مع مصطلحات إنجليزية يوضح ليه الإجابة دي صح...",
      "distractors": {
        "Option X": "ليه الاختيار ده غلط بالعامية المصرية...",
        "Option Y": "ليه الاختيار ده غلط...",
        "Option Z": "ليه الاختيار ده غلط..."
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
      } else if (activeTask === 'cases') {
        prompt = `You are an expert USMLE Step 2 CK board examiner and a senior Clinical Professor in Egypt. Your task is to generate 4 realistic, high-yield clinical vignette cases based STRICTLY on the provided lecture notes.

### VIGNETTE STRUCTURE & LANGUAGE ###
- The \`vignette\`, \`question\`, \`options\`, and \`correctAnswer\` MUST be written in formal, professional Medical English.
- The vignette MUST follow the standard USMLE structure: Age & Gender -> Chief Complaint -> History of Present Illness (HPI) -> Past Medical History (PMH) -> Physical Exam (including Vitals) -> Labs/Imaging (if applicable).
- The \`question\` should focus on clinical decision making (e.g., "What is the most appropriate next step in management?", "What is the best initial diagnostic test?", or "What is the most likely diagnosis?").
- The \`clinical_reasoning\` (explanation) and \`key_takeaway\` MUST be written in a friendly, engaging Egyptian Arabic dialect, thoroughly explaining the diagnostic workflow and why the correct option is the best step, while keeping all medical terms, disease names, and drugs in English.

### OUTPUT FORMAT ###
Return a STRICTLY VALID JSON array. Do NOT wrap in markdown blocks like \`\`\`json.
[
  {
    "vignette": "A 45-year-old male presents to the emergency department with...",
    "question": "What is the most appropriate next step in management?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": "Option A",
    "explanation": {
      "clinical_reasoning": "شرح تفصيلي بالعامية المصرية لخطوات التفكير السريري، وليه الخطوة دي هي الأهم دلوقتي، وليه باقي الاختيارات غلط أو مش وقتها...",
      "distractors": {
        "Option B": "ليه الاختيار ده غلط أو مش الخطوة الأولى...",
        "Option C": "ليه الاختيار ده ميتعملش دلوقتي..."
      }
    },
    "key_takeaway": "خلاصة سريعة جداً بالعامية المصرية (High-Yield Pearl) عن الفكرة اللي بيختبرها السؤال ده...",
    "topic": "Internal Medicine / Surgery / etc.",
    "difficulty": "USMLE Step 2 CK"
  }
]

### LECTURE NOTES ###
${textSnippet}`;
      } else if (activeTask === 'summary') {
        prompt = `You are an expert medical professor. Generate a high-yield summary for medical students based strictly on this lecture:
${textSnippet}

### SUMMARY DEPTH & STYLE ###
Selected Depth: ${settings.summaryDepth}
- If "Quick Review": Write ONLY ultra-concise bullet points, high-yield keywords, and bolded terms. Skip long explanations.
- If "Deep Dive": Write detailed, conversational explanations using friendly Egyptian Arabic mixed with Medical English. Explain every mechanism thoroughly.

### OUTPUT FORMAT ###
Return a STRICTLY VALID JSON array containing ONE object. Do NOT wrap in markdown blocks like \`\`\`json.
[
  {
    "topic": "Lecture Core Topic",
    "what_it_means": "Definition based on the selected depth...",
    "why_it_happens": "Pathophysiology based on the selected depth...",
    "presentation": "Clinical features based on the selected depth...",
    "diagnosis": "Investigations based on the selected depth...",
    "management": "Treatment based on the selected depth...",
    "exam_traps": "Pitfalls and high-yield traps..."
  }
]
`;
      } else if (activeTask === 'mnemonics') {
        prompt = `You are a clever medical student in Egypt famous for creating unforgettable memory aids and mnemonics. Generate 4 to 6 creative medical mnemonics based on this lecture:
${textSnippet}

### GUIDELINES ###
- Create mnemonics for the most difficult lists to remember (e.g., causes, drug side effects, symptoms).
- You can use English acronyms (like "MUDPILES") or creative Egyptian Arabic phrases that link the concepts together (تحشيشات طبية).
- Explain exactly what each letter or word stands for.

### OUTPUT FORMAT ###
Return a STRICTLY VALID JSON array. Do NOT wrap in markdown blocks like \`\`\`json.
[
  {
    "concept": "What are we trying to remember? (e.g., Causes of Acute Pancreatitis)",
    "mnemonic": "The acronym or funny phrase (e.g., GET SMASHED)",
    "breakdown": "G - Gallstones, E - Ethanol, T - Trauma, etc. (Explain each part clearly in English and Egyptian Arabic)"
  }
]
`;
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
      if (activeTask === 'mcqs') normalized = NormalizationEngine.mcqs(parsed);
      else if (activeTask === 'cases') normalized = NormalizationEngine.cases(parsed);
      else if (activeTask === 'summary') normalized = NormalizationEngine.summary(parsed);
      else if (activeTask === 'mnemonics') normalized = NormalizationEngine.mnemonics(parsed);
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
    const reviewIntervals = [
      { days: 0, task_type: 'summary' },
      { days: 1, task_type: 'mcqs' },
      { days: 3, task_type: 'summary' },
      { days: 7, task_type: 'cases' },
      { days: 14, task_type: 'anki' },
      { days: 30, task_type: 'anki' },
      { days: 60, task_type: 'anki' }
    ];
    const reviews = reviewIntervals.map((item, idx) => ({
      id: Date.now() + idx,
      review_number: idx,
      scheduled_date: new Date(baseDate.getTime() + item.days * 86400000).toISOString(),
      is_completed: false,
      task_type: item.task_type
    }));

    // Slice lecture notes to max 12,000 chars to protect localStorage
    const safeLectureText = (newLectureText || '').slice(0, 12000);

    setPlans([
      {
        id: Date.now(),
        name: newLecture.trim(),
        module_name: newModule.trim() || 'General',
        subject_name: newSubject.trim() || 'General Medicine',
        study_date: baseDate.toISOString(),
        lecture_text: safeLectureText,
        reviews: reviews
      },
      ...plans
    ]);
    setNewLecture(''); 
    setNewModule(''); 
    setNewSubject('');
    setNewLectureText('');
  };

  const toggleReviewCompletion = (planId, reviewId, feedback = 'easy') => {
    setPlans(plans.map(plan => {
      if (plan.id === planId) {
        const revIndex = plan.reviews.findIndex(r => r.id === reviewId);
        const updatedReviews = plan.reviews.map(r => r.id === reviewId ? { ...r, is_completed: true } : r);
        
        // Dynamic Feedback Loop: If "hard", shift the next pending review to Current Date + 2 days
        if (feedback === 'hard') {
          const nextPendingIndex = updatedReviews.findIndex((r, idx) => idx > revIndex && !r.is_completed);
          if (nextPendingIndex !== -1) {
            const nextDate = new Date();
            nextDate.setDate(nextDate.getDate() + 2);
            updatedReviews[nextPendingIndex] = {
              ...updatedReviews[nextPendingIndex],
              scheduled_date: nextDate.toISOString()
            };
          }
        }
        
        return {
          ...plan,
          reviews: updatedReviews
        };
      }
      return plan;
    }));
    setActiveReviewModal(null);
  };

  const startActiveReview = (plan, review) => {
    const taskType = review.task_type || getReviewConfig(review.review_number, appLanguage).task_type;
    const text = plan.lecture_text || lectureText || '';
    setSelectedTask(taskType);
    if (text) setLectureText(text);
    setCurrentRoute('study');
    setActiveReviewModal(null);
    if (text.trim() && apiKey) {
      handleGenerate(text, taskType);
    }
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

  // Calculate Overdue Reviews (strictly past today)
  const overdueReviewsCount = useMemo(() => {
    const today = getTodayStr();
    let count = 0;
    plans.forEach(plan => {
      plan.reviews?.forEach(r => {
        if (!r.is_completed && r.scheduled_date && r.scheduled_date.split('T')[0] < today) {
          count++;
        }
      });
    });
    return count;
  }, [plans]);

  // Triage Mode Handler (Auto-Catchup)
  const handleTriageMode = () => {
    if (confirm(t.planner.triageConfirm)) {
      const today = getTodayStr();
      setPlans(plans.map(plan => ({
        ...plan,
        reviews: plan.reviews.map(r => {
          const isOverdue = !r.is_completed && r.scheduled_date && r.scheduled_date.split('T')[0] < today;
          // Mark overdue Day 0, Day 1, and Day 3 (review_number 0, 1, 2) as completed
          if (isOverdue && (r.review_number === 0 || r.review_number === 1 || r.review_number === 2)) {
            return { ...r, is_completed: true };
          }
          return r;
        })
      })));
      alert(t.planner.triageAlert);
    }
  };

  const handlePlannerPdfUpload = async (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;

    setIsExtractingPlannerPdf(true);
    setPlannerPdfProgress({ current: 0, total: 0 });

    try {
      const extracted = await extractTextFromFile(uploadedFile, 25, (prog) => {
        setPlannerPdfProgress(prog);
      });
      setNewLectureText(extracted);
      if (!newLecture.trim()) {
        const cleanName = uploadedFile.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
        setNewLecture(cleanName);
      }
    } catch (err) {
      console.error("Extraction error:", err);
      alert("Failed to read PDF: " + err.message);
    } finally {
      setIsExtractingPlannerPdf(false);
      setPlannerPdfProgress(null);
    }
  };

  // Group reviews due today and overdue for Actionable Daily Agenda
  const todayDueList = useMemo(() => {
    const today = getTodayStr();
    const list = [];
    plans.forEach(plan => {
      plan.reviews?.forEach(rev => {
        const dateStr = rev.scheduled_date ? rev.scheduled_date.split('T')[0] : '';
        if (!rev.is_completed && dateStr <= today) {
          list.push({
            plan,
            review: rev,
            isOverdue: dateStr < today,
            isToday: dateStr === today
          });
        }
      });
    });
    return list;
  }, [plans]);

  // Group all scheduled reviews by date for the Interactive Calendar
  const reviewsByDate = useMemo(() => {
    const map = {};
    plans.forEach(plan => {
      plan.reviews?.forEach(rev => {
        if (!rev.scheduled_date) return;
        const dateKey = rev.scheduled_date.split('T')[0];
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push({ plan, review: rev });
      });
    });
    return map;
  }, [plans]);

  // Calendar navigation helpers
  const getCalendarDays = useCallback(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const monthStr = String(month + 1).padStart(2, '0');
      const dayStr = String(d).padStart(2, '0');
      const fullDateStr = `${year}-${monthStr}-${dayStr}`;
      days.push({ dayNumber: d, dateStr: fullDateStr });
    }
    return days;
  }, [calendarDate]);

  const navItems = [
    { id: 'dashboard', label: t.nav.dashboard, icon: <Home size={18}/> },
    { id: 'study_hub', label: t.nav.study_hub, icon: <BookOpen size={18}/> },
    { id: 'medpatient', label: t.nav.medpatient, icon: <Stethoscope size={18}/> },
    { id: 'planner', label: t.nav.planner, icon: <CalendarDays size={18}/> },
    { id: 'tasks', label: t.nav.tasks, icon: <CheckSquare size={18}/> },
    { id: 'highyield_track', label: t.nav.highyield_track, icon: <Activity size={18}/> },
    { id: 'settings', label: t.nav.settings, icon: <Settings size={18}/> },
  ];

  const tools = [
    { id: 'mcqs', name: t.tools.mcqs.name, desc: t.tools.mcqs.desc, icon: <HelpCircle size={28} /> },
    { id: 'cases', name: t.tools.cases.name, desc: t.tools.cases.desc, icon: <Stethoscope size={28} /> },
    { id: 'summary', name: t.tools.summary.name, desc: t.tools.summary.desc, icon: <BookOpen size={28} /> },
    { id: 'anki', name: t.tools.anki.name, desc: t.tools.anki.desc, icon: <BrainCircuit size={28} /> },
    { id: 'mnemonics', name: t.tools.mnemonics.name, desc: t.tools.mnemonics.desc, icon: <Sparkles size={28} /> },
  ];

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-[#F0F3F5] text-slate-700 font-sans relative overflow-hidden" dir={appLanguage === 'ar' ? 'rtl' : 'ltr'}>
        
        {/* The "Living" Mesh Background */}
        <motion.div 
          className="fixed inset-0 pointer-events-none z-0"
          animate={{ 
            backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'],
            scale: [1, 1.05, 1]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-cyan-100/50 via-transparent to-emerald-100/50 blur-[100px] opacity-60" />
        </motion.div>
        
        {/* Focus Timer Modal */}
        {activeFocusTask && (
          <FocusTimerOverlay task={activeFocusTask} onClose={() => setActiveFocusTask(null)} appLanguage={appLanguage} />
        )}

        {/* API Key Modal */}
        {showApiKeyModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <Card className="p-6 w-full max-w-md shadow-[8px_8px_16px_#d1d5db,-8px_-8px_16px_#ffffff] bg-[#F0F3F5] animate-in fade-in zoom-in-95 border-none">
              <h3 className="text-xl font-bold mb-2 flex items-center gap-2 text-slate-700">
                <Key className="text-cyan-600"/> {t.apiKeyModal.title}
              </h3>
              <p className="text-sm text-slate-500 mb-2">
                {t.apiKeyModal.desc}
              </p>
              <p className="text-xs text-slate-500 mb-4">
                Get your API key here: <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noreferrer" className="text-cyan-600 underline font-bold">API keys | Google AI Studio</a>
              </p>
              <input 
                type="password" 
                placeholder="AIzaSy..." 
                value={tempKeyInput} 
                onChange={e => setTempKeyInput(e.target.value)} 
                className="w-full border p-3 rounded-xl bg-white dark:bg-slate-800 mb-4 outline-none border-slate-200 dark:border-slate-700 text-sm focus:border-teal-500" 
              />
              <Button variant="primary" onClick={saveApiKey} className="w-full bg-teal-600 py-3 font-bold">
                {t.apiKeyModal.save}
              </Button>
            </Card>
          </div>
        )}

        {/* Active Progressive Recall Review Modal */}
        {activeReviewModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <Card className="p-6 w-full max-w-lg shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 space-y-5">
              <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300">
                      {activeReviewModal.plan.module_name} • {activeReviewModal.plan.subject_name}
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatDate(activeReviewModal.review.scheduled_date)}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">
                    {activeReviewModal.plan.name}
                  </h3>
                </div>
                <button 
                  onClick={() => setActiveReviewModal(null)} 
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
                >
                  <X size={20}/>
                </button>
              </div>

              {(() => {
                const config = getReviewConfig(activeReviewModal.review.review_number, appLanguage);
                const taskType = activeReviewModal.review.task_type || config.task_type;
                const taskName = config.task_name;

                return (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500">{t.planner.stageLabel}</span>
                        <span className="text-xs font-bold text-teal-600 dark:text-teal-400 flex items-center gap-1">
                          <span>{REVIEW_ICON_MAP[config.iconName]}</span> {config.title}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500">{t.planner.assignedTask}</span>
                        <span className="text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 px-2 py-0.5 rounded">
                          {taskName}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500">{t.planner.focusLabel}</span>
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          {config.focus}
                        </span>
                      </div>
                    </div>

                    {/* Primary Button: Generate and Start Review */}
                    <Button
                      variant="primary"
                      onClick={() => startActiveReview(activeReviewModal.plan, activeReviewModal.review)}
                      className="w-full bg-teal-600 hover:bg-teal-700 py-3 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-600/20"
                    >
                      <Sparkles size={16}/> {t.planner.generateAndStart} ({taskName})
                    </Button>

                    {/* Dynamic Feedback Loop: Easy / Hard */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                      <p className="text-xs font-bold text-slate-500 mb-2.5">{t.planner.feedbackHeading}</p>
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          variant="outline"
                          onClick={() => toggleReviewCompletion(activeReviewModal.plan.id, activeReviewModal.review.id, 'hard')}
                          className="border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-amber-700 dark:text-amber-300 text-xs font-bold py-2.5 flex items-center justify-center gap-1.5"
                        >
                          {t.planner.hardBtn}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => toggleReviewCompletion(activeReviewModal.plan.id, activeReviewModal.review.id, 'easy')}
                          className="border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold py-2.5 flex items-center justify-center gap-1.5"
                        >
                          {t.planner.easyBtn}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </Card>
          </div>
        )}

        {/* Interactive Study Calendar Modal */}
        {showCalendarModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <Card className="p-6 w-full max-w-3xl shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 space-y-5 max-h-[90vh] overflow-y-auto">
              {/* Calendar Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded-xl">
                    <CalendarDays size={22} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                      {t.planner.calendarModalTitle}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {calendarDate.toLocaleDateString(appLanguage === 'ar' ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Month Navigation */}
                  <button
                    onClick={() => {
                      const d = new Date(calendarDate);
                      d.setMonth(d.getMonth() - 1);
                      setCalendarDate(d);
                    }}
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold"
                  >
                    ◀
                  </button>
                  <button
                    onClick={() => setCalendarDate(new Date())}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                  >
                    {appLanguage === 'ar' ? 'اليوم' : 'Today'}
                  </button>
                  <button
                    onClick={() => {
                      const d = new Date(calendarDate);
                      d.setMonth(d.getMonth() + 1);
                      setCalendarDate(d);
                    }}
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold"
                  >
                    ▶
                  </button>
                  <button
                    onClick={() => setShowCalendarModal(false)}
                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 ml-2"
                  >
                    <X size={20}/>
                  </button>
                </div>
              </div>

              {/* Days of Week Header */}
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-400 uppercase py-1">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName, idx) => (
                  <div key={idx} className="p-1">
                    {appLanguage === 'ar' 
                      ? ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][idx]
                      : dayName}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1.5">
                {getCalendarDays().map((dayItem, idx) => {
                  if (!dayItem) {
                    return <div key={`empty-${idx}`} className="h-20 rounded-xl bg-slate-50/50 dark:bg-slate-800/20 border border-transparent"></div>;
                  }

                  const { dayNumber, dateStr } = dayItem;
                  const dayReviews = reviewsByDate[dateStr] || [];
                  const isToday = dateStr === getTodayStr();
                  const isSelected = selectedCalendarDay === dateStr;

                  return (
                    <div
                      key={dateStr}
                      onClick={() => setSelectedCalendarDay(isSelected ? null : dateStr)}
                      className={`h-20 p-1.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between select-none ${
                        isSelected
                          ? 'border-teal-500 ring-2 ring-teal-500/20 bg-teal-50/60 dark:bg-teal-900/30'
                          : isToday
                            ? 'border-amber-400 bg-amber-50/40 dark:bg-amber-950/20 font-bold'
                            : dayReviews.length > 0
                              ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 hover:border-teal-300'
                              : 'border-slate-100 dark:border-slate-800/40 bg-slate-50/40 dark:bg-slate-900/40 opacity-75'
                      }`}
<div className="flex justify-between items-center">
                        <span className={`text-xs ${isToday ? 'px-1.5 py-0.5 rounded-full bg-amber-500 text-white font-extrabold text-[10px]' : 'font-bold'}`}>
                          {dayNumber}
                        </span>
                      </div>
                      {/* Task Badges preview */}
                      <div className="space-y-0.5 overflow-hidden">
                        {dayReviews.slice(0, 2).map((item, rIdx) => {
                          const cfg = getReviewConfig(item.review.review_number, appLanguage);
                          return (
                            <div 
                              key={rIdx} 
                              className={`text-[9px] truncate px-1 py-0.5 rounded flex items-center gap-1 ${
                                item.review.is_completed 
                                  ? 'bg-emerald-100/60 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 line-through' 
                                  : 'bg-slate-100 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 font-medium'
                              }`}
                            >
                              <span>{cfg.icon}</span>
                              <span className="truncate">{item.plan.name}</span>
                            </div>
                          );
                        })}
                        {dayReviews.length > 2 && (
                          <span className="text-[8px] text-slate-400 block text-center font-bold">
                            +{dayReviews.length - 2}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Selected Day Agenda Drawer */}
              {selectedCalendarDay && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-3 animate-in fade-in">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <CalendarDays size={16} className="text-teal-600"/>
                      <span>{appLanguage === 'ar' ? 'مراجعات ومحاضرات يوم:' : 'Scheduled for:'}</span> {formatDate(selectedCalendarDay)}
                    </h4>
                    <span className="text-xs text-slate-500 font-bold">
                      {(reviewsByDate[selectedCalendarDay] || []).length} {t.planner.reviewsCount}
                    </span>
                  </div>

                  {(reviewsByDate[selectedCalendarDay] || []).length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-2">{appLanguage === 'ar' ? 'مفيش مراجعات مجدولة في هذا اليوم.' : 'No reviews scheduled on this date.'}</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(reviewsByDate[selectedCalendarDay] || []).map((item, idx) => {
                        const config = getReviewConfig(item.review.review_number, appLanguage);
                        return (
                          <div key={idx} className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex justify-between items-center gap-3">
                            <div className="min-w-0">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300">
                                {item.plan.module_name}
                              </span>
                              <h5 className="font-bold text-xs truncate mt-1 text-slate-900 dark:text-white">{item.plan.name}</h5>
                              <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                <span>{REVIEW_ICON_MAP[config.iconName]}</span> {config.title} • <span className="font-semibold text-purple-600 dark:text-purple-400">{config.task_name}</span>
                              </p>
                            </div>
                            <Button
                              variant="primary"
                              onClick={() => {
                                setShowCalendarModal(false);
                                setActiveReviewModal({ plan: item.plan, review: item.review });
                              }}
                              className="bg-teal-600 hover:bg-teal-700 text-xs py-1.5 px-3 whitespace-nowrap font-bold shrink-0"
                            >
                              {item.review.is_completed ? <Check size={14} className="mx-1" /> : <Play size={12} className="mx-1"/>}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
        )}

        <div className="flex h-screen bg-slate-50 text-slate-800 font-sans relative overflow-hidden" dir={appLanguage === 'ar' ? 'rtl' : 'ltr'}>
        
        {/* The "Living" Mesh Background */}
        <motion.div 
          className="fixed inset-0 pointer-events-none z-0"
          animate={{ backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'], scale: [1, 1.05, 1] }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-blue-50/40 via-transparent to-emerald-50/40 blur-[100px]" />
        </motion.div>
        
        {/* Focus Timer Modal */}
        {activeFocusTask && (
          <FocusTimerOverlay task={activeFocusTask} onClose={() => setActiveFocusTask(null)} appLanguage={appLanguage} />
        )}

        {/* API Key Modal */}
        {showApiKeyModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <Card className="p-6 w-full max-w-md shadow-sm border border-slate-200 bg-white animate-in fade-in zoom-in-95">
              <h3 className="text-xl font-bold mb-2 flex items-center gap-2 text-slate-900">
                <Key className="text-blue-600"/> {t.apiKeyModal.title}
              </h3>
              <p className="text-sm text-slate-500 mb-2">
                {t.apiKeyModal.desc}
              </p>
              <p className="text-xs text-slate-500 mb-4">
                Get your API key here: <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noreferrer" className="text-blue-600 underline font-bold">API keys | Google AI Studio</a>
              </p>
              <input 
                type="password" 
                placeholder="AIzaSy..." 
                value={tempKeyInput}
                onChange={e => setTempKeyInput(e.target.value)}
                className="w-full border border-slate-200 p-3 rounded-xl bg-slate-50 text-slate-900 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" 
              />
              <Button 
                variant="primary" 
                onClick={() => { setApiKey(tempKeyInput); setShowApiKeyModal(false); }} 
                className="mt-4 w-full bg-blue-600 hover:bg-blue-700 font-bold shadow-sm"
              >
                {t.apiKeyModal.saveBtn}
              </Button>
            </Card>
          </div>
        )}

        {/* Calendar Modal */}
        {showCalendarModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <Card className="p-0 w-full max-w-2xl bg-white shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <CalendarDays className="text-blue-600"/> {t.nav.planner}
                </h3>
                <button onClick={() => setShowCalendarModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                  <X size={20}/>
                </button>
              </div>
              <div className="p-4 overflow-y-auto bg-slate-50">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-slate-800 text-lg">
                    {calendarDate.toLocaleString(appLanguage === 'ar' ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' })}
                  </h4>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))} className="p-2 border-slate-200 text-slate-600 hover:bg-slate-100">
                      ←
                    </Button>
                    <Button variant="outline" onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))} className="p-2 border-slate-200 text-slate-600 hover:bg-slate-100">
                      →
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
                  {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day => (
                    <div key={day} className="text-center text-xs font-bold text-slate-400 uppercase">{day}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1 sm:gap-2">
                  {calendarDays.map((d, i) => {
                    const hasItems = getReviewsForDate(d.dateStr).length > 0;
                    const isSelected = selectedCalendarDay === d.dateStr;
                    return (
                      <div 
                        key={i} 
                        onClick={() => setSelectedCalendarDay(d.dateStr)}
                        className={`aspect-square p-1 sm:p-2 rounded-xl border flex flex-col items-center justify-center cursor-pointer transition-all ${
                          isSelected ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/20' : 
                          hasItems ? 'border-emerald-200 bg-emerald-50/30 hover:border-emerald-300' : 'border-slate-100 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <span className={`text-sm sm:text-base font-bold ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>{d.dayNumber}</span>
                        {hasItems && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1"></div>}
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {selectedCalendarDay && (
                <div className="p-4 border-t border-slate-100 bg-white flex-1 overflow-y-auto">
                  <h4 className="font-bold text-sm text-slate-500 mb-3 uppercase tracking-wider">
                    {t.calendar.tasksFor} {new Date(selectedCalendarDay).toLocaleDateString(appLanguage === 'ar' ? 'ar-EG' : 'en-US')}
                  </h4>
                  {getReviewsForDate(selectedCalendarDay).length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4 bg-slate-50 rounded-xl border border-slate-100 border-dashed">{t.calendar.noTasks}</p>
                  ) : (
                    <div className="space-y-2">
                      {getReviewsForDate(selectedCalendarDay).map((item, idx) => {
                        const config = getReviewConfig(item.review.review_number, appLanguage);
                        return (
                          <div key={idx} className="p-3 bg-white rounded-xl border border-slate-200 flex justify-between items-center gap-3">
                            <div className="min-w-0">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                                {item.plan.module_name}
                              </span>
                              <h5 className="font-bold text-xs truncate mt-1 text-slate-900">{item.plan.name}</h5>
                              <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                <span>{REVIEW_ICON_MAP[config.iconName]}</span> {config.title} • <span className="font-semibold text-emerald-600">{config.task_name}</span>
                              </p>
                            </div>
                            <Button
                              variant="primary"
                              onClick={() => {
                                setShowCalendarModal(false);
                                setActiveReviewModal({ plan: item.plan, review: item.review });
                              }}
                              className="bg-blue-600 hover:bg-blue-700 text-xs py-1.5 px-3 whitespace-nowrap font-bold shrink-0 shadow-sm"
                            >
                              {item.review.is_completed ? <Check size={14} className="mx-1" /> : <Play size={12} className="mx-1"/>}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Clean White Sidebar */}
        <aside className="w-20 m-4 flex-shrink-0 bg-white/90 backdrop-blur-md shadow-sm border border-slate-200 rounded-3xl flex flex-col items-center py-6 gap-6 z-20">
          <div className="flex flex-col gap-4 w-full px-3">
            {navItems.map((item) => {
              const isActive = currentRoute === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentRoute(item.id)}
                  className={`p-3 rounded-2xl transition-all w-full flex justify-center ${
                    isActive 
                      ? 'bg-blue-50 text-blue-600 font-bold' 
                      : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                  }`}
                  title={item.label}
                >
                  {item.icon}
                </button>
              );
            })}
          </div>
          
          {/* Settings & API Key at the bottom */}
          <div className="mt-auto flex flex-col gap-4 w-full px-3">
            <button onClick={() => setShowApiKeyModal(true)} className="p-3 w-full flex justify-center rounded-2xl text-slate-400 hover:bg-slate-50 hover:text-slate-600">
              <Key size={18} />
            </button>
            <button onClick={() => setCurrentRoute('settings')} className="p-3 w-full flex justify-center rounded-2xl text-slate-400 hover:bg-slate-50 hover:text-slate-600">
              <Settings size={18} />
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col h-screen relative z-10 py-4 pr-4">
          
          {/* Crisp White HUD */}
          <header className="h-16 flex-shrink-0 bg-white shadow-sm border border-slate-200 rounded-2xl px-8 flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <h1 className="font-extrabold text-lg tracking-widest text-slate-900 uppercase">MedOS</h1>
              <div className="h-6 w-px bg-slate-200 mx-2"></div>
              {/* Level Badge */}
              <div className="px-4 py-1.5 rounded-full bg-slate-50 border border-slate-200 flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">LVL {userStats.level}</span>
                <span className="text-xs font-bold text-slate-800">{userStats.title}</span>
              </div>
            </div>

            <div className="flex items-center gap-6">
              {/* XP Progress */}
              <div className="flex flex-col gap-1 min-w-[150px]">
                <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <span>XP Progress</span>
                  <span>{userStats.xp % 500} / 500</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${((userStats.xp % 500) / 500) * 100}%` }}></div>
                </div>
              </div>
              {/* Streak */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-50 border border-orange-100 text-orange-600 font-bold text-sm">
                🔥 {userStats.streak} 
              </div>
            </div>
          </header>

          {/* Content View */}
          <div className="flex-1 overflow-y-auto bg-transparent p-4 sm:p-8">
            <div className="max-w-[1100px] mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentRoute}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.03 }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
                className="h-full"
              >
            
            {/* Dashboard View */}
            {currentRoute === 'dashboard' && (
              <div className="space-y-8 animate-in fade-in">
                {/* Minimalist Hero Banner */}
                <div className="relative overflow-hidden rounded-3xl bg-white border border-slate-200 p-6 sm:p-8 shadow-sm">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                    <div className="md:col-span-2 space-y-3 z-10">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-xs font-bold">
                        <Sparkles size={14} className="text-blue-500 animate-pulse"/> MedOS Clinical AI & 3D Core
                      </div>
                      <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
                        {t.dashboard.title}
                      </h2>
                      <p className="text-sm text-slate-500 leading-relaxed max-w-lg">
                        {t.dashboard.subtitle}
                      </p>
                      <div className="pt-2 flex flex-wrap gap-3">
                        <Button 
                          variant="primary" 
                          onClick={() => setActiveFocusTask({ title: appLanguage === 'ar' ? "جلسة مذاكرة طبية مركزة" : "Deep Medical Study Session" })} 
                          className="shadow-sm bg-blue-600 hover:bg-blue-700 py-3 px-6 text-sm font-bold"
                        >
                          <Play size={16} className="mx-1"/> {t.dashboard.quickFocus}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setCurrentRoute('study_hub')}
                          className="text-xs py-3 px-5 font-bold border-slate-200 text-slate-600 hover:bg-slate-50"
                        >
                          <BookOpen size={16} className="mx-1 text-blue-600"/> {t.dashboard.openStudyTools}
                        </Button>
                      </div>
                    </div>
                    <div className="flex justify-center md:justify-end">
                      <KnowledgeBrain3D userStats={userStats} className="transform scale-95 hover:scale-105 transition-transform duration-500" />
                    </div>
                  </div>
                </div>

                {/* Minimalist Stat Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  <Card className="p-6 border border-slate-100 bg-white shadow-sm rounded-3xl flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t.dashboard.pendingTasks}</span>
                      <h3 className="text-4xl font-extrabold text-slate-900 mt-1">{tasks.filter(t => !t.is_completed).length}</h3>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500">
                      <CheckSquare size={24} />
                    </div>
                  </Card>
                  
                  <Card className="p-6 border border-slate-100 bg-white shadow-sm rounded-3xl flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t.dashboard.dueReviews}</span>
                      <h3 className="text-4xl font-extrabold text-slate-900 mt-1">{dueReviewsCount}</h3>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500">
                      <RotateCcw size={24} />
                    </div>
                  </Card>

                  <Card className="p-6 border border-slate-100 bg-white shadow-sm rounded-3xl flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t.dashboard.activePlans}</span>
                      <h3 className="text-4xl font-extrabold text-slate-900 mt-1">{plans.length}</h3>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500">
                      <CalendarDays size={24} />
                    </div>
                  </Card>

                  <Card className="p-6 border border-slate-100 bg-white shadow-sm rounded-3xl flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t.dashboard.mistakesTracked}</span>
                      <h3 className="text-4xl font-extrabold text-slate-900 mt-1">{mistakes.length}</h3>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500">
                      <Activity size={24} />
                    </div>
                  </Card>
                </div>

                {/* Quick Navigation Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <Card className="p-6 space-y-4 border border-slate-100 bg-white shadow-sm rounded-3xl hover:border-blue-200 hover:shadow-md transition-all cursor-pointer group" onClick={() => setCurrentRoute('study_hub')}>
                    <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <BookOpen size={28}/>
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-slate-900">{t.dashboard.generatorCardTitle}</h3>
                      <p className="text-sm text-slate-500 mt-1">{t.dashboard.generatorCardDesc}</p>
                    </div>
                    <span className="text-sm font-bold text-blue-600 flex items-center gap-1">{t.dashboard.openStudyTools} <ArrowRight size={14}/></span>
                  </Card>

                  <Card className="p-6 space-y-4 border border-slate-100 bg-white shadow-sm rounded-3xl hover:border-emerald-200 hover:shadow-md transition-all cursor-pointer group" onClick={() => setCurrentRoute('medpatient')}>
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Stethoscope size={28}/>
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-slate-900">{t.dashboard.patientCardTitle}</h3>
                      <p className="text-sm text-slate-500 mt-1">{t.dashboard.patientCardDesc}</p>
                    </div>
                    <span className="text-sm font-bold text-emerald-600 flex items-center gap-1">{t.dashboard.startPatientCase} <ArrowRight size={14}/></span>
                  </Card>
                </div>
              </div>
            )}

            {/* Study Hub View */}
            {currentRoute === 'study_hub' && (
              <div className="space-y-8 animate-in fade-in">
                <div>
                  <h2 className="text-3xl font-bold">{t.studyHub.title}</h2>
                  <p className="text-sm text-slate-500 mt-1">{t.studyHub.subtitle}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {tools.map(toolItem => (
                    <Card 
                      key={toolItem.id} 
                      onClick={() => { setSelectedTask(toolItem.id); setCurrentRoute('study'); }} 
                      className="p-6 cursor-pointer hover:border-teal-500 transition-all space-y-3 dark:bg-slate-900"
                    >
                      <div className="text-teal-600 mb-2">{toolItem.icon}</div>
                      <h3 className="font-bold text-xl">{toolItem.name}</h3>
                      <p className="text-sm text-slate-500">{toolItem.desc}</p>
                      <span className="text-xs font-bold text-teal-600 flex items-center gap-1 pt-2">{t.studyHub.launch} <ChevronRight size={14} className={appLanguage === 'ar' ? 'rotate-180' : ''}/></span>
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
                    <ChevronRight className={appLanguage === 'ar' ? '' : 'rotate-180'} size={20}/>
                  </Button>
                  <div>
                    <h2 className="text-3xl font-bold capitalize">{t.tools[selectedTask]?.name || selectedTask}</h2>
                    <p className="text-xs text-slate-500">{t.generator.subtitle}</p>
                  </div>
                </div>

                {/* Upload or Direct Paste Section */}
                <div className="space-y-4">
                  {!file ? (
                    <div className="space-y-4">
                      <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-3xl cursor-pointer bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-teal-500 transition-all">
                        <UploadCloud size={36} className="text-teal-600 mb-2"/>
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{t.generator.uploadTitle}</span>
                        <span className="text-xs text-slate-400 mt-1">{t.generator.uploadSubtitle}</span>
                        <input type="file" accept=".pdf,.txt,.md" className="hidden" onChange={handleFileUpload} />
                      </label>
                      <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
                        <span className="flex-shrink mx-4 text-xs uppercase font-bold text-slate-400">{t.generator.orPaste}</span>
                        <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
                      </div>
                      <textarea 
                        rows={4}
                        placeholder={t.generator.pastePlaceholder}
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
                            {isExtractingPdf ? `${t.generator.extracting} ${pdfExtractionProgress?.current || 0}/${pdfExtractionProgress?.total || 0} ${t.generator.pages}` : `${t.generator.extractedChars} ${lectureText.length}`}
                          </p>
                        </div>
                      </div>
                      <Button variant="danger" onClick={() => { setFile(null); setLectureText(''); setGeneratedPayload(null); }}>
                        {t.generator.remove}
                      </Button>
                    </Card>
                  )}

                  {/* Study Material Configuration Panel */}
                  <Card className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 block">
                      {t.generator.settingsTitle}
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">{t.generator.difficulty}</label>
                        <select 
                          value={settings.difficulty} 
                          onChange={e => setSettings(prev => ({ ...prev, difficulty: e.target.value }))}
                          className="w-full p-2.5 border rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-sm outline-none focus:border-teal-500 text-slate-900 dark:text-slate-100"
                        >
                          <option value="Easy">{t.generator.easy}</option>
                          <option value="Medium">{t.generator.medium}</option>
                          <option value="Hard">{t.generator.hard}</option>
                        </select>
                      </div>

                      {selectedTask === 'summary' && (
                        <div>
                          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">{t.generator.summaryDepth}</label>
                          <select 
                            value={settings.summaryDepth} 
                            onChange={e => setSettings(prev => ({ ...prev, summaryDepth: e.target.value }))}
                            className="w-full p-2.5 border rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-sm outline-none focus:border-teal-500 text-slate-900 dark:text-slate-100"
                          >
                            <option value="Quick Review">{t.generator.quickReview}</option>
                            <option value="Deep Dive">{t.generator.deepDive}</option>
                          </select>
                        </div>
                      )}

                      {selectedTask === 'mcqs' && (
                        <div>
                          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">{t.generator.mcqType}</label>
                          <select 
                            value={settings.quizType} 
                            onChange={e => setSettings(prev => ({ ...prev, quizType: e.target.value }))}
                            className="w-full p-2.5 border rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-sm outline-none focus:border-teal-500 text-slate-900 dark:text-slate-100"
                          >
                            <option value="Direct Recall">{t.generator.directRecall}</option>
                            <option value="Conceptual">{t.generator.conceptual}</option>
                            <option value="Except / Least Likely">{t.generator.except}</option>
                            <option value="Mixed">{t.generator.mixed}</option>
                          </select>
                        </div>
                      )}

                      {selectedTask === 'mcqs' && (
                        <div>
                          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">{t.generator.mcqCount}</label>
                          <select 
                            value={settings.mcqCount} 
                            onChange={e => setSettings(prev => ({ ...prev, mcqCount: e.target.value }))}
                            className="w-full p-2.5 border rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-sm outline-none focus:border-teal-500 text-slate-900 dark:text-slate-100"
                          >
                            <option value="3">3 {t.generator.questionsCountSuffix}</option>
                            <option value="5">5 {t.generator.questionsCountSuffix}</option>
                            <option value="10">10 {t.generator.questionsCountSuffix}</option>
                            <option value="15">15 {t.generator.questionsCountSuffix}</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </Card>

                  {/* Generation Trigger Button */}
                  {(file || lectureText.trim().length > 0) && (
                    <Button 
                      variant="primary" 
                      onClick={handleGenerate} 
                      disabled={isGenerating || isExtractingPdf} 
                      className="w-full bg-teal-600 hover:bg-teal-700 py-4 font-bold text-base shadow-lg shadow-teal-600/20"
                    >
                      {isGenerating ? <Loader2 className="animate-spin mx-2"/> : <Play className="mx-2"/>} 
                      {t.generator.generateBtn}
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
                          <h3 className="font-bold text-xl">{t.generator.generatedMCQs} ({generatedPayload.length})</h3>
                        </div>
                        {generatedPayload.map((item, idx) => (
                          <MCQRenderer key={item.id || idx} data={item} idx={idx + 1} />
                        ))}
                      </div>
                    )}

                    {selectedTask === 'cases' && (
                      <div className="space-y-4">
                        <h3 className="font-bold text-xl">{t.generator.generatedCases} ({generatedPayload.length})</h3>
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
                        <h3 className="font-bold text-xl">{t.generator.generatedAnki} ({generatedPayload.length})</h3>
                        <AnkiWorkspace initialCards={generatedPayload} fileName={file?.name?.replace(/\.[^/.]+$/, '') || 'MedOS_Anki_Deck'} />
                      </div>
                    )}

                    {selectedTask === 'mnemonics' && (
                      <div className="space-y-4">
                        <h3 className="font-bold text-xl flex items-center gap-2">
                          <Sparkles className="text-amber-500" size={22}/> {t.generator.generatedMnemonics} ({generatedPayload.length})
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          {generatedPayload.map((item, idx) => (
                            <Card key={item.id || idx} className="p-6 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm hover:border-teal-500/50 transition-all">
                              <div className="flex justify-between items-start">
                                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                                  {t.generator.mnemonicBadge}{idx + 1}
                                </span>
                              </div>
                              <h4 className="font-bold text-base text-slate-900 dark:text-white leading-snug">
                                {item.concept}
                              </h4>
                              <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 text-center">
                                <span className="text-xs font-bold uppercase tracking-widest text-teal-700 dark:text-teal-400 block mb-1">{t.generator.memoryHook}</span>
                                <span className="text-xl font-extrabold text-teal-900 dark:text-teal-200 tracking-wide font-mono">
                                  {item.mnemonic}
                                </span>
                              </div>
                              <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap pt-1">
                                <span className="font-bold text-xs text-slate-500 dark:text-slate-400 block mb-1">{t.generator.breakdown}</span>
                                {item.breakdown}
                              </div>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Virtual Patient View */}
            {currentRoute === 'medpatient' && (
              <MedPatientView apiKey={apiKey} onShowKeyModal={() => setShowApiKeyModal(true)} appLanguage={appLanguage} />
            )}

            {/* Tasks Management View */}
            {currentRoute === 'tasks' && (
              <div className="space-y-6 max-w-3xl animate-in fade-in">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-3xl font-bold">{t.tasks.title}</h2>
                    <p className="text-sm text-slate-500">{t.tasks.subtitle}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder={t.tasks.placeholder} 
                    value={newTaskInput} 
                    onChange={e => setNewTaskInput(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && addTask()}
                    className="flex-1 p-3.5 border rounded-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-sm outline-none focus:border-teal-500" 
                  />
                  <Button variant="primary" onClick={addTask} className="bg-teal-600 px-6 rounded-2xl">
                    <Plus size={18} className="mx-1"/> {t.tasks.add}
                  </Button>
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                  {[
                    { id: 'all', label: t.tasks.tabAll, count: tasks.length },
                    { id: 'active', label: t.tasks.tabActive, count: tasks.filter(t => !t.is_completed).length },
                    { id: 'completed', label: t.tasks.tabCompleted, count: tasks.filter(t => t.is_completed).length }
                  ].map(tab => (
                    <button 
                      key={tab.id} 
                      onClick={() => setTaskFilter(tab.id)} 
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                        taskFilter === tab.id 
                          ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300' 
                          : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {tab.label} ({tab.count})
                    </button>
                  ))}
                </div>

                {/* Task List */}
                <div className="space-y-3">
                  {filteredTasks.length === 0 ? (
                    <Card className="p-8 text-center text-slate-400 border-dashed">
                      <p className="text-sm">{t.tasks.empty}</p>
                    </Card>
                  ) : (
                    filteredTasks.map(taskItem => (
                      <Card key={taskItem.id} className="p-4 flex items-center justify-between gap-4 dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition-all">
                        <div className="flex items-center gap-3 flex-1">
                          <button 
                            onClick={() => toggleTaskCompletion(taskItem.id)} 
                            className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all ${
                              taskItem.is_completed 
                                ? 'bg-teal-600 border-teal-600 text-white' 
                                : 'border-slate-300 dark:border-slate-700 hover:border-teal-500'
                            }`}
                          >
                            {taskItem.is_completed && <Check size={14}/>}
                          </button>
                          <span className={`text-sm font-medium ${taskItem.is_completed ? 'line-through text-slate-400' : 'text-slate-900 dark:text-slate-100'}`}>
                            {taskItem.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="secondary" 
                            className="text-xs py-1.5 px-3 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 hover:bg-teal-100" 
                            onClick={() => setActiveFocusTask(taskItem)}
                          >
                            <Play size={12} className="mx-1"/> {t.tasks.focus}
                          </Button>
                          <Button variant="danger" className="p-2" onClick={() => deleteTask(taskItem.id)}>
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
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h2 className="text-3xl font-bold flex items-center gap-3">
                      <span>🧠</span> {t.planner.title}
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">{t.planner.subtitle}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Open Interactive Calendar Button */}
                    <Button 
                      variant="secondary" 
                      onClick={() => setShowCalendarModal(true)} 
                      className="bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 text-xs font-bold px-3.5 py-2.5 shadow-sm flex items-center gap-1.5 hover:bg-teal-100 dark:hover:bg-teal-900/50"
                    >
                      <CalendarDays size={15}/> {t.planner.calendarBtn}
                    </Button>

                    {overdueReviewsCount > 0 && (
                      <Button 
                        variant="primary" 
                        onClick={handleTriageMode} 
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-3.5 py-2.5 shadow-md flex items-center gap-1.5"
                      >
                        <Sparkles size={14}/> {t.planner.triageButton} ({overdueReviewsCount})
                      </Button>
                    )}
                  </div>
                </div>

                {/* Overdue Triage Alert Banner */}
                {overdueReviewsCount > 0 && (
                  <Card className="p-4 bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-transparent border border-amber-300 dark:border-amber-700/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl shrink-0">
                        <Activity size={22} />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                          {t.planner.triageBadge} <span className="text-rose-600 font-extrabold">{overdueReviewsCount}</span>
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {appLanguage === 'ar' 
                            ? "اضغط على وضع الطوارئ لتصفية المراحل الأولية المتأخرة والتركيز على المهام القادمة فوراً."
                            : "Use Triage Mode to clear initial overdue reviews and get back on schedule immediately."}
                        </p>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={handleTriageMode} 
                      className="border-amber-500 text-amber-700 dark:text-amber-300 text-xs font-bold px-3 py-2 whitespace-nowrap shrink-0"
                    >
                      {t.planner.triageButton}
                    </Button>
                  </Card>
                )}

                {/* Add New Plan Form with PDF Upload */}
                <Card className="p-6 space-y-4 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <h3 className="font-bold text-base flex items-center gap-2">
                      <Plus size={16} className="text-teal-600"/> {t.planner.addTitle}
                    </h3>
                    
                    {/* PDF Upload Button */}
                    <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-teal-300 dark:border-teal-700 bg-teal-50/50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 text-xs font-bold hover:bg-teal-100 transition-all">
                      <UploadCloud size={15}/>
                      <span>{isExtractingPlannerPdf ? `${t.planner.extractingPdf} ${plannerPdfProgress?.current || 0}/${plannerPdfProgress?.total || 0}` : t.planner.uploadPdfBtn}</span>
                      <input 
                        type="file" 
                        accept=".pdf,.txt,.md" 
                        onChange={handlePlannerPdfUpload} 
                        disabled={isExtractingPlannerPdf} 
                        className="hidden" 
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input 
                      type="text" 
                      placeholder={t.planner.namePlaceholder} 
                      value={newLecture} 
                      onChange={e => setNewLecture(e.target.value)} 
                      className="p-3 border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-sm outline-none focus:border-teal-500" 
                    />
                    <input 
                      type="text" 
                      placeholder={t.planner.modulePlaceholder} 
                      value={newModule} 
                      onChange={e => setNewModule(e.target.value)} 
                      className="p-3 border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-sm outline-none focus:border-teal-500" 
                    />
                    <input 
                      type="text" 
                      placeholder={t.planner.subjectPlaceholder} 
                      value={newSubject} 
                      onChange={e => setNewSubject(e.target.value)} 
                      className="p-3 border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-sm outline-none focus:border-teal-500" 
                    />
                  </div>

                  {/* Lecture Notes / PDF Text for Active Recall Generation */}
                  <textarea
                    rows={3}
                    placeholder={t.planner.notesPlaceholder}
                    value={newLectureText}
                    onChange={e => setNewLectureText(e.target.value)}
                    className="p-3 border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-sm outline-none focus:border-teal-500 w-full resize-y"
                    spellCheck={false}
                  />

                  <Button 
                    variant="primary" 
                    onClick={addStudyPlanLocally} 
                    disabled={!newLecture.trim()} 
                    className="bg-teal-600 hover:bg-teal-700 w-full font-bold py-3 shadow-md shadow-teal-600/20"
                  >
                    {t.planner.submit}
                  </Button>
                </Card>

                {/* View Mode Tab Switcher */}
                <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                  <button
                    type="button"
                    onClick={() => setPlannerTab('today')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                      plannerTab === 'today'
                        ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    <span>{t.planner.todayAgendaTitle}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${plannerTab === 'today' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                      {todayDueList.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPlannerTab('all')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                      plannerTab === 'all'
                        ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    <span>{t.planner.allPlansTab}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${plannerTab === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                      {plans.length}
                    </span>
                  </button>
                </div>

                {/* TAB 1: Today's Actionable Agenda */}
                {plannerTab === 'today' && (
                  <div className="space-y-4">
                    {todayDueList.length === 0 ? (
                      <Card className="p-10 text-center space-y-3 dark:bg-slate-900 border-dashed">
                        <CheckCircle size={38} className="mx-auto text-emerald-500"/>
                        <h4 className="font-bold text-lg text-slate-900 dark:text-white">{t.planner.noTasksToday}</h4>
                        <p className="text-xs text-slate-500 max-w-md mx-auto">
                          {appLanguage === 'ar'
                            ? "استغل وقتك في مراجعة جدول التقويم الشهري أو التدرب على حالات المريض الافتراضي."
                            : "Use this time to review upcoming calendar events or practice virtual patient scenarios."}
                        </p>
                      </Card>
                    ) : (
                      <div className="grid grid-cols-1 gap-4">
                        {todayDueList.map(({ plan, review, isOverdue }, idx) => {
                          const config = getReviewConfig(review.review_number, appLanguage);
                          const taskType = review.task_type || config.task_type;
                          const taskName = config.task_name;

                          return (
                            <Card key={review.id || idx} className="p-5 dark:bg-slate-900 border-l-4 border-l-teal-600 space-y-4 shadow-sm hover:shadow-md transition-all">
                              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300">
                                      {plan.module_name} • {plan.subject_name}
                                    </span>
                                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                                      isOverdue 
                                        ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400' 
                                        : 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300'
                                    }`}>
                                      {isOverdue ? (appLanguage === 'ar' ? 'متأخرة' : 'Overdue') : (appLanguage === 'ar' ? 'مستحقة اليوم' : 'Due Today')}
                                    </span>
                                  </div>
                                  <h4 className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">
                                    {plan.name}
                                  </h4>
                                </div>

                                <div className="text-right">
                                  <span className="text-xs font-bold text-slate-500 block">
                                    {formatDate(review.scheduled_date)}
                                  </span>
                                </div>
                              </div>

                              {/* Actionable Task Box */}
                              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                                    <span>{REVIEW_ICON_MAP[config.iconName]}</span>
                                    <span>{config.title}</span>
                                    <span className="text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 px-2 py-0.5 rounded">
                                      {taskName}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-500">{config.focus}</p>
                                </div>

                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                  {/* Primary 1-Click Launch Button */}
                                  <Button
                                    variant="primary"
                                    onClick={() => startActiveReview(plan, review)}
                                    className="bg-teal-600 hover:bg-teal-700 text-xs font-bold py-2.5 px-4 flex items-center justify-center gap-1.5 shadow-md flex-1 sm:flex-initial"
                                  >
                                    <Sparkles size={14}/> {t.planner.startTaskNow} ({taskName.split(' ')[0]})
                                  </Button>

                                  {/* Quick feedback buttons */}
                                  <Button
                                    variant="outline"
                                    onClick={() => toggleReviewCompletion(plan.id, review.id, 'hard')}
                                    className="border-amber-400 text-amber-700 dark:text-amber-300 text-xs font-bold py-2.5 px-2.5"
                                    title={t.planner.hardBtn}
                                  >
                                    <Activity size={16} className="text-amber-500" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    onClick={() => toggleReviewCompletion(plan.id, review.id, 'easy')}
                                    className="border-emerald-400 text-emerald-700 dark:text-emerald-300 text-xs font-bold py-2.5 px-2.5"
                                    title={t.planner.easyBtn}
                                  >
                                    <Check size={16} className="text-emerald-500" />
                                  </Button>
                                </div>
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: All Active Plans (Full 7-Stage Roadmap) */}
                {plannerTab === 'all' && (
                  <div className="space-y-6">
                    {plans.length === 0 ? (
                      <Card className="p-8 text-center text-slate-400 border-dashed">
                        <p className="text-sm">{t.planner.empty}</p>
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
                                  <span className="text-xs text-slate-400">{t.planner.started} {formatDate(plan.study_date)}</span>
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1">{plan.name}</h3>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <span className="text-xs font-bold text-teal-600">{completedCount}/7 {t.planner.reviewsCount}</span>
                                  <div className="w-28 bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-1 overflow-hidden">
                                    <div className="bg-teal-600 h-full rounded-full transition-all" style={{ width: `${progressPct}%` }}></div>
                                  </div>
                                </div>
                                <Button variant="danger" className="p-2" onClick={() => deletePlan(plan.id)}>
                                  <Trash2 size={15}/>
                                </Button>
                              </div>
                            </div>

                            {/* Progressive Recall Reviews Schedule Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-2">
                              {plan.reviews?.map(rev => {
                                const config = getReviewConfig(rev.review_number, appLanguage);
                                const isPastOrToday = rev.scheduled_date && rev.scheduled_date.split('T')[0] <= getTodayStr();

                                return (
                                  <div 
                                    key={rev.id} 
                                    onClick={() => setActiveReviewModal({ plan, review: rev })}
                                    className={`p-3 rounded-xl border text-center cursor-pointer transition-all select-none hover:shadow-md ${
                                      rev.is_completed 
                                        ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' 
                                        : isPastOrToday 
                                          ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-300 ring-2 ring-amber-400/20' 
                                          : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                                    }`}
                                  >
                                    <div className="text-lg mb-1">{rev.is_completed ? <Check size={18} className="text-emerald-500"/> : REVIEW_ICON_MAP[config.iconName] || <Activity size={18}/>}</div>
                                    <span className="text-[11px] font-bold block truncate">{config.title.split(':')[0]}</span>
                                    <span className="text-[9px] font-bold block text-teal-600 dark:text-teal-400 mt-0.5 truncate">{config.task_name.split(' ')[0]}</span>
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
                )}
              </div>
            )}

            {/* High-Yield Mistakes Tracker View */}
            {currentRoute === 'highyield_track' && (
              <div className="space-y-6 max-w-4xl animate-in fade-in">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h2 className="text-3xl font-bold">{t.mistakes.title}</h2>
                    <p className="text-sm text-slate-500 mt-1">{t.mistakes.subtitle}</p>
                  </div>
                  {mistakes.length > 0 && (
                    <Button 
                      variant="danger" 
                      onClick={() => {
                        if (confirm(t.mistakes.clearConfirm)) {
                          localStorage.setItem('medos_mistakes', '[]');
                          setMistakes([]);
                        }
                      }}
                      className="text-xs"
                    >
                      <Trash2 size={14} className="mx-1.5"/> {t.mistakes.clearAll}
                    </Button>
                  )}
                </div>

                {mistakes.length === 0 ? (
                  <Card className="p-12 text-center space-y-3 dark:bg-slate-900 border-dashed">
                    <CheckCircle className="mx-auto text-emerald-500" size={40}/>
                    <h3 className="font-bold text-lg">{t.mistakes.emptyTitle}</h3>
                    <p className="text-sm text-slate-500 max-w-sm mx-auto">
                      {t.mistakes.emptyDesc}
                    </p>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {mistakes.map((m, idx) => (
                      <Card key={m.id || idx} className="p-5 dark:bg-slate-900 border-l-4 border-l-rose-500 border-slate-200 dark:border-slate-800 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400">
                            {m.topic || (appLanguage === 'ar' ? "طب عام" : "Core Medicine")}
                          </span>
                          <span className="text-xs text-slate-400">{formatDate(m.timestamp)}</span>
                        </div>
                        <h4 className="font-bold text-base text-slate-900 dark:text-white leading-relaxed">
                          {m.concept || "Question details"}
                        </h4>
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs space-y-1">
                          {m.user_answer && <p className="text-rose-600 font-medium">{t.mistakes.yourAnswer} {m.user_answer}</p>}
                          {m.correct_answer && <p className="text-emerald-600 font-bold">{t.mistakes.correctAnswer} {m.correct_answer}</p>}
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
                  <h2 className="text-3xl font-bold">{t.settings.title}</h2>
                  <p className="text-sm text-slate-500 mt-1">{t.settings.subtitle}</p>
                </div>


                {/* Language Switcher Card */}
                <Card className="p-6 space-y-4 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <h3 className="font-bold flex items-center gap-2 text-base">
                    <Globe className="text-teal-600"/> {t.settings.languageTitle}
                  </h3>
                  <p className="text-xs text-slate-500">{t.settings.languageDesc}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setAppLanguage('en')}
                      className={`p-3.5 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                        appLanguage === 'en'
                          ? 'bg-teal-50 dark:bg-teal-900/30 border-teal-500 text-teal-700 dark:text-teal-300 ring-2 ring-teal-500/20 shadow-sm'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      <span>EN / English</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAppLanguage('ar')}
                      className={`p-3.5 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                        appLanguage === 'ar'
                          ? 'bg-teal-50 dark:bg-teal-900/30 border-teal-500 text-teal-700 dark:text-teal-300 ring-2 ring-teal-500/20 shadow-sm'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      <span>AR / عامية مصرية</span>
                    </button>
                  </div>
                </Card>

                <Card className="p-6 space-y-4 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <h3 className="font-bold flex items-center gap-2 text-base"><Key className="text-teal-600"/> {t.settings.apiKeyTitle}</h3>
                  <p className="text-xs text-slate-500 mb-1">{t.settings.apiKeyDesc}</p>
                  <p className="text-xs text-slate-500 mb-4">
                    Get your API key here: <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noreferrer" className="text-cyan-600 underline font-bold">API keys | Google AI Studio</a>
                  </p>
                  <input 
                    type="password" 
                    value={apiKey} 
                    onChange={e => { setApiKey(e.target.value); localStorage.setItem('medos_api_key', e.target.value); }} 
                    placeholder="Enter API Key"
                    className="w-full border p-3 rounded-xl dark:bg-slate-800 dark:border-slate-700 text-sm outline-none focus:border-teal-500" 
                  />
                  <Button variant="primary" onClick={() => alert(t.settings.savedAlert)} className="bg-teal-600 w-full font-bold">
                    {t.settings.saveKey}
                  </Button>
                </Card>
                <Card className="p-6 space-y-4 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <h3 className="font-bold flex items-center gap-2 text-base text-red-600"><AlertTriangle className="text-red-600"/> {t.settings.dangerZoneTitle}</h3>
                  <p className="text-xs text-slate-500 mb-4">{t.settings.dangerZoneDesc}</p>
                  <Button variant="outline" onClick={wipeAllData} className="border-red-500 text-red-600 hover:bg-red-50 hover:border-red-600 w-full font-bold">
                    {t.settings.wipeDataBtn}
                  </Button>
                </Card>
              </div>
            )}

              </motion.div>
            </AnimatePresence>
          </div>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}
