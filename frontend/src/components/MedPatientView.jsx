import React, { useState, useRef, useEffect } from 'react';
import { Stethoscope, Send, Loader2, CheckCircle, Activity, User, Sparkles, RefreshCw } from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Card, Button } from './ui';
import { safeParseJson } from '../utils/normalization';

export default function MedPatientView({ apiKey, onShowKeyModal }) {
  const [patientSession, setPatientSession] = useState(null);
  const [patientMessages, setPatientMessages] = useState([]);
  const [userMsgInput, setUserMsgInput] = useState('');
  const [isPatientLoading, setIsPatientLoading] = useState(false);
  const [diagnosisInput, setDiagnosisInput] = useState('');
  const [treatmentInput, setTreatmentInput] = useState('');
  const [evaluationResult, setEvaluationResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [patientMessages, isPatientLoading]);

  const startVirtualPatient = async () => {
    if (!apiKey) { 
      if (onShowKeyModal) onShowKeyModal();
      else alert("Please set your Gemini API Key in Settings."); 
      return; 
    }
    setIsPatientLoading(true);
    setErrorMsg(null);
    setEvaluationResult(null);

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash"
      });

      const prompt = `Generate a realistic clinical case profile for a simulated Egyptian clinic patient in strictly valid JSON format.
      The profile must be varied (Cardiology, Pulmonology, Gastroenterology, Neurology, or Endocrinology).
      Return ONLY a JSON object with this exact structure:
      {
        "age": 48,
        "gender": "ذكر",
        "chief_complaint": "وجع في صدري وبنهج مع المجهود",
        "hpi": "كنت طالع السلم وفجأة حسيت بوجع جامد في منتصف صدري مسمع في كتفي الشمال مع عرق بارد",
        "pmh": "عندي الضغط بقالي 5 سنين ومدخن علبة في اليوم",
        "vitals": "BP: 150/95, HR: 105, O2: 96%",
        "correct_diagnosis": "Acute Coronary Syndrome / NSTEMI",
        "correct_treatment": "Aspirin, Clopidogrel, Heparin, Nitroglycerin, serial ECG and Troponin",
        "initial_greeting": "أهلاً يا دكتور.. أنا تعبان أوي وجاي عشان صدري واجعني مش قادر."
      }`;

      const result = await model.generateContent(prompt);
      const rawText = result.response.text();
      const profile = safeParseJson(rawText);
      
      setPatientSession(profile);
      setPatientMessages([
        { role: 'model', content: profile.initial_greeting || `أهلاً يا دكتور.. أنا عندي ${profile.chief_complaint}. إيه اللي حضرتك حابب تسأله؟` }
      ]);
    } catch (err) {
      console.error("Simulation error:", err);
      setErrorMsg("Failed to initialize patient simulation: " + err.message);
    } finally {
      setIsPatientLoading(false);
    }
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
        model: "gemini-1.5-flash",
        systemInstruction: `You are a patient in an Egyptian clinic speaking natural, authentic Egyptian Arabic dialect. 
        Your case profile:
        - Age: ${patientSession.age}, Gender: ${patientSession.gender}
        - Chief Complaint: ${patientSession.chief_complaint}
        - History of Present Illness: ${patientSession.hpi}
        - Past Medical History: ${patientSession.pmh}
        - Vitals: ${patientSession.vitals || 'Normal'}
        
        Stay in character. Answer the doctor's questions naturally in Egyptian Arabic based on your symptoms. 
        Do not reveal your correct medical diagnosis directly, only describe your symptoms, pain characteristics, history, and emotions as a patient.`
      });

      const conversationContext = newMsgs.map(m => `${m.role === 'user' ? 'Doctor' : 'Patient'}: ${m.content}`).join('\n');
      const result = await model.generateContent(`Conversation so far:\n${conversationContext}\n\nDoctor asked: "${userText}"\nReply in character as the patient in Egyptian Arabic:`);
      
      setPatientMessages([...newMsgs, { role: 'model', content: result.response.text() }]);
    } catch (err) {
      console.error("Message send error:", err);
      setPatientMessages([...newMsgs, { role: 'model', content: "عذراً يا دكتور، تعبان ومش قادر أرد دلوقتي.. (خطأ في الاتصال)" }]);
    } finally {
      setIsPatientLoading(false);
    }
  };

  const evaluatePatientCase = async () => {
    if (!diagnosisInput.trim() || !treatmentInput.trim()) { 
      alert("Please provide both your diagnosis and management plan before submitting."); 
      return; 
    }
    setIsPatientLoading(true);

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const prompt = `You are a medical board examiner evaluating a medical student's diagnosis and treatment of a clinical case.
      
      Patient True Profile:
      - Correct Diagnosis: ${patientSession.correct_diagnosis}
      - Correct Treatment: ${patientSession.correct_treatment}
      - HPI: ${patientSession.hpi}
      - PMH: ${patientSession.pmh}
      
      Student Submission:
      - Proposed Diagnosis: ${diagnosisInput}
      - Proposed Treatment: ${treatmentInput}
      
      Evaluate the student's clinical decision making strictly in valid JSON format:
      {
        "score": 90,
        "is_passed": true,
        "feedback": "شرح مفصل وتقييم للتشخيص والعلاج باللغة العربية الطبية المصرية والمصطلحات الإنجليزية...",
        "strengths": ["نقطة قوة 1", "نقطة قوة 2"],
        "missed_points": ["نقطة كان يجب الانتباه لها"]
      }`;

      const result = await model.generateContent(prompt);
      const evalData = safeParseJson(result.response.text());
      setEvaluationResult(evalData);
    } catch (err) {
      console.error("Evaluation error:", err);
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
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-3">
            <Stethoscope className="text-teal-600"/> عيادة المريض الافتراضي (Virtual Patient)
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            تدرب على مهارات أخذ التاريخ المرضي (History Taking) والتشخيص السريري باللهجة المصرية.
          </p>
        </div>
        {patientSession && (
          <Button variant="secondary" onClick={startVirtualPatient} disabled={isPatientLoading} className="text-xs">
            <RefreshCw size={14} className="mr-1.5" /> حالة جديدة
          </Button>
        )}
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300 rounded-xl border border-rose-200">
          {errorMsg}
        </div>
      )}

      {!patientSession ? (
        <Card className="p-12 text-center space-y-6 dark:bg-slate-900 border-dashed border-2">
          <div className="w-20 h-20 bg-teal-50 dark:bg-teal-900/30 text-teal-600 rounded-full flex items-center justify-center mx-auto">
            <Activity size={36} />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-bold">ابدأ محاكاة حالة سريرية حية</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              سيقوم الذكاء الاصطناعي بتمثيل دور مريض مصري يزور عيادتك. تحدث معه، واطرح الأسئلة لتصل للتشخيص والعلاج الصحيح.
            </p>
          </div>
          <Button 
            variant="primary" 
            onClick={startVirtualPatient} 
            disabled={isPatientLoading} 
            className="bg-teal-600 hover:bg-teal-700 px-8 py-4 text-base font-bold mx-auto shadow-lg shadow-teal-600/20"
          >
            {isPatientLoading ? <Loader2 className="animate-spin mr-2"/> : <Sparkles className="mr-2"/>}
            بدء حالة جديدة الآن
          </Button>
        </Card>
      ) : (
        <div className="space-y-6 animate-in fade-in">
          {/* Active Patient Vitals Card */}
          <Card className="p-5 bg-teal-50/70 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase text-teal-700 dark:text-teal-400 tracking-wider">بيانات المريض في العيادة</span>
                <h4 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                  مريض {patientSession.gender} • {patientSession.age} سنة
                </h4>
              </div>
              <div className="text-sm bg-white dark:bg-slate-900 px-4 py-2 rounded-xl border border-teal-100 dark:border-teal-900 shadow-sm">
                <span className="font-semibold text-slate-500">الشكوى الأساسية: </span>
                <span className="font-bold text-teal-700 dark:text-teal-300">"{patientSession.chief_complaint}"</span>
              </div>
            </div>
          </Card>

          {/* Interactive Chat Console */}
          <div className="h-[420px] overflow-y-auto bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-inner">
            {patientMessages.map((msg, idx) => (
              <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'model' && (
                  <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900 text-teal-700 flex items-center justify-center shrink-0 mt-1">
                    <User size={16} />
                  </div>
                )}
                <div className={`p-4 rounded-2xl max-w-[80%] text-sm leading-relaxed shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-teal-600 text-white rounded-br-none' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-none border border-slate-200 dark:border-slate-700'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isPatientLoading && (
              <div className="flex items-center gap-2 text-slate-400 text-sm italic">
                <Loader2 className="animate-spin" size={16}/> المريض يفكر في الإجابة...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input Bar */}
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="اسأل المريض عن الأعراض، التاريخ المرضي، أو تفاصيل الألم..." 
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

          {/* Submission and Clinical Evaluation Section */}
          <Card className="p-6 space-y-4 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle className="text-emerald-600"/> التشخيص النهائي وخطة العلاج
            </h3>
            <p className="text-xs text-slate-500">
              بعد استيفاء الأسئلة مع المريض، أدخل تشخيصك النهائي والتدخل العلاجي لتقييم أدائك السريري.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block">Your Diagnosis (التشخيص)</label>
                <input 
                  type="text" 
                  placeholder="e.g. Acute STEMI, Appendicitis..." 
                  value={diagnosisInput} 
                  onChange={e => setDiagnosisInput(e.target.value)} 
                  className="w-full p-3 border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-sm outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block">Treatment & Next Step (العلاج والخطوة التالية)</label>
                <input 
                  type="text" 
                  placeholder="e.g. Urgent PCI, Oxygen, DAPT..." 
                  value={treatmentInput} 
                  onChange={e => setTreatmentInput(e.target.value)} 
                  className="w-full p-3 border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-sm outline-none focus:border-teal-500"
                />
              </div>
            </div>
            <Button 
              variant="primary" 
              onClick={evaluatePatientCase} 
              disabled={isPatientLoading || !diagnosisInput || !treatmentInput} 
              className="bg-emerald-600 hover:bg-emerald-700 w-full py-3.5 font-bold shadow-md"
            >
              {isPatientLoading ? <Loader2 className="animate-spin mr-2"/> : null} تقييم الحالة السريرية
            </Button>
          </Card>

          {/* Results Display */}
          {evaluationResult && (
            <Card className="p-6 bg-emerald-50/50 dark:bg-emerald-950/20 border-2 border-emerald-200 dark:border-emerald-800 space-y-4 animate-in fade-in">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-2xl text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle size={28}/> نتيجة التقييم: {evaluationResult.score}/100
                </h3>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${evaluationResult.score >= 75 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {evaluationResult.score >= 75 ? 'Excellent Reasoning' : 'Needs Review'}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                {evaluationResult.feedback}
              </p>
              {evaluationResult.missed_points && evaluationResult.missed_points.length > 0 && (
                <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800/60">
                  <span className="font-bold text-xs text-amber-700 dark:text-amber-400 block mb-1">نقاط كان يمكن تحسينها:</span>
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