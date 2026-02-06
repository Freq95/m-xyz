// XSS sanitization - REQUIRES isomorphic-dompurify for production
// Fallback is ONLY for development/build compatibility

let DOMPurify: any = null;
let isDOMPurifyAvailable = false;

try {
  const dompurifyModule = require('isomorphic-dompurify');
  DOMPurify = dompurifyModule.default || dompurifyModule;
  isDOMPurifyAvailable = DOMPurify && typeof DOMPurify.sanitize === 'function';

  if (!isDOMPurifyAvailable) {
    console.error('⚠️ CRITICAL: DOMPurify loaded but sanitize function not available');
  }
} catch (error) {
  console.error('⚠️ CRITICAL: isomorphic-dompurify failed to load:', error);
}

/**
 * Basic HTML tag stripping fallback - INSECURE, only for build/dev
 * DO NOT USE IN PRODUCTION
 */
function basicStripTags(input: string): string {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('CRITICAL SECURITY ERROR: DOMPurify unavailable in production. Cannot sanitize user input safely.');
  }

  console.warn('⚠️ Using insecure fallback sanitization - DOMPurify not available');

  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .trim();
}

/**
 * Sanitize user-generated text content.
 * Removes all HTML and script content to prevent XSS attacks.
 */
export function sanitizeText(input: string): string {
  if (!input) return '';

  if (isDOMPurifyAvailable) {
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: [], // No HTML allowed
      ALLOWED_ATTR: [], // No attributes allowed
    }).trim();
  }

  // Fallback - throws error in production
  return basicStripTags(input);
}

/**
 * Sanitize user-generated HTML content (for rich text fields if needed later).
 * Only allows safe tags like <b>, <i>, <p>, <br>, <a>
 */
export function sanitizeHtml(input: string): string {
  if (!input) return '';

  if (isDOMPurifyAvailable) {
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'a', 'ul', 'ol', 'li'],
      ALLOWED_ATTR: ['href', 'target', 'rel'],
      ADD_ATTR: ['target'],
      FORBID_ATTR: ['style', 'onclick', 'onerror'],
    }).trim();
  }

  // Fallback - throws error in production, strips all HTML in dev
  return basicStripTags(input);
}
