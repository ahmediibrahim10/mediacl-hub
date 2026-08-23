export const NormalizationEngine = {
  mcqs: (data) => {
    if (!Array.isArray(data)) return [];
    return data.map(item => ({
      question: item.question || "Unknown Question",
      options: Array.isArray(item.options) ? item.options : [],
      correctAnswer: item.correctAnswer || "",
      explanation: item.explanation || { correct: "", distractors: {} },
      topic: item.topic || "General",
      difficulty: item.difficulty || "Medium",
      concept: item.concept || "General"
    }));
  },
  
  cases: (data) => {
    if (!Array.isArray(data)) return [];
    return data.map(item => ({
      vignette: item.vignette || "Case details missing.",
      question: item.question || "What is the most likely diagnosis?",
      options: Array.isArray(item.options) ? item.options : [],
      correctAnswer: item.correctAnswer || "",
      explanation: item.explanation || { clinical_reasoning: "", distractors: {} },
      key_takeaway: item.key_takeaway || "",
      topic: item.topic || "General",
      difficulty: item.difficulty || "Hard"
    }));
  },

  summary: (data) => {
    if (!Array.isArray(data)) return [];
    return data.map(item => ({
      topic: item.topic || "Concept",
      what_it_means: item.what_it_means || "",
      why_it_happens: item.why_it_happens || "",
      presentation: item.presentation || "",
      diagnosis: item.diagnosis || "",
      management: item.management || "",
      exam_traps: item.exam_traps || ""
    }));
  },

  anki: (data) => {
    if (!Array.isArray(data)) return [];
    return data.map(item => ({
      front: item.front || "",
      back: item.back || ""
    }));
  }
};