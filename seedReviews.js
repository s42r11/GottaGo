const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccount.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const bathrooms = [
  {
    name: "Ponce City Market",
    address: "675 Ponce De Leon Ave NE, Atlanta, GA 30308",
    floor: "Main Level, near food hall",
    cleanliness: 0,
    reviewCount: 0,
    accessible: true,
    genderNeutral: true,
    free: true,
    babyChanging: true,
    singleStall: false,
    verified: false,
    source: 'seeded',
    lastCleaned: 'Unknown',
    latitude: 33.7726,
    longitude: -84.3659,
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    addedBy: null,
    addedByEmail: null,
    reviews: [
      { rating: 5, comment: "Spotless and well-stocked. Attendant was actively cleaning. Best public restroom in Atlanta.", userEmail: "marcus.t••••@gmail.com", userId: "uid_seed_001", hoursAgo: 2 },
      { rating: 5, comment: "Always clean here. Gender neutral too which I appreciate.", userEmail: "priya.s••••@gmail.com", userId: "uid_seed_002", hoursAgo: 18 },
      { rating: 4, comment: "Very clean, got a little crowded on a Saturday but nothing bad.", userEmail: "james.o••••@yahoo.com", userId: "uid_seed_003", hoursAgo: 72 },
    ]
  },
  {
    name: "Piedmont Park - North Lot",
    address: "1320 Monroe Dr NE, Atlanta, GA 30306",
    floor: "Ground level",
    cleanliness: 0,
    reviewCount: 0,
    accessible: true,
    genderNeutral: false,
    free: true,
    babyChanging: false,
    singleStall: false,
    verified: false,
    source: 'seeded',
    lastCleaned: 'Unknown',
    latitude: 33.7874,
    longitude: -84.3733,
    createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    addedBy: null,
    addedByEmail: null,
    reviews: [
      { rating: 2, comment: "It's a park bathroom. You get what you get. Smelled rough on a hot day.", userEmail: "dana.k••••@gmail.com", userId: "uid_seed_004", hoursAgo: 5 },
      { rating: 3, comment: "Fine for a quick stop, nothing special. Bring your own paper just in case.", userEmail: "tasha.w••••@gmail.com", userId: "uid_seed_005", hoursAgo: 48 },
    ]
  },
  {
    name: "Whole Foods - Midtown",
    address: "650 Ponce De Leon Ave NE, Atlanta, GA 30308",
    floor: "Ground floor, rear of store",
    cleanliness: 0,
    reviewCount: 0,
    accessible: true,
    genderNeutral: false,
    free: true,
    babyChanging: true,
    singleStall: false,
    verified: false,
    source: 'seeded',
    lastCleaned: 'Unknown',
    latitude: 33.7717,
    longitude: -84.3652,
    createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    addedBy: null,
    addedByEmail: null,
    reviews: [
      { rating: 4, comment: "Clean and reliable. Never had a bad experience here.", userEmail: "chris.m••••@gmail.com", userId: "uid_seed_006", hoursAgo: 6 },
      { rating: 5, comment: "Honestly one of my go-tos in this area. Always stocked.", userEmail: "lisa.j••••@icloud.com", userId: "uid_seed_007", hoursAgo: 36 },
      { rating: 4, comment: "Good, pretty clean. Gets busy around lunch.", userEmail: "derek.p••••@gmail.com", userId: "uid_seed_008", hoursAgo: 96 },
    ]
  },
  {
    name: "Georgia Aquarium",
    address: "225 Baker St NW, Atlanta, GA 30313",
    floor: "Main entrance lobby",
    cleanliness: 0,
    reviewCount: 0,
    accessible: true,
    genderNeutral: false,
    free: false,
    babyChanging: true,
    singleStall: false,
    verified: false,
    source: 'seeded',
    lastCleaned: 'Unknown',
    latitude: 33.7634,
    longitude: -84.3951,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    addedBy: null,
    addedByEmail: null,
    reviews: [
      { rating: 5, comment: "Immaculate. Staff cleans constantly. 10/10 no notes.", userEmail: "sara.b••••@gmail.com", userId: "uid_seed_009", hoursAgo: 3 },
      { rating: 5, comment: "Best restrooms I've used in a tourist attraction. High bar set.", userEmail: "kevin.h••••@outlook.com", userId: "uid_seed_010", hoursAgo: 24 },
    ]
  },
  {
    name: "Krog Street Market",
    address: "99 Krog St NE, Atlanta, GA 30307",
    floor: "Main hall",
    cleanliness: 0,
    reviewCount: 0,
    accessible: false,
    genderNeutral: true,
    free: true,
    babyChanging: false,
    singleStall: true,
    verified: false,
    source: 'seeded',
    lastCleaned: 'Unknown',
    latitude: 33.7541,
    longitude: -84.3561,
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    addedBy: null,
    addedByEmail: null,
    reviews: [
      { rating: 3, comment: "Single stall so there's usually a line on weekends. Clean enough though.", userEmail: "nadia.r••••@gmail.com", userId: "uid_seed_011", hoursAgo: 10 },
      { rating: 4, comment: "Gender neutral single stall, appreciated that. Smelled fine.", userEmail: "alex.c••••@gmail.com", userId: "uid_seed_012", hoursAgo: 60 },
    ]
  },
  {
    name: "Atlantic Station - Central Park",
    address: "1380 Atlantic Dr NW, Atlanta, GA 30363",
    floor: "Outdoor plaza restrooms",
    cleanliness: 0,
    reviewCount: 0,
    accessible: true,
    genderNeutral: false,
    free: true,
    babyChanging: false,
    singleStall: false,
    verified: false,
    source: 'seeded',
    lastCleaned: 'Unknown',
    latitude: 33.7910,
    longitude: -84.4020,
    createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
    addedBy: null,
    addedByEmail: null,
    reviews: [
      { rating: 2, comment: "Hit or miss. Caught it on a bad day — out of soap and paper towels.", userEmail: "mike.d••••@gmail.com", userId: "uid_seed_013", hoursAgo: 8 },
      { rating: 3, comment: "Okay in a pinch. Wouldn't go out of my way for it.", userEmail: "jen.l••••@yahoo.com", userId: "uid_seed_014", hoursAgo: 120 },
    ]
  },
  {
    name: "Centennial Olympic Park",
    address: "265 Park Ave W NW, Atlanta, GA 30313",
    floor: "Near fountain, south side",
    cleanliness: 0,
    reviewCount: 0,
    accessible: true,
    genderNeutral: false,
    free: true,
    babyChanging: true,
    singleStall: false,
    verified: false,
    source: 'seeded',
    lastCleaned: 'Unknown',
    latitude: 33.7601,
    longitude: -84.3929,
    createdAt: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString(),
    addedBy: null,
    addedByEmail: null,
    reviews: [
      { rating: 4, comment: "Surprisingly good for a park. Clean and well-maintained.", userEmail: "tom.g••••@gmail.com", userId: "uid_seed_015", hoursAgo: 14 },
      { rating: 3, comment: "Clean but can get crowded during events. Baby changing station is a plus.", userEmail: "amy.w••••@gmail.com", userId: "uid_seed_016", hoursAgo: 84 },
    ]
  },
  {
    name: "Beltline - Eastside Trail Restroom",
    address: "Eastside Trail near Irwin St, Atlanta, GA 30312",
    floor: "Ground level",
    cleanliness: 0,
    reviewCount: 0,
    accessible: false,
    genderNeutral: false,
    free: true,
    babyChanging: false,
    singleStall: false,
    verified: false,
    source: 'seeded',
    lastCleaned: 'Unknown',
    latitude: 33.7490,
    longitude: -84.3680,
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    addedBy: null,
    addedByEmail: null,
    reviews: [
      { rating: 1, comment: "Avoid. No words.", userEmail: "sam.f••••@gmail.com", userId: "uid_seed_017", hoursAgo: 1 },
      { rating: 2, comment: "Better than nothing but not by much. Fine for an outdoor trail bathroom I guess.", userEmail: "pat.n••••@gmail.com", userId: "uid_seed_018", hoursAgo: 48 },
    ]
  },
];

