import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { ADMIN_CREDENTIALS, USER_ROLES } from '../config/constants';
import { User } from '../types';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (!firebaseUser) {
          setUser(null);
          setLoading(false);
          return;
        }

        // ✅ Admin (hardcoded)
        if (firebaseUser.email === ADMIN_CREDENTIALS.email) {
          setUser({
            id: 'admin',
            email: ADMIN_CREDENTIALS.email,
            role: USER_ROLES.ADMIN,
            name: 'Administrator',
            phone: '+91-9999999999',
            createdAt: new Date(),
            isActive: true,
          });
          setLoading(false);
          return;
        }

        // ✅ Fetch Firestore user
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const data = userSnap.data();

          setUser({
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            role: data.role || USER_ROLES.FARMER, // fallback role
            name: data.name || 'User',
            phone: data.phone || '',
            address: data.address || '',
            pincode: data.pincode || '',
            shopName: data.shopName || '',
            deliveryRadius: data.deliveryRadius || 20,
            coveredPincodes: data.coveredPincodes || [],
            createdAt: data.createdAt?.toDate?.() || new Date(),
            isActive: data.isActive ?? true,
          });
        } else {
          // ✅ Auto-create user document instead of logout
          const newUser: User = {
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            role: USER_ROLES.FARMER, // default role
            name: 'New User',
            phone: '',
            createdAt: new Date(),
            isActive: true,
          };

          await setDoc(userRef, newUser);

          console.warn('User doc not found, created new user:', newUser);

          setUser(newUser);
        }
      } catch (err) {
        console.error('Auth error:', err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return { user, loading };
};
