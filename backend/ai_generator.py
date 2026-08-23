import json
import google.generativeai as genai
from PIL import Image
import io

REQUEST_TIMEOUT = 120.0

def extract_json_array(raw_text: str) -> list:
    if not raw_text: return []
    try:
        data = json.loads(raw_text)
        if isinstance(data, list): return data
        if isinstance(data, dict):
            for val in data.values():
                if isinstance(val, list): return val
            return data.get('items', data.get('data', []))
    except json.JSONDecodeError: pass

    try:
        cleaned = raw_text.replace('```json', '').replace('```', '').strip()
        first, last = cleaned.find('['), cleaned.rfind(']')
        if first != -1 and last != -1:
            return json.loads(cleaned[first:last+1])
    except Exception: pass
    return []

def is_duplicate(new_item: dict, existing_items: list, item_type: str) -> bool:
    if item_type in ("mcqs", "cases"):
        q_field = "question" if item_type == "mcqs" else "vignette"
        return any(new_item.get(q_field) == item.get(q_field) for item in existing_items)
    elif item_type == "anki":
        return any(new_item.get("front") == item.get("front") for item in existing_items)
    return False

def validate_item(item: dict, item_type: str) -> bool:
    if not isinstance(item, dict): return False
    if item_type in ("mcqs", "cases", "mistake_mcqs"):
        q_field = "question" if item_type != "cases" else "vignette"
        opts = item.get("options", [])
        return bool(item.get(q_field) and isinstance(opts, list) and len(opts) == 4 and item.get("correctAnswer") and item.get("explanation"))
    elif item_type == "anki":
        return bool(item.get("front") and item.get("back"))
    elif item_type == "summary":
        return bool(item.get("topic") and item.get("what_it_means"))
    elif item_type == "highyield":
        return bool(item.get("concept") and item.get("priority"))
    elif item_type == "mindmap":
        return bool(item.get("nodes") and item.get("edges"))
    return True

def call_gemini_model(prompt: str, api_key: str, system_prompt: str = None) -> str:
    try:
        genai.configure(api_key=api_key.strip())
        if not system_prompt:
            system_prompt = "You are an expert medical professor. Output strictly valid JSON."
        
        model = genai.GenerativeModel(
            model_name="gemini-3.6-flash",
            system_instruction=system_prompt
        )
        
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                response_mime_type="application/json",
                temperature=0.7,
                max_output_tokens=8192
            )
        )
        return response.text
    except Exception as e:
        print(f"[API ERROR] Gemini request failed: {e}")
        return "[]"

def chat_with_patient(messages: list, patient_context: dict, api_key: str) -> str:
    try:
        genai.configure(api_key=api_key.strip())
        
        # برومبت مصري شعبي نبطشية واستقبال حقيقي 100% مع حرية كاملة في الكلام
        system_prompt = f"""أنت مريض مصري قاعد في الاستقبال أو العيادة في مستشفى حكومي في نبطشية بالليل، وطريق كلامك شعبية، عفوية، وبتتكلم ببلدي خالص وبإفيهات أو شكاوي بوجع حقيقي (مثلاً: "يا دكتور الحقني هموت"، "آه يا ضهري"، "صدري واجعني ومش قادر").
ممنوع تماماً تبان روبوت أو ذكاء اصطناعي. عيش الدور كأنك شخص حقيقي تعبان وجاي يشتكي وعندك حرية كاملة في وصف تعبك.
بيانات حالتك:
- السن: {patient_context.get('age')} سنة، الجنس: {patient_context.get('gender')}
- الشكوى: {patient_context.get('chief_complaint')}
- تفاصيل تعبك (HPI): {patient_context.get('hpi')}
- تاريخك المرضي (PMH): {patient_context.get('pmh')}

خلي ردودك عفوية، شعبية، وبطريقة مصرية خالصة."""
        
        model = genai.GenerativeModel(
            model_name="gemini-3.6-flash",
            system_instruction=system_prompt
        )
        chat = model.start_chat()
        
        for msg in messages:
            role = "user" if msg.get("role") == "user" else "model"
            chat.history.append({"role": role, "parts": [msg.get("content", "")]})
        
        last_user_msg = next((msg.get("content") for msg in reversed(messages) if msg.get("role") == "user"), None)
        if last_user_msg:
            return chat.send_message(last_user_msg).text
        return "يا دكتور الحقني، هموت من التعب وواقف بقالي ساعة في الطابور!"
    except Exception as e:
        print(f"[API ERROR] Patient chat failed: {e}")
        return "يا دكتور الشبكة قطعت ولا إيه، مش سامعك كويس!"

