import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { addDoc, collection, doc, getDoc, updateDoc } from 'firebase/firestore';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { auth, db } from '../firebaseConfig';

const STAR_LABELS = ['', 'Terrible 😱', 'Bad 👎', 'OK 😐', 'Good 👍', 'Spotless ✨'];

export default function ReviewScreen() {
  const { bathroomId, bathroomName } = useLocalSearchParams<{ bathroomId: string; bathroomName: string }>();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [celebrated, setCelebrated] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => () => { if (dismissTimer.current) clearTimeout(dismissTimer.current); }, []);

  async function handleSubmit() {
    if (rating === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError('Please select a star rating');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await addDoc(collection(db, 'reviews'), {
        bathroomId,
        userId: auth.currentUser?.uid,
        userEmail: auth.currentUser?.email,
        rating,
        comment: comment.trim(),
        createdAt: new Date().toISOString(),
      });

      const bathroomRef = doc(db, 'bathrooms', bathroomId);
      const bathroomSnap = await getDoc(bathroomRef);
      if (bathroomSnap.exists()) {
        const data = bathroomSnap.data();
        const oldCount = data.reviewCount || 0;
        const oldRating = data.cleanliness || 0;
        const newCount = oldCount + 1;
        const newRating = ((oldRating * oldCount) + rating) / newCount;
        await updateDoc(bathroomRef, {
          cleanliness: Math.round(newRating * 10) / 10,
          reviewCount: newCount,
          verified: true,
          lastCleaned: new Date().toISOString(),
        });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCelebrated(true);
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      dismissTimer.current = setTimeout(() => router.back(), 2000);
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.log('Review error:', e.code, e.message);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={styles.inner}>

        {/* Back button */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}>
          <Ionicons name="arrow-back" size={18} color={Colors.text} />
        </TouchableOpacity>

        <Text style={styles.title}>Leave a Review</Text>

        {/* Bathroom name pill */}
        <View style={styles.locationPill}>
          <Ionicons name="location" size={13} color={Colors.brand} />
          <Text style={styles.locationText}>{bathroomName}</Text>
        </View>

        {/* Star rating */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>CLEANLINESS</Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map(i => (
              <TouchableOpacity key={i} onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setRating(i);
              }}>
                <Text style={[styles.star, { color: i <= rating ? Colors.brand : Colors.borderStrong }]}>★</Text>
              </TouchableOpacity>
            ))}
          </View>
          {rating > 0 && <Text style={styles.starLabel}>{STAR_LABELS[rating]}</Text>}
        </View>

        {/* Comment */}
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
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            handleSubmit();
          }}
          disabled={loading}>
          {loading
            ? <ActivityIndicator color={Colors.onBrand} />
            : <Text style={styles.btnText}>Submit Review</Text>
          }
        </TouchableOpacity>

      </ScrollView>

      {/* Success overlay */}
      {celebrated && (
        <Animated.View style={[styles.celebration, { opacity: fadeAnim }]}>
          <View style={styles.celebrationIcon}>
            <Ionicons name="checkmark-circle" size={72} color={Colors.brand} />
          </View>
          <Text style={styles.celebrationTitle}>Review submitted!</Text>
          <Text style={styles.celebrationSub}>Thanks for helping the community.</Text>
        </Animated.View>
      )}
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
    marginBottom: 24,
  },

  title: { fontSize: 28, fontWeight: '900', color: Colors.text, letterSpacing: -0.5, marginBottom: 12 },

  locationPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.surface, borderRadius: 99,
    paddingHorizontal: 14, paddingVertical: 8,
    alignSelf: 'flex-start', marginBottom: 28,
    borderWidth: 1, borderColor: Colors.border,
  },
  locationText: { fontSize: 13, color: Colors.textMuted, fontWeight: '600' },

  card: {
    backgroundColor: Colors.surface, borderRadius: 20, padding: 20,
    marginBottom: 16, borderWidth: 1, borderColor: Colors.border,
  },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: Colors.textFainter, letterSpacing: 1, marginBottom: 16 },

  stars: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 8 },
  star: { fontSize: 44 },
  starLabel: { fontSize: 15, fontWeight: '700', color: Colors.brand, textAlign: 'center', marginTop: 4 },

  commentInput: {
    backgroundColor: Colors.surfaceInput, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, padding: 13, fontSize: 15, color: Colors.text, minHeight: 100,
  },

  errorBox: { backgroundColor: '#450a0a', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#7f1d1d' },
  errorText: { color: '#fca5a5', fontSize: 13, fontWeight: '600' },

  btn: {
    backgroundColor: Colors.brand, borderRadius: 14, padding: 16,
    alignItems: 'center', marginBottom: 16,
    shadowColor: Colors.brand, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  btnText: { color: Colors.onBrand, fontWeight: '800', fontSize: 16 },

  celebration: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: Colors.bg,
    justifyContent: 'center', alignItems: 'center', gap: 16,
  },
  celebrationIcon: {
    width: 120, height: 120, borderRadius: 36,
    backgroundColor: Colors.brandTintBg,
    borderWidth: 1, borderColor: Colors.brand + '33',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 8,
  },
  celebrationTitle: { fontSize: 28, fontWeight: '900', color: Colors.text, letterSpacing: -0.4 },
  celebrationSub: { fontSize: 15, color: Colors.textMuted, fontWeight: '500' },
});
