import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import { signOut } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../firebaseConfig';
import { formatDistance, getDistanceMiles } from '../../utils/distance';

type Bathroom = {
  id: string;
  name: string;
  distance: string;
  distanceMiles: number;
  cleanliness: number;
  reviewCount: number;
  accessible: boolean;
  genderNeutral: boolean;
  free: boolean;
  babyChanging: boolean;
  lastCleaned: string;
  verified: boolean;
  latitude: number;
  longitude: number;
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

const FILTER_OPTIONS = [
  { key: 'accessible', label: '♿ Accessible' },
  { key: 'genderNeutral', label: '⚧ Neutral' },
  { key: 'free', label: '🆓 Free' },
  { key: 'babyChanging', label: '👶 Baby Changing' },
  { key: 'verified', label: '✓ Verified' },
];

const PREVIEW_FILTERS = FILTER_OPTIONS.slice(0, 3);
const EXTRA_FILTERS = FILTER_OPTIONS.slice(3);

function SkeletonCard() {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[styles.skeletonCard, { opacity: pulse }]}>
      <View style={styles.skeletonRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.skeletonTitle} />
          <View style={styles.skeletonSubtitle} />
        </View>
        <View style={styles.skeletonScore} />
      </View>
      <View style={styles.skeletonBar} />
      <View style={styles.skeletonBadgesRow}>
        <View style={styles.skeletonBadge} />
        <View style={styles.skeletonBadge} />
      </View>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const [selected, setSelected] = useState<string | null>(null);
  const [bathrooms, setBathrooms] = useState<Bathroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<string[]>([]);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  function toggleFilter(filter: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFilters(prev =>
      prev.includes(filter) ? prev.filter(f => f !== filter) : [...prev, filter]
    );
  }

  // Get user location with fast lastKnown fallback
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const lastKnown = await Location.getLastKnownPositionAsync({});
        if (lastKnown && !cancelled) {
          setUserLocation({
            latitude: lastKnown.coords.latitude,
            longitude: lastKnown.coords.longitude,
          });
        }
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!cancelled) {
          setUserLocation({
            latitude: current.coords.latitude,
            longitude: current.coords.longitude,
          });
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Recalculate distances when location or bathrooms change
  const bathroomsWithDistance = bathrooms.map(b => {
    const distanceMiles = userLocation
      ? getDistanceMiles(userLocation.latitude, userLocation.longitude, b.latitude, b.longitude)
      : 999;
    return {
      ...b,
      distanceMiles,
      distance: userLocation ? formatDistance(distanceMiles) : 'Locating...',
    };
  }).sort((a, b) => a.distanceMiles - b.distanceMiles);

  const filtered = bathroomsWithDistance.filter(b => {
    if (filters.length === 0) return true;
    return filters.every(f => {
      if (f === 'accessible') return b.accessible;
      if (f === 'genderNeutral') return b.genderNeutral;
      if (f === 'free') return b.free;
      if (f === 'babyChanging') return b.babyChanging;
      if (f === 'verified') return b.verified;
      return true;
    });
  });

  useFocusEffect(
    React.useCallback(() => {
      async function fetchBathrooms() {
        try {
          const snapshot = await getDocs(collection(db, 'bathrooms'));
          const data = snapshot.docs.map(doc => ({
            id: doc.id,
            distanceMiles: 999,
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

  const extraActiveCount = EXTRA_FILTERS.filter(f => filters.includes(f.key)).length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>🚽 GottaGo</Text>
          <Text style={styles.subtitle}>
            {loading ? 'Loading...' : `Restrooms near you · ${filtered.length} found`}
          </Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              if (!auth.currentUser) {
                router.push('/login');
              } else {
                router.push('/add-bathroom');
              }
            }}
            style={styles.addBtn}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            await signOut(auth);
            router.replace('/login');
          }} style={styles.signOutBtn}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter bar */}
      <View style={styles.filterBar}>
        {PREVIEW_FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterPill, filters.includes(f.key) && styles.filterPillActive]}
            onPress={() => toggleFilter(f.key)}>
            <Text style={[styles.filterPillText, filters.includes(f.key) && styles.filterPillTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.filterMoreBtn, (filtersExpanded || extraActiveCount > 0) && styles.filterMoreBtnActive]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setFiltersExpanded(!filtersExpanded);
          }}>
          <Text style={[styles.filterMoreText, (filtersExpanded || extraActiveCount > 0) && styles.filterMoreTextActive]}>
            {filtersExpanded ? '✕ Less' : `⚙ More${extraActiveCount > 0 ? ` (${extraActiveCount})` : ''}`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Expanded extra filters */}
      {filtersExpanded && (
        <View style={styles.filterPanel}>
          <View style={styles.filterPillsGrid}>
            {EXTRA_FILTERS.map(f => (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterPill, filters.includes(f.key) && styles.filterPillActive]}
                onPress={() => toggleFilter(f.key)}>
                <Text style={[styles.filterPillText, filters.includes(f.key) && styles.filterPillTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {filters.length > 0 && (
            <TouchableOpacity onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setFilters([]);
            }} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>Clear all filters</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Skeleton or List */}
      <ScrollView style={styles.list} contentContainerStyle={{ padding: 16, gap: 12 }}>
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            {filtered.length === 0 && (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>🚽</Text>
                <Text style={styles.emptyText}>No restrooms match your filters</Text>
                <Text style={styles.emptySubtext}>Try removing some filters or add one yourself!</Text>
                <TouchableOpacity
                  style={styles.emptyBtn}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setFilters([]);
                  }}>
                  <Text style={styles.emptyBtnText}>Clear Filters</Text>
                </TouchableOpacity>
              </View>
            )}
            {filtered.map(b => (
              <TouchableOpacity
                key={b.id}
                style={[styles.card, selected === b.id && styles.cardSelected]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setSelected(selected === b.id ? null : b.id);
                }}
              >
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardName}>{b.name}</Text>
                    <Text style={styles.cardSub}>📍 {b.distance}  ·  🧹 {b.lastCleaned}</Text>
                  </View>
                  <View style={styles.scoreBox}>
                    <Text style={[styles.score, { color: b.cleanliness === 0 ? '#475569' : getColor(b.cleanliness) }]}>
                      {b.cleanliness === 0 ? 'New' : b.cleanliness.toFixed(1)}
                    </Text>
                    <Text style={[styles.scoreLabel, { color: b.cleanliness === 0 ? '#475569' : getColor(b.cleanliness) }]}>
                      {b.cleanliness === 0 ? 'Not yet rated' : `${getLabel(b.cleanliness)} · ${b.reviewCount || 0} reviews`}
                    </Text>
                  </View>
                </View>

                <View style={styles.barBg}>
                  <View style={[styles.barFill, {
                    width: b.cleanliness === 0 ? '0%' : `${(b.cleanliness / 5) * 100}%`,
                    backgroundColor: b.cleanliness === 0 ? '#1e293b' : getColor(b.cleanliness)
                  }]} />
                </View>

                <View style={styles.badges}>
                  {b.verified && <Text style={styles.verifiedBadge}>✓ Verified</Text>}
                  {b.accessible && <Text style={styles.badge}>♿ Accessible</Text>}
                  {b.genderNeutral && <Text style={styles.badge}>⚧ Neutral</Text>}
                  {b.free && <Text style={styles.badge}>🆓 Free</Text>}
                  {b.babyChanging && <Text style={styles.badge}>👶 Baby</Text>}
                </View>

                {selected === b.id && (
                  <View style={styles.detail}>
                    <TouchableOpacity
                      style={styles.btn}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        if (!auth.currentUser) {
                          router.push('/login');
                        } else {
                          router.push({ pathname: '/review', params: { bathroomId: b.id, bathroomName: b.name } });
                        }
                      }}>
                      <Text style={styles.btnText}>✍️ Leave a Review</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.btnOutline}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        const url = `https://www.google.com/maps/dir/?api=1&destination=${b.latitude},${b.longitude}`;
                        Linking.openURL(url);
                      }}>
                      <Text style={styles.btnOutlineText}>🗺 Directions</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#64748b', fontWeight: '600' },
  header: { backgroundColor: '#1e293b', padding: 20, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: '#334155', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logo: { fontSize: 26, fontWeight: '800', color: '#f8fafc' },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
  headerButtons: { flexDirection: 'row', gap: 8 },
  addBtn: { backgroundColor: '#0d9488', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  signOutBtn: { backgroundColor: '#334155', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  signOutText: { fontSize: 13, fontWeight: '700', color: '#94a3b8' },
  filterBar: { backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#334155', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 8, justifyContent: 'space-between' },
  filterPill: { flex: 1, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 7, borderWidth: 1.5, borderColor: '#334155', backgroundColor: '#0f172a', alignItems: 'center' },
  filterPillActive: { backgroundColor: '#0d9488', borderColor: '#0d9488' },
  filterPillText: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  filterPillTextActive: { color: '#fff' },
  filterMoreBtn: { flex: 1, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 7, borderWidth: 1.5, borderColor: '#334155', backgroundColor: '#0f172a', alignItems: 'center' },
  filterMoreBtnActive: { backgroundColor: '#0d9488', borderColor: '#0d9488' },
  filterMoreText: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  filterMoreTextActive: { color: '#fff' },
  filterPanel: { backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#334155', padding: 16 },
  filterPillsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  clearBtn: { alignSelf: 'flex-start', marginTop: 4 },
  clearBtnText: { fontSize: 12, color: '#f43f5e', fontWeight: '700' },
  list: { flex: 1 },
  skeletonCard: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: '#334155' },
  skeletonRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  skeletonTitle: { height: 16, backgroundColor: '#334155', borderRadius: 8, marginBottom: 8, width: '60%' },
  skeletonSubtitle: { height: 12, backgroundColor: '#334155', borderRadius: 8, width: '40%' },
  skeletonScore: { width: 44, height: 44, backgroundColor: '#334155', borderRadius: 8, marginLeft: 12 },
  skeletonBar: { height: 6, backgroundColor: '#334155', borderRadius: 99, marginBottom: 10 },
  skeletonBadgesRow: { flexDirection: 'row', gap: 6 },
  skeletonBadge: { height: 22, width: 80, backgroundColor: '#334155', borderRadius: 99 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#f8fafc', marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: '#64748b', marginBottom: 24, textAlign: 'center' },
  emptyBtn: { backgroundColor: '#0d9488', borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  card: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: '#334155' },
  cardSelected: { borderColor: '#0d9488' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  cardName: { fontSize: 15, fontWeight: '700', color: '#f8fafc' },
  cardSub: { fontSize: 12, color: '#475569', marginTop: 3 },
  scoreBox: { alignItems: 'flex-end', marginLeft: 12 },
  score: { fontSize: 22, fontWeight: '900' },
  scoreLabel: { fontSize: 10, fontWeight: '700' },
  barBg: { height: 6, backgroundColor: '#334155', borderRadius: 99, marginBottom: 10, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 99 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  verifiedBadge: { fontSize: 11, fontWeight: '700', backgroundColor: '#134e4a', color: '#2dd4bf', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  badge: { fontSize: 11, fontWeight: '600', backgroundColor: '#0f2744', color: '#7dd3fc', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  detail: { marginTop: 14, flexDirection: 'row', gap: 8 },
  btn: { flex: 1, backgroundColor: '#0d9488', borderRadius: 10, padding: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  btnOutline: { flex: 1, borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1.5, borderColor: '#334155' },
  btnOutlineText: { color: '#94a3b8', fontWeight: '700', fontSize: 13 },
});