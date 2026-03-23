export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBfVPm2Wu5FvV0Al7H3Z8c5UUpA1R1ZFGg",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "studio-6124962228-d1780.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "studio-6124962228-d1780",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "studio-6124962228-d1780.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "835273246350",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:835273246350:web:0a4939a1f28fa6fe276bdf",
};

if (typeof window !== 'undefined') {
  const missingKeys = Object.entries(firebaseConfig)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missingKeys.length > 0) {
    console.warn(`Missing Firebase configuration keys: ${missingKeys.join(', ')}`);
  }
}
