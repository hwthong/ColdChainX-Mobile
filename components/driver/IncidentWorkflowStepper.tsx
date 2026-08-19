import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { IncidentStatus } from '../../services/incidentApi';

export interface IncidentWorkflowStepperProps {
  status: IncidentStatus | string;
  /** Severity xác định template stepper hiển thị */
  severity?: string;
  /** Loại phương án cứu hộ: true = Xe ngoài chở về kho tuyến; false = Xe nội bộ sang hàng tiếp tục chuyến */
  isExternalReefer?: boolean;
  /** Bước đang được chọn để xem lại thông tin (nếu null thì xem bước hiện tại) */
  selectedStep?: number | null;
  /** Callback khi người dùng chạm vào bước trên Stepper để tua/xem lại */
  onSelectStep?: (stepId: number) => void;
}

interface StepItem {
  id: number;
  label: string;
  statuses: string[];
}

// ── Stepper CRITICAL: Xe thuê ngoài chở về kho tuyến (5 bước) ──────────────
export const EXTERNAL_REEFER_STEPS: StepItem[] = [
  { id: 1, label: 'Báo sự cố', statuses: ['REPORTED', 'CONTAINMENT_REQUIRED'] },
  { id: 2, label: 'Xe ngoài', statuses: ['RESCUE_PLANNING', 'EXTERNAL_REEFER_IN_TRANSIT'] },
  { id: 3, label: 'Inbound kho', statuses: ['READY_FOR_REDISPATCH'] },
  { id: 4, label: 'Ghép chuyến', statuses: ['REDISPATCH_PLANNED'] },
  { id: 5, label: 'Giao khách', statuses: ['REDISPATCHED_TO_CUSTOMER', 'RESOLVED'] },
];

// ── Stepper CRITICAL: Xe nội bộ trong hệ thống sang hàng trực tiếp (5 bước) ─
export const INTERNAL_FLEET_STEPS: StepItem[] = [
  { id: 1, label: 'Báo sự cố', statuses: ['REPORTED', 'CONTAINMENT_REQUIRED'] },
  { id: 2, label: 'Điều xe', statuses: ['RESCUE_PLANNING'] },
  { id: 3, label: 'Sang hàng', statuses: ['RESCUE_DISPATCHED'] },
  { id: 4, label: 'Tiếp tục đi', statuses: ['TRANSLOAD_COMPLETED', 'IN_TRANSIT', 'CONTINUED'] },
  { id: 5, label: 'Giao khách', statuses: ['DELIVERING', 'RESOLVED'] },
];

// ── Stepper WARNING (3 bước) ───────────────────────────────────────────────
export const WARNING_STEPS: StepItem[] = [
  { id: 1, label: 'Báo sự cố', statuses: ['REPORTED'] },
  { id: 2, label: 'Theo dõi', statuses: ['MONITORING'] },
  { id: 3, label: 'Hoàn tất', statuses: ['CONTINUED', 'RESOLVED'] },
];

// ── Stepper LOW (3 bước) ───────────────────────────────────────────────────
export const LOW_STEPS: StepItem[] = [
  { id: 1, label: 'Báo sự cố', statuses: ['REPORTED'] },
  { id: 2, label: 'Tự xử lý', statuses: ['TRIAGED'] },
  { id: 3, label: 'Hoàn tất', statuses: ['CONTINUED', 'RESOLVED'] },
];

export function getStepsForSeverity(severity?: string, isExternalReefer?: boolean): StepItem[] {
  const s = severity?.toUpperCase();
  if (s === 'LOW') return LOW_STEPS;
  if (s === 'MEDIUM' || s === 'HIGH') return WARNING_STEPS;
  return isExternalReefer ? EXTERNAL_REEFER_STEPS : INTERNAL_FLEET_STEPS;
}

export function getIncidentCurrentStepNumber(
  status: string,
  severity?: string,
  isExternalReefer?: boolean
): number {
  const upper = status?.toUpperCase() || '';
  const steps = getStepsForSeverity(severity, isExternalReefer);

  for (const step of steps) {
    if (step.statuses.includes(upper)) return step.id;
  }

  if (
    severity?.toUpperCase() === 'LOW' ||
    severity?.toUpperCase() === 'MEDIUM' ||
    severity?.toUpperCase() === 'HIGH'
  ) {
    const fallbackSteps = isExternalReefer ? EXTERNAL_REEFER_STEPS : INTERNAL_FLEET_STEPS;
    const criticalStep = fallbackSteps.find((step) => step.statuses.includes(upper));
    if (criticalStep) return criticalStep.id;
  }

  return 1;
}

