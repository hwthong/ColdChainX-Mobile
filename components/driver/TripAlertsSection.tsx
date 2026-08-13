import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { colors } from '../../constants/colors';
import type { SmartAlert } from '../../services/monitoringApi';
import { AppPressable as Pressable } from '../AppPressable';

type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

const SEVERITY_ORDER: Record<AlertSeverity, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  CRITICAL: 'Nghiêm trọng', HIGH: 'Cao', MEDIUM: 'Trung bình', LOW: 'Thông tin',
};

type Props = {
  alerts: SmartAlert[];
  completed: boolean;
  loading: boolean;
  error?: string | null;
  onRetry: () => void | Promise<unknown>;
};

export function TripAlertsSection({ alerts, completed, loading, error, onRetry }: Props) {
  const [expanded, setExpanded] = useState(false);
  const sortedAlerts = useMemo(() => [...alerts].sort(compareAlerts), [alerts]);
  const severityCounts = useMemo(() => countSeverities(sortedAlerts), [sortedAlerts]);
  const familyCounts = useMemo(() => countFamilies(sortedAlerts), [sortedAlerts]);
  const defaultVisibleCount = completed ? 0 : 3;
  const visibleAlerts = expanded ? sortedAlerts : sortedAlerts.slice(0, defaultVisibleCount);
  const hasCritical = severityCounts.CRITICAL > 0;

  return (
    <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="rounded-3xl border p-5 shadow-sm">
      <View className="flex-row items-start gap-3">
        <View style={{ backgroundColor: hasCritical && !completed ? colors.status.danger.bg : colors.brand.primarySoft }} className="h-10 w-10 items-center justify-center rounded-xl">
          <Ionicons name={completed ? 'document-text-outline' : 'notifications-outline'} size={21} color={hasCritical && !completed ? colors.status.danger.main : colors.brand.primary} />
        </View>
        <View className="flex-1">
          <Text style={{ color: colors.text.primary }} className="text-base font-bold">{completed ? 'Tổng kết cảnh báo' : 'Cảnh báo vận hành'}</Text>
          {!loading && !error ? (
            <Text style={{ color: colors.text.secondary }} className="mt-1 text-sm">
              {alerts.length > 0 ? completed ? `${alerts.length} cảnh báo trong chuyến` : `${alerts.length} cảnh báo đang được theo dõi` : 'Không ghi nhận cảnh báo'}
            </Text>
          ) : null}
        </View>
        {!loading && !error && alerts.length > 0 ? (
          <View style={{ backgroundColor: colors.surface.muted }} className="rounded-full px-3 py-1.5">
            <Text style={{ color: colors.text.primary }} className="text-xs font-bold">{alerts.length}</Text>
          </View>
        ) : null}
      </View>

      {loading ? (
        <View className="items-center py-5">
          <ActivityIndicator color={colors.brand.primary} />
          <Text style={{ color: colors.text.secondary }} className="mt-2 text-sm">Đang tải cảnh báo...</Text>
        </View>
      ) : error ? (
        <View style={{ backgroundColor: colors.status.danger.bg, borderColor: colors.status.danger.border }} className="mt-4 rounded-2xl border p-4">
          <Text style={{ color: colors.status.danger.main }} className="text-sm leading-5">Cảnh báo tạm thời chưa tải được.</Text>
          <Pressable onPress={() => void onRetry()} className="mt-3 self-start rounded-lg px-3 py-2" style={{ backgroundColor: colors.status.danger.main }}>
            <Text className="text-sm font-bold text-white">Thử lại</Text>
          </Pressable>
        </View>
      ) : alerts.length === 0 ? (
        <Text style={{ color: colors.text.secondary }} className="pt-4 text-sm leading-5">Chuyến đi không ghi nhận cảnh báo vận hành.</Text>
      ) : (
        <>
          <View className="mt-4 flex-row flex-wrap gap-2">
            <SummaryPill label="Nghiêm trọng" count={severityCounts.CRITICAL} severity="CRITICAL" />
            <SummaryPill label="Cao" count={severityCounts.HIGH} severity="HIGH" />
            <SummaryPill label="Trung bình" count={severityCounts.MEDIUM} severity="MEDIUM" />
            {severityCounts.LOW > 0 ? <SummaryPill label="Thông tin" count={severityCounts.LOW} severity="LOW" /> : null}
          </View>
          <View className="mt-3 flex-row flex-wrap gap-2">
            {familyCounts.map((family) => (
              <View key={family.key} style={{ backgroundColor: colors.surface.muted }} className="rounded-lg px-2.5 py-1.5">
                <Text style={{ color: colors.text.secondary }} className="text-xs font-semibold">{family.label} · {family.count}</Text>
              </View>
            ))}
          </View>
          {!completed && hasCritical && !expanded ? (
            <View style={{ backgroundColor: colors.status.danger.bg, borderColor: colors.status.danger.border }} className="mt-4 rounded-xl border px-3 py-2.5">
              <Text style={{ color: colors.status.danger.main }} className="text-sm font-bold">{severityCounts.CRITICAL} cảnh báo nghiêm trọng cần chú ý</Text>
            </View>
          ) : null}
          {visibleAlerts.length > 0 ? (
            <View className="mt-4 gap-3">
              {visibleAlerts.map((alert, index) => <CompactAlertCard key={alert.alertId || `${alert.createdAt}-${index}`} alert={alert} />)}
            </View>
          ) : null}
          {completed || alerts.length > defaultVisibleCount ? (
            <Pressable onPress={() => setExpanded((current) => !current)} style={{ borderColor: colors.border.default, backgroundColor: colors.surface.cardSoft }} className="mt-4 flex-row items-center justify-center rounded-xl border px-4 py-3">
              <Text style={{ color: colors.brand.primary }} className="text-sm font-bold">{expanded ? 'Thu gọn' : completed ? 'Xem chi tiết' : `Xem tất cả cảnh báo (${alerts.length})`}</Text>
              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.brand.primary} style={{ marginLeft: 6 }} />
            </Pressable>
          ) : null}
        </>
      )}
    </View>
  );
}

