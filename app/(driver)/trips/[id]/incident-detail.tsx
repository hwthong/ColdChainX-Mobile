import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { IncidentWorkflowStepper } from '../../../../components/driver/IncidentWorkflowStepper';
import { StatusBadge } from '../../../../components/StatusBadge';
import { colors } from '../../../../constants/colors';
import { getApiErrorMessage } from '../../../../services/apiClient';
import {
  assessIncidentRisk,
  continueTrip,
  getIncidentDetail,
  IncidentResponse,
  resolveIncident,
} from '../../../../services/incidentApi';
import { useAuthStore } from '../../../../store/useAuthStore';

const POLL_MS = 10_000;

const INCIDENT_TYPE_LABEL: Record<string, string> = {
  VEHICLE_BREAKDOWN: 'Xe hư',
  REEFER_BREAKDOWN: 'Thùng/máy lạnh hư',
  DAMAGE_CARGO: 'Hỏng hàng hóa',
  TEMP_EXCURSION: 'Biến động nhiệt độ',
  ACCIDENT: 'Tai nạn',
  DELAY: 'Chậm trễ',
};

const SEVERITY_LABEL: Record<string, string> = {
  LOW: 'Thấp',
  MEDIUM: 'Trung bình',
  HIGH: 'Cao',
  CRITICAL: 'Nghiêm trọng (CRITICAL)',
};

/** Hai loại này luôn bị backend ép lên CRITICAL */
const BREAKDOWN_TYPES = ['VEHICLE_BREAKDOWN', 'REEFER_BREAKDOWN'];

