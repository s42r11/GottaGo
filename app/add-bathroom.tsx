import * as Location from 'expo-location';
import { router } from 'expo-router';
import { addDoc, collection } from 'firebase/firestore';
import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../firebaseConfig';

function AmenityToggle({ label, value, onValueChange }: { label: string, value: boolean, onValueChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#e2e8f0', true: '#0ea5e9' }}
        thumbColor='#fff'
      />
    </View>
  );
}

export default function AddBathroomScreen() {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [floor, setFloor] = useState('');
  const [accessible, setAccessible] = useState(false);
  const [genderNeutral, setGenderNeutral] = useState(false);
  const [free, setFree] = useState(true);
  const [babyChanging, setBabyChanging] = useState(false);
  const [singleStall, setSingleStall] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!name.trim()) {
      setError('Please enter a name for this bathroom');
      return;
    }
    if (!address.trim()) {
      setError('Please enter an address');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let latitude = 0;
      let longitude = 0;

      const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        latitude = loc.coords.latitude;
        longitude = loc.coords.longitude;
        console.log('GPS captured:', latitude, longitude);
      } else {
        console.log('GPS permission denied, status:', status);
      }

      await addDoc(collection(db, 'bathrooms'), {
        name: name.trim(),
        address: address.trim(),
        floor: floor.trim(),
        accessible,
        genderNeutral,
        free,
        babyChanging,
        singleStall,
        cleanliness: 0,
        reviewCount: 0,
        verified: false,
        source: 'user_submitted',
        addedBy: auth.currentUser ? auth.currentUser.uid : null,
        addedByEmail: auth.currentUser ? auth.currentUser.email : null,
        lastCleaned: 'Unknown',
        distance: 'Nearby',
        latitude,
        longitude,
        createdAt: new Date().toISOString(),
      });

      router.back();
    } catch (e: any) {
      console.log('Add bathroom error:', e.code, e.message);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}>
      <ScrollView contentContainerStyle={styles.inner}>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Add a Bathroom</Text>
        <Text style={styles.subtitle}>Help the community find great restrooms</Text>

        <Text style={styles.label}>Bathroom Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Whole Foods Market"
          placeholderTextColor="#94a3b8"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Address *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 214 Ponce De Leon Ave NE"
          placeholderTextColor="#94a3b8"
          value={address}
          onChangeText={setAddress}
        />

        <Text style={styles.label}>Location in Building (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 2nd floor, near deli"
          placeholderTextColor="#94a3b8"
          value={floor}
          onChangeText={setFloor}
        />

        <Text style={styles.sectionTitle}>Amenities</Text>
        <View style={styles.toggleContainer}>
          <AmenityToggle label="♿ Accessible" value={accessible} onValueChange={setAccessible} />
          <AmenityToggle label="⚧ Gender Neutral" value={genderNeutral} onValueChange={setGenderNeutral} />
          <AmenityToggle label="🆓 Free to Use" value={free} onValueChange={setFree} />
          <AmenityToggle label="👶 Baby Changing Station" value={babyChanging} onValueChange={setBabyChanging} />
          <AmenityToggle label="🚪 Single Stall" value={singleStall} onValueChange={setSingleStall} />
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>📍 We'll use your current GPS location for this bathroom. Make sure you're at or near the bathroom when submitting!</Text>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          style={styles.btn}
          onPress={handleSubmit}
          disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Submit Bathroom</Text>
          }
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  inner: { padding: 24 },
  header: { marginBottom: 16 },
  backBtn: { alignSelf: 'flex-start' },
  backText: { fontSize: 15, color: '#0ea5e9', fontWeight: '600' },
  title: { fontSize: 28, fontWeight: '900', color: '#0f172a', marginBottom: 4 },
  subtitle: { fontSize: 15, color: '#64748b', marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '700', color: '#0f172a', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, fontSize: 15, color: '#0f172a', marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginTop: 8, marginBottom: 12 },
  toggleContainer: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1.5, borderColor: '#e2e8f0', marginBottom: 16 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  toggleLabel: { fontSize: 15, color: '#0f172a', fontWeight: '500' },
  infoBox: { backgroundColor: '#e0f2fe', borderRadius: 12, padding: 14, marginBottom: 16 },
  infoText: { fontSize: 13, color: '#0369a1', fontWeight: '500', lineHeight: 20 },
  error: { color: '#dc2626', fontSize: 13, marginBottom: 12 },
  btn: { backgroundColor: '#0f172a', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 40 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});