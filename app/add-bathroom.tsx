import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { addDoc, collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import {
  Alert,
  ActivityIndicator,
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

type Coords = { latitude: number; longitude: number };
type Step = 'details' | 'location' | 'review';

export default function AddBathroomScreen() {
  // Form state
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [floor, setFloor] = useState('');
  const [accessible, setAccessible] = useState(false);
  const [genderNeutral, setGenderNeutral] = useState(false);
  const [free, setFree] = useState(true);
  const [babyChanging, setBabyChanging] = useState(false);
  const [singleStall, setSingleStall] = useState(false);

  // Review state
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  // Flow state
  const [step, setStep] = useState<Step>('details');
  const [pinLocation, setPinLocation] = useState<Coords | null>(null);
  const [resolvedAddress, setResolvedAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Step 1 → 2: validate + fetch GPS ──────────────────────────────────────
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

  // ── Step 2 → 3: duplicate check + reverse geocode ─────────────────────────
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
            {
              text: 'Add Anyway', onPress: () => {
                setResolvedAddress(addr);
                setStep('review');
              }
            },
          ]
        );
        return;
      }

      setResolvedAddress(addr);
      setStep('review');
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Step 3: final submit ───────────────────────────────────────────────────
  async function handleFinalSubmit() {
    if (!pinLocation) return;
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

      if (rating > 0) {
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
      }

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

  // ── Step 3: Review ─────────────────────────────────────────────────────────
  if (step === 'review') {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}>
        <ScrollView contentContainerStyle={styles.inner}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setStep('location');
              setError(null);
            }} style={styles.backBtn}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
          </View>

          <StepDots current={3} />
          <Text style={styles.title}>How is it?</Text>
          <Text style={styles.subtitle}>Optional — be the first to rate {name}</Text>

          <View style={styles.starsCard}>
            <Text style={styles.starsLabel}>How clean was it?</Text>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map(i => (
                <TouchableOpacity
                  key={i}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setRating(i === rating ? 0 : i);
                  }}>
                  <Text style={[styles.star, { color: i <= rating ? '#f5ea42' : '#334155' }]}>★</Text>
                </TouchableOpacity>
              ))}
            </View>
            {rating > 0 && (
              <Text style={styles.starLabel}>{STAR_LABELS[rating]}</Text>
            )}
          </View>

          <View style={styles.commentCard}>
            <Text style={styles.commentLabel}>Add a comment (optional)</Text>
            <TextInput
              style={styles.commentInput}
              placeholder="What did you notice? Any tips for others?"
              placeholderTextColor="#475569"
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
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
              handleFinalSubmit();
            }}
            disabled={loading}>
            {loading
              ? <ActivityIndicator color="#111111" />
              : <Text style={styles.btnText}>
                  {rating > 0 ? 'Submit Bathroom & Rating' : 'Submit Bathroom'}
                </Text>
            }
          </TouchableOpacity>

          {rating === 0 && (
            <Text style={styles.skipHint}>No rating? That's fine — tap Submit to add without one.</Text>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    );
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
              handleLocationNext();
            }}
            disabled={loading}>
            {loading
              ? <ActivityIndicator color="#111111" />
              : <Text style={styles.btnText}>Next: Rate It →</Text>
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

        <StepDots current={1} />
        <Text style={styles.title}>Add a Bathroom</Text>
        <Text style={styles.subtitle}>Help the community find great restrooms</Text>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>DETAILS</Text>
          <TextInput
            style={styles.input}
            placeholder="Name e.g. Whole Foods Market"
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
            placeholder="Floor / location e.g. 2nd floor, near deli"
            placeholderTextColor="#475569"
            value={floor}
            onChangeText={setFloor}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>AMENITIES</Text>
          <View style={styles.pillRow}>
            <AmenityPill label="♿ Accessible" value={accessible} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setAccessible(!accessible); }} />
            <AmenityPill label="⚧ Gender Neutral" value={genderNeutral} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setGenderNeutral(!genderNeutral); }} />
            <AmenityPill label="🆓 Free" value={free} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setFree(!free); }} />
            <AmenityPill label="👶 Baby Changing" value={babyChanging} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setBabyChanging(!babyChanging); }} />
            <AmenityPill label="🚪 Single Stall" value={singleStall} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSingleStall(!singleStall); }} />
          </View>
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
  inner: { padding: 24, paddingBottom: 40 },
  header: { marginBottom: 8, marginTop: 40 },
  locationHeader: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 16 },
  backBtn: { alignSelf: 'flex-start', marginBottom: 8 },
  backText: { fontSize: 15, color: '#f5ea42', fontWeight: '600' },
  stepDots: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2a2a2a' },
  dotActive: { backgroundColor: '#f5ea42', width: 20 },
  title: { fontSize: 28, fontWeight: '900', color: '#f8fafc', marginBottom: 4 },
  subtitle: { fontSize: 15, color: '#888888', marginBottom: 20 },
  card: { backgroundColor: '#1c1c1c', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#2a2a2a' },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#555555', marginBottom: 14, letterSpacing: 1 },
  input: { backgroundColor: '#111111', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 12, padding: 14, fontSize: 15, color: '#f8fafc', marginBottom: 12 },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: '#111111', borderWidth: 1, borderColor: '#2a2a2a' },
  pillActive: { backgroundColor: '#f5ea42', borderColor: '#f5ea42' },
  pillText: { color: '#888888', fontSize: 13, fontWeight: '600' },
  pillTextActive: { color: '#111111' },
  starsCard: { backgroundColor: '#1c1c1c', borderRadius: 20, padding: 24, marginBottom: 16, borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center' },
  starsLabel: { fontSize: 16, fontWeight: '700', color: '#f8fafc', marginBottom: 16 },
  stars: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  star: { fontSize: 44 },
  starLabel: { fontSize: 16, fontWeight: '700', color: '#f5ea42', marginTop: 4 },
  commentCard: { backgroundColor: '#1c1c1c', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#2a2a2a' },
  commentLabel: { fontSize: 14, fontWeight: '700', color: '#aaaaaa', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  commentInput: { backgroundColor: '#111111', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 12, padding: 14, fontSize: 15, color: '#f8fafc', minHeight: 100 },
  skipHint: { textAlign: 'center', fontSize: 12, color: '#888888', marginTop: -8, marginBottom: 16 },
  mapContainer: { flex: 1 },
  pinPositioner: { position: 'absolute', bottom: '50%', alignSelf: 'center' },
  pinOutline: { position: 'absolute', top: -4, left: -4 },
  pinHoleFill: { position: 'absolute', width: 18, height: 18, borderRadius: 9, backgroundColor: '#000000', top: 9, left: 15 },
  locationFooter: { padding: 24, paddingBottom: 40 },
  errorBox: { backgroundColor: '#450a0a', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#7f1d1d' },
  errorText: { color: '#fca5a5', fontSize: 13, fontWeight: '600' },
  btn: { backgroundColor: '#f5ea42', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 16, shadowColor: '#f5ea42', shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  btnText: { color: '#111111', fontWeight: '800', fontSize: 16 },
});
