import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { width, height } = Dimensions.get('window');

const SLIDES = [
  {
    emoji: '🚽',
    title: 'When nature calls...',
    subtitle: 'GottaGo finds community-rated restrooms near you, instantly. No more guessing.',
  },
  {
    emoji: '⭐',
    title: 'Know before you go',
    subtitle: 'Real cleanliness scores from real people. See amenities, filter by what matters, no surprises.',
  },
  {
    emoji: '🌍',
    title: 'Help your community',
    subtitle: 'Add bathrooms, leave reviews. Build the resource you wish existed when you needed it most.',
  },
];

const ONBOARDING_KEY = '@gottago/onboarding_complete';

async function completeOnboarding() {
  await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
  router.replace('/login');
}

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  function goToNext() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    } else {
      completeOnboarding();
    }
  }

  function skip() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    completeOnboarding();
  }

  return (
    <View style={styles.container}>
      {/* Skip button */}
      <TouchableOpacity style={styles.skipBtn} onPress={skip}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <Text style={styles.emoji}>{item.emoji}</Text>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.subtitle}</Text>
          </View>
        )}
      />

      {/* Dots */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, i === currentIndex && styles.dotActive]} />
        ))}
      </View>

      {/* Button */}
      <TouchableOpacity style={styles.btn} onPress={goToNext}>
        <Text style={styles.btnText}>
          {currentIndex === SLIDES.length - 1 ? "Let's Go 🚽" : 'Next'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' },
  skipBtn: { position: 'absolute', top: 60, right: 24 },
  skipText: { fontSize: 15, color: '#475569', fontWeight: '600' },
  slide: { width, alignItems: 'center', paddingHorizontal: 40, paddingTop: height * 0.17 },
  emoji: { fontSize: 90, marginBottom: 32 },
  title: { fontSize: 28, fontWeight: '900', color: '#f8fafc', textAlign: 'center', marginBottom: 16 },
  subtitle: { fontSize: 16, color: '#64748b', textAlign: 'center', lineHeight: 26, fontWeight: '500' },
  dots: { flexDirection: 'row', gap: 8, marginBottom: 40 },
  dot: { width: 8, height: 8, borderRadius: 99, backgroundColor: '#334155' },
  dotActive: { backgroundColor: '#0d9488', width: 24 },
  btn: { backgroundColor: '#0d9488', borderRadius: 14, paddingHorizontal: 48, paddingVertical: 16, marginBottom: 60, shadowColor: '#0d9488', shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
