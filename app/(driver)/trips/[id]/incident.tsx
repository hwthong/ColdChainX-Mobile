import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';

import { colors } from '../../../../constants/colors';
import { createIncident, getIncidentSubmitErrorMessage, IncidentSeverity, IncidentType } from '../../../../services/incidentApi';
import { getTrackingByTripId, TrackingDataResponse } from '../../../../services/trackingApi';
import { useAuthStore } from '../../../../store/useAuthStore';

const DEVICE_LOCATION_TIMEOUT_MS = 10_000;
const IOT_LOCATION_MAX_AGE_MS = 5 * 60 * 1000;
const ALLOWED_CLOCK_SKEW_MS = 60 * 1000;

type IncidentLocation = {
  latitude: number;
  longitude: number;
  source: 'DEVICE' | 'IOT';
};

const INCIDENT_TYPES: { label: string; value: IncidentType; description: string }[] = [
  { label: 'Xe hư', value: 'VEHICLE_BREAKDOWN', description: 'Động cơ, lốp xe, tai nạn kỹ thuật xe' },
  { label: 'Thùng/máy lạnh hư', value: 'REEFER_BREAKDOWN', description: 'Hỏng máy lạnh, mất nhiệt, hở thùng' },
  { label: 'Biến động nhiệt độ', value: 'TEMP_EXCURSION', description: 'Nhiệt độ vượt ngưỡng an toàn' },
  { label: 'Hỏng hàng hóa', value: 'DAMAGE_CARGO', description: 'Bao bì rách, đổ vỡ kiện hàng' },
  { label: 'Tai nạn', value: 'ACCIDENT', description: 'Va chạm giao thông trên đường' },
  { label: 'Chậm trễ', value: 'DELAY', description: 'Ùn tắc hoặc sự cố thời gian' },
];

const SEVERITIES: { label: string; value: IncidentSeverity }[] = [
  { label: 'Thấp', value: 'LOW' },
  { label: 'Trung bình', value: 'MEDIUM' },
  { label: 'Cao', value: 'HIGH' },
  { label: 'Nghiêm trọng (CRITICAL)', value: 'CRITICAL' },
];

