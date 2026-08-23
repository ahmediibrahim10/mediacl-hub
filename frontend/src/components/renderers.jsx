import React, { useState, useRef, useEffect } from 'react';
import { Card, Button, Accordion } from './ui'; 
import { CheckCircle, XCircle, BrainCircuit, AlertTriangle, Info, BookOpen, Stethoscope, Download, Image as ImageIcon, Send, MessageSquare } from 'lucide-react';
import ReactFlow, { Background, Controls } from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const saveAttempt = async (item, selectedOption, isCorrect, type) => {
  try {
    await fetch(`${API_URL}/api/history/mcq`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question_text: item.question || item.vignette,
        topic: item.topic || "General",
        concept: item.concept || "General",
        source_file: "Local PDF", 
        difficulty: item.difficulty || (type === 'case' ? 'USMLE Step 2 CK' : 'USMLE Step 1'),
        user_answer: selectedOption,
        correct_answer: item.correctAnswer,
        is_correct: isCorrect
      })
    });
  } catch (err) {
    console.error("Failed to save attempt:", err);
  }
};

export const MCQRenderer = ({ data, idx }) => {
  const [selected, setSelected] = useState(null);
  if (!data) return null;
  
  const isCorrect = selected === data.correctAnswer;
  const options = Array.isArray(data.options) ? data.options : [];
  const explanationCorrect = typeof data.explanation === 'object' ? data.explanation?.correct : data.explanation;
  const distractors = typeof data.explanation === 'object' && data.explanation?.distractors ? data.explanation.distractors : {};
  const keywords = data.keywords || [];

  const handleSelect = (opt) => {
    setSelected(opt);
    saveAttempt(data, opt, opt === data.correctAnswer, 'mcq');
  };

  const handleImageSearch = () => {
    if (keywords.length > 0) {
      window.open(`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(keywords.join(' '))}+medical`, '_blank');
    }
  };

  return (
    <Card className="p-6 mb-6 border border-slate-200 dark:border-slate-800">
      <div className="flex justify-between items-center mb-4">
        <span className="text-xs font-bold bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-slate-600 dark:text-slate-300">Question {idx || 1}</span>
        <span className="text-xs font-bold bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full">{data.topic || "General"}</span>
      </div>
      <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-6">{data.question || "No Question Provided"}</h3>
      <div className="space-y-3">
        {options.map((opt, i) => {
          let btnClass = "w-full text-left p-4 rounded-xl border transition-all text-sm font-medium ";
          if (!selected) btnClass += "border-slate-200 dark:border-slate-700 hover:border-teal-500 hover:bg-teal-50 dark:hover:bg-teal-900/20 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100";
          else if (opt === data.correctAnswer) btnClass += "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300";
          else if (selected === opt) btnClass += "border-rose-500 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300";
          else btnClass += "border-slate-200 dark:border-slate-800 opacity-50 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100";

          return (
            <button key={i} disabled={!!selected} onClick={() => handleSelect(opt)} className={btnClass}>{opt}</button>
          );
        })}
      </div>
      {selected && (
        <div className="mt-6 p-5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 animate-in fade-in">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {isCorrect ? <CheckCircle className="text-emerald-500" size={20} /> : <XCircle className="text-rose-500" size={20} />}
              <h4 className={`font-bold ${isCorrect ? 'text-emerald-600' : 'text-rose-600'}`}>{isCorrect ? 'Correct!' : 'Incorrect'}</h4>
            </div>
            {keywords.length > 0 && (
              <Button className="text-xs px-3 py-1" onClick={handleImageSearch} variant="secondary">
                <ImageIcon className="mr-1" size={14} /> View Image
              </Button>
            )}
          </div>
          <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300">
            <div>
              <span className="font-bold block mb-1">Why {data.correctAnswer} is correct:</span>
              <p>{typeof explanationCorrect === 'string' ? explanationCorrect : "Explanation unavailable."}</p>
            </div>
            {Object.keys(distractors).length > 0 && (
              <div>
                <span className="font-bold block mb-1 text-slate-500">Why the others are wrong:</span>
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

export const ClinicalCaseRenderer = ({ data }) => {
  const [selected, setSelected] = useState(null);
  if (!data) return null;
  const options = Array.isArray(data.options) ? data.options : [];
  const reasoning = typeof data.explanation === 'object' ? data.explanation?.clinical_reasoning : data.explanation;
  const keywords = data.keywords || [];

  const handleSelect = (opt) => {
    setSelected(opt);
    saveAttempt(data, opt, opt === data.correctAnswer, 'case');
  };

  const handleImageSearch = () => {
    if (keywords.length > 0) {
      window.open(`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(keywords.join(' '))}+medical`, '_blank');
    }
  };

  return (
    <Card className="p-6 mb-6 border-l-4 border-l-teal-500 dark:bg-slate-800">
      <div className="flex justify-between items-center mb-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 text-xs font-bold">
          <Stethoscope size={14} /> USMLE Clinical Case
        </div>
      </div>
      <div className="bg-slate-50 dark:bg-slate-900 p-5 rounded-xl mb-6 text-slate-800 dark:text-slate-200 leading-relaxed text-sm border border-slate-100 dark:border-slate-800">
        {data.vignette || "Vignette missing"}
      </div>
      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4">{data.question || "No Question"}</h3>
      <div className="space-y-3">
        {options.map((opt, i) => {
          let btnClass = "w-full text-left p-3.5 rounded-xl border transition-all text-sm font-medium ";
          if (!selected) btnClass += "border-slate-200 dark:border-slate-700 hover:border-teal-500 hover:bg-teal-50 dark:hover:bg-teal-900/20 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100";
          else if (opt === data.correctAnswer) btnClass += "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300";
          else if (selected === opt) btnClass += "border-rose-500 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300";
          else btnClass += "border-slate-200 dark:border-slate-800 opacity-50 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100";

          return <button key={i} disabled={!!selected} onClick={() => handleSelect(opt)} className={btnClass}>{opt}</button>;
        })}
      </div>
      {selected && (
        <div className="mt-6 space-y-4 animate-in fade-in">
          <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30">
            <div className="flex justify-between items-center mb-2">
               <h4 className="font-bold text-blue-800 dark:text-blue-400 flex items-center"><BrainCircuit className="mr-2" size={16} /> Clinical Reasoning</h4>
               {keywords.length > 0 && (
                 <Button className="text-xs px-3 py-1 bg-white/50" onClick={handleImageSearch} variant="secondary">
                   <ImageIcon className="mr-1" size={14} /> View Image
                 </Button>
               )}
            </div>
            <p className="text-sm text-blue-900/80 dark:text-blue-300/80">{typeof reasoning === 'string' ? reasoning : ""}</p>
          </div>
          {data.key_takeaway && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30">
              <h4 className="font-bold text-amber-800 dark:text-amber-400 mb-2 flex items-center"><AlertTriangle className="mr-2" size={16} /> Key Takeaway</h4>
              <p className="text-sm text-amber-900/80 dark:text-amber-300/80">{data.key_takeaway}</p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

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
    
    const newMsg = { role: 'user', content: inputMsg };
    const updatedMessages = [...messages, newMsg];
    
    setMessages(updatedMessages);
    setInputMsg('');
    setIsTyping(true);

    try {
      const res = await fetch(`${API_URL}/api/pdfchat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body: JSON.stringify({ document_text: rawPdfText || JSON.stringify(data), messages: updatedMessages })
      });
      const resData = await res.json();
      if (resData.success) {
        setMessages(prev => [...prev, { role: 'assistant', content: resData.reply }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: "عذراً، حدث خطأ أثناء الاتصال بالذكاء الاصطناعي." }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "خطأ في الشبكة." }]);
    } finally {
      setIsTyping(false);
    }
  };
  
  return (
    <Card className="p-6 mb-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 relative">
      <div className="flex justify-between items-start mb-6 border-b border-slate-200 dark:border-slate-800 pb-4">
        <h2 className="text-2xl font-bold text-teal-700 dark:text-teal-400">{data.topic || "Summary Topic"}</h2>
        <Button onClick={() => setChatOpen(true)} variant="secondary" className="text-teal-600 dark:text-teal-400 border-teal-200">
          <MessageSquare className="mr-2" size={16} /> Chat with PDF (Full Screen)
        </Button>
      </div>
      
      {/* Full Screen Chat Modal */}
      {chatOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full h-full max-w-7xl max-h-[95vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
            
            {/* Header */}
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  🩺 مناقشة المحاضرة مع الدكتور المصري
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  اسأل في أي Mechanism أو تفاصيل وهيشرحها لك بالمصري والـ Medical English.
                </p>
              </div>
              <Button onClick={() => setChatOpen(false)} variant="danger" className="bg-red-500 hover:bg-red-600 text-white font-semibold px-4 py-2 rounded-xl">
                ✕ إغلاق وخروج
              </Button>
            </div>

            {/* Messages Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50 dark:bg-slate-900/50 custom-scrollbar">
              {messages.length === 0 && (
                <div className="text-center text-slate-400 my-auto py-20">
                  <p className="text-lg font-medium">ازيك يا دكتور؟ معاك المحاضرة، اسألني في أي حاجة واقفة معاك وهبسطها لك فوراً.</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-4 text-base leading-relaxed rounded-2xl shadow-sm ${msg.role === 'user' ? 'bg-teal-600 text-white rounded-br-none' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-none whitespace-pre-wrap'}`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-5 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 animate-pulse">
                    جاري تحضير الشرح يا دكتور... ⏳
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
                placeholder="اكتب سؤالك هنا للتناقش مع المحاضرة..." 
                className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 border border-slate-200 dark:border-slate-700" 
              />
              <Button className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl" disabled={isTyping} onClick={handleSendMessage} variant="primary">
                إرسال 🚀
              </Button>
            </div>

          </div>
        </div>
      )}

      <div className="space-y-4">
        {data.what_it_means && <Accordion title={<span><BookOpen className="inline mr-2 text-teal-600" size={16} /> 1. What does it mean?</span>} defaultOpen={true}><p className="text-sm leading-relaxed" dir="auto">{data.what_it_means}</p></Accordion>}
        {data.why_it_happens && <Accordion title={<span><Info className="inline mr-2 text-blue-600" size={16} /> 2. Why does it happen?</span>}><p className="text-sm leading-relaxed" dir="auto">{data.why_it_happens}</p></Accordion>}
        {data.presentation && <Accordion title="3. Presentation"><p className="text-sm" dir="auto">{data.presentation}</p></Accordion>}
        {data.diagnosis && <Accordion title="4. Diagnosis"><p className="text-sm" dir="auto">{data.diagnosis}</p></Accordion>}
        {data.management && <Accordion title="5. Management"><p className="text-sm text-emerald-700 dark:text-emerald-300 leading-relaxed" dir="auto">{data.management}</p></Accordion>}
        {data.exam_traps && <Accordion title={<span><AlertTriangle className="inline mr-2 text-rose-600" size={16} /> 6. Exam Traps</span>}><p className="text-sm text-rose-700 dark:text-rose-300 leading-relaxed" dir="auto">{data.exam_traps}</p></Accordion>}
      </div>
    </Card>
  );
};

export const MindMapRenderer = ({ data }) => {
  if (!data || !data.nodes) return null;
  
  const initialNodes = data.nodes.map((node) => ({
    id: node.id,
    data: { label: node.label },
    position: { x: 0, y: 0 },
    style: { 
      background: node.type === 'main' ? '#0f766e' : (node.type === 'symptom' ? '#be123c' : '#1d4ed8'),
      color: 'white',
      fontWeight: 'bold',
      borderRadius: '8px',
      border: 'none',
      padding: '10px'
    }
  }));

  const initialEdges = data.edges.map((edge, i) => ({
    id: `e${i}`,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    animated: true,
    style: { stroke: '#94a3b8' }
  }));

  const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(initialNodes, initialEdges);

  return (
    <Card className="p-4 mb-6 border border-slate-200 dark:border-slate-800" style={{ height: '400px' }}>
      <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-2 px-2">🗺️ AI Mind Map</h3>
      <ReactFlow attributionPosition="bottom-right" edges={layoutedEdges} fitView nodes={layoutedNodes}>
        <Background color="#ccc" gap={16} />
        <Controls />
      </ReactFlow>
    </Card>
  );
};

const getLayoutedElements = (nodes, edges, direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  const nodeWidth = 172; const nodeHeight = 50;
  
  dagreGraph.setGraph({ rankdir: direction });
  nodes.forEach((node) => { dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight }); });
  edges.forEach((edge) => { dagreGraph.setEdge(edge.source, edge.target); });
  
  dagre.layout(dagreGraph);
  
  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };
  });
  return { nodes, edges };
};

export const AnkiWorkspace = ({ initialCards, fileName }) => {
  if (!Array.isArray(initialCards)) return null;

  const exportToCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    initialCards.forEach(card => {
       let front = card.front.replace(/"/g, '""');
       let back = card.back.replace(/"/g, '""');
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
    <div className="space-y-4">
      <div className="flex justify-end mb-4">
         <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={exportToCSV}>
           <Download className="mr-2" size={16} /> Export to Anki (CSV)
         </Button>
      </div>
      {initialCards.map((card, idx) => (
        <Card className="p-4 flex flex-col gap-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" key={idx}>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Q: {card.front || "No front text"}اعات</div>
          <div className="text-sm text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2 mt-2">A: {card.back || "No back text"}</div>
        </Card>
      ))}
    </div>
  );
};