function avg(ratings) {
  return Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;
}

function timeAgo(hoursAgo) {
  if (hoursAgo < 1) return 'Just now';
  if (hoursAgo < 24) return `${hoursAgo} hr${hoursAgo === 1 ? '' : 's'} ago`;
  const days = Math.floor(hoursAgo / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

async function seed() {
  for (const bathroom of bathrooms) {
    const { reviews, ...bathroomData } = bathroom;

    const cleanliness = avg(reviews.map(r => r.rating));
    const reviewCount = reviews.length;
    const lastReview = reviews.reduce((a, b) => a.hoursAgo < b.hoursAgo ? a : b);
    const lastCleaned = timeAgo(lastReview.hoursAgo);

    const bathroomDoc = await db.collection('bathrooms').add({
      ...bathroomData,
      cleanliness,
      reviewCount,
      verified: true,
      lastCleaned,
    });

    console.log(`Added bathroom: ${bathroom.name} → ${bathroomDoc.id} (${cleanliness}★, ${reviewCount} reviews)`);

    for (const review of reviews) {
      const { hoursAgo, ...reviewData } = review;
      await db.collection('reviews').add({
        ...reviewData,
        bathroomId: bathroomDoc.id,
        createdAt: new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString(),
      });
    }

    console.log(`  → Added ${reviews.length} reviews`);
  }

  console.log('\nDone! All bathrooms and reviews seeded.');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
