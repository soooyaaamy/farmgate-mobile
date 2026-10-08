// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA_3_BKzXysh7XBPGnqGpJtf3KXAGBEhno",
  authDomain: "farmgate-new.firebaseapp.com",
  projectId: "farmgate-new",
  storageBucket: "farmgate-new.firebasestorage.app",
  messagingSenderId: "493241053567",
  appId: "1:493241053567:web:4052283b82a71fffed6a4a"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const db = getFirestore(app);

export const storage = getStorage(app);
