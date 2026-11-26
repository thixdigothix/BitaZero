import fs from 'fs';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const firebaseConfig = JSON.parse(
  fs.readFileSync(
    new URL('../../firebase-applet-config.json', import.meta.url),
    'utf8'
  )
) as { projectId?: string };

if (!getApps().length) {
  initializeApp({
    projectId: firebaseConfig.projectId || process.env.GOOGLE_CLOUD_PROJECT,
  });
}

export const adminAuth = getAuth();
