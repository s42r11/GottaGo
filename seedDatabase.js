const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const bathrooms = [
  { name: "Starbucks - Peachtree Rd", cleanliness: 3.9, distance: "0.3 mi", accessible: true, genderNeutral: true, free: true, babyChanging: false, lastCleaned: "1 hr ago", latitude: 33.7765, longitude: -84.3598 },
  { name: "Chamblee City Park", cleanliness: 2.8, distance: "0.5 mi", accessible: true, genderNeutral: false, free: true, babyChanging: false, lastCleaned: "4 hrs ago", latitude: 33.7712, longitude: -84.3678 },
  { name: "Nordstrom - Perimeter Mall", cleanliness: 4.9, distance: "0.8 mi", accessible: true, genderNeutral: false, free: true, babyChanging: true, lastCleaned: "8 min ago", latitude: 33.7801, longitude: -84.3556 },
  { name: "McDonald's - Buford Hwy", cleanliness: 2.1, distance: "1.1 mi", accessible: true, genderNeutral: false, free: true, babyChanging: false, lastCleaned: "Unknown", latitude: 33.7698, longitude: -84.3721 },
];

async function seed() {
  for (const bathroom of bathrooms) {
    const doc = await addDoc(collection(db, 'bathrooms'), bathroom);
    console.log('Added:', bathroom.name, '→', doc.id);
  }
  console.log('Done!');
  process.exit(0);
}

seed();