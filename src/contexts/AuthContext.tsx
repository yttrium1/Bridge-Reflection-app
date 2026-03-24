"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const NOT_ALLOWED_ERROR = "このメールアドレスは登録が許可されていません。管理者にお問い合わせください。";

async function checkAllowed(email: string | null): Promise<boolean> {
  if (!email) return false;
  try {
    const snap = await getDoc(doc(db, "config", "access"));
    if (!snap.exists()) return true; // no config = allow all
    const allowedEmails: string[] = snap.data().allowedEmails || [];
    return allowedEmails.map(e => e.toLowerCase()).includes(email.toLowerCase());
  } catch {
    return true; // on error, allow (don't lock out)
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const allowed = await checkAllowed(cred.user.email);
    if (!allowed) {
      await firebaseSignOut(auth);
      throw new Error(NOT_ALLOWED_ERROR);
    }
  };

  const signUp = async (email: string, password: string) => {
    const allowed = await checkAllowed(email);
    if (!allowed) {
      throw new Error(NOT_ALLOWED_ERROR);
    }
    await createUserWithEmailAndPassword(auth, email, password);
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    const allowed = await checkAllowed(cred.user.email);
    if (!allowed) {
      await firebaseSignOut(auth);
      throw new Error(NOT_ALLOWED_ERROR);
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
