import { addDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';

type OverpassBathroom = {
  id: number;
  lat: number;
  lon: number;
  tags: {
    name?: string;
    access?: string;
    fee?: string;
    wheelchair?: string;
    changing_table?: string;
    unisex?: string;
    building?: string;
  };
};

export async function fetchAndSeedNearbyBathrooms(latitude: number, longitude: number) {
  try {
    console.log('Fetching OSM bathrooms near:', latitude, longitude);
    const radius = 5000;
    const overpassQuery = `
      [out:json][timeout:25];
      (
        node["amenity"="toilets"](around:${radius},${latitude},${longitude});
        node["amenity"="restroom"](around:${radius},${latitude},${longitude});
        node["amenity"="bathroom"](around:${radius},${latitude},${longitude});
      );
      out body;
    `;

    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: overpassQuery,
    });

    console.log('Overpass response status:', response.status);
    if (!response.ok) {
      console.log('Overpass response not ok:', response.status, response.statusText);
      return;
    }

    const data = await response.json();
    const elements: OverpassBathroom[] = data.elements || [];
    console.log('Overpass elements found:', elements.length);

    if (elements.length === 0) return;

    // Get existing OSM ids from Firebase to avoid duplicates
    const existingSnapshot = await getDocs(collection(db, 'bathrooms'));
    const existingOsmIds = new Set(
      existingSnapshot.docs
        .filter(doc => doc.data().source === 'osm')
        .map(doc => doc.data().osmId)
    );

    // Add new bathrooms that don't exist yet
    let added = 0;
    for (const element of elements) {
      if (existingOsmIds.has(element.id)) continue;

      const name = element.tags.name || 'Public Restroom';
      const accessible = element.tags.wheelchair === 'yes';
      const free = element.tags.fee !== 'yes';
      const babyChanging = element.tags.changing_table === 'yes';
      const genderNeutral = element.tags.unisex === 'yes';

      await addDoc(collection(db, 'bathrooms'), {
        name,
        address: '',
        floor: '',
        accessible,
        genderNeutral,
        free,
        babyChanging,
        singleStall: false,
        cleanliness: 0,
        reviewCount: 0,
        verified: false,
        source: 'osm',
        osmId: element.id,
        lastCleaned: 'Unknown',
        distance: 'Nearby',
        latitude: element.lat,
        longitude: element.lon,
        createdAt: new Date().toISOString(),
      });
      added++;
    }

    console.log(`OSM: found ${elements.length} bathrooms, added ${added} new ones`);
  } catch (error) {
    console.log('Overpass API error:', JSON.stringify(error));
  }
}