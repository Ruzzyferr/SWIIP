import React, { useState } from 'react';
import { View, TextInput, type TextInputProps, StyleSheet } from 'react-native';
import { Text } from './Text';
import { colors, spacing, fontSize, borderRadius } from '@/lib/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, style, onFocus, onBlur, ...props }: InputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.container}>
      {label && <Text variant="overline" style={styles.label}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          focused && styles.inputFocused,
          error && styles.inputError,
          style,
        ]}
        placeholderTextColor={colors.text.tertiary}
        onFocus={(e) => { setFocused(true); onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); onBlur?.(e); }}
        {...props}
      />
      {error && <Text variant="caption" color={colors.danger.default} style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing[4],
  },
  label: {
    marginBottom: spacing[1],
  },
  input: {
    backgroundColor: colors.surface.raised,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: fontSize.base,
    color: colors.text.primary,
  },
  inputFocused: {
    borderColor: colors.border.focus,
  },
  inputError: {
    borderColor: colors.danger.default,
  },
  error: {
    marginTop: spacing[1],
  },
});
