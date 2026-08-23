import * as pdfjsLib from 'pdfjs-dist';

// Set up pdf.js worker
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
} catch (e) {
  console.warn('PDF Worker initialization note:', e);
}

/**
 * Extract plain text from a File object (PDF or Text/Markdown).
 * @param {File} file 
 * @param {number} maxPages 
 * @param {function} onProgress 
 * @returns {Promise<string>}
 */
export async function extractTextFromFile(file, maxPages = 20, onProgress = () => {}) {
  if (!file) return '';

  const fileName = file.name.toLowerCase();
  
  // Plain text / markdown
  if (fileName.endsWith('.txt') || fileName.endsWith('.md') || file.type.startsWith('text/')) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result || '');
      reader.onerror = (err) => reject(err);
      reader.readAsText(file);
    });
  }

  // PDF Extraction
  if (fileName.endsWith('.pdf') || file.type === 'application/pdf') {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdfDoc = await loadingTask.promise;
      
      const numPages = Math.min(pdfDoc.numPages, maxPages);
      let fullText = '';

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        onProgress({ current: pageNum, total: numPages });
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item) => item.str)
          .join(' ');
        fullText += `--- Page ${pageNum} ---\n${pageText}\n\n`;
      }

      if (!fullText.trim()) {
        throw new Error("Could not extract readable text from this PDF (it might be scanned/image-only).");
      }

      return fullText.trim();
    } catch (err) {
      console.error("PDF Extraction error:", err);
      throw new Error(`Failed to parse PDF: ${err.message || 'Unknown error'}`);
    }
  }

  // Generic fallback
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || '');
    reader.onerror = (err) => reject(err);
    reader.readAsText(file);
  });
}
