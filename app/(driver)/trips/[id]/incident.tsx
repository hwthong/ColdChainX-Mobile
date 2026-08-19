import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors } from '../../../../constants/colors';
import {
  createIncident,
  getIncidentSubmitErrorMessage,
  IncidentSeverity,
  IncidentType,
} from '../../../../services/incidentApi';
import {
  getTrackingByTripId,
  TrackingDataResponse,
} from '../../../../services/trackingApi';
import { useAuthStore } from '../../../../store/useAuthStore';

const DEVICE_LOCATION_TIMEOUT_MS = 10_000;
const IOT_LOCATION_MAX_AGE_MS = 5 * 60 * 1000;
const ALLOWED_CLOCK_SKEW_MS = 60 * 1000;

type IncidentLocation = {
  latitude: number;
  longitude: number;
  source: 'DEVICE' | 'IOT';
};

const INCIDENT_TYPES: {
  label: string;
  value: IncidentType;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  description: string;
}[] = [
  { label: 'Xe hư hỏng', value: 'VEHICLE_BREAKDOWN', icon: 'car-sport-outline', description: 'Động cơ, lốp xe, kỹ thuật' },
  { label: 'Thùng/máy lạnh', value: 'REEFER_BREAKDOWN', icon: 'snow-outline', description: 'Hỏng máy lạnh, mất nhiệt' },
  { label: 'Biến động nhiệt', value: 'TEMP_EXCURSION', icon: 'thermometer-outline', description: 'Nhiệt vượt ngưỡng an toàn' },
  { label: 'Hỏng hàng hóa', value: 'DAMAGE_CARGO', icon: 'cube-outline', description: 'Bao bì rách, đổ vỡ kiện' },
  { label: 'Tai nạn', value: 'ACCIDENT', icon: 'warning-outline', description: 'Va chạm giao thông trên đường' },
  { label: 'Chậm trễ', value: 'DELAY', icon: 'time-outline', description: 'Ùn tắc hoặc sự cố thời gian' },
];

export type IncidentUiRiskLevel = 'LOW' | 'WARNING' | 'CRITICAL';

const SEVERITIES: {
  label: string;
  value: IncidentUiRiskLevel;
  backendSeverity: IncidentSeverity;
  color: string;
  desc: string;
}[] = [
  { label: 'Thấp (LOW)', value: 'LOW', backendSeverity: 'LOW', color: '#16a34a', desc: 'Sự cố nhẹ, tự xử lý tại chỗ' },
  { label: 'Cảnh báo (WARNING)', value: 'WARNING', backendSeverity: 'MEDIUM', color: '#d97706', desc: 'Có nguy cơ, cần hỗ trợ' },
  { label: 'Nghiêm trọng (CRITICAL)', value: 'CRITICAL', backendSeverity: 'CRITICAL', color: '#dc2626', desc: 'Cứu hộ bắt buộc / Đổi xe' },
];