function CompactAlertCard({ alert }: { alert: SmartAlert }) {
  const [showFullMessage, setShowFullMessage] = useState(false);
  const severity = getAlertSeverity(alert);
  const palette = getSeverityPalette(severity);
  const message = alert.message?.trim() || 'Không có nội dung.';
  const canExpandMessage = message.length > 150;
  return (
    <View style={{ backgroundColor: palette.bg, borderColor: palette.border }} className="rounded-2xl border p-3.5">
      <View className="flex-row items-start gap-3">
        <Ionicons name={getAlertIcon(alert)} size={20} color={palette.main} />
        <View className="flex-1">
          <View className="flex-row items-start gap-2">
            <Text style={{ color: colors.text.primary }} className="flex-1 text-sm font-bold leading-5">{getFriendlyAlertTitle(alert)}</Text>
            <View style={{ backgroundColor: palette.badge }} className="rounded-full px-2 py-1">
              <Text style={{ color: palette.main }} className="text-[11px] font-bold">{SEVERITY_LABEL[severity]}</Text>
            </View>
          </View>
          <Text style={{ color: colors.text.secondary }} className="mt-1 text-xs font-semibold">{getAlertFamily(alert).label}{typeof alert.smartRiskScore === 'number' ? ` · ${alert.smartRiskScore.toFixed(0)} điểm` : ''}</Text>
          <Text numberOfLines={showFullMessage ? undefined : 3} style={{ color: colors.text.primary }} className="mt-2 text-sm leading-5">{message}</Text>
          <View className="mt-2 flex-row items-center justify-between gap-3">
            <Text style={{ color: colors.text.muted }} className="text-xs">{formatAlertTime(alert.createdAt)}</Text>
            {canExpandMessage ? <Pressable onPress={() => setShowFullMessage((current) => !current)}><Text style={{ color: colors.brand.primary }} className="text-xs font-bold">{showFullMessage ? 'Thu nội dung' : 'Xem chi tiết'}</Text></Pressable> : null}
          </View>
        </View>
      </View>
    </View>
  );
}

function SummaryPill({ label, count, severity }: { label: string; count: number; severity: AlertSeverity }) {
  const palette = getSeverityPalette(severity);
  return <View style={{ backgroundColor: palette.bg, borderColor: palette.border }} className="rounded-full border px-3 py-1.5"><Text style={{ color: palette.main }} className="text-xs font-bold">{count} {label.toLowerCase()}</Text></View>;
}

function compareAlerts(left: SmartAlert, right: SmartAlert) {
  const severityDifference = SEVERITY_ORDER[getAlertSeverity(right)] - SEVERITY_ORDER[getAlertSeverity(left)];
  return severityDifference || toTimestamp(right.createdAt) - toTimestamp(left.createdAt);
}

