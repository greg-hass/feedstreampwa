import DOMPurify from 'dompurify';

const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'b', 'i', 'u', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code', 'img', 'figure', 'figcaption', 'hr', 'sub', 'sup', 'del', 'ins', 'small', 'mark', 'table', 'thead', 'tbody', 'tr', 'th', 'td'];

const ALLOWED_ATTR = ['href', 'src', 'alt', 'title', 'class', 'id', 'width', 'height', 'loading', 'rel', 'target'];

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: {
      '*': ALLOWED_ATTR,
      'a': ['href', 'title', 'class', 'rel', 'target'],
      'img': ['src', 'alt', 'title', 'class', 'width', 'height', 'loading'],
    },
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    SAFE_FOR_JQUERY: true,
  });
}

export function stripHtml(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: [] });
}
