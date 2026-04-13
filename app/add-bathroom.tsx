import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { addDoc, collection, getDocs } from 'firebase/firestore';
import React, { useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { auth, db } from '../firebaseConfig';
import { getDistanceMiles } from '../utils/distance';

function AmenityToggle({ label, value, onValueChange }: { label: string, value: boolean, onValueChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={(v) => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onValueChange(v);
        }}
        trackColor={{ false: '#2a2a2a', true: '#f5ea42' }}
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError('Please enter a name for this bathroom');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      let latitude = 0;
      let longitude = 0;

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setError('Location permission is required to add a bathroom. Please enable it in your device settings.');
        setLoading(false);
        return;
      }

      const [loc, snapshot] = await Promise.all([
        Location.getCurrentPositionAsync({}),
        getDocs(collection(db, 'bathrooms')),
      ]);
      latitude = loc.coords.latitude;
      longitude = loc.coords.longitude;

      let resolvedAddress = address.trim();
      if (!resolvedAddress) {
        try {
          const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
          if (geocode.length > 0) {
            const g = geocode[0];
            const parts = [g.streetNumber, g.street, g.city, g.region].filter(Boolean);
            resolvedAddress = parts.join(', ');
          }
        } catch {
          resolvedAddress = '';
        }
      }
      const nearby = snapshot.docs
        .map(d => ({ name: d.data().name, latitude: d.data().latitude, longitude: d.data().longitude }))
        .find(b => getDistanceMiles(latitude, longitude, b.latitude, b.longitude) < 0.06);

      if (nearby) {
        setLoading(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          'Possible Duplicate',
          `"${nearby.name}" is already listed nearby. Are you sure this is a different bathroom?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Add Anyway', onPress: () => submitBathroom(latitude, longitude, resolvedAddress) },
          ]
        );
        return;
      }

      await submitBathroom(latitude, longitude, resolvedAddress);
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.log('Add bathroom error:', e.code, e.message);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function submitBathroom(latitude: number, longitude: number, resolvedAddress: string) {
    setLoading(true);
    try {
      await addDoc(collection(db, 'bathrooms'), {
        name: name.trim(),
        address: resolvedAddress,
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

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
          <TouchableOpacity onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Add a Bathroom</Text>
        <Text style={styles.subtitle}>Help the community find great restrooms</Text>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>DETAILS</Text>
          <TextInput
            style={styles.input}
            placeholder="Bathroom name e.g. Whole Foods Market"
            placeholderTextColor="#475569"
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={styles.input}
            placeholder="Address (optional — auto-detected if blank)"
            placeholderTextColor="#475569"
            value={address}
            onChangeText={setAddress}
          />
          <TextInput
            style={[styles.input, { marginBottom: 0 }]}
            placeholder="Location in building e.g. 2nd floor, near deli"
            placeholderTextColor="#475569"
            value={floor}
            onChangeText={setFloor}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>AMENITIES</Text>
          <AmenityToggle label="♿ Accessible" value={accessible} onValueChange={setAccessible} />
          <AmenityToggle label="⚧ Gender Neutral" value={genderNeutral} onValueChange={setGenderNeutral} />
          <AmenityToggle label="🆓 Free to Use" value={free} onValueChange={setFree} />
          <AmenityToggle label="👶 Baby Changing Station" value={babyChanging} onValueChange={setBabyChanging} />
          <AmenityToggle label="🚪 Single Stall" value={singleStall} onValueChange={setSingleStall} />
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>📍 Your current GPS location will be used for this bathroom. Make sure you're nearby when submitting!</Text>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.btn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            handleSubmit();
          }}
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
  container: { flex: 1, backgroundColor: '#111111' },
  inner: { padding: 24 },
  header: { marginBottom: 16, marginTop: 40 },
  backBtn: { alignSelf: 'flex-start' },
  backText: { fontSize: 15, color: '#f5ea42', fontWeight: '600' },
  title: { fontSize: 28, fontWeight: '900', color: '#f8fafc', marginBottom: 4 },
  subtitle: { fontSize: 15, color: '#888888', marginBottom: 24 },
  card: { backgroundColor: '#1c1c1c', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#2a2a2a' },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#555555', marginBottom: 16, letterSpacing: 1 },
  input: { backgroundColor: '#111111', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 12, padding: 14, fontSize: 15, color: '#f8fafc', marginBottom: 12 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2a2a2a' },
  toggleLabel: { fontSize: 15, color: '#f8fafc', fontWeight: '500' },
  infoBox: { backgroundColor: '#1e1a00', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#3a3000' },
  infoText: { fontSize: 13, color: '#f5ea42', fontWeight: '500', lineHeight: 20 },
  errorBox: { backgroundColor: '#450a0a', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#7f1d1d' },
  errorText: { color: '#fca5a5', fontSize: 13, fontWeight: '600' },
  btn: { backgroundColor: '#f5ea42', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 40, shadowColor: '#f5ea42', shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  btnText: { color: '#111111', fontWeight: '800', fontSize: 16 },
});