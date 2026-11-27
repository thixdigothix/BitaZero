import fs from 'fs';
import path from 'path';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function loadFirebaseProjectId(): string {
  const candidates: Array<string | URL> = [
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
    new URL('../../firebase-applet-config.json', import.meta.url),
  ];

  for (const target of candidates) {
    try {
      const raw = fs.readFileSync(target, 'utf8');
      const parsed = JSON.parse(raw) as { projectId?: string };
      if (parsed?.projectId) {
        return parsed.projectId;
      }
    } catch {
      // Try next candidate path
    }
  }

  return (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    'canvas-loader-pv8b6'
  );
}

if (!getApps().length) {
  initializeApp({
    projectId: loadFirebaseProjectId(),
  });
}

export const adminAuth = getAuth();
