import { router, useFocusEffect } from 'expo-router';
import { signOut } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';
import React, { useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../firebaseConfig';

type Bathroom = {
  id: string;
  name: string;
  distance: string;
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

export default function HomeScreen() {
  const [selected, setSelected] = useState<string | null>(null);
  const [bathrooms, setBathrooms] = useState<Bathroom[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0d9488" />
        <Text style={styles.loadingText}>Finding restrooms near you...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>🚽 GottaGo</Text>
          <Text style={styles.subtitle}>Restrooms near you · {bathrooms.length} found</Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            onPress={() => {
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
            await signOut(auth);
            router.replace('/login');
          }} style={styles.signOutBtn}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* List */}
      <ScrollView style={styles.list} contentContainerStyle={{ padding: 16, gap: 12 }}>
        {bathrooms.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🚽</Text>
            <Text style={styles.emptyText}>No restrooms found nearby</Text>
            <Text style={styles.emptySubtext}>Be the first to add one!</Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => {
                if (!auth.currentUser) {
                  router.push('/login');
                } else {
                  router.push('/add-bathroom');
                }
              }}>
              <Text style={styles.emptyBtnText}>+ Add a Bathroom</Text>
            </TouchableOpacity>
          </View>
        )}
        {bathrooms.map(b => (
          <TouchableOpacity
            key={b.id}
            style={[styles.card, selected === b.id && styles.cardSelected]}
            onPress={() => setSelected(selected === b.id ? null : b.id)}
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

            {/* Cleanliness bar */}
            <View style={styles.barBg}>
              <View style={[styles.barFill, {
                width: b.cleanliness === 0 ? '0%' : `${(b.cleanliness / 5) * 100}%`,
                backgroundColor: b.cleanliness === 0 ? '#1e293b' : getColor(b.cleanliness)
              }]} />
            </View>

            {/* Amenities */}
            <View style={styles.badges}>
              {b.verified && <Text style={styles.verifiedBadge}>✓ Verified</Text>}
              {b.accessible && <Text style={styles.badge}>♿ Accessible</Text>}
              {b.genderNeutral && <Text style={styles.badge}>⚧ Neutral</Text>}
              {b.free && <Text style={styles.badge}>🆓 Free</Text>}
              {b.babyChanging && <Text style={styles.badge}>👶 Baby</Text>}
            </View>

            {/* Expanded detail */}
            {selected === b.id && (
              <View style={styles.detail}>
                <TouchableOpacity
                  style={styles.btn}
                  onPress={() => {
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
                    const url = `https://www.google.com/maps/dir/?api=1&destination=${b.latitude},${b.longitude}`;
                    Linking.openURL(url);
                  }}>
                  <Text style={styles.btnOutlineText}>🗺 Directions</Text>
                </TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>
        ))}
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
  list: { flex: 1 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#f8fafc', marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: '#64748b', marginBottom: 24 },
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