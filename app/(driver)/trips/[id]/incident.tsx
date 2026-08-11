import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';

import { colors } from '../../../../constants/colors';
import { createIncident, createIncidentWithEvidence, IncidentSeverity, IncidentType } from '../../../../services/incidentApi';
import { useAuthStore } from '../../../../store/useAuthStore';

const INCIDENT_TYPES: { label: string; value: IncidentType }[] = [
  { label: 'Hỏng xe', value: 'VEHICLE_BREAKDOWN' },
  { label: 'Hỏng hàng hóa', value: 'CARGO_DAMAGE' },
  { label: 'Biến động nhiệt độ', value: 'TEMPERATURE_FLUCTUATION' },
  { label: 'Tai nạn', value: 'ACCIDENT' },
  { label: 'Khác', value: 'OTHER' },
];

const SEVERITIES: { label: string; value: IncidentSeverity }[] = [
  { label: 'Thấp', value: 'LOW' },
  { label: 'Trung bình', value: 'MEDIUM' },
  { label: 'Cao', value: 'HIGH' },
  { label: 'Nghiêm trọng', value: 'CRITICAL' },
];

export default function DriverTripIncidentScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const tripId = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const token = useAuthStore((state) => state.token);

  const [type, setType] = useState<IncidentType>('VEHICLE_BREAKDOWN');
  const [severity, setSeverity] = useState<IncidentSeverity>('MEDIUM');
  const [requiresRescue, setRequiresRescue] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [receiptUri, setReceiptUri] = useState<string | null>(null);

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

  const getLocation = async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Lỗi', 'Vui lòng cấp quyền vị trí để gửi báo cáo chính xác.');
        return null;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    } catch {
      Alert.alert('Lỗi', 'Không thể lấy vị trí hiện tại. Bạn có thể thử lại.');
      return null;
    } finally {
      setLocationLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!token || !tripId) return;
    if (!description.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập mô tả sự cố.');
      return;
    }

    setSubmitting(true);
    const coords = await getLocation();

    try {
      if (!photoUri && !receiptUri) {
        const payload = {
          tripId,
          incidentType: type,
          severity,
          description: description.trim(),
          requiresRescue,
          driverPaidAmount: amount ? parseFloat(amount) : undefined,
          currentLatitude: coords?.latitude,
          currentLongitude: coords?.longitude,
        };
        const res = await createIncident(token, payload);
        if (res.success) {
          Alert.alert('Thành công', 'Đã gửi báo cáo sự cố.');
          router.replace(`/(driver)/trips/${tripId}/incident-detail?incidentId=${res.data?.incidentId}` as any);
        } else {
          Alert.alert('Lỗi', res.message || 'Không thể tạo sự cố.');
        }
      } else {
        const formData = new FormData();
        formData.append('TripId', tripId);
        formData.append('IncidentType', type);
        formData.append('Severity', severity);
        formData.append('Description', description.trim());
        formData.append('RequiresRescue', String(requiresRescue));
        if (amount) formData.append('DriverPaidAmount', amount);
        if (coords?.latitude) formData.append('CurrentLatitude', String(coords.latitude));
        if (coords?.longitude) formData.append('CurrentLongitude', String(coords.longitude));

        if (photoUri) {
          const filename = photoUri.split('/').pop() || 'photo.jpg';
          const match = /\.(\w+)$/.exec(filename);
          const fileType = match ? `image/${match[1]}` : 'image/jpeg';
          formData.append('EvidenceFiles', { uri: photoUri, name: filename, type: fileType } as any);
        }
        if (receiptUri) {
          const filename = receiptUri.split('/').pop() || 'receipt.jpg';
          const match = /\.(\w+)$/.exec(filename);
          const fileType = match ? `image/${match[1]}` : 'image/jpeg';
          formData.append('ReceiptFiles', { uri: receiptUri, name: filename, type: fileType } as any);
        }

        const res = await createIncidentWithEvidence(token, formData);
        if (res.success) {
          Alert.alert('Thành công', 'Đã gửi báo cáo sự cố kèm hình ảnh.');
          router.replace(`/(driver)/trips/${tripId}/incident-detail?incidentId=${res.data?.incidentId}` as any);
        } else {
          Alert.alert('Lỗi', res.message || 'Không thể tạo sự cố.');
        }
      }
    } catch (err: any) {
      Alert.alert('Thất bại', err.message || 'Không thể tạo báo cáo sự cố.');
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
              onPress={() => setType(t.value)}
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
