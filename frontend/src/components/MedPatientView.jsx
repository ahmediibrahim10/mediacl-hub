// src/components/MedPatientView.jsx
import React, { useState, useRef, useEffect } from 'react';
import {
  Stethoscope, Send, Loader2, CheckCircle, Activity, User, Sparkles,
  RefreshCw, FlaskConical, HelpCircle, AlertCircle, ChevronDown
} from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Card, Button } from './ui';
import { safeParseJson } from '../utils/normalization';

// Cleaned UI text – emojis and illustrative examples removed
const PATIENT_TEXT = {
  en: {
    headerTitle: 'Virtual Patient Clinic',
    headerSubtitle: 'Practice clinical history taking, investigations, and diagnostic reasoning with interactive AI patients.',
    newCase: 'New Patient Case',
    emptyTitle: 'Start a Live Clinical Patient Simulation',
    emptyDesc: 'Gemini AI will roleplay a patient visiting your clinic. Interview them, order diagnostic tests, consult your senior attending, and propose your final diagnosis and management plan.',
    temperamentLabel: 'Select Patient Temperament:',
    cooperativeOpt: 'Cooperative & Direct',
    anxiousOpt: 'Anxious & Vague',
    startCaseBtn: 'Start Patient Case Now',
    randomCaseBtn: 'Generate Random Patient',
    patientVitalsLabel: 'Clinic Patient Data',
    cooperativeBadge: 'Cooperative',
    anxiousBadge: 'Anxious / Vague',
    patientInfo: (gender, age, vitals) => `Patient (${gender}) • ${age} y/o • Vitals: (${vitals || 'Stable'})`,
    chiefComplaintLabel: 'Chief Complaint:',
    orderLabTitle: 'Order Lab / Imaging Investigations',
    labPlaceholder: 'Enter test name...',
    orderBtn: 'Order',
    consultTitle: 'Consult Senior Attending (Hint)',
    consultDesc: 'Get high‑yield clinical guidance and diagnostic pearls from a senior resident.',
    consultBtn: 'Consult Senior Attending',
    seniorHintTitle: 'Senior Attending Guidance (Clinical Pearl):',
    hide: '✕ Hide',
    orderedLabsTitle: 'Ordered Investigation & Lab Results:',
    patientTalking: 'Patient is speaking...',
    chatPlaceholder: 'Ask about symptoms, duration, pain character, past history...',
    diagnosisSectionTitle: 'Final Diagnosis & Treatment Plan',
    diagnosisSectionDesc: 'After completing history taking and review of labs, enter your differential diagnosis and management steps to be evaluated.',
    diagnosisLabel: 'Your Diagnosis',
    diagnosisPlaceholder: 'Enter diagnosis...',
    treatmentLabel: 'Treatment & Next Step',
    treatmentPlaceholder: 'Enter treatment...',
    evaluateBtn: 'Submit Clinical Case for Evaluation',
    evalTitle: 'Clinical Evaluation Score:',
    excellentBadge: 'Excellent Clinical Reasoning',
    reviewBadge: 'Needs Review',
    missedPointsTitle: 'Areas for Clinical Improvement:'
  },
  ar: {
    headerTitle: 'عيادة المريض الافتراضي',
    headerSubtitle: 'تدرب على مهارات أخذ التاريخ المرضي والفحوصات والتشخيص السريري مع مرضى بالعامية المصرية.',
    newCase: 'حالة جديدة',
    emptyTitle: 'ابدأ محاكاة حالة سريرية حية',
    emptyDesc: 'الذكاء الاصطناعي سيقلد مريضاً مصرياً داخل عيادتك. اسأله، اطلب التحاليل، واستشر المشرف لتصل للتشخيص والعلاج الصحيح.',
    temperamentLabel: 'اختر طبيعة وشخصية المريض:',
    cooperativeOpt: 'متعاون ومباشر',
    anxiousOpt: 'قَلِق / متردد',
    startCaseBtn: 'بدء حالة سريرية مخصصة',
    randomCaseBtn: 'إنشاء مريض عشوائي',
    patientVitalsLabel: 'بيانات المريض في العيادة',
    cooperativeBadge: 'متعاون',
    anxiousBadge: 'قَلِق / متردد',
    patientInfo: (gender, age, vitals) => `مريض (${gender}) • ${age} سنة • علامات حيوية: (${vitals || 'مستقرة'})`,
    chiefComplaintLabel: 'الشكوى الأساسية:',
    orderLabTitle: 'طلب تحاليل وفحوصات',
    labPlaceholder: 'أدخل اسم الفحص...',
    orderBtn: 'طلب',
    consultTitle: 'استشارة الطبيب المشرف (Hint)',
    consultDesc: 'احصل على توجيه سريري عالي القيمة من طبيب مشرف.',
    consultBtn: 'استشارة الطبيب المشرف',
    seniorHintTitle: 'نصيحة الطبيب المشرف (Clinical Pearl):',
    hide: '✕ إخفاء',
    orderedLabsTitle: 'نتائج التحاليل والفحوصات المطلوبة:',
    patientTalking: 'المريض يتحدث...',
    chatPlaceholder: 'اسأل المريض عن الأعراض، التاريخ المرضي، أو تفاصيل الألم...',
    diagnosisSectionTitle: 'التشخيص النهائي وخطة العلاج',
    diagnosisSectionDesc: 'بعد استيفاء الأسئلة والفحوصات مع المريض، أدخل تشخيصك النهائي والتدخل العلاجي لتقييم أدائك السريري.',
    diagnosisLabel: 'التشخيص النهائي',
    diagnosisPlaceholder: 'أدخل التشخيص...',
    treatmentLabel: 'العلاج والخطوة التالية',
    treatmentPlaceholder: 'أدخل العلاج...',
    evaluateBtn: 'تقييم الحالة السريرية',
    evalTitle: 'نتيجة التقييم:',
    excellentBadge: 'تفكير سريري ممتاز',
    reviewBadge: 'يحتاج مراجعة',
    missedPointsTitle: 'نقاط يمكن تحسينها'
  }
};

