import React, { useState, useRef, useEffect } from 'react';
import { Card, Button } from './ui'; 
import { CheckCircle, XCircle, BrainCircuit, AlertTriangle, Info, BookOpen, Stethoscope, Download, Image as ImageIcon, Send, MessageSquare, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Save user quiz/case attempt to localStorage
 */
const saveAttempt = (item, selectedOption, isCorrect, type) => {
  try {
    const history = JSON.parse(localStorage.getItem('medos_history') || '[]');
    const record = {
      id: Date.now(),
      question_text: item.question || item.vignette || "Medical Question",
      topic: item.topic || item.concept || "General",
      concept: item.concept || item.topic || "Core Concept",
      difficulty: item.difficulty || (type === 'case' ? 'USMLE Step 2 CK' : 'USMLE Step 1'),
      user_answer: selectedOption,
      correct_answer: item.correctAnswer,
      is_correct: isCorrect,
      timestamp: new Date().toISOString(),
      type
    };
    localStorage.setItem('medos_history', JSON.stringify([record, ...history.slice(0, 100)]));

    // If incorrect, add to High-Yield Mistakes tracker
    if (!isCorrect) {
      const mistakes = JSON.parse(localStorage.getItem('medos_mistakes') || '[]');
      const newMistake = {
        id: Date.now(),
        topic: item.topic || item.concept || "General",
        concept: (item.question || item.vignette || "").substring(0, 80) + "...",
        correct_answer: item.correctAnswer,
        user_answer: selectedOption,
        explanation: typeof item.explanation === 'object' ? (item.explanation.correct || item.explanation.clinical_reasoning) : item.explanation,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('medos_mistakes', JSON.stringify([newMistake, ...mistakes]));
    }
  } catch (err) {
    console.error("Failed to save attempt locally:", err);
  }
};

/**
 * Accordion component for collapsible explanations
 */
function AccordionItem({ title, children, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden mb-3">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-left font-bold text-sm text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <span className="flex items-center gap-2">{title}</span>
        <span className="text-xs text-slate-400">{isOpen ? '▲' : '▼'}</span>
      </button>
      {isOpen && (
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * MCQ Renderer
 */
export const MCQRenderer = ({ data, idx = 1 }) => {
  const [selected, setSelected] = useState(null);
  if (!data) return null;
  
  // Clean matching for correct answer (handles both 'A' and 'Option Text')
  const options = Array.isArray(data.options) ? data.options : [];
  const correctAnswer = data.correctAnswer || "";
  
  const isSelectedCorrect = () => {
    if (!selected) return false;
    if (selected === correctAnswer) return true;
    const selectedIdx = options.indexOf(selected);
    const letter = String.fromCharCode(65 + selectedIdx);
    return letter === correctAnswer;
  };

  const isOptionCorrect = (opt, i) => {
    if (opt === correctAnswer) return true;
    const letter = String.fromCharCode(65 + i);
    return letter === correctAnswer;
  };

  const handleSelect = (opt, i) => {
    if (selected !== null) return;
    setSelected(opt);
    const correct = isOptionCorrect(opt, i);
    saveAttempt(data, opt, correct, 'mcq');
  };

  const explanationCorrect = typeof data.explanation === 'object' ? data.explanation?.correct : data.explanation;
  const distractors = typeof data.explanation === 'object' && data.explanation?.distractors ? data.explanation.distractors : {};
  const keywords = data.keywords || [data.concept || ""];

  const handleImageSearch = () => {
    const query = keywords.filter(Boolean).join(' ') || data.concept || "medical";
    window.open(`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}+medical`, '_blank');
  };

  const isCorrect = isSelectedCorrect();

  return (
    <Card className="p-6 mb-6 border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <span className="text-xs font-bold bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 px-3 py-1 rounded-full">Question #{idx}</span>
        <span className="text-xs font-bold bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full">{data.topic || "General"}</span>
      </div>
      
      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-6 leading-relaxed">{data.question}</h3>
      
      <div className="space-y-3">
        {options.map((opt, i) => {
          const letter = String.fromCharCode(65 + i);
          const optionIsCorrect = isOptionCorrect(opt, i);
          let btnClass = "w-full text-left p-4 rounded-xl border-2 transition-all text-sm font-medium flex items-center gap-3 ";
          
          if (!selected) {
            btnClass += "border-slate-200 dark:border-slate-700 hover:border-teal-500 hover:bg-teal-50/50 dark:hover:bg-teal-900/20 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100";
          } else if (optionIsCorrect) {
            btnClass += "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 font-bold";
          } else if (selected === opt) {
            btnClass += "border-rose-500 bg-rose-50 dark:bg-rose-900/20 text-rose-800 dark:text-rose-300";
          } else {
            btnClass += "border-slate-200 dark:border-slate-800 opacity-40 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300";
          }

          return (
            <button key={i} disabled={!!selected} onClick={() => handleSelect(opt, i)} className={btnClass}>
              <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-xs shrink-0">{letter}</span>
              <span className="flex-1">{opt}</span>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="mt-6 p-5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 animate-in fade-in">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {isCorrect ? <CheckCircle className="text-emerald-500" size={22} /> : <XCircle className="text-rose-500" size={22} />}
              <h4 className={`font-bold text-base ${isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {isCorrect ? 'Correct Answer!' : `Incorrect. Correct: ${data.correctAnswer}`}
              </h4>
            </div>
            {keywords.length > 0 && (
              <Button className="text-xs px-3 py-1.5" onClick={handleImageSearch} variant="secondary">
                <ImageIcon className="mr-1.5" size={14} /> Medical Image
              </Button>
            )}
          </div>
          
          <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300">
            <div>
              <span className="font-bold block mb-1 text-slate-900 dark:text-white">Explanation:</span>
              <p className="leading-relaxed">{typeof explanationCorrect === 'string' ? explanationCorrect : "Explanation unavailable."}</p>
            </div>
            {Object.keys(distractors).length > 0 && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                <span className="font-bold block mb-1 text-slate-500 dark:text-slate-400">Why distractors are incorrect:</span>
                <ul className="list-disc pl-5 space-y-1">
                  {Object.entries(distractors).map(([key, reason]) => (
                    <li key={key}><strong>{key}:</strong> {typeof reason === 'string' ? reason : "..."}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
};

/**
 * Clinical Case Renderer
 */
export const ClinicalCaseRenderer = ({ data, idx = 1 }) => {
  const [selected, setSelected] = useState(null);
  if (!data) return null;
  
  const options = Array.isArray(data.options) ? data.options : [];
  const reasoning = typeof data.explanation === 'object' ? data.explanation?.clinical_reasoning : data.explanation;
  const distractors = typeof data.explanation === 'object' && data.explanation?.distractors ? data.explanation.distractors : {};
  const keywords = data.keywords || [data.topic || ""];

  const isOptionCorrect = (opt, i) => {
    if (opt === data.correctAnswer) return true;
    const letter = String.fromCharCode(65 + i);
    return letter === data.correctAnswer;
  };

  const handleSelect = (opt, i) => {
    if (selected !== null) return;
    setSelected(opt);
    const correct = isOptionCorrect(opt, i);
    saveAttempt(data, opt, correct, 'case');
  };

  const handleImageSearch = () => {
    const query = keywords.filter(Boolean).join(' ') || data.topic || "clinical";
    window.open(`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}+medical`, '_blank');
  };

  return (
    <Card className="p-6 mb-6 border-l-4 border-l-teal-500 dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 text-xs font-bold">
          <Stethoscope size={14} /> Case #{idx} • {data.difficulty || "USMLE Step 2 CK"}
        </div>
        <span className="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-full">{data.topic || "Clinical"}</span>
      </div>

      <div className="bg-slate-50 dark:bg-slate-800/60 p-5 rounded-2xl mb-6 text-slate-800 dark:text-slate-200 leading-relaxed text-sm border border-slate-100 dark:border-slate-800">
        <p className="font-sans whitespace-pre-wrap">{data.vignette}</p>
      </div>

      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4">{data.question}</h3>

      <div className="space-y-3">
        {options.map((opt, i) => {
          const letter = String.fromCharCode(65 + i);
          const optionIsCorrect = isOptionCorrect(opt, i);
          let btnClass = "w-full text-left p-3.5 rounded-xl border-2 transition-all text-sm font-medium flex items-center gap-3 ";
          
          if (!selected) {
            btnClass += "border-slate-200 dark:border-slate-700 hover:border-teal-500 hover:bg-teal-50/50 dark:hover:bg-teal-900/20 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100";
          } else if (optionIsCorrect) {
            btnClass += "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 font-bold";
          } else if (selected === opt) {
            btnClass += "border-rose-500 bg-rose-50 dark:bg-rose-900/20 text-rose-800 dark:text-rose-300";
          } else {
            btnClass += "border-slate-200 dark:border-slate-800 opacity-40 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300";
          }

          return (
            <button key={i} disabled={!!selected} onClick={() => handleSelect(opt, i)} className={btnClass}>
              <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-xs shrink-0">{letter}</span>
              <span className="flex-1">{opt}</span>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="mt-6 space-y-4 animate-in fade-in">
          <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 space-y-3">
            <div className="flex justify-between items-center mb-1">
               <h4 className="font-bold text-blue-800 dark:text-blue-400 flex items-center"><BrainCircuit className="mr-2" size={16} /> Clinical Reasoning</h4>
               {keywords.length > 0 && (
                 <Button className="text-xs px-3 py-1 bg-white/50 dark:bg-slate-800" onClick={handleImageSearch} variant="secondary">
                   <ImageIcon className="mr-1" size={14} /> View Image
                 </Button>
               )}
            </div>
            <p className="text-sm text-blue-900/90 dark:text-blue-300/90 leading-relaxed">{typeof reasoning === 'string' ? reasoning : ""}</p>

            {Object.keys(distractors).length > 0 && (
              <div className="pt-3 border-t border-blue-200/60 dark:border-blue-900/40">
                <span className="font-bold text-xs flex items-center gap-1.5 text-blue-950 dark:text-blue-200 mb-1.5">
                  <AlertTriangle size={14} className="text-amber-500" /> Why other options are incorrect:
                </span>
                <ul className="list-disc pl-5 space-y-1.5 text-xs text-blue-900/90 dark:text-blue-300/90">
                  {Object.entries(distractors).map(([key, reason]) => (
                    <li key={key}>
                      <strong className="font-bold text-blue-950 dark:text-blue-100">{key}:</strong> {typeof reason === 'string' ? reason : "..."}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {data.key_takeaway && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30">
              <h4 className="font-bold text-amber-800 dark:text-amber-400 mb-2 flex items-center"><AlertTriangle className="mr-2" size={16} /> Key Clinical Takeaway</h4>
              <p className="text-sm text-amber-900/90 dark:text-amber-300/90 leading-relaxed">{data.key_takeaway}</p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

/**
 * Smart Summary Renderer with Direct Gemini Chat
 */
export const SmartSummaryRenderer = ({ data, rawPdfText, apiKey }) => {
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMsg, setInputMsg] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  if (!data) return null;

  const handleSendMessage = async () => {
    if (!inputMsg.trim() || isTyping) return;
    if (!apiKey) {
      alert("Please configure your Gemini API Key in Settings to chat.");
      return;
    }
    
    const userMessage = inputMsg.trim();
    const updatedMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(updatedMessages);
    setInputMsg('');
    setIsTyping(true);

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction: "You are a top Egyptian medical professor and tutor. Explain medical concepts clearly using friendly Egyptian Arabic mixed with precise English medical terminology. Answer questions based on the provided lecture/summary context."
      });

      const promptContext = `Lecture / Summary Context:\n${rawPdfText ? rawPdfText.substring(0, 10000) : JSON.stringify(data)}\n\nConversation History:\n${JSON.stringify(updatedMessages)}\n\nUser Question: ${userMessage}`;
      const result = await model.generateContent(promptContext);
      const reply = result.response.text();
      setMessages([...updatedMessages, { role: 'model', content: reply }]);
    } catch (err) {
      console.error("Chat error:", err);
      setMessages([...updatedMessages, { role: 'model', content: `عذراً يا دكتور، حدث خطأ أثناء الاتصال بالذكاء الاصطناعي: ${err.message}` }]);
    } finally {
      setIsTyping(false);
    }
  };
  
  return (
    <Card className="p-6 mb-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 relative shadow-sm">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <span className="text-xs font-bold text-teal-600 uppercase tracking-widest block mb-1">Smart Lecture Notes</span>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{data.topic || "Medical Summary"}</h2>
        </div>
        <Button onClick={() => setChatOpen(true)} variant="primary" className="bg-teal-600 hover:bg-teal-700 text-white">
          <MessageSquare className="mr-2" size={16} /> مناقشة المحاضرة (AI Chat)
        </Button>
      </div>
      
      {/* Full Screen Chat Modal */}
      {chatOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full h-full max-w-5xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95">
            
            {/* Header */}
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  🩺 مناقشة المحاضرة مع الدكتور
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  اسأل في أي Mechanism أو تفاصيل وهيشرحها لك بالعامية الطبية والمصطلحات الإنجليزية.
                </p>
              </div>
              <Button onClick={() => setChatOpen(false)} variant="danger" className="text-xs px-3 py-1.5">
                ✕ إغلاق
              </Button>
            </div>

            {/* Messages Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50 dark:bg-slate-950/50">
              {messages.length === 0 && (
                <div className="text-center text-slate-400 my-auto py-16">
                  <BookOpen className="mx-auto mb-3 text-teal-600/60" size={40} />
                  <p className="text-base font-medium">أهلاً يا دكتور! معاك محتوى المحاضرة، اسألني في أي تفصيلة واقفة معاك وهبسطها لك فوراً.</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-4 text-sm leading-relaxed rounded-2xl shadow-sm ${msg.role === 'user' ? 'bg-teal-600 text-white rounded-br-none' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-none whitespace-pre-wrap'}`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm animate-pulse">
                    جاري كتابة الشرح يا دكتور... ⏳
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Footer Input */}
            <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center gap-3">
              <input 
                type="text" 
                value={inputMsg} 
                onChange={e => setInputMsg(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && handleSendMessage()} 
                placeholder="اكتب سؤالك هنا للتناقش في المحاضرة..." 
                className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 border border-slate-200 dark:border-slate-700 text-sm" 
              />
              <Button className="px-5 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl" disabled={isTyping} onClick={handleSendMessage} variant="primary">
                <Send size={16} />
              </Button>
            </div>

          </div>
        </div>
      )}

      <div className="space-y-3">
        {data.what_it_means && (
          <AccordionItem title={<span><BookOpen className="inline mr-2 text-teal-600" size={16} /> 1. What does it mean? (Definition)</span>} defaultOpen={true}>
            <p className="whitespace-pre-wrap">{data.what_it_means}</p>
          </AccordionItem>
        )}
        {data.why_it_happens && (
          <AccordionItem title={<span><Info className="inline mr-2 text-blue-600" size={16} /> 2. Why does it happen? (Pathophysiology)</span>} defaultOpen={true}>
            <p className="whitespace-pre-wrap">{data.why_it_happens}</p>
          </AccordionItem>
        )}
        {data.presentation && (
          <AccordionItem title="3. Clinical Presentation">
            <p className="whitespace-pre-wrap">{data.presentation}</p>
          </AccordionItem>
        )}
        {data.diagnosis && (
          <AccordionItem title="4. Diagnostic Approach & Investigations">
            <p className="whitespace-pre-wrap">{data.diagnosis}</p>
          </AccordionItem>
        )}
        {data.management && (
          <AccordionItem title="5. Management & Treatment Plan">
            <p className="text-emerald-700 dark:text-emerald-300 whitespace-pre-wrap font-medium">{data.management}</p>
          </AccordionItem>
        )}
        {data.exam_traps && (
          <AccordionItem title={<span><AlertTriangle className="inline mr-2 text-rose-600" size={16} /> 6. High-Yield Exam Traps & Pitfalls</span>} defaultOpen={true}>
            <p className="text-rose-700 dark:text-rose-300 whitespace-pre-wrap font-medium">{data.exam_traps}</p>
          </AccordionItem>
        )}
      </div>
    </Card>
  );
};

/**
 * Interactive Anki Flashcards Deck
 */
export const AnkiWorkspace = ({ initialCards = [], fileName = "MedOS_Deck" }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const cards = Array.isArray(initialCards) ? initialCards : [];

  if (cards.length === 0) return null;

  const currentCard = cards[currentIndex] || cards[0];

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % cards.length);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
  };

  const exportToCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    cards.forEach(card => {
       let front = (card.front || "").replace(/"/g, '""');
       let back = (card.back || "").replace(/"/g, '""');
       csvContent += `"${front}","${back}"\r\n`;
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${fileName || 'MedOS_Anki_Deck'}.csv`);
    document.body.appendChild(link); 
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex justify-between items-center">
        <span className="text-sm font-bold text-slate-500 dark:text-slate-400">
          Card {currentIndex + 1} of {cards.length}
        </span>
        <div className="flex gap-2">
          <Button variant="secondary" className="text-xs py-2" onClick={exportToCSV}>
            <Download className="mr-1.5" size={14} /> Export Deck (CSV)
          </Button>
          <Button variant="ghost" className="text-xs py-2" onClick={() => setIsFlipped(!isFlipped)}>
            <RotateCcw className="mr-1.5" size={14} /> Flip
          </Button>
        </div>
      </div>

      {/* 3D Flip Card Container */}
      <div 
        onClick={() => setIsFlipped(!isFlipped)} 
        className="min-h-[300px] bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 hover:border-teal-500 rounded-3xl p-8 flex flex-col items-center justify-center text-center cursor-pointer shadow-xl transition-all select-none"
      >
        {!isFlipped ? (
          <div className="animate-in fade-in space-y-4">
            <span className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-widest block">
              Front • Prompt / Question
            </span>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white leading-relaxed">
              {currentCard.front || "No question content"}
            </h3>
            <p className="text-xs text-slate-400 mt-6">Click card to reveal answer</p>
          </div>
        ) : (
          <div className="animate-in fade-in space-y-4">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block">
              Back • High-Yield Answer
            </span>
            <p className="text-lg text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
              {currentCard.back || "No answer content"}
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-between gap-4">
        <Button variant="secondary" onClick={handlePrev} className="px-6 py-3">
          <ChevronLeft size={18} className="mr-1"/> Previous
        </Button>
        <Button variant="primary" onClick={handleNext} className="bg-teal-600 px-6 py-3">
          Next Card <ChevronRight size={18} className="ml-1"/>
        </Button>
      </div>
    </div>
  );
};