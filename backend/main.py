"""
Medical Study AI - Backend Full (Unified FastAPI Server serving both API & React Frontend)
"""

import json
import logging
import os
import uuid
from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional

from pdf_processor import extract_text_with_pages
from ai_generator import generate_items_pipeline, call_gemini_model, chat_with_patient, chat_with_pdf, extract_json_array
from database import SessionLocal, MCQAttempt, TaskItem, StudyPlan, StudyReview, MedPatientSession

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("medical-study-ai")

app = FastAPI(title="Medical Study AI & Unified MedOS")

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
VALID_TASKS = {"anki", "mcqs", "cases", "summary", "highyield", "mindmap", "mistake_mcqs"}

async def verify_api_key(x_api_key: Optional[str] = Header(None)):
    if not x_api_key:
        raise HTTPException(status_code=401, detail="API Key is missing. Please add it in settings.")
    if not (x_api_key.startswith("AIzaSy") or x_api_key.startswith("AQ.")):
        raise HTTPException(status_code=401, detail="Invalid API Key format. Must start with 'AIzaSy' or 'AQ.'")
    return x_api_key

@app.get("/api/health")
def read_root():
    return {"status": "Backend Unified V3.6 is running successfully."}

@app.post("/generate/")
async def generate_content(
    file: UploadFile = File(None),
    task: str = Form(...),
    count: int = Form(5),
    settings: str = Form("{}"),
    mistake_context: str = Form(""),
    api_key: str = Depends(verify_api_key)
):
    if task not in VALID_TASKS:
        raise HTTPException(status_code=400, detail=f"Unknown task '{task}'.")

    try:
        parsed_settings = json.loads(settings)
    except ValueError:
        parsed_settings = {}

    document_text = ""
    original_filename = "Custom Generation"

    if task == "mistake_mcqs":
        if not mistake_context:
            raise HTTPException(status_code=400, detail="No mistakes provided.")
        document_text = f"Student frequently struggles with these medical concepts:\n{mistake_context}"
    else:
        if not file:
            raise HTTPException(status_code=400, detail="PDF file is required for this task.")
        safe_name = f"{uuid.uuid4().hex}.pdf"
        file_path = os.path.join(UPLOAD_DIR, safe_name)
        original_filename = file.filename or "document.pdf"
        try:
            with open(file_path, "wb") as buffer:
                while chunk := await file.read(1024 * 1024):
                    buffer.write(chunk)
            
            max_p = int(parsed_settings.get("maxPages", 8))
            document_text = await run_in_threadpool(extract_text_with_pages, file_path, api_key, max_p)
            if not document_text or len(document_text.strip()) < 50:
                return {"success": False, "error": "الملف ده عبارة عن صور أو نصوصه غير مقروءة."}
            if document_text.startswith("ERROR"):
                return {"success": False, "error": document_text}
        finally:
            if os.path.exists(file_path):
                os.remove(file_path)

    try:
        ai_result = await run_in_threadpool(
            generate_items_pipeline,
            document_text,
            task,
            count,
            parsed_settings,
            api_key
        )
        extracted_data = ai_result.get("data", [])
        return {
            "success": True,
            "result": {
                "data": extracted_data,
                "metadata": {"file_name": original_filename},
                "requested": ai_result.get("requested", count),
                "valid_generated": len(extracted_data)
            }
        }
    except Exception as e:
        logger.error(f"Error during generation: {e}")
        return {"success": False, "error": str(e)}

class PDFChatRequest(BaseModel):
    document_text: str
    messages: List[dict]

@app.post("/api/pdfchat")
async def process_pdf_chat(payload: PDFChatRequest, api_key: str = Depends(verify_api_key)):
    try:
        reply = await run_in_threadpool(chat_with_pdf, payload.document_text, payload.messages, api_key)
        return {"success": True, "reply": reply}
    except Exception as e:
        return {"success": False, "error": str(e)}

class MCQResultPayload(BaseModel):
    question_text: str
    topic: str
    concept: str = "General"
    source_file: str
    difficulty: str
    user_answer: str
    correct_answer: str
    is_correct: bool

@app.post("/api/history/mcq")
def save_mcq_attempt(payload: MCQResultPayload):
    db = SessionLocal()
    try:
        attempt = MCQAttempt(**payload.dict())
        db.add(attempt)
        db.commit()
        return {"success": True}
    finally:
        db.close()

