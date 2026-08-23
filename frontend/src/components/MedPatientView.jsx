import React, { useState, useRef, useEffect } from 'react';
import { Button, Card } from './ui';
import { Stethoscope, Send, Activity, Beaker, FileText, CheckCircle, Loader2, User, History, UploadCloud } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export default function MedPatientView({ apiKey }) {
  const [sessionActive, setSessionActive] = useState(false);
  const [mode, setMode] = useState('select'); // 'select', 'random_setup', 'pdf_setup'
  const [loadingCase, setLoadingCase] = useState(false);
  
  const [patientContext, setPatientContext] = useState(null);
  const [uploadedPdfFile, setUploadedPdfFile] = useState(null);
  const [pdfExtractedText, setPdfExtractedText] = useState('');
  
  const [messages, setMessages] = useState([]);
  const [inputMsg, setInputMsg] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  const [historyData, setHistoryData] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const [labResults, setLabResults] = useState([]);
  const [diagnosis, setDiagnosis] = useState('');
  const [treatment, setTreatment] = useState('');
  
  const [evaluation, setEvaluation] = useState(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const chatEndRef = useRef(null);
  
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    if(showHistory) {
      fetch(`${API_URL}/api/medpatient/history`)
        .then(res => res.json())
        .then(data => { if(data.success) setHistoryData(data.data); })
        .catch(err => console.error(err));
    }
  }, [showHistory]);

  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if(!file || file.type !== 'application/pdf') return;
    setUploadedPdfFile(file);
    
    setLoadingCase(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('task', 'summary');
    formData.append('count', 1);

    try {
      const res = await fetch(`${API_URL}/generate/`, {
        method: 'POST',
        headers: { 'X-API-Key': apiKey },
        body: formData
      });
      const data = await res.json();
      if(data.success) {
        setPdfExtractedText(JSON.stringify(data.result.data));
      } else {
        alert("فشل قراءة الملف لتوليد الحالة.");
      }
    } catch(err) {
      alert("خطأ في الاتصال بالرفع.");
    } finally {
      setLoadingCase(false);
    }
  };

  const startSession = async (selectedMode) => {
    setLoadingCase(true);
    try {
      const res = await fetch(`${API_URL}/api/medpatient/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body: JSON.stringify({ mode: selectedMode, pdf_text: pdfExtractedText })
      });
      const data = await res.json();
      if(data.success && data.profile) {
        setPatientContext(data.profile);
        setSessionActive(true);
        setMessages([{ role: 'assistant', content: `أهلاً يا دكتور.. حاسس بتعب ومش قادرة أخد نفسي كويس والموضوع بدأ معايا بـ (${data.profile.chief_complaint}). ممكن تساعدني؟` }]);
        setLabResults([]);
        setEvaluation(null);
        setDiagnosis('');
        setTreatment('');
      } else {
        alert("فشل إنشاء الحالة الإكلينيكية.");
      }
    } catch(err) {
      alert("حدث خطأ أثناء بدء الاستشارة.");
    } finally {
      setLoadingCase(false);
    }
  };

  const endSession = () => {
    if(window.confirm('هل أنت متأكد من إنهاء الاستشارة؟')) {
      setSessionActive(false);
      setMode('select');
      setMessages([]);
    }
  };

  const sendMessage = async () => {
    if (!inputMsg.trim() || isTyping) return;
    
    const newMsg = { role: 'user', content: inputMsg };
    const updatedMessages = [...messages, newMsg];
    setMessages(updatedMessages);
    setInputMsg('');
    setIsTyping(true);

    try {
      const res = await fetch(`${API_URL}/api/medpatient/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body: JSON.stringify({ messages: updatedMessages, patient_context: patientContext })
      });
      const data = await res.json();
      if (data.success) {
        setMessages([...updatedMessages, { role: 'assistant', content: data.reply }]);
      } else {
        setMessages([...updatedMessages, { role: 'assistant', content: 'عذراً، حدث خطأ في الاتصال.' }]);
      }
    } catch (err) {
      setMessages([...updatedMessages, { role: 'assistant', content: 'خطأ في الشبكة.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  const requestInvestigation = (testName) => {
    let result = '';
    if (testName.includes('BNP')) result = '950 pg/mL (مرتفع جداً - يشير لهبوط قلب)';
    else if (testName.includes('Troponin')) result = 'إيجابي (Positive)';
    else if (testName.includes('X-Ray')) result = 'صورة الصدر تظهر احتقان بالرئتين (Pulmonary Congestion)';
    else if (testName.includes('ECG')) result = 'تخطيط القلب يظهر تسرع قلبي (Sinus Tachycardia)';
    else result = 'النتيجة طبيعية ولا توجد علامات حادة.';
    
    setLabResults([...labResults, { test: testName, result }]);
  };

  const submitEvaluation = async () => {
    if (!diagnosis.trim() || !treatment.trim()) { alert("يرجى إدخال التشخيص وخطة العلاج أولاً."); return; }
    setIsEvaluating(true);
    try {
      const res = await fetch(`${API_URL}/api/medpatient/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body: JSON.stringify({ diagnosis, treatment, patient_context: patientContext, chat_history: messages })
      });
      const data = await res.json();
      if (data.success) setEvaluation(data.evaluation);
    } catch (err) { alert("حدث خطأ أثناء التقييم."); } finally { setIsEvaluating(false); }
  };

  if (!sessionActive) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center space-y-6 animate-in zoom-in-95" dir="rtl">
        <div className="w-24 h-24 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center mb-4">
          <Stethoscope size={48} />
        </div>
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white">عيادة المحاكاة الإكلينيكية (Virtual Patient)</h2>
        <p className="text-slate-500 max-w-lg">اختر طريقة توليد الحالة لبدء المحاكاة وتطوير مهاراتك التشخيصية:[cite: 9]</p>

        {mode === 'select' && (
          <div className="flex flex-col sm:flex-row gap-4 mt-4 w-full max-w-md">
            <Button className="flex-1 py-4 text-base bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md" onClick={() => startSession('random')}>
              🎲 حالة عشوائية بالكامل (AI)
            </Button>
            <Button className="flex-1 py-4 text-base bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-md" onClick={() => setMode('pdf_setup')}>
              📄 توليد حالة من ملف PDF
            </Button>
            <Button onClick={() => setShowHistory(!showHistory)} variant="secondary" className="px-6 py-4 rounded-xl">
              <History className="mr-2" size={18} /> السجل
            </Button>
          </div>
        )}

        {mode === 'pdf_setup' && (
          <Card className="p-6 w-full max-w-md bg-white dark:bg-slate-900 border-dashed dark:border-slate-700 animate-in fade-in">
            <h3 className="font-bold text-lg mb-3">ارفع محاضرة الـ PDF لتوليد حالة مخصصة</h3>
            {!uploadedPdfFile ? (
              <label className="flex flex-col items-center justify-center h-40 border-2 border-dashed rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                <UploadCloud size={32} className="text-teal-600 mb-2"/>
                <span className="text-sm font-semibold">اضغط لرفع ملف PDF</span>
                <input type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload}/>
              </label>
            ) : (
              <p className="text-sm text-teal-600 font-bold mb-4">تم رفع الملف: {uploadedPdfFile.name}</p>
            )}
            <div className="flex gap-3 mt-4">
              <Button variant="secondary" onClick={() => setMode('select')} className="flex-1">رجوع</Button>
              <Button disabled={!pdfExtractedText || loadingCase} className="flex-1 bg-teal-600" onClick={() => startSession('pdf')}>
                {loadingCase ? <Loader2 className="animate-spin" size={18}/> : 'ابدأ الحالة'}
              </Button>
            </div>
          </Card>
        )}

        {loadingCase && mode === 'select' && (
          <div className="flex items-center gap-3 text-teal-600 font-bold mt-4">
            <Loader2 className="animate-spin" size={24} /> جاري تحضير المريض وتوليد الأعراض...
          </div>
        )}

        {showHistory && (
          <div className="w-full max-w-3xl mt-8 animate-in fade-in">
            <h3 className="font-bold text-xl mb-4 border-b dark:border-slate-800 pb-2">سجل الحالات السابقة</h3>
            {historyData.length === 0 ? <p className="text-slate-500">لا توجد حالات مسجلة.</p> : (
               <div className="space-y-3">
                 {historyData.map(h => (
                    <Card className="p-4 flex justify-between items-center bg-white dark:bg-slate-800" key={h.id}>
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-200">التشخيص: {h.diagnosis}</p>
                        <p className="text-xs text-slate-400 mt-1">{new Date(h.date).toLocaleString()}</p>
                      </div>
                      <div className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 font-bold px-4 py-2 rounded-xl text-lg">{h.score}%</div>
                    </Card>
                 ))}
               </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in" dir="rtl">
      <div className="lg:col-span-3 flex justify-between items-center bg-slate-900 text-white p-4 rounded-2xl shadow-lg border border-slate-800">
        <div className="flex items-center gap-4">
          <div className="bg-purple-900/50 text-purple-300 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2">
            <User size={16} /> {patientContext?.gender} - {patientContext?.age} سنة
          </div>
          <span className="text-slate-400 text-sm">الشكوى الرئيسية: {patientContext?.chief_complaint}</span>
        </div>
        <Button className="bg-rose-900/40 text-rose-300 hover:bg-rose-900/60 border-rose-800" onClick={endSession} variant="danger">
          إنهاء الاستشارة
        </Button>
      </div>

      <div className="lg:col-span-2 flex flex-col h-[550px] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 font-bold text-slate-700 dark:text-slate-200">
          المحادثة السريرية مع المريض
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/50 dark:bg-[#0b0f19]">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-4 text-sm rounded-2xl ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tl-none' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-tr-none shadow-sm'}`}>
                {msg.content}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="max-w-[80%] p-4 text-sm rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-tr-none flex gap-2 items-center animate-pulse">
                المريض يكتب الرد... ⏳
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex gap-2">
          <input type="text" value={inputMsg} onChange={(e) => setInputMsg(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} placeholder="اسأل المريض عن الأعراض (HPI)..." className="flex-1 p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 outline-none text-slate-900 dark:text-white transition-all"/>
          <Button className="bg-blue-600 px-6 rounded-xl" disabled={isTyping} onClick={sendMessage}>
            <Send size={18} />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <Card className="p-5 flex flex-col flex-1 border-slate-200 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center border-b dark:border-slate-800 pb-2">
            <Beaker className="ml-2 text-purple-500" size={18} /> الفحوصات والتحاليل والأشعة
          </h3>
          <div className="space-y-2 mb-4">
            <Button onClick={() => requestInvestigation('تحليل BNP')} variant="secondary" className="w-full justify-between text-xs py-2 dark:bg-slate-800 dark:border-slate-700">
              <span>تحليل BNP</span> <span className="text-blue-500">طلب</span>
            </Button>
            <Button onClick={() => requestInvestigation('إنزيمات القلب Troponin')} variant="secondary" className="w-full justify-between text-xs py-2 dark:bg-slate-800 dark:border-slate-700">
              <span>إنزيمات القلب (Troponin)</span> <span className="text-blue-500">طلب</span>
            </Button>
            <Button onClick={() => requestInvestigation('أشعة سينية على الصدر Chest X-Ray')} variant="secondary" className="w-full justify-between text-xs py-2 dark:bg-slate-800 dark:border-slate-700">
              <span>أشعة الصدر (X-Ray)</span> <span className="text-blue-500">طلب</span>
            </Button>
            <Button onClick={() => requestInvestigation('تخطيط القلب ECG')} variant="secondary" className="w-full justify-between text-xs py-2 dark:bg-slate-800 dark:border-slate-700">
              <span>تخطيط القلب (ECG)</span> <span className="text-blue-500">طلب</span>
            </Button>
          </div>
          <div className="mt-auto bg-slate-50 dark:bg-[#0b0f19] p-3 rounded-xl border border-slate-100 dark:border-slate-800 min-h-[100px]">
            <span className="text-xs text-slate-500 font-bold block mb-2">النتائج:</span>
            {labResults.length === 0 ? <p className="text-xs text-slate-400">لم تطلب أي فحوصات بعد.</p> : 
              <ul className="space-y-2 text-xs">
                {labResults.map((lab, idx) => (
                  <li key={idx} className="flex flex-col text-slate-700 dark:text-slate-300">
                    <span className="font-bold">{lab.test}:</span>
                    <span className="text-emerald-600 dark:text-emerald-400">{lab.result}</span>
                  </li>
                ))}
              </ul>
            }
          </div>
        </Card>

        <Card className="p-5 border-slate-200 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center border-b dark:border-slate-800 pb-2">
            <FileText className="ml-2 text-emerald-500" size={18} /> التشخيص والعلاج
          </h3>
          {!evaluation ? (
            <div className="space-y-3">
              <input type="text" placeholder="اكتب التشخيص النهائي..." value={diagnosis} onChange={e=>setDiagnosis(e.target.value)} className="w-full p-3 text-sm rounded-xl bg-slate-100 dark:bg-slate-800 border-transparent focus:border-emerald-500 outline-none text-slate-900 dark:text-white" />
              <input type="text" placeholder="اكتب خطة العلاج..." value={treatment} onChange={e=>setTreatment(e.target.value)} className="w-full p-3 text-sm rounded-xl bg-slate-100 dark:bg-slate-800 border-transparent focus:border-emerald-500 outline-none text-slate-900 dark:text-white" />
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700 mt-2" disabled={isEvaluating} onClick={submitEvaluation}>
                {isEvaluating ? <Loader2 className="animate-spin" size={18} /> : 'إرسال وتقييم الحالة'}
              </Button>
            </div>
          ) : (
            <div className="animate-in fade-in space-y-4 text-center">
              <div className="relative inline-flex items-center justify-center">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-200 dark:text-slate-800" />
                  <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * evaluation.score) / 100} className="text-emerald-500 transition-all duration-1000" />
                </svg>
                <span className="absolute text-2xl font-bold text-emerald-600 dark:text-emerald-400">{evaluation.score}%</span>
              </div>
              <div className="text-sm text-right bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-300">
                <span className="font-bold block mb-1">التقرير السريري:</span>{evaluation.feedback}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}