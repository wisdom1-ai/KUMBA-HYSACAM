
"use strict";

import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY_HERE",
  authDomain: "hysacam-kumba-tracker.firebaseapp.com",
  projectId: "hysacam-kumba-tracker",
  storageBucket: "hysacam-kumba-tracker.firebasestorage.app",
  messagingSenderId: "1000510691567",
  appId: "1:1000510691567:web:c5e0384f0e56f72892631a"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export {
  auth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
};