@app.get("/api/high-yield/mistakes")
def get_high_yield_priorities():
    db = SessionLocal()
    try:
        mistakes = db.query(MCQAttempt).filter(MCQAttempt.is_correct == False).all()
        concept_stats = defaultdict(lambda: {"count": 0, "topic": ""})
        for m in mistakes:
            concept_stats[m.concept]["count"] += 1
            concept_stats[m.concept]["topic"] = m.topic
            
        ranked = []
        for concept, data in concept_stats.items():
            ranked.append({
                "concept": concept,
                "topic": data["topic"],
                "mistakeCount": data["count"],
                "priority_label": "🔴 Priority 1 — Must Review" if data["count"] >= 3 else ("🟠 Priority 2 — Very Important" if data["count"] == 2 else "🟡 Priority 3 — Important")
            })
        ranked.sort(key=lambda x: x["mistakeCount"], reverse=True)
        return {"success": True, "data": ranked}
    finally:
        db.close()

# --- MedPatient Advanced Endpoints ---

class CreatePatientSessionRequest(BaseModel):
    mode: str  # 'random' or 'pdf'
    pdf_text: Optional[str] = None
    difficulty: Optional[str] = "USMLE Step 1"

@app.post("/api/medpatient/create")
async def create_patient_session(payload: CreatePatientSessionRequest, api_key: str = Depends(verify_api_key)):
    try:
        prompt = ""
        if payload.mode == 'pdf' and payload.pdf_text:
            prompt = f"""Based on the following medical text/lecture, generate a realistic Egyptian clinical case profile for a virtual patient in JSON format.
            Text Context: {payload.pdf_text[:8000]}
            Return strictly JSON:
            {{
              "age": 45,
              "gender": "ذكر",
              "chief_complaint": "...",
              "hpi": "...",
              "pmh": "...",
              "correct_diagnosis": "...",
              "correct_treatment": "..."
            }}"""
        else:
            prompt = f"""Generate a realistic Egyptian clinical case profile for a virtual patient with difficulty '{payload.difficulty}' in JSON format. The patient should have a typical Egyptian background (e.g., taxi driver, housewife, worker) and Egyptian vernacular context.
            Return strictly JSON:
            {{
              "age": 52,
              "gender": "ذكر",
              "chief_complaint": "وجع جامد في صدري ونازل على دراعي الأيسر",
              "hpi": "كنت شغال وشيلت كرتونة ثقيلة وفجأة حسيت بحرقة ووجع كأني طوبة على صدري",
              "pmh": "بيجيله ضغط ومدخن شره",
              "correct_diagnosis": "Myocardial Infarction (STEMI)",
              "correct_treatment": "Dual Antiplatelet therapy, Oxygen, ECG, and Urgent PCI consultation"
            }}"""

        raw_res = await run_in_threadpool(call_gemini_model, prompt, api_key, system_prompt="You are a medical professor generating Egyptian clinical simulation cases. Output strictly valid JSON.")
        try:
            profile = json.loads(raw_res)
        except:
            parsed = extract_json_array(raw_res)
            profile = parsed[0] if parsed else {
                "age": 50, "gender": "ذكر", "chief_complaint": "ألم في الصدر", 
                "hpi": "يبدأ مع المجهود", "pmh": "ضغط", "correct_diagnosis": "Angina", "correct_treatment": "Aspirin & Statins"
            }
        
        return {"success": True, "profile": profile}
    except Exception as e:
        return {"success": False, "error": str(e)}

class PatientChatRequest(BaseModel):
    messages: List[dict]
    patient_context: dict

@app.post("/api/medpatient/chat")
async def process_patient_chat(payload: PatientChatRequest, api_key: str = Depends(verify_api_key)):
    try:
        reply = await run_in_threadpool(chat_with_patient, payload.messages, payload.patient_context, api_key)
        return {"success": True, "reply": reply}
    except Exception as e:
        return {"success": False, "error": str(e)}

class PatientEvaluateRequest(BaseModel):
    diagnosis: str
    treatment: str
    patient_context: dict
    chat_history: List[dict]

