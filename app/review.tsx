import { router, useLocalSearchParams } from 'expo-router';
import { addDoc, collection, doc, getDoc, updateDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../firebaseConfig';

export default function ReviewScreen() {
  const { bathroomId, bathroomName } = useLocalSearchParams<{ bathroomId: string, bathroomName: string }>();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitReview() {
    if (rating === 0) {
      setError('Please select a star rating');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Write the review
      await addDoc(collection(db, 'reviews'), {
        bathroomId,
        userId: auth.currentUser?.uid,
        userEmail: auth.currentUser?.email,
        rating,
        comment,
        createdAt: new Date().toISOString(),
      });

      // Recalculate average cleanliness for this bathroom
      const bathroomRef = doc(db, 'bathrooms', bathroomId);
      const bathroomSnap = await getDoc(bathroomRef);
      
      if (bathroomSnap.exists()) {
        const data = bathroomSnap.data();
        const currentRating = data.cleanliness || 0;
        const currentCount = data.reviewCount || 0;
        const newCount = currentCount + 1;
        const newRating = ((currentRating * currentCount) + rating) / newCount;

        await updateDoc(bathroomRef, {
          cleanliness: Math.round(newRating * 10) / 10,
          reviewCount: newCount,
          verified: true,
          source: data.source || 'user_submitted',
        });
      }

      router.back();
    } catch (e: any) {
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
      <View style={styles.inner}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Leave a Review</Text>
        <Text style={styles.subtitle}>{bathroomName}</Text>

        {/* Star Rating */}
        <Text style={styles.label}>Cleanliness Rating</Text>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map(s => (
            <TouchableOpacity key={s} onPress={() => setRating(s)}>
              <Text style={[styles.star, s <= rating && styles.starActive]}>★</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.ratingLabel}>
          {rating === 0 ? 'Tap to rate' : rating === 1 ? '😬 Avoid if possible' : rating === 2 ? '😕 Below average' : rating === 3 ? '😐 Gets the job done' : rating === 4 ? '🙂 Pretty clean' : '😍 Spotless!'}
        </Text>

        {/* Comment */}
        <Text style={styles.label}>Comment (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="What was your experience like?"
          placeholderTextColor="#94a3b8"
          value={comment}
          onChangeText={setComment}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        {error && <Text style={styles.error}>{error}</Text>}

        {/* Submit */}
        <TouchableOpacity
          style={[styles.btn, rating === 0 && styles.btnDisabled]}
          onPress={submitReview}
          disabled={loading || rating === 0}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Submit Review</Text>
          }
        </TouchableOpacity>

      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  inner: { flex: 1, padding: 24 },
  header: { marginBottom: 16 },
  backBtn: { alignSelf: 'flex-start' },
  backText: { fontSize: 15, color: '#0ea5e9', fontWeight: '600' },
  title: { fontSize: 28, fontWeight: '900', color: '#0f172a', marginBottom: 4 },
  subtitle: { fontSize: 15, color: '#64748b', marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '700', color: '#0f172a', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  stars: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  star: { fontSize: 40, color: '#e2e8f0' },
  starActive: { color: '#f59e0b' },
  ratingLabel: { fontSize: 14, color: '#64748b', marginBottom: 24, fontWeight: '600' },
  input: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, fontSize: 15, color: '#0f172a', marginBottom: 16, minHeight: 100 },
  error: { color: '#dc2626', fontSize: 13, marginBottom: 12 },
  btn: { backgroundColor: '#0f172a', borderRadius: 12, padding: 16, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#94a3b8' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});