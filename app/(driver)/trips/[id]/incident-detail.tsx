import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
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
  confirmTransload,
  continueTrip,
  getIncidentDetail,
  IncidentResponse,
  resolveIncident,
} from '../../../../services/incidentApi';
import {
  getOrderById,
  OrderResponse,
} from '../../../../services/orderApi';
import {
  getPlannedTripRoute,
  getTrackingByTripId,
  TripRouteLpnDto,
} from '../../../../services/trackingApi';
import {
  getVehicleDetail,
  VehicleDetailResponse,
} from '../../../../services/vehicleApi';
import { useAuthStore } from '../../../../store/useAuthStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const POLL_MS = 10_000;

const INCIDENT_TYPE_LABEL: Record<string, string> = {
  VEHICLE_BREAKDOWN: 'Xe hư hỏng kỹ thuật',
  REEFER_BREAKDOWN: 'Thùng/máy lạnh gặp sự cố',
  DAMAGE_CARGO: 'Hỏng hóc hàng hóa',
  TEMP_EXCURSION: 'Biến động nhiệt độ vượt ngưỡng',
  ACCIDENT: 'Tai nạn giao thông',
  DELAY: 'Chậm trễ hành trình',
};

const SEVERITY_LABEL: Record<string, string> = {
  LOW: 'Thấp (Tự xử lý)',
  MEDIUM: 'Trung bình',
  HIGH: 'Cao',
  CRITICAL: 'Nghiêm trọng (Cứu hộ bắt buộc)',
};

/** Hai loại này luôn bị backend ép lên CRITICAL */
const BREAKDOWN_TYPES = ['VEHICLE_BREAKDOWN', 'REEFER_BREAKDOWN'];

