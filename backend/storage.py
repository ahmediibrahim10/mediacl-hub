import os
import json

DB_DIR = "local_db/exams"
os.makedirs(DB_DIR, exist_ok=True)

def save_exam_report(exam_name: str, report_data: dict) -> str:
    safe_name = "".join(c for c in exam_name if c.isalnum() or c in (' ', '_', '-')).strip()
    file_path = os.path.join(DB_DIR, f"{safe_name.replace(' ', '_')}.json")
    
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(report_data, f, ensure_ascii=False, indent=4)
    return file_path

def load_exam_report(exam_name: str) -> dict:
    safe_name = "".join(c for c in exam_name if c.isalnum() or c in (' ', '_', '-')).strip()
    file_path = os.path.join(DB_DIR, f"{safe_name.replace(' ', '_')}.json")
    
    if os.path.exists(file_path):
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return None