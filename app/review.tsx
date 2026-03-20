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
      setTimeout(() => router.back(), 1800);
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.log('Review error:', e.code, e.message);
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

        <Text style={styles.title}>Leave a Review</Text>
        <View style={styles.locationPill}>
          <Text style={styles.locationText}>🚽 {bathroomName}</Text>
        </View>

        {/* Star Rating */}
        <View style={styles.starsCard}>
          <Text style={styles.starsLabel}>How clean was it?</Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map(i => (
              <TouchableOpacity key={i} onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setRating(i);
              }}>
                <Text style={[styles.star, { color: i <= rating ? '#f59e0b' : '#334155' }]}>★</Text>
              </TouchableOpacity>
            ))}
          </View>
          {rating > 0 && (
            <Text style={styles.starLabel}>{STAR_LABELS[rating]}</Text>
          )}
        </View>

        {/* Comment */}
        <View style={styles.commentCard}>
          <Text style={styles.commentLabel}>Add a comment (optional)</Text>
          <TextInput
            style={styles.input}
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
          style={[styles.btn, rating === 0 && styles.btnDisabled]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            handleSubmit();
          }}
          disabled={loading || rating === 0}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Submit Review</Text>
          }
        </TouchableOpacity>

      </ScrollView>

      {celebrated && (
        <Animated.View style={[styles.celebration, { opacity: fadeAnim }]}>
          <Text style={styles.celebrationEmoji}>🎉</Text>
          <Text style={styles.celebrationTitle}>Review Submitted!</Text>
          <Text style={styles.celebrationSub}>Thanks for helping the community.</Text>
        </Animated.View>
      )}

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  celebration: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', gap: 12 },
  celebrationEmoji: { fontSize: 80 },
  celebrationTitle: { fontSize: 28, fontWeight: '900', color: '#f8fafc' },
  celebrationSub: { fontSize: 16, color: '#64748b', fontWeight: '500' },
  inner: { padding: 24 },
  header: { marginBottom: 16, marginTop: 40 },
  backBtn: { alignSelf: 'flex-start' },
  backText: { fontSize: 15, color: '#0d9488', fontWeight: '600' },
  title: { fontSize: 28, fontWeight: '900', color: '#f8fafc', marginBottom: 12 },
  locationPill: { backgroundColor: '#1e293b', borderRadius: 99, paddingHorizontal: 16, paddingVertical: 8, alignSelf: 'flex-start', marginBottom: 24, borderWidth: 1, borderColor: '#334155' },
  locationText: { fontSize: 13, color: '#94a3b8', fontWeight: '600' },
  starsCard: { backgroundColor: '#1e293b', borderRadius: 20, padding: 24, marginBottom: 16, borderWidth: 1, borderColor: '#334155', alignItems: 'center' },
  starsLabel: { fontSize: 16, fontWeight: '700', color: '#f8fafc', marginBottom: 16 },
  stars: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  star: { fontSize: 44 },
  starLabel: { fontSize: 16, fontWeight: '700', color: '#f59e0b', marginTop: 4 },
  commentCard: { backgroundColor: '#1e293b', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#334155' },
  commentLabel: { fontSize: 14, fontWeight: '700', color: '#94a3b8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', borderRadius: 12, padding: 14, fontSize: 15, color: '#f8fafc', minHeight: 100 },
  errorBox: { backgroundColor: '#450a0a', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#7f1d1d' },
  errorText: { color: '#fca5a5', fontSize: 13, fontWeight: '600' },
  btn: { backgroundColor: '#0d9488', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 40, shadowColor: '#0d9488', shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  btnDisabled: { backgroundColor: '#334155', shadowOpacity: 0 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});