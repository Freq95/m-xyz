// XSS sanitization with graceful fallback if DOMPurify is not installed
// In production, ensure isomorphic-dompurify is installed: npm install isomorphic-dompurify

let DOMPurify: any = null;

try {
  const dompurifyModule = require('isomorphic-dompurify');
  // Handle both default export and named export
  DOMPurify = dompurifyModule.default || dompurifyModule;
} catch {
  console.warn('⚠️  isomorphic-dompurify not installed. Using basic sanitization fallback.');
}

/**
 * Basic HTML tag stripping fallback when DOMPurify is not available.
 * NOT as secure as DOMPurify - install the package for production!
 */
function basicStripTags(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/<[^>]*>/g, '') // Remove all HTML tags
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

  try {
    if (DOMPurify && typeof DOMPurify.sanitize === 'function') {
      return DOMPurify.sanitize(input, {
        ALLOWED_TAGS: [], // No HTML allowed
        ALLOWED_ATTR: [], // No attributes allowed
      }).trim();
    }
  } catch (err) {
    console.error('DOMPurify error, using fallback:', err);
  }

  // Fallback: basic tag stripping
  return basicStripTags(input);
}

/**
 * Sanitize user-generated HTML content (for rich text fields if needed later).
 * Only allows safe tags like <b>, <i>, <p>, <br>, <a>
 */
export function sanitizeHtml(input: string): string {
  if (!input) return '';

  try {
    if (DOMPurify && typeof DOMPurify.sanitize === 'function') {
      return DOMPurify.sanitize(input, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'a', 'ul', 'ol', 'li'],
        ALLOWED_ATTR: ['href', 'target', 'rel'],
        ADD_ATTR: ['target'],
        FORBID_ATTR: ['style', 'onclick', 'onerror'],
      }).trim();
    }
  } catch (err) {
    console.error('DOMPurify error, using fallback:', err);
  }

  // Fallback: strip all tags (less permissive but safer without proper sanitizer)
  return basicStripTags(input);
}
