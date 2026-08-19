import * as ImagePicker from 'expo-image-picker';
import React, { useMemo, useState } from 'react';
import { Alert, Image, Switch, Text, View } from 'react-native';

import { AppButton } from '../AppButton';
import { AppInput } from '../AppInput';

export type PartialHandoverSubmission = {
  rejectedQuantity: number;
  rejectionReason: string;
  isReturnToWarehouse: boolean;
  evidenceAsset: ImagePicker.ImagePickerAsset;
};

type PartialHandoverPanelProps = {
  trackingCode: string;
  lpnCodes: string;
  originalQuantity: number;
  processing: boolean;
  onSubmit: (submission: PartialHandoverSubmission) => void;
  onUseFullReject: (submission: Omit<PartialHandoverSubmission, 'evidenceAsset'> & {
    evidenceAsset: ImagePicker.ImagePickerAsset | null;
  }) => void;
  onBack: () => void;
};

export function PartialHandoverPanel({
  trackingCode,
  lpnCodes,
  originalQuantity,
  processing,
  onSubmit,
  onUseFullReject,
  onBack,
}: PartialHandoverPanelProps) {
  const [rejectedQuantityText, setRejectedQuantityText] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [evidenceAsset, setEvidenceAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [isReturnToWarehouse, setIsReturnToWarehouse] = useState(true);

  const rejectedQuantity = Number(rejectedQuantityText || 0);
  const acceptedQuantity = useMemo(
    () => Math.max(0, originalQuantity - (Number.isFinite(rejectedQuantity) ? rejectedQuantity : 0)),
    [originalQuantity, rejectedQuantity]
  );

  const chooseEvidenceSource = () => {
    Alert.alert('Ảnh minh chứng', 'Chụp ảnh mới hoặc chọn ảnh có sẵn trên thiết bị.', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Chụp ảnh', onPress: () => void captureEvidence() },
      { text: 'Chọn ảnh', onPress: () => void pickEvidence() },
    ]);
  };

  const captureEvidence = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Chưa có quyền camera', 'Vui lòng cấp quyền camera để chụp ảnh minh chứng.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) setEvidenceAsset(result.assets[0]);
  };

  const pickEvidence = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Chưa có quyền ảnh', 'Vui lòng cấp quyền thư viện ảnh để chọn ảnh minh chứng.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) setEvidenceAsset(result.assets[0]);
  };

  const submit = () => {
    if (!Number.isInteger(originalQuantity) || originalQuantity <= 0) {
      Alert.alert('Thiếu dữ liệu số lượng', 'Không xác định được số lượng ban đầu của LPN. Vui lòng tải lại điểm dừng.');
      return;
    }
    if (!/^\d+$/.test(rejectedQuantityText) || rejectedQuantity <= 0) {
      Alert.alert('Số lượng chưa hợp lệ', 'Số lượng khách từ chối phải lớn hơn 0.');
      return;
    }
    if (rejectedQuantity === originalQuantity) {
      Alert.alert(
        'Khách từ chối toàn bộ',
        'Khách từ chối toàn bộ lô hàng. Vui lòng sử dụng chức năng Từ chối toàn bộ.',
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Mở Từ chối toàn bộ',
            onPress: () => onUseFullReject({
              rejectedQuantity,
              rejectionReason: rejectionReason.trim(),
              isReturnToWarehouse,
              evidenceAsset,
            }),
          },
        ]
      );
      return;
    }
    if (rejectedQuantity > originalQuantity) {
      Alert.alert('Số lượng chưa hợp lệ', 'Số lượng khách từ chối không được lớn hơn số lượng ban đầu.');
      return;
    }
    if (!rejectionReason.trim()) {
      Alert.alert('Thiếu lý do', 'Vui lòng nhập lý do từ chối để lưu vết kiểm toán.');
      return;
    }
    if (!evidenceAsset) {
      Alert.alert('Thiếu ảnh minh chứng', 'Vui lòng chụp hoặc chọn ảnh minh chứng.');
      return;
    }

    onSubmit({
      rejectedQuantity,
      rejectionReason: rejectionReason.trim(),
      isReturnToWarehouse,
      evidenceAsset,
    });
  };

  return (
    <View>
      <Text className="text-lg font-bold text-amber-950">Bàn giao một phần</Text>
      <Text className="mb-4 mt-1 text-sm text-amber-700">
        Đơn {trackingCode} · {lpnCodes || 'LPN của đơn'}
      </Text>

      <View className="rounded-2xl border border-amber-200 bg-white p-4">
        <Text className="text-sm font-semibold text-amber-700">Số lượng ban đầu</Text>
        <Text className="mt-1 text-2xl font-bold text-amber-950">{originalQuantity} kiện</Text>

        <View className="mt-4">
          <AppInput
            label="Số lượng khách từ chối"
            value={rejectedQuantityText}
            onChangeText={(value) => setRejectedQuantityText(value.replace(/[^0-9]/g, ''))}
            placeholder="Ví dụ: 3"
            keyboardType="number-pad"
          />
        </View>

        <View className="mt-3 rounded-xl bg-green-50 p-3">
          <Text className="text-sm text-green-800">Số lượng khách nhận</Text>
          <Text className="mt-1 text-xl font-bold text-green-950">{acceptedQuantity} kiện</Text>
        </View>

        <View className="mt-4">
          <AppInput
            label="Lý do từ chối"
            value={rejectionReason}
            onChangeText={setRejectionReason}
            placeholder="Ví dụ: 3 thùng bị móp"
            multiline
          />
        </View>

        <View className="mt-4">
          <Text className="mb-2 text-xs font-bold text-amber-700">Ảnh minh chứng</Text>
          {evidenceAsset ? (
            <Image
              source={{ uri: evidenceAsset.uri }}
              className="mb-3 h-48 w-full rounded-xl bg-amber-50"
              resizeMode="contain"
            />
          ) : (
            <View className="mb-3 h-32 items-center justify-center rounded-xl bg-amber-50 px-5">
              <Text className="text-center text-sm text-amber-800">Chưa có ảnh minh chứng</Text>
            </View>
          )}
          <AppButton
            label={evidenceAsset ? 'Chụp ảnh / Chọn ảnh khác' : 'Chụp ảnh / Chọn ảnh'}
            variant="secondary"
            disabled={processing}
            onPress={chooseEvidenceSource}
          />
        </View>

        <View className="mt-4 flex-row items-center justify-between rounded-xl bg-amber-50 p-3">
          <View className="mr-4 flex-1">
            <Text className="font-bold text-amber-950">Mang hàng bị từ chối về kho</Text>
            <Text className="mt-1 text-xs text-amber-700">Backend sẽ lập phiếu hậu cần ngược cho phần hàng bị từ chối.</Text>
          </View>
          <Switch
            value={isReturnToWarehouse}
            onValueChange={setIsReturnToWarehouse}
            disabled={processing}
          />
        </View>

        <View className="mt-5">
          <AppButton
            label="Xác nhận bàn giao một phần"
            loading={processing}
            disabled={processing}
            onPress={submit}
          />
        </View>
      </View>

      <View className="mt-4">
        <AppButton label="Quay lại" variant="secondary" onPress={onBack} disabled={processing} />
      </View>
    </View>
  );
}
