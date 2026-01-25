import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyAnc0PP9J7Io3oehKUmvj93pl2nLtpUMvY",
  authDomain: "agriatoo-89742.firebaseapp.com",
  projectId: "agriatoo-89742",
  storageBucket: "agriatoo-89742.appspot.com",
  messagingSenderId: "562301879290",
  appId: "1:562301879290:web:9cf7d19fcefb923f871a43",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;