import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useRef } from 'react';
import 'react-native-reanimated';
import { auth } from '../firebaseConfig';

SplashScreen.preventAutoHideAsync();

const ONBOARDING_KEY = '@gottago/onboarding_complete';

export default function RootLayout() {
  const hasRedirected = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!hasRedirected.current) {
        hasRedirected.current = true;
        const onboardingDone = await AsyncStorage.getItem(ONBOARDING_KEY);
        if (!onboardingDone) {
          router.replace('/onboarding');
        } else if (user) {
          router.replace('/(tabs)');
        } else {
          router.replace('/login');
        }
        SplashScreen.hideAsync();
      }
    });
    return unsubscribe;
  }, []);

  return (
    <ThemeProvider value={DarkTheme}>
      <Stack screenOptions={{ contentStyle: { backgroundColor: '#0f172a' } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="login" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="bathroom-detail" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="review" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="add-bathroom" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}