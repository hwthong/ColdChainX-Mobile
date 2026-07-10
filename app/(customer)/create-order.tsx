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

import { AppToast, ToastType } from '../../components/AppToast';
import { GoodsType, GoodsTypeSelector } from '../../components/GoodsTypeSelector';
import { PackagingTypeSelector } from '../../components/PackagingTypeSelector';
import { TemperatureSelector } from '../../components/TemperatureSelector';
import { ApiClientError, getApiErrorMessage } from '../../services/apiClient';
import { createOrder } from '../../services/orderApi';
import {
  getRouteBookingOptions,
  getRouteOptions,
  RouteBookingOptionsDto,
  RouteOptionResponse,
  ScheduleOptionDto,
  StopOptionDto,
} from '../../services/routeApi';
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
  | 'scheduleId'
  | 'dropoffStopId'
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
const PACKAGING_TYPE_ERROR =
  'Loại bao bì không hợp lệ. Vui lòng chọn một trong các loại bao bì được hỗ trợ.';

export default function CreateOrderScreen() {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.token);

  // — Goods info —
  const [category, setCategory] = useState<GoodsType>('FROZEN_FRUITS_VEGGIES');
  const [tempCondition, setTempCondition] = useState<number>(-6);
  const [itemName, setItemName] = useState('');
  const [expectedWeightKg, setExpectedWeightKg] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [packagingType, setPackagingType] = useState<string[]>([]);
  const [lengthCm, setLengthCm] = useState('');
  const [widthCm, setWidthCm] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [documentImage, setDocumentImage] = useState<DocumentImage | null>(null);

  // — Delivery routing —
  const [destAddressText, setDestAddressText] = useState('');
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [selectedStopId, setSelectedStopId] = useState('');

  // — Route options (list of routes) —
  const [routeOptions, setRouteOptions] = useState<RouteOptionResponse[]>([]);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(true);
  const [routeError, setRouteError] = useState<string | null>(null);

  // — Booking options (schedules + stops for selected route) —
  const [bookingOptions, setBookingOptions] = useState<RouteBookingOptionsDto | null>(null);
  const [isLoadingBooking, setIsLoadingBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // — UI state —
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [toastVisible, setToastVisible] = useState(false);
  const [toastConfig, setToastConfig] = useState<{ type: ToastType; title?: string; message: string }>({
    type: 'info',
    message: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [successData, setSuccessData] = useState<SuccessData | null>(null);

  const selectedRoute = routeOptions.find((r) => r.routeId === selectedRouteId) ?? null;
  const selectedSchedule = bookingOptions?.availableSchedules.find((s) => s.scheduleId === selectedScheduleId) ?? null;
  const selectedStop = bookingOptions?.availableStops.find((s) => s.stopId === selectedStopId) ?? null;
  const capacityWarning = getCapacityWarning(expectedWeightKg, lengthCm, widthCm, heightCm, quantity);

  // ─── Fetch route list ────────────────────────────────────────────────────────
  const fetchRoutes = useCallback(async () => {
    setIsLoadingRoutes(true);
    setRouteError(null);
    try {
      const response = await getRouteOptions();
      if (response.success && response.data) {
        const activeRoutes = response.data.filter((r) => r.status?.toUpperCase() !== 'INACTIVE');
        setRouteOptions(activeRoutes);
        // Auto-select if only 1 route
        if (activeRoutes.length === 1) {
          setSelectedRouteId(activeRoutes[0].routeId);
        }
      } else {
        setRouteError(response.message || 'Không thể tải danh sách tuyến vận chuyển.');
      }
    } catch (error) {
      setRouteError(getApiErrorMessage(error));
    } finally {
      setIsLoadingRoutes(false);
    }
  }, []);

  // ─── Fetch booking options (schedules + stops) when route changes ────────────
  const fetchBookingOptions = useCallback(async (routeId: string) => {
    setIsLoadingBooking(true);
    setBookingError(null);
    setBookingOptions(null);
    setSelectedScheduleId('');
    setSelectedStopId('');
    try {
      const response = await getRouteBookingOptions(routeId);
      if (response.success && response.data) {
        setBookingOptions(response.data);
        // Auto-select schedule and stop if each has exactly 1 option
        if (response.data.availableSchedules.length === 1) {
          setSelectedScheduleId(response.data.availableSchedules[0].scheduleId);
        }
        if (response.data.availableStops.length === 1) {
          setSelectedStopId(response.data.availableStops[0].stopId);
        }
      } else {
        setBookingError(response.message || 'Không thể tải lịch và điểm giao cho tuyến này.');
      }
    } catch (error) {
      setBookingError(getApiErrorMessage(error));
    } finally {
      setIsLoadingBooking(false);
    }
  }, []);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  useEffect(() => {
    if (selectedRouteId) {
      fetchBookingOptions(selectedRouteId);
    }
  }, [selectedRouteId, fetchBookingOptions]);

  const showToast = (type: ToastType, message: string, title?: string) => {
    setToastConfig({ type, message, title });
    setToastVisible(true);
  };

  // ─── Validation ─────────────────────────────────────────────────────────────
  const validateForm = (): ValidationErrors => {
    const nextErrors: ValidationErrors = {};
    if (!itemName.trim()) nextErrors.itemName = REQUIRED_ERROR;
    if (!category) nextErrors.category = 'Vui lòng chọn phân loại hàng hóa.';
    if (!Number.isFinite(tempCondition)) nextErrors.tempCondition = 'Vui lòng chọn nhiệt độ yêu cầu.';
    if (!isPositiveNumber(expectedWeightKg)) nextErrors.expectedWeightKg = 'Khối lượng phải lớn hơn 0.';
    if (!isPositiveInteger(quantity)) nextErrors.quantity = 'Số lượng kiện phải từ 1 trở lên.';
    if (packagingType.length === 0) nextErrors.packagingType = 'Vui lòng chọn ít nhất một loại bao bì đóng gói.';
    if (!isPositiveNumber(lengthCm)) nextErrors.lengthCm = 'Chiều dài phải lớn hơn 0.';
    if (!isPositiveNumber(widthCm)) nextErrors.widthCm = 'Chiều rộng phải lớn hơn 0.';
    if (!isPositiveNumber(heightCm)) nextErrors.heightCm = 'Chiều cao phải lớn hơn 0.';
    if (destAddressText.trim().length < 5) {
      nextErrors.destAddressText = 'Địa chỉ giao hàng cần ít nhất 5 ký tự.';
    }
    if (!selectedRouteId) nextErrors.routeId = 'Vui lòng chọn tuyến vận chuyển.';
    if (!selectedScheduleId) nextErrors.scheduleId = 'Vui lòng chọn lịch vận chuyển.';
    if (!selectedStopId) nextErrors.dropoffStopId = 'Vui lòng chọn điểm giao hàng.';
    if (!documentImage) nextErrors.documentImage = 'Vui lòng chọn ảnh lô hàng.';
    return nextErrors;
  };

  // ─── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (__DEV__) console.log('[CreateOrder] submit pressed');

    const nextErrors = validateForm();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      showToast('error', 'Vui lòng kiểm tra lại thông tin bắt buộc.', 'Lỗi nhập liệu');
      return;
    }

    if (!accessToken) {
      showToast('error', 'Bạn cần đăng nhập lại trước khi tạo đơn.', 'Lỗi xác thực');
      return;
    }

    if (!documentImage) {
      showToast('error', 'Vui lòng chọn ảnh lô hàng.', 'Thiếu ảnh');
      return;
    }

    if (__DEV__) {
      console.log('[CreateOrder] payload preview:', {
        Schedule_ID: selectedScheduleId,
        Dropoff_Stop_ID: selectedStopId,
        Packaging_Type: packagingType.join(', '),
        Quantity: quantity,
        HasCargoPhoto: Boolean(documentImage.uri),
      });
    }

    setIsLoading(true);
    try {
      const response = await createOrder(accessToken, {
        itemName: itemName.trim(),
        category,
        tempCondition,
        expectedWeightKg: parseDecimal(expectedWeightKg),
        quantity: parseInt(quantity, 10),
        packagingType: packagingType.join(', '),
        lengthCm: parseDecimal(lengthCm),
        widthCm: parseDecimal(widthCm),
        heightCm: parseDecimal(heightCm),
        destAddressText: destAddressText.trim(),
        scheduleId: selectedScheduleId,
        dropoffStopId: selectedStopId,
        cargoPhoto: {
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
      if (__DEV__) console.error('[CreateOrder] create order failed', error);

      let errorMessage = 'Không thể tạo đơn lúc này. Vui lòng thử lại sau.';
      if (error instanceof ApiClientError) {
        if (error.status === 401) {
          errorMessage = 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.';
        } else if (error.status === 400) {
          errorMessage = error.message;
          if (errorMessage.toLowerCase().includes('goong')) {
            errorMessage = 'Không thể xác thực địa chỉ giao hàng. Vui lòng nhập địa chỉ rõ hơn hoặc thử lại sau.';
          }
        } else {
          errorMessage = getApiErrorMessage(error);
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      if (isPackagingTypeError(errorMessage)) {
        errorMessage = PACKAGING_TYPE_ERROR;
      }

      showToast('error', errorMessage, 'Lỗi tạo đơn');
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Image picker ────────────────────────────────────────────────────────────
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
      showToast('warning', 'Vui lòng cấp quyền truy cập thư viện ảnh để tải ảnh kiện hàng.');
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
      showToast('warning', 'Vui lòng cấp quyền camera để chụp ảnh kiện hàng.');
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
      setErrors((current) => ({ ...current, documentImage: 'Vui lòng chọn ảnh lô hàng, không chọn video.' }));
      showToast('warning', 'Vui lòng chọn ảnh lô hàng, không chọn video.');
      return;
    }
    setDocumentImage({ uri: asset.uri, mimeType: asset.mimeType || 'image/jpeg', fileName: asset.fileName || 'cargo.jpg' });
    setErrors((current) => ({ ...current, documentImage: undefined }));
  };

  // ─── Reset ───────────────────────────────────────────────────────────────────
  const resetForm = () => {
    setCategory('FROZEN_FRUITS_VEGGIES');
    setTempCondition(-6);
    setDestAddressText('');
    setItemName('');
    setExpectedWeightKg('');
    setQuantity('1');
    setPackagingType([]);
    setLengthCm('');
    setWidthCm('');
    setHeightCm('');
    setSelectedRouteId('');
    setSelectedScheduleId('');
    setSelectedStopId('');
    setBookingOptions(null);
    setDocumentImage(null);
    setErrors({});
    setSuccessData(null);
  };

  // ─── Text field helper ───────────────────────────────────────────────────────
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

  // ─── Render ──────────────────────────────────────────────────────────────────
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
        <AppToast
          visible={toastVisible}
          type={toastConfig.type}
          title={toastConfig.title}
          message={toastConfig.message}
          onClose={() => setToastVisible(false)}
        />

        {/* ─ Tuyến giao dự kiến summary card ─ */}
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
              icon="calendar-outline"
              color="#5B6EBC"
              label="Lịch khởi hành"
              value={selectedSchedule ? formatScheduleLabel(selectedSchedule) : 'Chưa chọn lịch'}
            />
            <View className="h-6 w-px bg-[#DAC2B6] ml-5" />
            <RouteRow
              icon="pin-outline"
              color="#B91C1C"
              label="Điểm giao hàng"
              value={selectedStop ? selectedStop.stopName : 'Chưa chọn điểm giao'}
            />
            <View className="h-6 w-px bg-[#DAC2B6] ml-5" />
            <RouteRow
              icon="location-sharp"
              color="#006E0A"
              label="Địa chỉ giao hàng cụ thể"
              value={destAddressText.trim() || 'Chưa nhập địa chỉ giao hàng'}
            />
          </View>
        </View>

        {/* ─ Section: Giao hàng ─ */}
        <View className="rounded-2xl border border-[#DAC2B6]/50 bg-white p-5 shadow-sm gap-4">
          <SectionTitle title="Giao hàng" icon="navigate-outline" />

          {/* Điểm lấy hàng (readonly) */}
          <View className="rounded-[14px] border border-[#DAC2B6]/60 bg-[#F8F9FA] p-4">
            <Text className="text-[#3A1F04] text-[13px] font-bold">Điểm lấy hàng / Hub tiếp nhận</Text>
            <Text className="mt-2 text-sm leading-5 text-[#877369]">
              Hub ColdChainX sẽ được xác nhận sau khi yêu cầu được duyệt
            </Text>
          </View>

          {/* Chọn tuyến */}
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

          {/* Chọn lịch khởi hành */}
          {selectedRouteId ? (
            <BookingOptionsPicker
              bookingOptions={bookingOptions}
              isLoading={isLoadingBooking}
              error={bookingError}
              selectedScheduleId={selectedScheduleId}
              selectedStopId={selectedStopId}
              scheduleError={errors.scheduleId}
              stopError={errors.dropoffStopId}
              onRetry={() => fetchBookingOptions(selectedRouteId)}
              onSelectSchedule={(scheduleId) => {
                setSelectedScheduleId(scheduleId);
                setErrors((current) => ({ ...current, scheduleId: undefined }));
              }}
              onSelectStop={(stopId) => {
                setSelectedStopId(stopId);
                setErrors((current) => ({ ...current, dropoffStopId: undefined }));
              }}
            />
          ) : null}

          {/* Địa chỉ giao hàng cụ thể */}
          {renderField(
            'destAddressText',
            'Địa chỉ giao hàng cụ thể',
            'Ví dụ: 201B Nguyễn Chí Thanh, Quận 5, TP.HCM',
            destAddressText,
            setDestAddressText
          )}
        </View>

        {/* ─ Section: Thông tin hàng hóa ─ */}
        <View className="rounded-2xl border border-[#DAC2B6]/50 bg-white p-5 shadow-sm gap-4">
          <SectionTitle title="Thông tin hàng hóa" icon="cube-outline" />

          {renderField('itemName', 'Tên hàng hóa', 'Ví dụ: Nho Mỹ, Vaccine Pfizer, Cá hồi...', itemName, setItemName)}

          <View className="flex-row gap-3">
            <View className="flex-1">
              {renderField('expectedWeightKg', 'Khối lượng dự kiến KG', 'Ví dụ: 12.5', expectedWeightKg, setExpectedWeightKg, 'numeric')}
            </View>
            <View className="w-[118px]">
              {renderField('quantity', 'Số lượng kiện', '1', quantity, setQuantity, 'numeric')}
            </View>
          </View>

          <View className="gap-2">
            <Text className="text-[#3A1F04] text-[13px] font-bold">Loại bao bì đóng gói</Text>
            <Text className="text-xs text-[#877369]">Chọn một hoặc nhiều loại bao bì phù hợp với lô hàng.</Text>
            <PackagingTypeSelector
              selectedTypes={packagingType}
              onChange={(selected) => {
                setPackagingType(selected);
                if (errors.packagingType) setErrors((current) => ({ ...current, packagingType: undefined }));
              }}
            />
            {errors.packagingType ? <Text className="text-xs font-medium text-red-600">{errors.packagingType}</Text> : null}
          </View>

          <View className="gap-2">
            <Text className="text-[#3A1F04] text-[13px] font-bold">Kích thước kiện hàng</Text>
            <View className="flex-row gap-2">
              <View className="flex-1">{renderField('lengthCm', 'Dài cm', 'Dài', lengthCm, setLengthCm, 'numeric')}</View>
              <View className="flex-1">{renderField('widthCm', 'Rộng cm', 'Rộng', widthCm, setWidthCm, 'numeric')}</View>
              <View className="flex-1">{renderField('heightCm', 'Cao cm', 'Cao', heightCm, setHeightCm, 'numeric')}</View>
            </View>
          </View>

          {capacityWarning ? (
            <View className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <View className="flex-row items-start gap-2">
                <Ionicons name="warning-outline" size={18} color="#b45309" />
                <Text className="flex-1 text-sm font-semibold leading-5 text-amber-800">{capacityWarning}</Text>
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
                  <Text className="mt-3 text-center text-sm font-bold text-[#3A1F04]">Chụp hoặc tải ảnh kiện hàng</Text>
                  <Text className="mt-1 text-center text-xs leading-5 text-[#877369]">Chỉ chọn ảnh, không chọn video.</Text>
                </View>
              )}
            </Pressable>
            {errors.documentImage ? <Text className="text-xs font-medium text-red-600">{errors.documentImage}</Text> : null}
          </View>
        </View>

        <GoodsTypeSelector value={category} onChange={setCategory} />
        {errors.category ? <Text className="-mt-3 text-xs font-medium text-red-600">{errors.category}</Text> : null}

        <TemperatureSelector temperature={tempCondition} setTemperature={setTempCondition} />

        <Text className="pb-4 text-center text-[10px] font-medium uppercase tracking-widest text-[#877369]">
          ColdChainX - Giữ trọn tinh hoa di sản
        </Text>
      </ScrollView>

      {/* Submit button */}
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

      {/* Success modal */}
      <Modal visible={!!successData} transparent animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/60 px-5">
          <View className="w-full rounded-3xl bg-white p-6 shadow-lg">
            <View className="items-center">
              <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-[#E8F5E9]">
                <Ionicons name="checkmark-circle" size={42} color="#4CAF50" />
              </View>
              <Text className="text-center text-[20px] font-bold text-[#3A1F04]">Gửi yêu cầu thành công</Text>
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

// ─── BookingOptionsPicker component ──────────────────────────────────────────
function BookingOptionsPicker({
  bookingOptions,
  isLoading,
  error,
  selectedScheduleId,
  selectedStopId,
  scheduleError,
  stopError,
  onRetry,
  onSelectSchedule,
  onSelectStop,
}: {
  bookingOptions: RouteBookingOptionsDto | null;
  isLoading: boolean;
  error: string | null;
  selectedScheduleId: string;
  selectedStopId: string;
  scheduleError?: string;
  stopError?: string;
  onRetry: () => void;
  onSelectSchedule: (scheduleId: string) => void;
  onSelectStop: (stopId: string) => void;
}) {
  if (isLoading) {
    return (
      <View className="items-center py-4">
        <ActivityIndicator size="small" color="#8B4513" />
        <Text className="mt-2 text-xs text-[#877369]">Đang tải lịch và điểm giao...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="rounded-[14px] border border-red-200 bg-red-50 p-4 gap-3">
        <Text className="text-sm font-semibold leading-5 text-red-700">{error}</Text>
        <Pressable onPress={onRetry} className="self-start rounded-lg bg-[#8B4513] px-3 py-2">
          <Text className="text-xs font-bold text-white">Tải lại</Text>
        </Pressable>
      </View>
    );
  }

  if (!bookingOptions) return null;

  return (
    <>
      {/* Schedule picker */}
      <View className="gap-2">
        <View className="flex-row items-center justify-between">
          <Text className="text-[#3A1F04] text-[13px] font-bold">Lịch vận chuyển</Text>
        </View>
        {bookingOptions.availableSchedules.length === 0 ? (
          <View className="rounded-[14px] border border-amber-200 bg-amber-50 p-4">
            <Text className="text-sm leading-5 text-amber-800">Tuyến này chưa có lịch khởi hành. Vui lòng chọn tuyến khác.</Text>
          </View>
        ) : (
          <View className="gap-2">
            {bookingOptions.availableSchedules.map((schedule) => {
              const isSelected = selectedScheduleId === schedule.scheduleId;
              return (
                <Pressable
                  key={schedule.scheduleId}
                  onPress={() => onSelectSchedule(schedule.scheduleId)}
                  className={[
                    'rounded-[14px] border p-4',
                    isSelected ? 'border-[#5B6EBC] bg-[#5B6EBC]' : 'border-[#DAC2B6]/60 bg-[#F8F9FA]',
                  ].join(' ')}
                >
                  <View className="flex-row items-center justify-between gap-3">
                    <View className="flex-1">
                      <Text className={['text-sm font-bold', isSelected ? 'text-white' : 'text-[#3A1F04]'].join(' ')}>
                        {schedule.scheduleName}
                      </Text>
                      <Text className={['mt-1 text-xs', isSelected ? 'text-white/75' : 'text-[#877369]'].join(' ')}>
                        {formatDayOfWeek(schedule.dayOfWeek)} · Khởi hành {schedule.departureTime.slice(0, 5)} · Đóng hàng {schedule.cutOffTime.slice(0, 5)}
                      </Text>
                    </View>
                    {isSelected ? <Ionicons name="checkmark-circle" size={20} color="#D4E0FF" /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
        {scheduleError ? <Text className="text-xs font-medium text-red-600">{scheduleError}</Text> : null}
      </View>

      {/* Stop picker */}
      <View className="gap-2">
        <Text className="text-[#3A1F04] text-[13px] font-bold">Điểm giao hàng</Text>
        {bookingOptions.availableStops.length === 0 ? (
          <View className="rounded-[14px] border border-amber-200 bg-amber-50 p-4">
            <Text className="text-sm leading-5 text-amber-800">Tuyến này chưa có điểm giao. Vui lòng chọn tuyến khác.</Text>
          </View>
        ) : (
          <View className="gap-2">
            {bookingOptions.availableStops.map((stop) => {
              const isSelected = selectedStopId === stop.stopId;
              return (
                <Pressable
                  key={stop.stopId}
                  onPress={() => onSelectStop(stop.stopId)}
                  className={[
                    'rounded-[14px] border p-4',
                    isSelected ? 'border-[#B91C1C] bg-[#B91C1C]' : 'border-[#DAC2B6]/60 bg-[#F8F9FA]',
                  ].join(' ')}
                >
                  <View className="flex-row items-center justify-between gap-3">
                    <Text className={['text-sm font-bold flex-1', isSelected ? 'text-white' : 'text-[#3A1F04]'].join(' ')}>
                      {stop.stopName}
                    </Text>
                    {isSelected ? <Ionicons name="checkmark-circle" size={20} color="#FEC9C9" /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
        {stopError ? <Text className="text-xs font-medium text-red-600">{stopError}</Text> : null}
      </View>
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
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
          <Text className="text-sm leading-5 text-[#877369]">Chưa có tuyến vận chuyển khả dụng. Vui lòng thử lại sau.</Text>
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseDecimal(value: string) {
  return Number(value.trim().replace(',', '.'));
}

function getCapacityWarning(weightValue: string, lengthValue: string, widthValue: string, heightValue: string, quantityValue: string) {
  const weightKg = parseDecimal(weightValue);
  const lengthCm = parseDecimal(lengthValue);
  const widthCm = parseDecimal(widthValue);
  const heightCm = parseDecimal(heightValue);
  const qty = Number(quantityValue.trim());

  if (Number.isFinite(weightKg) && weightKg > 1500) {
    return 'Khối lượng dự kiến đã vượt khoảng 1.5 tấn. Backend sẽ kiểm tra năng lực tuyến và có thể yêu cầu điều chỉnh đơn.';
  }
  if (Number.isFinite(weightKg) && weightKg >= 1000) {
    return 'Khối lượng dự kiến đang gần ngưỡng 1-1.5 tấn. Vui lòng kiểm tra lại trước khi gửi yêu cầu.';
  }
  if (Number.isFinite(lengthCm) && Number.isFinite(widthCm) && Number.isFinite(heightCm) && Number.isFinite(qty)) {
    const estimatedCbm = (lengthCm * widthCm * heightCm * qty) / 1_000_000;
    if (estimatedCbm >= 8) {
      return 'Kích thước quy đổi đang khá lớn. Backend sẽ xác nhận CBM và năng lực tuyến ở bước kiểm duyệt.';
    }
  }
  return null;
}

function formatCityName(city: string) {
  switch (city.trim().toUpperCase()) {
    case 'HCM': return 'TP.HCM';
    case 'CAN THO': return 'Cần Thơ';
    case 'DA NANG': return 'Đà Nẵng';
    case 'HA NOI': return 'Hà Nội';
    case 'DAK LAK': return 'Đắk Lắk';
    default: return city;
  }
}

function getRouteLabel(route: RouteOptionResponse) {
  return `${formatCityName(route.originCity)} → ${formatCityName(route.destCity)}`;
}

function getRouteMeta(route: RouteOptionResponse) {
  return `${route.routeCode} · Dự kiến ${route.transitTime}`;
}

function formatDayOfWeek(day: number) {
  const days: Record<number, string> = { 1: 'Thứ 2', 2: 'Thứ 3', 3: 'Thứ 4', 4: 'Thứ 5', 5: 'Thứ 6', 6: 'Thứ 7', 7: 'Chủ nhật' };
  return days[day] ?? `Thứ ${day}`;
}

function formatScheduleLabel(schedule: ScheduleOptionDto) {
  return `${schedule.scheduleName} · ${formatDayOfWeek(schedule.dayOfWeek)} ${schedule.departureTime.slice(0, 5)}`;
}

function isPositiveNumber(value: string) {
  const parsed = parseDecimal(value);
  return Number.isFinite(parsed) && parsed > 0;
}

function isPositiveInteger(value: string) {
  const parsed = Number(value.trim());
  return Number.isInteger(parsed) && parsed >= 1;
}

function isPackagingTypeError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes('packaging_type') || normalized.includes('packaging type');
}

function translateStatus(status: string) {
  switch (status.toUpperCase()) {
    case 'PENDING':
    case 'PENDING_REVIEW': return 'Chờ duyệt';
    case 'APPROVED': return 'Đã duyệt';
    case 'IN_TRANSIT': return 'Đang giao';
    case 'DELIVERED': return 'Đã giao';
    case 'CANCELLED': return 'Đã hủy';
    default: return status;
  }
}
