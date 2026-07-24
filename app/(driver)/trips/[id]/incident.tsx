import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';

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
    } catch (e) {
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
          const type = match ? `image/${match[1]}` : 'image/jpeg';
          formData.append('EvidenceFiles', { uri: photoUri, name: filename, type } as any);
        }
        if (receiptUri) {
          const filename = receiptUri.split('/').pop() || 'receipt.jpg';
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : 'image/jpeg';
          formData.append('ReceiptFiles', { uri: receiptUri, name: filename, type } as any);
        }

        const res = await createIncidentWithEvidence(token, formData);
        if (res.success) {
          Alert.alert('Thành công', 'Đã gửi báo cáo sự cố kèm hình ảnh.');
          router.replace(`/(driver)/trips/${tripId}/incident-detail?incidentId=${res.data?.incidentId}` as any);
        } else {
          Alert.alert('Lỗi', res.message || 'Không thể tạo sự cố.');
        }
      }
    } catch (e: any) {
      Alert.alert('Lỗi', e.message || 'Có lỗi xảy ra khi gọi API.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-[#F6F8F2]" contentContainerStyle={{ padding: 20, paddingBottom: 100, gap: 16 }}>
      <Text className="text-2xl font-bold text-amber-950">Báo cáo Sự cố</Text>
      <Text className="text-sm text-amber-700">Chuyến: {tripId?.slice(0, 8).toUpperCase()}</Text>

      <View className="gap-4 rounded-3xl bg-white p-5">
        <Text className="font-bold text-amber-950">Loại sự cố</Text>
        <View className="flex-row flex-wrap gap-2">
          {INCIDENT_TYPES.map((t) => (
            <Pressable key={t.value} onPress={() => setType(t.value)} className={`rounded-xl border px-3 py-2 ${type === t.value ? 'border-amber-600 bg-amber-100' : 'border-gray-200'}`}>
              <Text className={type === t.value ? 'font-bold text-amber-900' : 'text-gray-600'}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text className="font-bold text-amber-950 mt-2">Mức độ</Text>
        <View className="flex-row flex-wrap gap-2">
          {SEVERITIES.map((s) => (
            <Pressable key={s.value} onPress={() => setSeverity(s.value)} className={`rounded-xl border px-3 py-2 ${severity === s.value ? 'border-red-600 bg-red-100' : 'border-gray-200'}`}>
              <Text className={severity === s.value ? 'font-bold text-red-900' : 'text-gray-600'}>{s.label}</Text>
            </Pressable>
          ))}
        </View>

        <View className="mt-2 flex-row items-center justify-between rounded-xl bg-amber-50 p-4">
          <View className="flex-1 pr-4">
            <Text className="font-bold text-amber-950">Yêu cầu xe thay thế (Cứu hộ)</Text>
            <Text className="text-xs text-amber-700">Bật nếu xe không thể tiếp tục chạy</Text>
          </View>
          <Switch value={requiresRescue} onValueChange={setRequiresRescue} trackColor={{ true: '#8B4513' }} />
        </View>

        <Text className="font-bold text-amber-950 mt-2">Mô tả chi tiết *</Text>
        <TextInput
          className="h-24 rounded-xl border border-gray-200 bg-gray-50 p-3 text-amber-950"
          placeholder="Ví dụ: Xe hỏng lốp, tắc đường nghiêm trọng..."
          multiline
          value={description}
          onChangeText={setDescription}
          editable={!submitting}
        />

        <Text className="font-bold text-amber-950 mt-2">Chi phí đã ứng (nếu có)</Text>
        <TextInput
          className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-amber-950"
          placeholder="Nhập số tiền VNĐ"
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
          editable={!submitting}
        />

        <View className="mt-2 flex-row gap-3">
          <Pressable onPress={() => pickImage(setPhotoUri)} className="flex-1 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 py-4">
            <Ionicons name="camera-outline" size={24} color="#8B4513" />
            <Text className="mt-1 text-xs text-amber-700">{photoUri ? 'Đã chọn ảnh sự cố' : 'Thêm ảnh sự cố'}</Text>
          </Pressable>
          <Pressable onPress={() => pickImage(setReceiptUri)} className="flex-1 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 py-4">
            <Ionicons name="receipt-outline" size={24} color="#8B4513" />
            <Text className="mt-1 text-xs text-amber-700">{receiptUri ? 'Đã chọn hóa đơn' : 'Thêm hóa đơn'}</Text>
          </Pressable>
        </View>
      </View>

      <Pressable onPress={handleSubmit} disabled={submitting || locationLoading} className={`items-center justify-center rounded-xl p-4 ${submitting || locationLoading ? 'bg-amber-800/70' : 'bg-amber-800'}`}>
        {submitting || locationLoading ? <ActivityIndicator color="white" /> : <Text className="font-bold text-white">Gửi Báo Cáo</Text>}
      </Pressable>

      <Pressable onPress={() => router.back()} disabled={submitting} className="items-center rounded-xl p-4">
        <Text className="font-bold text-amber-800">Quay lại</Text>
      </Pressable>
    </ScrollView>
  );
}
