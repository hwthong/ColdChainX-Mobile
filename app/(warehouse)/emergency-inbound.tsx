import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { StatusBadge } from '../../components/StatusBadge';
import { colors } from '../../constants/colors';
import { ApiClientError, getApiErrorMessage } from '../../services/apiClient';
import {
  getIncidentDetail,
  getIncidents,
  inboundRouteWarehouse,
  InboundRouteWarehouseResponse,
  IncidentResponse,
} from '../../services/incidentApi';
import { useAuthStore } from '../../store/useAuthStore';

export default function WarehouseEmergencyInboundScreen() {
  const params = useLocalSearchParams<{ incidentId?: string | string[] }>();
  const initialIncidentId = Array.isArray(params.incidentId) ? params.incidentId[0] : params.incidentId;
  const router = useRouter();
  const token = useAuthStore((state) => state.token);

  const [selectedIncidentId, setSelectedIncidentId] = useState<string | undefined>(initialIncidentId);
  const [incident, setIncident] = useState<IncidentResponse | null>(null);
  const [inTransitIncidents, setInTransitIncidents] = useState<IncidentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sealNumber, setSealNumber] = useState('');
  const [inlineError, setInlineError] = useState<string | null>(null);

  // Success Sheet State
  const [isSuccessSheetVisible, setIsSuccessSheetVisible] = useState(false);
  const [successResult, setSuccessResult] = useState<InboundRouteWarehouseResponse | null>(null);

  const loadData = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      if (selectedIncidentId) {
        const res = await getIncidentDetail(token, selectedIncidentId);
        if (res.success && res.data) {
          setIncident(res.data);
        } else {
          setIncident(null);
        }
      } else {
        // Query incidents in transit
        const listRes = await getIncidents(token, undefined, 1, 30);
        if (listRes.success && listRes.data?.data) {
          const transitList = listRes.data.data.filter(
            (item) => item.status === 'EXTERNAL_REEFER_IN_TRANSIT'
          );
          setInTransitIncidents(transitList);
          if (transitList.length > 0) {
            setSelectedIncidentId(transitList[0].incidentId);
            setIncident(transitList[0]);
          }
        }
      }
    } catch (e: unknown) {
      const is404 =
        (e instanceof ApiClientError && e.status === 404) ||
        (e instanceof Error &&
          (e.message.includes('404') ||
            e.message.toLowerCase().includes('not found') ||
            e.message.toLowerCase().includes('không tìm thấy')));

      if (!is404) {
        Alert.alert('Lỗi', getApiErrorMessage(e));
      }
      setIncident(null);
    } finally {
      setLoading(false);
    }
  }, [token, selectedIncidentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleConfirmInbound = async () => {
    const trimmedSeal = sealNumber.trim();
    if (!trimmedSeal) {
      setInlineError('Vui lòng nhập số seal niêm phong.');
      return;
    }
    const currentIncidentId = incident?.incidentId || selectedIncidentId;
    if (!token || !currentIncidentId) return;

    setInlineError(null);
    setSubmitting(true);

    try {
      const res = await inboundRouteWarehouse(token, currentIncidentId, trimmedSeal);
      if (res.success && res.data) {
        setSuccessResult(res.data);
        setIsSuccessSheetVisible(true);
      } else {
        setInlineError(res.message || 'Seal không khớp. Vui lòng kiểm tra lại số seal trên xe.');
      }
    } catch (e: unknown) {
      const msg = getApiErrorMessage(e);
      setInlineError(msg || 'Seal không khớp hoặc không hợp lệ.');
    } finally {
      setSubmitting(false);
    }
  };

  const destinationWarehouseName =
    incident?.externalReeferPlan?.destinationWarehouseName ||
    incident?.externalReeferPlan?.routeDestinationCity ||
    'Kho đích tuyến';

  const externalPlate = incident?.externalReeferPlan?.vehiclePlate || 'Xe cứu hộ';
  // Dùng lpnCount từ response backend; nếu không có hiển thị dấu ? thay vì hardcode 12
  const lpnCount = successResult?.lpnCount ?? incident?.externalReeferPlan?.lpnIds?.length ?? null;

  if (loading) {
    return (
      <View style={{ backgroundColor: colors.surface.page }} className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.brand.primary} />
        <Text style={{ color: colors.brand.primary }} className="mt-3 font-semibold">
          Đang tải thông tin Inbound sự cố...
        </Text>
      </View>
    );
  }

  if (!incident) {
    return (
      <View style={{ backgroundColor: colors.surface.page }} className="flex-1">
        <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="border-b px-4 pt-12 pb-4 shadow-sm">
          <View className="flex-row items-center justify-between">
            <Pressable onPress={() => router.back()} style={{ backgroundColor: colors.brand.primarySoft }} className="rounded-full p-2">
              <Ionicons name="arrow-back" size={20} color={colors.brand.primary} />
            </Pressable>
            <Text style={{ color: colors.text.primary }} className="text-lg font-bold">
              Inbound hàng sự cố
            </Text>
            <View className="w-10" />
          </View>
        </View>
        <View className="flex-1 items-center justify-center p-6">
          <Ionicons name="car-outline" size={56} color={colors.text.muted} />
          <Text style={{ color: colors.text.primary }} className="mt-4 text-base font-bold text-center">
            Hiện không có xe ngoài nào đang đến
          </Text>
          <Text style={{ color: colors.text.secondary }} className="mt-1 text-xs text-center">
            Khi điều phối phát lệnh thuê xe lạnh ngoài, xe sẽ xuất hiện tại đây để nhân viên kho nhập seal.
          </Text>
          <Pressable onPress={loadData} style={{ backgroundColor: colors.brand.primary }} className="mt-6 rounded-xl px-6 py-3">
            <Text style={{ color: colors.text.onPrimary }} className="font-bold">
              Kiểm tra lại
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ backgroundColor: colors.surface.page }}
      className="flex-1"
    >
      {/* Header AppBar */}
      <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="border-b px-4 pt-12 pb-4 shadow-sm">
        <View className="flex-row items-center justify-between">
          <Pressable onPress={() => router.back()} style={{ backgroundColor: colors.brand.primarySoft }} className="rounded-full p-2">
            <Ionicons name="arrow-back" size={20} color={colors.brand.primary} />
          </Pressable>
          <Text style={{ color: colors.text.primary }} className="text-lg font-bold">
            Inbound hàng sự cố
          </Text>
          <StatusBadge status={incident?.status || 'EXTERNAL_REEFER_IN_TRANSIT'} showVietnameseLabel />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} className="flex-1">
        {/* Multi-incident switcher if more than 1 */}
        {inTransitIncidents.length > 1 && (
          <View className="gap-2">
            <Text style={{ color: colors.text.secondary }} className="text-xs font-bold uppercase">
              Chọn xe ngoài đang đến:
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
              {inTransitIncidents.map((item) => (
                <Pressable
                  key={item.incidentId}
                  onPress={() => {
                    setSelectedIncidentId(item.incidentId);
                    setIncident(item);
                    // Reset form khi đổi sang incident khác
                    setSealNumber('');
                    setInlineError(null);
                  }}
                  style={{
                    backgroundColor: item.incidentId === selectedIncidentId ? colors.surface.selected : colors.surface.card,
                    borderColor: item.incidentId === selectedIncidentId ? colors.brand.primary : colors.border.default,
                  }}
                  className="rounded-2xl border p-3"
                >
                  <Text style={{ color: colors.text.primary }} className="font-bold">
                    {item.externalReeferPlan?.vehiclePlate || item.incidentId}
                  </Text>
                  <Text style={{ color: colors.text.secondary }} className="text-[10px]">
                    {item.externalReeferPlan?.rentalProvider || 'Xe cứu hộ'}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Card Incident & Xe ngoài */}
        <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="gap-3 rounded-3xl border p-5 shadow-sm">
          <View className="flex-row items-center justify-between border-b border-slate-100 pb-3">
            <View className="flex-row items-center gap-2">
              <Ionicons name="lock-closed" size={18} color="#334155" />
              <Text style={{ color: colors.text.primary }} className="text-base font-bold">
                {destinationWarehouseName} 🔒
              </Text>
            </View>
            <View className="rounded-lg bg-blue-100 px-2.5 py-1">
              <Text className="text-xs font-bold text-blue-900">Bắt buộc theo tuyến</Text>
            </View>
          </View>

          <View className="gap-2 pt-1">
            <View className="flex-row items-center justify-between">
              <Text style={{ color: colors.text.secondary }} className="text-xs">Xe ngoài:</Text>
              <Text style={{ color: colors.text.primary }} className="text-sm font-bold">{externalPlate}</Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text style={{ color: colors.text.secondary }} className="text-xs">Mã sự cố:</Text>
              <Text numberOfLines={1} style={{ color: colors.text.primary }} className="max-w-[200px] text-xs font-semibold">
                {incident?.incidentId || selectedIncidentId || '--'}
              </Text>
            </View>
            {incident?.externalReeferPlan?.driverName ? (
              <View className="flex-row items-center justify-between">
                <Text style={{ color: colors.text.secondary }} className="text-xs">Tài xế xe ngoài:</Text>
                <Text style={{ color: colors.text.primary }} className="text-xs font-medium">
                  {incident.externalReeferPlan.driverName}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Input Số Seal */}
        <View style={{ backgroundColor: colors.surface.card, borderColor: inlineError ? colors.status.danger.main : colors.border.default }} className="gap-3 rounded-3xl border p-5 shadow-sm">
          <Text style={{ color: colors.text.primary }} className="text-sm font-bold">
            Số seal niêm phong *
          </Text>

          <View style={{ backgroundColor: colors.surface.page, borderColor: colors.border.default }} className="flex-row items-center rounded-2xl border px-3">
            <TextInput
              value={sealNumber}
              onChangeText={(val) => {
                setSealNumber(val);
                if (inlineError) setInlineError(null);
              }}
              placeholder="Nhập số seal trên xe (Ví dụ: EXT-SEAL-001)"
              placeholderTextColor={colors.text.muted}
              autoCapitalize="characters"
              editable={!submitting}
              className="flex-1 py-3.5 text-base font-bold text-slate-800"
            />
            {sealNumber.length > 0 && !submitting && (
              <Pressable onPress={() => setSealNumber('')} className="p-2">
                <Ionicons name="close-circle" size={20} color={colors.text.muted} />
              </Pressable>
            )}
          </View>

          {/* Inline Error Message */}
          {inlineError ? (
            <View className="flex-row items-center gap-2 rounded-xl bg-red-50 p-3">
              <Ionicons name="alert-circle" size={18} color={colors.status.danger.main} />
              <Text style={{ color: colors.status.danger.main }} className="flex-1 text-xs font-semibold">
                {inlineError}
              </Text>
            </View>
          ) : null}

          {/* Dòng mô tả quy định */}
          <View className="mt-2 flex-row items-start gap-2 rounded-2xl bg-amber-50 p-3.5 border border-amber-200">
            <Ionicons name="information-circle" size={20} color="#D97706" />
            <View className="flex-1">
              <Text className="text-xs font-bold text-amber-950">
                Tự động nhập toàn bộ LPN
              </Text>
              <Text className="text-xs text-amber-900 mt-0.5">
                Hệ thống sẽ tự động nhập toàn bộ LPN vào trạng thái IN_STOCK; không thực hiện QC hoặc kiểm tra từng kiện.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom CTA Bar */}
      <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="border-t p-4 shadow-lg">
        <Pressable
          onPress={handleConfirmInbound}
          disabled={submitting || !sealNumber.trim()}
          style={{
            backgroundColor: submitting || !sealNumber.trim() ? colors.surface.muted : colors.brand.primary,
            minHeight: 48,
          }}
          className="items-center justify-center rounded-2xl shadow-sm"
        >
          {submitting ? (
            <ActivityIndicator color={colors.text.onPrimary} />
          ) : (
            <Text
              style={{
                color: !sealNumber.trim() ? colors.text.secondary : colors.text.onPrimary,
              }}
              className="text-base font-bold"
            >
              Xác nhận nhập kho
            </Text>
          )}
        </Pressable>
      </View>

      {/* SUCCESS SHEET MODAL */}
      <Modal visible={isSuccessSheetVisible} transparent animationType="slide" onRequestClose={() => {}}>
        <View className="flex-1 justify-end bg-black/60">
          <View style={{ backgroundColor: colors.surface.card }} className="rounded-t-3xl p-6 shadow-2xl items-center">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-4">
              <Ionicons name="checkmark-circle" size={40} color="#166534" />
            </View>

            <Text style={{ color: colors.text.primary }} className="text-xl font-bold text-center">
              ✓ Đã inbound về {destinationWarehouseName}
            </Text>

            <View style={{ backgroundColor: colors.surface.page, borderColor: colors.border.default }} className="w-full rounded-2xl border p-4 my-4 gap-2">
              <View className="flex-row items-center justify-between">
                <Text style={{ color: colors.text.secondary }} className="text-xs">Mã Receipt:</Text>
                <Text style={{ color: colors.text.primary }} className="text-sm font-bold">
                  {successResult?.receiptCode || successResult?.receiptId || 'INC-IN-SUCCESS'}
                </Text>
              </View>
              <View className="flex-row items-center justify-between">
                <Text style={{ color: colors.text.secondary }} className="text-xs">Trạng thái hàng:</Text>
                <Text className="text-xs font-bold text-green-700">
                  {lpnCount !== null ? `${lpnCount} LPN đã chuyển sang IN_STOCK` : 'Toàn bộ LPN đã chuyển sang IN_STOCK'}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => {
                setIsSuccessSheetVisible(false);
                router.replace('/(warehouse)/inbound' as never);
              }}
              style={{ backgroundColor: colors.brand.primary, minHeight: 48 }}
              className="w-full items-center justify-center rounded-2xl shadow-sm"
            >
              <Text style={{ color: colors.text.onPrimary }} className="text-base font-bold">
                Về danh sách công việc
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
