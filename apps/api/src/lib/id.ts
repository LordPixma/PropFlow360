import { nanoid } from 'nanoid';

export function generateId(prefix?: string): string {
  const id = nanoid(21);
  return prefix ? `${prefix}_${id}` : id;
}

export function generateShortId(): string {
  return nanoid(10);
}
