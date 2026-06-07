import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
  type QueryConstraint,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

export const getDocument = async <T>(col: string, id: string): Promise<T | null> => {
  const snap = await getDoc(doc(db, col, id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null;
};

export const getDocuments = async <T>(
  col: string,
  constraints: QueryConstraint[] = []
): Promise<T[]> => {
  const q = query(collection(db, col), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as T));
};

export const createDocument = async <T extends object>(
  col: string,
  data: T
): Promise<string> => {
  const ref = await addDoc(collection(db, col), data);
  return ref.id;
};

export const upsertDocument = async <T extends object>(
  col: string,
  id: string,
  data: T
): Promise<void> => {
  await setDoc(doc(db, col, id), data, { merge: true });
};

export const updateDocument = async (
  col: string,
  id: string,
  data: Record<string, unknown>
): Promise<void> => {
  await updateDoc(doc(db, col, id), data);
};

export const deleteDocument = async (col: string, id: string): Promise<void> => {
  await deleteDoc(doc(db, col, id));
};

export {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Timestamp,
  serverTimestamp,
};
