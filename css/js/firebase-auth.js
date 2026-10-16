"use strict";

import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyB3B5vPcdEeMyGR66HykE6T2yKmXKEAe6g",
  authDomain: "hysacam-kumba-tracker.firebaseapp.com",
  projectId: "hysacam-kumba-tracker",
  storageBucket: "hysacam-kumba-tracker.firebasestorage.app",
  messagingSenderId: "1000510691567",
  appId: "1:1000510691567:web:c5e0384f0e56f72892631a",
  measurementId: "G-KSHKWPQ88V"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const registerPasswordInput = document.getElementById("registerPassword");
const toggleRegisterPassword = document.getElementById("toggleRegisterPassword");

if (registerPasswordInput && toggleRegisterPassword) {
  toggleRegisterPassword.addEventListener("click", () => {
    const isHidden = registerPasswordInput.type === "password";

    registerPasswordInput.type = isHidden ? "text" : "password";
    toggleRegisterPassword.textContent = isHidden ? "🙈" : "👁️";
    toggleRegisterPassword.setAttribute(
      "aria-label",
      isHidden ? "Hide password" : "Show password"
    );
    toggleRegisterPassword.setAttribute(
      "aria-pressed",
      String(isHidden)
    );
  });
}

const loginPasswordInput = document.getElementById("loginPassword");
const toggleLoginPassword = document.getElementById("toggleLoginPassword");

if (loginPasswordInput && toggleLoginPassword) {
  toggleLoginPassword.addEventListener("click", () => {
    const isHidden = loginPasswordInput.type === "password";

    loginPasswordInput.type = isHidden ? "text" : "password";
    toggleLoginPassword.textContent = isHidden ? "🙈" : "👁️";
    toggleLoginPassword.setAttribute(
      "aria-label",
      isHidden ? "Hide password" : "Show password"
    );
    toggleLoginPassword.setAttribute(
      "aria-pressed",
      String(isHidden)
    );
  });
}

const loginScreen = document.getElementById("loginScreen");
const registerScreen = document.getElementById("registerScreen");
const showRegisterButton = document.getElementById("showRegister");
const backToLoginButton = document.getElementById("backToLogin");

if (showRegisterButton) {
  showRegisterButton.addEventListener("click", () => {
    loginScreen.style.display = "none";
    registerScreen.style.display = "block";
  });
}

if (backToLoginButton) {
  backToLoginButton.addEventListener("click", () => {
    registerScreen.style.display = "none";
    loginScreen.style.display = "block";
  });
}
const appShell = document.querySelector(".app-shell");
const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");

if (appShell) {
  appShell.style.display = "none";
}

const registerForm = document.getElementById("registerForm");
const registerMessage = document.getElementById("registerMessage");
const loginLinkMessage = document.getElementById("loginMessage");

if (registerForm) {
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = document.getElementById("registerName").value.trim();
    const email = document.getElementById("registerEmail").value.trim();
    const password = document.getElementById("registerPassword").value;

    registerMessage.textContent = "Creating your account...";

    try {
    
const credential = await createUserWithEmailAndPassword(
  auth,
  email,
  password
);

await sendEmailVerification(credential.user);

registerMessage.textContent =
  "Account created! Check your email inbox or spam folder for the verification link before logging in.";

await signOut(auth);
      
    } catch (error) {
      registerMessage.textContent =
        error.code === "auth/email-already-in-use"
          ? "This email already has an account. Please log in."
          : error.code === "auth/weak-password"
          ? "Please choose a stronger password."
          : "Account creation failed. Please check your details and try again.";
    }
  });
}

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    loginMessage.textContent = "Signing in...";

    try {
      const credential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      if (!credential.user.emailVerified) {
        await signOut(auth);
        loginMessage.textContent =
          "Please verify your email first. Check your inbox or spam folder.";
        return;
      }

      loginMessage.textContent = "";
    } catch (error) {
      loginMessage.textContent =
        "Login failed. Check your email and password.";
    }
  });
}

if (appShell) {
  const logoutButton = document.createElement("button");
  logoutButton.textContent = "Log Out";
  logoutButton.style.cssText =
    "margin:12px;padding:10px 18px;background:#147d4a;color:white;border:0;border-radius:6px;";

  appShell.insertBefore(logoutButton, appShell.firstChild);

  logoutButton.addEventListener("click", async () => {
    try {
      await signOut(auth);
    } catch (error) {
      alert("Could not log out. Please try again.");
    }
  });
}


onAuthStateChanged(auth, async (user) => {
  if (user && user.emailVerified) {
    if (loginScreen) loginScreen.style.display = "none";
    if (registerScreen) registerScreen.style.display = "none";
    if (appShell) appShell.style.display = "";
  } else {
    if (user) {
      await signOut(auth);
    }

    if (registerScreen) registerScreen.style.display = "none";
    if (loginScreen) loginScreen.style.display = "block";
    if (appShell) appShell.style.display = "none";
  }
});