export default function DriverIncidentDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[]; incidentId?: string | string[] }>();
  const incidentId = Array.isArray(params.incidentId) ? params.incidentId[0] : params.incidentId;
  const router = useRouter();
  const token = useAuthStore((state) => state.token);

  const [incident, setIncident] = useState<IncidentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // ── Nhánh CRITICAL: Containment checkbox ──────────────────────────────────
  const [containmentConfirmed, setContainmentConfirmed] = useState(false);

  // ── Nhánh LOW: Continue trip modal ────────────────────────────────────────
  const [isContinueTripModalVisible, setIsContinueTripModalVisible] = useState(false);
  const [continueTripNote, setContinueTripNote] = useState('');
  const [isContinueTripSubmitting, setIsContinueTripSubmitting] = useState(false);

  // ── Resolve Modal (chỉ khi REDISPATCHED_TO_CUSTOMER) ──────────────────────
  const [isResolveModalVisible, setIsResolveModalVisible] = useState(false);
  const [resolveNote, setResolveNote] = useState('');
  const [isSubmittingResolve, setIsSubmittingResolve] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────

  const loadIncident = useCallback(async () => {
    if (!token || !incidentId) return null;
    try {
      const response = await getIncidentDetail(token, incidentId);
      if (!response.success || !response.data) {
        setError(response.message || 'Không thể tải thông tin sự cố.');
        return null;
      }
      setIncident(response.data);
      setError(null);
      return response.data;
    } catch (e: unknown) {
      setError(getApiErrorMessage(e));
      return null;
    }
  }, [token, incidentId]);

  useFocusEffect(
    useCallback(() => {
      if (!token || !incidentId) {
        setError('Thiếu phiên đăng nhập hoặc IncidentId hợp lệ.');
        setLoading(false);
        return;
      }
      let disposed = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      let inFlight = false;
      let appState = AppState.currentState;

      const clear = () => {
        if (timer) clearTimeout(timer);
        timer = null;
      };
      const poll = async () => {
        if (disposed || inFlight || appState !== 'active') return;
        inFlight = true;
        const current = await loadIncident();
        inFlight = false;
        setLoading(false);
        if (disposed) return;
        if (current?.status === 'RESOLVED' || current?.status === 'CONTINUED') {
          clear();
          return;
        }
        clear();
        timer = setTimeout(() => void poll(), POLL_MS);
      };

      void poll();
      const sub = AppState.addEventListener('change', (nextState) => {
        appState = nextState;
        if (nextState !== 'active') clear();
        else void poll();
      });

      return () => {
        disposed = true;
        clear();
        sub.remove();
      };
    }, [loadIncident, token, incidentId])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadIncident();
    setRefreshing(false);
  };

  // ── CRITICAL: Xác nhận Containment ────────────────────────────────────────
  // FE hard-code riskLevel=CRITICAL — không cho Driver chọn mức thấp hơn
  // cho VEHICLE_BREAKDOWN / REEFER_BREAKDOWN.
  const handleAssessContainment = async () => {
    if (!containmentConfirmed) {
      Alert.alert('Yêu cầu xác nhận', 'Vui lòng đánh dấu vào ô xác nhận đã đóng kín và bảo toàn hàng.');
      return;
    }
    if (!token || !incidentId) return;
    setActionLoading(true);
    try {
      const res = await assessIncidentRisk(token, incidentId, {
        riskLevel: 'CRITICAL',
        temperatureSource: 'NONE',
        temperatureStable: false,
        containmentConfirmed: true,
        note: 'Đã bảo toàn hàng',
      });
      if (res.success) {
        Alert.alert('Thành công', 'Đã xác nhận bảo toàn hàng. Hệ thống chuyển sang bước lập phương án cứu hộ.');
        await loadIncident();
      } else {
        Alert.alert('Lỗi', res.message || 'Không thể xác nhận bảo toàn hàng.');
      }
    } catch (e: unknown) {
      Alert.alert('Lỗi', getApiErrorMessage(e));
    } finally {
      setActionLoading(false);
    }
  };

  // ── LOW: Xác nhận tiếp tục chuyến ─────────────────────────────────────────
  const handleSubmitContinueTrip = async () => {
    if (!token || !incidentId) return;
    setIsContinueTripSubmitting(true);
    try {
      const res = await continueTrip(
        token,
        incidentId,
        continueTripNote.trim() || 'Đã tự xử lý tại chỗ, tiếp tục hành trình.'
      );
      if (res.success) {
        setIsContinueTripModalVisible(false);
        Alert.alert('Thành công', 'Đã xác nhận tiếp tục chuyến. Hành trình được tiếp tục bình thường.');
        await loadIncident();
      } else {
        Alert.alert('Lỗi', res.message || 'Không thể xác nhận tiếp tục chuyến.');
      }
    } catch (e: unknown) {
      Alert.alert('Lỗi', getApiErrorMessage(e));
    } finally {
      setIsContinueTripSubmitting(false);
    }
  };

  // ── Resolve sự cố ─────────────────────────────────────────────────────────
  // Chỉ cho phép khi REDISPATCHED_TO_CUSTOMER (CRITICAL path).
  // Spec: "Không cho resolve ở READY_FOR_REDISPATCH hoặc REDISPATCH_PLANNED"
  const handleConfirmResolve = async () => {
    if (!token || !incidentId) return;
    setIsSubmittingResolve(true);
    try {
      const res = await resolveIncident(
        token,
        incidentId,
        resolveNote.trim() || 'Sự cố đã được xử lý hoàn tất và giao khách an toàn.'
      );
      if (res.success) {
        setIsResolveModalVisible(false);
        Alert.alert('Thành công', 'Đã đóng sự cố thành công.');
        await loadIncident();
      } else {
        Alert.alert('Lỗi', res.message || 'Không thể đóng sự cố.');
      }
    } catch (e: unknown) {
      Alert.alert('Lỗi', getApiErrorMessage(e));
    } finally {
      setIsSubmittingResolve(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render guards
  if (loading) {
    return (
      <View style={{ backgroundColor: colors.surface.page }} className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.brand.primary} />
        <Text style={{ color: colors.brand.primary }} className="mt-4 font-medium">
          Đang tải chi tiết sự cố...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ backgroundColor: colors.surface.page }} className="flex-1 items-center justify-center p-5">
        <View className="items-center rounded-2xl bg-red-50 p-6">
          <Ionicons name="alert-circle-outline" size={48} color={colors.status.danger.main} />
          <Text style={{ color: colors.status.danger.main }} className="mt-4 text-center font-semibold">
            {error}
          </Text>
          <Pressable onPress={handleRefresh} style={{ backgroundColor: colors.status.danger.main }} className="mt-6 rounded-xl px-6 py-3">
            <Text style={{ color: colors.text.onPrimary }} className="font-bold">Thử lại</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!incident) {
    return (
      <View style={{ backgroundColor: colors.surface.page }} className="flex-1 items-center justify-center">
        <Text style={{ color: colors.text.secondary }} className="font-medium">
          Không tìm thấy dữ liệu sự cố.
        </Text>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  const isBreakdown = BREAKDOWN_TYPES.includes(incident.incidentType);
  // Backend severity: LOW | MEDIUM | HIGH | CRITICAL
  // MEDIUM và HIGH → WARNING path (theo dõi, có thể escalate lên CRITICAL)
  // Chỉ CRITICAL mới bắt buộc cứu hộ toàn diện
  const isCritical = incident.severity === 'CRITICAL';
  const isWarning = incident.severity === 'MEDIUM' || incident.severity === 'HIGH'; // MEDIUM|HIGH → WARNING
  const isLow = incident.severity === 'LOW';
  // Non-breakdown REPORTED chờ hệ thống phân loại
  const isNonBreakdownReported =
    !isBreakdown && incident.status === 'REPORTED';

  const destinationWarehouseName =
    incident.externalReeferPlan?.destinationWarehouseName ||
    incident.externalReeferPlan?.routeDestinationCity ||
    'Kho đích tuyến';

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={{ backgroundColor: colors.surface.page }} className="flex-1">

      {/* 3.0 APPBAR CỐ ĐỊNH: mã Incident, badge trạng thái, stepper */}
      <View
        style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }}
        className="border-b px-4 pt-12 pb-3 shadow-sm"
      >
        <View className="flex-row items-center justify-between mb-2">
          <Pressable onPress={() => router.back()} style={{ backgroundColor: colors.brand.primarySoft }} className="rounded-full p-2">
            <Ionicons name="arrow-back" size={20} color={colors.brand.primary} />
          </Pressable>
          <View className="flex-1 px-3">
            <Text style={{ color: colors.text.secondary }} className="text-[10px] font-bold uppercase tracking-wider">
              Mã Sự Cố
            </Text>
            <Text numberOfLines={1} style={{ color: colors.text.primary }} className="text-base font-bold">
              {incident.incidentId}
            </Text>
          </View>
          <StatusBadge status={incident.status} showVietnameseLabel />
        </View>

        {/* Stepper — truyền severity để chọn đúng template */}
        <IncidentWorkflowStepper status={incident.status} severity={incident.severity} />
      </View>

      {/* ── SCROLL CONTENT ─────────────────────────────────────────────────── */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 14 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.brand.primary} />}
      >

        {/* Kho đích (chỉ hiển thị khi đang ở CRITICAL rescue flow) */}
        {isCritical && incident.externalReeferPlan && (
          <View
            style={{ backgroundColor: '#F8FAFC', borderColor: '#CBD5E1' }}
            className="flex-row items-center justify-between rounded-2xl border p-4 shadow-sm"
          >
            <View className="flex-row items-center gap-3">
              <View className="h-9 w-9 items-center justify-center rounded-xl bg-slate-200">
                <Ionicons name="lock-closed" size={18} color="#334155" />
              </View>
              <View>
                <Text style={{ color: colors.text.secondary }} className="text-xs font-semibold">
                  Kho đích bắt buộc theo tuyến
                </Text>
                <Text style={{ color: colors.text.primary }} className="text-sm font-bold">
                  {destinationWarehouseName} 🔒
                </Text>
              </View>
            </View>
            <View className="rounded-lg bg-amber-100 px-2 py-1">
              <Text className="text-[10px] font-bold text-amber-800">Cố định tuyến</Text>
            </View>
          </View>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            NHÁNH CRITICAL — VEHICLE_BREAKDOWN / REEFER_BREAKDOWN
            (Backend luôn ép CRITICAL cho 2 loại này)
            ════════════════════════════════════════════════════════════════════ */}

        {/* Bước 1 CRITICAL: Containment checklist */}
        {isBreakdown && (incident.status === 'REPORTED' || incident.status === 'CONTAINMENT_REQUIRED') && (
          <View style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA' }} className="gap-3 rounded-3xl border p-5 shadow-sm">
            <View className="flex-row items-center gap-2">
              <Ionicons name="shield-checkmark" size={22} color="#991B1B" />
              <Text className="text-base font-bold text-red-900">Checklist Bảo Toàn Hàng Hóa</Text>
            </View>
            <Text className="text-xs leading-5 text-red-800">
              Sự cố xe / máy lạnh hư luôn được xác định là{' '}
              <Text className="font-bold">CRITICAL</Text>. Đóng kín cửa thùng ngay để giữ nhiệt cho toàn bộ hàng.
            </Text>
            <Pressable
              onPress={() => setContainmentConfirmed(!containmentConfirmed)}
              style={{
                backgroundColor: colors.surface.card,
                borderColor: containmentConfirmed ? colors.brand.primary : colors.border.default,
              }}
              className="flex-row items-center gap-3 rounded-2xl border p-4"
            >
              <Ionicons
                name={containmentConfirmed ? 'checkbox' : 'square-outline'}
                size={26}
                color={containmentConfirmed ? colors.brand.primary : colors.text.secondary}
              />
              <Text style={{ color: colors.text.primary }} className="flex-1 text-sm font-semibold">
                Tôi xác nhận hàng đã được đóng kín và bảo toàn
              </Text>
            </Pressable>
          </View>
        )}

        {/* Bước 2 CRITICAL: Đang lập phương án — Dispatcher thuê xe (web) */}
        {isCritical && incident.status === 'RESCUE_PLANNING' && (
          <View style={{ backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }} className="gap-3 rounded-3xl border p-5 shadow-sm">
            <View className="flex-row items-center gap-2">
              <Ionicons name="construct-outline" size={22} color="#C2410C" />
              <Text className="text-base font-bold text-amber-900">Đang Lập Phương Án Cứu Hộ</Text>
            </View>
            <Text className="text-xs leading-5 text-amber-800">
              Dispatcher đang thuê xe lạnh ngoài để cứu hộ. Hàng sẽ được vận chuyển về{' '}
              <Text className="font-bold">{destinationWarehouseName}</Text>. Vui lòng giữ nguyên vị trí và bảo toàn hàng.
            </Text>
            <View className="rounded-xl bg-amber-100 p-3">
              <Text className="text-xs text-amber-900">
                ℹ <Text className="font-bold">Lưu ý:</Text> Không tự tiếp tục giao hàng. Chờ xe cứu hộ đến.
              </Text>
            </View>
          </View>
        )}

        {/* Bước 2/3 CRITICAL: Theo dõi xe lạnh ngoài — Driver chỉ xem */}
        {incident.status === 'EXTERNAL_REEFER_IN_TRANSIT' && incident.externalReeferPlan && (
          <View style={{ backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }} className="gap-3 rounded-3xl border p-5 shadow-sm">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Ionicons name="car-outline" size={22} color="#C2410C" />
                <Text className="text-base font-bold text-amber-900">Theo Dõi Xe Lạnh Thuê Ngoài</Text>
              </View>
              <View className="rounded-lg bg-orange-200 px-2 py-1">
                <Text className="text-[10px] font-bold text-orange-900">Đang di chuyển</Text>
              </View>
            </View>
            <InfoRow label="Nhà cung cấp" value={incident.externalReeferPlan.rentalProvider} />
            <InfoRow label="Biển số xe ngoài" value={incident.externalReeferPlan.vehiclePlate} />
            <InfoRow
              label="Tài xế xe ngoài"
              value={`${incident.externalReeferPlan.driverName}${
                incident.externalReeferPlan.driverPhone ? ` (${incident.externalReeferPlan.driverPhone})` : ''
              }`}
            />
            <InfoRow label="Nhiệt độ cam kết" value={`${incident.externalReeferPlan.agreedTemperature}°C`} />
            <InfoRow label="Số seal niêm phong" value={incident.externalReeferPlan.sealNumber} />
            <InfoRow label="Kho nhận" value={`${incident.externalReeferPlan.destinationWarehouseName || destinationWarehouseName} 🔒`} />
            <View className="mt-2 rounded-xl bg-orange-100 p-3">
              <Text className="text-xs text-orange-900">
                ℹ <Text className="font-bold">Lưu ý:</Text> Nhân viên kho sẽ Inbound hàng khi xe đến kho đích. Tài xế không cần thao tác thêm.
              </Text>
            </View>
          </View>
        )}

        {/* Bước 3/4 CRITICAL: Hàng đã IN_STOCK, chờ Dispatcher ghép chuyến */}
        {incident.status === 'READY_FOR_REDISPATCH' && (
          <View style={{ backgroundColor: '#F3E8FF', borderColor: '#E9D5FF' }} className="gap-3 rounded-3xl border p-5 shadow-sm">
            <View className="flex-row items-center gap-2">
              <Ionicons name="cube-outline" size={22} color="#6B21A8" />
              <Text className="text-base font-bold text-purple-950">Hàng Đã Nhập Kho (IN_STOCK)</Text>
            </View>
            <Text className="text-xs leading-5 text-purple-900">
              Toàn bộ LPN đã được Inbound an toàn về kho{' '}
              <Text className="font-bold">{destinationWarehouseName}</Text>. Dispatcher đang ghép chuyến mới để giao hàng.
            </Text>
          </View>
        )}

        {/* Bước 4/5 CRITICAL: Chuyến mới lên lịch, kho đang picking/loading */}
        {incident.status === 'REDISPATCH_PLANNED' && (
          <View style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }} className="gap-3 rounded-3xl border p-5 shadow-sm">
            <View className="flex-row items-center gap-2">
              <Ionicons name="navigate-circle-outline" size={22} color="#1D4ED8" />
              <Text className="text-base font-bold text-blue-950">Chuyến Mới Đã Được Lên Lịch</Text>
            </View>
            <Text className="text-xs leading-5 text-blue-900">
              Chuyến xe thay thế đã được tạo. Nhân viên kho đang Picking, Loading và kẹp chì (Seal) để xuất kho.
            </Text>
            {incident.redispatchPlan ? (
              <View className="rounded-xl bg-blue-100 p-3">
                <Text className="text-xs font-semibold text-blue-900">{incident.redispatchPlan}</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Bước 5 CRITICAL: Chuyến mới đang giao */}
        {incident.status === 'REDISPATCHED_TO_CUSTOMER' && (
          <View style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }} className="gap-3 rounded-3xl border p-5 shadow-sm">
            <View className="flex-row items-center gap-2">
              <Ionicons name="checkmark-circle-outline" size={22} color="#166534" />
              <Text className="text-base font-bold text-green-950">Đang Vận Chuyển Giao Khách</Text>
            </View>
            <Text className="text-xs leading-5 text-green-900">
              Chuyến xe mới đã xuất phát từ kho tuyến và đang giao hàng đến tay khách hàng.
            </Text>
          </View>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            NHÁNH LOW — Sự cố nhẹ, Driver tự xử lý
            States: REPORTED → TRIAGED → CONTINUED → RESOLVED
            ════════════════════════════════════════════════════════════════════ */}

        {/* Bước 1 LOW: Đã gửi báo cáo, chờ phân loại */}
        {isLow && incident.status === 'REPORTED' && (
          <View style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }} className="gap-3 rounded-3xl border p-5 shadow-sm">
            <View className="flex-row items-center gap-2">
              <Ionicons name="checkmark-circle-outline" size={22} color="#166534" />
              <Text className="text-base font-bold text-green-950">Báo Cáo Đã Gửi</Text>
            </View>
            <Text className="text-xs leading-5 text-green-900">
              Sự cố mức <Text className="font-bold">LOW</Text> đã được ghi nhận. Hệ thống đang phân loại. Bạn có thể tự xử lý tại chỗ nếu an toàn.
            </Text>
          </View>
        )}

        {/* Bước 2 LOW: TRIAGED — Driver tự xử lý và xác nhận tiếp tục chuyến */}
        {incident.status === 'TRIAGED' && (
          <View style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }} className="gap-3 rounded-3xl border p-5 shadow-sm">
            <View className="flex-row items-center gap-2">
              <Ionicons name="build-outline" size={22} color="#166534" />
              <Text className="text-base font-bold text-green-950">Sự Cố Mức Thấp — Tự Xử Lý</Text>
            </View>
            <Text className="text-xs leading-5 text-green-900">
              Sự cố này được đánh giá ở mức <Text className="font-bold">LOW</Text>. Bạn có thể tự xử lý tại chỗ rồi xác nhận tiếp tục hành trình.
            </Text>
            <View className="rounded-xl bg-green-100 p-3">
              <Text className="text-xs text-green-900">
                ℹ <Text className="font-bold">Không cần:</Text> Xe cứu hộ · Nhập lại kho · QC · Tạo trip mới.
              </Text>
            </View>
          </View>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            NHÁNH WARNING — Theo dõi nhiệt độ
            States: REPORTED → MONITORING → CONTINUED / escalate to CRITICAL
            ════════════════════════════════════════════════════════════════════ */}

        {/* Bước 1 WARNING: Đã gửi báo cáo (severity=MEDIUM hoặc HIGH) */}
        {isWarning && incident.status === 'REPORTED' && (
          <View style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }} className="gap-3 rounded-3xl border p-5 shadow-sm">
            <View className="flex-row items-center gap-2">
              <Ionicons name="warning-outline" size={22} color="#B45309" />
              <Text className="text-base font-bold text-amber-900">Báo Cáo Đã Gửi — Cần Theo Dõi (WARNING)</Text>
            </View>
            <Text className="text-xs leading-5 text-amber-800">
              Sự cố mức <Text className="font-bold">WARNING ({incident.severity})</Text>. Theo dõi nhiệt độ và tình trạng hàng liên tục. Hệ thống đang đánh giá.
            </Text>
          </View>
        )}

        {/* Fallback: Non-breakdown, REPORTED, severity chưa xác định hoặc không khớp LOW/WARNING */}
        {isNonBreakdownReported && !isLow && !isWarning && (
          <View style={{ backgroundColor: '#F8FAFC', borderColor: '#CBD5E1' }} className="gap-3 rounded-3xl border p-5 shadow-sm">
            <View className="flex-row items-center gap-2">
              <Ionicons name="hourglass-outline" size={22} color="#475569" />
              <Text className="text-base font-bold text-slate-800">Đã Gửi Báo Cáo — Đang Phân Loại</Text>
            </View>
            <Text className="text-xs leading-5 text-slate-700">
              Sự cố đã được ghi nhận. Hệ thống đang phân loại mức độ để xác định hướng xử lý phù hợp. Vui lòng chờ thông báo cập nhật.
            </Text>
          </View>
        )}

        {/* Bước 2 WARNING: MONITORING — Theo dõi nhiệt độ */}
        {incident.status === 'MONITORING' && (
          <View style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }} className="gap-3 rounded-3xl border p-5 shadow-sm">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Ionicons name="thermometer-outline" size={22} color="#B45309" />
                <Text className="text-base font-bold text-amber-900">Đang Theo Dõi Nhiệt Độ</Text>
              </View>
              <View className="rounded-lg bg-yellow-200 px-2 py-1">
                <Text className="text-[10px] font-bold text-yellow-900">WARNING</Text>
              </View>
            </View>

            {incident.latestTemperature !== undefined && incident.latestTemperature !== null ? (
              <InfoRow label="Nhiệt độ hiện tại" value={`${incident.latestTemperature}°C`} />
            ) : null}
            {incident.remainingSafeTimeMinutes !== undefined && incident.remainingSafeTimeMinutes !== null ? (
              <InfoRow label="Thời gian an toàn còn lại" value={`${incident.remainingSafeTimeMinutes} phút`} />
            ) : null}

            <View className="rounded-xl bg-yellow-100 p-3">
              <Text className="text-xs text-yellow-900">
                ⚠ <Text className="font-bold">Chú ý:</Text> Nếu nhiệt độ tiếp tục xấu đi, Dispatcher sẽ escalate lên CRITICAL và điều xe cứu hộ. Hãy giữ liên lạc và tiếp tục bảo vệ hàng.
              </Text>
            </View>
          </View>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TRẠNG THÁI CHUNG
            ════════════════════════════════════════════════════════════════════ */}

        {/* CONTINUED — Đã tiếp tục chuyến (LOW path hoặc WARNING ổn định) */}
        {incident.status === 'CONTINUED' && (
          <View style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }} className="gap-3 rounded-3xl border p-5 shadow-sm">
            <View className="flex-row items-center gap-2">
              <Ionicons name="checkmark-done-circle" size={24} color="#166534" />
              <Text className="text-base font-bold text-green-950">Đã Tiếp Tục Chuyến Bình Thường</Text>
            </View>
            <Text className="text-xs leading-5 text-green-900">
              Sự cố đã được xử lý tại chỗ. Hành trình đang tiếp tục bình thường.
            </Text>
          </View>
        )}

        {/* RESOLVED — Read-only hoàn toàn */}
        {incident.status === 'RESOLVED' && (
          <View style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }} className="gap-3 rounded-3xl border p-5 shadow-sm">
            <View className="flex-row items-center gap-2">
              <Ionicons name="checkmark-done-circle" size={24} color="#166534" />
              <Text className="text-base font-bold text-green-950">Sự Cố Đã Được Xử Lý Hoàn Tất</Text>
            </View>
            {incident.resolutionNote ? (
              <Text className="text-xs text-green-800">Ghi chú: {incident.resolutionNote}</Text>
            ) : null}
          </View>
        )}

        {/* ── THÔNG TIN CHUNG SỰ CỐ ─────────────────────────────────────── */}
        <View
          style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }}
          className="gap-4 rounded-3xl border p-5 shadow-sm"
        >
          <View className="flex-row items-center gap-2">
            <Ionicons name="information-circle-outline" size={20} color={colors.brand.primary} />
            <Text style={{ color: colors.text.primary }} className="text-base font-bold">Chi tiết sự cố</Text>
          </View>
          <InfoRow label="Loại sự cố" value={INCIDENT_TYPE_LABEL[incident.incidentType] || incident.incidentType} />
          <InfoRow label="Mức độ" value={SEVERITY_LABEL[incident.severity] || incident.severity} />
          <InfoRow label="Mô tả" value={incident.description} />
          <InfoRow label="Thời gian báo" value={new Date(incident.reportedAt).toLocaleString('vi-VN')} />
          <InfoRow label="Người báo cáo" value={incident.reportedByUsername || '--'} />
          <InfoRow label="Xe gặp sự cố" value={incident.brokenVehicleId || '--'} />
          <InfoRow
            label="Tọa độ GPS"
            value={
              incident.currentLatitude
                ? `${incident.currentLatitude.toFixed(5)}, ${incident.currentLongitude?.toFixed(5)}`
                : 'Không xác định'
            }
          />
        </View>

        {/* CHI PHÍ ĐÃ ỨNG */}
        {(incident.driverPaidAmount ?? 0) > 0 ? (
          <View
            style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }}
            className="gap-4 rounded-3xl border p-5 shadow-sm"
          >
            <View className="flex-row items-center gap-2">
              <Ionicons name="cash-outline" size={20} color={colors.brand.primary} />
              <Text style={{ color: colors.text.primary }} className="text-base font-bold">Chi phí phát sinh</Text>
            </View>
            <InfoRow label="Số tiền đã ứng" value={`${incident.driverPaidAmount?.toLocaleString('vi-VN')} VNĐ`} />
          </View>
        ) : null}

        {/* HÌNH ẢNH & CHỨNG TỪ */}
        {incident.evidences && incident.evidences.length > 0 && (
          <View
            style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }}
            className="gap-4 rounded-3xl border p-5 shadow-sm"
          >
            <View className="flex-row items-center gap-2">
              <Ionicons name="images-outline" size={20} color={colors.brand.primary} />
              <Text style={{ color: colors.text.primary }} className="text-base font-bold">
                Hình ảnh & Minh chứng ({incident.evidences.length})
              </Text>
            </View>
            {incident.evidences.map((e) => (
              <Pressable
                key={e.evidenceId}
                onPress={() => Linking.openURL(e.fileUrl)}
                style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }}
                className="flex-row items-center justify-between rounded-xl border p-3"
              >
                <View className="flex-row items-center gap-3">
                  <Ionicons name="image" size={22} color={colors.brand.primary} />
                  <Text style={{ color: colors.text.primary }} className="text-sm font-medium">
                    {e.evidenceType}
                  </Text>
                </View>
                <Ionicons name="open-outline" size={18} color={colors.brand.primary} />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── BOTTOM BAR CTA CỐ ĐỊNH (tối thiểu 48px) ─────────────────────── */}
      <View
        style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }}
        className="border-t p-4 shadow-lg"
      >
        {/* CTA: Non-breakdown REPORTED — read-only label chờ phân loại */}
        {isNonBreakdownReported && (
          <View style={{ minHeight: 48, backgroundColor: colors.surface.muted }} className="items-center justify-center rounded-2xl">
            <Text style={{ color: colors.text.secondary }} className="text-sm font-semibold">
              ⏳ Đang chờ hệ thống phân loại mức độ sự cố...
            </Text>
          </View>
        )}

        {/* CTA: CRITICAL breakdown — Xác nhận bảo toàn hàng */}
        {isBreakdown && (incident.status === 'REPORTED' || incident.status === 'CONTAINMENT_REQUIRED') && (
          <Pressable
            onPress={handleAssessContainment}
            disabled={actionLoading || !containmentConfirmed}
            style={{
              backgroundColor: !containmentConfirmed || actionLoading ? colors.surface.muted : colors.brand.primary,
              minHeight: 48,
            }}
            className="items-center justify-center rounded-2xl shadow-sm"
          >
            {actionLoading ? (
              <ActivityIndicator color={colors.text.onPrimary} />
            ) : (
              <Text
                style={{ color: !containmentConfirmed ? colors.text.secondary : colors.text.onPrimary }}
                className="text-base font-bold"
              >
                Xác nhận bảo toàn hàng
              </Text>
            )}
          </Pressable>
        )}

        {/* CTA: LOW — Xác nhận tiếp tục chuyến (từ TRIAGED) */}
        {incident.status === 'TRIAGED' && (
          <Pressable
            onPress={() => setIsContinueTripModalVisible(true)}
            style={{ backgroundColor: '#16A34A', minHeight: 48 }}
            className="items-center justify-center rounded-2xl shadow-sm"
          >
            <Text style={{ color: '#ffffff' }} className="text-base font-bold">
              Xác nhận tiếp tục chuyến
            </Text>
          </Pressable>
        )}

        {/* Read-only labels cho các trạng thái chờ */}
        {(incident.status === 'MONITORING' ||
          incident.status === 'RESCUE_PLANNING' ||
          incident.status === 'EXTERNAL_REEFER_IN_TRANSIT' ||
          incident.status === 'READY_FOR_REDISPATCH' ||
          incident.status === 'REDISPATCH_PLANNED') && (
          <View
            style={{ minHeight: 48, backgroundColor: colors.surface.muted }}
            className="items-center justify-center rounded-2xl"
          >
            <Text style={{ color: colors.text.secondary }} className="text-sm font-semibold">
              {incident.status === 'MONITORING' && '🌡️ Đang theo dõi — Chờ Dispatcher quyết định...'}
              {incident.status === 'RESCUE_PLANNING' && '⏳ Đang chờ Dispatcher thuê xe cứu hộ...'}
              {incident.status === 'EXTERNAL_REEFER_IN_TRANSIT' && '🚚 Xe lạnh đang trên đường đến kho...'}
              {incident.status === 'READY_FOR_REDISPATCH' && '⏳ Đang chờ Dispatcher ghép chuyến mới...'}
              {incident.status === 'REDISPATCH_PLANNED' && '📦 Kho đang picking & loading hàng...'}
            </Text>
          </View>
        )}

        {/* CTA: CRITICAL — Resolve (chỉ khi REDISPATCHED_TO_CUSTOMER) */}
        {incident.status === 'REDISPATCHED_TO_CUSTOMER' && (
          <Pressable
            onPress={() => setIsResolveModalVisible(true)}
            style={{ backgroundColor: '#166534', minHeight: 48 }}
            className="items-center justify-center rounded-2xl shadow-sm"
          >
            <Text style={{ color: colors.text.onPrimary }} className="text-base font-bold">
              Đóng sự cố (Resolve)
            </Text>
          </Pressable>
        )}

        {/* CONTINUED / RESOLVED — Read-only */}
        {(incident.status === 'CONTINUED' || incident.status === 'RESOLVED') && (
          <View style={{ minHeight: 48 }} className="items-center justify-center">
            <Text style={{ color: colors.text.secondary }} className="font-semibold">
              {incident.status === 'CONTINUED' ? '✅ Đã tiếp tục chuyến bình thường' : 'Sự cố đã được hoàn tất · Read-only'}
            </Text>
          </View>
        )}
      </View>

      {/* ════════════════════════════════════════════════════════════════════
          MODAL: XÁC NHẬN TIẾP TỤC CHUYẾN (LOW path - TRIAGED)
          ════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={isContinueTripModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsContinueTripModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/60">
          <View style={{ backgroundColor: colors.surface.card }} className="rounded-t-3xl p-6 shadow-2xl">
            <View className="mb-4 flex-row items-center justify-between border-b pb-3">
              <Text style={{ color: colors.text.primary }} className="text-lg font-bold">
                Xác Nhận Tiếp Tục Chuyến
              </Text>
              <Pressable onPress={() => setIsContinueTripModalVisible(false)} className="rounded-full bg-gray-100 p-2">
                <Ionicons name="close" size={20} color={colors.text.secondary} />
              </Pressable>
            </View>

            <Text style={{ color: colors.text.secondary }} className="text-xs leading-5 mb-3">
              Ghi lại cách bạn đã tự xử lý sự cố tại chỗ (tùy chọn). Sau khi xác nhận, chuyến hàng sẽ tiếp tục bình thường.
            </Text>

            <TextInput
              value={continueTripNote}
              onChangeText={setContinueTripNote}
              placeholder="Ví dụ: Đã thay lốp dự phòng tại chỗ, xe vận hành bình thường..."
              multiline
              numberOfLines={3}
              style={{ backgroundColor: colors.surface.page, borderColor: colors.border.default }}
              className="rounded-2xl border p-3 text-sm mb-4"
            />

            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setIsContinueTripModalVisible(false)}
                style={{ borderColor: colors.border.default }}
                className="flex-1 items-center rounded-xl border p-3"
              >
                <Text style={{ color: colors.text.secondary }} className="font-semibold">Hủy</Text>
              </Pressable>
              <Pressable
                onPress={handleSubmitContinueTrip}
                disabled={isContinueTripSubmitting}
                style={{ backgroundColor: '#16A34A', minHeight: 48 }}
                className="flex-1 items-center justify-center rounded-xl"
              >
                {isContinueTripSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="font-bold text-white">Xác nhận tiếp tục</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ════════════════════════════════════════════════════════════════════
          MODAL: ĐÓNG SỰ CỐ (CRITICAL path - REDISPATCHED_TO_CUSTOMER)
          ════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={isResolveModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsResolveModalVisible(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/60 px-5">
          <View style={{ backgroundColor: colors.surface.card }} className="w-full rounded-3xl p-6 shadow-xl">
            <Text style={{ color: colors.text.primary }} className="text-lg font-bold mb-2">
              Xác Nhận Đóng Sự Cố
            </Text>
            <Text style={{ color: colors.text.secondary }} className="text-xs leading-5 mb-4">
              Xác nhận toàn bộ quy trình cứu hộ, sang hàng và giao hàng cho khách đã hoàn thành trọn vẹn.
            </Text>
            <TextInput
              value={resolveNote}
              onChangeText={setResolveNote}
              placeholder="Ghi chú hoàn tất sự cố..."
              multiline
              numberOfLines={3}
              style={{ backgroundColor: colors.surface.page, borderColor: colors.border.default }}
              className="rounded-2xl border p-3 text-sm mb-4"
            />
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setIsResolveModalVisible(false)}
                style={{ borderColor: colors.border.default }}
                className="flex-1 items-center rounded-xl border p-3"
              >
                <Text style={{ color: colors.text.secondary }} className="font-semibold">Hủy</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmResolve}
                disabled={isSubmittingResolve}
                style={{ backgroundColor: '#166534' }}
                className="flex-1 items-center rounded-xl p-3"
              >
                {isSubmittingResolve ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="font-bold text-white">Đóng sự cố</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start justify-between gap-4 border-b border-slate-100 pb-2">
      <Text style={{ color: colors.text.secondary }} className="text-xs">
        {label}
      </Text>
      <Text numberOfLines={2} style={{ color: colors.text.primary }} className="flex-1 text-right text-xs font-semibold">
        {value}
      </Text>
    </View>
  );
}
