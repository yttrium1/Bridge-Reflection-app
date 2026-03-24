// Setup initial allowedUsers in Firestore (authenticated as existing user)
// Usage: node scripts/setup-allowed-users.mjs

import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { createInterface } from "readline";

const firebaseConfig = {
  apiKey: "AIzaSyApP0BcYf83692iC3VDNXaWrtlKMkSGDg0",
  authDomain: "bridge-reflection.firebaseapp.com",
  projectId: "bridge-reflection",
  storageBucket: "bridge-reflection.firebasestorage.app",
  messagingSenderId: "172562014027",
  appId: "1:172562014027:web:ba3c00d1bfc4baed3052ce",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const authInstance = getAuth(app);

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

async function setup() {
  const email = await ask("Email: ");
  const password = await ask("Password: ");

  await signInWithEmailAndPassword(authInstance, email, password);
  console.log("Signed in as", email);

  await setDoc(doc(db, "config", "access"), {
    allowedEmails: ["yttrium4649@gmail.com"],
  });
  console.log("Done: allowedEmails set to ['yttrium4649@gmail.com']");
  rl.close();
  process.exit(0);
}

setup().catch((err) => {
  console.error("Failed:", err.message);
  rl.close();
  process.exit(1);
});
