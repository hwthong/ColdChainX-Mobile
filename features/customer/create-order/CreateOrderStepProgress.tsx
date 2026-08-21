import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../../constants/colors';

type CreateOrderStepProgressProps = {
  currentStep: number;
  totalSteps: number;
  title: string;
  compact?: boolean;
};

export function CreateOrderStepProgress({
  currentStep,
  totalSteps,
  title,
  compact = false,
}: CreateOrderStepProgressProps) {
  const percentage = Math.round((currentStep / totalSteps) * 100);

  return (
    <View style={[styles.container, compact ? styles.containerCompact : null]}>
      <View style={styles.headerRow}>
        <View style={styles.titleWrapper}>
          <Text style={styles.stepLabel}>
            {compact ? `Bước ${currentStep}/${totalSteps}` : `Bước ${currentStep} trên ${totalSteps}`}
          </Text>
          <Text style={styles.titleText}>{title}</Text>
        </View>
        <Text style={styles.percentageText}>{percentage}%</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${percentage}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(189, 214, 231, 0.45)',
    paddingHorizontal: 18,
    paddingVertical: 14,
    shadowColor: '#173b59',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  containerCompact: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
    elevation: 0,
    paddingHorizontal: 0,
    paddingVertical: 4,
    shadowOpacity: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleWrapper: {
    flex: 1,
  },
  stepLabel: {
    color: colors.brand.primary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  titleText: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  percentageText: {
    color: colors.brand.primary,
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 12,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: colors.brand.primarySoft,
    borderRadius: 3,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.brand.primary,
    borderRadius: 3,
  },
});
