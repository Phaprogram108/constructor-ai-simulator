import pdf from 'pdf-parse';

const MAX_PDF_TEXT_LENGTH = 5000;

export async function extractPdfFromUrl(pdfUrl: string): Promise<string> {
  try {
    const response = await fetch(pdfUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return await extractTextFromBuffer(buffer);
  } catch (error) {
    console.error('PDF URL extraction error:', error);
    return '';
  }
}

export async function extractPdfFromBase64(base64Data: string): Promise<string> {
  try {
    // Remove data URL prefix if present
    const base64Clean = base64Data.replace(/^data:application\/pdf;base64,/, '');
    const buffer = Buffer.from(base64Clean, 'base64');

    return await extractTextFromBuffer(buffer);
  } catch (error) {
    console.error('PDF base64 extraction error:', error);
    return '';
  }
}

async function extractTextFromBuffer(buffer: Buffer): Promise<string> {
  try {
    const data = await pdf(buffer);

    // Clean and truncate text
    const cleanText = data.text
      .replace(/\s+/g, ' ')
      .replace(/[^\w\sáéíóúüñÁÉÍÓÚÜÑ.,;:$%°²³\-\/()]/g, ' ')
      .trim();

    return cleanText.slice(0, MAX_PDF_TEXT_LENGTH);
  } catch (error) {
    console.error('PDF parsing error:', error);
    return '';
  }
}

export function formatPdfContent(text: string): string {
  if (!text) return 'No se proporcionó catálogo de productos.';

  return `
Contenido del catálogo/brochure:
${text}
`.trim();
}
