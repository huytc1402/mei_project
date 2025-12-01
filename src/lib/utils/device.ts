import { v4 as uuidv4 } from 'uuid';
import CryptoJS from 'crypto-js';

export function generateDeviceId(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  let deviceId: string | null = localStorage.getItem('device_id');
  if (!deviceId) {
    const newDeviceId = uuidv4();
    localStorage.setItem('device_id', newDeviceId);
    return newDeviceId;
  }
  return deviceId;
}

export function generateFingerprint(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  const deviceId = generateDeviceId();
  const userAgent = navigator.userAgent;
  const screenSize = `${window.screen.width}x${window.screen.height}`;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const language = navigator.language;
  
  const fingerprintString = `${deviceId}-${userAgent}-${screenSize}-${timezone}-${language}`;
  return CryptoJS.SHA256(fingerprintString).toString();
}

export function hashIP(ip: string): string {
  return CryptoJS.SHA256(ip).toString();
}

export function getUserAgent(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  return navigator.userAgent;
}

