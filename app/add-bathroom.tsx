import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { addDoc, collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView from 'react-native-maps';
import { auth, db } from '../firebaseConfig';
import { getDistanceMiles } from '../utils/distance';

const STAR_LABELS = ['', 'Terrible 😱', 'Bad 👎', 'OK 😐', 'Good 👍', 'Spotless ✨'];

function AmenityPill({ label, value, onPress }: { label: string; value: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.pill, value && styles.pillActive]}
      onPress={onPress}>
      <Text style={[styles.pillText, value && styles.pillTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function StepDots({ current }: { current: 1 | 2 | 3 }) {
  return (
    <View style={styles.stepDots}>
      {[1, 2, 3].map(i => (
        <View key={i} style={[styles.dot, i === current && styles.dotActive]} />
      ))}
    </View>
  );
}

function BackBtn({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.backBtn} onPress={onPress}>
      <Ionicons name="arrow-back" size={18} color={Colors.text} />
    </TouchableOpacity>
  );
}

type Coords = { latitude: number; longitude: number };
type Step = 'details' | 'location' | 'review';

export default function AddBathroomScreen() {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [floor, setFloor] = useState('');
  const [accessible, setAccessible] = useState(false);
  const [genderNeutral, setGenderNeutral] = useState(false);
  const [free, setFree] = useState(true);
  const [babyChanging, setBabyChanging] = useState(false);
  const [singleStall, setSingleStall] = useState(false);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  const [step, setStep] = useState<Step>('details');
  const [pinLocation, setPinLocation] = useState<Coords | null>(null);
  const [resolvedAddress, setResolvedAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError('Could not get your location. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleLocationNext() {
    if (!pinLocation) return;
    setLoading(true);
    setError(null);
    try {
      const snapshot = await getDocs(collection(db, 'bathrooms'));

      let addr = address.trim();
      if (!addr) {
        try {
          const geocode = await Location.reverseGeocodeAsync(pinLocation);
          if (geocode.length > 0) {
            const g = geocode[0];
            addr = [g.streetNumber, g.street, g.city, g.region].filter(Boolean).join(', ');
          }
        } catch { addr = ''; }
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
            { text: 'Add Anyway', onPress: () => { setResolvedAddress(addr); setStep('review'); } },
          ]
        );
        return;
      }

      setResolvedAddress(addr);
      setStep('review');
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleFinalSubmit() {
    if (!pinLocation) return;
    if (rating === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError('Please select a rating before submitting.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const docRef = await addDoc(collection(db, 'bathrooms'), {
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
        addedBy: auth.currentUser?.uid ?? null,
        addedByEmail: auth.currentUser?.email ?? null,
        lastCleaned: 'Unknown',
        distance: 'Nearby',
        latitude: pinLocation.latitude,
        longitude: pinLocation.longitude,
        createdAt: new Date().toISOString(),
      });

      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' today';
      await Promise.all([
        addDoc(collection(db, 'reviews'), {
          bathroomId: docRef.id,
          userId: auth.currentUser?.uid ?? '',
          userEmail: auth.currentUser?.email ?? '',
          rating,
          comment: comment.trim(),
          createdAt: new Date().toISOString(),
        }),
        updateDoc(doc(db, 'bathrooms', docRef.id), {
          cleanliness: rating,
          reviewCount: 1,
          verified: true,
          lastCleaned: timeStr,
        }),
      ]);

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

  // ── Step 3: Review ──────────────────────────────────────────────────────────
  if (step === 'review') {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <ScrollView contentContainerStyle={styles.inner}>
          <BackBtn onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStep('location'); setError(null); }} />
          <StepDots current={3} />
          <Text style={styles.title}>Rate the throne</Text>
          <Text style={styles.subtitle}>Tell the community what you found at {name}</Text>

          <View style={styles.card}>
            <Text style={styles.sectionLabel}>CLEANLINESS</Text>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map(i => (
                <TouchableOpacity
                  key={i}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setRating(i === rating ? 0 : i);
                  }}>
                  <Text style={[styles.star, { color: i <= rating ? Colors.brand : Colors.borderStrong }]}>★</Text>
                </TouchableOpacity>
              ))}
            </View>
            {rating > 0 && <Text style={styles.starLabel}>{STAR_LABELS[rating]}</Text>}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionLabel}>COMMENT (OPTIONAL)</Text>
            <TextInput
              style={styles.commentInput}
              placeholder="What did you notice? Any tips for others?"
              placeholderTextColor={Colors.textFainter}
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.btn}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); handleFinalSubmit(); }}
            disabled={loading}>
            {loading
              ? <ActivityIndicator color={Colors.onBrand} />
              : <Text style={styles.btnText}>Submit Bathroom & Rating</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Step 2: Location ────────────────────────────────────────────────────────
  if (step === 'location' && pinLocation) {
    return (
      <View style={styles.container}>
        <View style={styles.locationHeader}>
          <BackBtn onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStep('details'); setError(null); }} />
          <StepDots current={2} />
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
          <View pointerEvents="none" style={styles.pinPositioner}>
            <Ionicons name="location-sharp" size={56} color={Colors.bg} style={styles.pinOutline} />
            <View style={styles.pinHoleFill} />
            <Ionicons name="location-sharp" size={48} color={Colors.brand} />
          </View>
        </View>

        <View style={styles.locationFooter}>
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.btn}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); handleLocationNext(); }}
            disabled={loading}>
            {loading
              ? <ActivityIndicator color={Colors.onBrand} />
              : <Text style={styles.btnText}>Next: Rate It →</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Step 1: Details ─────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={styles.inner}>
        <BackBtn onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }} />
        <StepDots current={1} />
        <Text style={styles.title}>Add a Bathroom</Text>
        <Text style={styles.subtitle}>Help the community find great restrooms</Text>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>DETAILS</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>NAME</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Whole Foods Market"
              placeholderTextColor={Colors.textFainter}
              value={name}
              onChangeText={setName}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>ADDRESS</Text>
            <TextInput
              style={styles.input}
              placeholder="Optional — auto-detected if blank"
              placeholderTextColor={Colors.textFainter}
              value={address}
              onChangeText={setAddress}
            />
          </View>
          <View style={[styles.inputGroup, { marginBottom: 0 }]}>
            <Text style={styles.inputLabel}>FLOOR / LOCATION</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 2nd floor, near deli"
              placeholderTextColor={Colors.textFainter}
              value={floor}
              onChangeText={setFloor}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>AMENITIES</Text>
          <View style={styles.pillRow}>
            <AmenityPill label="Accessible" value={accessible} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setAccessible(!accessible); }} />
            <AmenityPill label="Gender Neutral" value={genderNeutral} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setGenderNeutral(!genderNeutral); }} />
            <AmenityPill label="Free" value={free} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setFree(!free); }} />
            <AmenityPill label="Baby Changing" value={babyChanging} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setBabyChanging(!babyChanging); }} />
            <AmenityPill label="Single Stall" value={singleStall} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSingleStall(!singleStall); }} />
          </View>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.btn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); handleNext(); }}
          disabled={loading}>
          {loading
            ? <ActivityIndicator color={Colors.onBrand} />
            : <Text style={styles.btnText}>Next: Confirm Location →</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  inner: { padding: 24, paddingTop: 56, paddingBottom: 48 },

  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
  },

  stepDots: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  dotActive: { backgroundColor: Colors.brand, width: 22, borderRadius: 4 },

  title: { fontSize: 28, fontWeight: '900', color: Colors.text, letterSpacing: -0.5, marginBottom: 4 },
  subtitle: { fontSize: 15, color: Colors.textMuted, marginBottom: 24, fontWeight: '500' },

  card: {
    backgroundColor: Colors.surface, borderRadius: 20, padding: 20,
    marginBottom: 16, borderWidth: 1, borderColor: Colors.border,
  },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: Colors.textFainter, letterSpacing: 1, marginBottom: 14 },

  inputGroup: { marginBottom: 14 },
  inputLabel: { fontSize: 10.5, fontWeight: '800', color: Colors.textFainter, letterSpacing: 1, marginBottom: 6 },
  input: {
    backgroundColor: Colors.surfaceInput, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, padding: 13, fontSize: 15, color: Colors.text,
  },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20,
    backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border,
  },
  pillActive: { backgroundColor: Colors.brand, borderColor: Colors.brand },
  pillText: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
  pillTextActive: { color: Colors.onBrand },

  stars: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 8 },
  star: { fontSize: 44 },
  starLabel: { fontSize: 15, fontWeight: '700', color: Colors.brand, textAlign: 'center', marginTop: 4 },
  commentInput: {
    backgroundColor: Colors.surfaceInput, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, padding: 13, fontSize: 15, color: Colors.text, minHeight: 100,
  },
  skipHint: { textAlign: 'center', fontSize: 12, color: Colors.textFainter, marginTop: -4, marginBottom: 16, fontWeight: '500' },

  locationHeader: { paddingHorizontal: 24, paddingTop: 56, paddingBottom: 16, backgroundColor: Colors.bg },
  mapContainer: { flex: 1 },
  pinPositioner: { position: 'absolute', bottom: '50%', alignSelf: 'center' },
  pinOutline: { position: 'absolute', top: -4, left: -4 },
  pinHoleFill: { position: 'absolute', width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.bg, top: 9, left: 15 },
  locationFooter: { padding: 24, paddingBottom: 40, backgroundColor: Colors.bg },

  errorBox: { backgroundColor: '#450a0a', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#7f1d1d' },
  errorText: { color: '#fca5a5', fontSize: 13, fontWeight: '600' },

  btn: {
    backgroundColor: Colors.brand, borderRadius: 14, padding: 16,
    alignItems: 'center', marginBottom: 16,
    shadowColor: Colors.brand, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  btnText: { color: Colors.onBrand, fontWeight: '800', fontSize: 16 },
});
