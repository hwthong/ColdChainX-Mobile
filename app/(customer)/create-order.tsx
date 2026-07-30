import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppToast, ToastType } from '../../components/AppToast';
import { GoodsType, GoodsTypeSelector } from '../../components/GoodsTypeSelector';
import { getPackagingTypeLabel, PackagingTypeSelector } from '../../components/PackagingTypeSelector';
import { TemperatureSelector } from '../../components/TemperatureSelector';
import { CreateOrderStepProgress } from '../../features/customer/create-order/CreateOrderStepProgress';
import { mapCreateOrderRequest } from '../../features/customer/create-order/createOrderMapper';
import {
  CREATE_ORDER_STEP_FIELDS,
  CreateOrderFieldKey,
  CreateOrderFormValues,
  CreateOrderStep,
  CreateOrderValidationErrors,
  DocumentImage,
  parseCreateOrderDecimal,
  validateCreateOrderForm,
  validateCreateOrderStep,
} from '../../features/customer/create-order/createOrderValidation';
import { ApiClientError, getApiErrorMessage } from '../../services/apiClient';
import { createOrder } from '../../services/orderApi';
import {
  getRouteBookingOptions,
  getRouteOptions,
  RouteBookingOptionsDto,
  RouteOptionResponse,
  ScheduleOptionDto,
} from '../../services/routeApi';
import { useAuthStore } from '../../store/useAuthStore';

type SuccessData = {
  orderId: string;
  trackingCode: string;
  status: string;
  documentUrl?: string | null;
};

const STEP_DETAILS: Record<CreateOrderStep, { title: string; subtitle: string }> = {
  1: { title: 'Tuyến và lịch vận chuyển', subtitle: 'Chọn tuyến, lịch và điểm giao phù hợp.' },
  2: { title: 'Thông tin hàng hóa', subtitle: 'Khai báo loại hàng và điều kiện bảo quản.' },
  3: { title: 'Đóng gói và hình ảnh', subtitle: 'Bổ sung quy cách kiện hàng và ảnh thực tế.' },
  4: { title: 'Kiểm tra và gửi yêu cầu', subtitle: 'Xác nhận lại thông tin trước khi gửi.' },
};

