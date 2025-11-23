import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export function formatDate(date: string | Date, format = 'YYYY-MM-DD HH:mm:ss'): string {
  return dayjs(date).format(format);
}

export function formatRelativeTime(date: string | Date): string {
  return dayjs(date).fromNow();
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

// Color utilities for clue tree nodes
export const clueTypeColors: Record<string, string> = {
  evidence: '#ff4d4f',
  testimony: '#1890ff',
  world_info: '#52c41a',
  decoy: '#fa8c16',
};

export const importanceColors: Record<string, string> = {
  critical: '#ff4d4f',
  major: '#fa8c16',
  minor: '#1890ff',
  easter_egg: '#722ed1',
};

export const statusColors: Record<string, string> = {
  draft: '#d9d9d9',
  active: '#52c41a',
  disabled: '#ff4d4f',
  test: '#1890ff',
  online: '#52c41a',
  archived: '#d9d9d9',
};