def chat_with_pdf(document_context: str, messages: list, api_key: str) -> str:
    try:
        genai.configure(api_key=api_key.strip())
        
        system_prompt = """أنت دكتور مصري شاطر بيشرح Medical Content لطالب طب مصري.
مهمتك تفهم المحتوى وتشرحه بطريقة سهلة وواضحة بالمصري، مع الاحتفاظ بجميع الـ Medical Terms الأساسية باللغة الإنجليزية (زي الأديان، الأمراض، الـ Mechanisms، والـ Drugs).
اشرح كأنك قاعد مع طالب في سكشن أو توريال، اربط الأسباب بالنتائج، ووضح الـ High-Yield Points والـ Exam Traps."""
        
        model = genai.GenerativeModel(
            model_name="gemini-3.6-flash",
            system_instruction=system_prompt
        )
        chat = model.start_chat()
        chat.send_message(f"Context Document:\n{document_context[:15000]}")
        
        last_user_msg = next((msg.get("content") for msg in reversed(messages) if msg.get("role") == "user"), None)
        if last_user_msg:
            return chat.send_message(last_user_msg).text
        return "ازيك يا دكتور؟ معاك المحاضرة، اسألني في أي حاجة واقفة معاك وهبسطها لك فوراً."
    except Exception as e:
        print(f"[API ERROR] PDF chat failed: {e}")
        return "عذراً يا دكتور، حصلت مشكلة أثناء استجابة المساعد الطبي."

def generate_items_pipeline(document_context: str, item_type: str, requested_count: int, config_settings: dict, api_key: str) -> dict:
    valid_items = []
    attempts = 0
    max_attempts = 2

    difficulty = config_settings.get("mcqDiff", config_settings.get("caseDiff", "USMLE Step 1"))
    system_instruction = "You are an expert medical professor and USMLE examiner. Output strictly valid JSON without introductory text."
    
    if item_type == "mcqs":
        rules = "Focus strictly on clinical reasoning. Create EXACTLY 4 options. Explain WHY the correct answer is right, and explicitly state WHY each distractor is wrong."
        format_guide = '{"items": [{"topic": "...", "concept": "...", "difficulty": "' + difficulty + '", "question": "Clear question stem...", "options": ["A. [Text]", "B. [Text]", "C. [Text]", "D. [Text]"], "correctAnswer": "B. [Text]", "explanation": {"correct": "Why correct...", "distractors": {"A. [Text]": "Why wrong..."}}, "keywords": ["Keyword1", "Keyword2"]}]}'
    elif item_type == "mistake_mcqs":
        rules = "Generate USMLE-style MCQs specifically testing weak medical concepts. Create EXACTLY 4 options with detailed explanations."
        format_guide = '{"items": [{"topic": "...", "concept": "...", "difficulty": "Hard", "question": "...", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "correctAnswer": "B. ...", "explanation": {"correct": "...", "distractors": {"A. ...": "..."}}, "keywords": ["..."]}]}'
    elif item_type == "cases":
        rules = "Create USMLE-style clinical vignettes with plausible distractors and detailed clinical reasoning."
        format_guide = '{"items": [{"topic": "...", "difficulty": "' + difficulty + '", "vignette": "...", "question": "...", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "correctAnswer": "C. ...", "explanation": {"clinical_reasoning": "...", "distractors": {"A. ...": "..."}}, "key_takeaway": "...", "keywords": ["..."]}]}'
    elif item_type == "summary":
        rules = "Explain the content like a friendly Egyptian university professor teaching medical students. Use simplified Egyptian Arabic for explanations, keeping ALL medical terms strictly in English."
        format_guide = '{"items": [{"topic": "Topic", "what_it_means": "ببساطة كدة...", "why_it_happens": "السبب...", "presentation": "الأعراض...", "diagnosis": "الفحوصات...", "management": "العلاج...", "exam_traps": "خلي بالك في الامتحان..."}]}'
    elif item_type == "anki":
        rules = "Apply Minimum Information Principle for Active Recall. Back must be concise (1 to 15 words max)."
        format_guide = '{"items": [{"front": "...", "back": "..."}]}'
    elif item_type == "highyield":
        rules = "Identify critical high-yield exam points, medical exceptions, and gold standards."
        format_guide = '{"items": [{"priority": "🔥 Highest Priority", "concept": "...", "explanation": "..."}]}'
    elif item_type == "mindmap":
        rules = "Create hierarchical node structure representing disease pathways."
        format_guide = '{"items": [{"nodes": [{"id": "1", "label": "...", "type": "main"}], "edges": [{"source": "1", "target": "2", "label": "..."}]}]}'

    optimized_context = document_context[:12000]

    while len(valid_items) < requested_count and attempts < max_attempts:
        needed = requested_count - len(valid_items)
        prompt = f"TASK: Extract {needed} {item_type} from the provided text.\nRULES: {rules}\nDIFFICULTY: {difficulty}\nOUTPUT FORMAT: MUST strictly follow this JSON structure:\n{format_guide}\n\nTEXT:\n{optimized_context}"
        
        raw_response = call_gemini_model(prompt, api_key, system_prompt=system_instruction) 
        parsed = extract_json_array(raw_response)
        
        for candidate in parsed:
            if validate_item(candidate, item_type) and not is_duplicate(candidate, valid_items, item_type):
                valid_items.append(candidate)
                if len(valid_items) == requested_count:
                    break
        attempts += 1

    return {
        "success": True,
        "requested": requested_count,
        "valid_generated": len(valid_items),
        "data": valid_items,
        "warnings": ["Could not generate the exact requested amount."] if len(valid_items) < requested_count else []
    }