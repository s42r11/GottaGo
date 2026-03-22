import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import { signOut } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../firebaseConfig';
import { formatDistance, formatLastVerified, getDistanceMiles } from '../../utils/distance';

type Bathroom = {
  id: string;
  name: string;
  address: string;
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

const FILTER_OPTIONS = [
  { key: 'free', label: '🆓', fullLabel: '🆓 Free' },
  { key: 'accessible', label: '♿', fullLabel: '♿ Accessible' },
  { key: 'babyChanging', label: '👶', fullLabel: '👶 Baby Changing' },
  { key: 'genderNeutral', label: '⚧', fullLabel: '⚧ Neutral' },
  { key: 'verified', label: '✓', fullLabel: '✓ Verified' },
];

const PREVIEW_FILTERS = FILTER_OPTIONS.slice(0, 3);
const EXTRA_FILTERS = FILTER_OPTIONS.slice(3);

type SortOption = 'nearest' | 'highest';

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

export default function HomeScreen() {
  const [bathrooms, setBathrooms] = useState<Bathroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<string[]>([]);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('nearest');

  function toggleFilter(filter: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFilters(prev =>
      prev.includes(filter) ? prev.filter(f => f !== filter) : [...prev, filter]
    );
  }

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
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    await fetchBathrooms();
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (!cancelled) setLocationDenied(true);
        return;
      }
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

  const bathroomsWithDistance = bathrooms.map(b => {
    const distanceMiles = userLocation
      ? getDistanceMiles(userLocation.latitude, userLocation.longitude, b.latitude, b.longitude)
      : 999;
    return {
      ...b,
      distanceMiles,
      distance: userLocation ? formatDistance(distanceMiles) : locationDenied ? 'Location off' : 'Locating...',
    };
  });

  const filtered = bathroomsWithDistance
    .filter(b => {
      if (filters.length === 0) return true;
      return filters.every(f => {
        if (f === 'accessible') return b.accessible;
        if (f === 'genderNeutral') return b.genderNeutral;
        if (f === 'free') return b.free;
        if (f === 'babyChanging') return b.babyChanging;
        if (f === 'verified') return b.verified;
        return true;
      });
    })
    .sort((a, b) => {
      if (sortBy === 'nearest') return a.distanceMiles - b.distanceMiles;
      if (sortBy === 'highest') return b.cleanliness - a.cleanliness;
      return 0;
    });

  useFocusEffect(
    useCallback(() => {
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

      {/* Single control row — sort + filters */}
      <View style={styles.controlRow}>
        {/* Sort pills */}
        <TouchableOpacity
          style={[styles.sortPill, sortBy === 'nearest' && styles.sortPillActive]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setSortBy('nearest');
          }}>
          <Text style={[styles.sortPillText, sortBy === 'nearest' && styles.sortPillTextActive]}>
            📍 Nearest
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortPill, sortBy === 'highest' && styles.sortPillActive]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setSortBy('highest');
          }}>
          <Text style={[styles.sortPillText, sortBy === 'highest' && styles.sortPillTextActive]}>
            ⭐ Top Rated
          </Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Filter pills — icon only */}
        {PREVIEW_FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterPill, filters.includes(f.key) && styles.filterPillActive]}
            onPress={() => toggleFilter(f.key)}>
            <Text style={styles.filterPillIcon}>{f.label}</Text>
          </TouchableOpacity>
        ))}

        {/* More button */}
        <TouchableOpacity
          style={[styles.filterMoreBtn, (filtersExpanded || extraActiveCount > 0) && styles.filterMoreBtnActive]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setFiltersExpanded(!filtersExpanded);
          }}>
          <Text style={[styles.filterMoreText, (filtersExpanded || extraActiveCount > 0) && styles.filterMoreTextActive]}>
            {filtersExpanded ? '✕' : `⚙${extraActiveCount > 0 ? ` ${extraActiveCount}` : ''}`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Expanded extra filters */}
      {filtersExpanded && (
        <View style={styles.filterPanel}>
          <Text style={styles.filterPanelLabel}>FILTERS</Text>
          <View style={styles.filterPillsGrid}>
            {FILTER_OPTIONS.map(f => (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterPillFull, filters.includes(f.key) && styles.filterPillActive]}
                onPress={() => toggleFilter(f.key)}>
                <Text style={[styles.filterPillFullText, filters.includes(f.key) && styles.filterPillTextActive]}>
                  {f.fullLabel}
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
      <ScrollView
        style={styles.list}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#0d9488"
            colors={['#0d9488']}
          />
        }>
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            {filtered.length === 0 && bathrooms.length === 0 && (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>🗺️</Text>
                <Text style={styles.emptyText}>No restrooms here yet</Text>
                <Text style={styles.emptySubtext}>You could be the first to add one in your neighborhood. Every great community starts somewhere!</Text>
                <TouchableOpacity
                  style={styles.emptyBtn}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    if (!auth.currentUser) {
                      router.push('/login');
                    } else {
                      router.push('/add-bathroom');
                    }
                  }}>
                  <Text style={styles.emptyBtnText}>+ Add the First One</Text>
                </TouchableOpacity>
              </View>
            )}
            {filtered.length === 0 && bathrooms.length > 0 && (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>🚽</Text>
                <Text style={styles.emptyText}>No restrooms match your filters</Text>
                <Text style={styles.emptySubtext}>Try loosening your filters to see more results.</Text>
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
                style={styles.card}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push({ pathname: '/bathroom-detail', params: { bathroomId: b.id } });
                }}
              >
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardName}>{b.name}</Text>
                    <Text style={styles.cardSub}>📍 {b.distance}  ·  ✓ {formatLastVerified(b.lastCleaned)}</Text>
                  </View>
                  <View style={styles.scoreBox}>
                    <Text style={[styles.score, { color: b.cleanliness === 0 ? '#475569' : getColor(b.cleanliness) }]}>
                      {b.cleanliness === 0 ? 'New' : renderStars(b.cleanliness)}
                    </Text>
                    <Text style={[styles.scoreLabel, { color: b.cleanliness === 0 ? '#475569' : getColor(b.cleanliness) }]}>
                      {b.cleanliness === 0 ? 'Not yet rated' : `${getLabel(b.cleanliness)} · ${b.reviewCount || 0} reviews`}
                    </Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </View>

                <AnimatedBar cleanliness={b.cleanliness} />

                <View style={styles.badges}>
                  {b.verified && <Text style={styles.verifiedBadge}>✓ Verified</Text>}
                  {b.accessible && <Text style={styles.badge}>♿ Accessible</Text>}
                  {b.genderNeutral && <Text style={styles.badge}>⚧ Neutral</Text>}
                  {b.free && <Text style={styles.badge}>🆓 Free</Text>}
                  {b.babyChanging && <Text style={styles.badge}>👶 Baby</Text>}
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111111' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111111' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#888888', fontWeight: '600' },
  header: { backgroundColor: '#1c1c1c', padding: 20, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: '#2a2a2a', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logo: { fontSize: 26, fontWeight: '800', color: '#facc15' },
  subtitle: { fontSize: 13, color: '#888888', marginTop: 2 },
  headerButtons: { flexDirection: 'row', gap: 8 },
  addBtn: { backgroundColor: '#facc15', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { fontSize: 13, fontWeight: '700', color: '#111111' },
  signOutBtn: { backgroundColor: '#2a2a2a', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  signOutText: { fontSize: 13, fontWeight: '700', color: '#aaaaaa' },
  controlRow: { backgroundColor: '#1c1c1c', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#2a2a2a', gap: 6 },
  sortPill: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1.5, borderColor: '#2a2a2a', backgroundColor: '#111111' },
  sortPillActive: { backgroundColor: '#facc15', borderColor: '#facc15' },
  sortPillText: { fontSize: 11, fontWeight: '700', color: '#888888' },
  sortPillTextActive: { color: '#111111' },
  divider: { width: 1, height: 20, backgroundColor: '#2a2a2a', marginHorizontal: 2 },
  filterPill: { borderRadius: 99, paddingHorizontal: 9, paddingVertical: 6, borderWidth: 1.5, borderColor: '#2a2a2a', backgroundColor: '#111111' },
  filterPillActive: { backgroundColor: '#facc15', borderColor: '#facc15' },
  filterPillIcon: { fontSize: 13 },
  filterMoreBtn: { borderRadius: 99, paddingHorizontal: 9, paddingVertical: 6, borderWidth: 1.5, borderColor: '#2a2a2a', backgroundColor: '#111111', marginLeft: 'auto' },
  filterMoreBtnActive: { backgroundColor: '#facc15', borderColor: '#facc15' },
  filterMoreText: { fontSize: 11, fontWeight: '700', color: '#888888' },
  filterMoreTextActive: { color: '#111111' },
  filterPanel: { backgroundColor: '#1c1c1c', borderBottomWidth: 1, borderBottomColor: '#2a2a2a', padding: 16 },
  filterPanelLabel: { fontSize: 11, fontWeight: '800', color: '#555555', marginBottom: 10, letterSpacing: 1 },
  filterPillsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  filterPillFull: { borderRadius: 99, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1.5, borderColor: '#2a2a2a', backgroundColor: '#111111' },
  filterPillFullText: { fontSize: 12, fontWeight: '700', color: '#888888' },
  filterPillTextActive: { color: '#111111' },
  clearBtn: { alignSelf: 'flex-start', marginTop: 4 },
  clearBtnText: { fontSize: 12, color: '#f43f5e', fontWeight: '700' },
  list: { flex: 1 },
  skeletonCard: { backgroundColor: '#1c1c1c', borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: '#2a2a2a' },
  skeletonRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  skeletonTitle: { height: 16, backgroundColor: '#2a2a2a', borderRadius: 8, marginBottom: 8, width: '60%' },
  skeletonSubtitle: { height: 12, backgroundColor: '#2a2a2a', borderRadius: 8, width: '40%' },
  skeletonScore: { width: 44, height: 44, backgroundColor: '#2a2a2a', borderRadius: 8, marginLeft: 12 },
  skeletonBar: { height: 6, backgroundColor: '#2a2a2a', borderRadius: 99, marginBottom: 10 },
  skeletonBadgesRow: { flexDirection: 'row', gap: 6 },
  skeletonBadge: { height: 22, width: 80, backgroundColor: '#2a2a2a', borderRadius: 99 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#f8fafc', marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: '#888888', marginBottom: 24, textAlign: 'center' },
  emptyBtn: { backgroundColor: '#facc15', borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 },
  emptyBtnText: { color: '#111111', fontWeight: '700', fontSize: 15 },
  card: { backgroundColor: '#1c1c1c', borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: '#2a2a2a' },
  cardSelected: { borderColor: '#facc15' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  cardName: { fontSize: 15, fontWeight: '700', color: '#f8fafc' },
  cardSub: { fontSize: 12, color: '#555555', marginTop: 3 },
  scoreBox: { alignItems: 'flex-end', marginLeft: 12 },
  chevron: { fontSize: 20, color: '#2a2a2a', marginLeft: 8, alignSelf: 'center' },
  score: { fontSize: 16, fontWeight: '900' },
  scoreLabel: { fontSize: 10, fontWeight: '700' },
  barBg: { height: 6, backgroundColor: '#2a2a2a', borderRadius: 99, marginBottom: 10, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 99 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  verifiedBadge: { fontSize: 11, fontWeight: '700', backgroundColor: '#2a2000', color: '#facc15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  badge: { fontSize: 11, fontWeight: '600', backgroundColor: '#1e1a00', color: '#facc15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  detail: { marginTop: 14, flexDirection: 'row', gap: 8 },
  btn: { flex: 1, backgroundColor: '#facc15', borderRadius: 10, padding: 12, alignItems: 'center' },
  btnText: { color: '#111111', fontWeight: '700', fontSize: 13 },
  btnOutline: { flex: 1, borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1.5, borderColor: '#2a2a2a' },
  btnOutlineText: { color: '#aaaaaa', fontWeight: '700', fontSize: 13 },
});