export default function DriverTripIncidentScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const tripId = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const token = useAuthStore((state) => state.token);

  const [type, setType] = useState<IncidentType>('VEHICLE_BREAKDOWN');
  const [riskLevel, setRiskLevel] = useState<IncidentUiRiskLevel>('CRITICAL');
  const [requiresRescue, setRequiresRescue] = useState(true);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [receiptUri, setReceiptUri] = useState<string | null>(null);

  const handleTypeChange = (selectedType: IncidentType) => {
    setType(selectedType);
    if (selectedType === 'VEHICLE_BREAKDOWN' || selectedType === 'REEFER_BREAKDOWN') {
      setRiskLevel('CRITICAL');
      setRequiresRescue(true);
    }
  };

  const handleRiskLevelChange = (selectedRisk: IncidentUiRiskLevel) => {
    setRiskLevel(selectedRisk);
    if (selectedRisk === 'CRITICAL') {
      setRequiresRescue(true);
    } else {
      setRequiresRescue(false);
    }
  };

  const [submitting, setSubmitting] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);

  const pickImage = async (setUri: (uri: string | null) => void) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setUri(result.assets[0].uri);
    }
  };

  const getLocation = async (): Promise<IncidentLocation | null> => {
    setLocationLoading(true);
    let permissionStatus: Location.PermissionStatus | null = null;
    let servicesEnabled: boolean | null = null;

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      permissionStatus = permission.status;
      servicesEnabled = await Location.hasServicesEnabledAsync();

      if (permission.status === 'granted' && servicesEnabled) {
        try {
          const loc = await withTimeout(
            Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
              mayShowUserSettingsDialog: true,
            }),
            DEVICE_LOCATION_TIMEOUT_MS
          );
          const deviceLocation = toIncidentLocation(
            loc.coords.latitude,
            loc.coords.longitude,
            'DEVICE'
          );
          if (deviceLocation) return deviceLocation;
        } catch {
          // Fallback to vehicle IoT
        }
      }
    } catch {
      // Fallback
    }

    try {
      const trackingResponse = await getTrackingByTripId(token!, tripId!);
      const iotLocation = getFreshIotLocation(trackingResponse.data);
      if (trackingResponse.success && iotLocation) return iotLocation;
    } catch {
      // Error
    } finally {
      setLocationLoading(false);
    }

    if (permissionStatus !== 'granted') {
      Alert.alert(
        'Lỗi',
        'Vui lòng cho phép ColdChainX truy cập vị trí; hiện chưa có tọa độ IoT mới của chuyến xe.'
      );
    } else if (servicesEnabled === false) {
      Alert.alert(
        'Lỗi',
        'Vui lòng bật dịch vụ vị trí trên thiết bị; hiện chưa có tọa độ IoT mới của chuyến xe.'
      );
    } else {
      Alert.alert('Lỗi', 'Chưa thể xác định vị trí hiện tại của chuyến xe từ GPS thiết bị hoặc IoT.');
    }

    return null;
  };

  const handleSubmit = async () => {
    if (!token || !tripId) return;
    if (!description.trim()) {
      Alert.alert('Yêu cầu thông tin', 'Vui lòng nhập mô tả chi tiết sự cố.');
      return;
    }

    setSubmitting(true);
    const coords = await getLocation();
    if (!coords) {
      setSubmitting(false);
      return;
    }

    try {
      const selectedSeverityConfig = SEVERITIES.find((s) => s.value === riskLevel) || SEVERITIES[2];
      const formData = new FormData();
      formData.append('TripId', tripId);
      formData.append('IncidentType', type);
      formData.append('Severity', selectedSeverityConfig.backendSeverity);
      formData.append('RiskLevel', riskLevel);
      formData.append('Description', description.trim());
      formData.append('RequiresRescue', String(requiresRescue));
      formData.append('CurrentLatitude', String(coords.latitude));
      formData.append('CurrentLongitude', String(coords.longitude));
      if (amount.trim()) formData.append('DriverPaidAmount', amount.trim());

      if (photoUri) {
        const filename = photoUri.split('/').pop() || 'photo.jpg';
        formData.append('EvidenceFiles', toImageFormPart(photoUri, filename));
      }
      if (receiptUri) {
        const originalName = receiptUri.split('/').pop() || 'receipt.jpg';
        const filename = originalName.toLowerCase().includes('receipt')
          ? originalName
          : `receipt-${originalName}`;
        formData.append('EvidenceFiles', toImageFormPart(receiptUri, filename));
      }

      const hasEvidence = Boolean(photoUri || receiptUri);
      const res = await createIncident(token, formData, {
        tripId,
        hasEvidence,
        locationSource: coords.source,
      });
      if (res.success) {
        Alert.alert(
          'Thành công',
          hasEvidence ? 'Đã gửi báo cáo sự cố kèm hình ảnh minh chứng.' : 'Đã gửi báo cáo sự cố thành công.'
        );
        router.replace(`/(driver)/trips/${tripId}/incident-detail?incidentId=${res.data?.incidentId}` as never);
      } else {
        Alert.alert('Lỗi', res.message || 'Không thể gửi báo cáo sự cố.');
      }
    } catch (error: unknown) {
      Alert.alert('Thất bại', getIncidentSubmitErrorMessage(error));
    } finally {
      setSubmitting(false);
      setLocationLoading(false);
    }
  };

  return (
    <View style={{ backgroundColor: colors.surface.page }} className="flex-1">
      {/* AppBar Header */}
      <View
        style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }}
        className="border-b px-4 pt-12 pb-3 shadow-sm"
      >
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => router.back()}
            style={{ backgroundColor: colors.brand.primarySoft }}
            className="rounded-full p-2.5"
          >
            <Ionicons name="arrow-back" size={18} color={colors.brand.primary} />
          </Pressable>
          <View className="flex-1 px-3">
            <Text style={{ color: colors.text.secondary }} className="text-[10px] font-bold uppercase tracking-wider">
              Báo Cáo Sự Cố
            </Text>
            <Text numberOfLines={1} style={{ color: colors.text.primary }} className="text-base font-bold">
              Chuyến {tripId?.slice(0, 8).toUpperCase() || '--'}
            </Text>
          </View>
          <View style={{ backgroundColor: colors.status.danger.bg }} className="rounded-full px-3 py-1">
            <Text style={{ color: colors.status.danger.main }} className="text-xs font-bold">Báo Cáo</Text>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 100, gap: 14 }}
      >
        {/* 1. LOẠI SỰ CỐ */}
        <View
          style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }}
          className="gap-3 rounded-3xl border p-5 shadow-sm"
        >
          <View className="flex-row items-center gap-2 border-b border-slate-100 pb-2.5">
            <Ionicons name="alert-circle" size={18} color={colors.brand.primary} />
            <Text style={{ color: colors.text.primary }} className="text-sm font-bold">
              1. Phân loại sự cố *
            </Text>
          </View>

          <View className="flex-row flex-wrap gap-2">
            {INCIDENT_TYPES.map((t) => {
              const isSelected = type === t.value;
              return (
                <Pressable
                  key={t.value}
                  onPress={() => handleTypeChange(t.value)}
                  style={{
                    backgroundColor: isSelected ? colors.brand.primarySoft : colors.surface.page,
                    borderColor: isSelected ? colors.brand.primary : colors.border.default,
                  }}
                  className="flex-row items-center gap-1.5 rounded-2xl border px-3.5 py-2.5"
                >
                  <Ionicons
                    name={t.icon}
                    size={16}
                    color={isSelected ? colors.brand.primary : colors.text.secondary}
                  />
                  <Text
                    style={{
                      color: isSelected ? colors.brand.primary : colors.text.primary,
                      fontWeight: isSelected ? '700' : '500',
                    }}
                    className="text-xs"
                  >
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 2. MỨC ĐỘ & YÊU CẦU CỨU HỘ */}
        <View
          style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }}
          className="gap-3 rounded-3xl border p-5 shadow-sm"
        >
          <View className="flex-row items-center gap-2 border-b border-slate-100 pb-2.5">
            <Ionicons name="speedometer-outline" size={18} color={colors.brand.primary} />
            <Text style={{ color: colors.text.primary }} className="text-sm font-bold">
              2. Mức độ nghiêm trọng *
            </Text>
          </View>

          <View className="flex-row flex-wrap gap-2">
            {SEVERITIES.map((s) => {
              const isSelected = riskLevel === s.value;
              return (
                <Pressable
                  key={s.value}
                  onPress={() => handleRiskLevelChange(s.value)}
                  style={{
                    backgroundColor: isSelected ? colors.brand.primarySoft : colors.surface.page,
                    borderColor: isSelected ? colors.brand.primary : colors.border.default,
                  }}
                  className="flex-row items-center gap-2 rounded-2xl border px-3.5 py-2.5"
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: s.color,
                    }}
                  />
                  <Text
                    style={{
                      color: isSelected ? colors.brand.primary : colors.text.primary,
                      fontWeight: isSelected ? '700' : '500',
                    }}
                    className="text-xs"
                  >
                    {s.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Switch Cứu hộ */}
          <View
            style={{ backgroundColor: colors.surface.page, borderColor: colors.border.default }}
            className="mt-1 flex-row items-center justify-between rounded-2xl border p-3.5"
          >
            <View className="flex-1 pr-3">
              <Text style={{ color: colors.text.primary }} className="text-xs font-bold">
                Yêu cầu xe thay thế (Cứu hộ bắt buộc)
              </Text>
              <Text style={{ color: colors.text.secondary }} className="text-[11px] mt-0.5">
                Bật nếu phương tiện không thể tiếp tục vận chuyển
              </Text>
            </View>
            <Switch
              value={requiresRescue}
              onValueChange={setRequiresRescue}
              trackColor={{ false: '#e2e8f0', true: colors.brand.primary }}
              thumbColor="#ffffff"
            />
          </View>
        </View>

        {/* 3. MÔ TẢ & CHI PHÍ */}
        <View
          style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }}
          className="gap-3 rounded-3xl border p-5 shadow-sm"
        >
          <View className="flex-row items-center gap-2 border-b border-slate-100 pb-2.5">
            <Ionicons name="document-text-outline" size={18} color={colors.brand.primary} />
            <Text style={{ color: colors.text.primary }} className="text-sm font-bold">
              3. Mô tả sự cố & Chi phí
            </Text>
          </View>

          <View>
            <Text style={{ color: colors.text.secondary }} className="text-xs font-semibold mb-1.5">
              Mô tả chi tiết *
            </Text>
            <TextInput
              style={{
                backgroundColor: colors.surface.page,
                borderColor: colors.border.default,
                color: colors.text.primary,
              }}
              className="h-24 rounded-2xl border p-3.5 text-xs font-medium"
              placeholder="Ví dụ: Xe hỏng lốp trên QL1A, mất nhiệt độ thùng xe..."
              placeholderTextColor={colors.text.muted}
              multiline
              value={description}
              onChangeText={setDescription}
              editable={!submitting}
            />
          </View>

          <View>
            <Text style={{ color: colors.text.secondary }} className="text-xs font-semibold mb-1.5">
              Số tiền đã ứng trước (VNĐ, nếu có)
            </Text>
            <TextInput
              style={{
                backgroundColor: colors.surface.page,
                borderColor: colors.border.default,
                color: colors.text.primary,
              }}
              className="rounded-2xl border p-3 text-xs font-medium"
              placeholder="Nhập số tiền VNĐ (ví dụ: 500000)"
              placeholderTextColor={colors.text.muted}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
              editable={!submitting}
            />
          </View>
        </View>

        {/* 4. HÌNH ẢNH MINH CHỨNG */}
        <View
          style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }}
          className="gap-3 rounded-3xl border p-5 shadow-sm"
        >
          <View className="flex-row items-center gap-2 border-b border-slate-100 pb-2.5">
            <Ionicons name="camera-outline" size={18} color={colors.brand.primary} />
            <Text style={{ color: colors.text.primary }} className="text-sm font-bold">
              4. Hình ảnh & Hóa đơn chứng từ
            </Text>
          </View>

          <View className="flex-row gap-3">
            {/* Ảnh sự cố */}
            <Pressable
              onPress={() => pickImage(setPhotoUri)}
              style={{
                backgroundColor: photoUri ? '#ffffff' : colors.surface.page,
                borderColor: photoUri ? colors.brand.primary : colors.border.default,
              }}
              className="flex-1 items-center justify-center rounded-2xl border border-dashed p-3.5 min-h-[90px]"
            >
              {photoUri ? (
                <View className="items-center gap-1">
                  <Image source={{ uri: photoUri }} className="h-12 w-12 rounded-xl" />
                  <Text style={{ color: colors.brand.primary }} className="text-[10px] font-bold">
                    Đổi ảnh sự cố
                  </Text>
                </View>
              ) : (
                <>
                  <Ionicons name="camera" size={24} color={colors.brand.primary} />
                  <Text style={{ color: colors.text.secondary }} className="mt-1 text-xs font-medium">
                    Ảnh sự cố
                  </Text>
                </>
              )}
            </Pressable>

            {/* Ảnh hóa đơn */}
            <Pressable
              onPress={() => pickImage(setReceiptUri)}
              style={{
                backgroundColor: receiptUri ? '#ffffff' : colors.surface.page,
                borderColor: receiptUri ? colors.brand.primary : colors.border.default,
              }}
              className="flex-1 items-center justify-center rounded-2xl border border-dashed p-3.5 min-h-[90px]"
            >
              {receiptUri ? (
                <View className="items-center gap-1">
                  <Image source={{ uri: receiptUri }} className="h-12 w-12 rounded-xl" />
                  <Text style={{ color: colors.brand.primary }} className="text-[10px] font-bold">
                    Đổi hóa đơn
                  </Text>
                </View>
              ) : (
                <>
                  <Ionicons name="receipt" size={24} color={colors.brand.primary} />
                  <Text style={{ color: colors.text.secondary }} className="mt-1 text-xs font-medium">
                    Hóa đơn/Biên lai
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* Fixed Bottom CTA */}
      <View
        style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }}
        className="border-t p-4 shadow-lg"
      >
        <Pressable
          onPress={handleSubmit}
          disabled={submitting || locationLoading}
          style={{
            backgroundColor: submitting || locationLoading ? colors.surface.muted : colors.brand.primary,
            minHeight: 50,
          }}
          className="flex-row items-center justify-center gap-2 rounded-2xl shadow-sm"
        >
          {submitting || locationLoading ? (
            <ActivityIndicator color={colors.text.onPrimary} />
          ) : (
            <>
              <Ionicons name="paper-plane" size={18} color={colors.text.onPrimary} />
              <Text style={{ color: colors.text.onPrimary }} className="text-base font-bold">
                Gửi Báo Cáo Sự Cố
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function toImageFormPart(uri: string, name: string) {
  const extension = /\.(\w+)$/.exec(name)?.[1]?.toLowerCase();
  const type = extension === 'png'
    ? 'image/png'
    : extension === 'webp'
      ? 'image/webp'
      : 'image/jpeg';

  return { uri, name, type } as any;
}

function getFreshIotLocation(tracking: TrackingDataResponse | null | undefined): IncidentLocation | null {
  const telemetry = tracking?.latestTelemetry;
  if (!telemetry || tracking?.device?.isOnline === false || !telemetry.timestamp) return null;

  const timestamp = Date.parse(telemetry.timestamp);
  if (!Number.isFinite(timestamp)) return null;

  const ageMs = Date.now() - timestamp;
  if (ageMs < -ALLOWED_CLOCK_SKEW_MS || ageMs > IOT_LOCATION_MAX_AGE_MS) return null;

  return toIncidentLocation(telemetry.lat, telemetry.lon, 'IOT');
}

function toIncidentLocation(
  latitude: number,
  longitude: number,
  source: IncidentLocation['source']
): IncidentLocation | null {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180 ||
    (latitude === 0 && longitude === 0)
  ) {
    return null;
  }

  return { latitude, longitude, source };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error('Location request timed out.')), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
}
