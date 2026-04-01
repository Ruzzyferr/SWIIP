import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors, fontSize, spacing } from '@/lib/theme';
import { StyleSheet, View, Text } from 'react-native';

// Placeholder screens — will be replaced with real implementations
import { GuildListScreen } from '@/screens/main/GuildListScreen';
import { DMListScreen } from '@/screens/main/DMListScreen';
import { FriendsScreen } from '@/screens/main/FriendsScreen';
import { ProfileScreen } from '@/screens/main/ProfileScreen';
import { ChannelListScreen } from '@/screens/main/ChannelListScreen';
import { ChannelChatScreen } from '@/screens/main/ChannelChatScreen';
import { DMChatScreen } from '@/screens/main/DMChatScreen';

export type MainTabParamList = {
  HomeTab: undefined;
  DMsTab: undefined;
  FriendsTab: undefined;
  ProfileTab: undefined;
};

export type HomeStackParamList = {
  GuildList: undefined;
  ChannelList: { guildId: string; guildName?: string };
  ChannelChat: { channelId: string; channelName: string };
};

export type DMStackParamList = {
  DMList: undefined;
  DMChat: { conversationId: string; recipientName: string };
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const DMStack = createNativeStackNavigator<DMStackParamList>();

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <View style={[styles.tabIcon, focused && styles.tabIconActive]}>
      <Text style={[styles.tabIconText, focused && styles.tabIconTextActive]}>
        {label[0]}
      </Text>
    </View>
  );
}

function HomeStackScreen() {
  return (
    <HomeStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface.elevated },
        headerTintColor: colors.text.primary,
        headerTitleStyle: { fontFamily: 'Inter', fontWeight: '600' },
      }}
    >
      <HomeStack.Screen
        name="GuildList"
        component={GuildListScreen}
        options={{ title: 'Sunucular' }}
      />
      <HomeStack.Screen
        name="ChannelList"
        component={ChannelListScreen}
        options={({ route }) => ({ title: route.params.guildName ?? 'Kanallar' })}
      />
      <HomeStack.Screen
        name="ChannelChat"
        component={ChannelChatScreen}
        options={({ route }) => ({ title: `#${route.params.channelName}` })}
      />
    </HomeStack.Navigator>
  );
}

function DMStackScreen() {
  return (
    <DMStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface.elevated },
        headerTintColor: colors.text.primary,
        headerTitleStyle: { fontFamily: 'Inter', fontWeight: '600' },
      }}
    >
      <DMStack.Screen
        name="DMList"
        component={DMListScreen}
        options={{ title: 'Mesajlar' }}
      />
      <DMStack.Screen
        name="DMChat"
        component={DMChatScreen}
        options={({ route }) => ({ title: route.params.recipientName })}
      />
    </DMStack.Navigator>
  );
}

export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface.elevated,
          borderTopColor: colors.border.subtle,
          borderTopWidth: 1,
          paddingTop: spacing[1],
          height: spacing[16],
        },
        tabBarActiveTintColor: colors.accent.primary,
        tabBarInactiveTintColor: colors.text.tertiary,
        tabBarLabelStyle: {
          fontSize: fontSize.xs,
          fontFamily: 'Inter',
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackScreen}
        options={{
          tabBarLabel: 'Sunucular',
          tabBarIcon: ({ focused }) => <TabIcon label="S" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="DMsTab"
        component={DMStackScreen}
        options={{
          tabBarLabel: 'Mesajlar',
          tabBarIcon: ({ focused }) => <TabIcon label="M" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="FriendsTab"
        component={FriendsScreen}
        options={{
          tabBarLabel: 'Arkadaşlar',
          tabBarIcon: ({ focused }) => <TabIcon label="A" focused={focused} />,
          headerShown: true,
          headerTitle: 'Arkadaşlar',
          headerStyle: { backgroundColor: colors.surface.elevated },
          headerTintColor: colors.text.primary,
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profil',
          tabBarIcon: ({ focused }) => <TabIcon label="P" focused={focused} />,
          headerShown: true,
          headerTitle: 'Profil',
          headerStyle: { backgroundColor: colors.surface.elevated },
          headerTintColor: colors.text.primary,
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface.raised,
  },
  tabIconActive: {
    backgroundColor: colors.accent.muted,
  },
  tabIconText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text.tertiary,
  },
  tabIconTextActive: {
    color: colors.accent.primary,
  },
});
