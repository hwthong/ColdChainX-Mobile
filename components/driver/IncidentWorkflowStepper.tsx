import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../constants/colors';
import { IncidentStatus } from '../../services/incidentApi';

export interface IncidentWorkflowStepperProps {
  status: IncidentStatus | string;
  /** Severity xác định template stepper hiển thị */
  severity?: string;
}

interface StepItem {
  id: number;
  label: string;
  statuses: string[];
}

// ── Stepper CRITICAL (5 bước) ──────────────────────────────────────────────
// Dùng cho VEHICLE_BREAKDOWN / REEFER_BREAKDOWN và mọi CRITICAL incident.
const CRITICAL_STEPS: StepItem[] = [
  { id: 1, label: 'Báo sự cố', statuses: ['REPORTED', 'CONTAINMENT_REQUIRED'] },
  { id: 2, label: 'Xe ngoài', statuses: ['RESCUE_PLANNING', 'EXTERNAL_REEFER_IN_TRANSIT', 'RESCUE_DISPATCHED'] },
  { id: 3, label: 'Inbound kho', statuses: ['READY_FOR_REDISPATCH'] },
  { id: 4, label: 'Ghép chuyến', statuses: ['REDISPATCH_PLANNED'] },
  { id: 5, label: 'Giao khách', statuses: ['REDISPATCHED_TO_CUSTOMER', 'RESOLVED', 'CONTINUED', 'TRANSLOAD_COMPLETED'] },
];

// ── Stepper WARNING (3 bước) ───────────────────────────────────────────────
// Dùng khi severity = WARNING. Có thể escalate lên CRITICAL flow.
const WARNING_STEPS: StepItem[] = [
  { id: 1, label: 'Báo sự cố', statuses: ['REPORTED'] },
  { id: 2, label: 'Theo dõi', statuses: ['MONITORING'] },
  { id: 3, label: 'Hoàn tất', statuses: ['CONTINUED', 'RESOLVED'] },
];

// ── Stepper LOW (3 bước) ───────────────────────────────────────────────────
// Dùng khi severity = LOW. Driver tự xử lý, không cần cứu hộ.
const LOW_STEPS: StepItem[] = [
  { id: 1, label: 'Báo sự cố', statuses: ['REPORTED'] },
  { id: 2, label: 'Tự xử lý', statuses: ['TRIAGED'] },
  { id: 3, label: 'Hoàn tất', statuses: ['CONTINUED', 'RESOLVED'] },
];

function getStepsForSeverity(severity?: string): StepItem[] {
  const s = severity?.toUpperCase();
  if (s === 'LOW') return LOW_STEPS;
  if (s === 'MEDIUM' || s === 'HIGH') return WARNING_STEPS; // MEDIUM | HIGH → WARNING path
  return CRITICAL_STEPS; // CRITICAL hoặc không xác định → CRITICAL stepper
}

export function getIncidentCurrentStepNumber(status: string, severity?: string): number {
  const upper = status?.toUpperCase() || '';
  const steps = getStepsForSeverity(severity);

  for (const step of steps) {
    if (step.statuses.includes(upper)) return step.id;
  }

  // Nếu WARNING (MEDIUM|HIGH)/LOW incident bị escalate lên CRITICAL flow → dùng CRITICAL stepper fallback
  if (
    severity?.toUpperCase() === 'LOW' ||
    severity?.toUpperCase() === 'MEDIUM' ||
    severity?.toUpperCase() === 'HIGH'
  ) {
    const criticalStep = CRITICAL_STEPS.find((step) => step.statuses.includes(upper));
    if (criticalStep) return criticalStep.id;
  }

  return 1;
}

