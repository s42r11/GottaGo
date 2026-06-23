import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { GoogleAuthProvider, createUserWithEmailAndPassword, signInWithCredential, signInWithEmailAndPassword } from 'firebase/auth';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '../constants/theme';
import { auth } from '../firebaseConfig';

const isExpoGo = Constants.appOwnership === 'expo';

let GoogleSignin: any = null;
if (!isExpoGo) {
  GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
  GoogleSignin.configure({
    webClientId: '903796490438-ltfmpkj81bfr1dlkp97s6pdegke55vg6.apps.googleusercontent.com',
  });
}

function GoogleGLogo({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
      <Path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
      <Path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
      <Path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
    </Svg>
  );
}

export default function LoginScreen() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleSignIn() {
    if (!GoogleSignin) return;
    setLoading(true);
    setError(null);
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      if (response.type === 'cancelled') return;
      const { idToken } = response.data;
      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, credential);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (returnTo) {
        router.replace({ pathname: '/bathroom-detail', params: { bathroomId: returnTo } });
      } else {
        router.replace('/(tabs)');
      }
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(`Google sign-in failed (code: ${e?.code ?? e?.message ?? 'unknown'})`);
    } finally {
      setLoading(false);
    }
  }

  async function handleAuth() {
    if (!email.trim() || !password.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError('Please enter your email and password');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email.trim(), password.trim());
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password.trim());
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (returnTo) {
        router.replace({ pathname: '/bathroom-detail', params: { bathroomId: returnTo } });
      } else {
        router.replace('/(tabs)');
      }
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (e.code === 'auth/user-not-found') setError('No account found with that email');
      else if (e.code === 'auth/wrong-password') setError('Incorrect password');
      else if (e.code === 'auth/email-already-in-use') setError('An account with that email already exists');
      else if (e.code === 'auth/weak-password') setError('Password should be at least 6 characters');
      else if (e.code === 'auth/invalid-email') setError('Please enter a valid email address');
      else setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">

        {/* Hero */}
        <View style={styles.hero}>
          <Image
            source={require('../assets/images/GottaGo_logo_cropped.png')}
            style={styles.heroLogo}
            resizeMode="contain"
          />
          <Text style={styles.tagline}>When nature calls, we answer 🌟</Text>
        </View>

        {/* Auth card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{isSignUp ? 'Create Account' : 'Sign In'}</Text>
          <Text style={styles.cardSubtitle}>
            {isSignUp ? 'Join the community' : 'Good to have you here'}
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>EMAIL</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={Colors.textFainter}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>PASSWORD</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={Colors.textFainter}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.signInBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              handleAuth();
            }}
            disabled={loading}>
            {loading
              ? <ActivityIndicator color={Colors.onBrand} />
              : <Text style={styles.signInBtnText}>{isSignUp ? 'Create Account' : 'Sign In'}</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setIsSignUp(!isSignUp);
              setError(null);
            }}>
            <Text style={styles.switchText}>
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              <Text style={styles.switchHighlight}>{isSignUp ? 'Sign In' : 'Sign Up'}</Text>
            </Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {!isExpoGo && (
            <TouchableOpacity
              style={styles.googleBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                handleGoogleSignIn();
              }}
              disabled={loading}>
              <GoogleGLogo size={20} />
              <Text style={styles.googleBtnText}>Continue with Google</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.guestBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.replace('/(tabs)');
            }}>
            <Text style={styles.guestText}>Browse without account</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>By continuing you agree to be a good human 🌍</Text>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  inner: { flexGrow: 1, justifyContent: 'space-between' },

  // Hero
  hero: { alignItems: 'center', paddingTop: '20%', paddingBottom: 32 },
  heroLogo: { width: 260, height: 100, marginBottom: 12 },
  tagline: { fontSize: 14, color: Colors.textFaint, fontWeight: '500' },

  // Card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 26,
    padding: 24,
    marginHorizontal: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  cardTitle: { fontSize: 22, fontWeight: '800', color: Colors.text, letterSpacing: -0.4, marginBottom: 4 },
  cardSubtitle: { fontSize: 14, color: Colors.textMuted, marginBottom: 20, fontWeight: '500' },

  // Inputs
  inputGroup: { marginBottom: 12 },
  inputLabel: { fontSize: 10.5, fontWeight: '800', color: Colors.textFainter, letterSpacing: 1, marginBottom: 6 },
  input: {
    backgroundColor: Colors.surfaceInput,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 13,
    fontSize: 15,
    color: Colors.text,
  },

  // Error
  errorBox: { backgroundColor: '#450a0a', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#7f1d1d' },
  errorText: { color: '#fca5a5', fontSize: 13, fontWeight: '600' },

  // Sign in button
  signInBtn: {
    backgroundColor: Colors.brand,
    borderRadius: 13,
    padding: 15,
    alignItems: 'center',
    marginBottom: 14,
    marginTop: 4,
    shadowColor: Colors.brand,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 5,
  },
  signInBtnText: { color: Colors.onBrand, fontWeight: '800', fontSize: 15 },

  // Toggle sign in / sign up
  switchBtn: { alignItems: 'center', marginBottom: 20 },
  switchText: { fontSize: 13, color: Colors.textMuted, fontWeight: '500' },
  switchHighlight: { color: Colors.brand, fontWeight: '700' },

  // Divider
  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { color: Colors.textFainter, fontSize: 12, paddingHorizontal: 12, fontWeight: '600' },

  // Google button — official dark variant, never yellow
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#131314',
    borderRadius: 13,
    padding: 13,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#5f6368',
  },
  googleBtnText: { color: '#e3e3e3', fontWeight: '600', fontSize: 14 },

  // Browse without account
  guestBtn: {
    borderRadius: 13,
    padding: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  guestText: { color: Colors.textMuted, fontWeight: '600', fontSize: 14 },

  footer: { textAlign: 'center', fontSize: 11, color: Colors.textFainter, paddingBottom: 32 },
});
