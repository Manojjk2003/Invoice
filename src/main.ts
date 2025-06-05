import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase configuration
const firebaseConfig = {
 apiKey: "AIzaSyAFG73LQbkPLeyTrMYauJgTu0eAGDzIGUE",
  authDomain: "invoice-app-87ff8.firebaseapp.com",
  projectId: "invoice-app-87ff8",
  storageBucket: "invoice-app-87ff8.firebasestorage.app",
  messagingSenderId: "549235189595",
  appId: "1:549235189595:web:9c5122e9ecf11985e91c7e",
  measurementId: "G-N6PBHCLV7P"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
