import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import { collection, getDocs } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { auth, db } from '../../firebaseConfig';
import { fetchAndSeedNearbyBathrooms } from '../../utils/overpass';

type Bathroom = {
  id: string;
  name: string;
  cleanliness: number;
  reviewCount: number;
  free: boolean;
  accessible: boolean;
  babyChanging: boolean;
  genderNeutral: boolean;
  latitude: number;
  longitude: number;
  lastCleaned: string;
  verified: boolean;
};

function getColor(score: number) {
  if (score >= 4.5) return '#22c55e';
  if (score >= 3.5) return '#f59e0b';
  return '#f43f5e';
}

function getLabel(score: number) {
  if (score >= 4.5) return 'Spotless';
  if (score >= 3.5) return 'Decent';
  return 'Rough';
}

export default function MapScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [bathrooms, setBathrooms] = useState<Bathroom[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }
      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);
      await fetchAndSeedNearbyBathrooms(
        loc.coords.latitude,
        loc.coords.longitude
      );
    })();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      async function fetchBathrooms() {
        try {
          const snapshot = await getDocs(collection(db, 'bathrooms'));
          const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Bathroom[];
          setBathrooms(data);
        } catch (error) {
          console.error('Error fetching bathrooms:', error);
        } finally {
          setLoading(false);
        }
      }
      fetchBathrooms();
    }, [])
  );

  const initialRegion = {
    latitude: location?.coords.latitude ?? 33.7748,
    longitude: location?.coords.longitude ?? -84.3642,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  const selectedBathroom = bathrooms.find(b => b.id === selected);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0d9488" />
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>🚽 GottaGo</Text>
        <Text style={styles.subtitle}>
          {errorMsg ?? (location ? '📍 Using your location' : '📍 Finding your location...')}
        </Text>
      </View>

      <MapView
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={true}
        showsMyLocationButton={true}
        provider="google"
      >
        {bathrooms.map(b => (
          <Marker
            key={b.id}
            coordinate={{ latitude: b.latitude, longitude: b.longitude }}
            onPress={() => setSelected(b.id)}
          >
            <View style={[styles.pin, {
              borderColor: b.cleanliness === 0 ? '#475569' : getColor(b.cleanliness),
              backgroundColor: b.cleanliness === 0 ? '#1e293b' : '#0f172a',
            }]}>
              <Text style={[styles.pinScore, {
                color: b.cleanliness === 0 ? '#475569' : getColor(b.cleanliness)
              }]}>
                {b.cleanliness === 0 ? '★ New' : b.cleanliness.toFixed(1)}
              </Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* OSM Attribution */}
      <View style={styles.attribution}>
        <Text style={styles.attributionText}>© OpenStreetMap Contributors</Text>
      </View>

      {selectedBathroom && (
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardName}>{selectedBathroom.name}</Text>
              <Text style={[styles.cardLabel, {
                color: selectedBathroom.cleanliness === 0 ? '#475569' : getColor(selectedBathroom.cleanliness)
              }]}>
                {selectedBathroom.cleanliness === 0
                  ? 'Not yet rated — be the first!'
                  : `${getLabel(selectedBathroom.cleanliness)} · ${selectedBathroom.reviewCount || 0} reviews`}
              </Text>
            </View>
            <View style={styles.scoreBox}>
              <Text style={[styles.score, {
                color: selectedBathroom.cleanliness === 0 ? '#475569' : getColor(selectedBathroom.cleanliness)
              }]}>
                {selectedBathroom.cleanliness === 0 ? 'New' : selectedBathroom.cleanliness.toFixed(1)}
              </Text>
            </View>
          </View>

          <View style={styles.badges}>
            {selectedBathroom.verified && <Text style={styles.verifiedBadge}>✓ Verified</Text>}
            {selectedBathroom.accessible && <Text style={styles.badge}>♿ Accessible</Text>}
            {selectedBathroom.genderNeutral && <Text style={styles.badge}>⚧ Neutral</Text>}
            {selectedBathroom.free && <Text style={styles.badge}>🆓 Free</Text>}
            {selectedBathroom.babyChanging && <Text style={styles.badge}>👶 Baby</Text>}
          </View>

          <View style={styles.buttons}>
            <TouchableOpacity
              style={styles.btn}
              onPress={() => {
                if (!auth.currentUser) {
                  router.push('/login');
                } else {
                  router.push({ pathname: '/review', params: { bathroomId: selectedBathroom.id, bathroomName: selectedBathroom.name } });
                }
              }}>
              <Text style={styles.btnText}>✍️ Leave a Review</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btnOutline}
              onPress={() => {
                const url = `https://www.google.com/maps/dir/?api=1&destination=${selectedBathroom.latitude},${selectedBathroom.longitude}`;
                Linking.openURL(url);
              }}>
              <Text style={styles.btnOutlineText}>🗺 Directions</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnClose} onPress={() => setSelected(null)}>
              <Text style={styles.btnCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#64748b', fontWeight: '600' },
  header: { backgroundColor: '#1e293b', padding: 20, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: '#334155' },
  logo: { fontSize: 26, fontWeight: '800', color: '#f8fafc' },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
  map: { flex: 1 },
  pin: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 2.5, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, elevation: 4, maxWidth: 120 },
  pinScore: { fontSize: 12, fontWeight: '900' },
  attribution: { position: 'absolute', bottom: 8, left: 8, backgroundColor: 'rgba(15,23,42,0.8)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  attributionText: { fontSize: 10, color: '#64748b' },
  card: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#1e293b', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36, borderTopWidth: 1, borderColor: '#334155', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  cardName: { fontSize: 17, fontWeight: '800', color: '#f8fafc' },
  cardLabel: { fontSize: 13, fontWeight: '600', marginTop: 3 },
  scoreBox: { marginLeft: 12 },
  score: { fontSize: 28, fontWeight: '900' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  verifiedBadge: { fontSize: 11, fontWeight: '700', backgroundColor: '#134e4a', color: '#2dd4bf', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  badge: { fontSize: 11, fontWeight: '600', backgroundColor: '#0f2744', color: '#7dd3fc', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  buttons: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, backgroundColor: '#0d9488', borderRadius: 10, padding: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  btnOutline: { flex: 1, borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1.5, borderColor: '#334155' },
  btnOutlineText: { color: '#94a3b8', fontWeight: '700', fontSize: 13 },
  btnClose: { backgroundColor: '#334155', borderRadius: 10, padding: 12, alignItems: 'center', paddingHorizontal: 16 },
  btnCloseText: { color: '#94a3b8', fontWeight: '700', fontSize: 13 },
});