export function IncidentWorkflowStepper({ status, severity }: IncidentWorkflowStepperProps) {
  // Normalize status lên uppercase để tránh lỗi so sánh case
  const normalizedStatus = status?.toUpperCase() ?? '';
  const allCriticalStatuses = CRITICAL_STEPS.flatMap((s) => s.statuses);
  const allLowStatuses = LOW_STEPS.flatMap((s) => s.statuses);
  const allWarningStatuses = WARNING_STEPS.flatMap((s) => s.statuses);

  // Nếu WARNING (MEDIUM|HIGH)/LOW escalate lên RESCUE_PLANNING trở đi → hiển thị CRITICAL stepper
  const isEscalated =
    (severity?.toUpperCase() === 'LOW' ||
      severity?.toUpperCase() === 'MEDIUM' ||
      severity?.toUpperCase() === 'HIGH' ||
      severity?.toUpperCase() === 'WARNING') &&
    allCriticalStatuses.includes(normalizedStatus) &&
    !allLowStatuses.includes(normalizedStatus) &&
    !allWarningStatuses.includes(normalizedStatus);

  const steps = isEscalated ? CRITICAL_STEPS : getStepsForSeverity(severity);
  const effectiveSeverity = isEscalated ? 'CRITICAL' : severity;
  const currentStep = getIncidentCurrentStepNumber(status, effectiveSeverity);

  // Màu accent theo severity
  const accentColor =
    effectiveSeverity?.toUpperCase() === 'LOW'
      ? '#16A34A'        // xanh lá
      : effectiveSeverity?.toUpperCase() === 'MEDIUM' || effectiveSeverity?.toUpperCase() === 'WARNING'
      ? '#D97706'        // cam/vàng
      : colors.brand.primary; // CRITICAL → màu thương hiệu (đỏ)

  return (
    <View style={styles.container}>
      {/* Label nhánh */}
      <View style={[styles.branchBadge, { backgroundColor: accentColor + '20' }]}>
        <Text style={[styles.branchText, { color: accentColor }]}>
          {effectiveSeverity?.toUpperCase() === 'LOW' && '🟢 Sự cố nhẹ — Tự xử lý'}
          {(effectiveSeverity?.toUpperCase() === 'MEDIUM' || effectiveSeverity?.toUpperCase() === 'WARNING') &&
            '🟡 Cần theo dõi — WARNING'}
          {(effectiveSeverity?.toUpperCase() === 'CRITICAL' || effectiveSeverity?.toUpperCase() === 'HIGH') &&
            '🔴 Nghiêm trọng — Cứu hộ bắt buộc'}
          {!effectiveSeverity && '🔴 Nghiêm trọng — Cứu hộ bắt buộc'}
        </Text>
      </View>

      {/* Steps row */}
      <View style={styles.stepsRow}>
        {steps.map((step, index) => {
          const isCurrent = step.id === currentStep;
          const isCompleted = step.id < currentStep;
          const isLast = index === steps.length - 1;

          return (
            <React.Fragment key={step.id}>
              {/* Step indicator node */}
              <View style={styles.stepNode}>
                <View
                  style={[
                    styles.circle,
                    isCurrent && [styles.circleCurrent, { borderColor: accentColor, backgroundColor: accentColor + '15' }],
                    isCompleted && [styles.circleCompleted, { backgroundColor: accentColor }],
                    !isCurrent && !isCompleted && styles.circleUpcoming,
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
                    isCompleted && [styles.labelCompleted, { color: accentColor }],
                    !isCurrent && !isCompleted && styles.labelUpcoming,
                  ]}
                >
                  {step.label}
                </Text>
              </View>

              {/* Connecting line */}
              {!isLast && (
                <View
                  style={[
                    styles.line,
                    isCompleted ? [styles.lineCompleted, { backgroundColor: accentColor }] : styles.lineUpcoming,
                  ]}
                />
              )}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    paddingTop: 8,
    gap: 6,
  },
  branchBadge: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 2,
  },
  branchText: {
    fontSize: 10,
    fontWeight: '700',
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepNode: {
    alignItems: 'center',
    width: 52,
    gap: 4,
  },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleCurrent: {
    borderWidth: 2,
  },
  circleCompleted: {},
  circleUpcoming: {
    backgroundColor: '#E2E8F0',
  },
  circleText: {
    fontSize: 10,
    fontWeight: '700',
  },
  circleTextCurrent: {
    fontWeight: '800',
  },
  circleTextCompleted: {
    color: '#ffffff',
  },
  circleTextUpcoming: {
    color: '#94A3B8',
  },
  label: {
    fontSize: 9,
    textAlign: 'center',
  },
  labelCurrent: {
    fontWeight: '700',
  },
  labelCompleted: {
    fontWeight: '600',
  },
  labelUpcoming: {
    color: '#94A3B8',
    fontWeight: '400',
  },
  line: {
    flex: 1,
    height: 2,
    marginBottom: 16,
    borderRadius: 1,
  },
  lineCompleted: {},
  lineUpcoming: {
    backgroundColor: '#E2E8F0',
  },
});
