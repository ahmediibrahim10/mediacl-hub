/**
 * Normalization Engine to sanitize and standardize AI generation payloads.
 */
export const NormalizationEngine = {
  mcqs: (data) => {
    if (!Array.isArray(data)) data = [data];
    return data.filter(Boolean).map((item, idx) => {
      // Normalize options/choices
      let options = [];
      if (Array.isArray(item.options)) {
        options = item.options;
      } else if (Array.isArray(item.choices)) {
        options = item.choices;
      }

      // If options are ["Option A", "Option B"...], ensure they exist
      let correctAnswer = item.correctAnswer || item.correct || "";
      
      // Normalize explanation
      let explanation = item.explanation;
      if (typeof explanation === 'string') {
        explanation = { correct: explanation, distractors: {} };
      } else if (!explanation || typeof explanation !== 'object') {
        explanation = { correct: "Refer to clinical reference.", distractors: {} };
      }

      return {
        id: item.id || `mcq-${Date.now()}-${idx}`,
        question: item.question || "Medical Question",
        options: options.length > 0 ? options : ["Option A", "Option B", "Option C", "Option D"],
        correctAnswer: correctAnswer,
        explanation: explanation,
        topic: item.topic || item.concept || "General Medicine",
        concept: item.concept || item.topic || "Core Concept",
        difficulty: item.difficulty || "USMLE Step 1",
        keywords: Array.isArray(item.keywords) ? item.keywords : [item.concept || "Medicine"]
      };
    });
  },
  
  cases: (data) => {
    if (!Array.isArray(data)) data = [data];
    return data.filter(Boolean).map((item, idx) => {
      let options = Array.isArray(item.options) ? item.options : (Array.isArray(item.choices) ? item.choices : []);
      let reasoning = item.clinical_reasoning || item.explanation;
      if (typeof reasoning === 'object' && reasoning !== null) {
        reasoning = reasoning.clinical_reasoning || reasoning.correct || JSON.stringify(reasoning);
      }

      return {
        id: item.id || `case-${Date.now()}-${idx}`,
        vignette: item.vignette || item.case_summary || "A patient presents for clinical evaluation...",
        question: item.question || "What is the most appropriate next step in management or most likely diagnosis?",
        options: options.length > 0 ? options : ["Option A", "Option B", "Option C", "Option D"],
        correctAnswer: item.correctAnswer || item.correct || (options[0] || ""),
        explanation: {
          clinical_reasoning: reasoning || "Evaluation based on pathophysiology.",
          distractors: (typeof item.explanation === 'object' && item.explanation?.distractors) ? item.explanation.distractors : {}
        },
        key_takeaway: item.key_takeaway || item.high_yield_pearl || "",
        topic: item.topic || "Clinical Vignette",
        difficulty: item.difficulty || "USMLE Step 2 CK",
        keywords: Array.isArray(item.keywords) ? item.keywords : []
      };
    });
  },

  summary: (data) => {
    if (Array.isArray(data)) data = data[0] || {};
    if (!data || typeof data !== 'object') data = {};

    return [{
      topic: data.topic || "High-Yield Lecture Summary",
      what_it_means: data.what_it_means || data.definition || data.overview || "Explanation of the core disease/mechanism.",
      why_it_happens: data.why_it_happens || data.pathophysiology || data.etiology || "",
      presentation: data.presentation || data.clinical_features || data.symptoms || "",
      diagnosis: data.diagnosis || data.investigations || "",
      management: data.management || data.treatment || "",
      exam_traps: data.exam_traps || data.high_yield_pitfalls || ""
    }];
  },

  anki: (data) => {
    if (!Array.isArray(data)) data = [data];
    return data.filter(Boolean).map((item, idx) => ({
      id: item.id || `anki-${Date.now()}-${idx}`,
      front: item.front || item.question || item.concept || "Prompt",
      back: item.back || item.answer || item.explanation || "Answer",
      topic: item.topic || "High-Yield"
    }));
  }
};

/**
 * Robust helper to extract and parse JSON from LLM responses.
 */
export function safeParseJson(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;

  // 1. Strip markdown code fence markers
  let cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

  // 2. Try direct JSON parse
  try {
    return JSON.parse(cleaned);
  } catch {
    // 3. Try to find the outermost array [ ... ] or object { ... }
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      try {
        return JSON.parse(cleaned.substring(firstBracket, lastBracket + 1));
      } catch {}
    }

    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
      } catch {}
    }

    throw new Error(`Failed to parse AI output into valid JSON. Received:\n${rawText.substring(0, 150)}...`);
  }
}