import { Ionicons } from '@expo/vector-icons';
import { Colors, getRatingColor } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { addDoc, collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { auth, db } from '../firebaseConfig';
import { formatDistance, formatLastVerified, getDistanceMiles } from '../utils/distance';

type Bathroom = {
  id: string;
  name: string;
  address: string;
  floor: string;
  cleanliness: number;
  reviewCount: number;
  accessible: boolean;
  genderNeutral: boolean;
  free: boolean;
  babyChanging: boolean;
  singleStall: boolean;
  verified: boolean;
  lastCleaned: string;
  latitude: number;
  longitude: number;
};

type Review = {
  id: string;
  userId: string;
  userEmail: string;
  rating: number;
  comment: string;
  createdAt: string;
};

function renderStars(score: number): string {
  const filled = Math.round(score);
  return '★'.repeat(filled) + '☆'.repeat(5 - filled);
}

function formatReviewDate(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

function DistributionBars({ reviews }: { reviews: Review[] }) {
  const total = reviews.length;
  const bars = [5, 4, 3, 2, 1].map(star => ({
    star,
    pct: total > 0 ? (reviews.filter(r => r.rating === star).length / total) * 100 : 0,
    color: star >= 4 ? '#34d399' : star === 3 ? '#fbbf24' : '#f87171',
  }));

  return (
    <View style={{ gap: 5 }}>
      {bars.map(b => (
        <View key={b.star} style={styles.distRow}>
          <Text style={styles.distLabel}>{b.star}</Text>
          <View style={styles.distBarBg}>
            <View style={[styles.distBarFill, { width: `${b.pct}%`, backgroundColor: b.color }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

function AmenityCell({ label }: { label: string }) {
  return (
    <View style={styles.amenityCell}>
      <View style={styles.amenityCheck}>
        <Ionicons name="checkmark" size={10} color={Colors.brand} />
      </View>
      <Text style={styles.amenityCellText}>{label}</Text>
    </View>
  );
}

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

const STAR_LABELS = ['', 'Terrible 😱', 'Bad 👎', 'OK 😐', 'Good 👍', 'Spotless ✨'];

export default function BathroomDetailScreen() {
  const { bathroomId } = useLocalSearchParams<{ bathroomId: string }>();
  const [bathroom, setBathroom] = useState<Bathroom | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [distance, setDistance] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reported, setReported] = useState<Set<string>>(new Set());

  async function load() {
    const snap = await getDoc(doc(db, 'bathrooms', bathroomId));
    if (!snap.exists()) {
      setLoading(false);
      return;
    }
    const data = { id: snap.id, ...snap.data() } as Bathroom;
    setBathroom(data);

    const reviewSnap = await getDocs(query(collection(db, 'reviews'), where('bathroomId', '==', bathroomId)));
    const reviewData = reviewSnap.docs
      .map(d => ({ id: d.id, ...d.data() } as Review))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setReviews(reviewData);

    const loc = await Location.getLastKnownPositionAsync({});
    if (loc) {
      const miles = getDistanceMiles(loc.coords.latitude, loc.coords.longitude, data.latitude, data.longitude);
      setDistance(formatDistance(miles));
    }

    setLoading(false);
  }

  useFocusEffect(useCallback(() => { load(); }, [bathroomId]));

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function submitReport(type: 'bathroom' | 'review', reviewId?: string, reportedContent?: string) {
    if (!auth.currentUser) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Sign In Required',
        'You need an account to report content.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => router.push({ pathname: '/login', params: { returnTo: bathroom!.id } }) },
        ]
      );
      return;
    }
    const key = reviewId ?? 'bathroom';
    if (reported.has(key)) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setReported(prev => new Set(prev).add(key));
    await addDoc(collection(db, 'reports'), {
      bathroomId: bathroom!.id,
      bathroomName: bathroom!.name,
      type,
      reviewId: reviewId ?? null,
      reportedContent: reportedContent ?? null,
      reportedBy: auth.currentUser.uid,
      createdAt: new Date().toISOString(),
    });
  }

  if (loading || !bathroom) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const ratingColor = getRatingColor(bathroom.cleanliness);
  const hasAmenities = bathroom.accessible || bathroom.genderNeutral || bathroom.free || bathroom.babyChanging || bathroom.singleStall;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.inner}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brand} colors={[Colors.brand]} />}
      >
        {/* Map hero */}
        <View style={styles.mapHeroWrapper}>
          <MapView
            style={styles.mapHero}
            initialRegion={{
              latitude: bathroom.latitude,
              longitude: bathroom.longitude,
              latitudeDelta: 0.004,
              longitudeDelta: 0.004,
            }}
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
            <Marker coordinate={{ latitude: bathroom.latitude, longitude: bathroom.longitude }}>
              <View style={[styles.mapPin, { backgroundColor: ratingColor }]}>
                <Text style={styles.mapPinText}>
                  {bathroom.cleanliness === 0 ? 'New' : bathroom.cleanliness.toFixed(1)}
                </Text>
              </View>
            </Marker>
          </MapView>

          {/* Floating back button */}
          <TouchableOpacity
            style={styles.mapBackBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}>
            <Ionicons name="arrow-back" size={18} color={Colors.text} />
          </TouchableOpacity>

          {/* Floating report button */}
          <TouchableOpacity
            style={styles.mapReportBtn}
            onPress={() => submitReport('bathroom')}>
            <Ionicons
              name="flag-outline"
              size={16}
              color={reported.has('bathroom') ? Colors.brand : Colors.textMuted}
            />
          </TouchableOpacity>
        </View>

        {/* Name — overlaps map bottom */}
        <View style={styles.nameWrapper}>
          <Text style={styles.name}>{bathroom.name}</Text>
          {bathroom.address ? (
            <TouchableOpacity
              style={styles.addressRow}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(bathroom.address)}`);
              }}>
              <Ionicons name="location" size={13} color={Colors.brand} />
              <Text style={styles.addressLink}>{bathroom.address}</Text>
            </TouchableOpacity>
          ) : null}
          {bathroom.floor ? <Text style={styles.floor}>{bathroom.floor}</Text> : null}
        </View>

        {/* Rating card */}
        <View style={styles.ratingCard}>
          <View style={styles.ratingCardTop}>
            {/* Left: score + stars + count */}
            <View style={styles.ratingLeft}>
              <Text style={[styles.bigScore, { color: ratingColor }]}>
                {bathroom.cleanliness === 0 ? '—' : bathroom.cleanliness.toFixed(1)}
              </Text>
              <Text style={[styles.starGlyphs, { color: ratingColor }]}>
                {bathroom.cleanliness === 0 ? '☆☆☆☆☆' : renderStars(bathroom.cleanliness)}
              </Text>
              <Text style={styles.reviewCount}>
                {bathroom.reviewCount === 0 ? 'No reviews yet' : `${bathroom.reviewCount} review${bathroom.reviewCount === 1 ? '' : 's'}`}
              </Text>
            </View>

            {/* Vertical divider */}
            <View style={styles.dividerV} />

            {/* Right: distribution bars */}
            <View style={styles.ratingRight}>
              <DistributionBars reviews={reviews} />
            </View>
          </View>

          <View style={styles.dividerH} />

          {/* Meta row */}
          <View style={styles.metaRow}>
            {bathroom.verified ? (
              <View style={styles.verifiedChip}>
                <Ionicons name="checkmark" size={10} color={Colors.brand} />
                <Text style={styles.verifiedChipText}>Verified</Text>
              </View>
            ) : (
              <View style={styles.unverifiedChip}>
                <Text style={styles.unverifiedChipText}>Unverified</Text>
              </View>
            )}
            {bathroom.verified && bathroom.lastCleaned && bathroom.lastCleaned !== 'Unknown' && (
              <Text style={styles.metaText}>Reviewed {formatLastVerified(bathroom.lastCleaned)}</Text>
            )}
            {distance && <Text style={styles.metaText}>{distance} away</Text>}
          </View>
        </View>

        {/* Amenities */}
        {hasAmenities && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>AMENITIES</Text>
            <View style={styles.amenityGrid}>
              {bathroom.accessible && <AmenityCell label="Accessible" />}
              {bathroom.free && <AmenityCell label="Free" />}
              {bathroom.genderNeutral && <AmenityCell label="Gender Neutral" />}
              {bathroom.babyChanging && <AmenityCell label="Baby Changing" />}
              {bathroom.singleStall && <AmenityCell label="Single Stall" />}
            </View>
          </View>
        )}

        {/* Action row */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.reviewBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              if (!auth.currentUser) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                Alert.alert(
                  'Sign In Required',
                  'You need an account to leave a review.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Sign In', onPress: () => router.push({ pathname: '/login', params: { returnTo: bathroom.id } }) },
                  ]
                );
              } else {
                router.push({ pathname: '/review', params: { bathroomId: bathroom.id, bathroomName: bathroom.name } });
              }
            }}>
            <Ionicons name="create-outline" size={16} color={Colors.onBrand} />
            <Text style={styles.reviewBtnText}>Write a Review</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconActionBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${bathroom.latitude},${bathroom.longitude}`);
            }}>
            <Ionicons name="navigate" size={18} color={Colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconActionBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              Share.share({ message: `Check out ${bathroom.name} on GottaGo!\ngottago://bathroom-detail?bathroomId=${bathroom.id}` });
            }}>
            <Ionicons name="share-social-outline" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Reviews */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            {reviews.length === 0 ? 'NO REVIEWS YET' : `REVIEWS (${reviews.length})`}
          </Text>
          {reviews.length === 0 ? (
            <Text style={styles.noReviews}>Be the first to share your experience.</Text>
          ) : (
            reviews.map(r => (
              <View key={r.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <Text style={[styles.reviewStars, { color: getRatingColor(r.rating) }]}>
                    {renderStars(r.rating)}
                  </Text>
                  <Text style={styles.reviewMeta}>
                    {r.userEmail ? `${r.userEmail.split('@')[0].substring(0, 4)}••••` : 'Anonymous'} · {formatReviewDate(r.createdAt)}
                  </Text>
                </View>
                <Text style={styles.reviewLabel}>{STAR_LABELS[r.rating]}</Text>
                {r.comment ? <Text style={styles.reviewComment}>{r.comment}</Text> : null}
                <TouchableOpacity
                  onPress={() => submitReport('review', r.id, r.comment)}
                  style={styles.reportReviewBtn}>
                  <Ionicons name="flag-outline" size={11} color={reported.has(r.id) ? Colors.brand : Colors.textFainter} />
                  <Text style={[styles.reportReviewText, reported.has(r.id) && { color: Colors.brand }]}>
                    {reported.has(r.id) ? 'Reported' : 'Report'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  inner: { paddingBottom: 60 },
  loadingContainer: { flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: Colors.textMuted, fontSize: 15, fontWeight: '600' },

  // Map hero
  mapHeroWrapper: { position: 'relative' },
  mapHero: { height: 190, width: '100%' },
  mapPin: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 2, borderColor: Colors.bg },
  mapPinText: { fontSize: 12, fontWeight: '800', color: Colors.bg },
  mapBackBtn: {
    position: 'absolute', top: 48, left: 16,
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: Colors.surface + 'dd',
    borderWidth: 1, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  mapReportBtn: {
    position: 'absolute', top: 48, right: 16,
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: Colors.surface + 'dd',
    borderWidth: 1, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
  },

  // Name section
  nameWrapper: { paddingHorizontal: 20, marginTop: 20, marginBottom: 16 },
  name: { fontSize: 24, fontWeight: '800', color: Colors.text, letterSpacing: -0.4, marginBottom: 6 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
  addressLink: { fontSize: 13, color: Colors.brand, fontWeight: '600', textDecorationLine: 'underline' },
  floor: { fontSize: 12, color: Colors.textFainter, fontWeight: '500' },

  // Rating card
  ratingCard: { marginHorizontal: 20, marginBottom: 20, backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  ratingCardTop: { flexDirection: 'row', padding: 18, gap: 16, alignItems: 'center' },
  ratingLeft: { alignItems: 'flex-start', gap: 3 },
  bigScore: { fontSize: 42, fontWeight: '800', lineHeight: 46 },
  starGlyphs: { fontSize: 14, letterSpacing: 1 },
  reviewCount: { fontSize: 12, color: Colors.textFaint, fontWeight: '500' },
  dividerV: { width: 1, alignSelf: 'stretch', backgroundColor: Colors.border },
  ratingRight: { flex: 1 },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  distLabel: { fontSize: 10, color: Colors.textFaint, fontWeight: '600', width: 8, textAlign: 'right' },
  distBarBg: { flex: 1, height: 5, backgroundColor: Colors.border, borderRadius: 99, overflow: 'hidden' },
  distBarFill: { height: '100%', borderRadius: 99 },
  dividerH: { height: 1, backgroundColor: Colors.border },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: 14 },
  verifiedChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.brandTintBg, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4 },
  verifiedChipText: { fontSize: 11, fontWeight: '700', color: Colors.brand },
  unverifiedChip: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: Colors.border },
  unverifiedChipText: { fontSize: 11, fontWeight: '600', color: Colors.textFainter },
  metaText: { fontSize: 12, color: Colors.textFaint, fontWeight: '500' },

  // Sections
  section: { marginHorizontal: 20, marginBottom: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: Colors.textFainter, letterSpacing: 1, marginBottom: 12 },

  // Amenity grid
  amenityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  amenityCell: { width: '47%', flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.surface, borderRadius: 13, borderWidth: 1, borderColor: Colors.border, padding: 12 },
  amenityCheck: { width: 22, height: 22, borderRadius: 6, backgroundColor: Colors.brandTintBg, borderWidth: 1, borderColor: Colors.brand + '44', justifyContent: 'center', alignItems: 'center' },
  amenityCellText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted, flex: 1 },

  // Action row
  actions: { flexDirection: 'row', gap: 10, marginHorizontal: 20, marginBottom: 24 },
  reviewBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.brand, borderRadius: 13, paddingVertical: 14, shadowColor: Colors.brand, shadowOpacity: 0.4, shadowRadius: 8, elevation: 4 },
  reviewBtnText: { fontSize: 14, fontWeight: '700', color: Colors.onBrand },
  iconActionBtn: { width: 50, height: 50, borderRadius: 13, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },

  // Reviews
  noReviews: { fontSize: 14, color: Colors.textFainter, fontWeight: '500' },
  reviewCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  reviewStars: { fontSize: 14 },
  reviewMeta: { fontSize: 11, color: Colors.textMuted, fontWeight: '500' },
  reviewLabel: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, marginBottom: 6 },
  reviewComment: { fontSize: 14, color: Colors.textMuted, lineHeight: 21 },
  reportReviewBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end', marginTop: 10 },
  reportReviewText: { fontSize: 11, color: Colors.textFainter, fontWeight: '600' },
});
