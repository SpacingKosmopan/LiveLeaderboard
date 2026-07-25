import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

export const firebaseConfig = {
  apiKey: "AIzaSyAx_NIbG23zGIb7k_FPsyxePJN7jX910x4",
  authDomain: "live-esport-leaderboard.firebaseapp.com",
  projectId: "live-esport-leaderboard",
  storageBucket: "live-esport-leaderboard.firebasestorage.app",
  messagingSenderId: "782725761788",
  appId: "1:782725761788:web:226e09d8ef4a7e2192a579",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