export default function CreateOrderScreen() {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.token);
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView | null>(null);

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
  const currentBookingRouteIdRef = useRef<string>('');
  const currentSelectedRouteIdRef = useRef<string>('');

  // — UI state —
  const [errors, setErrors] = useState<CreateOrderValidationErrors>({});
  const [toastVisible, setToastVisible] = useState(false);
  const [toastConfig, setToastConfig] = useState<{ type: ToastType; title?: string; message: string }>({
    type: 'info',
    message: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [successData, setSuccessData] = useState<SuccessData | null>(null);
  const [currentStep, setCurrentStep] = useState<CreateOrderStep>(1);

  const selectedRoute = routeOptions.find((r) => r.routeId === selectedRouteId) ?? null;
  const selectedSchedule = bookingOptions?.availableSchedules.find((s) => s.scheduleId === selectedScheduleId) ?? null;
  const selectedStop = bookingOptions?.availableStops.find((s) => s.stopId === selectedStopId) ?? null;
  const capacityWarning = getCapacityWarning(expectedWeightKg, lengthCm, widthCm, heightCm, quantity);
  const formValues: CreateOrderFormValues = {
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
    scheduleId: selectedScheduleId,
    dropoffStopId: selectedStopId,
    documentImage,
  };

  // ─── Fetch route list ────────────────────────────────────────────────────────
  const fetchRoutes = useCallback(async () => {
    setIsLoadingRoutes(true);
    setRouteError(null);
    try {
      const response = await getRouteOptions();
      if (response.success && response.data) {
        const activeRoutes = response.data.filter((route) => route.status?.trim().toUpperCase() === 'ACTIVE');
        setRouteOptions(activeRoutes);
        const currentRouteId = currentSelectedRouteIdRef.current;
        if (!activeRoutes.some((route) => route.routeId === currentRouteId)) {
          const nextRouteId = activeRoutes.length === 1 ? activeRoutes[0].routeId : '';
          currentBookingRouteIdRef.current = '';
          currentSelectedRouteIdRef.current = nextRouteId;
          setBookingOptions(null);
          setSelectedScheduleId('');
          setSelectedStopId('');
          setIsLoadingBooking(false);
          setSelectedRouteId(nextRouteId);
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
    currentBookingRouteIdRef.current = routeId;
    setIsLoadingBooking(true);
    setBookingError(null);
    setBookingOptions(null);
    setSelectedScheduleId('');
    setSelectedStopId('');
    try {
      const response = await getRouteBookingOptions(routeId);
      if (currentBookingRouteIdRef.current !== routeId) return;
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
        setBookingError(response.message || 'Không thể tải lịch khởi hành.');
      }
    } catch (error) {
      if (currentBookingRouteIdRef.current !== routeId) return;
      setBookingError(getApiErrorMessage(error) || 'Không thể tải lịch khởi hành.');
    } finally {
      if (currentBookingRouteIdRef.current === routeId) {
        setIsLoadingBooking(false);
      }
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

  useEffect(() => {
    currentSelectedRouteIdRef.current = selectedRouteId;
  }, [selectedRouteId]);

  useEffect(() => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  }, [currentStep]);

  const handleRouteSelect = (routeId: string) => {
    if (routeId !== selectedRouteId) {
      currentBookingRouteIdRef.current = '';
      currentSelectedRouteIdRef.current = routeId;
      setSelectedRouteId(routeId);
      setSelectedScheduleId('');
      setSelectedStopId('');
      setBookingOptions(null);
      setBookingError(null);
      setIsLoadingBooking(false);
    }
    setErrors((current) => ({
      ...current,
      routeId: undefined,
      scheduleId: undefined,
      dropoffStopId: undefined,
    }));
  };

  const showToast = (type: ToastType, message: string, title?: string) => {
    setToastConfig({ type, message, title });
    setToastVisible(true);
  };

  const setStepErrors = (step: Exclude<CreateOrderStep, 4>, nextStepErrors: CreateOrderValidationErrors) => {
    setErrors((current) => {
      const nextErrors = { ...current };
      CREATE_ORDER_STEP_FIELDS[step].forEach((field) => delete nextErrors[field]);
      return { ...nextErrors, ...nextStepErrors };
    });
  };

  const handleContinue = () => {
    if (currentStep === 4) {
      void handleSubmit();
      return;
    }
    if (currentStep === 1 && (isLoadingRoutes || isLoadingBooking)) {
      showToast('warning', 'Vui lòng đợi hệ thống tải xong thông tin tuyến và lịch vận chuyển.', 'Đang tải dữ liệu');
      return;
    }

    const nextStepErrors = validateCreateOrderStep(currentStep, formValues, routeOptions, bookingOptions);
    setStepErrors(currentStep, nextStepErrors);
    if (Object.keys(nextStepErrors).length > 0) return;

    setCurrentStep((step) => (step + 1) as CreateOrderStep);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep((step) => (step - 1) as CreateOrderStep);
  };

  const goToStep = (step: CreateOrderStep) => setCurrentStep(step);

  // ─── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (__DEV__) console.log('[CreateOrder] submit pressed');

    if (isLoadingBooking || isLoadingRoutes) {
      showToast('warning', 'Vui lòng đợi hệ thống tải xong thông tin tuyến và lịch vận chuyển.', 'Đang tải dữ liệu');
      return;
    }

    const nextErrors = validateCreateOrderForm(formValues, routeOptions, bookingOptions);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setCurrentStep(getFirstInvalidStep(nextErrors));
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
      const response = await createOrder(accessToken, mapCreateOrderRequest({ ...formValues, documentImage }));

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

      let errorMessage = 'Không thể tạo yêu cầu vận chuyển. Vui lòng kiểm tra lại thông tin.';
      if (error instanceof ApiClientError) {
        if (error.status === 401) {
          errorMessage = 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.';
        } else {
          errorMessage = getCreateOrderErrorMessage(error);
        }
      } else {
        errorMessage = getCreateOrderErrorMessage(error);
      }

      const serverErrorField = getCreateOrderServerErrorField(error);
      if (serverErrorField) {
        setErrors((current) => ({ ...current, [serverErrorField]: errorMessage }));
        setCurrentStep(getFirstInvalidStep({ [serverErrorField]: errorMessage }));
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

  const removeDocumentImage = () => {
    setDocumentImage(null);
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
    currentBookingRouteIdRef.current = '';
    currentSelectedRouteIdRef.current = '';
    setBookingOptions(null);
    setBookingError(null);
    setIsLoadingBooking(false);
    setDocumentImage(null);
    setErrors({});
    setSuccessData(null);
  };

  // ─── Text field helper ───────────────────────────────────────────────────────
  const renderField = (
    field: CreateOrderFieldKey,
    label: string,
    placeholder: string,
    value: string,
    onChangeText: (text: string) => void,
    keyboardType: 'default' | 'numeric' = 'default'
  ) => (
    <View className="gap-1.5">
      <Text className="text-[#3A1F04] text-[13px] font-bold">{label} <Text className="text-red-600">*</Text></Text>
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
        ref={scrollViewRef}
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingBottom: 144 + insets.bottom, gap: 18 }}
      >
        <AppToast
          visible={toastVisible}
          type={toastConfig.type}
          title={toastConfig.title}
          message={toastConfig.message}
          onClose={() => setToastVisible(false)}
        />

        <CreateOrderStepProgress currentStep={currentStep} totalSteps={4} {...STEP_DETAILS[currentStep]} />

        {currentStep === 1 ? (
          <View className="gap-4 rounded-2xl border border-[#DAC2B6]/50 bg-white p-5">
            <SectionTitle title="Tuyến và lịch" icon="navigate-outline" />
            <View className="rounded-xl bg-[#F8F3EF] p-4">
              <Text className="text-sm font-bold text-[#3A1F04]">Điểm lấy hàng</Text>
              <Text className="mt-1 text-sm leading-5 text-[#877369]">Hub ColdChainX sẽ được xác nhận sau khi yêu cầu được duyệt.</Text>
            </View>
            <RouteOptionPicker routes={routeOptions} selectedRouteId={selectedRouteId} isLoading={isLoadingRoutes} error={routeError} onRetry={fetchRoutes} onSelect={handleRouteSelect} />
            {errors.routeId ? <Text className="text-xs font-medium text-red-600">{errors.routeId}</Text> : null}
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
                onSelectSchedule={(scheduleId) => { setSelectedScheduleId(scheduleId); setErrors((current) => ({ ...current, scheduleId: undefined })); }}
                onSelectStop={(stopId) => { setSelectedStopId(stopId); setErrors((current) => ({ ...current, dropoffStopId: undefined })); }}
              />
            ) : (
              <View className="rounded-xl border border-dashed border-[#DAC2B6] bg-[#F8F9FA] p-4">
                <Text className="text-sm leading-5 text-[#877369]">Chọn tuyến vận chuyển để xem lịch và điểm giao.</Text>
              </View>
            )}
            {renderField('destAddressText', 'Địa chỉ giao hàng cụ thể', 'Ví dụ: 201B Nguyễn Chí Thanh, Quận 5, TP.HCM', destAddressText, setDestAddressText)}
          </View>
        ) : null}

        {currentStep === 2 ? (
          <View className="gap-4">
            <View className="rounded-2xl border border-[#DAC2B6]/50 bg-white p-5">
              <SectionTitle title="Thông tin cơ bản" icon="cube-outline" />
              <View className="mt-4 gap-4">
                {renderField('itemName', 'Tên hàng hóa', 'Ví dụ: Nho Mỹ, vaccine, cá hồi...', itemName, setItemName)}
                <View className="flex-row gap-3">
                  <View className="flex-1">{renderField('expectedWeightKg', 'Khối lượng dự kiến (kg)', 'Ví dụ: 12.5', expectedWeightKg, setExpectedWeightKg, 'numeric')}</View>
                  <View className="w-[118px]">{renderField('quantity', 'Số kiện', 'Ví dụ: 1', quantity, setQuantity, 'numeric')}</View>
                </View>
              </View>
            </View>
            <GoodsTypeSelector value={category} onChange={(value) => { setCategory(value); setErrors((current) => ({ ...current, category: undefined })); }} />
            {errors.category ? <Text className="-mt-3 text-xs font-medium text-red-600">{errors.category}</Text> : null}
            <TemperatureSelector temperature={tempCondition} error={errors.tempCondition} setTemperature={(temperature) => { setTempCondition(temperature); setErrors((current) => ({ ...current, tempCondition: undefined })); }} />
          </View>
        ) : null}

        {currentStep === 3 ? (
          <View className="gap-4">
            <View className="rounded-2xl border border-[#DAC2B6]/50 bg-white p-5">
              <SectionTitle title="Đóng gói" icon="archive-outline" />
              <View className="mt-4 gap-4">
                <View className="gap-2">
                  <Text className="text-[13px] font-bold text-[#3A1F04]">Loại bao bì <Text className="text-red-600">*</Text></Text>
                  <Text className="text-xs text-[#877369]">Chọn một hoặc nhiều loại bao bì phù hợp với lô hàng.</Text>
                  <PackagingTypeSelector selectedTypes={packagingType} onChange={(selected) => { setPackagingType(selected); setErrors((current) => ({ ...current, packagingType: undefined })); }} />
                  {errors.packagingType ? <Text className="text-xs font-medium text-red-600">{errors.packagingType}</Text> : null}
                </View>
                <View className="gap-2">
                  <Text className="text-[13px] font-bold text-[#3A1F04]">Kích thước kiện hàng <Text className="text-red-600">*</Text></Text>
                  <View className="flex-row gap-2">
                    <View className="flex-1">{renderField('lengthCm', 'Dài (cm)', 'Dài', lengthCm, setLengthCm, 'numeric')}</View>
                    <View className="flex-1">{renderField('widthCm', 'Rộng (cm)', 'Rộng', widthCm, setWidthCm, 'numeric')}</View>
                    <View className="flex-1">{renderField('heightCm', 'Cao (cm)', 'Cao', heightCm, setHeightCm, 'numeric')}</View>
                  </View>
                </View>
              </View>
            </View>
            {capacityWarning ? <View className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><View className="flex-row items-start gap-2"><Ionicons name="warning-outline" size={18} color="#b45309" /><Text className="flex-1 text-sm font-semibold leading-5 text-amber-800">{capacityWarning}</Text></View></View> : null}
            <View className="gap-3 rounded-2xl border border-[#DAC2B6]/50 bg-white p-5">
              <SectionTitle title="Ảnh lô hàng" icon="camera-outline" />
              {documentImage ? (
                <View className="gap-3">
                  <Image source={{ uri: documentImage.uri }} className="h-44 w-full rounded-xl" resizeMode="cover" />
                  <View className="flex-row gap-3">
                    <Pressable onPress={openImagePicker} accessibilityRole="button" accessibilityLabel="Thay ảnh lô hàng" className="min-h-11 flex-1 items-center justify-center rounded-xl bg-[#F8F3EF]"><Text className="text-sm font-bold text-[#8B4513]">Thay ảnh</Text></Pressable>
                    <Pressable onPress={removeDocumentImage} accessibilityRole="button" accessibilityLabel="Xóa ảnh lô hàng" className="min-h-11 flex-1 items-center justify-center rounded-xl border border-[#DAC2B6]"><Text className="text-sm font-bold text-[#3A1F04]">Xóa ảnh</Text></Pressable>
                  </View>
                </View>
              ) : (
                <Pressable onPress={openImagePicker} accessibilityRole="button" accessibilityLabel="Thêm ảnh lô hàng" accessibilityHint="Chụp ảnh hoặc chọn ảnh rõ kiện hàng" className={['min-h-[148px] items-center justify-center rounded-xl border-2 border-dashed px-5', errors.documentImage ? 'border-red-300 bg-red-50' : 'border-[#DAC2B6] bg-[#F8F9FA]'].join(' ')}>
                  <View className="h-12 w-12 items-center justify-center rounded-full bg-[#8B4513]/10"><Ionicons name="camera-outline" size={26} color="#8B4513" /></View>
                  <Text className="mt-3 text-center text-sm font-bold text-[#3A1F04]">Thêm ảnh lô hàng</Text>
                  <Text className="mt-1 text-center text-xs leading-5 text-[#877369]">Ảnh rõ kiện hàng, chỉ chọn ảnh và không chọn video.</Text>
                </Pressable>
              )}
              {errors.documentImage ? <Text className="text-xs font-medium text-red-600">{errors.documentImage}</Text> : null}
            </View>
          </View>
        ) : null}

        {currentStep === 4 ? (
          <View className="gap-3">
            <ReviewSection title="Tuyến và lịch" onEdit={() => goToStep(1)} rows={[['Tuyến', selectedRoute ? getRouteLabel(selectedRoute) : '—'], ['Lịch', selectedSchedule ? formatScheduleLabel(selectedSchedule) : '—'], ['Điểm giao', selectedStop?.stopName || '—'], ['Địa chỉ', destAddressText || '—']]} />
            <ReviewSection title="Hàng hóa" onEdit={() => goToStep(2)} rows={[['Tên hàng', itemName || '—'], ['Loại hàng', getGoodsTypeLabel(category)], ['Khối lượng', expectedWeightKg ? `${expectedWeightKg} kg` : '—'], ['Số kiện', quantity ? `${quantity} kiện` : '—'], ['Nhiệt độ', `${tempCondition}°C`]]} />
            <ReviewSection title="Đóng gói và hình ảnh" onEdit={() => goToStep(3)} rows={[['Bao bì', packagingType.length ? packagingType.map(getPackagingTypeLabel).join(', ') : '—'], ['Kích thước', lengthCm && widthCm && heightCm ? `${lengthCm} × ${widthCm} × ${heightCm} cm` : '—'], ['Ảnh lô hàng', documentImage ? 'Đã chọn ảnh' : 'Chưa chọn ảnh']]} imageUri={documentImage?.uri} />
          </View>
        ) : null}
      </ScrollView>

      <View className="absolute bottom-0 inset-x-0 z-30 flex-row gap-3 border-t border-[#DAC2B6]/50 bg-[#F5F2F0] px-5 pt-4" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
        {currentStep > 1 ? <Pressable onPress={handleBack} disabled={isLoading} accessibilityRole="button" accessibilityLabel="Quay lại bước trước" className="min-h-14 items-center justify-center rounded-2xl border border-[#8B4513] px-5"><Text className="text-base font-bold text-[#8B4513]">Quay lại</Text></Pressable> : null}
        <Pressable onPress={handleContinue} disabled={isLoading} accessibilityRole="button" accessibilityLabel={currentStep === 4 ? 'Gửi yêu cầu vận chuyển' : 'Tiếp tục'} accessibilityState={{ disabled: isLoading }} className={['min-h-14 flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-[#8B4513]', isLoading ? 'opacity-70' : ''].join(' ')}>
          {isLoading ? <ActivityIndicator color="#FFC29F" /> : null}
          <Text className="text-base font-bold text-white">{isLoading ? 'Đang gửi yêu cầu...' : currentStep === 4 ? 'Gửi yêu cầu vận chuyển' : 'Tiếp tục'}</Text>
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
        <Text className="mt-2 text-xs text-[#877369]">Đang tải lịch khởi hành...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="rounded-[14px] border border-red-200 bg-red-50 p-4 gap-3">
        <Text className="text-sm font-semibold leading-5 text-red-700">{error}</Text>
        <Pressable onPress={onRetry} className="self-start rounded-lg bg-[#8B4513] px-3 py-2">
          <Text className="text-xs font-bold text-white">Thử lại</Text>
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
            <Text className="text-sm leading-5 text-amber-800">Tuyến này chưa có lịch khởi hành khả dụng. Vui lòng chọn tuyến khác.</Text>
          </View>
        ) : (
          <View className="gap-2">
            {bookingOptions.availableSchedules.map((schedule) => {
              const isSelected = selectedScheduleId === schedule.scheduleId;
              return (
                <Pressable
                  key={schedule.scheduleId}
                  onPress={() => onSelectSchedule(schedule.scheduleId)}
                  accessibilityRole="radio"
                  accessibilityLabel={`Lịch ${schedule.scheduleName}, ${formatDepartureDate(schedule.departureDate)}`}
                  accessibilityState={{ selected: isSelected }}
                  className={[
                    'rounded-[14px] border p-4',
                    isSelected ? 'border-[#8B4513] bg-[#8B4513]' : 'border-[#DAC2B6]/60 bg-[#F8F9FA]',
                  ].join(' ')}
                >
                  <View className="flex-row items-center justify-between gap-3">
                    <View className="flex-1">
                      <Text className={['text-sm font-bold', isSelected ? 'text-white' : 'text-[#3A1F04]'].join(' ')}>
                        {schedule.scheduleName}
                      </Text>
                      <Text className={['mt-1 text-xs font-semibold', isSelected ? 'text-white/90' : 'text-[#8B4513]'].join(' ')}>
                        {formatDepartureDate(schedule.departureDate)}
                      </Text>
                      <Text className={['mt-0.5 text-xs', isSelected ? 'text-white/75' : 'text-[#877369]'].join(' ')}>
                        Khởi hành: {schedule.departureTime.slice(0, 5)}
                      </Text>
                      <Text className={['mt-0.5 text-xs', isSelected ? 'text-white/75' : 'text-[#877369]'].join(' ')}>
                        Đóng nhận đơn: {schedule.cutOffTime.slice(0, 5)}
                      </Text>
                    </View>
                    {isSelected ? <Ionicons name="checkmark-circle" size={20} color="#FFC29F" /> : null}
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
                  accessibilityRole="radio"
                  accessibilityLabel={`Điểm giao ${stop.stopName}`}
                  accessibilityState={{ selected: isSelected }}
                  className={[
                    'rounded-[14px] border p-4',
                    isSelected ? 'border-[#8B4513] bg-[#8B4513]' : 'border-[#DAC2B6]/60 bg-[#F8F9FA]',
                  ].join(' ')}
                >
                  <View className="flex-row items-center justify-between gap-3">
                    <Text className={['text-sm font-bold flex-1', isSelected ? 'text-white' : 'text-[#3A1F04]'].join(' ')}>
                      {stop.stopName}
                    </Text>
                    {isSelected ? <Ionicons name="checkmark-circle" size={20} color="#FFC29F" /> : null}
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
              accessibilityRole="radio"
              accessibilityLabel={getRouteLabel(route)}
              accessibilityHint={getRouteMeta(route)}
              accessibilityState={{ selected: isSelected }}
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

function ReviewSection({
  title,
  rows,
  imageUri,
  onEdit,
}: {
  title: string;
  rows: [string, string][];
  imageUri?: string;
  onEdit: () => void;
}) {
  return (
    <View className="rounded-2xl border border-[#DAC2B6]/50 bg-white p-5">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="flex-1 text-base font-bold text-[#3A1F04]">{title}</Text>
        <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel={`Chỉnh sửa ${title.toLowerCase()}`} className="min-h-10 justify-center px-2">
          <Text className="text-sm font-bold text-[#8B4513]">Chỉnh sửa</Text>
        </Pressable>
      </View>
      <View className="mt-3 gap-2.5">
        {rows.map(([label, value]) => (
          <View key={label} className="flex-row items-start gap-4">
            <Text className="w-[96px] text-xs font-medium text-[#877369]">{label}</Text>
            <Text className="flex-1 text-right text-sm font-semibold leading-5 text-[#3A1F04]">{value}</Text>
          </View>
        ))}
        {imageUri ? <Image source={{ uri: imageUri }} className="mt-2 h-24 w-24 self-end rounded-xl" resizeMode="cover" /> : null}
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
function getCapacityWarning(weightValue: string, lengthValue: string, widthValue: string, heightValue: string, quantityValue: string) {
  const weightKg = parseCreateOrderDecimal(weightValue);
  const lengthCm = parseCreateOrderDecimal(lengthValue);
  const widthCm = parseCreateOrderDecimal(widthValue);
  const heightCm = parseCreateOrderDecimal(heightValue);
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

function formatDepartureDate(value: string): string {
  if (!value || typeof value !== 'string') return '—';
  const parts = value.trim().split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return value;
  const [year, month, day] = parts;
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return value;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime()) || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return value;
  }
  const days = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const dayName = days[date.getDay()] ?? '—';
  const formattedDay = String(day).padStart(2, '0');
  const formattedMonth = String(month).padStart(2, '0');
  return `${dayName}, ${formattedDay}/${formattedMonth}/${year}`;
}

function formatScheduleLabel(schedule: ScheduleOptionDto) {
  return `${schedule.scheduleName} · ${formatDepartureDate(schedule.departureDate)} · Khởi hành ${schedule.departureTime.slice(0, 5)}`;
}

function getCreateOrderErrorMessage(error: unknown) {
  const technicalMessage = getApiErrorMessage(error).toLowerCase();

  if (
    technicalMessage.includes('network') ||
    technicalMessage.includes('failed to fetch') ||
    technicalMessage.includes('cannot reach')
  ) {
    return 'Không thể kết nối máy chủ. Vui lòng thử lại.';
  }
  if (technicalMessage.includes('route') && technicalMessage.includes('active')) {
    return 'Tuyến vận chuyển hiện không khả dụng.';
  }
  if (technicalMessage.includes('schedule')) {
    return 'Lịch vận chuyển không còn khả dụng.';
  }
  if (technicalMessage.includes('dropoff') || technicalMessage.includes('stop')) {
    return 'Điểm giao hàng không hợp lệ.';
  }
  if (technicalMessage.includes('temperature') || technicalMessage.includes('temp_condition')) {
    return 'Nhiệt độ bảo quản không hợp lệ.';
  }
  if (technicalMessage.includes('goong')) {
    return 'Không thể xác thực địa chỉ giao hàng. Vui lòng nhập địa chỉ rõ hơn hoặc thử lại sau.';
  }

  return 'Không thể tạo yêu cầu vận chuyển. Vui lòng kiểm tra lại thông tin.';
}

function getCreateOrderServerErrorField(error: unknown): CreateOrderFieldKey | null {
  const technicalMessage = getApiErrorMessage(error).toLowerCase();
  if (technicalMessage.includes('route') && technicalMessage.includes('active')) return 'routeId';
  if (technicalMessage.includes('schedule')) return 'scheduleId';
  if (technicalMessage.includes('dropoff') || technicalMessage.includes('stop')) return 'dropoffStopId';
  if (technicalMessage.includes('temperature') || technicalMessage.includes('temp_condition')) return 'tempCondition';
  return null;
}

function getFirstInvalidStep(errors: CreateOrderValidationErrors): CreateOrderStep {
  for (const step of [1, 2, 3] as const) {
    if (CREATE_ORDER_STEP_FIELDS[step].some((field) => errors[field])) return step;
  }
  return 4;
}

function getGoodsTypeLabel(category: GoodsType) {
  switch (category) {
    case 'FROZEN_FRUITS_VEGGIES': return 'Thực phẩm đông lạnh';
    case 'PHARMACEUTICALS': return 'Dược phẩm';
    case 'MEAT_SEAFOOD': return 'Thịt / Hải sản';
  }
}

function translateStatus(status: string) {
  switch (status.toUpperCase()) {
    case 'PENDING':
    case 'PENDING_REVIEW': return 'Chờ duyệt';
    case 'APPROVED': return 'Đã duyệt';
    case 'LOADING': return 'Đang chuẩn bị xuất kho';
    case 'IN_TRANSIT': return 'Đang giao';
    case 'DELIVERED': return 'Đã giao';
    case 'CANCELLED': return 'Đã hủy';
    default: return status;
  }
}
