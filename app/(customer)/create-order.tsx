import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppToast, ToastType } from '../../components/AppToast';
import { colors } from '../../constants/colors';
import { customerColors } from '../../constants/customerTheme';
import { CargoInformationStep } from '../../features/customer/create-order/components/CargoInformationStep';
import { CreateOrderReviewStep } from '../../features/customer/create-order/components/CreateOrderReviewStep';
import {
  CreateOrderSuccessModal,
  type CreateOrderSuccessData,
} from '../../features/customer/create-order/components/CreateOrderUi';
import { PackagingImageStep } from '../../features/customer/create-order/components/PackagingImageStep';
import { RouteScheduleStep } from '../../features/customer/create-order/components/RouteScheduleStep';
import { CreateOrderStepProgress } from '../../features/customer/create-order/CreateOrderStepProgress';
import { mapCreateOrderRequest } from '../../features/customer/create-order/createOrderMapper';
import {
  CREATE_ORDER_STEP_FIELDS,
  CreateOrderFieldKey,
  CreateOrderFormValues,
  CreateOrderStep,
  CreateOrderValidationErrors,
  DocumentImage,
  GoodsType,
  isCreateOrderFormDirty,
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
} from '../../services/routeApi';
import { useAuthStore } from '../../store/useAuthStore';

const STEP_DETAILS: Record<CreateOrderStep, { title: string }> = {
  1: { title: 'Tuyến và lịch vận chuyển' },
  2: { title: 'Thông tin hàng hóa' },
  3: { title: 'Đóng gói và hình ảnh' },
  4: { title: 'Kiểm tra và gửi đơn hàng' },
};