@app.post("/api/medpatient/evaluate")
async def evaluate_consultation(payload: PatientEvaluateRequest, api_key: str = Depends(verify_api_key)):
    try:
        evaluation_prompt = f"""Evaluate the medical student's diagnosis and treatment plan compared to the correct case data.
        Patient Profile & Correct Data: {json.dumps(payload.patient_context)}
        Student's Diagnosis: {payload.diagnosis}
        Student's Treatment: {payload.treatment}
        Provide a JSON response: {{"score": 85, "feedback": "Detailed Egyptian Arabic feedback...", "missed_points": ["..."]}}"""
        
        raw_eval = await run_in_threadpool(call_gemini_model, evaluation_prompt, api_key)
        try:
             eval_data = json.loads(raw_eval)
        except:
             parsed = extract_json_array(raw_eval)
             eval_data = parsed[0] if parsed else {"score": 75, "feedback": "تم تقييم الحالة بنجاح.", "missed_points": []}
             
        db = SessionLocal()
        try:
            session = MedPatientSession(
                patient_profile=payload.patient_context, chat_history=payload.chat_history,
                final_diagnosis=payload.diagnosis, final_treatment=payload.treatment,
                evaluation_score=eval_data.get("score", 0), evaluation_feedback=eval_data
            )
            db.add(session)
            db.commit()
        finally:
            db.close()
            
        return {"success": True, "evaluation": eval_data}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/api/medpatient/history")
def get_patient_history():
    db = SessionLocal()
    try:
        sessions = db.query(MedPatientSession).order_by(MedPatientSession.created_at.desc()).all()
        return {"success": True, "data": [{"id": s.id, "diagnosis": s.final_diagnosis, "score": s.evaluation_score, "date": s.created_at.isoformat()} for s in sessions]}
    finally:
        db.close()

class PlanPayload(BaseModel):
    name: str
    module: str = "عام"
    subject: str = "عام"

@app.post("/api/planner/add")
def add_study_plan(payload: PlanPayload):
    db = SessionLocal()
    try:
        base_date = datetime.utcnow()
        new_plan = StudyPlan(name=payload.name, module_name=payload.module, subject_name=payload.subject, study_date=base_date)
        db.add(new_plan)
        db.flush()

        for i, days in enumerate([0, 1, 3, 7, 14, 30, 60]):
            db.add(StudyReview(plan_id=new_plan.id, review_number=i, scheduled_date=base_date + timedelta(days=days)))
        db.commit()
        return {"success": True, "data": new_plan.to_dict()}
    finally:
        db.close()

@app.get("/api/planner/plans")
def get_study_plans():
    db = SessionLocal()
    try:
        return {"success": True, "data": [p.to_dict() for p in db.query(StudyPlan).all()]}
    finally:
        db.close()

class TaskPayload(BaseModel):
    title: str
    due_date: str = None

@app.post("/api/tasks/add")
def add_task(payload: TaskPayload):
    db = SessionLocal()
    try:
        task = TaskItem(**payload.dict())
        db.add(task)
        db.commit()
        return {"success": True, "data": task.to_dict()}
    finally:
        db.close()

@app.get("/api/tasks")
def get_tasks():
    db = SessionLocal()
    try:
        return {"success": True, "data": [t.to_dict() for t in db.query(TaskItem).all()]}
    finally:
        db.close()

class TaskUpdatePayload(BaseModel):
    task_id: int
    is_completed: bool

@app.post("/api/tasks/update")
def update_task(payload: TaskUpdatePayload):
    db = SessionLocal()
    try:
        task = db.query(TaskItem).filter(TaskItem.id == payload.task_id).first()
        if task:
            task.is_completed = payload.is_completed
            db.commit()
            return {"success": True}
        return {"success": False}
    finally:
        db.close()

@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: int):
    db = SessionLocal()
    try:
        task = db.query(TaskItem).filter(TaskItem.id == task_id).first()
        if task:
            db.delete(task)
            db.commit()
        return {"success": True}
    finally:
        db.close()


# --- دمج واجهة الـ Frontend (React / Vite) لتعمل على نفس السيرفر ورابط واحد ---
frontend_dist_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../frontend/dist"))

if os.path.exists(frontend_dist_path):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist_path, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        if full_path.startswith("api/") or full_path.startswith("generate/"):
            raise HTTPException(status_code=404)
        
        file_path = os.path.join(frontend_dist_path, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist_path, "index.html"))