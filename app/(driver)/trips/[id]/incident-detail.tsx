import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { colors } from '../../../../constants/colors';
import { confirmTransload, continueTrip, getIncidentDetail, IncidentResponse } from '../../../../services/incidentApi';
import { useAuthStore } from '../../../../store/useAuthStore';

const POLL_MS = 15_000;
const INCIDENT_STATUS: Record<string, string> = {
  REPORTED: 'Đã báo cáo',
  RESCUE_DISPATCHED: 'Đã điều xe cứu hộ',
  TRANSLOAD_COMPLETED: 'Đã sang hàng',
  CONTINUED: 'Tiếp tục hành trình',
  RESOLVED: 'Đã xử lý',
};
const INCIDENT_TYPE: Record<string, string> = {
  VEHICLE_BREAKDOWN: 'Hỏng xe',
  CARGO_DAMAGE: 'Hỏng hàng hóa',
  TEMPERATURE_FLUCTUATION: 'Biến động nhiệt độ',
  ACCIDENT: 'Tai nạn',
  OTHER: 'Khác',
};
const SEVERITY: Record<string, string> = {
  LOW: 'Thấp', MEDIUM: 'Trung bình', HIGH: 'Cao', CRITICAL: 'Nghiêm trọng',
};

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
    } catch (e: any) {
      setError(e.message || 'Có lỗi xảy ra khi kết nối máy chủ.');
      return null;
    }
  }, [token, incidentId]);

  useFocusEffect(useCallback(() => {
    if (!token || !incidentId) {
      setError('Thiếu phiên đăng nhập hoặc IncidentId hợp lệ.');
      setLoading(false);
      return;
    }
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let inFlight = false;
    let appState = AppState.currentState;

    const clear = () => { if (timer) clearTimeout(timer); timer = null; };
    const poll = async () => {
      if (disposed || inFlight || appState !== 'active') return;
      inFlight = true;
      const current = await loadIncident();
      inFlight = false;
      setLoading(false);

      if (disposed) return;
      if (current?.status === 'RESOLVED') {
        clear();
        return; // Dừng poll
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

    return () => { disposed = true; clear(); sub.remove(); };
  }, [loadIncident, token, incidentId]));

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadIncident();
    setRefreshing(false);
  };

  const handleContinueTrip = async () => {
    if (!token || !incidentId) return;
    Alert.alert('Xác nhận', 'Bạn có chắc chắn muốn tiếp tục hành trình với xe hiện tại không?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đồng ý', onPress: async () => {
        setActionLoading(true);
        try {
          const res = await continueTrip(token, incidentId, 'Tài xế xác nhận xe có thể tiếp tục.');
          if (res.success) {
            Alert.alert('Thành công', 'Đã đánh dấu tiếp tục hành trình.');
            await loadIncident();
          } else {
            Alert.alert('Lỗi', res.message || 'Không thể xác nhận tiếp tục.');
          }
        } catch (e: any) {
          Alert.alert('Lỗi', e.message || 'Có lỗi khi kết nối.');
        } finally {
          setActionLoading(false);
        }
      }}
    ]);
  };

  const handleConfirmTransload = async () => {
    if (!token || !incidentId) return;
    Alert.alert('Xác nhận', 'Bạn đã hoàn tất việc sang toàn bộ hàng hoá sang xe thay thế?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xác nhận Đã Sang Hàng', onPress: async () => {
        setActionLoading(true);
        try {
          const res = await confirmTransload(token, incidentId, 'Tài xế xác nhận đã sang hàng.');
          if (res.success) {
            Alert.alert('Thành công', 'Đã xác nhận chuyển tải thành công. Chuyến xe sẽ được tiếp tục.');
            await loadIncident();
          } else {
            Alert.alert('Lỗi', res.message || 'Bạn không có quyền hoặc có lỗi xảy ra.');
          }
        } catch {
          Alert.alert('Lỗi', 'Bạn không có quyền xác nhận sang hàng hoặc máy chủ bị lỗi.');
        } finally {
          setActionLoading(false);
        }
      }}
    ]);
  };

  if (loading) {
    return (
      <View style={{ backgroundColor: colors.surface.page }} className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.brand.primary} />
        <Text style={{ color: colors.brand.primary }} className="mt-4 font-medium">Đang tải chi tiết sự cố...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ backgroundColor: colors.surface.page }} className="flex-1 items-center justify-center p-5">
        <View className="items-center rounded-2xl bg-red-50 p-6">
          <Ionicons name="alert-circle-outline" size={48} color={colors.status.danger.main} />
          <Text style={{ color: colors.status.danger.main }} className="mt-4 text-center font-semibold">{error}</Text>
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
        <Text style={{ color: colors.text.secondary }} className="font-medium">Không tìm thấy dữ liệu.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: colors.surface.page }} className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 100, gap: 16 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.brand.primary} />}>
      <Pressable onPress={() => router.back()} style={{ backgroundColor: colors.brand.primarySoft }} className="mb-2 self-start rounded-full p-2">
        <Ionicons name="arrow-back" size={24} color={colors.brand.primary} />
      </Pressable>
      
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text style={{ color: colors.text.secondary }} className="text-xs font-bold uppercase tracking-widest">Mã Sự Cố</Text>
          <Text style={{ color: colors.text.primary }} className="mt-1 text-2xl font-bold">{incident.incidentCode}</Text>
        </View>
        <View className="rounded-xl bg-red-100 px-3 py-2">
          <Text className="text-xs font-bold text-red-900">{INCIDENT_STATUS[incident.status] || incident.status}</Text>
        </View>
      </View>

      <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="gap-4 rounded-3xl border p-5 shadow-sm">
        <View className="flex-row items-center gap-2">
          <Ionicons name="warning-outline" size={20} color={colors.brand.primary} />
          <Text style={{ color: colors.text.primary }} className="text-base font-bold">Thông tin chung</Text>
        </View>
        <InfoRow label="Loại sự cố" value={INCIDENT_TYPE[incident.incidentType] || incident.incidentType} />
        <InfoRow label="Mức độ" value={SEVERITY[incident.severity] || incident.severity} />
        <InfoRow label="Cần xe cứu hộ" value={incident.requiresRescue ? 'Có' : 'Không'} />
        <InfoRow label="Mô tả" value={incident.description} />
        <InfoRow label="Thời gian báo" value={new Date(incident.reportedAt).toLocaleString('vi-VN')} />
        <InfoRow label="Xe gặp sự cố" value={incident.brokenVehicleId || '--'} />
        <InfoRow label="Tọa độ GPS" value={incident.currentLatitude ? `${incident.currentLatitude.toFixed(5)}, ${incident.currentLongitude?.toFixed(5)}` : 'Không xác định'} />
      </View>

      {incident.requiresRescue && (
        <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="gap-4 rounded-3xl border p-5 shadow-sm">
          <View className="flex-row items-center gap-2">
            <Ionicons name="car-sport-outline" size={20} color={colors.brand.primary} />
            <Text style={{ color: colors.text.primary }} className="text-base font-bold">Xe thay thế (Cứu hộ)</Text>
          </View>
          <InfoRow label="Trạng thái điều xe" value={incident.replacementVehicleId ? 'Đã điều xe' : 'Đang chờ điều phối'} />
          <InfoRow label="Biển số xe mới" value={incident.replacementVehicleId || '--'} />
          
          {incident.status === 'RESCUE_DISPATCHED' && (
             <View style={{ backgroundColor: colors.surface.selected, borderColor: colors.border.selected }} className="mt-4 rounded-2xl border p-4">
               <Text style={{ color: colors.text.primary }} className="mb-2 text-sm font-bold">Đang chờ sang hàng</Text>
               <Text style={{ color: colors.text.secondary }} className="mb-4 text-xs leading-5">Xe cứu hộ đang trên đường tới hoặc đã tới hiện trường. Vui lòng xác nhận sau khi hoàn tất sang hàng hóa vào xe mới.</Text>
               <Pressable onPress={handleConfirmTransload} disabled={actionLoading} style={{ backgroundColor: colors.brand.primary }} className="items-center rounded-xl p-3">
                 {actionLoading ? <ActivityIndicator color={colors.text.onPrimary} /> : <Text style={{ color: colors.text.onPrimary }} className="font-bold">Xác nhận đã sang hàng</Text>}
               </Pressable>
             </View>
          )}

          {(incident.status === 'RESOLVED' || incident.status === 'TRANSLOAD_COMPLETED') && (
             <View className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-4">
               <Text className="mb-2 text-sm font-bold text-green-900">Đã sang hàng thành công</Text>
               <Text className="mb-4 text-xs text-green-800">Xe mới sẵn sàng. Hãy bấm nút dưới đây để tiếp tục hành trình.</Text>
               <Pressable onPress={handleContinueTrip} disabled={actionLoading} className="items-center rounded-xl bg-green-800 p-3">
                 {actionLoading ? <ActivityIndicator color="white" /> : <Text className="font-bold text-white">Tiếp tục chuyến xe</Text>}
               </Pressable>
             </View>
          )}
        </View>
      )}

      {(incident.driverPaidAmount ?? 0) > 0 ? (
        <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="gap-4 rounded-3xl border p-5 shadow-sm">
          <View className="flex-row items-center gap-2">
            <Ionicons name="cash-outline" size={20} color={colors.brand.primary} />
            <Text style={{ color: colors.text.primary }} className="text-base font-bold">Chi phí phát sinh</Text>
          </View>
          <InfoRow label="Số tiền đã ứng" value={`${incident.driverPaidAmount?.toLocaleString('vi-VN')} VNĐ`} />
        </View>
      ) : null}

      {incident.evidences && incident.evidences.length > 0 && (
        <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="gap-4 rounded-3xl border p-5 shadow-sm">
          <View className="flex-row items-center gap-2">
            <Ionicons name="images-outline" size={20} color={colors.brand.primary} />
            <Text style={{ color: colors.text.primary }} className="text-base font-bold">Hình ảnh & Bằng chứng</Text>
          </View>
          {incident.evidences.map((e) => (
             <Pressable key={e.evidenceId} onPress={() => Linking.openURL(e.fileUrl)} style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="flex-row items-center justify-between rounded-xl border p-3">
                <View className="flex-row items-center gap-3">
                  <Ionicons name={e.evidenceType === 'RECEIPT' ? "receipt" : "image"} size={24} color={colors.brand.primary} />
                  <View>
                    <Text style={{ color: colors.text.primary }} className="text-sm font-medium">{e.evidenceType === 'RECEIPT' ? 'Biên lai/Hoá đơn' : 'Ảnh hiện trường'}</Text>
                    <Text style={{ color: colors.text.secondary }} className="text-xs">{new Date(e.uploadedAt).toLocaleString('vi-VN')}</Text>
                  </View>
                </View>
                <Ionicons name="open-outline" size={20} color={colors.brand.primary} />
              </Pressable>
          ))}
        </View>
      )}

      {incident.resolutionPdfUrl && (
        <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="gap-4 rounded-3xl border p-5 shadow-sm">
          <Pressable onPress={() => Linking.openURL(incident.resolutionPdfUrl!)} className="flex-row items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4">
            <View className="flex-row items-center gap-3">
              <Ionicons name="document-text" size={24} color={colors.status.danger.main} />
              <Text style={{ color: colors.status.danger.main }} className="font-bold">Biên bản xử lý sự cố (PDF)</Text>
            </View>
            <Ionicons name="download-outline" size={20} color={colors.status.danger.main} />
          </Pressable>
        </View>
      )}

    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start justify-between gap-4 border-b border-amber-100 pb-2">
      <Text className="text-sm text-amber-700">{label}</Text>
      <Text className="flex-1 text-right text-sm font-semibold text-amber-950">{value}</Text>
    </View>
  );
}
