import { Ionicons } from '@expo/vector-icons';
import { Colors, getRatingColor, getRatingLabel } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import { collection, getDocs } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { auth, db } from '../../firebaseConfig';
import { formatDistance, getDistanceMiles } from '../../utils/distance';
import { fetchAndSeedNearbyBathrooms } from '../../utils/overpass';

type Bathroom = {
  id: string;
  name: string;
  address: string;
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

const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#3b3f48' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#242424' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#565c69' }] },
  { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#4d5360' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#2b3a4a' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#37492f' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#4a4a4a' }] },
];

export default function MapScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [bathrooms, setBathrooms] = useState<Bathroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const mapRef = useRef<MapView>(null);
  const hasSeededRef = useRef(false);
  const hasInitializedMapRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (!cancelled) setErrorMsg('Permission to access location was denied');
          return;
        }
        const lastKnown = await Location.getLastKnownPositionAsync({});
        if (lastKnown && !cancelled) setLocation(lastKnown);
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!cancelled) setLocation(current);
      } catch (e) {
        console.log('Location error:', e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!location || hasSeededRef.current) return;
    hasSeededRef.current = true;
    fetchAndSeedNearbyBathrooms(location.coords.latitude, location.coords.longitude);
  }, [location]);

  useFocusEffect(
    React.useCallback(() => {
      async function fetchBathrooms() {
        setTracksViewChanges(true);
        try {
          const snapshot = await getDocs(collection(db, 'bathrooms'));
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Bathroom[];
          setBathrooms(data);
          setTimeout(() => setTracksViewChanges(false), 500);
          if (location && !hasInitializedMapRef.current) {
            hasInitializedMapRef.current = true;
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
  const selectedDistance = selectedBathroom && location
    ? formatDistance(getDistanceMiles(
        location.coords.latitude, location.coords.longitude,
        selectedBathroom.latitude, selectedBathroom.longitude
      ))
    : null;

  if (errorMsg) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="location-outline" size={56} color={Colors.textFainter} style={{ marginBottom: 16 }} />
        <Text style={styles.errorTitle}>Location Required</Text>
        <Text style={styles.errorSubtext}>
          Please enable location permission in your device settings to use the map.
        </Text>
      </View>
    );
  }

  if (loading || !initialRegion) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.brand} />
        <Text style={styles.loadingText}>Finding your location...</Text>
      </View>
    );
  }

  if (!loading && bathrooms.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={{ fontSize: 56, marginBottom: 16 }}>🚽</Text>
        <Text style={styles.errorTitle}>No restrooms here yet</Text>
        <Text style={styles.errorSubtext}>You could be the first to add one in your neighborhood.</Text>
        <TouchableOpacity
          style={styles.emptyBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            if (!auth.currentUser) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert(
                'Sign In Required',
                'You need an account to add a bathroom.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Sign In', onPress: () => router.push('/login') },
                ]
              );
            } else {
              router.push('/add-bathroom');
            }
          }}>
          <Text style={styles.emptyBtnText}>Add a Bathroom</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        provider="google"
        customMapStyle={DARK_MAP_STYLE}
        onPress={() => setSelected(null)}
      >
        {bathrooms.map(b => {
          const isSelected = selected === b.id;
          const pinColor = getRatingColor(b.cleanliness);
          return (
            <Marker
              key={b.id}
              coordinate={{ latitude: b.latitude, longitude: b.longitude }}
              tracksViewChanges={tracksViewChanges}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setSelected(b.id);
              }}
            >
              <View style={styles.pinContainer}>
                <View style={[
                  styles.pinCircle,
                  { backgroundColor: pinColor },
                  isSelected && styles.pinCircleSelected,
                ]}>
                  <Text style={[styles.pinNum, isSelected && styles.pinNumSelected]}>
                    {b.cleanliness === 0 ? 'New' : b.cleanliness.toFixed(1)}
                  </Text>
                </View>
                <View style={[styles.pinTail, { backgroundColor: pinColor }]} />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Floating top bar */}
      <View style={styles.topBar}>
        <View style={styles.searchField}>
          <Ionicons name="search-outline" size={15} color={Colors.textFaint} />
          <Text style={styles.searchPlaceholder}>Search this area</Text>
        </View>
        <TouchableOpacity style={styles.topBarIconBtn} onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}>
          <Ionicons name="options-outline" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Near Me button */}
      <TouchableOpacity style={styles.nearMeBtn} onPress={zoomToNearMe}>
        <Ionicons name="location" size={15} color={Colors.onBrand} />
        <Text style={styles.nearMeText}>Near Me</Text>
      </TouchableOpacity>

      {/* OSM Attribution */}
      <View style={styles.attribution}>
        <Text style={styles.attributionText}>© OpenStreetMap Contributors</Text>
      </View>

      {/* Bottom sheet */}
      {selectedBathroom && (
        <View style={styles.sheet}>

          <View style={styles.sheetTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetName} numberOfLines={1}>{selectedBathroom.name}</Text>
              <Text style={styles.sheetMeta} numberOfLines={1}>
                {selectedBathroom.cleanliness > 0 ? `${getRatingLabel(selectedBathroom.cleanliness)} · ` : ''}
                {selectedBathroom.reviewCount > 0 ? `${selectedBathroom.reviewCount} reviews` : 'No reviews yet'}
                {selectedDistance ? ` · ${selectedDistance}` : ''}
              </Text>
            </View>
            {selectedBathroom.cleanliness > 0 && (
              <View style={[styles.sheetRatingChip, {
                backgroundColor: getRatingColor(selectedBathroom.cleanliness) + '22',
                borderColor: getRatingColor(selectedBathroom.cleanliness) + '55',
              }]}>
                <Text style={[styles.sheetRatingNum, { color: getRatingColor(selectedBathroom.cleanliness) }]}>
                  {selectedBathroom.cleanliness.toFixed(1)}
                </Text>
                <Ionicons name="star" size={10} color={getRatingColor(selectedBathroom.cleanliness)} />
              </View>
            )}
            <TouchableOpacity
              style={styles.sheetCloseBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelected(null);
              }}>
              <Ionicons name="close" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Amenity chips */}
          <View style={styles.sheetAmenities}>
            {selectedBathroom.verified && (
              <View style={styles.verifiedChip}>
                <Ionicons name="checkmark" size={10} color={Colors.brand} />
                <Text style={styles.verifiedChipText}>Verified</Text>
              </View>
            )}
            {selectedBathroom.accessible && <View style={styles.amenityChip}><Text style={styles.amenityChipText}>Accessible</Text></View>}
            {selectedBathroom.free && <View style={styles.amenityChip}><Text style={styles.amenityChipText}>Free</Text></View>}
            {selectedBathroom.babyChanging && <View style={styles.amenityChip}><Text style={styles.amenityChipText}>Baby</Text></View>}
            {selectedBathroom.genderNeutral && <View style={styles.amenityChip}><Text style={styles.amenityChipText}>Neutral</Text></View>}
          </View>

          {/* Action buttons */}
          <View style={styles.sheetButtons}>
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push({ pathname: '/bathroom-detail', params: { bathroomId: selectedBathroom.id } });
              }}>
              <Text style={styles.btnPrimaryText}>View Details</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btnOutline}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${selectedBathroom.latitude},${selectedBathroom.longitude}`);
              }}>
              <Ionicons name="navigate" size={14} color={Colors.textMuted} />
              <Text style={styles.btnOutlineText}>Go</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  // Loading / error states
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg, paddingHorizontal: 40 },
  loadingText: { marginTop: 12, fontSize: 14, color: Colors.textMuted, fontWeight: '600' },
  errorTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 8, letterSpacing: -0.4 },
  errorSubtext: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', marginBottom: 24 },
  emptyBtn: { backgroundColor: Colors.brand, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 },
  emptyBtnText: { color: Colors.onBrand, fontWeight: '700', fontSize: 15 },

  map: { flex: 1 },

  // Floating top bar
  topBar: { position: 'absolute', top: 56, left: 16, right: 16, flexDirection: 'row', gap: 10, alignItems: 'center' },
  searchField: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surface + 'ee', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border },
  searchPlaceholder: { fontSize: 14, color: Colors.textFainter, fontWeight: '500' },
  topBarIconBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: Colors.surface + 'ee', borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },

  // Near Me button
  nearMeBtn: { position: 'absolute', top: 112, right: 16, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.brand, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, shadowColor: Colors.brand, shadowOpacity: 0.5, shadowRadius: 10, elevation: 5 },
  nearMeText: { fontSize: 13, fontWeight: '700', color: Colors.onBrand },

  // Attribution
  attribution: { position: 'absolute', bottom: 8, left: 8, backgroundColor: Colors.bg + 'cc', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  attributionText: { fontSize: 10, color: Colors.textFainter },

  // Pins
  pinContainer: { alignItems: 'center' },
  pinCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.bg, elevation: 4 },
  pinCircleSelected: { borderWidth: 2.5, borderColor: '#ffffff', elevation: 8 },
  pinNum: { fontSize: 10, fontWeight: '800', color: Colors.bg },
  pinNumSelected: {},
  pinTail: { width: 10, height: 10, transform: [{ rotate: '45deg' }], marginTop: -7, elevation: 3 },

  // Bottom sheet
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36, borderTopWidth: 1, borderColor: Colors.border, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 20, elevation: 8 },
  sheetTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  sheetName: { fontSize: 17, fontWeight: '800', color: Colors.text, letterSpacing: -0.4, marginBottom: 4 },
  sheetMeta: { fontSize: 13, color: Colors.textMuted, fontWeight: '500' },
  sheetRatingChip: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, alignItems: 'center', gap: 2, marginRight: 8 },
  sheetCloseBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  sheetRatingNum: { fontSize: 16, fontWeight: '800' },
  sheetAmenities: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  verifiedChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.brandTintBg, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4 },
  verifiedChipText: { fontSize: 10, fontWeight: '700', color: Colors.brand },
  amenityChip: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: Colors.border },
  amenityChipText: { fontSize: 10, fontWeight: '600', color: Colors.textFaint },
  sheetButtons: { flexDirection: 'row', gap: 10 },
  btnPrimary: { flex: 1, backgroundColor: Colors.brand, borderRadius: 12, paddingVertical: 12, alignItems: 'center', shadowColor: Colors.brand, shadowOpacity: 0.4, shadowRadius: 8, elevation: 4 },
  btnPrimaryText: { color: Colors.onBrand, fontWeight: '700', fontSize: 14 },
  btnOutline: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20, borderWidth: 1, borderColor: Colors.border },
  btnOutlineText: { color: Colors.textMuted, fontWeight: '700', fontSize: 14 },
});
