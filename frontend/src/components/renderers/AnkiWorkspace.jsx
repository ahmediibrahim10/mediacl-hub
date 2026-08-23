import React, { useState } from 'react';
import { Card, Button } from '../ui';
import { RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';

export function AnkiWorkspace({ initialCards }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const card = initialCards[currentIndex];

  const handleNext = () => { setIsFlipped(false); setCurrentIndex((prev) => (prev + 1) % initialCards.length); };
  const handlePrev = () => { setIsFlipped(false); setCurrentIndex((prev) => (prev - 1 + initialCards.length) % initialCards.length); };

  if (!card) return null;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex justify-between items-center text-sm font-bold text-slate-500">
        <span>Card {currentIndex + 1} of {initialCards.length}</span>
        <Button variant="ghost" onClick={() => setIsFlipped(!isFlipped)} icon={<RotateCcw size={16}/>}>Flip Card</Button>
      </div>

      <div onClick={() => setIsFlipped(!isFlipped)} className="min-h-[280px] bg-white dark:bg-slate-900 border-2 dark:border-slate-800 rounded-3xl p-8 flex flex-col items-center justify-center text-center cursor-pointer shadow-xl transition-all">
        {!isFlipped ? (
          <div>
            <span className="text-xs font-bold text-teal-600 uppercase tracking-widest block mb-4">Front (Question / Concept)</span>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{card.front || card.question}</h3>
          </div>
        ) : (
          <div>
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest block mb-4">Back (Answer / Explanation)</span>
            <p className="text-lg text-slate-700 dark:text-slate-300">{card.back || card.explanation || card.answer}</p>
          </div>
        )}
      </div>

      <div className="flex justify-between gap-4">
        <Button variant="secondary" onClick={handlePrev} icon={<ChevronLeft size={18}/>}>Previous</Button>
        <Button variant="primary" onClick={handleNext} className="bg-teal-600" icon={<ChevronRight size={18}/>}>Next Card</Button>
      </div>
    </div>
  );
}