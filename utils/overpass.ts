import * as Location from 'expo-location';
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

async function reverseGeocode(latitude: number, longitude: number): Promise<string> {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (results && results.length > 0) {
      const r = results[0];
      const parts = [
        r.streetNumber,
        r.street,
        r.city,
        r.region,
      ].filter(Boolean);
      return parts.join(', ');
    }
  } catch (e) {
    console.log('Reverse geocode failed:', e);
  }
  return '';
}

export async function fetchAndSeedNearbyBathrooms(latitude: number, longitude: number) {
  try {
    console.log('Fetching OSM bathrooms near:', latitude, longitude);
    const overpassQuery = `[out:json][timeout:30];node["amenity"="toilets"](around:3000,${latitude},${longitude});out body;`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000);

    let response: Response | null = null;
    try {
      const r = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': 'GottaGo/1.0',
        },
        body: `data=${encodeURIComponent(overpassQuery)}`,
      });
      clearTimeout(timeoutId);
      console.log('Overpass response status:', r.status);
      if (r.ok) response = r;
      else console.log('Overpass response not ok:', r.status, r.statusText);
    } catch (e) {
      clearTimeout(timeoutId);
      console.log('Overpass fetch failed:', e instanceof Error ? e.message : String(e));
    }

    if (!response) return;

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

      // Reverse geocode to get a real address
      const address = await reverseGeocode(element.lat, element.lon);

      await addDoc(collection(db, 'bathrooms'), {
        name,
        address,
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
    console.log('Overpass API error:', error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  }
}