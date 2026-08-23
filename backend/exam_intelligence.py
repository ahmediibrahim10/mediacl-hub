"""
Exam Intelligence Engine - Phase 3
Handles past paper parsing, topic extraction, priority scoring, patterns, and study plan.
"""

import httpx
import json
import re
import os
import time
from collections import defaultdict
from datetime import datetime

OLLAMA_API_URL = os.environ.get("OLLAMA_API_URL", "http://127.0.0.1:11434/api/chat")
MODEL = os.environ.get("OLLAMA_MODEL", "llama3.2")
REQUEST_TIMEOUT = 900.0

SYSTEM_RULES = """You are a highly analytical Medical AI. 
CRITICAL RULES:
1. OUTPUT ONLY VALID JSON. Do not write any text outside the JSON block.
2. Fact vs AI-Generated: Rely ONLY on the provided text for facts. Do not invent questions."""

TOPIC_EXTRACTION_PROMPT = """Extract the main medical topics, diseases, and important concepts from the following lecture text.
Format EXACTLY as a JSON list of strings: ["Topic 1", "Topic 2"]
Text:
{text}"""

PAST_PAPER_PROMPT = """Extract medical questions from the following past paper text.
Map each question to one of these known lecture topics if relevant: {known_topics}. If not, create a short accurate topic name.
Categorize 'question_type' strictly from: [Definition, Recall, Mechanism, Diagnosis, Differential Diagnosis, Investigation, Treatment, Pharmacology, Clinical scenario, Anatomy, Physiology, Pathology, Other].

Format EXACTLY as a JSON array of objects:
[
  {
    "question": "...",
    "options": ["A", "B"], 
    "year": {year},
    "source_page": "...",
    "topic": "...",
    "subtopic": "...",
    "question_type": "Diagnosis"
  }
]
Text:
{text}"""

def _extract_json(raw_text: str) -> str:
    cleaned = raw_text.strip()
    fence_match = re.match(r"^```(?:json)?\s*(.*?)\s*```$", cleaned, re.DOTALL)
    if fence_match:
        cleaned = fence_match.group(1).strip()
    match = re.search(r"\[.*\]|\{.*\}", cleaned, re.DOTALL)
    return match.group(0) if match else cleaned

async def _call_ollama(prompt: str) -> dict:
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_RULES},
            {"role": "user", "content": prompt}
        ],
        "format": "json",
        "stream": False
    }
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        res = await client.post(OLLAMA_API_URL, json=payload)
        res.raise_for_status()
        text = res.json().get("message", {}).get("content", "")
        return json.loads(_extract_json(text))

async def extract_lecture_topics(lecture_text: str) -> list:
    chunks = [lecture_text[i:i+3000] for i in range(0, len(lecture_text), 3000)]
    all_topics = set()
    for chunk in chunks:
        try:
            topics = await _call_ollama(TOPIC_EXTRACTION_PROMPT.replace("{text}", chunk))
            if isinstance(topics, list):
                all_topics.update(topics)
        except:
            pass
    return list(all_topics)

async def parse_past_papers(paper_text: str, year: int, known_topics: list) -> list:
    chunks = [paper_text[i:i+3000] for i in range(0, len(paper_text), 3000)]
    all_questions = []
    known_topics_str = ", ".join(known_topics)
    
    for chunk in chunks:
        try:
            prompt = PAST_PAPER_PROMPT.replace("{text}", chunk).replace("{year}", str(year)).replace("{known_topics}", known_topics_str)
            questions = await _call_ollama(prompt)
            if isinstance(questions, list):
                all_questions.extend(questions)
        except:
            pass
    return all_questions

def calculate_priority_scores(questions: list, current_year: int = 2026) -> dict:
    topic_stats = defaultdict(lambda: {"freq": 0, "years": set(), "types": set(), "questions": []})
    
    for q in questions:
        t = q.get("topic", "Uncategorized").title()
        topic_stats[t]["freq"] += 1
        topic_stats[t]["years"].add(q.get("year", current_year))
        topic_stats[t]["types"].add(q.get("question_type", "Other"))
        topic_stats[t]["questions"].append(q)

    max_freq = max([s["freq"] for s in topic_stats.values()]) if topic_stats else 1
    
    results = []
    for topic, data in topic_stats.items():
        # Score Logic (Explainable)
        freq_score = (data["freq"] / max_freq) * 40
        most_recent_year = max(data["years"]) if data["years"] else current_year
        year_diff = max(0, current_year - most_recent_year)
        recency_score = max(0, 30 - (year_diff * 5)) 
        variety_score = min(len(data["types"]) * 10, 30)
        
        total_score = int(freq_score + recency_score + variety_score)
        
        results.append({
            "topic": topic,
            "priority_score": total_score,
            "exam_priority_label": "🔥 High" if total_score > 75 else ("🟡 Medium" if total_score > 40 else "🟢 Low"),
            "metrics": {
                "frequency": data["freq"],
                "years_appeared": list(data["years"]),
                "question_types": list(data["types"])
            },
            "questions": data["questions"]
        })
        
    return sorted(results, key=lambda x: x["priority_score"], reverse=True)

def extract_exam_patterns(questions: list) -> dict:
    """Analyzes the most frequent question types and topics to find exam patterns."""
    patterns = {
        "question_types": defaultdict(int),
        "topics": defaultdict(int),
    }
    total_q = len(questions)
    if total_q == 0:
        return {"question_types": [], "top_topics": []}

    for q in questions:
        patterns["question_types"][q.get("question_type", "Other")] += 1
        patterns["topics"][q.get("topic", "Uncategorized").title()] += 1

    formatted_patterns = {
        "question_types": [{"type": k, "percentage": round((v/total_q)*100)} for k, v in sorted(patterns["question_types"].items(), key=lambda item: item[1], reverse=True)],
        "top_topics": [{"topic": k, "count": v} for k, v in sorted(patterns["topics"].items(), key=lambda item: item[1], reverse=True)[:5]]
    }
    return formatted_patterns

def generate_study_plan(priority_topics: list, exam_date_str: str) -> list:
    """Generates a day-by-day study plan based on priority and days remaining."""
    if not exam_date_str:
        return []
    
    try:
        exam_date = datetime.strptime(exam_date_str, "%Y-%m-%d")
        days_remaining = (exam_date - datetime.now()).days
        if days_remaining <= 0:
            return []
    except:
        return []

    plan = []
    current_day = 1
    
    # Sort topics by priority
    high = [t for t in priority_topics if "High" in t["exam_priority_label"]]
    medium = [t for t in priority_topics if "Medium" in t["exam_priority_label"]]
    low = [t for t in priority_topics if "Low" in t["exam_priority_label"]]

    all_sorted = high + medium + low
    if not all_sorted:
        return []
    
    topics_per_day = max(1, len(all_sorted) // days_remaining) if days_remaining > 0 else len(all_sorted)
    
    for i in range(0, len(all_sorted), topics_per_day):
        day_topics = all_sorted[i:i+topics_per_day]
        plan.append({
            "day": current_day,
            "topics": [t["topic"] for t in day_topics],
            "focus": "Review & Practice MCQs",
            "priority": day_topics[0]["exam_priority_label"] if day_topics else ""
        })
        current_day += 1
        if current_day > days_remaining:
            break
            
    return plan