import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import { collection, getDocs } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
  if (score >= 4.5) return 'rgba(250, 204, 21, 0.9)';
  if (score >= 3.5) return 'rgba(250, 204, 21, 0.65)';
  return 'rgba(250, 204, 21, 0.45)';
}

function getLabel(score: number) {
  if (score >= 4.5) return 'Spotless';
  if (score >= 3.5) return 'Decent';
  return 'Rough';
}

function renderStars(score: number): string {
  const filled = Math.round(score);
  return '★'.repeat(filled) + '☆'.repeat(5 - filled);
}

export default function MapScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [bathrooms, setBathrooms] = useState<Bathroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (!cancelled) setErrorMsg('Permission to access location was denied');
        return;
      }
      const lastKnown = await Location.getLastKnownPositionAsync({});
      if (lastKnown && !cancelled) {
        setLocation(lastKnown);
      }
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (!cancelled) {
        setLocation(current);
        await fetchAndSeedNearbyBathrooms(
          current.coords.latitude,
          current.coords.longitude
        );
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      async function fetchBathrooms() {
        setTracksViewChanges(true);
        try {
          const snapshot = await getDocs(collection(db, 'bathrooms'));
          const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Bathroom[];
          setBathrooms(data);
          setTimeout(() => setTracksViewChanges(false), 500);
          if (location) {
            setTimeout(() => {
              mapRef.current?.animateToRegion({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              }, 600);
            }, 500);
          }
        } catch (error) {
          console.error('Error fetching bathrooms:', error);
        } finally {
          setLoading(false);
        }
      }
      fetchBathrooms();
    }, [location])
  );

  function zoomToNearMe() {
    if (!location) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    mapRef.current?.animateToRegion({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }, 600);
  }

  const initialRegion = location ? {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  } : null;

  const selectedBathroom = bathrooms.find(b => b.id === selected);

  if (errorMsg) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={{ fontSize: 56, marginBottom: 16 }}>📍</Text>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#f8fafc', marginBottom: 8 }}>Location Required</Text>
        <Text style={{ fontSize: 14, color: '#64748b', textAlign: 'center', paddingHorizontal: 40 }}>
          Please enable location permission in your device settings to use the map.
        </Text>
      </View>
    );
  }

  if (loading || !initialRegion) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0d9488" />
        <Text style={styles.loadingText}>Finding your location...</Text>
      </View>
    );
  }

  if (!loading && bathrooms.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={{ fontSize: 56, marginBottom: 16 }}>🚽</Text>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#f8fafc', marginBottom: 8 }}>No restrooms here yet</Text>
        <Text style={{ fontSize: 14, color: '#64748b', marginBottom: 24, textAlign: 'center', paddingHorizontal: 40 }}>You could be the first to add one in your neighborhood. Every great community starts somewhere!</Text>
        <TouchableOpacity
          style={{ backgroundColor: '#0d9488', borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 }}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            if (!auth.currentUser) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert(
                'Sign In Required',
                'You need an account to add a bathroom. It helps us keep listings trustworthy.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Sign In', onPress: () => router.push('/login') },
                ]
              );
            } else {
              router.push('/add-bathroom');
            }
          }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>+ Add a Bathroom</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>🚽 GottaGo</Text>
          <Text style={styles.subtitle}>
            {errorMsg ?? (location ? '📍 Using your location' : '📍 Finding your location...')}
          </Text>
        </View>
        <TouchableOpacity onPress={zoomToNearMe} style={styles.nearMeBtn}>
          <Text style={styles.nearMeBtnText}>📍 Near Me</Text>
        </TouchableOpacity>
      </View>

      <MapView
        ref={mapRef}
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
            tracksViewChanges={tracksViewChanges}

            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setSelected(b.id);
            }}
          >
            {b.cleanliness === 0 ? (
              <View style={styles.pinDotOuter}>
                <View style={styles.pinDotInner} />
              </View>
            ) : (
              <View style={[styles.pinOuter, { backgroundColor: getColor(b.cleanliness) }]}>
                <View style={[styles.pinInner, { backgroundColor: '#0f172a' }]}>
                  <Text style={[styles.pinScore, { color: getColor(b.cleanliness) }]}>
                    {b.cleanliness.toFixed(1)}
                  </Text>
                </View>
              </View>
            )}
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
                {selectedBathroom.cleanliness === 0 ? 'New' : renderStars(selectedBathroom.cleanliness)}
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
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push({ pathname: '/bathroom-detail', params: { bathroomId: selectedBathroom.id } });
              }}>
              <Text style={styles.btnText}>View Details</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btnOutline}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                const url = `https://www.google.com/maps/dir/?api=1&destination=${selectedBathroom.latitude},${selectedBathroom.longitude}`;
                Linking.openURL(url);
              }}>
              <Text style={styles.btnOutlineText}>🗺 Directions</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnClose} onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelected(null);
            }}>
              <Text style={styles.btnCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111111' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111111' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#888888', fontWeight: '600' },
  header: { backgroundColor: '#1c1c1c', padding: 20, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: '#2a2a2a', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nearMeBtn: { backgroundColor: '#facc15', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  nearMeBtnText: { fontSize: 12, fontWeight: '700', color: '#111111' },
  logo: { fontSize: 26, fontWeight: '800', color: '#facc15' },
  subtitle: { fontSize: 13, color: '#888888', marginTop: 2 },
  map: { flex: 1 },
  pinOuter: { borderRadius: 10, padding: 2.5, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
  pinInner: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  pinScore: { fontSize: 11, fontWeight: '900' },
  pinDotOuter: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#888888', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
  pinDotInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#1c1c1c' },
  attribution: { position: 'absolute', bottom: 8, left: 8, backgroundColor: 'rgba(17,17,17,0.8)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  attributionText: { fontSize: 10, color: '#888888' },
  card: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#1c1c1c', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36, borderTopWidth: 1, borderColor: '#2a2a2a', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  cardName: { fontSize: 17, fontWeight: '800', color: '#f8fafc' },
  cardLabel: { fontSize: 13, fontWeight: '600', marginTop: 3 },
  scoreBox: { marginLeft: 12 },
  score: { fontSize: 18, fontWeight: '900' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  verifiedBadge: { fontSize: 11, fontWeight: '700', backgroundColor: '#2a2000', color: '#facc15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  badge: { fontSize: 11, fontWeight: '600', backgroundColor: '#1e1a00', color: '#facc15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  buttons: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, backgroundColor: '#facc15', borderRadius: 10, padding: 12, alignItems: 'center' },
  btnText: { color: '#111111', fontWeight: '700', fontSize: 13 },
  btnOutline: { flex: 1, borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1.5, borderColor: '#2a2a2a' },
  btnOutlineText: { color: '#aaaaaa', fontWeight: '700', fontSize: 13 },
  btnClose: { backgroundColor: '#2a2a2a', borderRadius: 10, padding: 12, alignItems: 'center', paddingHorizontal: 16 },
  btnCloseText: { color: '#aaaaaa', fontWeight: '700', fontSize: 13 },
});