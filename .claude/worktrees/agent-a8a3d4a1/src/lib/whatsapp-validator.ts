/**
 * WhatsApp Validator - Validaciones robustas para numeros de WhatsApp
 * Port de phascraper/buscar_wa_mejorado.py lineas 93-186
 */

// Codigos de pais validos con sus nombres
export const VALID_COUNTRY_CODES: Record<string, string> = {
  '1': 'USA/Canada',
  '54': 'Argentina',
  '56': 'Chile',
  '52': 'Mexico',
  '51': 'Peru',
  '57': 'Colombia',
  '58': 'Venezuela',
  '598': 'Uruguay',
  '595': 'Paraguay',
  '591': 'Bolivia',
  '593': 'Ecuador',
  '55': 'Brasil',
  '34': 'Espana',
  '48': 'Polonia',
  '49': 'Alemania',
  '44': 'UK',
  '33': 'Francia',
  '39': 'Italia',
  '31': 'Holanda',
  '41': 'Suiza',
  '43': 'Austria',
  '32': 'Belgica',
  '61': 'Australia',
  '64': 'Nueva Zelanda',
  '27': 'Sudafrica',
  '971': 'UAE',
  '966': 'Arabia Saudita',
  '972': 'Israel',
  '91': 'India',
  '86': 'China',
  '81': 'Japon',
  '82': 'Corea Sur',
  '65': 'Singapur',
  '60': 'Malasia',
  '62': 'Indonesia',
  '63': 'Filipinas',
  '66': 'Tailandia',
  '84': 'Vietnam',
};

export interface WhatsAppValidation {
  isValid: boolean;
  reason: string;
  country: string;
  cleanNumber: string;
}

/**
 * Detecta numeros sospechosos/falsos
 * Port de buscar_wa_mejorado.py lineas 92-136
 */
export function isSuspiciousNumber(number: string): { suspicious: boolean; reason: string } {
  if (!number) {
    return { suspicious: true, reason: 'Numero vacio' };
  }

  const clean = number.replace(/[^\d]/g, '');

  // Muy corto o muy largo
  if (clean.length < 10) {
    return { suspicious: true, reason: `Muy corto (${clean.length} digitos)` };
  }
  if (clean.length > 15) {
    return { suspicious: true, reason: `Muy largo (${clean.length} digitos)` };
  }

  // Secuencias ascendentes/descendentes - SOLO rechazar si:
  // La secuencia tiene >= 8 digitos consecutivos Y representa mas del 70% del numero total
  // Esto evita falsos positivos como 5491123456789 (numero real argentino de 13 digitos)
  const MIN_SUSPICIOUS_SEQ_LEN = 8;
  const SUSPICIOUS_RATIO = 0.7;

  for (let seqLen = MIN_SUSPICIOUS_SEQ_LEN; seqLen < 10; seqLen++) {
    // Solo rechazar si la secuencia representa mas del 60% del numero
    const ratio = seqLen / clean.length;
    if (ratio <= SUSPICIOUS_RATIO) continue;

    for (let start = 0; start <= clean.length - seqLen; start++) {
      const substr = clean.slice(start, start + seqLen);

      // Verificar secuencia ascendente
      let isAscending = true;
      for (let i = 1; i < substr.length; i++) {
        if (parseInt(substr[i]) !== (parseInt(substr[i - 1]) + 1) % 10) {
          isAscending = false;
          break;
        }
      }
      if (isAscending) {
        return { suspicious: true, reason: `Secuencia ascendente: ${substr}` };
      }

      // Verificar secuencia descendente
      let isDescending = true;
      for (let i = 1; i < substr.length; i++) {
        if (parseInt(substr[i]) !== (parseInt(substr[i - 1]) - 1 + 10) % 10) {
          isDescending = false;
          break;
        }
      }
      if (isDescending) {
        return { suspicious: true, reason: `Secuencia descendente: ${substr}` };
      }
    }
  }

  // Digitos repetidos (11111, 00000, etc.)
  for (const digit of '0123456789') {
    if (clean.includes(digit.repeat(5))) {
      return { suspicious: true, reason: `Digitos repetidos: ${digit.repeat(5)}` };
    }
  }

  // Patrones conocidos de placeholder
  const suspiciousPatterns = [
    '1234567890',
    '0987654321',
    '1111111111',
    '0000000000',
    '9999999999',
    '1122334455',
    '5544332211',
  ];

  for (const pattern of suspiciousPatterns) {
    if (clean.includes(pattern)) {
      return { suspicious: true, reason: `Patron placeholder: ${pattern}` };
    }
  }

  return { suspicious: false, reason: '' };
}

/**
 * Verifica si el numero tiene un codigo de pais valido
 * Port de buscar_wa_mejorado.py lineas 138-158
 */
export function hasValidCountryCode(number: string): { valid: boolean; country: string } {
  const clean = number.replace(/[^\d]/g, '');

  // Verificar codigos de 3 digitos primero (mas especificos)
  const threeDigitCodes = ['598', '595', '591', '593', '971', '966', '972'];
  for (const code of threeDigitCodes) {
    if (clean.startsWith(code)) {
      return { valid: true, country: VALID_COUNTRY_CODES[code] || 'Unknown' };
    }
  }

  // Luego codigos de 2 digitos
  const twoDigitCodes = ['54', '56', '52', '51', '57', '58', '55', '34', '48', '49', '44',
                         '33', '39', '31', '41', '43', '32', '61', '64', '27', '91', '86',
                         '81', '82', '65', '60', '62', '63', '66', '84'];
  for (const code of twoDigitCodes) {
    if (clean.startsWith(code)) {
      return { valid: true, country: VALID_COUNTRY_CODES[code] || 'Unknown' };
    }
  }

  // Codigo de 1 digito (USA/Canada)
  if (clean.startsWith('1') && clean.length === 11) {
    return { valid: true, country: 'USA/Canada' };
  }

  return { valid: false, country: 'Unknown' };
}

