import React, { useState } from 'react';
import { Card, Button } from '../ui';
import { CheckCircle, AlertTriangle } from 'lucide-react';

export function MCQRenderer({ data, idx }) {
  const [selectedOption, setSelectedOption] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSelect = (choice) => {
    if (isSubmitted) return;
    setSelectedOption(choice);
  };

  const handleSubmit = () => {
    if (!selectedOption) return;
    setIsSubmitted(true);
    
    // حفظ الخطأ تلقائياً في الـ LocalStorage لو الإجابة خاطئة
    if (selectedOption !== data.correct) {
      const existingMistakes = JSON.parse(localStorage.getItem('medos_mistakes') || '[]');
      const newMistake = {
        topic: data.concept || "General Medical",
        concept: data.question.substring(0, 40) + "...",
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('medos_mistakes', JSON.stringify([...existingMistakes, newMistake]));
    }
  };

  return (
    <Card className="p-6 mb-6 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
      <div className="flex justify-between items-center mb-4">
        <span className="text-xs font-bold text-teal-600 uppercase tracking-wider">Question #{idx}</span>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{data.concept || "High-Yield"}</span>
      </div>
      <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-6">{data.question}</h3>
      <div className="space-y-3 mb-6">
        {data.choices?.map((choice, i) => {
          const optionLetter = String.fromCharCode(65 + i); // A, B, C, D
          let btnStyle = "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200";
          
          if (isSubmitted) {
            if (optionLetter === data.correct) btnStyle = "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-500 text-emerald-900 dark:text-emerald-300 font-bold";
            else if (selectedOption === optionLetter) btnStyle = "bg-rose-100 dark:bg-rose-900/30 border-rose-500 text-rose-900 dark:text-rose-300";
          } else if (selectedOption === optionLetter) {
            btnStyle = "bg-teal-50 dark:bg-teal-900/20 border-teal-500 text-teal-900 dark:text-teal-300 font-bold";
          }

          return (
            <button key={i} onClick={() => handleSelect(optionLetter)} className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${btnStyle}`}>
              <span className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-sm shrink-0">{optionLetter}</span>
              <span className="flex-1 text-sm">{choice}</span>
            </button>
          );
        })}
      </div>
      {!isSubmitted ? (
        <Button variant="primary" onClick={handleSubmit} disabled={!selectedOption} className="bg-teal-600 w-full py-3">Submit Answer</Button>
      ) : (
        <div className={`p-4 rounded-xl border ${selectedOption === data.correct ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 text-emerald-800 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 text-rose-800 dark:text-rose-300'}`}>
          <p className="font-bold mb-1 flex items-center gap-2">{selectedOption === data.correct ? <CheckCircle size={16}/> : <AlertTriangle size={16}/>} {selectedOption === data.correct ? "Correct!" : `Incorrect. The correct answer is ${data.correct}`}</p>
          <p className="text-sm mt-2">{data.explanation}</p>
        </div>
      )}
    </Card>
  );
}