import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, Tabs } from 'expo-router';
import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth } from '../../firebaseConfig';

function CustomTabBar({ state, navigation }: any) {
  const activeRoute = state.routes[state.index]?.name;

  function handleAddPress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!auth.currentUser) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Sign In Required',
        'You need an account to add a bathroom.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => router.push('/login') },
        ]
      );
    } else {
      router.push('/add-bathroom');
    }
  }

  return (
    <View style={styles.tabBar}>
      <TouchableOpacity
        style={styles.tab}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          navigation.navigate('index');
        }}>
        <Ionicons
          name={activeRoute === 'index' ? 'list' : 'list-outline'}
          size={22}
          color={activeRoute === 'index' ? Colors.brand : Colors.textFainter}
        />
        <Text style={[styles.tabLabel, activeRoute === 'index' && styles.tabLabelActive]}>List</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.fab} onPress={handleAddPress}>
        <Ionicons name="add" size={26} color={Colors.onBrand} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tab}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          navigation.navigate('map');
        }}>
        <Ionicons
          name={activeRoute === 'map' ? 'map' : 'map-outline'}
          size={22}
          color={activeRoute === 'map' ? Colors.brand : Colors.textFainter}
        />
        <Text style={[styles.tabLabel, activeRoute === 'map' && styles.tabLabelActive]}>Map</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="map" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingBottom: 35,
    paddingTop: 10,
    alignItems: 'center',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textFainter,
  },
  tabLabelActive: {
    color: Colors.brand,
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.brand,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.brand,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
    marginHorizontal: 16,
    marginBottom: 6,
  },
});
