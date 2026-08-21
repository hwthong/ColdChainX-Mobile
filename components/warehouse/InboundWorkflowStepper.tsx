import React from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../constants/colors';

export type StepKey = 'qc' | 'receipt' | 'putaway';

export type StepState = 'ACTIVE' | 'COMPLETED' | 'AVAILABLE' | 'LOCKED';

export interface WorkflowStepConfig {
  key: StepKey;
  label: string;
  stepNumber: number;
  state: StepState;
}

interface InboundWorkflowStepperProps {
  steps: WorkflowStepConfig[];
  activeStep: StepKey;
  onStepPress: (stepKey: StepKey) => void;
}

export function InboundWorkflowStepper({ steps, activeStep, onStepPress }: InboundWorkflowStepperProps) {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {steps.map((step, index) => {
          const isActive = activeStep === step.key;
          const isCompleted = step.state === 'COMPLETED';
          const isLocked = step.state === 'LOCKED';
          const isAvailable = step.state === 'AVAILABLE';

          return (
            <View key={step.key} style={styles.stepWrapper}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: isLocked, selected: isActive }}
                disabled={isLocked}
                onPress={() => onStepPress(step.key)}
                style={[
                  styles.chip,
                  isActive && styles.chipActive,
                  !isActive && isCompleted && styles.chipCompleted,
                  !isActive && isAvailable && styles.chipAvailable,
                  !isActive && isLocked && styles.chipLocked,
                ]}
              >
                {isCompleted && !isActive ? (
                  <Ionicons name="checkmark-circle" size={14} color={colors.status.success.main} />
                ) : (
                  <View
                    style={[
                      styles.numberCircle,
                      isActive && styles.numberCircleActive,
                      !isActive && isCompleted && styles.numberCircleCompleted,
                      !isActive && isAvailable && styles.numberCircleAvailable,
                      !isActive && isLocked && styles.numberCircleLocked,
                    ]}
                  >
                    <Text
                      style={[
                        styles.numberText,
                        isActive && styles.numberTextActive,
                        !isActive && isCompleted && styles.numberTextCompleted,
                        !isActive && isAvailable && styles.numberTextAvailable,
                        !isActive && isLocked && styles.numberTextLocked,
                      ]}
                    >
                      {step.stepNumber}
                    </Text>
                  </View>
                )}

                <Text
                  style={[
                    styles.label,
                    isActive && styles.labelActive,
                    !isActive && isCompleted && styles.labelCompleted,
                    !isActive && isAvailable && styles.labelAvailable,
                    !isActive && isLocked && styles.labelLocked,
                  ]}
                >
                  {step.label}
                </Text>
              </Pressable>

              {index < steps.length - 1 ? (
                <View
                  style={[
                    styles.connector,
                    isCompleted && styles.connectorCompleted,
                  ]}
                />
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 6,
  },
  stepWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  chipActive: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primary,
  },
  chipCompleted: {
    backgroundColor: colors.status.success.bg,
    borderColor: colors.status.success.border,
  },
  chipAvailable: {
    backgroundColor: colors.surface.card,
    borderColor: colors.border.default,
  },
  chipLocked: {
    backgroundColor: colors.surface.muted,
    borderColor: colors.border.default,
    opacity: 0.75,
  },
  numberCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberCircleActive: {
    backgroundColor: '#FFFFFF',
  },
  numberCircleCompleted: {
    backgroundColor: colors.status.success.main,
  },
  numberCircleAvailable: {
    backgroundColor: colors.brand.primarySoft,
  },
  numberCircleLocked: {
    backgroundColor: colors.border.default,
  },
  numberText: {
    fontSize: 11,
    fontWeight: '700',
  },
  numberTextActive: {
    color: colors.brand.primary,
  },
  numberTextCompleted: {
    color: '#FFFFFF',
  },
  numberTextAvailable: {
    color: colors.brand.primary,
  },
  numberTextLocked: {
    color: colors.text.muted,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
  labelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  labelCompleted: {
    color: colors.status.success.main,
    fontWeight: '700',
  },
  labelAvailable: {
    color: colors.text.primary,
  },
  labelLocked: {
    color: colors.text.muted,
  },
  connector: {
    width: 12,
    height: 2,
    backgroundColor: colors.border.default,
    borderRadius: 1,
  },
  connectorCompleted: {
    backgroundColor: colors.status.success.border,
  },
});
