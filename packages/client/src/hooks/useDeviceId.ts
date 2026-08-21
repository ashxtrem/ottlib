import { generateId } from '../utils/id.js';

const storageKey = 'ottlib-device-id';
export function getDeviceId(): string {
  const current = localStorage.getItem(storageKey); if (current) return current;
  const id = generateId(); localStorage.setItem(storageKey, id); return id;
}
