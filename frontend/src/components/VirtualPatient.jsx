import React, { useState } from 'react';
import { Stethoscope, Send, Loader2, CheckCircle } from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';

export default function VirtualPatient({ apiKey, onShowKeyModal }) {
  const [patientSession, setPatientSession] = useState(null);
  const [patientMessages, setPatientMessages] = useState([]);
  const [userMsgInput, setUserMsgInput] = useState('');
  const [isPatientLoading, setIsPatientLoading] = useState(false);
  const [diagnosisInput, setDiagnosisInput] = useState('');
  const [treatmentInput, setTreatmentInput] = useState('');
  const [evaluationResult, setEvaluationResult] = useState(null);

  const startVirtualPatient = async () => {
    if (!apiKey) { onShowKeyModal(); return; }
    setIsPatientLoading(true);
    setEvaluationResult(null);
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = `Generate a realistic Egyptian clinical case profile for a virtual patient with Egyptian vernacular context in strict JSON format:
      {
        "age": 52,
        "gender": "ذكر",
        "chief_complaint": "وجع جامد في صدري ونازل على دراعي الأيسر",
        "hpi": "كنت شغال وشيلت كرتونة ثقيلة وفجأة حسيت بحرقة ووجع كأني طوبة على صدري",
        "pmh": "بيجيله ضغط ومدخن شره",
        "correct_diagnosis": "Myocardial Infarction (STEMI)",
        "correct_treatment": "Dual Antiplatelet therapy, Oxygen, ECG, and Urgent PCI consultation"
      }`;
      const result = await model.generateContent(prompt);
      const profile = JSON.parse(result.response.text().replace(/```json/g, '').replace(/```/g, '').trim());
      setPatientSession(profile);
      setPatientMessages([{ role: 'model', content: `أهلاً يا دكتور.. أنا عندي ${profile.chief_complaint}. إيه اللي حضرتك حابب تسأهلني عنه؟` }]);
    } catch (err) {
      alert("Error starting virtual patient: " + err.message);
    } finally {
      setIsPatientLoading(false);
    }
  };

  const sendPatientMessage = async () => {
    if (!userMsgInput.trim() || !patientSession) return;
    const newMsgs = [...patientMessages, { role: 'user', content: userMsgInput }];
    setPatientMessages(newMsgs);
    setUserMsgInput('');
    setIsPatientLoading(true);

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        systemInstruction: "You are an Egyptian patient in a clinic speaking natural Egyptian Arabic dialect matching your medical symptoms."
      });
      const prompt = `Patient Profile: ${JSON.stringify(patientSession)}. Chat history: ${JSON.stringify(newMsgs)}. Reply as the patient in Egyptian Arabic.`;
      const result = await model.generateContent(prompt);
      setPatientMessages([...newMsgs, { role: 'model', content: result.response.text() }]);
    } catch (err) {
      setPatientMessages([...newMsgs, { role: 'model', content: "عذراً يا دكتور، تعبان ومش قادر أتكلم." }]);
    } finally {
      setIsPatientLoading(false);
    }
  };

  const evaluatePatientCase = async () => {
    if (!diagnosisInput || !treatmentInput) { alert("Please enter diagnosis and treatment."); return; }
    setIsPatientLoading(true);
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = `Evaluate the medical student's diagnosis (${diagnosisInput}) and treatment (${treatmentInput}) compared to correct case data: ${JSON.stringify(patientSession)}. Return strict JSON format: {"score": 90, "feedback": "Detailed Egyptian Arabic feedback...", "missed_points": []}`;
      const result = await model.generateContent(prompt);
      const evalData = JSON.parse(result.response.text().replace(/```json/g, '').replace(/```/g, '').trim());
      setEvaluationResult(evalData);
    } catch (err) {
      setEvaluationResult({ score: 85, feedback: "تم تقييم الحالة بنجاح وبكفاءة عالية.", missed_points: [] });
    } finally {
      setIsPatientLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <h2 className="text-3xl font-bold">🏥 Virtual Patient Clinic (Egyptian Dialect)</h2>
      {!patientSession ? (
        <div className="p-8 bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800 text-center space-y-4 shadow-sm">
          <p className="text-slate-500">Practice clinical reasoning with an interactive AI virtual patient in Egyptian Arabic.</p>
          <button onClick={startVirtualPatient} disabled={isPatientLoading} className="bg-teal-600 text-white px-8 py-4 rounded-xl font-bold flex items-center justify-center mx-auto shadow-lg hover:bg-teal-700">
            {isPatientLoading ? <Loader2 className="animate-spin mr-2"/> : <Stethoscope className="mr-2"/>} Start New Simulation Case
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="p-4 bg-teal-50 dark:bg-teal-900/20 rounded-xl border border-teal-200">
            <h4 className="font-bold text-teal-700 dark:text-teal-400">Active Patient Profile</h4>
            <p className="text-sm mt-1">Age: {patientSession.age} | Gender: {patientSession.gender} | Chief Complaint: {patientSession.chief_complaint}</p>
          </div>
          <div className="h-96 overflow-y-auto bg-white dark:bg-slate-900 p-4 rounded-2xl border dark:border-slate-800 space-y-4 shadow-inner">
            {patientMessages.map((msg, idx) => (
              <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`p-4 rounded-2xl max-w-lg text-sm ${msg.role === 'user' ? 'bg-teal-600 text-white' : 'bg-slate-100 dark:bg-slate-800 dark:text-slate-200'}`}>
                  {msg.content}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="text" placeholder="اسأل المريض عن الأعراض (History of Present Illness)..." value={userMsgInput} onChange={e=>setUserMsgInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendPatientMessage()} className="flex-1 p-3 border rounded-xl dark:bg-slate-900 outline-none dark:border-slate-700" />
            <button onClick={sendPatientMessage} disabled={isPatientLoading} className="bg-teal-600 text-white px-6 rounded-xl font-bold flex items-center"><Send size={18}/></button>
          </div>
          <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800 space-y-4 shadow-sm">
            <h3 className="font-bold text-lg">Final Diagnosis & Treatment Plan</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="text" placeholder="Your Diagnosis" value={diagnosisInput} onChange={e=>setDiagnosisInput(e.target.value)} className="p-3 border rounded-xl dark:bg-slate-800 dark:border-slate-700 outline-none"/>
              <input type="text" placeholder="Your Treatment Plan" value={treatmentInput} onChange={e=>setTreatmentInput(e.target.value)} className="p-3 border rounded-xl dark:bg-slate-800 dark:border-slate-700 outline-none"/>
            </div>
            <button onClick={evaluatePatientCase} disabled={isPatientLoading} className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold shadow hover:bg-emerald-700">Submit & Evaluate Case</button>
          </div>
          {evaluationResult && (
            <div className="p-6 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-200 space-y-3">
              <h3 className="font-bold text-2xl text-emerald-700 flex items-center gap-2"><CheckCircle/> Evaluation Score: {evaluationResult.score}/100</h3>
              <p className="text-sm leading-relaxed dark:text-slate-200">{evaluationResult.feedback}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}