function countSeverities(alerts: SmartAlert[]) {
  return alerts.reduce<Record<AlertSeverity, number>>((counts, alert) => { counts[getAlertSeverity(alert)] += 1; return counts; }, { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 });
}

function countFamilies(alerts: SmartAlert[]) {
  const counts = new Map<string, { key: string; label: string; count: number }>();
  alerts.forEach((alert) => { const family = getAlertFamily(alert); counts.set(family.key, { ...family, count: (counts.get(family.key)?.count ?? 0) + 1 }); });
  return Array.from(counts.values()).sort((left, right) => right.count - left.count);
}

function getAlertSeverity(alert: SmartAlert): AlertSeverity {
  const explicit = alert.severity?.trim().toUpperCase();
  if (explicit === 'CRITICAL') return 'CRITICAL';
  if (explicit === 'HIGH') return 'HIGH';
  if (explicit === 'MEDIUM' || explicit === 'WATCH' || explicit === 'WARNING') return 'MEDIUM';
  if (explicit === 'LOW' || explicit === 'INFO' || explicit === 'NORMAL') return 'LOW';
  const type = alert.alertType?.trim().toUpperCase();
  if (type === 'TEMP_CRITICAL') return 'CRITICAL';
  if (type === 'TEMP_HIGH' || type === 'DOOR_OPEN') return 'HIGH';
  if (type === 'TEMP_FORECAST_BREACH') return 'MEDIUM';
  if (type === 'SMART_COLDCHAIN_RISK') {
    const score = alert.smartRiskScore ?? 0;
    if (score >= 90) return 'CRITICAL';
    if (score >= 70) return 'HIGH';
    if (score >= 40) return 'MEDIUM';
  }
  return 'LOW';
}

function getAlertFamily(alert: SmartAlert) {
  const type = alert.alertType?.trim().toUpperCase();
  if (type === 'SMART_COLDCHAIN_RISK') return { key: 'SMART', label: 'Phân tích tổng hợp' };
  if (type === 'TEMP_FORECAST_BREACH') return { key: 'SSA', label: 'Dự báo xu hướng' };
  if (type === 'TEMP_CRITICAL' || type === 'TEMP_HIGH' || type === 'DOOR_OPEN') return { key: 'RISK', label: 'Cảnh báo rủi ro' };
  return { key: type || 'OTHER', label: 'Cảnh báo khác' };
}

function getFriendlyAlertTitle(alert: SmartAlert) {
  switch (alert.alertType?.trim().toUpperCase()) {
    case 'TEMP_CRITICAL': return 'Nhiệt độ ở mức nguy hiểm';
    case 'TEMP_HIGH': return 'Nhiệt độ vượt ngưỡng';
    case 'DOOR_OPEN': return 'Cửa xe mở bất thường';
    case 'TEMP_FORECAST_BREACH': return 'Dự báo nhiệt độ vượt ngưỡng';
    case 'SMART_COLDCHAIN_RISK': return 'Phân tích rủi ro tổng hợp';
    default: return alert.title?.trim() || alert.alertType?.trim() || 'Cảnh báo vận hành';
  }
}

function getAlertIcon(alert: SmartAlert): React.ComponentProps<typeof Ionicons>['name'] {
  switch (alert.alertType?.trim().toUpperCase()) {
    case 'DOOR_OPEN': return 'lock-open-outline';
    case 'TEMP_CRITICAL':
    case 'TEMP_HIGH': return 'thermometer-outline';
    case 'TEMP_FORECAST_BREACH': return 'trending-up-outline';
    case 'SMART_COLDCHAIN_RISK': return 'analytics-outline';
    default: return 'alert-circle-outline';
  }
}

function getSeverityPalette(severity: AlertSeverity) {
  if (severity === 'CRITICAL') return { ...colors.status.danger, badge: '#FEE2E2' };
  if (severity === 'HIGH') return { ...colors.status.warning, badge: '#FFEDD5' };
  if (severity === 'MEDIUM') return { main: '#A16207', bg: '#FFFBEB', border: '#FDE68A', badge: '#FEF3C7' };
  return { ...colors.status.info, badge: '#CFFAFE' };
}

function formatAlertTime(value?: string | null) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month} · ${hour}:${minute}`;
}

function toTimestamp(value?: string | null) { const timestamp = Date.parse(value ?? ''); return Number.isFinite(timestamp) ? timestamp : 0; }