export function IncidentWorkflowStepper({
  status,
  severity,
  isExternalReefer = false,
  selectedStep,
  onSelectStep,
}: IncidentWorkflowStepperProps) {
  const normalizedStatus = status?.toUpperCase() ?? '';
  const allCriticalStatuses = (isExternalReefer ? EXTERNAL_REEFER_STEPS : INTERNAL_FLEET_STEPS).flatMap((s) => s.statuses);
  const allLowStatuses = LOW_STEPS.flatMap((s) => s.statuses);
  const allWarningStatuses = WARNING_STEPS.flatMap((s) => s.statuses);

  const isEscalated =
    (severity?.toUpperCase() === 'LOW' ||
      severity?.toUpperCase() === 'MEDIUM' ||
      severity?.toUpperCase() === 'HIGH' ||
      severity?.toUpperCase() === 'WARNING') &&
    allCriticalStatuses.includes(normalizedStatus) &&
    !allLowStatuses.includes(normalizedStatus) &&
    !allWarningStatuses.includes(normalizedStatus);

  const steps = isEscalated
    ? (isExternalReefer ? EXTERNAL_REEFER_STEPS : INTERNAL_FLEET_STEPS)
    : getStepsForSeverity(severity, isExternalReefer);
  const effectiveSeverity = isEscalated ? 'CRITICAL' : severity;
  const currentStep = getIncidentCurrentStepNumber(status, effectiveSeverity, isExternalReefer);
  const activeViewingStep = selectedStep ?? currentStep;

  // Accent and theme palette
  const accentColor =
    effectiveSeverity?.toUpperCase() === 'LOW'
      ? '#16a34a'
      : effectiveSeverity?.toUpperCase() === 'MEDIUM' ||
        effectiveSeverity?.toUpperCase() === 'HIGH' ||
        effectiveSeverity?.toUpperCase() === 'WARNING'
      ? '#d97706'
      : colors.brand.primary;

  const badgeBg =
    effectiveSeverity?.toUpperCase() === 'LOW'
      ? '#f0fdf4'
      : effectiveSeverity?.toUpperCase() === 'MEDIUM' ||
        effectiveSeverity?.toUpperCase() === 'HIGH' ||
        effectiveSeverity?.toUpperCase() === 'WARNING'
      ? '#fffbeb'
      : colors.brand.primarySoft;

  const badgeBorder =
    effectiveSeverity?.toUpperCase() === 'LOW'
      ? '#bbf7d0'
      : effectiveSeverity?.toUpperCase() === 'MEDIUM' ||
        effectiveSeverity?.toUpperCase() === 'HIGH' ||
        effectiveSeverity?.toUpperCase() === 'WARNING'
      ? '#fde68a'
      : colors.border.default;

  return (
    <View style={styles.container}>
      {/* Header Bar của Stepper: Badge nhánh + Gợi ý bấm tua */}
      <View className="flex-row items-center justify-between pb-1">
        <View
          style={[
            styles.branchBadge,
            { backgroundColor: badgeBg, borderColor: badgeBorder },
          ]}
        >
          <View
            style={[
              styles.statusDot,
              { backgroundColor: accentColor },
            ]}
          />
          <Text style={[styles.branchText, { color: accentColor }]}>
            {effectiveSeverity?.toUpperCase() === 'LOW' && 'Sự cố nhẹ — Tự xử lý'}
            {(effectiveSeverity?.toUpperCase() === 'MEDIUM' ||
              effectiveSeverity?.toUpperCase() === 'HIGH' ||
              effectiveSeverity?.toUpperCase() === 'WARNING') &&
              'Cần theo dõi nhiệt — Warning'}
            {(effectiveSeverity?.toUpperCase() === 'CRITICAL' || !effectiveSeverity) &&
              (isExternalReefer
                ? 'Cứu hộ — Xe ngoài về kho'
                : 'Cứu hộ — Xe nội bộ đổi sang hàng')}
          </Text>
        </View>

        <View className="flex-row items-center gap-1">
          <Ionicons name="hand-left-outline" size={11} color={colors.text.muted} />
          <Text style={{ color: colors.text.muted }} className="text-[10px] font-medium">
            Chạm để xem lại
          </Text>
        </View>
      </View>

      {/* Steps Row with balanced spacing */}
      <View style={styles.stepsRow}>
        {steps.map((step, index) => {
          const isCurrent = step.id === currentStep;
          const isCompleted = step.id < currentStep;
          const isSelected = step.id === activeViewingStep;
          const isLast = index === steps.length - 1;

          return (
            <React.Fragment key={step.id}>
              {/* Step Node */}
              <Pressable
                onPress={() => onSelectStep?.(step.id)}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                style={styles.stepNode}
              >
                <View
                  style={[
                    styles.circle,
                    isCurrent && [
                      styles.circleCurrent,
                      { borderColor: accentColor, backgroundColor: badgeBg },
                    ],
                    isCompleted && [
                      styles.circleCompleted,
                      { backgroundColor: accentColor },
                    ],
                    !isCurrent && !isCompleted && styles.circleUpcoming,
                    isSelected && styles.circleSelectedRing,
                  ]}
                >
                  <Text
                    style={[
                      styles.circleText,
                      isCurrent && [styles.circleTextCurrent, { color: accentColor }],
                      isCompleted && styles.circleTextCompleted,
                      !isCurrent && !isCompleted && styles.circleTextUpcoming,
                    ]}
                  >
                    {isCompleted ? '✓' : step.id}
                  </Text>
                </View>

                <Text
                  numberOfLines={1}
                  style={[
                    styles.label,
                    isCurrent && [styles.labelCurrent, { color: accentColor }],
                    isCompleted && [styles.labelCompleted, { color: colors.text.primary }],
                    !isCurrent && !isCompleted && styles.labelUpcoming,
                    isSelected && { color: accentColor, fontWeight: '800' },
                  ]}
                >
                  {step.label}
                </Text>
              </Pressable>

              {/* Connecting line */}
              {!isLast && (
                <View
                  style={[
                    styles.line,
                    isCompleted
                      ? [styles.lineCompleted, { backgroundColor: accentColor }]
                      : styles.lineUpcoming,
                  ]}
                />
              )}
            </React.Fragment>
          );
        })}
      </View>

      {/* Banner nhắc nhở khi đang tua lại xem bước cũ */}
      {selectedStep !== null && selectedStep !== undefined && selectedStep !== currentStep && (
        <View
          style={{
            backgroundColor: colors.surface.page,
            borderColor: colors.border.default,
          }}
          className="flex-row items-center justify-between rounded-xl border px-3 py-2 mt-1"
        >
          <View className="flex-row items-center gap-1.5 flex-1 pr-2">
            <Ionicons name="eye-outline" size={14} color={colors.brand.primary} />
            <Text numberOfLines={1} style={{ color: colors.text.primary }} className="text-xs">
              Đang xem: <Text className="font-bold">Bước {activeViewingStep} - {steps.find((s) => s.id === activeViewingStep)?.label}</Text>
            </Text>
          </View>
          <Pressable
            onPress={() => onSelectStep?.(currentStep)}
            style={{ backgroundColor: colors.brand.primary }}
            className="rounded-lg px-2.5 py-1 shadow-sm"
          >
            <Text style={{ color: colors.text.onPrimary }} className="text-[10px] font-bold">
              Về bước hiện tại (B{currentStep})
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface.card,
    paddingTop: 4,
    gap: 8,
  },
  branchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 9999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  branchText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  stepNode: {
    alignItems: 'center',
    width: 56,
    gap: 5,
  },
  circle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleCurrent: {
    borderWidth: 2,
  },
  circleSelectedRing: {
    shadowColor: colors.brand.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
    transform: [{ scale: 1.12 }],
  },
  circleCompleted: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  circleUpcoming: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  circleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  circleTextCurrent: {
    fontWeight: '800',
  },
  circleTextCompleted: {
    color: '#ffffff',
  },
  circleTextUpcoming: {
    color: '#94a3b8',
  },
  label: {
    fontSize: 10,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  labelCurrent: {
    fontWeight: '700',
  },
  labelCompleted: {
    fontWeight: '600',
  },
  labelUpcoming: {
    color: '#94a3b8',
    fontWeight: '400',
  },
  line: {
    flex: 1,
    height: 2,
    marginBottom: 17,
    borderRadius: 1,
  },
  lineCompleted: {},
  lineUpcoming: {
    backgroundColor: '#e2e8f0',
  },
});
