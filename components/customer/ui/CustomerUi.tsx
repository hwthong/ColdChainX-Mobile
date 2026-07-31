import React, { type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type AccessibilityRole } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { customerColors, customerControl, customerRadius, customerSpacing } from '../../../constants/customerTheme';

type CustomerCardProps = {
  children: ReactNode;
  variant?: 'default' | 'soft' | 'outlined';
  padding?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
};

export function CustomerCard({ children, variant = 'default', padding = customerSpacing.lg, onPress, accessibilityLabel }: CustomerCardProps) {
  const style = {
    backgroundColor: variant === 'soft' ? customerColors.primarySoft : customerColors.surface,
    borderColor: variant === 'outlined' ? customerColors.borderStrong : customerColors.borderSubtle,
    borderRadius: customerRadius.card,
    borderWidth: variant === 'soft' ? 0 : 1,
    padding,
  } as const;

  if (!onPress) return <View style={style}>{children}</View>;
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={({ pressed }) => ({ ...style, opacity: pressed ? 0.78 : 1 })}>{children}</Pressable>;
}

type CustomerSectionHeaderProps = {
  title: string;
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  actionLabel?: string;
  onAction?: () => void;
};

export function CustomerSectionHeader({ title, description, icon, actionLabel, onAction }: CustomerSectionHeaderProps) {
  return (
    <View>
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1 flex-row items-center gap-2">
          {icon ? <Ionicons name={icon} size={18} color={customerColors.primary} /> : null}
          <Text className="flex-1 text-base font-bold text-[#3A1F04]">{title}</Text>
        </View>
        {actionLabel && onAction ? <Pressable onPress={onAction} accessibilityRole="button" accessibilityLabel={actionLabel} className="min-h-11 justify-center px-1"><Text className="text-sm font-bold text-[#8B4513]">{actionLabel}</Text></Pressable> : null}
      </View>
      {description ? <Text className="mt-1 text-xs leading-5 text-[#877369]">{description}</Text> : null}
    </View>
  );
}

type CustomerButtonProps = {
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
  icon?: ReactNode;
  fullWidth?: boolean;
  accessibilityLabel?: string;
};

export function CustomerButton({ label, variant = 'primary', loading = false, disabled = false, onPress, icon, fullWidth = false, accessibilityLabel }: CustomerButtonProps) {
  const isPrimary = variant === 'primary';
  const isDisabled = disabled || loading;
  const buttonStyle = [
    styles.buttonBase,
    fullWidth && styles.buttonFullWidth,
    variant === 'primary' && styles.buttonPrimary,
    variant === 'secondary' && styles.buttonSecondary,
    variant === 'ghost' && styles.buttonGhost,
    isDisabled && styles.buttonDisabled,
  ];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ busy: loading, disabled: isDisabled }}
      style={buttonStyle}
    >
      <View style={styles.buttonContent}>
        {loading ? <ActivityIndicator color={isPrimary ? '#FFFFFF' : customerColors.primary} /> : icon}
        <Text style={[styles.buttonText, isPrimary ? styles.buttonTextPrimary : styles.buttonTextSecondary]} numberOfLines={1}>{label}</Text>
      </View>
    </Pressable>
  );
}

type CustomerChoiceCardProps = {
  title: string;
  description?: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  leading?: ReactNode;
  trailingContent?: ReactNode;
  selectionMode?: AccessibilityRole;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

export function CustomerChoiceCard({ title, description, selected, disabled = false, onPress, leading, trailingContent, selectionMode = 'button', accessibilityLabel, accessibilityHint }: CustomerChoiceCardProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={selectionMode}
      accessibilityLabel={accessibilityLabel || `${title}${description ? `, ${description}` : ''}`}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, selected }}
      className="flex-row items-center gap-3 px-4 py-3"
      style={({ pressed }) => ({
        backgroundColor: selected ? customerColors.primarySoft : customerColors.surface,
        borderColor: selected ? customerColors.primary : customerColors.border,
        borderRadius: customerRadius.control,
        borderWidth: 1,
        minHeight: 62,
        opacity: disabled ? 0.5 : pressed ? 0.76 : 1,
      })}
    >
      {leading}
      <View className="flex-1">
        <Text className={['text-sm font-bold', selected ? 'text-[#8B4513]' : 'text-[#3A1F04]'].join(' ')}>{title}</Text>
        {description ? <Text className="mt-1 text-xs leading-5 text-[#877369]">{description}</Text> : null}
      </View>
      {trailingContent || (selected ? <View className="h-6 w-6 items-center justify-center rounded-full bg-[#8B4513]"><Ionicons name="checkmark" size={15} color="#FFFFFF" /></View> : <Ionicons name="chevron-forward" size={18} color="#A28A7D" />)}
    </Pressable>
  );
}

type CustomerBottomActionBarProps = {
  primaryLabel: string;
  onPrimaryPress: () => void;
  primaryLoading?: boolean;
  primaryDisabled?: boolean;
  secondaryLabel?: string;
  onSecondaryPress?: () => void;
  bottomInset: number;
};

export function CustomerBottomActionBar({ primaryLabel, onPrimaryPress, primaryLoading = false, primaryDisabled = false, secondaryLabel, onSecondaryPress, bottomInset }: CustomerBottomActionBarProps) {
  return (
    <View
      style={[styles.actionBar, { paddingBottom: Math.max(bottomInset, customerSpacing.md) }]}
    >
      {secondaryLabel && onSecondaryPress ? (
        <View style={styles.secondaryAction}>
          <CustomerButton label={secondaryLabel} variant="secondary" disabled={primaryLoading} onPress={onSecondaryPress} fullWidth />
        </View>
      ) : null}
      <View style={styles.primaryAction}>
        <CustomerButton label={primaryLabel} loading={primaryLoading} disabled={primaryDisabled || primaryLoading} onPress={onPrimaryPress} fullWidth />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actionBar: {
    alignItems: 'center',
    backgroundColor: customerColors.surface,
    borderTopColor: customerColors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    flexShrink: 0,
    paddingHorizontal: customerSpacing.lg,
    paddingTop: customerSpacing.md,
    width: '100%',
  },
  buttonBase: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 15,
    flexDirection: 'row',
    height: customerControl.buttonHeight,
    justifyContent: 'center',
    minHeight: customerControl.buttonHeight,
    paddingHorizontal: customerSpacing.lg,
  },
  buttonContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: customerSpacing.sm,
    justifyContent: 'center',
    minWidth: 0,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonFullWidth: {
    alignSelf: 'stretch',
    width: '100%',
  },
  buttonGhost: {
    backgroundColor: 'transparent',
  },
  buttonPrimary: {
    backgroundColor: customerColors.primary,
  },
  buttonSecondary: {
    backgroundColor: customerColors.surface,
    borderColor: customerColors.primary,
    borderWidth: 1,
  },
  buttonText: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  buttonTextPrimary: {
    color: '#FFFFFF',
  },
  buttonTextSecondary: {
    color: customerColors.primary,
  },
  primaryAction: {
    flex: 1,
    minWidth: 0,
  },
  secondaryAction: {
    flexBasis: '36%',
    flexGrow: 0,
    flexShrink: 0,
    marginRight: customerSpacing.md,
  },
});
