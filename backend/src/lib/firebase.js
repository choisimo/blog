import admin from 'firebase-admin';
import { config } from '../config.js';

let app;

function getServiceAccount() {
  const json = config.firebase.serviceAccountJson;
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON');
  }
}

export function getDb() {
  if (!app) {
    const sa = getServiceAccount();
    if (!sa) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_JSON');
    if (admin.apps.length === 0) {
      app = admin.initializeApp({
        credential: admin.credential.cert(sa),
        projectId: config.firebase.projectId || sa.project_id,
      });
    } else {
      app = admin.app();
    }
  }
  return admin.firestore();
}

export const FieldValue = admin.firestore.FieldValue;
export const Timestamp = admin.firestore.Timestamp;
