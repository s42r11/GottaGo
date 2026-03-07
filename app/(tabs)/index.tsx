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
  reviews: number;
  accessible: boolean;
  genderNeutral: boolean;
  free: boolean;
  babyChanging: boolean;
  lastCleaned: string;
};

function getColor(score: number) {
  if (score >= 4.5) return '#16a34a';
  if (score >= 3.5) return '#d97706';
  return '#dc2626';
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
  const [refreshKey, setRefreshKey] = useState(0);

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
        <ActivityIndicator size="large" color="#0ea5e9" />
        <Text style={styles.loadingText}>Finding restrooms near you...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>🚽 GottaGo</Text>
          <Text style={styles.subtitle}>Restrooms near you · {bathrooms.length} found</Text>
        </View>
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
            console.log('Signing out...');
            await signOut(auth);
            console.log('Signed out successfully');
            router.replace('/login');
          }} style={styles.signOutBtn}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={{ padding: 16, gap: 12 }}>
        {bathrooms.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>🚫 No restrooms found yet.</Text>
            <Text style={styles.emptySubtext}>Be the first to add one!</Text>
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
                <Text style={[styles.score, { color: getColor(b.cleanliness) }]}>{b.cleanliness.toFixed(1)}</Text>
                <Text style={[styles.scoreLabel, { color: getColor(b.cleanliness) }]}>{getLabel(b.cleanliness)}</Text>
              </View>
            </View>

            <View style={styles.barBg}>
              <View style={[styles.barFill, { width: `${(b.cleanliness / 5) * 100}%`, backgroundColor: getColor(b.cleanliness) }]} />
            </View>

            <View style={styles.badges}>
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
                  <Text style={styles.btnOutlineText}>🗺 Get Directions</Text>
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
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#64748b', fontWeight: '600' },
  header: { backgroundColor: '#fff', padding: 20, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logo: { fontSize: 26, fontWeight: '800', color: '#0f172a' },
  subtitle: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  list: { flex: 1 },
  empty: { alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 16, fontWeight: '700', color: '#64748b' },
  emptySubtext: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 2, borderColor: '#f1f5f9' },
  cardSelected: { borderColor: '#0ea5e9', backgroundColor: '#f0f9ff' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  cardName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  cardSub: { fontSize: 12, color: '#64748b', marginTop: 3 },
  scoreBox: { alignItems: 'flex-end', marginLeft: 12 },
  score: { fontSize: 22, fontWeight: '900' },
  scoreLabel: { fontSize: 10, fontWeight: '700' },
  barBg: { height: 6, backgroundColor: '#e5e7eb', borderRadius: 99, marginBottom: 10, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 99 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { fontSize: 11, fontWeight: '600', backgroundColor: '#e0f2fe', color: '#0369a1', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  detail: { marginTop: 14, flexDirection: 'row', gap: 8 },
  btn: { flex: 1, backgroundColor: '#0f172a', borderRadius: 10, padding: 11, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  btnOutline: { flex: 1, borderRadius: 10, padding: 11, alignItems: 'center', borderWidth: 2, borderColor: '#bae6fd', backgroundColor: '#f0f9ff' },
  btnOutlineText: { color: '#0ea5e9', fontWeight: '700', fontSize: 13 },
  signOutBtn: { backgroundColor: '#f1f5f9', borderRadius: 8, padding: 8 },
  signOutText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
});