export default function DriverIncidentDetailScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string | string[]; incidentId?: string | string[] }>();
  const incidentId = Array.isArray(params.incidentId) ? params.incidentId[0] : params.incidentId;
  const currentTripId = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const token = useAuthStore((state) => state.token);

  const [incident, setIncident] = useState<IncidentResponse | null>(null);
  const [brokenVehicle, setBrokenVehicle] = useState<VehicleDetailResponse | null>(null);
  const [replacementVehicle, setReplacementVehicle] = useState<VehicleDetailResponse | null>(null);
  const [tripOrders, setTripOrders] = useState<OrderResponse[]>([]);
  const [tripLpns, setTripLpns] = useState<TripRouteLpnDto[]>([]);

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

  // ── Nhánh CRITICAL: Transload confirmation modal (Bước 3) ───────────────────
  const [isTransloadModalVisible, setIsTransloadModalVisible] = useState(false);
  const [transloadNote, setTransloadNote] = useState('');
  const [isTransloadSubmitting, setIsTransloadSubmitting] = useState(false);

  // ── Nhánh CRITICAL: Bước 4 Tiếp tục đi xác nhận qua Bước 5 ──────────────────
  const [step4ManuallyConfirmed, setStep4ManuallyConfirmed] = useState(false);

  // ── Resolve Modal ─────────────────────────────────────────────────────────
  const [isResolveModalVisible, setIsResolveModalVisible] = useState(false);
  const [resolveNote, setResolveNote] = useState('');
  const [isSubmittingResolve, setIsSubmittingResolve] = useState(false);

  // ── Image Preview Modal ───────────────────────────────────────────────────
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const handleOpenEvidence = async (url: string) => {
    if (!url) return;
    const isImg =
      /\.(jpg|jpeg|png|webp|gif|bmp)(\?.*)?$/i.test(url) ||
      url.includes('cloudinary.com') ||
      url.includes('image/upload');
    if (isImg) {
      setPreviewImageUrl(url);
      return;
    }
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Thông báo', 'Không thể mở liên kết tài liệu này trên thiết bị.');
      }
    } catch {
      Alert.alert('Thông báo', 'Không thể mở liên kết tài liệu.');
    }
  };

  const handleMakePhoneCall = async (phone: string) => {
    if (!phone) return;
    const cleaned = phone.replace(/[^\d+]/g, '');
    const url = `tel:${cleaned}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Thông báo', `Không thể gọi đến số ${phone} trên thiết bị này.`);
      }
    } catch {
      Alert.alert('Thông báo', 'Không thể thực hiện cuộc gọi.');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────

  const loadIncident = useCallback(async () => {
    if (!token || !incidentId) return null;
    try {
      const response = await getIncidentDetail(token, incidentId);
      if (!response.success || !response.data) {
        setError(response.message || 'Không thể tải thông tin sự cố.');
        return null;
      }
      const incData = response.data;
      setIncident(incData);
      setError(null);

      // Tải chi tiết xe gặp sự cố & xe thay thế
      if (incData.brokenVehicleId) {
        void getVehicleDetail(token, incData.brokenVehicleId).then((vRes) => {
          if (vRes.success && vRes.data) setBrokenVehicle(vRes.data);
        });
      }
      if (incData.replacementVehicleId) {
        void getVehicleDetail(token, incData.replacementVehicleId).then((vRes) => {
          if (vRes.success && vRes.data) setReplacementVehicle(vRes.data);
        });
      }

      // Tải danh sách đơn hàng & LPN của chuyến xe
      const targetTripId = incData.tripId || currentTripId;
      if (targetTripId) {
        void Promise.all([
          getPlannedTripRoute(token, targetTripId).catch(() => null),
          getTrackingByTripId(token, targetTripId).catch(() => null),
        ]).then(async ([routeRes, trackingRes]) => {
          const rawOrders = [
            ...(routeRes?.data?.optimizedStops?.flatMap((s) => s.orders) ?? []),
            ...(trackingRes?.data?.orders ?? []),
          ];
          const rawLpns = routeRes?.data?.optimizedStops?.flatMap((s) => s.lpns) ?? [];
          setTripLpns(rawLpns);

          const uniqueOrderIds = Array.from(
            new Set(rawOrders.map((o) => o.orderId).filter(Boolean))
          );
          if (uniqueOrderIds.length > 0) {
            const details = await Promise.all(
              uniqueOrderIds.map(async (oId) => {
                try {
                  const res = await getOrderById(token, oId);
                  return res.data;
                } catch {
                  return null;
                }
              })
            );
            setTripOrders(details.filter((d): d is OrderResponse => Boolean(d)));
          }
        });
      }

      return incData;
    } catch (e: unknown) {
      setError(getApiErrorMessage(e));
      return null;
    }
  }, [token, incidentId, currentTripId]);

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

  // ── CRITICAL: Xác nhận đã sang hàng cứu hộ (Bước 3) ──────────────────────
  const handleConfirmTransload = async () => {
    if (!token || !incidentId) return;
    setIsTransloadSubmitting(true);
    try {
      const res = await confirmTransload(
        token,
        incidentId,
        transloadNote.trim() || 'Đã hoàn thành sang hàng và chuyển thiết bị IoT sang xe cứu hộ.'
      );
      if (res.success) {
        setIsTransloadModalVisible(false);
        Alert.alert(
          'Thành công',
          'Đã xác nhận sang hàng sang xe mới thành công! Chuyển sang Bước 4: Tiếp tục vận chuyển.'
        );
        await loadIncident();
      } else {
        Alert.alert('Lỗi', res.message || 'Không thể xác nhận sang hàng.');
      }
    } catch (e: unknown) {
      Alert.alert('Lỗi', getApiErrorMessage(e));
    } finally {
      setIsTransloadSubmitting(false);
    }
  };

  // ── CRITICAL: Xác nhận tiếp tục đi từ Bước 4 qua Bước 5 ──────────────────
  const handleConfirmContinueFromStep4 = () => {
    setStep4ManuallyConfirmed(true);
    setSelectedStep(5);
    Alert.alert(
      'Tiếp tục hành trình',
      `Đã xác nhận xe thay thế ${replacementVehicle?.truckPlate || ''} bắt đầu lăn bánh tiếp tục hành trình giao hàng!`,
      [
        { text: 'Xem Bước 5: Giao khách', style: 'cancel' },
        {
          text: 'Mở trang giao hàng',
          style: 'default',
          onPress: () => router.push(`/trips/${incident?.tripId || currentTripId}` as never),
        },
      ]
    );
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
        <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="items-center rounded-3xl border p-6 shadow-sm">
          <Ionicons name="alert-circle-outline" size={48} color={colors.status.danger.main} />
          <Text style={{ color: colors.status.danger.main }} className="mt-4 text-center font-semibold">
            {error}
          </Text>
          <Pressable onPress={handleRefresh} style={{ backgroundColor: colors.brand.primary }} className="mt-6 rounded-2xl px-6 py-3 shadow-sm">
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

  // Phân biệt Xe ngoài (External Reefer) vs Xe nội bộ (Internal Fleet)
  const isExternalReefer = Boolean(
    incident.externalReeferPlan ||
    incident.rescuePlanType === 'EXTERNAL_REEFER_TO_ROUTE_WAREHOUSE'
  );

  const destinationWarehouseName =
    incident.externalReeferPlan?.destinationWarehouseName ||
    incident.externalReeferPlan?.routeDestinationCity ||
    'Kho đích tuyến';

  // Bước hiện tại thực tế trên hệ thống (nếu đã bấm xác nhận Bước 4 thì tự động tiến lên Bước 5)
  const rawCurrentStep = getIncidentCurrentStepNumber(incident.status, incident.severity, isExternalReefer);
  const currentStep = step4ManuallyConfirmed && rawCurrentStep === 4 ? 5 : rawCurrentStep;
  // Bước đang xem (tua lại hoặc hiện tại)
  const activeStep = selectedStep ?? currentStep;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={{ backgroundColor: colors.surface.page }} className="flex-1">

      {/* ── APPBAR CỐ ĐỊNH: mã Incident, badge trạng thái, stepper có thể bấm tua ── */}
      <View
        style={{
          backgroundColor: colors.surface.card,
          borderColor: colors.border.default,
          paddingTop: Math.max(insets.top + 6, 48),
        }}
        className="border-b px-4 pb-3 shadow-sm"
      >
        <View className="flex-row items-center justify-between mb-2">
          <Pressable onPress={() => router.back()} style={{ backgroundColor: colors.brand.primarySoft }} className="rounded-full p-2.5">
            <Ionicons name="arrow-back" size={18} color={colors.brand.primary} />
          </Pressable>
          <View className="flex-1 px-3">
            <Text style={{ color: colors.text.secondary }} className="text-[10px] font-bold uppercase tracking-wider">
              Mã Sự Cố
            </Text>
            <Text numberOfLines={1} style={{ color: colors.text.primary }} className="text-sm font-bold">
              {incident.incidentId}
            </Text>
          </View>
          <StatusBadge status={incident.status} showVietnameseLabel />
        </View>

        {/* Stepper tương tác */}
        <IncidentWorkflowStepper
          status={incident.status}
          severity={incident.severity}
          isExternalReefer={isExternalReefer}
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

        {/* Kho đích bắt buộc (chỉ hiển thị khi là xe ngoài chở về kho) */}
        {isCritical && isExternalReefer && (
          <View
            style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }}
            className="flex-row items-center justify-between rounded-3xl border p-4 shadow-sm"
          >
            <View className="flex-row items-center gap-3">
              <View style={{ backgroundColor: colors.brand.primarySoft }} className="h-10 w-10 items-center justify-center rounded-2xl">
                <Ionicons name="lock-closed" size={18} color={colors.brand.primary} />
              </View>
              <View>
                <Text style={{ color: colors.text.secondary }} className="text-xs font-medium">
                  Kho đích bắt buộc theo tuyến
                </Text>
                <Text style={{ color: colors.text.primary }} className="text-sm font-bold">
                  {destinationWarehouseName} 🔒
                </Text>
              </View>
            </View>
            <View style={{ backgroundColor: '#fffbeb', borderColor: '#fde68a' }} className="rounded-full border px-2.5 py-1">
              <Text className="text-[10px] font-bold text-amber-800">Cố định tuyến</Text>
            </View>
          </View>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            HIỂN THỊ CHI TIẾT THEO BƯỚC ĐANG CHỌN (activeStep)
            ════════════════════════════════════════════════════════════════════ */}

        {/* ─── BƯỚC 1: BÁO SỰ CỐ & BẢO TOÀN HÀNG ─── */}
        {activeStep === 1 && (
          <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="gap-3 rounded-3xl border p-5 shadow-sm">
            <View className="flex-row items-center justify-between border-b border-slate-100 pb-3 gap-2">
              <View className="flex-row items-center gap-3 flex-1 min-w-0 pr-1">
                <View style={{ backgroundColor: colors.status.danger.bg }} className="h-10 w-10 shrink-0 items-center justify-center rounded-2xl">
                  <Ionicons name="shield-checkmark" size={20} color={colors.status.danger.main} />
                </View>
                <View className="flex-1 min-w-0">
                  <Text numberOfLines={1} style={{ color: colors.text.primary }} className="text-sm font-bold">Bước 1: Báo Cáo & Bảo Toàn Hàng</Text>
                  <Text numberOfLines={1} style={{ color: colors.text.secondary }} className="text-[11px]">Đóng kín thùng lạnh bảo vệ nhiệt</Text>
                </View>
              </View>
              <View style={{ backgroundColor: currentStep > 1 ? colors.status.success.bg : colors.brand.primarySoft }} className="rounded-full px-2.5 py-1 shrink-0">
                <Text style={{ color: currentStep > 1 ? colors.status.success.main : colors.brand.primary }} className="text-[10px] font-bold">
                  {currentStep > 1 ? '✓ Đã hoàn tất' : 'Bước hiện tại'}
                </Text>
              </View>
            </View>

            <Text style={{ color: colors.text.secondary }} className="text-xs leading-5">
              Sự cố hỏng hóc được xếp loại <Text className="font-bold text-red-600">CRITICAL</Text>. Tài xế đóng kín cửa thùng xe ngay lập tức để duy trì nhiệt độ bảo quản.
            </Text>

            {/* Checkbox: chỉ tương tác nếu đang ở Bước 1 và chưa xác nhận */}
            {currentStep === 1 && (incident.status === 'REPORTED' || incident.status === 'CONTAINMENT_REQUIRED') ? (
              <Pressable
                onPress={() => setContainmentConfirmed(!containmentConfirmed)}
                style={{
                  backgroundColor: colors.surface.page,
                  borderColor: containmentConfirmed ? colors.brand.primary : colors.border.default,
                }}
                className="flex-row items-center gap-3 rounded-2xl border p-4 mt-1"
              >
                <Ionicons
                  name={containmentConfirmed ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={containmentConfirmed ? colors.brand.primary : colors.text.secondary}
                />
                <Text style={{ color: colors.text.primary }} className="flex-1 text-sm font-semibold">
                  Tôi xác nhận hàng đã được đóng kín và bảo toàn
                </Text>
              </Pressable>
            ) : (
              <View style={{ backgroundColor: colors.status.success.bg, borderColor: colors.status.success.border }} className="rounded-2xl border p-3.5 mt-1">
                <View className="flex-row items-center gap-2">
                  <Ionicons name="checkmark-circle" size={18} color={colors.status.success.main} />
                  <Text style={{ color: colors.status.success.main }} className="text-xs font-bold">
                    Đã hoàn thành xác nhận bảo toàn hàng hóa
                  </Text>
                </View>
                {incident.containmentConfirmedAt ? (
                  <Text style={{ color: colors.text.secondary }} className="text-[11px] mt-1 pl-6">
                    Thời gian: {new Date(incident.containmentConfirmedAt).toLocaleString('vi-VN')}
                  </Text>
                ) : null}
              </View>
            )}
          </View>
        )}

        {/* ─── BƯỚC 2: XE NGOÀI VỀ KHO HOẶC ĐIỀU XE NỘI BỘ ─── */}
        {activeStep === 2 && (
          isExternalReefer ? (
            /* Xe ngoài chở về kho tuyến */
            <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="gap-3 rounded-3xl border p-5 shadow-sm">
              <View className="flex-row items-center justify-between border-b border-slate-100 pb-3 gap-2">
                <View className="flex-row items-center gap-3 flex-1 min-w-0 pr-1">
                  <View style={{ backgroundColor: colors.status.warning.bg }} className="h-10 w-10 shrink-0 items-center justify-center rounded-2xl">
                    <Ionicons name="car-outline" size={20} color={colors.status.warning.main} />
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text numberOfLines={1} style={{ color: colors.text.primary }} className="text-sm font-bold">Bước 2: Xe Thuê Ngoài Cứu Hộ</Text>
                    <Text numberOfLines={1} style={{ color: colors.text.secondary }} className="text-[11px]">Chở về kho đích tuyến nhập kho</Text>
                  </View>
                </View>
                <View style={{ backgroundColor: colors.status.warning.bg }} className="rounded-full px-2.5 py-1 shrink-0">
                  <Text style={{ color: colors.status.warning.main }} className="text-[10px] font-bold">
                    {currentStep > 2 ? '✓ Đã điều xe' : 'Đang di chuyển'}
                  </Text>
                </View>
              </View>

              {incident.externalReeferPlan ? (
                <View style={{ backgroundColor: colors.surface.page, borderColor: colors.border.default }} className="gap-2.5 rounded-2xl border p-4">
                  <InfoRow label="Nhà cung cấp" value={incident.externalReeferPlan.rentalProvider} />
                  <InfoRow label="Biển số xe ngoài" value={incident.externalReeferPlan.vehiclePlate} highlight />
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
                <Text style={{ color: colors.text.secondary }} className="text-xs leading-5">
                  Dispatcher đang liên hệ đối tác xe lạnh chuyên dụng để điều xe cứu hộ đến vị trí sự cố.
                </Text>
              )}

              <View style={{ backgroundColor: colors.brand.primarySoft }} className="rounded-2xl p-3">
                <Text style={{ color: colors.text.primary }} className="text-xs leading-4">
                  ℹ <Text className="font-bold">Lưu ý:</Text> Tài xế giữ nguyên vị trí, bàn giao seal và toàn bộ LPN cho xe ngoài chở về kho tuyến.
                </Text>
              </View>
            </View>
          ) : (
            /* Xe thay thế nội bộ trong hệ thống */
            <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="gap-3 rounded-3xl border p-5 shadow-sm">
              <View className="flex-row items-center justify-between border-b border-slate-100 pb-3 gap-2">
                <View className="flex-row items-center gap-3 flex-1 min-w-0 pr-1">
                  <View style={{ backgroundColor: colors.brand.primarySoft }} className="h-10 w-10 shrink-0 items-center justify-center rounded-2xl">
                    <Ionicons name="car-sport-outline" size={20} color={colors.brand.primary} />
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text numberOfLines={1} style={{ color: colors.text.primary }} className="text-sm font-bold">Bước 2: Điều Xe Thay Thế</Text>
                    <Text numberOfLines={1} style={{ color: colors.text.secondary }} className="text-[11px]">Sang hàng trực tiếp trên đường</Text>
                  </View>
                </View>
                <View style={{ backgroundColor: colors.brand.primarySoft }} className="rounded-full px-2.5 py-1 shrink-0">
                  <Text style={{ color: colors.brand.primary }} className="text-[10px] font-bold">
                    {currentStep > 2 ? '✓ Đã điều xe' : 'Đang đến vị trí'}
                  </Text>
                </View>
              </View>

              <Text style={{ color: colors.text.secondary }} className="text-xs leading-5">
                Dispatcher đã điều động <Text className="font-bold text-slate-800">xe thay thế nội bộ</Text> đến vị trí sự cố để sang hàng trực tiếp. Tài xế tiếp tục chuyến đi bằng xe này.
              </Text>

              {/* KHỐI THÔNG TIN CHI TIẾT XE THAY THẾ */}
              <View style={{ backgroundColor: colors.surface.page, borderColor: colors.border.default }} className="gap-3 rounded-2xl border p-4">
                <View className="flex-row items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                  <View className="flex-row items-center gap-1.5 flex-1 mr-1">
                    <Ionicons name="shield-checkmark" size={16} color={colors.brand.primary} />
                    <Text style={{ color: colors.text.primary }} className="text-xs font-bold uppercase tracking-wider" numberOfLines={1}>
                      Xe thay thế được gán
                    </Text>
                  </View>
                  <View style={{ backgroundColor: colors.status.success.bg, borderColor: colors.status.success.border }} className="rounded-full border px-2 py-0.5 shrink-0">
                    <Text style={{ color: colors.status.success.main }} className="text-[10px] font-bold">Xe nội bộ</Text>
                  </View>
                </View>

                <InfoRow
                  label="Biển số xe thay thế"
                  value={replacementVehicle?.truckPlate || incident.replacementVehicleId || 'Đang phân công xe'}
                  highlight
                />
                {replacementVehicle?.brand ? (
                  <InfoRow label="Hãng sản xuất" value={replacementVehicle.brand} />
                ) : null}
                {replacementVehicle?.vehicleType ? (
                  <InfoRow label="Loại xe" value={replacementVehicle.vehicleType} />
                ) : null}
                {replacementVehicle?.maxWeight ? (
                  <InfoRow
                    label="Tải trọng cho phép"
                    value={`${replacementVehicle.maxWeight.toLocaleString('vi-VN')} kg${
                      replacementVehicle.maxCbm ? ` (${replacementVehicle.maxCbm} CBM)` : ''
                    }`}
                  />
                ) : null}

                {/* So sánh với xe gặp sự cố */}
                <View className="mt-1 border-t border-dashed border-slate-300 pt-2.5">
                  <Text style={{ color: colors.text.secondary }} className="text-[11px] font-bold mb-1.5">Xe gặp sự cố trước đó:</Text>
                  <InfoRow
                    label="Biển số xe cũ"
                    value={brokenVehicle?.truckPlate || incident.brokenVehicleId || '--'}
                  />
                  {brokenVehicle?.brand ? (
                    <InfoRow label="Hãng xe cũ" value={brokenVehicle.brand} />
                  ) : null}
                  {brokenVehicle?.maxWeight ? (
                    <InfoRow
                      label="Tải trọng xe cũ"
                      value={`${brokenVehicle.maxWeight.toLocaleString('vi-VN')} kg`}
                    />
                  ) : null}
                </View>
              </View>

              <View style={{ backgroundColor: colors.brand.primarySoft }} className="rounded-2xl p-3">
                <Text style={{ color: colors.text.primary }} className="text-xs leading-4">
                  ℹ <Text className="font-bold">Lưu ý:</Text> Không chở về nhập kho. Khi xe thay thế đến nơi, thực hiện sang hàng trực tiếp để tiếp tục giao cho khách.
                </Text>
              </View>
            </View>
          )
        )}

        {/* ─── BƯỚC 3: INBOUND KHO TUYẾN (XE NGOÀI) HOẶC SANG HÀNG (XE NỘI BỘ) ─── */}
        {activeStep === 3 && (
          isExternalReefer ? (
            /* Inbound kho tuyến */
            <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="gap-3 rounded-3xl border p-5 shadow-sm">
              <View className="flex-row items-center justify-between border-b border-slate-100 pb-3 gap-2">
                <View className="flex-row items-center gap-3 flex-1 min-w-0 pr-1">
                  <View style={{ backgroundColor: '#f3e8ff' }} className="h-10 w-10 shrink-0 items-center justify-center rounded-2xl">
                    <Ionicons name="cube-outline" size={20} color="#7e22ce" />
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text numberOfLines={1} style={{ color: colors.text.primary }} className="text-sm font-bold">Bước 3: Inbound Kho Tuyến</Text>
                    <Text numberOfLines={1} style={{ color: colors.text.secondary }} className="text-[11px]">Nhập kho tự động toàn bộ LPN</Text>
                  </View>
                </View>
                <View style={{ backgroundColor: '#f3e8ff' }} className="rounded-full px-2.5 py-1 shrink-0">
                  <Text className="text-[10px] font-bold text-purple-800">
                    {currentStep > 3 ? '✓ Đã nhập kho' : currentStep === 3 ? 'Đang Inbound' : 'Chờ xe đến'}
                  </Text>
                </View>
              </View>

              <Text style={{ color: colors.text.secondary }} className="text-xs leading-5">
                Xe ngoài chở hàng về <Text className="font-bold text-slate-800">{destinationWarehouseName} 🔒</Text>. Nhân viên kho nhập số seal để Inbound tự động toàn bộ LPN sang trạng thái <Text className="font-bold text-purple-700">IN_STOCK</Text>.
              </Text>

              <View style={{ backgroundColor: colors.surface.page, borderColor: colors.border.default }} className="gap-2.5 rounded-2xl border p-4">
                <InfoRow label="Kho nhận" value={`${destinationWarehouseName} 🔒`} />
                <InfoRow label="Số seal Inbound" value={incident.externalReeferPlan?.sealNumber || 'Theo xe ngoài'} />
                <InfoRow label="Quy chuẩn Inbound" value="Tự động toàn bộ LPN (Không QC)" />
              </View>

              {/* Danh sách đơn hàng chuyển về kho */}
              {tripOrders.length > 0 && (
                <View className="mt-2 gap-2.5">
                  <Text style={{ color: colors.text.primary }} className="text-xs font-bold uppercase tracking-wider">
                    📦 Danh sách đơn hàng chuyển về kho ({tripOrders.length} đơn):
                  </Text>
                  {tripOrders.map((order, idx) => (
                    <OrderCardItem
                      key={order.orderId || idx}
                      order={order}
                      lpns={tripLpns.filter((l) => l.orderId === order.orderId)}
                    />
                  ))}
                </View>
              )}
            </View>
          ) : (
            /* Sang hàng xe nội bộ */
            <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="gap-3 rounded-3xl border p-5 shadow-sm">
              <View className="flex-row items-center justify-between border-b border-slate-100 pb-3 gap-2">
                <View className="flex-row items-center gap-3 flex-1 min-w-0 pr-1">
                  <View style={{ backgroundColor: colors.status.success.bg }} className="h-10 w-10 shrink-0 items-center justify-center rounded-2xl">
                    <Ionicons name="swap-horizontal-outline" size={20} color={colors.status.success.main} />
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text numberOfLines={1} style={{ color: colors.text.primary }} className="text-sm font-bold">Bước 3: Sang Hàng Tại Chỗ</Text>
                    <Text numberOfLines={1} style={{ color: colors.text.secondary }} className="text-[11px]">Chuyển LPN sang xe mới tiếp tục giao</Text>
                  </View>
                </View>
                <View style={{ backgroundColor: colors.status.success.bg }} className="rounded-full px-2.5 py-1 shrink-0">
                  <Text style={{ color: colors.status.success.main }} className="text-[10px] font-bold">
                    {incident.status === 'TRANSLOAD_COMPLETED' || currentStep > 3 ? '✓ Đã sang hàng' : 'Đang sang hàng'}
                  </Text>
                </View>
              </View>

              <Text style={{ color: colors.text.secondary }} className="text-xs leading-5">
                Hàng hóa và thiết bị IoT được chuyển sang <Text className="font-bold text-slate-800">xe thay thế nội bộ</Text> an toàn. Toàn bộ thông tin đơn hàng và người nhận được giữ nguyên để tiếp tục giao.
              </Text>

              {/* Thông tin phương tiện tiếp nhận */}
              <View style={{ backgroundColor: colors.surface.page, borderColor: colors.border.default }} className="gap-2.5 rounded-2xl border p-4">
                <InfoRow
                  label="Xe tiếp nhận hàng"
                  value={
                    replacementVehicle
                      ? `${replacementVehicle.truckPlate}${replacementVehicle.brand ? ` (${replacementVehicle.brand})` : ''}`
                      : incident.replacementVehicleId || '--'
                  }
                  highlight
                />
                {replacementVehicle?.maxWeight ? (
                  <InfoRow
                    label="Tải trọng xe nhận"
                    value={`${replacementVehicle.maxWeight.toLocaleString('vi-VN')} kg`}
                  />
                ) : null}
                <InfoRow label="Hình thức" value="Sang hàng trực tiếp trên đường (Không về kho)" />
                <InfoRow label="Trạng thái LPN" value="Giữ nguyên SHIPPING để tiếp tục giao" />
              </View>

              {/* KHỐI HIỂN THỊ DANH SÁCH ĐƠN HÀNG, MÃ HÀNG, NGƯỜI NHẬN, ĐỊA CHỈ */}
              <View className="mt-2 gap-2.5">
                <View className="flex-row items-center justify-between gap-2">
                  <Text style={{ color: colors.text.primary }} className="text-xs font-bold uppercase tracking-wider flex-1 mr-1" numberOfLines={1}>
                    📦 Đơn hàng sang xe ({tripOrders.length || (tripLpns.length ? tripLpns.length : 0)} đơn):
                  </Text>
                  <View style={{ backgroundColor: colors.status.success.bg, borderColor: colors.status.success.border }} className="rounded-full border px-2 py-0.5 shrink-0">
                    <Text style={{ color: colors.status.success.main }} className="text-[10px] font-bold">Giữ nguyên giao tiếp</Text>
                  </View>
                </View>

                {tripOrders.length > 0 ? (
                  tripOrders.map((order, idx) => (
                    <OrderCardItem
                      key={order.orderId || idx}
                      order={order}
                      lpns={tripLpns.filter((l) => l.orderId === order.orderId)}
                    />
                  ))
                ) : tripLpns.length > 0 ? (
                  tripLpns.map((lpn, idx) => (
                    <View key={lpn.lpnId || idx} style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="rounded-2xl border p-3.5 gap-1.5 shadow-sm">
                      <View className="flex-row items-center justify-between">
                        <Text style={{ color: colors.text.primary }} className="text-xs font-bold">{lpn.itemName || 'Hàng hóa vận chuyển'}</Text>
                        <Text style={{ color: colors.brand.primary }} className="text-[11px] font-bold">{lpn.lpnCode}</Text>
                      </View>
                      <Text style={{ color: colors.text.secondary }} className="text-[11px]">Mã vận đơn: {lpn.orderTrackingCode || lpn.orderId}</Text>
                    </View>
                  ))
                ) : (
                  <View style={{ backgroundColor: colors.surface.page }} className="rounded-2xl p-4 items-center">
                    <Text style={{ color: colors.text.secondary }} className="text-xs">Toàn bộ đơn hàng trong chuyến được bảo toàn sang xe mới</Text>
                  </View>
                )}
              </View>
            </View>
          )
        )}

        {/* ─── BƯỚC 4: GHÉP CHUYẾN (XE NGOÀI) HOẶC TIẾP TỤC CHUYẾN (XE NỘI BỘ) ─── */}
        {activeStep === 4 && (
          isExternalReefer ? (
            /* Ghép chuyến mới tại kho */
            <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="gap-3 rounded-3xl border p-5 shadow-sm">
              <View className="flex-row items-center justify-between border-b border-slate-100 pb-3 gap-2">
                <View className="flex-row items-center gap-3 flex-1 min-w-0 pr-1">
                  <View style={{ backgroundColor: colors.brand.primarySoft }} className="h-10 w-10 shrink-0 items-center justify-center rounded-2xl">
                    <Ionicons name="navigate-circle-outline" size={20} color={colors.brand.primary} />
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text numberOfLines={1} style={{ color: colors.text.primary }} className="text-sm font-bold">Bước 4: Ghép Chuyến Mới</Text>
                    <Text numberOfLines={1} style={{ color: colors.text.secondary }} className="text-[11px]">Tạo trip mới tại kho tuyến</Text>
                  </View>
                </View>
                <View style={{ backgroundColor: colors.brand.primarySoft }} className="rounded-full px-2.5 py-1 shrink-0">
                  <Text style={{ color: colors.brand.primary }} className="text-[10px] font-bold">
                    {currentStep > 4 ? '✓ Đã tạo chuyến' : currentStep === 4 ? 'Đang xử lý' : 'Sắp tới'}
                  </Text>
                </View>
              </View>

              <Text style={{ color: colors.text.secondary }} className="text-xs leading-5">
                Dispatcher tạo chuyến xe thay thế tại kho tuyến. Giữ nguyên toàn bộ LPN của sự cố để tiếp tục hành trình giao khách.
              </Text>

              {incident.redispatchPlan ? (
                <View style={{ backgroundColor: colors.brand.primarySoft }} className="rounded-2xl p-3">
                  <Text style={{ color: colors.brand.primary }} className="text-xs font-semibold">{incident.redispatchPlan}</Text>
                </View>
              ) : null}

              <View style={{ backgroundColor: colors.surface.page, borderColor: colors.border.default }} className="gap-2.5 rounded-2xl border p-4">
                <InfoRow label="Kho xuất phát" value={`${destinationWarehouseName} 🔒`} />
                <InfoRow label="LPN ghép chuyến" value="Toàn bộ LPN sự cố (Khóa cố định)" />
              </View>
            </View>
          ) : (
            /* Tiếp tục chuyến với xe mới */
            <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="gap-3 rounded-3xl border p-5 shadow-sm">
              <View className="flex-row items-center justify-between border-b border-slate-100 pb-3 gap-2">
                <View className="flex-row items-center gap-3 flex-1 min-w-0 pr-1">
                  <View style={{ backgroundColor: colors.brand.primarySoft }} className="h-10 w-10 shrink-0 items-center justify-center rounded-2xl">
                    <Ionicons name="navigate-outline" size={20} color={colors.brand.primary} />
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text numberOfLines={1} style={{ color: colors.text.primary }} className="text-sm font-bold">Bước 4: Tiếp Tục Vận Chuyển</Text>
                    <Text numberOfLines={1} style={{ color: colors.text.secondary }} className="text-[11px]">Xe mới đang trên đường giao hàng</Text>
                  </View>
                </View>
                <View style={{ backgroundColor: colors.brand.primarySoft }} className="rounded-full px-2.5 py-1 shrink-0">
                  <Text style={{ color: colors.brand.primary }} className="text-[10px] font-bold">
                    {currentStep >= 4 ? '✓ Đang chạy' : 'Sắp tới'}
                  </Text>
                </View>
              </View>

              <Text style={{ color: colors.text.secondary }} className="text-xs leading-5">
                Chuyến xe tiếp tục trạng thái <Text className="font-bold text-slate-800">IN_TRANSIT</Text> với xe thay thế mới. Tài xế tiếp tục hành trình giao các đơn hàng theo đúng lộ trình.
              </Text>

              <View style={{ backgroundColor: colors.surface.page, borderColor: colors.border.default }} className="gap-2.5 rounded-2xl border p-4">
                <InfoRow
                  label="Xe đang vận chuyển"
                  value={
                    replacementVehicle
                      ? `${replacementVehicle.truckPlate}${replacementVehicle.brand ? ` (${replacementVehicle.brand})` : ''}`
                      : incident.replacementVehicleId || '--'
                  }
                  highlight
                />
                {replacementVehicle?.maxWeight ? (
                  <InfoRow
                    label="Tải trọng xe"
                    value={`${replacementVehicle.maxWeight.toLocaleString('vi-VN')} kg`}
                  />
                ) : null}
                <InfoRow label="Mã chuyến xe" value={incident.tripCode || incident.tripId || currentTripId || '--'} />
                <InfoRow label="Trạng thái hành trình" value="Đang vận chuyển giao khách" />
              </View>
            </View>
          )
        )}

        {/* ─── BƯỚC 5: GIAO HÀNG CHO KHÁCH & ĐÓNG SỰ CỐ ─── */}
        {activeStep === 5 && (
          <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="gap-3 rounded-3xl border p-5 shadow-sm">
            <View className="flex-row items-center justify-between border-b border-slate-100 pb-3 gap-2">
              <View className="flex-row items-center gap-3 flex-1 min-w-0 pr-1">
                <View style={{ backgroundColor: colors.status.success.bg }} className="h-10 w-10 shrink-0 items-center justify-center rounded-2xl">
                  <Ionicons name="checkmark-circle-outline" size={20} color={colors.status.success.main} />
                </View>
                <View className="flex-1 min-w-0">
                  <Text numberOfLines={1} style={{ color: colors.text.primary }} className="text-sm font-bold">
                    {incident.status === 'TRANSLOAD_COMPLETED' || step4ManuallyConfirmed
                      ? 'Bước 5: Tiếp Tục Giao Hàng'
                      : 'Bước 5: Giao Khách & Đóng Sự Cố'}
                  </Text>
                  <Text numberOfLines={1} style={{ color: colors.text.secondary }} className="text-[11px]">Hoàn tất các điểm dừng giao hàng</Text>
                </View>
              </View>
              <View style={{ backgroundColor: colors.status.success.bg }} className="rounded-full px-2.5 py-1 shrink-0">
                <Text style={{ color: colors.status.success.main }} className="text-[10px] font-bold">
                  {incident.status === 'RESOLVED' ? '✓ Đã đóng sự cố' : 'Đang giao khách'}
                </Text>
              </View>
            </View>

            <Text style={{ color: colors.text.secondary }} className="text-xs leading-5">
              {incident.status === 'TRANSLOAD_COMPLETED' || step4ManuallyConfirmed
                ? 'Hàng hóa đã được sang xe thay thế an toàn. Tài xế tiếp tục hành trình giao hàng cho khách theo lộ trình.'
                : 'Chuyến xe đang trong quá trình giao hàng đến tay khách hàng.'}
            </Text>

            <View style={{ backgroundColor: colors.surface.page, borderColor: colors.border.default }} className="gap-2.5 rounded-2xl border p-4">
              {incident.brokenVehicleId ? (
                <InfoRow
                  label="Xe cũ gặp sự cố"
                  value={
                    brokenVehicle
                      ? `${brokenVehicle.truckPlate}${brokenVehicle.brand ? ` (${brokenVehicle.brand})` : ''}`
                      : incident.brokenVehicleId
                  }
                />
              ) : null}
              {incident.replacementVehicleId ? (
                <InfoRow
                  label="Xe thay thế hiện tại"
                  value={
                    replacementVehicle
                      ? `${replacementVehicle.truckPlate}${replacementVehicle.brand ? ` (${replacementVehicle.brand})` : ''}`
                      : incident.replacementVehicleId
                  }
                  highlight
                />
              ) : null}
              {replacementVehicle?.maxWeight ? (
                <InfoRow
                  label="Tải trọng xe thay thế"
                  value={`${replacementVehicle.maxWeight.toLocaleString('vi-VN')} kg`}
                />
              ) : null}
              {incident.tripCode || incident.tripId || currentTripId ? (
                <InfoRow label="Mã chuyến đang chạy" value={incident.tripCode || incident.tripId || currentTripId || '--'} />
              ) : null}
              {incident.resolvedAt ? (
                <InfoRow label="Thời gian đóng" value={new Date(incident.resolvedAt).toLocaleString('vi-VN')} />
              ) : null}
              <InfoRow label="Trạng thái giao hàng" value="Đang giao các điểm dừng còn lại" />
            </View>

            <View style={{ backgroundColor: colors.brand.primarySoft }} className="rounded-2xl p-3">
              <Text style={{ color: colors.text.primary }} className="text-xs leading-4">
                ℹ <Text className="font-bold">Hướng dẫn:</Text> Mở chuyến xe để thực hiện giao từng điểm dừng (Check-in & POD), sau đó bấm đóng sự cố khi đã giao hàng hoàn tất.
              </Text>
            </View>
          </View>
        )}

        {/* ─── NHÁNH LOW / WARNING BỔ SUNG ─── */}
        {isLow && activeStep === 2 && (
          <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="gap-3 rounded-3xl border p-5 shadow-sm">
            <View className="flex-row items-center gap-2">
              <Ionicons name="build-outline" size={20} color={colors.status.success.main} />
              <Text style={{ color: colors.text.primary }} className="text-base font-bold">Tự Xử Lý Sự Cố Tại Chỗ (LOW)</Text>
            </View>
            <Text style={{ color: colors.text.secondary }} className="text-xs leading-5">
              Sự cố mức thấp. Bạn có thể tự xử lý tại chỗ rồi xác nhận tiếp tục hành trình.
            </Text>
          </View>
        )}

        {isWarning && activeStep === 2 && (
          <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="gap-3 rounded-3xl border p-5 shadow-sm">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Ionicons name="thermometer-outline" size={20} color={colors.status.warning.main} />
                <Text style={{ color: colors.text.primary }} className="text-base font-bold">Theo Dõi Nhiệt Độ (WARNING)</Text>
              </View>
              <View style={{ backgroundColor: colors.status.warning.bg }} className="rounded-full px-2 py-0.5">
                <Text style={{ color: colors.status.warning.main }} className="text-[10px] font-bold">WARNING</Text>
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
          <View className="flex-row items-center gap-2 border-b border-slate-100 pb-3">
            <Ionicons name="information-circle-outline" size={20} color={colors.brand.primary} />
            <Text style={{ color: colors.text.primary }} className="text-base font-bold">Chi tiết sự cố ban đầu</Text>
          </View>
          <InfoRow label="Loại sự cố" value={INCIDENT_TYPE_LABEL[incident.incidentType] || incident.incidentType} />
          <InfoRow label="Mức độ" value={SEVERITY_LABEL[incident.severity] || incident.severity} />
          <InfoRow label="Mô tả" value={incident.description} />
          <InfoRow label="Thời gian báo" value={new Date(incident.reportedAt).toLocaleString('vi-VN')} />
          <InfoRow label="Người báo cáo" value={incident.reportedByUsername || '--'} />
          <InfoRow
            label="Xe gặp sự cố"
            value={
              brokenVehicle
                ? `${brokenVehicle.truckPlate}${brokenVehicle.brand ? ` (${brokenVehicle.brand})` : ''}`
                : incident.brokenVehicleId || '--'
            }
          />
          {brokenVehicle?.maxWeight ? (
            <InfoRow
              label="Tải trọng xe gặp sự cố"
              value={`${brokenVehicle.maxWeight.toLocaleString('vi-VN')} kg`}
            />
          ) : null}
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
            <View className="gap-2.5">
              {incident.evidences.map((e, idx) => {
                const isImage =
                  /\.(jpg|jpeg|png|webp|gif|bmp)(\?.*)?$/i.test(e.fileUrl) ||
                  e.fileUrl.includes('cloudinary.com') ||
                  e.fileUrl.includes('image/upload');

                let label = 'Tài liệu đính kèm';
                if (e.evidenceType === 'INCIDENT_PHOTO' || e.evidenceType === 'INCIDENT_ATTACHMENT') {
                  label = `Ảnh hiện trường #${idx + 1}`;
                } else if (e.evidenceType === 'DRIVER_RECEIPT') {
                  label = 'Hóa đơn chi phí tài xế';
                } else if (e.evidenceType === 'REIMBURSEMENT_RECEIPT') {
                  label = 'Biên lai hoàn tiền';
                } else if (e.evidenceType === 'RESOLUTION_PDF') {
                  label = 'Biên bản xử lý sự cố';
                }

                return (
                  <Pressable
                    key={e.evidenceId || idx}
                    onPress={() => handleOpenEvidence(e.fileUrl)}
                    style={{ backgroundColor: colors.surface.page, borderColor: colors.border.default }}
                    className="flex-row items-center justify-between rounded-2xl border p-3"
                  >
                    <View className="flex-row items-center gap-3 flex-1 pr-2">
                      {isImage ? (
                        <Image
                          source={{ uri: e.fileUrl }}
                          style={{ width: 44, height: 44, borderRadius: 10 }}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={{ backgroundColor: colors.brand.primarySoft }} className="h-11 w-11 items-center justify-center rounded-xl">
                          <Ionicons name="document-text" size={22} color={colors.brand.primary} />
                        </View>
                      )}
                      <View className="flex-1">
                        <Text style={{ color: colors.text.primary }} className="text-xs font-bold" numberOfLines={1}>
                          {label}
                        </Text>
                        <Text style={{ color: colors.text.secondary }} className="text-[10px] mt-0.5" numberOfLines={1}>
                          {isImage ? 'Chạm để xem ảnh toàn màn hình' : 'Chạm để mở tài liệu'}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name={isImage ? "eye-outline" : "open-outline"} size={18} color={colors.brand.primary} />
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── BOTTOM BAR CTA CỐ ĐỊNH ─────────────────────── */}
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

            {/* CTA: LOW — Xác nhận tiếp tục chuyến (từ TRIAGED) */}
            {incident.status === 'TRIAGED' && (
              <Pressable
                onPress={() => setIsContinueTripModalVisible(true)}
                style={{ backgroundColor: colors.status.success.main, minHeight: 48 }}
                className="items-center justify-center rounded-2xl shadow-sm"
              >
                <Text style={{ color: '#ffffff' }} className="text-base font-bold">
                  Xác nhận tiếp tục chuyến
                </Text>
              </Pressable>
            )}

            {/* CTA: Bước 1 Containment Required */}
            {currentStep === 1 && (incident.status === 'REPORTED' || incident.status === 'CONTAINMENT_REQUIRED') ? (
              <Pressable
                onPress={handleAssessContainment}
                disabled={!containmentConfirmed || actionLoading}
                style={{
                  backgroundColor: !containmentConfirmed || actionLoading ? colors.surface.muted : colors.brand.primary,
                  minHeight: 48,
                }}
                className="flex-row items-center justify-center gap-2 rounded-2xl shadow-sm"
              >
                {actionLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="shield-checkmark" size={18} color="#ffffff" />
                    <Text className="text-base font-bold text-white">
                      Hoàn thành Bước 1: Xác nhận bảo toàn hàng
                    </Text>
                  </>
                )}
              </Pressable>
            ) : null}

            {/* CTA: Bước 3 Xác nhận đã sang hàng sang xe mới */}
            {currentStep === 3 && incident.status === 'RESCUE_DISPATCHED' ? (
              <Pressable
                onPress={() => setIsTransloadModalVisible(true)}
                style={{ backgroundColor: colors.brand.primary, minHeight: 48 }}
                className="flex-row items-center justify-center gap-2 rounded-2xl shadow-sm"
              >
                <Ionicons name="swap-horizontal" size={20} color="#ffffff" />
                <Text className="text-base font-bold text-white">
                  Xác nhận đã sang hàng (Chuyển sang Bước 4)
                </Text>
              </Pressable>
            ) : null}

            {/* CTA: Bước 4 Xác nhận tiếp tục đi để qua Bước 5 */}
            {currentStep === 4 ? (
              <Pressable
                onPress={handleConfirmContinueFromStep4}
                style={{ backgroundColor: colors.brand.primary, minHeight: 48 }}
                className="flex-row items-center justify-center gap-2 rounded-2xl shadow-sm"
              >
                <Ionicons name="navigate" size={18} color="#ffffff" />
                <Text className="text-base font-bold text-white">Xác nhận tiếp tục đi (Chuyển sang Bước 5)</Text>
              </Pressable>
            ) : null}

            {/* CTA: Bước 5 Hoàn tất & Đóng sự cố + Mở chuyến xe */}
            {currentStep === 5 && incident.status !== 'RESOLVED' ? (
              <View className="gap-2.5">
                <Pressable
                  onPress={() => setIsResolveModalVisible(true)}
                  style={{ backgroundColor: colors.status.success.main, minHeight: 48 }}
                  className="flex-row items-center justify-center gap-2 rounded-2xl shadow-sm"
                >
                  <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
                  <Text className="text-base font-bold text-white">
                    Hoàn tất & Đóng sự cố (Resolve)
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push(`/trips/${incident.tripId || currentTripId}` as never)}
                  style={{
                    backgroundColor: colors.surface.page,
                    borderColor: colors.border.default,
                    minHeight: 44,
                  }}
                  className="flex-row items-center justify-center gap-2 rounded-2xl border"
                >
                  <Ionicons name="navigate-outline" size={16} color={colors.brand.primary} />
                  <Text style={{ color: colors.brand.primary }} className="text-sm font-bold">
                    Mở chuyến xe để giao hàng các điểm dừng
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </>
        )}
      </View>

      {/* ── CONTINUE TRIP MODAL (LOW) ── */}
      <Modal
        visible={isContinueTripModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsContinueTripModalVisible(false)}
      >
        <View style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} className="flex-1 justify-end">
          <View style={{ backgroundColor: colors.surface.card }} className="gap-4 rounded-t-3xl p-6">
            <Text style={{ color: colors.text.primary }} className="text-lg font-bold">Xác nhận tiếp tục chuyến đi</Text>
            <TextInput
              value={continueTripNote}
              onChangeText={setContinueTripNote}
              placeholder="Ghi chú xử lý sự cố tại chỗ..."
              multiline
              numberOfLines={3}
              style={{ backgroundColor: colors.surface.page, borderColor: colors.border.default, color: colors.text.primary }}
              className="rounded-2xl border p-4 text-sm"
            />
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setIsContinueTripModalVisible(false)}
                style={{ borderColor: colors.border.default }}
                className="flex-1 items-center rounded-2xl border p-3.5"
              >
                <Text style={{ color: colors.text.secondary }} className="font-semibold">Hủy</Text>
              </Pressable>
              <Pressable
                onPress={handleSubmitContinueTrip}
                disabled={isContinueTripSubmitting}
                style={{ backgroundColor: colors.brand.primary, minHeight: 48 }}
                className="flex-1 items-center justify-center rounded-2xl shadow-sm"
              >
                {isContinueTripSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="font-bold text-white">Xác nhận</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── TRANSLOAD CONFIRMATION MODAL (CRITICAL STEP 3) ── */}
      <Modal
        visible={isTransloadModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsTransloadModalVisible(false)}
      >
        <View style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} className="flex-1 justify-end">
          <View style={{ backgroundColor: colors.surface.card }} className="gap-4 rounded-t-3xl p-6">
            <View className="flex-row items-center gap-2 border-b border-slate-100 pb-3">
              <Ionicons name="swap-horizontal" size={22} color={colors.brand.primary} />
              <Text style={{ color: colors.text.primary }} className="text-lg font-bold">
                Xác nhận sang hàng sang xe mới
              </Text>
            </View>
            <Text style={{ color: colors.text.secondary }} className="text-xs leading-5">
              Xác nhận toàn bộ kiện hàng, mã LPN và thiết bị giám sát nhiệt độ IoT đã được chuyển đầy đủ sang xe cứu hộ <Text className="font-bold text-slate-800">{replacementVehicle?.truckPlate || 'thay thế'}</Text>.
            </Text>
            <TextInput
              value={transloadNote}
              onChangeText={setTransloadNote}
              placeholder="Ghi chú xác nhận sang hàng (tùy chọn)..."
              multiline
              numberOfLines={3}
              style={{ backgroundColor: colors.surface.page, borderColor: colors.border.default, color: colors.text.primary }}
              className="rounded-2xl border p-4 text-sm"
            />
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setIsTransloadModalVisible(false)}
                style={{ borderColor: colors.border.default }}
                className="flex-1 items-center rounded-2xl border p-3.5"
              >
                <Text style={{ color: colors.text.secondary }} className="font-semibold">Hủy</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmTransload}
                disabled={isTransloadSubmitting}
                style={{ backgroundColor: colors.brand.primary, minHeight: 48 }}
                className="flex-1 items-center justify-center rounded-2xl shadow-sm"
              >
                {isTransloadSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="font-bold text-white">Xác nhận sang hàng</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── RESOLVE MODAL ── */}
      <Modal
        visible={isResolveModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsResolveModalVisible(false)}
      >
        <View style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} className="flex-1 justify-end">
          <View style={{ backgroundColor: colors.surface.card }} className="gap-4 rounded-t-3xl p-6">
            <Text style={{ color: colors.text.primary }} className="text-lg font-bold">Đóng & Hoàn tất sự cố</Text>
            <TextInput
              value={resolveNote}
              onChangeText={setResolveNote}
              placeholder="Nhập ghi chú hoàn tất sự cố (tùy chọn)..."
              multiline
              numberOfLines={3}
              style={{ backgroundColor: colors.surface.page, borderColor: colors.border.default, color: colors.text.primary }}
              className="rounded-2xl border p-4 text-sm"
            />
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setIsResolveModalVisible(false)}
                style={{ borderColor: colors.border.default }}
                className="flex-1 items-center rounded-2xl border p-3.5"
              >
                <Text style={{ color: colors.text.secondary }} className="font-semibold">Hủy</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmResolve}
                disabled={isSubmittingResolve}
                style={{ backgroundColor: colors.brand.primary, minHeight: 48 }}
                className="flex-1 items-center justify-center rounded-2xl shadow-sm"
              >
                {isSubmittingResolve ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="font-bold text-white">Xác nhận đóng sự cố</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── FULLSCREEN IMAGE PREVIEW MODAL ── */}
      <Modal
        visible={Boolean(previewImageUrl)}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImageUrl(null)}
      >
        <View style={{ backgroundColor: 'rgba(0,0,0,0.92)' }} className="flex-1 items-center justify-center p-4">
          <Pressable
            onPress={() => setPreviewImageUrl(null)}
            hitSlop={12}
            style={{ backgroundColor: 'rgba(255,255,255,0.25)' }}
            className="absolute top-12 right-6 z-50 rounded-full p-2.5"
          >
            <Ionicons name="close" size={24} color="#ffffff" />
          </Pressable>

          {previewImageUrl ? (
            <Image
              source={{ uri: previewImageUrl }}
              style={{ width: '100%', height: '80%' }}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

function OrderCardItem({
  order,
  lpns,
  onCallPhone,
}: {
  order: OrderResponse;
  lpns: TripRouteLpnDto[];
  onCallPhone?: (phone: string) => void;
}) {
  const receiverPhone = order.receiverPhone || order.customerPhone;
  const receiverName = order.receiverName || order.customerName || order.customerContactName || 'Khách hàng';
  const destAddress = order.destination?.address || 'Địa chỉ nhận theo lộ trình';

  return (
    <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="rounded-2xl border p-4 gap-2.5 shadow-sm">
      {/* Header: Tracking code & Item name */}
      <View className="flex-row items-start justify-between gap-2 border-b border-slate-100 pb-2">
        <View className="flex-1">
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="cube" size={14} color={colors.brand.primary} />
            <Text style={{ color: colors.text.primary }} className="text-xs font-bold" numberOfLines={1}>
              {order.itemName}
            </Text>
          </View>
          <Text style={{ color: colors.text.secondary }} className="text-[11px] font-semibold mt-0.5">
            Mã ĐH: <Text style={{ color: colors.text.primary }} className="font-bold">{order.trackingCode || order.orderId.slice(0, 8).toUpperCase()}</Text>
          </Text>
        </View>

        {/* Temperature Badge */}
        {order.tempCondition ? (
          <View style={{ backgroundColor: colors.brand.primarySoft, borderColor: colors.border.default }} className="rounded-md border px-2 py-0.5">
            <Text style={{ color: colors.brand.primary }} className="text-[10px] font-bold">{order.tempCondition}</Text>
          </View>
        ) : null}
      </View>

      {/* Cargo specifications: Quantity, Weight, Packing */}
      <View style={{ backgroundColor: colors.surface.page }} className="flex-row flex-wrap items-center gap-3 rounded-xl p-2.5">
        <View className="flex-row items-center gap-1">
          <Text style={{ color: colors.text.secondary }} className="text-[11px]">Số lượng:</Text>
          <Text style={{ color: colors.text.primary }} className="text-[11px] font-bold">{order.quantity} {order.packingType || 'kiện'}</Text>
        </View>
        {(order.actualWeightKg || order.expectedWeightKg) ? (
          <View className="flex-row items-center gap-1">
            <Text style={{ color: colors.text.secondary }} className="text-[11px]">Trọng lượng:</Text>
            <Text style={{ color: colors.text.primary }} className="text-[11px] font-bold">
              {(order.actualWeightKg || order.expectedWeightKg)?.toLocaleString('vi-VN')} kg
            </Text>
          </View>
        ) : null}
        {(order.actualCbm || order.expectedCbm) ? (
          <View className="flex-row items-center gap-1">
            <Text style={{ color: colors.text.secondary }} className="text-[11px]">Thể tích:</Text>
            <Text style={{ color: colors.text.primary }} className="text-[11px] font-bold">{order.actualCbm || order.expectedCbm} CBM</Text>
          </View>
        ) : null}
      </View>

      {/* Recipient info: Name, Phone with call button, Delivery Address */}
      <View className="gap-1.5 pt-0.5">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-1.5 flex-1 pr-2">
            <Ionicons name="person-outline" size={13} color={colors.text.secondary} />
            <Text style={{ color: colors.text.secondary }} className="text-xs font-semibold" numberOfLines={1}>
              Người nhận: <Text style={{ color: colors.text.primary }} className="font-bold">{receiverName}</Text>
            </Text>
          </View>
          {receiverPhone ? (
            <Pressable
              onPress={() => onCallPhone ? onCallPhone(receiverPhone) : Linking.openURL(`tel:${receiverPhone}`).catch(() => {})}
              hitSlop={6}
              style={{ backgroundColor: colors.status.success.bg, borderColor: colors.status.success.border }}
              className="flex-row items-center gap-1 rounded-xl border px-2.5 py-1"
            >
              <Ionicons name="call" size={11} color={colors.status.success.main} />
              <Text style={{ color: colors.status.success.main }} className="text-[11px] font-bold">{receiverPhone}</Text>
            </Pressable>
          ) : null}
        </View>

        <View className="flex-row items-start gap-1.5">
          <Ionicons name="location-outline" size={13} color={colors.text.secondary} style={{ marginTop: 2 }} />
          <Text style={{ color: colors.text.secondary }} className="text-[11px] flex-1 leading-4" numberOfLines={2}>
            {destAddress}
          </Text>
        </View>
      </View>

      {/* LPN List if any */}
      {lpns && lpns.length > 0 ? (
        <View className="border-t border-dashed border-slate-200 pt-2 flex-row flex-wrap items-center gap-1.5">
          <Text style={{ color: colors.text.secondary }} className="text-[10px] font-bold">Mã LPN:</Text>
          {lpns.map((lpn) => (
            <View key={lpn.lpnId} style={{ backgroundColor: colors.surface.page, borderColor: colors.border.default }} className="rounded-md border px-2 py-0.5">
              <Text style={{ color: colors.text.primary }} className="text-[10px] font-bold">{lpn.lpnCode}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function InfoRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View className="flex-row items-start justify-between gap-4 border-b border-slate-100 pb-2">
      <Text style={{ color: colors.text.secondary }} className="text-xs">
        {label}
      </Text>
      <Text
        numberOfLines={2}
        style={{ color: highlight ? colors.brand.primary : colors.text.primary }}
        className={`flex-1 text-right text-xs ${highlight ? 'font-bold text-sm' : 'font-semibold'}`}
      >
        {value}
      </Text>
    </View>
  );
}
