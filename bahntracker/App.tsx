import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, View, StyleSheet } from 'react-native';
import HomeScreen from './src/screens/HomeScreen';
import TripDetailScreen from './src/screens/TripDetailScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import StatsScreen from './src/screens/StatsScreen';
import { colors, borderRadius, spacing } from './src/theme';

const Tab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();

const DarkTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background.primary,
    card: colors.background.secondary,
    text: colors.text.primary,
    border: colors.border.default,
    primary: colors.accent.blue,
  },
};

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="TrainInput" component={HomeScreen} />
      <HomeStack.Screen name="TripDetail" component={TripDetailScreen} />
    </HomeStack.Navigator>
  );
}

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Home: '🚄',
    History: '📋',
    Stats: '📊',
  };
  return (
    <View style={[styles.tabIcon, focused && styles.tabIconFocused]}>
      <Text style={[styles.tabIconText, focused && styles.tabIconTextFocused]}>{icons[name]}</Text>
    </View>
  );
}

export default function App() {
  return (
    <NavigationContainer theme={DarkTheme}>
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
          tabBarLabel: ({ focused }) => (
            <Text style={[styles.tabLabel, focused && styles.tabLabelFocused]}>
              {route.name === 'Home' ? 'Eingabe' : route.name === 'History' ? 'Fahrten' : 'Stats'}
            </Text>
          ),
          tabBarStyle: styles.tabBar,
          tabBarItemStyle: styles.tabBarItem,
        })}
      >
        <Tab.Screen name="Home" component={HomeStackNavigator} />
        <Tab.Screen name="History" component={HistoryScreen} />
        <Tab.Screen name="Stats" component={StatsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.background.secondary,
    borderTopColor: colors.border.subtle,
    borderTopWidth: 1,
    height: 85,
    paddingTop: spacing.sm,
    paddingBottom: 25,
  },
  tabBarItem: {
    paddingVertical: spacing.xs,
  },
  tabIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  tabIconFocused: {
    backgroundColor: 'rgba(88, 166, 255, 0.15)',
  },
  tabIconText: {
    fontSize: 22,
    opacity: 0.5,
  },
  tabIconTextFocused: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 11,
    color: colors.text.tertiary,
    fontWeight: '500',
    marginTop: 2,
  },
  tabLabelFocused: {
    color: colors.text.primary,
    fontWeight: '600',
  },
});
