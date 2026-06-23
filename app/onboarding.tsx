import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Colors, getRatingColor } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

const ONBOARDING_KEY = '@gottago/onboarding_complete';

const DEMO_REGION = {
  latitude: 33.7903,
  longitude: -84.3733,
  latitudeDelta: 0.008,
  longitudeDelta: 0.008,
};

const DEMO_PINS = [
  { latitude: 33.7915, longitude: -84.3718, score: 4.8 },
  { latitude: 33.7890, longitude: -84.3748, score: 3.2 },
];

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

const FEATURES = [
  {
    icon: 'location' as const,
    title: 'Find restrooms near you',
    description: 'Community-rated spots within 5 miles, sorted by distance.',
  },
  {
    icon: 'star' as const,
    title: 'Know before you go',
    description: 'Real cleanliness scores from real people. No surprises.',
  },
  {
    icon: 'create-outline' as const,
    title: 'Help your community',
    description: 'Add bathrooms and leave reviews to build the resource.',
  },
];

function PreviewCard() {
  const greenColor = getRatingColor(4.8);
  const amberColor = getRatingColor(3.2);

  return (
    <View style={styles.previewCard}>
      <MapView
        style={styles.previewMap}
        initialRegion={DEMO_REGION}
        customMapStyle={DARK_MAP_STYLE}
        provider="google"
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        pointerEvents="none"
      >
        {DEMO_PINS.map((pin, i) => (
          <Marker key={i} coordinate={{ latitude: pin.latitude, longitude: pin.longitude }}>
            <View style={[styles.previewPin, { backgroundColor: getRatingColor(pin.score) }]}>
              <Text style={styles.previewPinText}>{pin.score.toFixed(1)}</Text>
            </View>
          </Marker>
        ))}
      </MapView>
      <View style={styles.previewBody}>
        <Text style={styles.previewLabel}>★ CLOSEST TO YOU</Text>
        <Text style={styles.previewName}>Piedmont Park Pavilion</Text>
        <View style={styles.previewMeta}>
          <Text style={styles.previewMetaText}>350 ft · Spotless</Text>
          <View style={[styles.previewRatingChip, { backgroundColor: greenColor + '22', borderColor: greenColor + '55' }]}>
            <Text style={[styles.previewRatingText, { color: greenColor }]}>4.8</Text>
          </View>
        </View>
        <View style={styles.previewActions}>
          <View style={styles.previewDirectionsBtn}>
            <Ionicons name="navigate" size={14} color={Colors.onBrand} />
            <Text style={styles.previewDirectionsBtnText}>Directions</Text>
          </View>
          <View style={styles.previewDetailsBtn}>
            <Text style={styles.previewDetailsBtnText}>Details</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function OnboardingScreen() {
  function getStarted() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    router.replace('/login');
  }

  return (
    <View style={styles.container}>
      {/* Logo — same as login */}
      <Image
        source={require('../assets/images/GottaGo_logo_cropped.png')}
        style={styles.logo}
        resizeMode="contain"
      />

      {/* Preview card */}
      <PreviewCard />

      {/* Features */}
      <View style={styles.features}>
        {FEATURES.map((f, i) => (
          <View key={i} style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <Ionicons name={f.icon} size={18} color={Colors.brand} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureDesc}>{f.description}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Button */}
      <TouchableOpacity style={styles.btn} onPress={getStarted}>
        <Text style={styles.btnText}>Get Started</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 48,
    justifyContent: 'space-between',
  },

  logo: { width: 260, height: 90, alignSelf: 'center', marginTop: '15%' },

  // Preview card
  previewCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  previewMap: { height: 160 },
  previewPin: { borderRadius: 99, paddingHorizontal: 6, paddingVertical: 3, borderWidth: 1.5, borderColor: Colors.bg },
  previewPinText: { fontSize: 10, fontWeight: '800', color: Colors.bg },
  previewBody: { padding: 16 },
  previewLabel: { fontSize: 11, fontWeight: '800', color: Colors.brand, letterSpacing: 1, marginBottom: 4 },
  previewName: { fontSize: 17, fontWeight: '800', color: Colors.text, letterSpacing: -0.4, marginBottom: 6 },
  previewMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  previewMetaText: { fontSize: 13, color: Colors.textMuted, fontWeight: '500', flex: 1 },
  previewRatingChip: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1 },
  previewRatingText: { fontSize: 13, fontWeight: '800' },
  previewActions: { flexDirection: 'row', gap: 10 },
  previewDirectionsBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.brand, borderRadius: 12, paddingVertical: 11, shadowColor: Colors.brand, shadowOpacity: 0.4, shadowRadius: 8, elevation: 4 },
  previewDirectionsBtnText: { fontSize: 13, fontWeight: '700', color: Colors.onBrand },
  previewDetailsBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 11, borderWidth: 1, borderColor: Colors.border },
  previewDetailsBtnText: { fontSize: 13, fontWeight: '700', color: Colors.textMuted },

  // Features
  features: { gap: 32 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  featureIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: Colors.brandTintBg, borderWidth: 1, borderColor: Colors.brand + '33', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  featureText: { flex: 1, paddingTop: 1 },
  featureTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 3, letterSpacing: -0.2 },
  featureDesc: { fontSize: 12, color: Colors.textMuted, fontWeight: '500', lineHeight: 20 },

  // Button
  btn: {
    backgroundColor: Colors.brand,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: Colors.brand,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  btnText: { color: Colors.onBrand, fontWeight: '800', fontSize: 16 },
});