export default function CreateOrderScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const accessToken = useAuthStore((state) => state.token);
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView | null>(null);
  const scrollOffsetYRef = useRef(0);
  const scrollRequestIdRef = useRef(0);
  const fieldRefs = useRef<Partial<Record<CreateOrderFieldKey, View | null>>>({});
  const inputRefs = useRef<Partial<Record<CreateOrderFieldKey, TextInput | null>>>({});
  const pendingErrorFieldRef = useRef<CreateOrderFieldKey | null>(null);
  const allowExitRef = useRef(false);

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
  const [successData, setSuccessData] = useState<CreateOrderSuccessData | null>(null);
  const [currentStep, setCurrentStep] = useState<CreateOrderStep>(1);
  const [hasUserEditedForm, setHasUserEditedForm] = useState(false);

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
  const isFormDirty = hasUserEditedForm && isCreateOrderFormDirty(formValues);

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

  const scrollToErrorField = useCallback((field: CreateOrderFieldKey) => {
    const requestId = ++scrollRequestIdRef.current;
    const frameId = requestAnimationFrame(() => {
      const fieldNode = fieldRefs.current[field];
      const scrollView = scrollViewRef.current;
      const scrollNode = scrollView?.getNativeScrollRef();
      if (!fieldNode || !scrollView || !scrollNode) return;

      fieldNode.measureInWindow((_fieldX, fieldY) => {
        if (scrollRequestIdRef.current !== requestId) return;
        scrollNode.measureInWindow((_scrollX, scrollY) => {
          if (scrollRequestIdRef.current !== requestId) return;
          const targetY = scrollOffsetYRef.current + fieldY - scrollY - 16;
          scrollView.scrollTo({ y: Math.max(targetY, 0), animated: true });
          inputRefs.current[field]?.focus();
        });
      });
    });

    return () => {
      cancelAnimationFrame(frameId);
      if (scrollRequestIdRef.current === requestId) {
        scrollRequestIdRef.current += 1;
      }
    };
  }, []);

  useEffect(() => {
    const field = pendingErrorFieldRef.current;
    if (!field) return;
    pendingErrorFieldRef.current = null;
    return scrollToErrorField(field);
  }, [currentStep, errors, scrollToErrorField]);

  const handleRouteSelect = (routeId: string) => {
    setHasUserEditedForm(true);
    if (routeId !== selectedRouteId) {
      currentBookingRouteIdRef.current = '';
      currentSelectedRouteIdRef.current = routeId;
      setSelectedRouteId(routeId);
      setSelectedScheduleId('');
      setSelectedStopId('');
      setDestAddressText('');
      setBookingOptions(null);
      setBookingError(null);
      setIsLoadingBooking(false);
    }
    setErrors((current) => ({
      ...current,
      routeId: undefined,
      scheduleId: undefined,
      dropoffStopId: undefined,
      destAddressText: undefined,
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

  const requestFirstErrorFocus = (nextErrors: CreateOrderValidationErrors) => {
    pendingErrorFieldRef.current = getFirstInvalidField(nextErrors);
  };

  const handleContinue = () => {
    Keyboard.dismiss();
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
    if (Object.keys(nextStepErrors).length > 0) {
      requestFirstErrorFocus(nextStepErrors);
      return;
    }

    setCurrentStep((step) => (step + 1) as CreateOrderStep);
  };

  const handleBack = useCallback(() => {
    Keyboard.dismiss();
    if (currentStep > 1) setCurrentStep((step) => (step - 1) as CreateOrderStep);
  }, [currentStep]);

  const confirmLeaveCreateOrder = useCallback((onLeave: () => void) => {
    Alert.alert(
      'Rời khỏi trang tạo đơn?',
      'Thông tin bạn đã nhập sẽ không được lưu.',
      [
        { text: 'Tiếp tục nhập', style: 'cancel' },
        { text: 'Rời khỏi', style: 'destructive', onPress: onLeave },
      ]
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      const handleHardwareBack = () => {
        if (currentStep > 1) {
          handleBack();
          return true;
        }
        if (!isFormDirty || successData) return false;

        confirmLeaveCreateOrder(() => {
          allowExitRef.current = true;
          router.back();
        });
        return true;
      };

      const hardwareSubscription = BackHandler.addEventListener('hardwareBackPress', handleHardwareBack);
      const unsubscribeBeforeRemove = navigation.addListener('beforeRemove', (event) => {
        if (allowExitRef.current) {
          allowExitRef.current = false;
          return;
        }
        if (currentStep > 1) {
          event.preventDefault();
          handleBack();
          return;
        }
        if (!isFormDirty || successData) return;

        event.preventDefault();
        confirmLeaveCreateOrder(() => {
          allowExitRef.current = true;
          navigation.dispatch(event.data.action);
        });
      });

      return () => {
        hardwareSubscription.remove();
        unsubscribeBeforeRemove();
      };
    }, [confirmLeaveCreateOrder, currentStep, handleBack, isFormDirty, navigation, router, successData])
  );

  const goToStep = (step: CreateOrderStep) => setCurrentStep(step);

  // ─── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    Keyboard.dismiss();
    if (__DEV__) console.log('[CreateOrder] submit pressed');

    if (isLoadingBooking || isLoadingRoutes) {
      showToast('warning', 'Vui lòng đợi hệ thống tải xong thông tin tuyến và lịch vận chuyển.', 'Đang tải dữ liệu');
      return;
    }

    const nextErrors = validateCreateOrderForm(formValues, routeOptions, bookingOptions);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      requestFirstErrorFocus(nextErrors);
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

      let errorMessage = 'Không thể tạo đơn hàng. Vui lòng kiểm tra lại thông tin.';
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
        requestFirstErrorFocus({ [serverErrorField]: errorMessage });
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
      handleImagePermissionDenied(permission, 'thư viện ảnh');
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
      handleImagePermissionDenied(permission, 'camera');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    handleImageResult(result);
  };

  const handleImagePermissionDenied = (permission: { canAskAgain: boolean }, source: string) => {
    if (!permission.canAskAgain) {
      Alert.alert(
        'Cần quyền truy cập',
        `Vui lòng mở Cài đặt để cấp quyền ${source} trước khi thêm ảnh lô hàng.`,
        [
          { text: 'Để sau', style: 'cancel' },
          { text: 'Mở Cài đặt', onPress: () => void Linking.openSettings() },
        ]
      );
      return;
    }
    showToast('warning', `Vui lòng cấp quyền ${source} để thêm ảnh lô hàng.`);
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
    setHasUserEditedForm(true);
    setErrors((current) => ({ ...current, documentImage: undefined }));
  };

  const removeDocumentImage = () => {
    setDocumentImage(null);
    setHasUserEditedForm(true);
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
    setCurrentStep(1);
    setHasUserEditedForm(false);
  };

  const registerField = (field: CreateOrderFieldKey, node: View | null) => {
    fieldRefs.current[field] = node;
  };

  const registerInput = (field: CreateOrderFieldKey, node: TextInput | null) => {
    inputRefs.current[field] = node;
  };

  const updateTextField = (
    field: CreateOrderFieldKey,
    value: string,
    setter: (nextValue: string) => void
  ) => {
    setter(value);
    setHasUserEditedForm(true);
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validateFieldOnBlur = (field: CreateOrderFieldKey) => {
    const fieldStep = getFieldStep(field);
    if (!fieldStep) return;
    const fieldError = validateCreateOrderStep(fieldStep, formValues, routeOptions, bookingOptions)[field];
    setErrors((current) => ({ ...current, [field]: fieldError }));
  };

  const submitTextField = (field: CreateOrderFieldKey) => {
    const nextField = getNextInputField(field);
    if (nextField) inputRefs.current[nextField]?.focus();
    else Keyboard.dismiss();
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <View className="flex-1" style={{ backgroundColor: colors.surface.page }}>
      <View className="px-5 pb-2 pt-4">
        <CreateOrderStepProgress currentStep={currentStep} totalSteps={4} {...STEP_DETAILS[currentStep]} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          ref={scrollViewRef}
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          onScroll={(event) => {
            scrollOffsetYRef.current = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32, gap: 20 }}
        >
        <AppToast
          visible={toastVisible}
          type={toastConfig.type}
          title={toastConfig.title}
          message={toastConfig.message}
          onClose={() => setToastVisible(false)}
        />

        {currentStep === 1 ? (
          <RouteScheduleStep
            routes={routeOptions}
            selectedRouteId={selectedRouteId}
            bookingOptions={bookingOptions}
            selectedScheduleId={selectedScheduleId}
            selectedStopId={selectedStopId}
            address={destAddressText}
            errors={errors}
            isLoadingRoutes={isLoadingRoutes}
            isLoadingBooking={isLoadingBooking}
            routeError={routeError}
            bookingError={bookingError}
            registerField={registerField}
            registerInput={registerInput}
            onRetryRoutes={fetchRoutes}
            onRetryBooking={() => fetchBookingOptions(selectedRouteId)}
            onSelectRoute={handleRouteSelect}
            onSelectSchedule={(scheduleId) => {
              setHasUserEditedForm(true);
              setSelectedScheduleId(scheduleId);
              setErrors((current) => ({ ...current, scheduleId: undefined }));
            }}
            onSelectStop={(stopId) => {
              setHasUserEditedForm(true);
              if (stopId !== selectedStopId) {
                setSelectedStopId(stopId);
                setDestAddressText('');
              }
              setErrors((current) => ({ ...current, dropoffStopId: undefined, destAddressText: undefined }));
            }}
            onChangeAddress={(value) => updateTextField('destAddressText', value, setDestAddressText)}
            onSelectAddress={(address) => {
              setHasUserEditedForm(true);
              setDestAddressText(address);
              setErrors((current) => ({ ...current, destAddressText: undefined }));
            }}
          />
        ) : null}

        {currentStep === 2 ? (
          <CargoInformationStep
            itemName={itemName}
            expectedWeightKg={expectedWeightKg}
            quantity={quantity}
            category={category}
            temperature={tempCondition}
            errors={errors}
            registerField={registerField}
            registerInput={registerInput}
            onChangeItemName={(value) => updateTextField('itemName', value, setItemName)}
            onChangeExpectedWeight={(value) => updateTextField('expectedWeightKg', value, setExpectedWeightKg)}
            onChangeQuantity={(value) => updateTextField('quantity', value, setQuantity)}
            onChangeCategory={(value) => {
              setHasUserEditedForm(true);
              setCategory(value);
              setErrors((current) => ({ ...current, category: undefined }));
            }}
            onChangeTemperature={(value) => {
              setHasUserEditedForm(true);
              setTempCondition(value);
              setErrors((current) => ({ ...current, tempCondition: undefined }));
            }}
            onBlurField={validateFieldOnBlur}
            onSubmitField={submitTextField}
          />
        ) : null}

        {currentStep === 3 ? (
          <PackagingImageStep
            packagingTypes={packagingType}
            lengthCm={lengthCm}
            widthCm={widthCm}
            heightCm={heightCm}
            quantity={quantity}
            image={documentImage}
            capacityWarning={capacityWarning}
            errors={errors}
            registerField={registerField}
            registerInput={registerInput}
            onChangePackagingTypes={(value) => {
              setHasUserEditedForm(true);
              setPackagingType(value);
              setErrors((current) => ({ ...current, packagingType: undefined }));
            }}
            onChangeLength={(value) => updateTextField('lengthCm', value, setLengthCm)}
            onChangeWidth={(value) => updateTextField('widthCm', value, setWidthCm)}
            onChangeHeight={(value) => updateTextField('heightCm', value, setHeightCm)}
            onPickImage={openImagePicker}
            onRemoveImage={removeDocumentImage}
            onBlurField={validateFieldOnBlur}
            onSubmitField={submitTextField}
          />
        ) : null}

        {currentStep === 4 ? (
          <CreateOrderReviewStep
            values={formValues}
            selectedRoute={selectedRoute}
            selectedSchedule={selectedSchedule}
            selectedStop={selectedStop}
            onEdit={goToStep}
          />
        ) : null}
        </ScrollView>

      </KeyboardAvoidingView>

      {(() => {
        const isStepValid = currentStep === 4 || Object.keys(validateCreateOrderStep(currentStep as 1 | 2 | 3, formValues, routeOptions, bookingOptions)).length === 0;
        const primaryLabel = currentStep === 4 ? 'Gửi đơn hàng' : 'Tiếp tục';

        return (
          <View style={[styles.localFooter, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            {currentStep > 1 ? (
              <View style={styles.localBackButtonVisual}>
                <Text style={styles.localBackButtonText}>
                  Quay lại
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Quay lại"
                  onPress={handleBack}
                  style={StyleSheet.absoluteFillObject}
                />
              </View>
            ) : null}

            <View
              style={[
                styles.localNextButtonVisual,
                !isStepValid && styles.localNextButtonVisualDisabled,
              ]}
            >
              {isLoading ? (
                <ActivityIndicator color={!isStepValid ? colors.text.secondary : '#FFFFFF'} />
              ) : null}
              <Text
                style={[
                  styles.localNextButtonText,
                  !isStepValid && styles.localNextButtonTextDisabled,
                ]}
              >
                {primaryLabel}
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={primaryLabel}
                accessibilityState={{ disabled: !isStepValid }}
                disabled={!isStepValid}
                onPress={handleContinue}
                style={StyleSheet.absoluteFillObject}
              />
            </View>
          </View>
        );
      })()}

      <CreateOrderSuccessModal
        data={successData}
        onViewOrder={() => {
          const createdOrderId = successData?.orderId;
          setSuccessData(null);
          if (createdOrderId) {
            router.replace(`/(customer)/orders/${createdOrderId}` as never);
          } else {
            router.replace('/(customer)/status');
          }
        }}
        onCreateAnother={resetForm}
      />
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
    return 'Khối lượng dự kiến đang gần ngưỡng 1-1.5 tấn. Vui lòng kiểm tra lại trước khi gửi đơn hàng.';
  }
  if (Number.isFinite(lengthCm) && Number.isFinite(widthCm) && Number.isFinite(heightCm) && Number.isFinite(qty)) {
    const estimatedCbm = (lengthCm * widthCm * heightCm * qty) / 1_000_000;
    if (estimatedCbm >= 8) {
      return 'Kích thước quy đổi đang khá lớn. Backend sẽ xác nhận CBM và năng lực tuyến ở bước kiểm duyệt.';
    }
  }
  return null;
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
  if (technicalMessage.includes('address') || technicalMessage.includes('goong')) {
    return 'Không thể xác thực địa chỉ giao hàng. Vui lòng nhập địa chỉ rõ hơn hoặc thử lại sau.';
  }
  if (technicalMessage.includes('item') || technicalMessage.includes('hàng hóa')) {
    return 'Tên hàng hóa không hợp lệ.';
  }
  if (technicalMessage.includes('category')) {
    return 'Phân loại hàng hóa không hợp lệ.';
  }
  if (technicalMessage.includes('weight')) {
    return 'Khối lượng hàng hóa không hợp lệ.';
  }
  if (technicalMessage.includes('quantity')) {
    return 'Số lượng kiện không hợp lệ.';
  }
  if (technicalMessage.includes('packaging') || technicalMessage.includes('package')) {
    return 'Loại bao bì không hợp lệ.';
  }
  if (technicalMessage.includes('length') || technicalMessage.includes('width') || technicalMessage.includes('height') || technicalMessage.includes('dimension')) {
    return 'Kích thước kiện hàng không hợp lệ.';
  }
  if (technicalMessage.includes('photo') || technicalMessage.includes('image') || technicalMessage.includes('cargo')) {
    return 'Ảnh lô hàng không hợp lệ.';
  }

  return 'Không thể tạo đơn hàng. Vui lòng kiểm tra lại thông tin.';
}

function getCreateOrderServerErrorField(error: unknown): CreateOrderFieldKey | null {
  const technicalMessage = getApiErrorMessage(error).toLowerCase();
  if (technicalMessage.includes('route') && technicalMessage.includes('active')) return 'routeId';
  if (technicalMessage.includes('schedule')) return 'scheduleId';
  if (technicalMessage.includes('dropoff') || technicalMessage.includes('stop')) return 'dropoffStopId';
  if (technicalMessage.includes('address') || technicalMessage.includes('goong')) return 'destAddressText';
  if (technicalMessage.includes('item') || technicalMessage.includes('hàng hóa')) return 'itemName';
  if (technicalMessage.includes('category')) return 'category';
  if (technicalMessage.includes('temperature') || technicalMessage.includes('temp_condition')) return 'tempCondition';
  if (technicalMessage.includes('weight')) return 'expectedWeightKg';
  if (technicalMessage.includes('quantity')) return 'quantity';
  if (technicalMessage.includes('packaging') || technicalMessage.includes('package')) return 'packagingType';
  if (technicalMessage.includes('length')) return 'lengthCm';
  if (technicalMessage.includes('width')) return 'widthCm';
  if (technicalMessage.includes('height') || technicalMessage.includes('dimension')) return 'heightCm';
  if (technicalMessage.includes('photo') || technicalMessage.includes('image') || technicalMessage.includes('cargo')) return 'documentImage';
  return null;
}

function getFirstInvalidStep(errors: CreateOrderValidationErrors): CreateOrderStep {
  for (const step of [1, 2, 3] as const) {
    if (CREATE_ORDER_STEP_FIELDS[step].some((field) => errors[field])) return step;
  }
  return 4;
}

function getFieldStep(field: CreateOrderFieldKey): Exclude<CreateOrderStep, 4> | null {
  for (const step of [1, 2, 3] as const) {
    if (CREATE_ORDER_STEP_FIELDS[step].includes(field)) return step;
  }
  return null;
}

function getFirstInvalidField(errors: CreateOrderValidationErrors): CreateOrderFieldKey | null {
  for (const step of [1, 2, 3] as const) {
    const field = CREATE_ORDER_STEP_FIELDS[step].find((candidate) => errors[candidate]);
    if (field) return field;
  }
  return null;
}

function getNextInputField(field: CreateOrderFieldKey): CreateOrderFieldKey | null {
  const nextFields: Partial<Record<CreateOrderFieldKey, CreateOrderFieldKey>> = {
    destAddressText: 'itemName',
    itemName: 'expectedWeightKg',
    expectedWeightKg: 'quantity',
    lengthCm: 'widthCm',
    widthCm: 'heightCm',
  };
  return nextFields[field] ?? null;
}

const styles = StyleSheet.create({
  localFooter: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(189, 214, 231, 0.4)',
    shadowColor: '#173b59',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 4,
  },
  localBackButtonVisual: {
    flex: 0.9,
    height: 54,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderWidth: 1,
    borderColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  localBackButtonText: {
    color: colors.brand.primary,
    fontSize: 16,
    fontWeight: '700',
    includeFontPadding: false,
  },
  localNextButtonVisual: {
    flex: 1.6,
    height: 54,
    borderRadius: 16,
    backgroundColor: colors.brand.primary,
    borderWidth: 1,
    borderColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    overflow: 'hidden',
    shadowColor: colors.brand.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 3,
  },
  localNextButtonVisualDisabled: {
    backgroundColor: colors.brand.primarySoft,
    borderColor: colors.border.default,
    shadowOpacity: 0,
    elevation: 0,
  },
  localNextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    includeFontPadding: false,
    textAlign: 'center',
  },
  localNextButtonTextDisabled: {
    color: colors.text.secondary,
  },
});
