import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { colors, spacing, fontSize, borderRadius } from '@/lib/theme';

export function ProfileScreen() {
  const { user, logout } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.displayName?.charAt(0).toUpperCase() ?? '?'}
          </Text>
        </View>
        <Text style={styles.displayName}>{user?.displayName ?? 'Kullanıcı'}</Text>
        <Text style={styles.username}>@{user?.username ?? 'bilinmiyor'}</Text>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
          <Text style={styles.menuItemText}>Hesap Ayarları</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
          <Text style={styles.menuItemText}>Ses ve Video</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
          <Text style={styles.menuItemText}>Bildirimler</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
          <Text style={styles.menuItemText}>Görünüm</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={logout} activeOpacity={0.8}>
        <Text style={styles.logoutText}>Çıkış Yap</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface.base,
    padding: spacing[4],
  },
  avatarContainer: {
    alignItems: 'center',
    paddingVertical: spacing[8],
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accent.muted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  avatarText: {
    fontSize: fontSize['3xl'],
    fontWeight: '700',
    color: colors.accent.primary,
  },
  displayName: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text.primary,
  },
  username: {
    fontSize: fontSize.base,
    color: colors.text.secondary,
    marginTop: spacing[0.5],
  },
  section: {
    backgroundColor: colors.surface.elevated,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    overflow: 'hidden',
  },
  menuItem: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  menuItemText: {
    fontSize: fontSize.base,
    color: colors.text.primary,
  },
  logoutButton: {
    marginTop: spacing[6],
    backgroundColor: colors.danger.muted,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing[3.5],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.danger.default,
  },
  logoutText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.danger.default,
  },
});