/**
 * Valida completamente un numero de WhatsApp
 * Port de buscar_wa_mejorado.py lineas 161-186
 */
export function validateWhatsAppNumber(number: string): WhatsAppValidation {
  if (!number) {
    return { isValid: false, reason: 'Numero vacio', country: '', cleanNumber: '' };
  }

  const clean = number.replace(/[^\d]/g, '');

  // Verificar longitud
  if (clean.length < 10) {
    return { isValid: false, reason: `Muy corto (${clean.length} digitos)`, country: '', cleanNumber: clean };
  }
  if (clean.length > 15) {
    return { isValid: false, reason: `Muy largo (${clean.length} digitos)`, country: '', cleanNumber: clean };
  }

  // Verificar secuencias sospechosas
  const suspiciousCheck = isSuspiciousNumber(clean);
  if (suspiciousCheck.suspicious) {
    return { isValid: false, reason: suspiciousCheck.reason, country: '', cleanNumber: clean };
  }

  // Verificar codigo de pais
  const countryCheck = hasValidCountryCode(clean);
  if (!countryCheck.valid) {
    // Si no tiene codigo de pais conocido, solo aceptar si tiene 10-11 digitos (formato local)
    if (clean.length !== 10 && clean.length !== 11) {
      return {
        isValid: false,
        reason: `Sin codigo de pais valido y longitud inusual (${clean.length})`,
        country: 'Local',
        cleanNumber: clean
      };
    }
    // Aceptar como numero local
    return { isValid: true, reason: 'Numero local valido', country: 'Local', cleanNumber: clean };
  }

  return { isValid: true, reason: 'Numero valido', country: countryCheck.country, cleanNumber: clean };
}

/**
 * Verifica si es un link alfanumerico de WhatsApp (wa.me/message/CODE)
 * Port de buscar_wa_mejorado.py lineas 219-224
 */
export function isAlphanumericWaLink(url: string): boolean {
  if (!url) return false;
  const urlLower = url.toLowerCase();
  return urlLower.includes('/message/') &&
         (urlLower.includes('wa.me') || urlLower.includes('whatsapp'));
}

/**
 * Extrae numero de una URL de WhatsApp
 * Port de buscar_wa_mejorado.py lineas 189-216
 */
export function extractFromWaUrl(url: string): WhatsAppValidation | null {
  if (!url) return null;

  // Links alfanumericos se manejan aparte
  if (isAlphanumericWaLink(url)) {
    return null; // Sera procesado por linktree-explorer
  }

  // Patrones para extraer numero
  const patterns = [
    /wa\.me\/(\d{10,15})/i,
    /phone=(\d{10,15})/i,
    /whatsapp\.com\/send\?phone=(\d{10,15})/i,
    /api\.whatsapp\.com.*?phone=(\d{10,15})/i,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      const validation = validateWhatsAppNumber(match[1]);
      if (validation.isValid) {
        return validation;
      }
      console.log(`[WhatsApp] Numero extraido pero invalido: ${match[1]} (${validation.reason})`);
    }
  }

  return null;
}

/**
 * Extrae numero de telefono de texto libre
 * Port de buscar_wa_mejorado.py lineas 226-264
 */
export function extractPhoneFromText(text: string): WhatsAppValidation | null {
  if (!text) return null;

  const patterns = [
    // Formato internacional con +
    /\+\s*1\s*[(\s]*\d{3}[)\s\-.]*\d{3}[\s\-.]*\d{4}/g,  // USA +1 (xxx) xxx-xxxx
    /\+\s*48\s*\d{3}[\s\-.]*\d{3}[\s\-.]*\d{3}/g,          // Polonia +48 xxx xxx xxx
    /\+\s*5[4-8]\s*9?\s*[\d\s\-.]{8,12}/g,                  // LATAM
    /\+\s*598\s*9?\s*[\d\s\-.]{7,9}/g,                      // Uruguay
    /\+\s*49\s*[\d\s\-.]{10,12}/g,                          // Alemania
    /\+\s*44\s*[\d\s\-.]{10,12}/g,                          // UK

    // Sin + pero con codigo de pais (usando patrones mas simples sin lookbehind)
    /\b1[\s\-.]?\d{3}[\s\-.]\d{3}[\s\-.]\d{4}\b/g,      // USA sin +
    /\b5[4-8]\s*9?\s*\d{2,4}[\s\-.]*\d{4}[\s\-.]*\d{4}\b/g, // LATAM sin +
  ];

  interface Candidate {
    number: string;
    validation: WhatsAppValidation;
  }

  const candidates: Candidate[] = [];

  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const num = match[0].replace(/[^\d]/g, '');
      const validation = validateWhatsAppNumber(num);
      if (validation.isValid) {
        candidates.push({ number: num, validation });
      }
    }
  }

  // Priorizar numeros con codigo de pais conocido
  const withCountryCode = candidates.find(c => c.validation.country !== 'Local');
  if (withCountryCode) {
    return withCountryCode.validation;
  }

  // Si solo hay locales, retornar el primero
  if (candidates.length > 0) {
    return candidates[0].validation;
  }

  return null;
}
