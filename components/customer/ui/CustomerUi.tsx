import React, { type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type AccessibilityRole } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppPressable as Pressable } from '../../AppPressable';
import { colors } from '../../../constants/colors';
import { customerControl, customerRadius, customerSpacing } from '../../../constants/customerTheme';

type CustomerCardProps = {
  children: ReactNode;
  variant?: 'default' | 'soft' | 'outlined';
  padding?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
};

export function CustomerCard({ children, variant = 'default', padding = customerSpacing.lg, onPress, accessibilityLabel }: CustomerCardProps) {
  const style = {
    backgroundColor: variant === 'soft' ? colors.surface.cardSoft : 'rgba(255, 255, 255, 0.96)',
    borderColor: variant === 'outlined' ? colors.border.strong : 'rgba(189, 214, 231, 0.45)',
    borderRadius: 18,
    borderWidth: 1,
    padding,
    shadowColor: '#173b59',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
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
          {icon ? <Ionicons name={icon} size={18} color={colors.brand.primary} /> : null}
          <Text style={{ color: colors.text.primary }} className="flex-1 text-base font-bold">{title}</Text>
        </View>
        {actionLabel && onAction ? (
          <Pressable onPress={onAction} accessibilityRole="button" accessibilityLabel={actionLabel} className="min-h-11 justify-center px-1">
            <Text style={{ color: colors.brand.primary }} className="text-sm font-bold">{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {description ? <Text style={{ color: colors.text.secondary }} className="mt-1 text-xs leading-5">{description}</Text> : null}
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

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ busy: loading, disabled: isDisabled }}
      style={({ pressed }) => {
        const bg = isDisabled
          ? (isPrimary ? colors.brand.primarySoft : colors.surface.card)
          : isPrimary
          ? (pressed ? colors.brand.primaryPressed : colors.brand.primary)
          : (pressed ? colors.brand.primarySoft : colors.surface.card);

        const border = isDisabled
          ? (isPrimary ? colors.border.default : colors.border.default)
          : isPrimary
          ? (pressed ? colors.brand.primaryPressed : colors.brand.primary)
          : colors.brand.primary;

        return {
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          height: 54,
          minHeight: 54,
          borderRadius: 14,
          paddingHorizontal: customerSpacing.lg,
          width: fullWidth ? '100%' : 'auto',
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          backgroundColor: bg,
          borderColor: border,
          borderWidth: 1,
        };
      }}
    >
      <View style={styles.buttonContent}>
        {loading ? (
          <ActivityIndicator
            color={
              isDisabled
                ? colors.text.secondary
                : isPrimary
                ? '#FFFFFF'
                : colors.brand.primary
            }
          />
        ) : (
          icon
        )}
        <Text
          style={[
            styles.buttonText,
            {
              color: isDisabled
                ? (isPrimary ? colors.text.secondary : colors.text.muted)
                : isPrimary
                ? '#FFFFFF'
                : colors.brand.primary,
              opacity: 1,
            },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

export type CustomerChoiceCardProps = {
  title: string;
  description?: string;
  subtitle?: string;
  helperText?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  rightElement?: ReactNode;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  leading?: ReactNode;
  trailingContent?: ReactNode;
  selectionMode?: AccessibilityRole;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

export function CustomerChoiceCard({
  title,
  description,
  subtitle,
  helperText,
  icon,
  rightElement,
  selected,
  disabled = false,
  onPress,
  leading,
  trailingContent,
  selectionMode = 'button',
  accessibilityLabel,
  accessibilityHint,
}: CustomerChoiceCardProps) {
  const descText = description || subtitle || helperText;
  const leadIcon = leading || (icon ? <Ionicons name={icon} size={20} color={selected ? colors.brand.primary : colors.text.muted} /> : null);
  const trailContent = trailingContent || rightElement;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={selectionMode}
      accessibilityLabel={accessibilityLabel || `${title}${descText ? `, ${descText}` : ''}`}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, selected }}
      className="flex-row items-center gap-3 px-4 py-3"
      style={({ pressed }) => ({
        backgroundColor: selected ? colors.surface.selected : colors.surface.card,
        borderColor: selected ? colors.border.selected : colors.border.default,
        borderRadius: customerRadius.control,
        borderWidth: 1,
        minHeight: 62,
        opacity: disabled ? 0.5 : pressed ? 0.76 : 1,
      })}
    >
      {leadIcon}
      <View className="flex-1">
        <Text style={{ color: selected ? colors.text.brand : colors.text.primary }} className="text-sm font-bold">{title}</Text>
        {descText ? <Text style={{ color: colors.text.secondary }} className="mt-1 text-xs leading-5">{descText}</Text> : null}
      </View>
      {trailContent || (selected ? (
        <View style={{ backgroundColor: colors.brand.primary }} className="h-6 w-6 items-center justify-center rounded-full">
          <Ionicons name="checkmark" size={15} color={colors.text.onPrimary} />
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
      ))}
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
    backgroundColor: colors.surface.card,
    borderTopColor: colors.border.default,
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
    borderRadius: 14,
    flexDirection: 'row',
    height: 54,
    justifyContent: 'center',
    minHeight: 54,
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
    backgroundColor: colors.surface.card,
    borderColor: colors.border.default,
    borderWidth: 1,
    opacity: 0.6,
  },
  buttonFullWidth: {
    alignSelf: 'stretch',
    width: '100%',
  },
  buttonGhost: {
    backgroundColor: 'transparent',
  },
  buttonPrimary: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primary,
    borderWidth: 1,
  },
  buttonPrimaryDisabled: {
    backgroundColor: colors.brand.primarySoft,
    borderColor: colors.border.default,
    borderWidth: 1,
  },
  buttonPrimaryPressed: {
    backgroundColor: colors.brand.primaryPressed,
    borderColor: colors.brand.primaryPressed,
    borderWidth: 1,
  },
  buttonSecondary: {
    backgroundColor: colors.surface.card,
    borderColor: colors.brand.primary,
    borderWidth: 1,
  },
  buttonSecondaryDisabled: {
    backgroundColor: colors.surface.card,
    borderColor: colors.border.default,
    borderWidth: 1,
  },
  buttonSecondaryPressed: {
    backgroundColor: colors.brand.primarySoft,
    borderColor: colors.brand.primary,
    borderWidth: 1,
  },
  buttonText: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '700',
    includeFontPadding: false,
  },
  buttonTextPrimary: {
    color: '#FFFFFF',
    opacity: 1,
  },
  buttonTextPrimaryDisabled: {
    color: colors.text.secondary,
  },
  buttonTextSecondary: {
    color: colors.brand.primary,
  },
  buttonTextSecondaryDisabled: {
    color: colors.text.muted,
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
