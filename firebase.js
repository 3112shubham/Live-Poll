import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  getDocs,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDmLd34RCp1NE_vn8gBwBgUR7-3ew50d-0",
  authDomain: "live-pole.firebaseapp.com",
  projectId: "live-pole",
  storageBucket: "live-pole.firebasestorage.app",
  messagingSenderId: "166403914001",
  appId: "1:166403914001:web:cec2c79091450aa20574b0",
  measurementId: "G-98JD16VFGF"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db, collection, addDoc, doc, setDoc, getDoc, onSnapshot, query, orderBy, getDocs };