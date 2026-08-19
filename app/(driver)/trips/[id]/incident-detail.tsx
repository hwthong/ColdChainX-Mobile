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

import {
  getIncidentCurrentStepNumber,
  IncidentWorkflowStepper,
} from '../../../../components/driver/IncidentWorkflowStepper';
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
  const currentTripId = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const token = useAuthStore((state) => state.token);

  const [incident, setIncident] = useState<IncidentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // ── Tua xem lại các bước trên Stepper ──────────────────────────────────────
  const [selectedStep, setSelectedStep] = useState<number | null>(null);

  // ── Nhánh CRITICAL: Containment checkbox ──────────────────────────────────
  const [containmentConfirmed, setContainmentConfirmed] = useState(false);

  // ── Nhánh LOW: Continue trip modal ────────────────────────────────────────
  const [isContinueTripModalVisible, setIsContinueTripModalVisible] = useState(false);
  const [continueTripNote, setContinueTripNote] = useState('');
  const [isContinueTripSubmitting, setIsContinueTripSubmitting] = useState(false);

  // ── Resolve Modal ─────────────────────────────────────────────────────────
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
  const isCritical = incident.severity === 'CRITICAL';
  const isWarning = incident.severity === 'MEDIUM' || incident.severity === 'HIGH';
  const isLow = incident.severity === 'LOW';
  const isNonBreakdownReported = !isBreakdown && incident.status === 'REPORTED';

  const destinationWarehouseName =
    incident.externalReeferPlan?.destinationWarehouseName ||
    incident.externalReeferPlan?.routeDestinationCity ||
    'Kho đích tuyến';

  // Bước hiện tại thực tế trên hệ thống
  const currentStep = getIncidentCurrentStepNumber(incident.status, incident.severity);
  // Bước đang xem (tua lại hoặc hiện tại)
  const activeStep = selectedStep ?? currentStep;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={{ backgroundColor: colors.surface.page }} className="flex-1">

      {/* 3.0 APPBAR CỐ ĐỊNH: mã Incident, badge trạng thái, stepper có thể bấm tua */}
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

        {/* Stepper tương tác: cho phép chạm vào từng bước để tua xem thông tin */}
        <IncidentWorkflowStepper
          status={incident.status}
          severity={incident.severity}
          selectedStep={selectedStep}
          onSelectStep={(step) => setSelectedStep(step)}
        />
      </View>

      {/* ── SCROLL CONTENT ─────────────────────────────────────────────────── */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 14 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.brand.primary} />}
      >

        {/* Kho đích bắt buộc (chỉ hiển thị trong nhánh CRITICAL) */}
        {isCritical && (
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
            HIỂN THỊ CHI TIẾT THEO BƯỚC ĐANG CHỌN (activeStep)
            ════════════════════════════════════════════════════════════════════ */}

        {/* ─── BƯỚC 1: BÁO SỰ CỐ & BẢO TOÀN HÀNG ─── */}
        {activeStep === 1 && (
          <View style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA' }} className="gap-3 rounded-3xl border p-5 shadow-sm">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Ionicons name="shield-checkmark" size={22} color="#991B1B" />
                <Text className="text-base font-bold text-red-900">Bước 1: Báo Cáo & Bảo Toàn Hàng</Text>
              </View>
              <View className="rounded-lg bg-red-200 px-2 py-1">
                <Text className="text-[10px] font-bold text-red-950">
                  {currentStep > 1 ? '✓ Đã hoàn tất' : 'Bước hiện tại'}
                </Text>
              </View>
            </View>

            <Text className="text-xs leading-5 text-red-800">
              Sự cố xe / máy lạnh hư luôn được xác định là <Text className="font-bold">CRITICAL</Text>. Đóng kín cửa thùng xe ngay lập tức để bảo vệ cold chain.
            </Text>

            {/* Checkbox: chỉ tương tác nếu đang ở Bước 1 và chưa xác nhận */}
            {currentStep === 1 && (incident.status === 'REPORTED' || incident.status === 'CONTAINMENT_REQUIRED') ? (
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
            ) : (
              <View className="rounded-2xl bg-white/80 p-3.5 border border-red-200">
                <View className="flex-row items-center gap-2">
                  <Ionicons name="checkmark-circle" size={18} color="#166534" />
                  <Text className="text-xs font-bold text-green-900">
                    Đã hoàn thành xác nhận bảo toàn hàng hóa
                  </Text>
                </View>
                {incident.containmentConfirmedAt ? (
                  <Text className="text-[11px] text-slate-600 mt-1">
                    Thời gian: {new Date(incident.containmentConfirmedAt).toLocaleString('vi-VN')}
                  </Text>
                ) : null}
              </View>
            )}
          </View>
        )}

        {/* ─── BƯỚC 2: XE LẠNH THUÊ NGOÀI / LẬP PHƯƠNG ÁN CỨU HỘ ─── */}
        {activeStep === 2 && (
          <View style={{ backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }} className="gap-3 rounded-3xl border p-5 shadow-sm">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Ionicons name="car-outline" size={22} color="#C2410C" />
                <Text className="text-base font-bold text-amber-900">Bước 2: Xe Lạnh Thuê Ngoài Cứu Hộ</Text>
              </View>
              <View className="rounded-lg bg-orange-200 px-2 py-1">
                <Text className="text-[10px] font-bold text-orange-950">
                  {currentStep > 2 ? '✓ Đã điều xe' : currentStep === 2 ? 'Đang di chuyển' : 'Sắp tới'}
                </Text>
              </View>
            </View>

            {incident.externalReeferPlan ? (
              <View className="gap-2 pt-1">
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
                <InfoRow label="Kho nhận bắt buộc" value={`${incident.externalReeferPlan.destinationWarehouseName || destinationWarehouseName} 🔒`} />
              </View>
            ) : (
              <View className="py-2">
                <Text className="text-xs leading-5 text-amber-800">
                  Dispatcher đang lập phương án và liên hệ đối tác xe lạnh chuyên dụng để điều xe cứu hộ đến vị trí sự cố.
                </Text>
              </View>
            )}

            <View className="rounded-xl bg-orange-100 p-3">
              <Text className="text-xs text-orange-900">
                ℹ <Text className="font-bold">Lưu ý:</Text> Tài xế giữ nguyên vị trí, bàn giao seal và toàn bộ LPN cho xe cứu hộ khi xe đến nơi.
              </Text>
            </View>
          </View>
        )}

        {/* ─── BƯỚC 3: INBOUND KHO TUYẾN ─── */}
        {activeStep === 3 && (
          <View style={{ backgroundColor: '#F3E8FF', borderColor: '#E9D5FF' }} className="gap-3 rounded-3xl border p-5 shadow-sm">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Ionicons name="cube-outline" size={22} color="#6B21A8" />
                <Text className="text-base font-bold text-purple-950">Bước 3: Inbound Kho Đích Tuyến</Text>
              </View>
              <View className="rounded-lg bg-purple-200 px-2 py-1">
                <Text className="text-[10px] font-bold text-purple-950">
                  {currentStep > 3 ? '✓ Đã nhập kho' : currentStep === 3 ? 'Đang Inbound' : 'Chờ xe đến'}
                </Text>
              </View>
            </View>

            <Text className="text-xs leading-5 text-purple-900">
              Xe cứu hộ chở hàng về <Text className="font-bold">{destinationWarehouseName} 🔒</Text>. Nhân viên kho quét/nhập số seal để Inbound tự động toàn bộ LPN sang trạng thái <Text className="font-bold">IN_STOCK</Text>.
            </Text>

            <View className="gap-2 rounded-2xl bg-white/80 p-3.5 border border-purple-200">
              <InfoRow label="Kho nhận" value={`${destinationWarehouseName} 🔒`} />
              <InfoRow label="Số seal Inbound" value={incident.externalReeferPlan?.sealNumber || 'Theo xe ngoài'} />
              <InfoRow label="Quy chuẩn Inbound" value="Tự động toàn bộ LPN (Không QC)" />
            </View>
          </View>
        )}

        {/* ─── BƯỚC 4: GHÉP CHUYẾN MỚI (REDISPATCH) ─── */}
        {activeStep === 4 && (
          <View style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }} className="gap-3 rounded-3xl border p-5 shadow-sm">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Ionicons name="navigate-circle-outline" size={22} color="#1D4ED8" />
                <Text className="text-base font-bold text-blue-950">Bước 4: Ghép Chuyến Lại (Redispatch)</Text>
              </View>
              <View className="rounded-lg bg-blue-200 px-2 py-1">
                <Text className="text-[10px] font-bold text-blue-950">
                  {currentStep > 4 ? '✓ Đã tạo chuyến' : currentStep === 4 ? 'Đang xử lý' : 'Sắp tới'}
                </Text>
              </View>
            </View>

            <Text className="text-xs leading-5 text-blue-900">
              Dispatcher tạo chuyến xe thay thế tại kho tuyến. Giữ nguyên toàn bộ LPN của sự cố để tiếp tục hành trình giao khách.
            </Text>

            {incident.redispatchPlan ? (
              <View className="rounded-xl bg-blue-100 p-3">
                <Text className="text-xs font-semibold text-blue-900">{incident.redispatchPlan}</Text>
              </View>
            ) : null}

            <View className="gap-2 rounded-2xl bg-white/80 p-3.5 border border-blue-200">
              <InfoRow label="Kho xuất phát" value={`${destinationWarehouseName} 🔒`} />
              <InfoRow label="LPN ghép chuyến" value="Toàn bộ LPN sự cố (Khóa cố định)" />
              {incident.replacementVehicleId ? (
                <InfoRow label="Xe phân công mới" value={incident.replacementVehicleId} />
              ) : null}
            </View>
          </View>
        )}

        {/* ─── BƯỚC 5: GIAO HÀNG CHO KHÁCH & ĐÓNG SỰ CỐ ─── */}
        {activeStep === 5 && (
          <View style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }} className="gap-3 rounded-3xl border p-5 shadow-sm">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Ionicons name="checkmark-circle-outline" size={22} color="#166534" />
                <Text className="text-base font-bold text-green-950">
                  {incident.status === 'TRANSLOAD_COMPLETED' ? 'Bước 5: Đã Đổi Xe & Tiếp Tục Giao Hàng' : 'Bước 5: Giao Hàng Cho Khách'}
                </Text>
              </View>
              <View className="rounded-lg bg-green-200 px-2 py-1">
                <Text className="text-[10px] font-bold text-green-950">
                  {incident.status === 'RESOLVED' ? '✓ Đã đóng sự cố' : 'Đang giao khách'}
                </Text>
              </View>
            </View>

            <Text className="text-xs leading-5 text-green-900">
              {incident.status === 'TRANSLOAD_COMPLETED'
                ? 'Hàng hóa đã được sang xe thay thế an toàn. Tài xế tiếp tục hành trình giao hàng cho khách theo lộ trình.'
                : 'Chuyến xe mới đã rời kho tuyến và đang trong quá trình giao hàng đến tay khách hàng.'}
            </Text>

            <View className="gap-2 rounded-2xl bg-white/80 p-3.5 border border-green-200">
              {incident.brokenVehicleId ? (
                <InfoRow label="Xe cũ gặp sự cố" value={incident.brokenVehicleId} />
              ) : null}
              {incident.replacementVehicleId ? (
                <InfoRow label="Xe thay thế hiện tại" value={incident.replacementVehicleId} />
              ) : null}
              {incident.tripCode || incident.tripId || currentTripId ? (
                <InfoRow label="Mã chuyến đang chạy" value={incident.tripCode || incident.tripId || currentTripId || '--'} />
              ) : null}
              {incident.resolvedAt ? (
                <InfoRow label="Thời gian đóng" value={new Date(incident.resolvedAt).toLocaleString('vi-VN')} />
              ) : null}
            </View>
          </View>
        )}

        {/* ─── NHÁNH LOW / WARNING BỔ SUNG ─── */}
        {isLow && activeStep === 2 && (
          <View style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }} className="gap-3 rounded-3xl border p-5 shadow-sm">
            <View className="flex-row items-center gap-2">
              <Ionicons name="build-outline" size={22} color="#166534" />
              <Text className="text-base font-bold text-green-950">Tự Xử Lý Sự Cố Tại Chỗ (LOW)</Text>
            </View>
            <Text className="text-xs leading-5 text-green-900">
              Sự cố mức thấp. Bạn có thể tự xử lý tại chỗ rồi xác nhận tiếp tục hành trình.
            </Text>
          </View>
        )}

        {isWarning && activeStep === 2 && (
          <View style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }} className="gap-3 rounded-3xl border p-5 shadow-sm">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Ionicons name="thermometer-outline" size={22} color="#B45309" />
                <Text className="text-base font-bold text-amber-900">Theo Dõi Nhiệt Độ (WARNING)</Text>
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
          </View>
        )}

        {/* ── THÔNG TIN CHUNG SỰ CỐ ─────────────────────────────────────── */}
        <View
          style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }}
          className="gap-4 rounded-3xl border p-5 shadow-sm"
        >
          <View className="flex-row items-center gap-2">
            <Ionicons name="information-circle-outline" size={20} color={colors.brand.primary} />
            <Text style={{ color: colors.text.primary }} className="text-base font-bold">Chi tiết sự cố ban đầu</Text>
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
        {/* Trường hợp 1: Người dùng đang tua xem bước cũ khác với bước hiện tại */}
        {selectedStep !== null && selectedStep !== currentStep ? (
          <Pressable
            onPress={() => setSelectedStep(null)}
            style={{ backgroundColor: colors.brand.primary, minHeight: 48 }}
            className="flex-row items-center justify-center gap-2 rounded-2xl shadow-sm px-4"
          >
            <Ionicons name="arrow-undo" size={18} color={colors.text.onPrimary} />
            <Text style={{ color: colors.text.onPrimary }} className="text-base font-bold">
              Quay về bước hiện tại (Bước {currentStep})
            </Text>
          </Pressable>
        ) : (
          /* Trường hợp 2: Đang ở bước hiện tại, hiển thị các nút thao tác tương ứng */
          <>
            {/* CTA: Non-breakdown REPORTED */}
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

            {/* CTA: Bước 5 Giao khách — TRANSLOAD_COMPLETED hoặc REDISPATCHED_TO_CUSTOMER */}
            {(incident.status === 'TRANSLOAD_COMPLETED' || incident.status === 'REDISPATCHED_TO_CUSTOMER') && (
              <View className="gap-2.5">
                {/* Nút mở chuyến xe để giao hàng từng điểm dừng (Check-in / POD) */}
                {(incident.tripId || currentTripId) ? (
                  <Pressable
                    onPress={() => router.push(`/trips/${incident.tripId || currentTripId}` as never)}
                    style={{ backgroundColor: colors.brand.primary, minHeight: 48 }}
                    className="flex-row items-center justify-center gap-2 rounded-2xl shadow-sm px-4"
                  >
                    <Ionicons name="navigate" size={18} color={colors.text.onPrimary} />
                    <Text style={{ color: colors.text.onPrimary }} className="text-base font-bold">
                      Mở chuyến xe để giao khách
                    </Text>
                  </Pressable>
                ) : null}

                {/* Nút đóng sự cố sau khi đã xử lý / giao hàng xong */}
                <Pressable
                  onPress={() => setIsResolveModalVisible(true)}
                  style={{
                    backgroundColor: (incident.tripId || currentTripId) ? colors.surface.card : '#166534',
                    borderColor: '#166534',
                    borderWidth: (incident.tripId || currentTripId) ? 1.5 : 0,
                    minHeight: 48,
                  }}
                  className="flex-row items-center justify-center gap-2 rounded-2xl shadow-sm px-4"
                >
                  <Ionicons
                    name="checkmark-done-circle"
                    size={20}
                    color={(incident.tripId || currentTripId) ? '#166534' : colors.text.onPrimary}
                  />
                  <Text
                    style={{ color: (incident.tripId || currentTripId) ? '#166534' : colors.text.onPrimary }}
                    className="text-base font-bold"
                  >
                    Hoàn tất & Đóng sự cố (Resolve)
                  </Text>
                </Pressable>
              </View>
            )}

            {/* CONTINUED / RESOLVED — Read-only */}
            {(incident.status === 'CONTINUED' || incident.status === 'RESOLVED') && (
              <View style={{ minHeight: 48 }} className="items-center justify-center">
                <Text style={{ color: colors.text.secondary }} className="font-semibold">
                  {incident.status === 'CONTINUED' ? '✅ Đã tiếp tục chuyến bình thường' : 'Sự cố đã được hoàn tất · Read-only'}
                </Text>
              </View>
            )}
          </>
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
          MODAL: ĐÓNG SỰ CỐ (CRITICAL path)
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
