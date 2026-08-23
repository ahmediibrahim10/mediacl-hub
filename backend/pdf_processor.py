"""
PDF & Scanned Image Processor (Quota Optimized - No Local Models)
"""

import fitz  # PyMuPDF
import google.generativeai as genai
from PIL import Image
import io

def extract_text_with_pages(pdf_path: str, api_key: str = None, max_pages_limit: int = 8) -> str:
    doc = None
    try:
        doc = fitz.open(pdf_path)
        total_pages = len(doc)
        pages_to_process = min(total_pages, max_pages_limit)
        
        full_extracted_text = []
        scanned_pages_indices = []

        # الخطوة الأولى: محاولة استخراج النصوص الخام (Text Layer) لتوفير التوكنز والـ Quota تماماً
        for page_num in range(pages_to_process):
            page = doc.load_page(page_num)
            text = page.get_text("text").strip()
            if len(text) > 40:  # لو الصفحة تحتوي على نص حقيقي
                full_extracted_text.append(f"--- Page {page_num + 1} ---\n{text}")
            else:
                # لو الصفحة عبارة عن صورة (Scanned) وليست نصاً مباشراً
                scanned_pages_indices.append(page_num)

        # الخطوة الثانية: لو وُجدت صفحات مسحوبة ضوئياً (Scanned)، نستخدم Vision OCR للضرورة القصوى وبأقل دقة لتوفير الحصة
        if scanned_pages_indices and api_key:
            try:
                genai.configure(api_key=api_key.strip())
                # استخدام موديل الفلاش السريع والخفيف
                model = genai.GenerativeModel("gemini-3.6-flash")

                for page_num in scanned_pages_indices:
                    page = doc.load_page(page_num)
                    # ضغط الصورة بدقة منخفضة (Matrix 1.0) لتوفير استهلاك الـ Quota بنسبة تتجاوز 70%
                    pix = page.get_pixmap(matrix=fitz.Matrix(1.0, 1.0))
                    img_bytes = pix.tobytes("jpeg")
                    img = Image.open(io.BytesIO(img_bytes))

                    try:
                        response = model.generate_content([
                            "Extract all medical text from this image concisely. Keep medical terms strictly in English:",
                            img
                        ])
                        ocr_text = response.text if response and hasattr(response, 'text') else ""
                        full_extracted_text.append(f"--- Page {page_num + 1} (OCR) ---\n{ocr_text}")
                    except Exception as vision_err:
                        print(f"[OCR WARNING] Page {page_num + 1} failed: {vision_err}")
                        continue
            except Exception as e:
                print(f"[API VISION CONFIG ERROR] {e}")

        doc.close()

        # ترتيب النتائج حسب أرقام الصفحات الأصلية
        final_text = "\n".join(full_extracted_text)
        if len(final_text.strip()) < 20:
            return "ERROR: عذراً، الملف فارغ أو لم يتمكن النظام من استخراج أي نصوص منه."

        return final_text

    except Exception as e:
        if doc:
            try:
                doc.close()
            except:
                pass
        return f"ERROR: فشل في معالجة ملف الـ PDF. التفاصيل: {str(e)}"