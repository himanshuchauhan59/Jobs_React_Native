import React from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider, Tabs } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme, View, Text, Platform, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Ionicons } from '@expo/vector-icons';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { ConfigProvider } from '@/context/ConfigContext';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme !== 'light';
  const insets = useSafeAreaInsets();

  // Compact bottom inset for safe area
  const bottomInset = Platform.OS === 'web' ? 0 : Math.min(insets.bottom, 14);
  const tabHeight = 70 + bottomInset;

  const renderTabBarButton = (buttonProps: any) => {
    const isFocused = Boolean(
      buttonProps['aria-selected'] ?? buttonProps.accessibilityState?.selected
    );

    return (
      <View style={styles.tabButtonWrapper}>
        <Pressable
          {...buttonProps}
          android_ripple={{
            color: isDark ? 'rgba(0, 122, 255, 0.28)' : 'rgba(0, 122, 255, 0.18)',
            borderless: false,
            radius: 25,
          }}
          style={({ pressed }) => [
            styles.tabButtonCircle,
            isFocused && {
              backgroundColor: isDark
                ? 'rgba(0, 122, 255, 0.22)'
                : 'rgba(0, 122, 255, 0.12)',
            },
            pressed && Platform.OS === 'ios' && { opacity: 0.7 },
            Platform.OS === 'web' && ({
              outline: 'none',
              WebkitTapHighlightColor: 'transparent',
            } as any),
          ]}
          hitSlop={{ top: 10, bottom: 10, left: 24, right: 24 }}>
          {buttonProps.children}
        </Pressable>
      </View>
    );
  };

  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <ConfigProvider>
        <StatusBar style="auto" />
        <AnimatedSplashOverlay />
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarShowLabel: false,
            tabBarButton: renderTabBarButton,
            tabBarItemStyle: {
              justifyContent: 'center',
              alignItems: 'center',
            },
            tabBarStyle: {
              backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
              height: tabHeight,
              paddingBottom: bottomInset,
              paddingTop: 4,
            },
            tabBarActiveTintColor: '#007AFF',
            tabBarInactiveTintColor: isDark ? '#8E8E93' : '#6B7280',
          }}>
          <Tabs.Screen
            name="index"
            options={{
              title: 'Dispatch',
              tabBarShowLabel: false,
              tabBarButton: renderTabBarButton,
              tabBarIcon: ({ color, focused }) => (
                <Ionicons
                  name={focused ? 'paper-plane' : 'paper-plane-outline'}
                  size={25}
                  color={color as string}
                />
              ),
            }}
          />
          <Tabs.Screen
            name="templates"
            options={{
              title: 'Templates',
              tabBarShowLabel: false,
              tabBarButton: renderTabBarButton,
              tabBarIcon: ({ color, focused }) => (
                <Ionicons
                  name={focused ? 'document-text' : 'document-text-outline'}
                  size={25}
                  color={color as string}
                />
              ),
            }}
          />
          <Tabs.Screen
            name="followups"
            options={{
              title: 'Follow-ups',
              tabBarShowLabel: false,
              tabBarButton: renderTabBarButton,
              tabBarIcon: ({ color, focused }) => (
                <Ionicons
                  name={focused ? 'sync' : 'sync-outline'}
                  size={25}
                  color={color as string}
                />
              ),
            }}
          />
          <Tabs.Screen
            name="settings"
            options={{
              title: 'Settings',
              tabBarShowLabel: false,
              tabBarButton: renderTabBarButton,
              tabBarIcon: ({ color, focused }) => (
                <Ionicons
                  name={focused ? 'settings' : 'settings-outline'}
                  size={25}
                  color={color as string}
                />
              ),
            }}
          />
          <Tabs.Screen
            name="explore"
            options={{
              tabBarItemStyle: { display: 'none' },
              tabBarButton: () => null,
              tabBarStyle: { display: 'none' },
            }}
          />
        </Tabs>
      </ConfigProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  tabButtonWrapper: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
