import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { ADMIN_CREDENTIALS, USER_ROLES } from '../config/constants';
import { User } from '../types';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // Check if it's admin (hardcoded credentials)
          if (firebaseUser.email === ADMIN_CREDENTIALS.email) {
            setUser({
              id: 'admin',
              email: ADMIN_CREDENTIALS.email,
              role: USER_ROLES.ADMIN,
              name: 'Administrator',
              phone: '+91-9999999999',
              createdAt: new Date(),
              isActive: true
            });
          } else {
            // Fetch user data from Firestore
            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (userDoc.exists()) {
              setUser({ id: firebaseUser.uid, ...userDoc.data() } as User);
            }
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Auth error:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return { user, loading };
};