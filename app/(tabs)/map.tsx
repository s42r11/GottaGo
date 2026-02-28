import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

const BATHROOMS = [
  { id: 1, name: "Whole Foods Market", cleanliness: 4.7, free: true, accessible: true, babyChanging: true, genderNeutral: false, coordinate: { latitude: 33.7748, longitude: -84.3642 } },
  { id: 2, name: "Starbucks - Peachtree Rd", cleanliness: 3.9, free: true, accessible: true, babyChanging: false, genderNeutral: true, coordinate: { latitude: 33.7765, longitude: -84.3598 } },
  { id: 3, name: "Chamblee City Park", cleanliness: 2.8, free: true, accessible: true, babyChanging: false, genderNeutral: false, coordinate: { latitude: 33.7712, longitude: -84.3678 } },
  { id: 4, name: "Nordstrom - Perimeter Mall", cleanliness: 4.9, free: true, accessible: true, babyChanging: true, genderNeutral: false, coordinate: { latitude: 33.7801, longitude: -84.3556 } },
  { id: 5, name: "McDonald's - Buford Hwy", cleanliness: 2.1, free: true, accessible: true, babyChanging: false, genderNeutral: false, coordinate: { latitude: 33.7698, longitude: -84.3721 } },
];

function getColor(score: number) {
  if (score >= 4.5) return '#16a34a';
  if (score >= 3.5) return '#d97706';
  return '#dc2626';
}

function getLabel(score: number) {
  if (score >= 4.5) return 'Spotless ✨';
  if (score >= 3.5) return 'Decent 👍';
  return 'Rough 👎';
}

export default function MapScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }
      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);
    })();
  }, []);

  const initialRegion = {
    latitude: location?.coords.latitude ?? 33.7748,
    longitude: location?.coords.longitude ?? -84.3642,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  const selectedBathroom = BATHROOMS.find(b => b.id === selected);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>🚽 GottaGo</Text>
        <Text style={styles.subtitle}>
          {errorMsg ?? (location ? '📍 Using your location' : '📍 Finding your location...')}
        </Text>
      </View>

      {/* Map */}
      <MapView
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={true}
        showsMyLocationButton={true}
        provider="google"
      >
        {BATHROOMS.map(b => (
          <Marker
            key={b.id}
            coordinate={b.coordinate}
            onPress={() => setSelected(b.id)}
          >
            <View style={[styles.pin, { borderColor: getColor(b.cleanliness) }]}>
              <Text style={[styles.pinScore, { color: getColor(b.cleanliness) }]}>
                {b.cleanliness.toFixed(1)}
              </Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Bottom detail card */}
      {selectedBathroom && (
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardName}>{selectedBathroom.name}</Text>
              <Text style={[styles.cardLabel, { color: getColor(selectedBathroom.cleanliness) }]}>
                {getLabel(selectedBathroom.cleanliness)}
              </Text>
            </View>
            <View style={styles.scoreBox}>
              <Text style={[styles.score, { color: getColor(selectedBathroom.cleanliness) }]}>
                {selectedBathroom.cleanliness.toFixed(1)}
              </Text>
            </View>
          </View>

          <View style={styles.badges}>
            {selectedBathroom.accessible && <Text style={styles.badge}>♿ Accessible</Text>}
            {selectedBathroom.genderNeutral && <Text style={styles.badge}>⚧ Neutral</Text>}
            {selectedBathroom.free && <Text style={styles.badge}>🆓 Free</Text>}
            {selectedBathroom.babyChanging && <Text style={styles.badge}>👶 Baby</Text>}
          </View>

          <View style={styles.buttons}>
            <TouchableOpacity style={styles.btn}>
              <Text style={styles.btnText}>✍️ Leave a Review</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnOutline} onPress={() => setSelected(null)}>
              <Text style={styles.btnOutlineText}>✕ Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { backgroundColor: '#fff', padding: 20, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  logo: { fontSize: 26, fontWeight: '800', color: '#0f172a' },
  subtitle: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  map: { flex: 1 },
  pin: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 2.5, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, elevation: 4 },
  pinScore: { fontSize: 13, fontWeight: '900' },
  card: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderRadius: 20, padding: 20, paddingBottom: 36, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  cardName: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  cardLabel: { fontSize: 13, fontWeight: '600', marginTop: 3 },
  scoreBox: { marginLeft: 12 },
  score: { fontSize: 28, fontWeight: '900' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  badge: { fontSize: 11, fontWeight: '600', backgroundColor: '#e0f2fe', color: '#0369a1', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  buttons: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, backgroundColor: '#0f172a', borderRadius: 10, padding: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  btnOutline: { flex: 1, borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 2, borderColor: '#e2e8f0' },
  btnOutlineText: { color: '#64748b', fontWeight: '700', fontSize: 13 },
});