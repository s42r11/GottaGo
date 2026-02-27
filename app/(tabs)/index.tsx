import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const BATHROOMS = [
  { id: 1, name: "Whole Foods Market", distance: "0.1 mi", cleanliness: 4.7, reviews: 42, accessible: true, genderNeutral: false, free: true, babyChanging: true, lastCleaned: "12 min ago" },
  { id: 2, name: "Starbucks - Peachtree Rd", distance: "0.3 mi", cleanliness: 3.9, reviews: 87, accessible: true, genderNeutral: true, free: true, babyChanging: false, lastCleaned: "1 hr ago" },
  { id: 3, name: "Chamblee City Park", distance: "0.5 mi", cleanliness: 2.8, reviews: 19, accessible: true, genderNeutral: false, free: true, babyChanging: false, lastCleaned: "4 hrs ago" },
  { id: 4, name: "Nordstrom - Perimeter Mall", distance: "0.8 mi", cleanliness: 4.9, reviews: 134, accessible: true, genderNeutral: false, free: true, babyChanging: true, lastCleaned: "8 min ago" },
  { id: 5, name: "McDonald's - Buford Hwy", distance: "1.1 mi", cleanliness: 2.1, reviews: 61, accessible: true, genderNeutral: false, free: true, babyChanging: false, lastCleaned: "Unknown" },
];

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
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>🚽 GottaGo</Text>
        <Text style={styles.subtitle}>Restrooms near you</Text>
      </View>

      {/* List */}
      <ScrollView style={styles.list} contentContainerStyle={{ padding: 16, gap: 12 }}>
        {BATHROOMS.map(b => (
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

            {/* Cleanliness bar */}
            <View style={styles.barBg}>
              <View style={[styles.barFill, { width: `${(b.cleanliness / 5) * 100}%`, backgroundColor: getColor(b.cleanliness) }]} />
            </View>

            {/* Amenities */}
            <View style={styles.badges}>
              {b.accessible && <Text style={styles.badge}>♿ Accessible</Text>}
              {b.genderNeutral && <Text style={styles.badge}>⚧ Neutral</Text>}
              {b.free && <Text style={styles.badge}>🆓 Free</Text>}
              {b.babyChanging && <Text style={styles.badge}>👶 Baby</Text>}
            </View>

            {/* Expanded detail */}
            {selected === b.id && (
              <View style={styles.detail}>
                <TouchableOpacity style={styles.btn}>
                  <Text style={styles.btnText}>✍️ Leave a Review</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnOutline}>
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
  header: { backgroundColor: '#fff', padding: 20, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  logo: { fontSize: 26, fontWeight: '800', color: '#0f172a' },
  subtitle: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  list: { flex: 1 },
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
});