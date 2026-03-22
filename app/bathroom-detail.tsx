import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { addDoc, collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Linking,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
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

function AnimatedBar({ cleanliness }: { cleanliness: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  const targetWidth = cleanliness === 0 ? 0 : (Math.round(cleanliness) / 5) * 100;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: targetWidth,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [targetWidth]);

  return (
    <View style={styles.barBg}>
      <Animated.View style={[styles.barFill, {
        width: anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
        backgroundColor: cleanliness === 0 ? '#1e293b' : getColor(cleanliness),
      }]} />
    </View>
  );
}

const STAR_LABELS = ['', 'Terrible 😱', 'Bad 👎', 'OK 😐', 'Good 👍', 'Spotless ✨'];

export default function BathroomDetailScreen() {
  const { bathroomId } = useLocalSearchParams<{ bathroomId: string }>();
  const [bathroom, setBathroom] = useState<Bathroom | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [distance, setDistance] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reported, setReported] = useState<Set<string>>(new Set());

  useFocusEffect(useCallback(() => {
    async function load() {
      const snap = await getDoc(doc(db, 'bathrooms', bathroomId));
      if (!snap.exists()) return;
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
    load();
  }, [bathroomId]));

  if (loading || !bathroom) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  async function submitReport(type: 'bathroom' | 'review', reviewId?: string, reportedContent?: string) {
    if (!auth.currentUser) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Sign In Required',
        'You need an account to report content. It helps us keep reports accountable.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => router.push({ pathname: '/login', params: { returnTo: bathroom.id } }) },
        ]
      );
      return;
    }
    const key = reviewId ?? 'bathroom';
    if (reported.has(key)) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setReported(prev => new Set(prev).add(key));
    await addDoc(collection(db, 'reports'), {
      bathroomId: bathroom.id,
      bathroomName: bathroom.name,
      type,
      reviewId: reviewId ?? null,
      reportedContent: reportedContent ?? null,
      reportedBy: auth.currentUser.uid,
      createdAt: new Date().toISOString(),
    });
  }

  const amenities = [
    bathroom.accessible && '♿ Accessible',
    bathroom.genderNeutral && '⚧ Gender Neutral',
    bathroom.free && '🆓 Free',
    bathroom.babyChanging && '👶 Baby Changing',
    bathroom.singleStall && '🚪 Single Stall',
  ].filter(Boolean) as string[];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.back();
        }} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => submitReport('bathroom')} style={styles.reportBtn}>
          <Text style={styles.reportText}>
            {reported.has('bathroom') ? 'Reported ✓' : 'Report listing'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Name + address */}
      <Text style={styles.name}>{bathroom.name}</Text>
      {bathroom.address ? (
        <TouchableOpacity onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(bathroom.address)}`);
        }}>
          <Text style={styles.address}>📍 <Text style={styles.addressLink}>{bathroom.address}</Text></Text>
        </TouchableOpacity>
      ) : null}
      {bathroom.floor ? <Text style={styles.floor}>{bathroom.floor}</Text> : null}

      {/* Score card */}
      <View style={styles.scoreCard}>
        <View style={styles.scoreRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.stars, { color: bathroom.cleanliness === 0 ? '#475569' : getColor(bathroom.cleanliness) }]}>
              {bathroom.cleanliness === 0 ? 'Not yet rated' : renderStars(bathroom.cleanliness)}
            </Text>
            <Text style={[styles.scoreLabel, { color: bathroom.cleanliness === 0 ? '#475569' : getColor(bathroom.cleanliness) }]}>
              {bathroom.cleanliness === 0
                ? 'Be the first to leave a review'
                : `${getLabel(bathroom.cleanliness)} · ${bathroom.reviewCount} review${bathroom.reviewCount === 1 ? '' : 's'}`}
            </Text>
          </View>
          {bathroom.cleanliness > 0 && (
            <Text style={[styles.bigScore, { color: getColor(bathroom.cleanliness) }]}>
              {bathroom.cleanliness.toFixed(1)}
            </Text>
          )}
        </View>
        <AnimatedBar cleanliness={bathroom.cleanliness} />

        <View style={styles.metaRow}>
          {bathroom.verified
            ? <Text style={styles.verifiedBadge}>✓ Verified</Text>
            : <Text style={styles.unverifiedBadge}>Unverified</Text>}
          {bathroom.verified && !isNaN(new Date(bathroom.lastCleaned).getTime()) && (
            <Text style={styles.metaText}>Last reviewed {formatLastVerified(bathroom.lastCleaned)}</Text>
          )}
          {distance && <Text style={styles.metaText}>📍 {distance}</Text>}
        </View>
      </View>

      {/* Amenities */}
      {amenities.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>AMENITIES</Text>
          <View style={styles.badges}>
            {amenities.map(a => (
              <Text key={a} style={styles.badge}>{a}</Text>
            ))}
          </View>
        </View>
      )}

      {/* Action buttons */}
      <View style={styles.buttons}>
        <TouchableOpacity
          style={styles.btn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            if (!auth.currentUser) {
              router.push('/login');
            } else {
              router.push({ pathname: '/review', params: { bathroomId: bathroom.id, bathroomName: bathroom.name } });
            }
          }}>
          <Text style={styles.btnText}>✍️ Review</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btnOutline}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${bathroom.latitude},${bathroom.longitude}`);
          }}>
          <Text style={styles.btnOutlineText}>🗺 Directions</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btnOutline}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Share.share({
              message: `Check out ${bathroom.name} on GottaGo!\ngottago://bathroom-detail?bathroomId=${bathroom.id}`,
            });
          }}>
          <Text style={styles.btnOutlineText}>🔗 Share</Text>
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
                <Text style={styles.reviewStars}>{renderStars(r.rating)}</Text>
                <Text style={styles.reviewMeta}>
                  {r.userEmail ? `${r.userEmail.split('@')[0].substring(0, 4)}••••` : 'Anonymous'}  ·  {formatReviewDate(r.createdAt)}
                </Text>
              </View>
              <Text style={styles.reviewRatingLabel}>{STAR_LABELS[r.rating]}</Text>
              {r.comment ? <Text style={styles.reviewComment}>{r.comment}</Text> : null}
              <TouchableOpacity
                onPress={() => submitReport('review', r.id, r.comment)}
                style={styles.reportReviewBtn}>
                <Text style={styles.reportReviewText}>
                  {reported.has(r.id) ? 'Reported ✓' : 'Report review'}
                </Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111111' },
  inner: { padding: 24, paddingBottom: 60 },
  loadingContainer: { flex: 1, backgroundColor: '#111111', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#888888', fontSize: 15, fontWeight: '600' },
  header: { marginTop: 40, marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: { alignSelf: 'flex-start' },
  backText: { fontSize: 15, color: '#facc15', fontWeight: '600' },
  reportBtn: { alignSelf: 'flex-start' },
  reportText: { fontSize: 12, color: '#555555', fontWeight: '600' },
  reportReviewBtn: { alignSelf: 'flex-end', marginTop: 8 },
  reportReviewText: { fontSize: 11, color: '#555555', fontWeight: '600' },
  name: { fontSize: 26, fontWeight: '900', color: '#f8fafc', marginBottom: 6 },
  address: { fontSize: 14, color: '#facc15', marginBottom: 2 },
  addressLink: { textDecorationLine: 'underline' },
  floor: { fontSize: 13, color: '#555555', marginBottom: 20 },
  scoreCard: { backgroundColor: '#1c1c1c', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#2a2a2a' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  stars: { fontSize: 20, fontWeight: '900', marginBottom: 4 },
  scoreLabel: { fontSize: 13, fontWeight: '600' },
  bigScore: { fontSize: 40, fontWeight: '900', marginLeft: 12 },
  barBg: { height: 6, backgroundColor: '#2a2a2a', borderRadius: 99, marginBottom: 14, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 99 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  verifiedBadge: { fontSize: 11, fontWeight: '700', backgroundColor: '#2a2000', color: '#facc15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  unverifiedBadge: { fontSize: 11, fontWeight: '700', backgroundColor: '#1c1c1c', color: '#555555', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, borderWidth: 1, borderColor: '#2a2a2a' },
  metaText: { fontSize: 12, color: '#888888', fontWeight: '500' },
  section: { marginBottom: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#555555', letterSpacing: 1, marginBottom: 12 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { fontSize: 13, fontWeight: '600', backgroundColor: '#1e1a00', color: '#facc15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99 },
  buttons: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  btn: { flex: 1, backgroundColor: '#facc15', borderRadius: 12, padding: 14, alignItems: 'center', shadowColor: '#facc15', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  btnText: { color: '#111111', fontWeight: '700', fontSize: 14 },
  btnOutline: { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1.5, borderColor: '#2a2a2a' },
  btnOutlineText: { color: '#aaaaaa', fontWeight: '700', fontSize: 14 },
  noReviews: { fontSize: 14, color: '#555555', fontWeight: '500' },
  reviewCard: { backgroundColor: '#1c1c1c', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#2a2a2a' },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  reviewStars: { fontSize: 15, color: '#facc15' },
  reviewMeta: { fontSize: 11, color: '#aaaaaa', fontWeight: '500' },
  reviewRatingLabel: { fontSize: 12, fontWeight: '700', color: '#888888', marginBottom: 6 },
  reviewComment: { fontSize: 14, color: '#aaaaaa', lineHeight: 21 },
});
