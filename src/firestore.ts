import { initializeApp, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let db: Firestore | null = null;

// Singleton do cliente Firestore. Usa Application Default Credentials — no
// Cloud Run isso funciona sem nenhuma configuracao extra; localmente exige
// `gcloud auth application-default login` (ou GOOGLE_APPLICATION_CREDENTIALS
// apontando pra uma service account) ou a variavel FIRESTORE_EMULATOR_HOST
// pra testar contra o emulador.
export function getDb(): Firestore {
  if (db) return db;
  if (getApps().length === 0) {
    initializeApp({ credential: applicationDefault() });
  }
  db = getFirestore();
  return db;
}
