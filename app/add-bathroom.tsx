import { Ionicons } from '@expo/vector-icons';
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
import MapView from 'react-native-maps';
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

type Coords = { latitude: number; longitude: number };

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
  const [step, setStep] = useState<'details' | 'location'>('details');
  const [pinLocation, setPinLocation] = useState<Coords | null>(null);

  async function handleNext() {
    if (!name.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError('Please enter a name for this bathroom');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setError('Location permission is required to add a bathroom. Please enable it in your device settings.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setPinLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      setStep('location');
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError('Could not get your location. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleFinalSubmit() {
    if (!pinLocation) return;
    setLoading(true);
    setError(null);
    try {
      const snapshot = await getDocs(collection(db, 'bathrooms'));

      let resolvedAddress = address.trim();
      if (!resolvedAddress) {
        try {
          const geocode = await Location.reverseGeocodeAsync(pinLocation);
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
        .find(b => getDistanceMiles(pinLocation.latitude, pinLocation.longitude, b.latitude, b.longitude) < 0.06);

      if (nearby) {
        setLoading(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          'Possible Duplicate',
          `"${nearby.name}" is already listed nearby. Are you sure this is a different bathroom?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Add Anyway', onPress: () => submitBathroom(resolvedAddress) },
          ]
        );
        return;
      }

      await submitBathroom(resolvedAddress);
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.log('Add bathroom error:', e.code, e.message);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function submitBathroom(resolvedAddress: string) {
    if (!pinLocation) return;
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
        latitude: pinLocation.latitude,
        longitude: pinLocation.longitude,
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

  // ── Step 2: Location confirmation ──────────────────────────────────────────
  if (step === 'location' && pinLocation) {
    return (
      <View style={styles.container}>
        <View style={styles.locationHeader}>
          <TouchableOpacity onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setStep('details');
            setError(null);
          }} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Confirm Location</Text>
          <Text style={styles.subtitle}>Pan the map so the pin is on the entrance</Text>
        </View>

        <View style={styles.mapContainer}>
          <MapView
            style={StyleSheet.absoluteFill}
            initialRegion={{
              latitude: pinLocation.latitude,
              longitude: pinLocation.longitude,
              latitudeDelta: 0.001,
              longitudeDelta: 0.001,
            }}
            onRegionChangeComplete={(r) =>
              setPinLocation({ latitude: r.latitude, longitude: r.longitude })
            }
          />
          {/* Fixed crosshair pin — tip points to map center */}
          <View pointerEvents="none" style={styles.pinPositioner}>
            <Ionicons name="location-sharp" size={56} color="#000000" style={styles.pinOutline} />
            <View style={styles.pinHoleFill} />
            <Ionicons name="location-sharp" size={48} color="#f5ea42" />
          </View>
        </View>

        <View style={styles.locationFooter}>
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.btn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              handleFinalSubmit();
            }}
            disabled={loading}>
            {loading
              ? <ActivityIndicator color="#111111" />
              : <Text style={styles.btnText}>Submit Bathroom</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Step 1: Details ────────────────────────────────────────────────────────
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

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.btn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            handleNext();
          }}
          disabled={loading}>
          {loading
            ? <ActivityIndicator color="#111111" />
            : <Text style={styles.btnText}>Next: Confirm Location →</Text>
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
  locationHeader: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 16 },
  backBtn: { alignSelf: 'flex-start', marginBottom: 12 },
  backText: { fontSize: 15, color: '#f5ea42', fontWeight: '600' },
  title: { fontSize: 28, fontWeight: '900', color: '#f8fafc', marginBottom: 4 },
  subtitle: { fontSize: 15, color: '#888888', marginBottom: 24 },
  card: { backgroundColor: '#1c1c1c', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#2a2a2a' },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#555555', marginBottom: 16, letterSpacing: 1 },
  input: { backgroundColor: '#111111', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 12, padding: 14, fontSize: 15, color: '#f8fafc', marginBottom: 12 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2a2a2a' },
  toggleLabel: { fontSize: 15, color: '#f8fafc', fontWeight: '500' },
  mapContainer: { flex: 1 },
  pinPositioner: {
    position: 'absolute',
    bottom: '50%',
    alignSelf: 'center',
  },
  pinOutline: {
    position: 'absolute',
    top: -4,
    left: -4,
  },
  pinHoleFill: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#000000',
    top: 9,
    left: 15,
  },
  locationFooter: { padding: 24, paddingBottom: 40 },
  errorBox: { backgroundColor: '#450a0a', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#7f1d1d' },
  errorText: { color: '#fca5a5', fontSize: 13, fontWeight: '600' },
  btn: { backgroundColor: '#f5ea42', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 40, shadowColor: '#f5ea42', shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  btnText: { color: '#111111', fontWeight: '800', fontSize: 16 },
});