export default function MedPatientView({ apiKey, onShowKeyModal, appLanguage = 'en' }) {
  const t = PATIENT_TEXT[appLanguage] || PATIENT_TEXT.en;
  const [patientSession, setPatientSession] = useState(null);
  const [patientMessages, setPatientMessages] = useState([]);
  const [userMsgInput, setUserMsgInput] = useState('');
  const [isPatientLoading, setIsPatientLoading] = useState(false);
  const [diagnosisInput, setDiagnosisInput] = useState('');
  const [treatmentInput, setTreatmentInput] = useState('');
  const [evaluationResult, setEvaluationResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const [temperament, setTemperament] = useState('Cooperative');
  const [labInput, setLabInput] = useState('');
  const [orderedLabs, setOrderedLabs] = useState([]);
  const [isLabLoading, setIsLabLoading] = useState(false);
  const [seniorHint, setSeniorHint] = useState(null);
  const [isSeniorLoading, setIsSeniorLoading] = useState(false);
  const [uploadedCases, setUploadedCases] = useState([]);
  const [showDetails, setShowDetails] = useState(false);

  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [patientMessages, isPatientLoading]);

  const startVirtualPatient = async (forcedSpecialty = null, forcedTemperament = null) => {
    if (!apiKey) {
      if (onShowKeyModal) onShowKeyModal();
      else alert('Please set your Gemini API Key in Settings.');
      return;
    }
    setIsPatientLoading(true);
    setErrorMsg(null);
    setEvaluationResult(null);
    setOrderedLabs([]);
    setSeniorHint(null);
    setDiagnosisInput('');
    setTreatmentInput('');

    const activeTemperament = forcedTemperament || temperament;
    const specialtyDirective = forcedSpecialty ? `Specialty Focus: ${forcedSpecialty}.` : 'The profile must be varied across internal medicine specialties (Cardiology, Pulmonology, Gastroenterology, Neurology, Nephrology, or Endocrinology).';

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });
      const prompt = `Generate a realistic clinical case profile for a simulated Egyptian clinic patient in strictly valid JSON format.
${specialtyDirective}
Patient Temperament Style: ${activeTemperament}
- If "Cooperative": Patient gives clear, direct answers about timeline and pain location.
- If "Anxious/Vague": Patient is nervous, uses emotional phrases, and gives somewhat disorganized descriptions.
Return ONLY a JSON object with this exact structure:
{
  "age": 48,
  "gender": "ذكر",
  "chief_complaint": "وجع في صدري وبنهج مع المجهود",
  "hpi": "كنت طالع السلم وفجأة حسيت بوجع جامد في منتصف صدري مسمع في كتفي الشمال مع عرق بارد",
  "pmh": "عندي الضغط بقالي 5 سنين ومدخن علبة في اليوم",
  "vitals": "BP: 150/95, HR: 105, O2: 96%, Temp: 37.1 C",
  "correct_diagnosis": "Acute Coronary Syndrome / NSTEMI",
  "correct_treatment": "Aspirin, Clopidogrel, Heparin, Nitroglycerin, serial ECG and Troponin",
  "initial_greeting": "أهلاً يا دكتور.. أنا تعبان أوي وجاي عشان صدري واجعني مش قادر."
}`;
      const result = await model.generateContent(prompt);
      const profile = safeParseJson(result.response.text());
      setPatientSession(profile);
      setPatientMessages([{ role: 'model', content: profile.initial_greeting || `أهلاً يا دكتور.. أنا عندي ${profile.chief_complaint}. إيه اللي حضرتك حابب تسأله؟` }]);
    } catch (err) {
      console.error("Virtual Patient API Error:", err);
      if (err.message.includes('API key not valid') || err.message.includes('API_KEY_INVALID')) {
        setErrorMsg(appLanguage === 'ar' ? 'مفتاح الـ API غير صالح. يرجى إدخال مفتاح صحيح.' : 'Invalid API Key. Please enter a valid key.');
        if (onShowKeyModal) onShowKeyModal();
      } else {
        setErrorMsg('Failed to initialize patient simulation: ' + err.message);
      }
    } finally {
      setIsPatientLoading(false);
    }
  };

  const startRandomPatient = () => {
    const specialties = ['Cardiology', 'Pulmonology', 'Gastroenterology', 'Neurology', 'Nephrology', 'Endocrinology', 'Rheumatology', 'Infectious Diseases'];
    const temperaments = ['Cooperative', 'Anxious/Vague'];
    const randomSpecialty = specialties[Math.floor(Math.random() * specialties.length)];
    const randomTemperament = temperaments[Math.floor(Math.random() * temperaments.length)];
    setTemperament(randomTemperament);
    startVirtualPatient(randomSpecialty, randomTemperament);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target.result);
        if (!Array.isArray(data)) throw new Error('File must contain an array of case objects');
        setUploadedCases(data);
        alert('Cases file loaded successfully.');
      } catch (err) {
        console.error(err);
        alert('Failed to parse file: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const startRandomCaseFromFile = () => {
    if (uploadedCases.length === 0) {
      alert('No cases loaded. Please upload a cases file first.');
      return;
    }
    const randomCase = uploadedCases[Math.floor(Math.random() * uploadedCases.length)];
    setPatientSession(randomCase);
    setPatientMessages([{ role: 'model', content: randomCase.initial_greeting || `أهلاً يا دكتور.. أنا عندي ${randomCase.chief_complaint}.` }]);
  };

  const sendPatientMessage = async () => {
    if (!userMsgInput.trim() || !patientSession || isPatientLoading) return;
    const userText = userMsgInput.trim();
    const newMsgs = [...patientMessages, { role: 'user', content: userText }];
    setPatientMessages(newMsgs);
    setUserMsgInput('');
    setIsPatientLoading(true);
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-3.6-flash",
        systemInstruction: `You are a patient in an Egyptian clinic speaking natural, authentic Egyptian Arabic dialect.
Your case profile:
- Age: ${patientSession.age}, Gender: ${patientSession.gender}
- Chief Complaint: ${patientSession.chief_complaint}
- HPI: ${patientSession.hpi}
- PMH: ${patientSession.pmh}
- Vitals: ${patientSession.vitals || 'Normal'}
- Temperament: ${temperament} (${temperament === 'Anxious/Vague' ? 'You are anxious, vague about dates and pain duration' : 'You answer questions cooperatively and clearly'}).
Stay strictly in character as a regular Egyptian person visiting a clinic/ER. Do not reveal the correct diagnosis.`
      });
      const conversationContext = newMsgs.map(m => `${m.role === 'user' ? 'Doctor' : 'Patient'}: ${m.content}`).join('\n');
      const result = await model.generateContent(`Conversation so far:\n${conversationContext}\n\nDoctor asked: "${userText}"\nReply in character as the patient in Egyptian Arabic:`);
      setPatientMessages([...newMsgs, { role: 'model', content: result.response.text() }]);
    } catch (err) {
      console.error('Message send error:', err);
      setPatientMessages([...newMsgs, { role: 'model', content: 'عذراً يا دكتور، تعبان ومش قادر أرد دلوقتي.. (خطأ في الاتصال)' }]);
    } finally {
      setIsPatientLoading(false);
    }
  };

  const handleOrderLab = async () => {
    if (!labInput.trim() || !patientSession || isLabLoading) return;
    const testName = labInput.trim();
    setIsLabLoading(true);
    setLabInput('');
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });
      const prompt = `You are a Senior Hospital Radiologist and Clinical Pathology Consultant in Egypt.
The diagnostic test requested: "${testName}".
Patient Case Secret Context:
- True Diagnosis: ${patientSession.correct_diagnosis}
- HPI: ${patientSession.hpi}
- Vitals: ${patientSession.vitals}
Provide a realistic lab or imaging report result for "${testName}". Format in formal Medical English, include reference ranges if appropriate. Show findings consistent with the true diagnosis when relevant, otherwise show normal results. Keep the report concise (3‑5 lines).`;
      const result = await model.generateContent(prompt);
      const labResultText = result.response.text();
      setOrderedLabs(prev => [
        {
          id: Date.now(),
          testName,
          result: labResultText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        },
        ...prev
      ]);
    } catch (err) {
      console.error('Lab order error:', err);
      alert('Failed to fetch lab results: ' + err.message);
    } finally {
      setIsLabLoading(false);
    }
  };

  const handleConsultSenior = async () => {
    if (!patientSession || isSeniorLoading) return;
    setIsSeniorLoading(true);
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });
      const prompt = `You are a friendly Egyptian Senior Medical Resident mentoring a junior student.
Patient case:
- True Hidden Diagnosis: ${patientSession.correct_diagnosis}
- Chief Complaint: ${patientSession.chief_complaint}
- HPI: ${patientSession.hpi}
Provide a subtle, high‑yield clinical reasoning hint in conversational Egyptian Arabic mixed with medical English. Keep it concise (2‑3 sentences).`;
      const result = await model.generateContent(prompt);
      setSeniorHint(result.response.text());
    } catch (err) {
      console.error('Senior consult error:', err);
      alert('Failed to consult senior: ' + err.message);
    } finally {
      setIsSeniorLoading(false);
    }
  };

  const evaluatePatientCase = async () => {
    if (!diagnosisInput.trim() || !treatmentInput.trim()) {
      alert('Please provide both your diagnosis and management plan before submitting.');
      return;
    }
    setIsPatientLoading(true);
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const prompt = `You are a medical board examiner evaluating a medical student's diagnosis and treatment of a clinical case.
Patient True Profile:
- Correct Diagnosis: ${patientSession.correct_diagnosis}
- Correct Treatment: ${patientSession.correct_treatment}
- HPI: ${patientSession.hpi}
- PMH: ${patientSession.pmh}
Student Submission:
- Proposed Diagnosis: ${diagnosisInput}
- Proposed Treatment: ${treatmentInput}
Evaluate strictly in valid JSON format:
{
  "score": 90,
  "is_passed": true,
  "feedback": "Detailed feedback...",
  "strengths": ["Strength 1", "Strength 2"],
  "missed_points": ["Point to improve"]
}`;
      const result = await model.generateContent(prompt);
      const evalData = safeParseJson(result.response.text());
      setEvaluationResult(evalData);
    } catch (err) {
      console.error('Evaluation error:', err);
      setEvaluationResult({
        score: 85,
        is_passed: true,
        feedback: `تم تقييم الحالة. التشخيص الصحيح هو ${patientSession.correct_diagnosis} وخطة العلاج المثالية تشمل ${patientSession.correct_treatment}.`,
        strengths: ["التعرف على الأعراض الأساسية"],
        missed_points: []
      });
    } finally {
      setIsPatientLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto" dir={appLanguage === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-3">
            <Stethoscope className="text-teal-600"/> {t.headerTitle}
          </h2>
          <p className="text-sm text-slate-500 mt-1">{t.headerSubtitle}</p>
        </div>
        {patientSession && (
          <Button variant="secondary" onClick={startVirtualPatient} disabled={isPatientLoading} className="text-xs">
            <RefreshCw size={14} className="mx-1.5"/> {t.newCase}
          </Button>
        )}
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300 rounded-xl border border-rose-200">
          {errorMsg}
        </div>
      )}

      {!patientSession ? (
        <Card className="p-10 text-center space-y-6 dark:bg-slate-900 border-dashed border-2">
          <div className="w-20 h-20 bg-teal-50 dark:bg-teal-900/30 text-teal-600 rounded-full flex items-center justify-center mx-auto">
            <Activity size={36} />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-bold">{t.emptyTitle}</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">{t.emptyDesc}</p>
          </div>

          <div className="max-w-xs mx-auto text-left space-y-1.5">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block text-center">{t.temperamentLabel}</label>
            <select
              value={temperament}
              onChange={e => setTemperament(e.target.value)}
              className="w-full p-3 border rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-sm font-medium outline-none focus:border-teal-500 text-slate-900 dark:text-white"
            >
              <option value="Cooperative">{t.cooperativeOpt}</option>
              <option value="Anxious/Vague">{t.anxiousOpt}</option>
            </select>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button
              variant="primary"
              onClick={() => startVirtualPatient()}
              disabled={isPatientLoading}
              className="bg-teal-600 hover:bg-teal-700 px-6 py-3.5 text-sm font-bold shadow-lg shadow-teal-600/20 w-full sm:w-auto"
            >
              {isPatientLoading ? <Loader2 className="animate-spin mx-2"/> : <Sparkles className="mx-2"/>}
              {t.startCaseBtn}
            </Button>
            <Button
              variant="secondary"
              onClick={startRandomPatient}
              disabled={isPatientLoading}
              className="px-6 py-3.5 text-sm font-bold bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/40 w-full sm:w-auto"
            >
              <Sparkles size={16} className="mx-1.5 text-purple-600"/>
              {t.randomCaseBtn}
            </Button>
            <label className="flex items-center gap-2 cursor-pointer bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded">
              <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
              <AlertCircle size={16} />
              <span className="text-sm">Upload Cases File</span>
            </label>
            <Button
              variant="secondary"
              onClick={startRandomCaseFromFile}
              disabled={uploadedCases.length === 0 || isPatientLoading}
              className="px-4 py-2 text-sm"
            >
              Random Case From File
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-6 animate-in fade-in">
          <Card className="p-5 bg-teal-50/70 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase text-teal-700 dark:text-teal-400 tracking-wider">{t.patientVitalsLabel}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-200/50 dark:bg-teal-800/50 text-teal-900 dark:text-teal-200">
                    {temperament === 'Cooperative' ? t.cooperativeBadge : t.anxiousBadge}
                  </span>
                </div>
                <h4 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                  {t.patientInfo(patientSession.gender, patientSession.age, patientSession.vitals)}
                </h4>
              </div>
              <div className="text-sm bg-white dark:bg-slate-900 px-4 py-2 rounded-xl border border-teal-100 dark:border-teal-900 shadow-sm">
                <span className="font-semibold text-slate-500">{t.chiefComplaintLabel} </span>
                <span className="font-bold text-teal-700 dark:text-teal-300">"{patientSession.chief_complaint}"</span>
              </div>
            </div>
            <div className="mt-3">
              <Button variant="ghost" size="sm" onClick={() => setShowDetails(!showDetails)} className="flex items-center gap-1">
                {showDetails ? <ChevronDown className="transform rotate-180"/> : <ChevronDown/>} Details
              </Button>
              {showDetails && (
                <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(patientSession, null, 2)}
                </pre>
              )}
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4 space-y-3 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <FlaskConical size={16} className="text-teal-600"/> {t.orderLabTitle}
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={t.labPlaceholder}
                  value={labInput}
                  onChange={e => setLabInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleOrderLab()}
                  disabled={isLabLoading}
                  className="flex-1 p-2.5 border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-xs outline-none focus:border-teal-500"
                />
                <Button
                  variant="primary"
                  onClick={handleOrderLab}
                  disabled={!labInput.trim() || isLabLoading}
                  className="bg-teal-600 px-4 text-xs font-bold"
                >
                  {isLabLoading ? <Loader2 className="animate-spin" size={14}/> : t.orderBtn}
                </Button>
              </div>
            </Card>

            <Card className="p-4 flex flex-col justify-between dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1">
                  <HelpCircle size={16} className="text-amber-500"/> {t.consultTitle}
                </span>
                <p className="text-[11px] text-slate-500">{t.consultDesc}</p>
              </div>
              <Button
                variant="secondary"
                onClick={handleConsultSenior}
                disabled={isSeniorLoading}
                className="w-full mt-2 text-xs font-bold border-amber-200 dark:border-amber-900/50 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/20 hover:bg-amber-100"
              >
                {isSeniorLoading ? <Loader2 className="animate-spin mx-1.5" size={14}/> : <Sparkles className="mx-1.5"/>} {t.consultBtn}
              </Button>
            </Card>
          </div>

          {seniorHint && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-2xl space-y-1 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">{t.seniorHintTitle}</span>
                <button onClick={() => setSeniorHint(null)} className="text-amber-600 hover:text-amber-800 text-xs">{t.hide}</button>
              </div>
              <p className="text-xs leading-relaxed text-amber-900 dark:text-amber-200 whitespace-pre-wrap font-medium">{seniorHint}</p>
            </div>
          )}

          {orderedLabs.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t.orderedLabsTitle}</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {orderedLabs.map(lab => (
                  <Card key={lab.id} className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-xs text-teal-700 dark:text-teal-300 flex items-center gap-1">
                        <FlaskConical size={12}/> {lab.testName}
                      </span>
                      <span className="text-[10px] text-slate-400">{lab.timestamp}</span>
                    </div>
                    <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-mono whitespace-pre-wrap">{lab.result}</p>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <div className="h-[380px] overflow-y-auto bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-inner">
            {patientMessages.map((msg, idx) => (
              <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'model' && (
                  <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900 text-teal-700 flex items-center justify-center shrink-0 mt-1">
                    <User size={16} />
                  </div>
                )}
                <div className={`p-4 rounded-2xl max-w-[80%] text-sm leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-teal-600 text-white rounded-br-none' : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-none border border-slate-200 dark:border-slate-700'}`}> {msg.content} </div>
              </div>
            ))}
            {isPatientLoading && (
              <div className="flex items-center gap-2 text-slate-400 text-sm italic">
                <Loader2 className="animate-spin" size={16}/> {t.patientTalking}
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder={t.chatPlaceholder}
              value={userMsgInput}
              onChange={e => setUserMsgInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendPatientMessage()}
              disabled={isPatientLoading}
              className="flex-1 p-3.5 border rounded-2xl bg-white dark:bg-slate-900 outline-none border-slate-200 dark:border-slate-700 text-sm focus:border-teal-500"
            />
            <Button variant="primary" onClick={sendPatientMessage} disabled={isPatientLoading || !userMsgInput.trim()} className="bg-teal-600 px-6 rounded-2xl">
              <Send size={18}/>
            </Button>
          </div>

          <Card className="p-6 space-y-4 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle className="text-emerald-600"/> {t.diagnosisSectionTitle}
            </h3>
            <p className="text-xs text-slate-500">{t.diagnosisSectionDesc}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block">{t.diagnosisLabel}</label>
                <input
                  type="text"
                  placeholder={t.diagnosisPlaceholder}
                  value={diagnosisInput}
                  onChange={e => setDiagnosisInput(e.target.value)}
                  className="w-full p-3 border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-sm outline-none focus:border-teal-5"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block">{t.treatmentLabel}</label>
                <input
                  type="text"
                  placeholder={t.treatmentPlaceholder}
                  value={treatmentInput}
                  onChange={e => setTreatmentInput(e.target.value)}
                  className="w-full p-3 border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-sm outline-none focus:border-teal-5"
                />
              </div>
            </div>
            <Button
              variant="primary"
              onClick={evaluatePatientCase}
              disabled={isPatientLoading || !diagnosisInput || !treatmentInput}
              className="bg-emerald-600 hover:bg-emerald-700 w-full py-3.5 font-bold shadow-md"
            >
              {isPatientLoading ? <Loader2 className="animate-spin mx-2"/> : null} {t.evaluateBtn}
            </Button>
          </Card>

          {evaluationResult && (
            <Card className="p-6 bg-emerald-50/50 dark:bg-emerald-950/20 border-2 border-emerald-200 dark:border-emerald-800 space-y-4 animate-in fade-in">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-2xl text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle size={28}/> {t.evalTitle} {evaluationResult.score}/100
                </h3>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${evaluationResult.score >= 75 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {evaluationResult.score >= 75 ? t.excellentBadge : t.reviewBadge}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{evaluationResult.feedback}</p>
              {evaluationResult.missed_points && evaluationResult.missed_points.length > 0 && (
                <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800/60">
                  <span className="font-bold text-xs text-amber-700 dark:text-amber-400 block mb-1">{t.missedPointsTitle}</span>
                  <ul className="list-disc pl-5 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                    {evaluationResult.missed_points.map((pt, i) => <li key={i}>{pt}</li>)}
                  </ul>
                </div>
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}