export default function DriverTripIncidentScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const tripId = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const token = useAuthStore((state) => state.token);

  const [type, setType] = useState<IncidentType>('VEHICLE_BREAKDOWN');
  const [severity, setSeverity] = useState<IncidentSeverity>('CRITICAL');
  const [requiresRescue, setRequiresRescue] = useState(true);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('0');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [receiptUri, setReceiptUri] = useState<string | null>(null);

  const handleTypeChange = (selectedType: IncidentType) => {
    setType(selectedType);
    if (selectedType === 'VEHICLE_BREAKDOWN' || selectedType === 'REEFER_BREAKDOWN') {
      setSeverity('CRITICAL');
      setRequiresRescue(true);
    }
  };

  const [submitting, setSubmitting] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);

  const pickImage = async (setUri: (uri: string | null) => void) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.5,
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
          // Vehicle IoT is the business-safe fallback for an assigned trip.
        }
      }
    } catch {
      // Permission/provider failures still allow a fresh vehicle IoT fallback.
    }

    try {
      const trackingResponse = await getTrackingByTripId(token!, tripId!);
      const iotLocation = getFreshIotLocation(trackingResponse.data);
      if (trackingResponse.success && iotLocation) return iotLocation;
    } catch {
      // The final message below reflects that neither source was available.
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
      Alert.alert('Lỗi', 'Vui lòng nhập mô tả sự cố.');
      return;
    }

    setSubmitting(true);
    const coords = await getLocation();
    if (!coords) {
      setSubmitting(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append('TripId', tripId);
      formData.append('IncidentType', type);
      formData.append('Severity', severity);
      formData.append('Description', description.trim());
      formData.append('RequiresRescue', String(requiresRescue));
      formData.append('CurrentLatitude', String(coords.latitude));
      formData.append('CurrentLongitude', String(coords.longitude));
      if (amount) formData.append('DriverPaidAmount', amount);

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
          hasEvidence ? 'Đã gửi báo cáo sự cố kèm hình ảnh.' : 'Đã gửi báo cáo sự cố.'
        );
        router.replace(`/(driver)/trips/${tripId}/incident-detail?incidentId=${res.data?.incidentId}` as any);
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
    <ScrollView style={{ backgroundColor: colors.surface.page }} className="flex-1" contentContainerStyle={{ padding: 20, gap: 16 }}>
      <Text style={{ color: colors.text.secondary }} className="text-xs font-bold uppercase tracking-wider">Tạo Báo Cáo Sự Cố</Text>

      <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="gap-4 rounded-2xl border p-4 shadow-sm">
        <Text style={{ color: colors.text.primary }} className="font-bold">Loại sự cố</Text>
        <View className="flex-row flex-wrap gap-2">
          {INCIDENT_TYPES.map((t) => (
            <Pressable
              key={t.value}
              onPress={() => handleTypeChange(t.value)}
              style={{
                backgroundColor: type === t.value ? colors.surface.selected : colors.surface.card,
                borderColor: type === t.value ? colors.border.selected : colors.border.default,
              }}
              className="rounded-xl border px-3 py-2"
            >
              <Text style={{ color: type === t.value ? colors.text.brand : colors.text.secondary }} className={type === t.value ? 'font-bold' : 'font-medium'}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={{ color: colors.text.primary }} className="mt-2 font-bold">Mức độ</Text>
        <View className="flex-row flex-wrap gap-2">
          {SEVERITIES.map((s) => (
            <Pressable
              key={s.value}
              onPress={() => setSeverity(s.value)}
              style={{
                backgroundColor: severity === s.value ? colors.surface.selected : colors.surface.card,
                borderColor: severity === s.value ? colors.border.selected : colors.border.default,
              }}
              className="rounded-xl border px-3 py-2"
            >
              <Text style={{ color: severity === s.value ? colors.text.brand : colors.text.secondary }} className={severity === s.value ? 'font-bold' : 'font-medium'}>{s.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ backgroundColor: colors.surface.muted }} className="mt-2 flex-row items-center justify-between rounded-xl p-4">
          <View className="flex-1 pr-4">
            <Text style={{ color: colors.text.primary }} className="font-bold">Yêu cầu xe thay thế (Cứu hộ)</Text>
            <Text style={{ color: colors.text.secondary }} className="text-xs">Bật nếu xe không thể tiếp tục chạy</Text>
          </View>
          <Switch value={requiresRescue} onValueChange={setRequiresRescue} trackColor={{ true: colors.brand.primary }} />
        </View>

        <Text style={{ color: colors.text.primary }} className="mt-2 font-bold">Mô tả chi tiết *</Text>
        <TextInput
          style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default, color: colors.text.primary }}
          className="h-24 rounded-xl border p-3 font-medium"
          placeholder="Ví dụ: Xe hỏng lốp, tắc đường nghiêm trọng..."
          placeholderTextColor={colors.text.muted}
          multiline
          value={description}
          onChangeText={setDescription}
          editable={!submitting}
        />

        <Text style={{ color: colors.text.primary }} className="mt-2 font-bold">Chi phí đã ứng (nếu có)</Text>
        <TextInput
          style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default, color: colors.text.primary }}
          className="rounded-xl border p-3 font-medium"
          placeholder="Nhập số tiền VNĐ"
          placeholderTextColor={colors.text.muted}
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
          editable={!submitting}
        />

        <View className="mt-2 flex-row gap-3">
          <Pressable onPress={() => pickImage(setPhotoUri)} style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="flex-1 items-center justify-center rounded-xl border border-dashed py-4">
            <Ionicons name="camera-outline" size={24} color={colors.brand.primary} />
            <Text style={{ color: colors.text.secondary }} className="mt-1 text-xs">{photoUri ? 'Đã chọn ảnh sự cố' : 'Thêm ảnh sự cố'}</Text>
          </Pressable>
          <Pressable onPress={() => pickImage(setReceiptUri)} style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="flex-1 items-center justify-center rounded-xl border border-dashed py-4">
            <Ionicons name="receipt-outline" size={24} color={colors.brand.primary} />
            <Text style={{ color: colors.text.secondary }} className="mt-1 text-xs">{receiptUri ? 'Đã chọn hóa đơn' : 'Thêm hóa đơn'}</Text>
          </Pressable>
        </View>
      </View>

      <Pressable
        onPress={handleSubmit}
        disabled={submitting || locationLoading}
        style={{
          backgroundColor: submitting || locationLoading ? colors.surface.muted : colors.brand.primary,
        }}
        className="items-center justify-center rounded-xl p-4"
      >
        {submitting || locationLoading ? <ActivityIndicator color={colors.text.onPrimary} /> : <Text style={{ color: colors.text.onPrimary }} className="font-bold">Gửi Báo Cáo</Text>}
      </Pressable>

      <Pressable onPress={() => router.back()} disabled={submitting} className="items-center rounded-xl p-4">
        <Text style={{ color: colors.brand.primary }} className="font-bold">Quay lại</Text>
      </Pressable>
    </ScrollView>
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
