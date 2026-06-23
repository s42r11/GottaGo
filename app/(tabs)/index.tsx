import { Ionicons } from '@expo/vector-icons';
import { Colors, getRatingColor, getRatingLabel } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import { signOut } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Linking, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
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


const FILTER_OPTIONS = [
  { key: 'free', label: 'Free' },
  { key: 'accessible', label: 'Accessible' },
  { key: 'babyChanging', label: 'Baby Changing' },
  { key: 'genderNeutral', label: 'Gender Neutral' },
  { key: 'verified', label: 'Verified' },
];

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
        <View style={styles.skeletonChip} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={styles.skeletonTitle} />
          <View style={styles.skeletonSubtitle} />
        </View>
      </View>
      <View style={styles.skeletonBadgesRow}>
        <View style={styles.skeletonBadge} />
        <View style={styles.skeletonBadge} />
      </View>
    </Animated.View>
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
      const lastKnown = await Location.getLastKnownPositionAsync({});
      if (lastKnown && !cancelled) {
        setUserLocation({ latitude: lastKnown.coords.latitude, longitude: lastKnown.coords.longitude });
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (!cancelled) {
        setUserLocation({ latitude: current.coords.latitude, longitude: current.coords.longitude });
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
    .filter(b => userLocation ? b.distanceMiles <= 5 : true)
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

  const heroBathroom = sortBy === 'nearest' && filtered.length > 0 ? filtered[0] : null;
  const listBathrooms = heroBathroom ? filtered.slice(1) : filtered;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.logo}>
            GottaGo<Text style={styles.logoDot}>.</Text>
          </Text>
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}>
              <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconBtn, filtersExpanded && styles.iconBtnActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setFiltersExpanded(!filtersExpanded);
              }}>
              <Ionicons name="options-outline" size={18} color={filtersExpanded ? Colors.onBrand : Colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={async () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (auth.currentUser) await signOut(auth);
              router.replace('/login');
            }}>
              <Ionicons name="log-out-outline" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.locationRow}>
          <Ionicons name="location" size={12} color={Colors.brand} />
          <Text style={styles.locationText}>
            {locationDenied ? 'Location off' : 'Near you'} · 5 mi radius
          </Text>
          {!loading && (
            <Text style={styles.countText}>· {filtered.length} found</Text>
          )}
        </View>
      </View>

      {/* Filter panel */}
      {filtersExpanded && (
        <View style={styles.filterPanel}>
          <Text style={styles.filterPanelLabel}>FILTERS</Text>
          <View style={styles.filterPillsGrid}>
            {FILTER_OPTIONS.map(f => {
              const active = filters.includes(f.key);
              return (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => toggleFilter(f.key)}>
                  {active && <Ionicons name="checkmark" size={12} color={Colors.brand} style={{ marginRight: 4 }} />}
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {filters.length > 0 && (
            <TouchableOpacity onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setFilters([]);
            }} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>Clear all</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Sort segmented control */}
      <View style={styles.sortRow}>
        <TouchableOpacity
          style={[styles.sortSegment, sortBy === 'nearest' && styles.sortSegmentActive]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setSortBy('nearest');
          }}>
          <Text style={[styles.sortSegmentText, sortBy === 'nearest' && styles.sortSegmentTextActive]}>
            Nearest
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortSegment, sortBy === 'highest' && styles.sortSegmentActive]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setSortBy('highest');
          }}>
          <Text style={[styles.sortSegmentText, sortBy === 'highest' && styles.sortSegmentTextActive]}>
            Top Rated
          </Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={{ padding: 20, gap: 12 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.brand}
            colors={[Colors.brand]}
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
                <Text style={styles.emptySubtext}>You could be the first to add one in your neighborhood.</Text>
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
                  <Text style={styles.emptyBtnText}>Add the First One</Text>
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

            {/* Hero card — nearest result */}
            {heroBathroom && (
              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.heroCard}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push({ pathname: '/bathroom-detail', params: { bathroomId: heroBathroom.id } });
                }}>
                <MapView
                  style={styles.heroMap}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  rotateEnabled={false}
                  pitchEnabled={false}
                  pointerEvents="none"
                  initialRegion={{
                    latitude: heroBathroom.latitude,
                    longitude: heroBathroom.longitude,
                    latitudeDelta: 0.003,
                    longitudeDelta: 0.003,
                  }}
                  customMapStyle={DARK_MAP_STYLE}>
                  <Marker coordinate={{ latitude: heroBathroom.latitude, longitude: heroBathroom.longitude }}>
                    <View style={[styles.heroPin, { backgroundColor: getRatingColor(heroBathroom.cleanliness) }]}>
                      <Text style={styles.heroPinText}>
                        {heroBathroom.cleanliness === 0 ? 'New' : heroBathroom.cleanliness.toFixed(1)}
                      </Text>
                    </View>
                  </Marker>
                </MapView>

                <View style={styles.heroBody}>
                  <Text style={styles.heroLabel}>★ CLOSEST TO YOU</Text>
                  <Text style={styles.heroName} numberOfLines={1}>{heroBathroom.name}</Text>
                  <View style={styles.heroMeta}>
                    <Text style={styles.heroMetaText} numberOfLines={1}>
                      {heroBathroom.distance}
                      {heroBathroom.cleanliness > 0 ? ` · ${getRatingLabel(heroBathroom.cleanliness)}` : ''}
                    </Text>
                    {heroBathroom.cleanliness > 0 && (
                      <View style={[styles.heroRatingChip, { backgroundColor: getRatingColor(heroBathroom.cleanliness) + '22', borderColor: getRatingColor(heroBathroom.cleanliness) + '55' }]}>
                        <Text style={[styles.heroRatingText, { color: getRatingColor(heroBathroom.cleanliness) }]}>
                          {heroBathroom.cleanliness.toFixed(1)}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.heroActions}>
                    <TouchableOpacity
                      style={styles.heroDirectionsBtn}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${heroBathroom.latitude},${heroBathroom.longitude}`);
                      }}>
                      <Ionicons name="navigate" size={14} color={Colors.onBrand} />
                      <Text style={styles.heroDirectionsBtnText}>Directions</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.heroDetailsBtn}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        router.push({ pathname: '/bathroom-detail', params: { bathroomId: heroBathroom.id } });
                      }}>
                      <Text style={styles.heroDetailsBtnText}>Details</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            )}

            {/* Regular list cards */}
            {listBathrooms.map(b => {
              const ratingColor = getRatingColor(b.cleanliness);
              return (
                <TouchableOpacity
                  key={b.id}
                  style={styles.card}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    router.push({ pathname: '/bathroom-detail', params: { bathroomId: b.id } });
                  }}>
                  <View style={styles.cardInner}>
                    <View style={[styles.ratingChip, { backgroundColor: ratingColor + '22', borderColor: ratingColor + '55' }]}>
                      <Text style={[styles.ratingChipNum, { color: ratingColor }]}>
                        {b.cleanliness === 0 ? '—' : b.cleanliness.toFixed(1)}
                      </Text>
                      {b.cleanliness > 0 && <Ionicons name="star" size={9} color={ratingColor} />}
                    </View>
                    <View style={styles.cardCenter}>
                      <Text style={styles.cardName} numberOfLines={1}>{b.name}</Text>
                      <Text style={styles.cardMeta} numberOfLines={1}>
                        {b.distance}
                        {b.reviewCount > 0 ? ` · ${b.reviewCount} reviews` : ''}
                      </Text>
                      <View style={styles.amenityRow}>
                        {b.verified && (
                          <View style={styles.verifiedChip}>
                            <Ionicons name="checkmark" size={10} color={Colors.brand} />
                            <Text style={styles.verifiedChipText}>Verified</Text>
                          </View>
                        )}
                        {b.accessible && <View style={styles.amenityChip}><Text style={styles.amenityChipText}>Accessible</Text></View>}
                        {b.free && <View style={styles.amenityChip}><Text style={styles.amenityChipText}>Free</Text></View>}
                        {b.babyChanging && <View style={styles.amenityChip}><Text style={styles.amenityChipText}>Baby</Text></View>}
                        {b.genderNeutral && <View style={styles.amenityChip}><Text style={styles.amenityChipText}>Neutral</Text></View>}
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={Colors.textFainter} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}
      </ScrollView>

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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  // Header
  header: { backgroundColor: Colors.surface, paddingTop: 56, paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  logo: { fontSize: 26, fontWeight: '800', color: Colors.text, letterSpacing: -0.4 },
  logoDot: { color: Colors.brand },
  headerIcons: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  iconBtnActive: { backgroundColor: Colors.brand },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { fontSize: 12, color: Colors.textFaint, fontWeight: '500' },
  countText: { fontSize: 12, color: Colors.textFainter, fontWeight: '500' },

  // Filter panel
  filterPanel: { backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingHorizontal: 20, paddingVertical: 14 },
  filterPanelLabel: { fontSize: 11, fontWeight: '800', color: Colors.textFainter, marginBottom: 10, letterSpacing: 1 },
  filterPillsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: { flexDirection: 'row', alignItems: 'center', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceInput },
  filterChipActive: { backgroundColor: Colors.brandTintBg, borderColor: Colors.brand + '66' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  filterChipTextActive: { color: Colors.brand },
  clearBtn: { alignSelf: 'flex-start', marginTop: 10 },
  clearBtnText: { fontSize: 12, color: Colors.textFaint, fontWeight: '600' },

  // Sort segmented control
  sortRow: { flexDirection: 'row', backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingHorizontal: 20, paddingVertical: 10, gap: 8 },
  sortSegment: { flex: 1, borderRadius: 99, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceInput },
  sortSegmentActive: { backgroundColor: Colors.brand, borderColor: Colors.brand },
  sortSegmentText: { fontSize: 13, fontWeight: '700', color: Colors.textMuted },
  sortSegmentTextActive: { color: Colors.onBrand },

  list: { flex: 1 },

  // Skeleton
  skeletonCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.border },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  skeletonChip: { width: 44, height: 52, backgroundColor: Colors.border, borderRadius: 10 },
  skeletonTitle: { height: 14, backgroundColor: Colors.border, borderRadius: 8, marginBottom: 8, width: '60%' },
  skeletonSubtitle: { height: 11, backgroundColor: Colors.border, borderRadius: 8, width: '40%' },
  skeletonBadgesRow: { flexDirection: 'row', gap: 6, marginLeft: 56 },
  skeletonBadge: { height: 20, width: 64, backgroundColor: Colors.border, borderRadius: 99 },

  // Empty states
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 8, letterSpacing: -0.4 },
  emptySubtext: { fontSize: 14, color: Colors.textMuted, marginBottom: 24, textAlign: 'center' },
  emptyBtn: { backgroundColor: Colors.brand, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 },
  emptyBtnText: { color: Colors.onBrand, fontWeight: '700', fontSize: 15 },

  // Hero card
  heroCard: { backgroundColor: Colors.surface, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  heroMap: { height: 92, width: '100%' },
  heroBody: { padding: 16 },
  heroLabel: { fontSize: 11, fontWeight: '800', color: Colors.brand, letterSpacing: 1, marginBottom: 4 },
  heroName: { fontSize: 17, fontWeight: '800', color: Colors.text, letterSpacing: -0.4, marginBottom: 6 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  heroMetaText: { fontSize: 13, color: Colors.textMuted, fontWeight: '500', flex: 1 },
  heroRatingChip: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1 },
  heroRatingText: { fontSize: 13, fontWeight: '800' },
  heroActions: { flexDirection: 'row', gap: 10 },
  heroDirectionsBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.brand, borderRadius: 12, paddingVertical: 11, shadowColor: Colors.brand, shadowOpacity: 0.4, shadowRadius: 8, elevation: 4 },
  heroDirectionsBtnText: { fontSize: 13, fontWeight: '700', color: Colors.onBrand },
  heroDetailsBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 11, borderWidth: 1, borderColor: Colors.border },
  heroDetailsBtnText: { fontSize: 13, fontWeight: '700', color: Colors.textMuted },
  heroPin: { borderRadius: 99, paddingHorizontal: 7, paddingVertical: 4 },
  heroPinText: { fontSize: 11, fontWeight: '800', color: Colors.onBrand },

  // Regular cards
  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.border },
  cardInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ratingChip: { width: 44, height: 52, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 2, flexShrink: 0 },
  ratingChipNum: { fontSize: 15, fontWeight: '800' },
  cardCenter: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '700', color: Colors.text, letterSpacing: -0.2, marginBottom: 3 },
  cardMeta: { fontSize: 12, color: Colors.textFaint, fontWeight: '500', marginBottom: 6 },
  amenityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  verifiedChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.brandTintBg, borderRadius: 99, paddingHorizontal: 7, paddingVertical: 3 },
  verifiedChipText: { fontSize: 10, fontWeight: '700', color: Colors.brand },
  amenityChip: { borderRadius: 99, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: Colors.border },
  amenityChipText: { fontSize: 10, fontWeight: '600', color: Colors.textFaint },

});
