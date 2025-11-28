export interface CursorPixelPosition {
  top: number;
  left: number;
  height: number;
}

// Cache mirror divs to avoid recreation
const mirrorCache = new WeakMap<HTMLTextAreaElement, HTMLDivElement>();

// CSS properties that affect text layout (excluding padding/border - we handle position separately)
const MIRROR_STYLES = [
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'letterSpacing',
  'lineHeight',
  'textTransform',
  'wordWrap',
  'wordSpacing',
  'boxSizing',
  'width',
] as const;

function getMirrorDiv(textarea: HTMLTextAreaElement): HTMLDivElement {
  let mirror = mirrorCache.get(textarea);

  if (!mirror) {
    mirror = document.createElement('div');
    mirror.style.position = 'absolute';
    mirror.style.visibility = 'hidden';
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.wordWrap = 'break-word';
    mirror.style.overflow = 'hidden';
    mirror.style.top = '0';
    mirror.style.left = '-9999px';
    document.body.appendChild(mirror);
    mirrorCache.set(textarea, mirror);
  }

  // Sync styles from textarea
  const computed = window.getComputedStyle(textarea);
  MIRROR_STYLES.forEach((prop) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mirror as HTMLDivElement).style[prop as any] = computed[prop];
  });

  return mirror;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
    .replace(/ /g, '&nbsp;');
}

/**
 * Calculate the pixel position of a cursor at a given character index
 * in a textarea element.
 */
export function calculateCursorPosition(
  textarea: HTMLTextAreaElement,
  charIndex: number
): CursorPixelPosition {
  const mirror = getMirrorDiv(textarea);
  const value = textarea.value;

  // Ensure index is within valid range
  const safeIndex = Math.max(0, Math.min(charIndex, value.length));

  // Split text at cursor position
  const textBefore = value.substring(0, safeIndex);
  const marker = '<span id="cursor-marker" style="display:inline;">|</span>';

  // Set mirror content with escaped HTML
  mirror.innerHTML = escapeHtml(textBefore) + marker;

  const markerEl = mirror.querySelector('#cursor-marker') as HTMLSpanElement;
  const computed = getComputedStyle(textarea);

  // Get the actual line height - parse it properly
  let lineHeight: number;
  const lineHeightValue = computed.lineHeight;
  if (lineHeightValue === 'normal') {
    // For 'normal', use font size * 1.2 (typical browser default)
    lineHeight = parseFloat(computed.fontSize) * 1.2;
  } else {
    lineHeight = parseFloat(lineHeightValue);
  }

  // Use fontSize as cursor height for better visual match
  const fontSize = parseFloat(computed.fontSize) || 14;
  const cursorHeight = fontSize * 1.2; // Slightly taller than font size

  if (!markerEl) {
    return { top: 0, left: 0, height: cursorHeight };
  }

  // Mirror doesn't have padding/border, so we need to add them
  const paddingTop = parseFloat(computed.paddingTop) || 0;
  const paddingLeft = parseFloat(computed.paddingLeft) || 0;
  const borderTop = parseFloat(computed.borderTopWidth) || 0;
  const borderLeft = parseFloat(computed.borderLeftWidth) || 0;

  // Center the cursor vertically within the line height
  const verticalOffset = (lineHeight - cursorHeight) / 2;

  return {
    top: markerEl.offsetTop - textarea.scrollTop + paddingTop + borderTop + verticalOffset,
    left: markerEl.offsetLeft - textarea.scrollLeft + paddingLeft + borderLeft,
    height: cursorHeight,
  };
}

/**
 * Calculate pixel positions for a selection range
 */
export function calculateSelectionPosition(
  textarea: HTMLTextAreaElement,
  startIndex: number,
  endIndex: number
): { start: CursorPixelPosition; end: CursorPixelPosition } {
  return {
    start: calculateCursorPosition(textarea, startIndex),
    end: calculateCursorPosition(textarea, endIndex),
  };
}

/**
 * Cleanup mirror div when component unmounts
 */
export function cleanupMirror(textarea: HTMLTextAreaElement): void {
  const mirror = mirrorCache.get(textarea);
  if (mirror && mirror.parentNode) {
    mirror.parentNode.removeChild(mirror);
    mirrorCache.delete(textarea);
  }
}

/**
 * Get user color based on user ID (consistent color assignment)
 */
export function getUserColor(userId: string): string {
  const colors = [
    '#f56a00',
    '#7265e6',
    '#ffbf00',
    '#00a2ae',
    '#eb2f96',
    '#52c41a',
    '#1890ff',
    '#722ed1',
  ];
  const index = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[index % colors.length];
}
