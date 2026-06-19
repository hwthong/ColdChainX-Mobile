import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';

import { GoodsType, GoodsTypeSelector } from '../../components/GoodsTypeSelector';
import { TemperatureSelector } from '../../components/TemperatureSelector';
import { ApiClientError, getApiErrorMessage } from '../../services/apiClient';
import { createOrder } from '../../services/orderApi';
import { getRouteOptions, RouteOptionResponse } from '../../services/routeApi';
import { useAuthStore } from '../../store/useAuthStore';

type FieldKey =
  | 'itemName'
  | 'category'
  | 'tempCondition'
  | 'expectedWeightKg'
  | 'quantity'
  | 'packagingType'
  | 'lengthCm'
  | 'widthCm'
  | 'heightCm'
  | 'destAddressText'
  | 'routeId'
  | 'documentImage';

type ValidationErrors = Partial<Record<FieldKey, string>>;

type DocumentImage = {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
};

type SuccessData = {
  orderId: string;
  trackingCode: string;
  status: string;
  documentUrl?: string | null;
};

const REQUIRED_ERROR = 'Vui lòng nhập thông tin này.';
export default function CreateOrderScreen() {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.token);

  const [category, setCategory] = useState<GoodsType>('FROZEN_FRUITS_VEGGIES');
  const [tempCondition, setTempCondition] = useState<number>(-6);
  const [destAddressText, setDestAddressText] = useState('');
  const [itemName, setItemName] = useState('');
  const [expectedWeightKg, setExpectedWeightKg] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [packagingType, setPackagingType] = useState('');
  const [lengthCm, setLengthCm] = useState('');
  const [widthCm, setWidthCm] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [documentImage, setDocumentImage] = useState<DocumentImage | null>(null);

  const [routeOptions, setRouteOptions] = useState<RouteOptionResponse[]>([]);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(true);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successData, setSuccessData] = useState<SuccessData | null>(null);
  const selectedRoute = routeOptions.find((route) => route.routeId === selectedRouteId) ?? null;
  const capacityWarning = getCapacityWarning(expectedWeightKg, lengthCm, widthCm, heightCm, quantity);

  const fetchRoutes = useCallback(async () => {
    setIsLoadingRoutes(true);
    setRouteError(null);

    try {
      const response = await getRouteOptions();
      if (response.success && response.data) {
        const activeRoutes = response.data.filter((route) => route.status?.toUpperCase() !== 'INACTIVE');
        setRouteOptions(activeRoutes);
        setSelectedRouteId((current) => current || (activeRoutes.length === 1 ? activeRoutes[0].routeId : ''));
      } else {
        setRouteError(response.message || 'Không thể tải danh sách tuyến vận chuyển.');
      }
    } catch (error) {
      setRouteError(getApiErrorMessage(error));
    } finally {
      setIsLoadingRoutes(false);
    }
  }, []);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  const validateForm = () => {
    const nextErrors: ValidationErrors = {};

    if (!itemName.trim()) nextErrors.itemName = REQUIRED_ERROR;
    if (!category) nextErrors.category = 'Vui lòng chọn phân loại hàng hóa.';
    if (!Number.isFinite(tempCondition)) nextErrors.tempCondition = 'Vui lòng chọn nhiệt độ yêu cầu.';
    if (!isPositiveNumber(expectedWeightKg)) nextErrors.expectedWeightKg = 'Khối lượng phải lớn hơn 0.';
    if (!isPositiveInteger(quantity)) nextErrors.quantity = 'Số lượng kiện phải từ 1 trở lên.';
    if (!packagingType.trim()) nextErrors.packagingType = REQUIRED_ERROR;
    if (!isPositiveNumber(lengthCm)) nextErrors.lengthCm = 'Chiều dài phải lớn hơn 0.';
    if (!isPositiveNumber(widthCm)) nextErrors.widthCm = 'Chiều rộng phải lớn hơn 0.';
    if (!isPositiveNumber(heightCm)) nextErrors.heightCm = 'Chiều cao phải lớn hơn 0.';
    if (destAddressText.trim().length < 5) {
      nextErrors.destAddressText = 'Địa chỉ giao hàng cần ít nhất 5 ký tự.';
    }
    if (!selectedRouteId) nextErrors.routeId = 'Vui lòng chọn tuyến vận chuyển.';
    if (!documentImage) nextErrors.documentImage = 'Vui lòng chọn ảnh lô hàng.';

    return nextErrors;
  };

  const handleSubmit = async () => {
    console.log('[CreateOrder] submit pressed');

    const nextErrors = validateForm();

    console.log('[CreateOrder] hasToken:', Boolean(accessToken));
    console.log('[CreateOrder] hasImage:', Boolean(documentImage));
    console.log('[CreateOrder] form values:', {
      itemName,
      category,
      tempCondition,
      expectedWeightKg,
      quantity,
      packagingType,
      lengthCm,
      widthCm,
      heightCm,
      destAddressText,
      routeId: selectedRouteId,
    });
    console.log('[CreateOrder] validation errors:', nextErrors);

    setErrors(nextErrors);
    setBackendError(null);

    if (Object.keys(nextErrors).length > 0) {
      setFormError('Vui lòng kiểm tra lại thông tin bắt buộc.');
      return;
    }

    if (!accessToken) {
      setFormError('Bạn cần đăng nhập lại trước khi tạo đơn.');
      return;
    }

    if (!documentImage) {
      setFormError('Vui lòng chọn ảnh lô hàng.');
      return;
    }

    setFormError(null);
    setIsLoading(true);

    try {
      const response = await createOrder(accessToken, {
        itemName: itemName.trim(),
        category,
        tempCondition,
        expectedWeightKg: parseDecimal(expectedWeightKg),
        quantity: parseInt(quantity, 10),
        packagingType: packagingType.trim(),
        lengthCm: parseDecimal(lengthCm),
        widthCm: parseDecimal(widthCm),
        heightCm: parseDecimal(heightCm),
        destAddressText: destAddressText.trim(),
        routeId: selectedRouteId,
        image: {
          uri: documentImage.uri,
          mimeType: documentImage.mimeType || 'image/jpeg',
          fileName: documentImage.fileName || 'cargo.jpg',
        },
      });

      if (!response.success) {
        throw new Error(response.message || 'Tạo đơn thất bại.');
      }

      setSuccessData({
        trackingCode: response.data?.trackingCode || '',
        orderId: response.data?.orderId || '',
        status: response.data?.status || 'PENDING_REVIEW',
        documentUrl: response.data?.documentUrl,
      });
    } catch (error) {
      let errorMessage = 'Không thể tạo đơn lúc này. Vui lòng thử lại sau.';

      if (error instanceof ApiClientError) {
        if (error.status === 401) {
          errorMessage = 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.';
        } else if (error.status === 400) {
          errorMessage = error.message;
          if (errorMessage.toLowerCase().includes('goong')) {
            errorMessage =
              'Không thể xác thực địa chỉ giao hàng. Vui lòng nhập địa chỉ rõ hơn hoặc thử lại sau.';
          }
        } else {
          errorMessage = getApiErrorMessage(error);
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      setBackendError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const openImagePicker = () => {
    Alert.alert('Ảnh lô hàng', 'Chọn nguồn ảnh kiện hàng', [
      { text: 'Chụp ảnh', onPress: captureImage },
      { text: 'Chọn từ thư viện', onPress: selectImageFromLibrary },
      { text: 'Hủy', style: 'cancel' },
    ]);
  };

  const selectImageFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setBackendError('Vui lòng cấp quyền truy cập thư viện ảnh để tải ảnh kiện hàng.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    handleImageResult(result);
  };

  const captureImage = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setBackendError('Vui lòng cấp quyền camera để chụp ảnh kiện hàng.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    handleImageResult(result);
  };

  const handleImageResult = (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled) return;

    const asset = result.assets[0];
    if (!asset || asset.type === 'video') {
      setErrors((current) => ({
        ...current,
        documentImage: 'Vui lòng chọn ảnh lô hàng, không chọn video.',
      }));
      setFormError('Vui lòng kiểm tra lại thông tin bắt buộc.');
      return;
    }

    setDocumentImage({
      uri: asset.uri,
      mimeType: asset.mimeType || 'image/jpeg',
      fileName: asset.fileName || 'cargo.jpg',
    });
    setErrors((current) => ({ ...current, documentImage: undefined }));
    setFormError(null);
    setBackendError(null);
  };

  const resetForm = () => {
    setCategory('FROZEN_FRUITS_VEGGIES');
    setTempCondition(-6);
    setDestAddressText('');
    setItemName('');
    setExpectedWeightKg('');
    setQuantity('1');
    setPackagingType('');
    setLengthCm('');
    setWidthCm('');
    setHeightCm('');
    setSelectedRouteId('');
    setDocumentImage(null);
    setErrors({});
    setFormError(null);
    setBackendError(null);
    setSuccessData(null);
  };

  const renderField = (
    field: FieldKey,
    label: string,
    placeholder: string,
    value: string,
    onChangeText: (text: string) => void,
    keyboardType: 'default' | 'numeric' = 'default'
  ) => (
    <View className="gap-1.5">
      <Text className="text-[#3A1F04] text-[13px] font-bold">{label}</Text>
      <TextInput
        className={[
          'min-h-[52px] rounded-[14px] border bg-[#F8F9FA] px-4 text-[14px] font-medium text-[#3A1F04]',
          errors[field] ? 'border-red-300' : 'border-[#DAC2B6]/60',
        ].join(' ')}
        placeholder={placeholder}
        placeholderTextColor="#877369"
        value={value}
        onChangeText={(text) => {
          onChangeText(text);
          if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
        }}
        keyboardType={keyboardType}
      />
      {errors[field] ? <Text className="text-xs font-medium text-red-600">{errors[field]}</Text> : null}
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-[#F5F2F0]"
    >
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingBottom: 128, gap: 18 }}
      >
        {(formError || backendError) && (
          <View className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <View className="flex-row items-start gap-2">
              <Ionicons name="alert-circle-outline" size={20} color="#dc2626" />
              <Text className="flex-1 text-sm font-semibold leading-5 text-red-700">
                {formError || backendError}
              </Text>
            </View>
          </View>
        )}

        <View className="rounded-2xl border border-[#DAC2B6]/50 bg-white p-5 shadow-sm gap-4">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-[#8B4513] text-base font-bold">Tuyến giao dự kiến</Text>
              <Text className="text-[#877369] text-xs font-medium mt-1">
                Hệ thống sẽ xác thực địa chỉ và tọa độ sau khi gửi yêu cầu.
              </Text>
            </View>
            <View className="h-10 w-10 items-center justify-center rounded-full bg-[#8B4513]/10">
              <Ionicons name="map-outline" size={20} color="#8B4513" />
            </View>
          </View>

          <View className="gap-3">
            <RouteRow
              icon="cube-outline"
              color="#8B4513"
              label="Điểm lấy hàng / Hub tiếp nhận"
              value="Hub ColdChainX sẽ được xác nhận sau khi yêu cầu được duyệt"
            />
            <View className="h-6 w-px bg-[#DAC2B6] ml-5" />
            <RouteRow
              icon="git-branch-outline"
              color="#8B4513"
              label="Tuyến vận chuyển"
              value={selectedRoute ? getRouteLabel(selectedRoute) : 'Chưa chọn tuyến vận chuyển'}
            />
            <View className="h-6 w-px bg-[#DAC2B6] ml-5" />
            <RouteRow
              icon="location-sharp"
              color="#006E0A"
              label="Địa chỉ giao hàng"
              value={destAddressText.trim() || 'Chưa nhập địa chỉ giao hàng'}
            />
          </View>
        </View>

        <View className="rounded-2xl border border-[#DAC2B6]/50 bg-white p-5 shadow-sm gap-4">
          <SectionTitle title="Giao hàng" icon="navigate-outline" />

          <View className="rounded-[14px] border border-[#DAC2B6]/60 bg-[#F8F9FA] p-4">
            <Text className="text-[#3A1F04] text-[13px] font-bold">
              Điểm lấy hàng / Hub tiếp nhận
            </Text>
            <Text className="mt-2 text-sm leading-5 text-[#877369]">
              Hub ColdChainX sẽ được xác nhận sau khi yêu cầu được duyệt
            </Text>
          </View>

          <RouteOptionPicker
            routes={routeOptions}
            selectedRouteId={selectedRouteId}
            isLoading={isLoadingRoutes}
            error={routeError}
            onRetry={fetchRoutes}
            onSelect={(routeId) => {
              setSelectedRouteId(routeId);
              setErrors((current) => ({ ...current, routeId: undefined }));
            }}
          />
          {errors.routeId ? <Text className="text-xs font-medium text-red-600">{errors.routeId}</Text> : null}

          {renderField(
            'destAddressText',
            'Địa chỉ giao hàng',
            'Ví dụ: 201B Nguyễn Chí Thanh, Quận 5, TP.HCM',
            destAddressText,
            setDestAddressText
          )}
        </View>

        <View className="rounded-2xl border border-[#DAC2B6]/50 bg-white p-5 shadow-sm gap-4">
          <SectionTitle title="Thông tin hàng hóa" icon="cube-outline" />

          {renderField(
            'itemName',
            'Tên hàng hóa',
            'Ví dụ: Nho Mỹ, Vaccine Pfizer, Cá hồi...',
            itemName,
            setItemName
          )}

          <View className="flex-row gap-3">
            <View className="flex-1">
              {renderField(
                'expectedWeightKg',
                'Khối lượng dự kiến KG',
                'Ví dụ: 12.5',
                expectedWeightKg,
                setExpectedWeightKg,
                'numeric'
              )}
            </View>
            <View className="w-[118px]">
              {renderField('quantity', 'Số lượng kiện', '1', quantity, setQuantity, 'numeric')}
            </View>
          </View>

          {renderField(
            'packagingType',
            'Quy cách đóng gói',
            'Ví dụ: Thùng carton, Bao, Khay xốp...',
            packagingType,
            setPackagingType
          )}

          <View className="gap-2">
            <Text className="text-[#3A1F04] text-[13px] font-bold">Kích thước kiện hàng</Text>
            <View className="flex-row gap-2">
              <View className="flex-1">
                {renderField('lengthCm', 'Dài cm', 'Dài', lengthCm, setLengthCm, 'numeric')}
              </View>
              <View className="flex-1">
                {renderField('widthCm', 'Rộng cm', 'Rộng', widthCm, setWidthCm, 'numeric')}
              </View>
              <View className="flex-1">
                {renderField('heightCm', 'Cao cm', 'Cao', heightCm, setHeightCm, 'numeric')}
              </View>
            </View>
          </View>

          {capacityWarning ? (
            <View className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <View className="flex-row items-start gap-2">
                <Ionicons name="warning-outline" size={18} color="#b45309" />
                <Text className="flex-1 text-sm font-semibold leading-5 text-amber-800">
                  {capacityWarning}
                </Text>
              </View>
            </View>
          ) : null}

          <View className="gap-2">
            <Text className="text-[#3A1F04] text-[13px] font-bold">Ảnh lô hàng</Text>
            <Pressable
              onPress={openImagePicker}
              className={[
                'min-h-[148px] w-full overflow-hidden rounded-[14px] border-2 border-dashed bg-[#F8F9FA]',
                errors.documentImage ? 'border-red-300' : 'border-[#DAC2B6]/70',
              ].join(' ')}
            >
              {documentImage ? (
                <View>
                  <Image source={{ uri: documentImage.uri }} className="h-36 w-full" resizeMode="cover" />
                  <View className="flex-row items-center gap-2 px-4 py-3">
                    <Ionicons name="checkmark-circle" size={18} color="#006E0A" />
                    <Text className="text-[#006E0A] text-sm font-bold">Đã chọn ảnh lô hàng</Text>
                  </View>
                </View>
              ) : (
                <View className="min-h-[148px] items-center justify-center px-5">
                  <View className="h-12 w-12 items-center justify-center rounded-full bg-[#8B4513]/10">
                    <Ionicons name="camera-outline" size={26} color="#8B4513" />
                  </View>
                  <Text className="mt-3 text-center text-sm font-bold text-[#3A1F04]">
                    Chụp hoặc tải ảnh kiện hàng
                  </Text>
                  <Text className="mt-1 text-center text-xs leading-5 text-[#877369]">
                    Chỉ chọn ảnh, không chọn video.
                  </Text>
                </View>
              )}
            </Pressable>
            {errors.documentImage ? (
              <Text className="text-xs font-medium text-red-600">{errors.documentImage}</Text>
            ) : null}
          </View>
        </View>

        <GoodsTypeSelector value={category} onChange={setCategory} />
        {errors.category ? <Text className="-mt-3 text-xs font-medium text-red-600">{errors.category}</Text> : null}

        <TemperatureSelector temperature={tempCondition} setTemperature={setTempCondition} />

        <Text className="pb-4 text-center text-[10px] font-medium uppercase tracking-widest text-[#877369]">
          ColdChainX - Giữ trọn tinh hoa di sản
        </Text>
      </ScrollView>

      <View className="absolute bottom-0 inset-x-0 z-30 justify-end bg-[#F5F2F0]/95 px-5 pb-8 pt-4">
        <Pressable
          onPress={handleSubmit}
          disabled={isLoading}
          className={[
            'h-14 w-full flex-row items-center justify-center gap-2 rounded-[16px] bg-[#8B4513] shadow-md active:opacity-80',
            isLoading ? 'opacity-70' : '',
          ].join(' ')}
        >
          {isLoading ? <ActivityIndicator color="#FFC29F" /> : null}
          <Text className="text-[17px] font-bold tracking-wide text-[#FFC29F]">
            {isLoading ? 'ĐANG GỬI YÊU CẦU...' : 'LÊN ĐƠN GIAO HÀNG'}
          </Text>
        </Pressable>
      </View>

      <Modal visible={!!successData} transparent animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/60 px-5">
          <View className="w-full rounded-3xl bg-white p-6 shadow-lg">
            <View className="items-center">
              <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-[#E8F5E9]">
                <Ionicons name="checkmark-circle" size={42} color="#4CAF50" />
              </View>
              <Text className="text-center text-[20px] font-bold text-[#3A1F04]">
                Gửi yêu cầu thành công
              </Text>
              <Text className="mt-2 text-center text-[14px] leading-6 text-[#877369]">
                Bộ phận Sales sẽ kiểm duyệt yêu cầu và gửi báo giá cho bạn.
              </Text>
            </View>

            <View className="my-6 gap-3 rounded-2xl border border-[#DAC2B6]/40 bg-[#F8F9FA] p-4">
              <InfoRow label="Mã yêu cầu" value={successData?.trackingCode || 'Đang cập nhật'} />
              <InfoRow label="Trạng thái" value={translateStatus(successData?.status || 'PENDING_REVIEW')} />
            </View>

            <View className="gap-3">
              <Pressable
                onPress={() => {
                  const createdOrderId = successData?.orderId;
                  setSuccessData(null);
                  if (createdOrderId) {
                    router.replace(`/(customer)/orders/${createdOrderId}` as never);
                  } else {
                    router.replace('/(customer)/status');
                  }
                }}
                className="h-12 w-full items-center justify-center rounded-xl bg-[#8B4513]"
              >
                <Text className="text-[15px] font-bold text-white">
                  {successData?.orderId ? 'Xem chi tiết đơn' : 'Xem trạng thái đơn'}
                </Text>
              </Pressable>
              <Pressable
                onPress={resetForm}
                className="h-12 w-full items-center justify-center rounded-xl border border-[#8B4513] bg-white"
              >
                <Text className="text-[15px] font-bold text-[#8B4513]">Tạo đơn khác</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function SectionTitle({ title, icon }: { title: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View className="flex-row items-center gap-2 border-b border-[#DAC2B6]/30 pb-3">
      <Ionicons name={icon} size={18} color="#8B4513" />
      <Text className="text-[#8B4513] text-base font-bold">{title}</Text>
    </View>
  );
}

function RouteOptionPicker({
  routes,
  selectedRouteId,
  isLoading,
  error,
  onRetry,
  onSelect,
}: {
  routes: RouteOptionResponse[];
  selectedRouteId: string;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelect: (routeId: string) => void;
}) {
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-[#3A1F04] text-[13px] font-bold">Tuyến vận chuyển</Text>
        {isLoading ? <ActivityIndicator size="small" color="#8B4513" /> : null}
      </View>

      {error ? (
        <View className="rounded-[14px] border border-red-200 bg-red-50 p-4">
          <Text className="text-sm font-semibold leading-5 text-red-700">{error}</Text>
          <Pressable onPress={onRetry} className="mt-3 self-start rounded-lg bg-[#8B4513] px-3 py-2">
            <Text className="text-xs font-bold text-white">Tải lại tuyến</Text>
          </Pressable>
        </View>
      ) : null}

      {!isLoading && !error && routes.length === 0 ? (
        <View className="rounded-[14px] border border-[#DAC2B6]/60 bg-[#F8F9FA] p-4">
          <Text className="text-sm leading-5 text-[#877369]">
            Chưa có tuyến vận chuyển khả dụng. Vui lòng thử lại sau.
          </Text>
        </View>
      ) : null}

      <View className="gap-3">
        {routes.map((route) => {
          const isSelected = selectedRouteId === route.routeId;

          return (
            <Pressable
              key={route.routeId}
              onPress={() => onSelect(route.routeId)}
              className={[
                'rounded-[14px] border p-4',
                isSelected ? 'border-[#8B4513] bg-[#8B4513]' : 'border-[#DAC2B6]/60 bg-[#F8F9FA]',
              ].join(' ')}
            >
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text className={['text-sm font-bold', isSelected ? 'text-white' : 'text-[#3A1F04]'].join(' ')}>
                    {getRouteLabel(route)}
                  </Text>
                  <Text className={['mt-1 text-xs', isSelected ? 'text-white/75' : 'text-[#877369]'].join(' ')}>
                    {getRouteMeta(route)}
                  </Text>
                </View>
                {isSelected ? <Ionicons name="checkmark-circle" size={20} color="#FFC29F" /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function RouteRow({
  icon,
  color,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-row items-start gap-3">
      <View className="h-10 w-10 items-center justify-center rounded-full bg-[#F8F9FA]">
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View className="flex-1">
        <Text className="text-xs font-bold uppercase tracking-wide text-[#877369]">{label}</Text>
        <Text className="mt-1 text-sm font-semibold leading-5 text-[#3A1F04]">{value}</Text>
      </View>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-4">
      <Text className="text-[13px] text-[#877369]">{label}</Text>
      <Text className="flex-1 text-right text-[13px] font-bold text-[#8B4513]">{value}</Text>
    </View>
  );
}

function parseDecimal(value: string) {
  return Number(value.trim().replace(',', '.'));
}

function getCapacityWarning(weightValue: string, lengthValue: string, widthValue: string, heightValue: string, quantityValue: string) {
  const weightKg = parseDecimal(weightValue);
  const lengthCm = parseDecimal(lengthValue);
  const widthCm = parseDecimal(widthValue);
  const heightCm = parseDecimal(heightValue);
  const quantity = Number(quantityValue.trim());

  if (Number.isFinite(weightKg) && weightKg > 1500) {
    return 'Khối lượng dự kiến đã vượt khoảng 1.5 tấn. Backend sẽ kiểm tra năng lực tuyến và có thể yêu cầu điều chỉnh đơn.';
  }

  if (Number.isFinite(weightKg) && weightKg >= 1000) {
    return 'Khối lượng dự kiến đang gần ngưỡng 1-1.5 tấn. Vui lòng kiểm tra lại trước khi gửi yêu cầu.';
  }

  if (
    Number.isFinite(lengthCm) &&
    Number.isFinite(widthCm) &&
    Number.isFinite(heightCm) &&
    Number.isFinite(quantity)
  ) {
    const estimatedCbm = (lengthCm * widthCm * heightCm * quantity) / 1_000_000;
    if (estimatedCbm >= 8) {
      return 'Kích thước quy đổi đang khá lớn. Backend sẽ xác nhận CBM và năng lực tuyến ở bước kiểm duyệt.';
    }
  }

  return null;
}

function getRouteLabel(route: RouteOptionResponse) {
  return `${route.routeCode} - ${route.originCity} -> ${route.destCity}`;
}

function getRouteMeta(route: RouteOptionResponse) {
  return `ETA ${route.transitTime} | Cut-off ${formatCutOffTime(route.cutOffTime)}`;
}

function formatCutOffTime(value: string) {
  return value?.slice(0, 5) || 'Chưa cập nhật';
}

function isPositiveNumber(value: string) {
  const parsed = parseDecimal(value);
  return Number.isFinite(parsed) && parsed > 0;
}

function isPositiveInteger(value: string) {
  const parsed = Number(value.trim());
  return Number.isInteger(parsed) && parsed >= 1;
}

function translateStatus(status: string) {
  switch (status.toUpperCase()) {
    case 'PENDING':
    case 'PENDING_REVIEW':
      return 'Chờ duyệt';
    case 'APPROVED':
      return 'Đã duyệt';
    case 'IN_TRANSIT':
      return 'Đang giao';
    case 'DELIVERED':
      return 'Đã giao';
    case 'CANCELLED':
      return 'Đã hủy';
    default:
      return status;
  }
}
