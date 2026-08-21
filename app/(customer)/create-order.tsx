import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Dimensions,
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
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppToast, ToastType } from '../../components/AppToast';
import { colors } from '../../constants/colors';
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
  createEmptyPackageLine,
  CreateOrderFieldKey,
  CreateOrderFormValues,
  CreateOrderStep,
  CreateOrderValidationErrors,
  DocumentImage,
  GoodsType,
  isCreateOrderFormDirty,
  MAX_CREATE_ORDER_FILE_SIZE_BYTES,
  OrderPackageLineFormValue,
  parseCreateOrderDecimal,
  validateCreateOrderForm,
  validateCreateOrderStep,
} from '../../features/customer/create-order/createOrderValidation';
import { ApiClientError, getApiErrorMessage } from '../../services/apiClient';
import type { GoongPlaceDetail } from '../../services/goongPlacesApi';
import { createOrder, getOrderById, updateOrder, type UpdateOrderPayload } from '../../services/orderApi';
import {
  getRouteBookingOptions,
  getRouteOptions,
  RouteBookingOptionsDto,
  RouteOptionResponse,
} from '../../services/routeApi';
import { useAuthStore } from '../../store/useAuthStore';

const STEP_DETAILS: Record<CreateOrderStep, { title: string }> = {
  1: { title: 'Tuyến và giao hàng' },
  2: { title: 'Thông tin hàng hóa' },
  3: { title: 'Đóng gói và hình ảnh' },
  4: { title: 'Kiểm tra và gửi đơn hàng' },
};

export default function CreateOrderScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { mode, orderId } = useLocalSearchParams<{ mode?: string; orderId?: string }>();
  const isEditMode = mode === 'edit' && Boolean(orderId);
  const accessToken = useAuthStore((state) => state.token);
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView | null>(null);
  const scrollOffsetYRef = useRef(0);
  const scrollRequestIdRef = useRef(0);
  const fieldRefs = useRef<Partial<Record<CreateOrderFieldKey, View | null>>>({});
  const inputRefs = useRef<Partial<Record<CreateOrderFieldKey, TextInput | null>>>({});
  const pendingErrorFieldRef = useRef<CreateOrderFieldKey | null>(null);
  const allowExitRef = useRef(false);
  const isSubmittingRef = useRef(false);
  const packageLineIdRef = useRef(1);

  // — Edit mode state —
  const [isLoadingOrder, setIsLoadingOrder] = useState(isEditMode);
  const [originalOrderStatus, setOriginalOrderStatus] = useState<string | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);
  const [existingOrderCbm, setExistingOrderCbm] = useState<number | null>(null);
  const isInitialLoadDoneRef = useRef(false);

  // — Goods info —
  const [category, setCategory] = useState<GoodsType>('FROZEN_FRUITS_VEGGIES');
  const [tempCondition, setTempCondition] = useState<number>(-6);
  const [itemName, setItemName] = useState('');
  const [expectedWeightKg, setExpectedWeightKg] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [packageLines, setPackageLines] = useState<OrderPackageLineFormValue[]>([
    createEmptyPackageLine('package-line-1'),
  ]);
  const [packagingType, setPackagingType] = useState<string[]>([]);
  const [lengthCm, setLengthCm] = useState('');
  const [widthCm, setWidthCm] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [documentImage, setDocumentImage] = useState<DocumentImage | null>(null);
  const [legalDocument, setLegalDocument] = useState<DocumentImage | null>(null);

  // — Delivery routing —
  const [destAddressText, setDestAddressText] = useState('');
  const [destinationLocation, setDestinationLocation] = useState<GoongPlaceDetail | null>(null);
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
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
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    console.log('[CreateOrderLayout] screenHeight:', Dimensions.get('window').height, 'safeArea:', { top: insets.top, bottom: insets.bottom });
  }, [insets.top, insets.bottom]);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    const showSubscription = Keyboard.addListener('keyboardWillShow', () => {
      console.log('[CreateOrderLayout] keyboardVisible: true');
      setIsKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener('keyboardWillHide', () => {
      console.log('[CreateOrderLayout] keyboardVisible: false');
      setIsKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const shouldHideFooter = Platform.OS === 'ios' && isKeyboardVisible;

  const effectiveDocumentImage = documentImage || (existingPhotoUrl ? { uri: existingPhotoUrl, mimeType: 'image/jpeg', fileName: 'cargo.jpg' } : null);
  const selectedRoute = routeOptions.find((r) => r.routeId === selectedRouteId) ?? null;
  const selectedSchedule = bookingOptions?.availableSchedules.find((s) => s.scheduleId === selectedScheduleId) ?? null;
  const selectedStop = bookingOptions?.availableStops.find((s) => s.stopId === selectedStopId) ?? null;
  const formValues: CreateOrderFormValues = {
    itemName,
    category,
    tempCondition,
    expectedWeightKg,
    quantity,
    packageLines,
    packagingType,
    lengthCm,
    widthCm,
    heightCm,
    destAddressText,
    destinationLocation,
    receiverName,
    receiverPhone,
    routeId: selectedRouteId,
    scheduleId: selectedScheduleId,
    dropoffStopId: selectedStopId,
    documentImage: effectiveDocumentImage,
    legalDocument,
  };
  const isFormDirty = hasUserEditedForm && isCreateOrderFormDirty(formValues);

  // ─── Reset ───────────────────────────────────────────────────────────────────
  const resetForm = useCallback(() => {
    setCategory('FROZEN_FRUITS_VEGGIES');
    setTempCondition(-6);
    setDestAddressText('');
    setDestinationLocation(null);
    setReceiverName('');
    setReceiverPhone('');
    setItemName('');
    setExpectedWeightKg('');
    setQuantity('1');
    packageLineIdRef.current = 1;
    setPackageLines([createEmptyPackageLine('package-line-1')]);
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
    setLegalDocument(null);
    setExistingPhotoUrl(null);
    setExistingOrderCbm(null);
    setOriginalOrderStatus(null);
    setErrors({});
    setSuccessData(null);
    setCurrentStep(1);
    setHasUserEditedForm(false);
  }, []);

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
          setDestAddressText('');
          setDestinationLocation(null);
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
      isInitialLoadDoneRef.current = true;
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

  // ─── Initial Load (Edit Mode vs Create Mode) ─────────────────────────────────
  useEffect(() => {
    let isCancelled = false;

    async function init() {
      if (isEditMode && orderId) {
        setIsLoadingOrder(true);
        setIsLoadingRoutes(true);
        setRouteError(null);
        try {
          const [routesRes, orderRes] = await Promise.all([
            getRouteOptions(),
            accessToken ? getOrderById(accessToken, orderId) : Promise.resolve(null),
          ]);

          if (isCancelled) return;

          let activeRoutes: RouteOptionResponse[] = [];
          if (routesRes.success && routesRes.data) {
            activeRoutes = routesRes.data.filter((r) => r.status?.trim().toUpperCase() === 'ACTIVE');
            setRouteOptions(activeRoutes);
          } else {
            setRouteError(routesRes.message || 'Không thể tải danh sách tuyến vận chuyển.');
          }

          if (orderRes && orderRes.success && orderRes.data) {
            const ord = orderRes.data;
            setOriginalOrderStatus(ord.status);

            // 1. Goods Info
            if (ord.itemName) setItemName(ord.itemName);
            if (ord.category) setCategory(ord.category as GoodsType);
            if (ord.tempCondition) {
              const parsedTemp = parseFloat(ord.tempCondition);
              if (!Number.isNaN(parsedTemp)) setTempCondition(parsedTemp);
            }
            if (ord.expectedWeightKg) setExpectedWeightKg(String(ord.expectedWeightKg));
            if (ord.quantity) setQuantity(String(ord.quantity));

            // 2. Packaging & Dimensions
            if (ord.packingType) {
              const types = ord.packingType.split(',').map((s) => s.trim()).filter(Boolean);
              setPackagingType(types);
            }

            if (ord.expectedCbm) {
              setExistingOrderCbm(Number(ord.expectedCbm));
            }

            const ordLength = ord.lengthCm;
            const ordWidth = ord.widthCm;
            const ordHeight = ord.heightCm;

            if (ordLength && ordWidth && ordHeight) {
              setLengthCm(String(ordLength));
              setWidthCm(String(ordWidth));
              setHeightCm(String(ordHeight));
            } else {
              setLengthCm('');
              setWidthCm('');
              setHeightCm('');
            }

            // 3. Existing Cargo Photo
            const existingPhoto =
              ord.documents?.find((d) => d.docType === 'CargoImage' || d.docType === 'ITEM_IMAGE')?.imageUrl ||
              ord.documentUrl;
            if (existingPhoto) {
              setExistingPhotoUrl(existingPhoto);
            }

            // 4. Destination Address & Recipient
            if (ord.destination?.address) {
              setDestAddressText(ord.destination.address);
              setDestinationLocation({
                placeId: ord.destination.locationId,
                address: ord.destination.address,
                latitude: ord.destination.latitude,
                longitude: ord.destination.longitude,
              });
            }
            if (ord.receiverName) {
              setReceiverName(ord.receiverName);
            }
            if (ord.receiverPhone) {
              setReceiverPhone(ord.receiverPhone);
            }

            // 5. Route & Booking Options (Schedules + Stops)
            const targetRouteId = ord.route?.routeId || (activeRoutes.length > 0 ? activeRoutes[0].routeId : '');
            const targetScheduleId = ord.schedule?.scheduleId || '';

            if (targetRouteId) {
              currentBookingRouteIdRef.current = targetRouteId;
              currentSelectedRouteIdRef.current = targetRouteId;
              setSelectedRouteId(targetRouteId);

              setIsLoadingBooking(true);
              try {
                const bookingRes = await getRouteBookingOptions(targetRouteId);
                if (!isCancelled && bookingRes.success && bookingRes.data) {
                  setBookingOptions(bookingRes.data);

                  // Match schedule
                  const matchedSchedule = bookingRes.data.availableSchedules.find(
                    (s) => s.scheduleId === targetScheduleId
                  );
                  if (matchedSchedule) {
                    setSelectedScheduleId(matchedSchedule.scheduleId);
                  } else if (bookingRes.data.availableSchedules.length > 0) {
                    setSelectedScheduleId(bookingRes.data.availableSchedules[0].scheduleId);
                  }

                  // Match stop
                  if (bookingRes.data.availableStops.length > 0) {
                    const matchedStop = bookingRes.data.availableStops.find(
                      (s) => ord.destination?.address && s.stopName && ord.destination.address.includes(s.stopName)
                    );
                    if (matchedStop) {
                      setSelectedStopId(matchedStop.stopId);
                    } else {
                      setSelectedStopId(bookingRes.data.availableStops[0].stopId);
                    }
                  }
                }
              } catch (bErr) {
                if (!isCancelled) setBookingError(getApiErrorMessage(bErr));
              } finally {
                if (!isCancelled) setIsLoadingBooking(false);
              }
            }
          } else if (orderRes && !orderRes.success) {
            showToast('error', orderRes.message || 'Không thể tải thông tin đơn hàng.', 'Lỗi tải đơn');
          }
        } catch (err) {
          if (!isCancelled) showToast('error', getApiErrorMessage(err), 'Lỗi');
        } finally {
          if (!isCancelled) {
            setIsLoadingOrder(false);
            setIsLoadingRoutes(false);
            isInitialLoadDoneRef.current = true;
          }
        }
      } else {
        // Create mode: reset form completely and fetch active routes
        resetForm();
        void fetchRoutes();
      }
    }

    void init();

    return () => {
      isCancelled = true;
    };
  }, [isEditMode, orderId, accessToken, fetchRoutes, resetForm]);

  useEffect(() => {
    if (selectedRouteId && isInitialLoadDoneRef.current) {
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

  const handleFocusField = useCallback((field: CreateOrderFieldKey) => {
    const requestId = ++scrollRequestIdRef.current;
    setTimeout(() => {
      const fieldNode = fieldRefs.current[field];
      const scrollView = scrollViewRef.current;
      const scrollNode = scrollView?.getNativeScrollRef();
      if (!fieldNode || !scrollView || !scrollNode) return;

      fieldNode.measureInWindow((_fieldX, fieldY) => {
        if (scrollRequestIdRef.current !== requestId) return;
        scrollNode.measureInWindow((_scrollX, scrollY) => {
          if (scrollRequestIdRef.current !== requestId) return;
          const targetY = scrollOffsetYRef.current + fieldY - scrollY - 30;
          console.log('[CreateOrderLayout] focusField:', field, { fieldY, scrollY, targetY, scrollOffsetY: scrollOffsetYRef.current });
          scrollView.scrollTo({ y: Math.max(targetY, 0), animated: true });
        });
      });
    }, 120);
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
      setDestinationLocation(null);
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
      receiverName: undefined,
      receiverPhone: undefined,
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
    if (isLoading || isSubmittingRef.current) return;
    Keyboard.dismiss();
    if (currentStep === 4) {
      void handleSubmit();
      return;
    }
    if (currentStep === 1 && (isLoadingRoutes || isLoadingBooking)) {
      showToast('warning', 'Vui lòng đợi hệ thống tải xong thông tin tuyến và lịch vận chuyển.', 'Đang tải dữ liệu');
      return;
    }

    const nextStepErrors = validateCreateOrderStep(
      currentStep,
      formValues,
      routeOptions,
      bookingOptions,
      isEditMode ? 'edit' : 'create'
    );
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
      isEditMode ? 'Rời khỏi trang chỉnh sửa?' : 'Rời khỏi trang tạo đơn?',
      'Thông tin bạn đã nhập sẽ không được lưu.',
      [
        { text: 'Tiếp tục nhập', style: 'cancel' },
        { text: 'Rời khỏi', style: 'destructive', onPress: onLeave },
      ]
    );
  }, [isEditMode]);

  useFocusEffect(
    useCallback(() => {
      if (!isEditMode && !hasUserEditedForm) {
        resetForm();
      }

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
    }, [confirmLeaveCreateOrder, currentStep, handleBack, hasUserEditedForm, isEditMode, isFormDirty, navigation, resetForm, router, successData])
  );

  const goToStep = (step: CreateOrderStep) => setCurrentStep(step);

  // ─── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (isSubmittingRef.current) return;
    Keyboard.dismiss();
    if (__DEV__) console.log('[CreateOrder] submit pressed');

    if (isLoadingBooking || isLoadingRoutes) {
      showToast('warning', 'Vui lòng đợi hệ thống tải xong thông tin tuyến và lịch vận chuyển.', 'Đang tải dữ liệu');
      return;
    }

    const nextErrors = validateCreateOrderForm(
      formValues,
      routeOptions,
      bookingOptions,
      isEditMode ? 'edit' : 'create'
    );
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      requestFirstErrorFocus(nextErrors);
      setCurrentStep(getFirstInvalidStep(nextErrors));
      return;
    }

    if (!accessToken) {
      showToast('error', 'Bạn cần đăng nhập lại trước khi tiếp tục.', 'Lỗi xác thực');
      return;
    }

    if (!isEditMode && !documentImage) {
      showToast('error', 'Vui lòng chọn ảnh lô hàng.', 'Thiếu ảnh');
      return;
    }

    if (!isEditMode && !legalDocument) {
      showToast('error', 'Vui lòng chọn chứng từ hàng hóa.', 'Thiếu chứng từ');
      return;
    }

    if (__DEV__) {
      console.log('[CreateOrder] payload preview:', {
        isEditMode,
        orderId,
        Schedule_ID: selectedScheduleId,
        Dropoff_Stop_ID: selectedStopId,
        Packaging_Type: packagingType.join(', '),
        PackageLineCount: packageLines.length,
        HasCargoPhoto: Boolean(documentImage?.uri),
        HasLegalDocument: Boolean(legalDocument?.uri),
      });
    }

    isSubmittingRef.current = true;
    setIsLoading(true);
    try {
      if (isEditMode && orderId) {
        const parsedLen = formValues.lengthCm ? parseCreateOrderDecimal(formValues.lengthCm) : undefined;
        const parsedWid = formValues.widthCm ? parseCreateOrderDecimal(formValues.widthCm) : undefined;
        const parsedHgt = formValues.heightCm ? parseCreateOrderDecimal(formValues.heightCm) : undefined;
        const hasValidDimensions = Boolean(
          parsedLen && parsedLen > 0 &&
          parsedWid && parsedWid > 0 &&
          parsedHgt && parsedHgt > 0
        );

        const updatePayload: UpdateOrderPayload = {
          itemName: formValues.itemName.trim(),
          category: formValues.category,
          tempCondition: formValues.tempCondition,
          expectedWeightKg: parseCreateOrderDecimal(formValues.expectedWeightKg),
          quantity: Number.parseInt(formValues.quantity, 10),
          packagingType: formValues.packagingType.join(', '),
          lengthCm: hasValidDimensions ? parsedLen : undefined,
          widthCm: hasValidDimensions ? parsedWid : undefined,
          heightCm: hasValidDimensions ? parsedHgt : undefined,
          destAddressText: formValues.destAddressText.trim(),
          receiverName: formValues.receiverName ? formValues.receiverName.trim() : undefined,
          receiverPhone: formValues.receiverPhone ? formValues.receiverPhone.trim() : undefined,
          scheduleId: formValues.scheduleId || undefined,
          dropoffStopId: formValues.dropoffStopId || undefined,
          cargoPhoto: documentImage
            ? {
                uri: documentImage.uri,
                mimeType: documentImage.mimeType || 'image/jpeg',
                fileName: documentImage.fileName || 'cargo.jpg',
              }
            : null,
          legalDocument: legalDocument
            ? {
                uri: legalDocument.uri,
                mimeType: legalDocument.mimeType || 'application/octet-stream',
                fileName: legalDocument.fileName || 'legal-document',
              }
            : null,
        };

        const response = await updateOrder(accessToken, orderId, updatePayload);
        if (!response.success) {
          throw new Error(response.message || 'Cập nhật đơn thất bại.');
        }

        const successMsg =
          originalOrderStatus?.toUpperCase() === 'NEEDS_UPDATE'
            ? 'Đã cập nhật đơn hàng thành công. Đơn đang chờ bộ phận Sales duyệt lại.'
            : 'Đã cập nhật đơn hàng thành công.';

        Alert.alert('Thành công', successMsg, [
          {
            text: 'Đồng ý',
            onPress: () => {
              allowExitRef.current = true;
              router.replace(`/(customer)/orders/${orderId}` as never);
            },
          },
        ]);
        return;
      }

      const response = await createOrder(
        accessToken,
        mapCreateOrderRequest({
          ...formValues,
          documentImage: documentImage!,
          legalDocument: legalDocument!,
        })
      );

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
      if (__DEV__) console.error('[CreateOrder] submission failed', error);

      let errorMessage = isEditMode
        ? 'Không thể cập nhật đơn hàng. Vui lòng kiểm tra lại thông tin.'
        : 'Không thể tạo đơn hàng. Vui lòng kiểm tra lại thông tin.';

      if (error instanceof ApiClientError) {
        if (error.status === 401) {
          errorMessage = 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.';
        } else if (error.status === 403) {
          errorMessage = 'Bạn không có quyền chỉnh sửa đơn hàng này.';
        } else if (error.status === 400 && error.message?.toLowerCase().includes('pending_review')) {
          errorMessage = 'Đơn hàng đã chuyển trạng thái và không thể chỉnh sửa.';
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
      showToast('error', errorMessage, isEditMode ? 'Lỗi cập nhật' : 'Lỗi tạo đơn');
    } finally {
      isSubmittingRef.current = false;
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
    if (asset.fileSize !== undefined && (asset.fileSize <= 0 || asset.fileSize > MAX_CREATE_ORDER_FILE_SIZE_BYTES)) {
      const message = 'Ảnh lô hàng phải có dung lượng từ 1 byte đến 10 MB.';
      setErrors((current) => ({ ...current, documentImage: message }));
      showToast('warning', message);
      return;
    }
    setDocumentImage({
      uri: asset.uri,
      mimeType: asset.mimeType || 'image/jpeg',
      fileName: asset.fileName || 'cargo.jpg',
      size: asset.fileSize,
    });
    setHasUserEditedForm(true);
    setErrors((current) => ({ ...current, documentImage: undefined }));
  };

  const removeDocumentImage = () => {
    setDocumentImage(null);
    setExistingPhotoUrl(null);
    setHasUserEditedForm(true);
    setErrors((current) => ({ ...current, documentImage: undefined }));
  };

  const pickLegalDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset) return;
      if (asset.size !== undefined && (asset.size <= 0 || asset.size > MAX_CREATE_ORDER_FILE_SIZE_BYTES)) {
        const message = 'Chứng từ phải có dung lượng từ 1 byte đến 10 MB.';
        setErrors((current) => ({ ...current, legalDocument: message }));
        showToast('warning', message);
        return;
      }

      setLegalDocument({
        uri: asset.uri,
        mimeType: asset.mimeType || 'application/octet-stream',
        fileName: asset.name || 'legal-document',
        size: asset.size,
      });
      setHasUserEditedForm(true);
      setErrors((current) => ({ ...current, legalDocument: undefined }));
    } catch (error) {
      if (__DEV__) console.error('[CreateOrder] legal document picker failed', error);
      showToast('error', 'Không thể mở trình chọn chứng từ. Vui lòng thử lại.');
    }
  };

  const removeLegalDocument = () => {
    setLegalDocument(null);
    setHasUserEditedForm(true);
    setErrors((current) => ({ ...current, legalDocument: undefined }));
  };

  const changePackageLine = (
    id: string,
    field: 'label' | 'capacityKg' | 'quantity',
    value: string
  ) => {
    setPackageLines((current) => current.map((line) => (
      line.id === id ? { ...line, [field]: value } : line
    )));
    setHasUserEditedForm(true);
    setErrors((current) => ({ ...current, packageLines: undefined }));
  };

  const addPackageLine = () => {
    packageLineIdRef.current += 1;
    setPackageLines((current) => [
      ...current,
      createEmptyPackageLine(`package-line-${packageLineIdRef.current}`),
    ]);
    setHasUserEditedForm(true);
    setErrors((current) => ({ ...current, packageLines: undefined }));
  };

  const removePackageLine = (id: string) => {
    setPackageLines((current) => (
      current.length > 1 ? current.filter((line) => line.id !== id) : current
    ));
    setHasUserEditedForm(true);
    setErrors((current) => ({ ...current, packageLines: undefined }));
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
    const fieldError = validateCreateOrderStep(
      fieldStep,
      formValues,
      routeOptions,
      bookingOptions,
      isEditMode ? 'edit' : 'create'
    )[field];
    setErrors((current) => ({ ...current, [field]: fieldError }));
  };

  const submitTextField = (field: CreateOrderFieldKey) => {
    if (!isEditMode && field === 'itemName') {
      Keyboard.dismiss();
      return;
    }
    const nextField = getNextInputField(field);
    const nextInput = nextField ? inputRefs.current[nextField] : null;
    if (nextInput) nextInput.focus();
    else Keyboard.dismiss();
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  if (isEditMode && isLoadingOrder) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface.page }} className="items-center justify-center p-6">
        <ActivityIndicator size="large" color={colors.brand.primary} />
        <Text style={{ color: colors.brand.primary }} className="mt-4 font-medium">
          Đang tải thông tin đơn hàng...
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.surface.page }}>
      <View
        className="px-5 pb-2 pt-4"
        onLayout={(e) => console.log('[CreateOrderLayout] progress:', e.nativeEvent.layout)}
      >
        <CreateOrderStepProgress
          currentStep={currentStep}
          totalSteps={4}
          compact={currentStep === 1}
          {...STEP_DETAILS[currentStep]}
        />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 54 : 0}
        style={{ flex: 1 }}
        onLayout={(e) => console.log('[CreateOrderLayout] KAV:', e.nativeEvent.layout)}
      >
        <ScrollView
          ref={scrollViewRef}
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          onLayout={(e) => console.log('[CreateOrderLayout] scrollViewport:', e.nativeEvent.layout)}
          onScroll={(event) => {
            scrollOffsetYRef.current = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100, gap: 20 }}
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
            destinationLocation={destinationLocation}
            receiverName={receiverName}
            receiverPhone={receiverPhone}
            errors={errors}
            isLoadingRoutes={isLoadingRoutes}
            isLoadingBooking={isLoadingBooking}
            routeError={routeError}
            bookingError={bookingError}
            registerField={registerField}
            registerInput={registerInput}
            onRetryRoutes={fetchRoutes}
            onRetryBooking={() => fetchBookingOptions(selectedRouteId)}
            onConfirmDeliveryContact={({ location, receiverName: name, receiverPhone: phone }) => {
              setHasUserEditedForm(true);
              setDestAddressText(location.address);
              setDestinationLocation(location);
              setReceiverName(name);
              setReceiverPhone(phone);
              setErrors((current) => ({
                ...current,
                destAddressText: undefined,
                receiverName: undefined,
                receiverPhone: undefined,
              }));
            }}
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
                setDestinationLocation(null);
              }
              setErrors((current) => ({ ...current, dropoffStopId: undefined, destAddressText: undefined }));
            }}
          />
        ) : null}

        {currentStep === 2 ? (
          <CargoInformationStep
            isEditMode={isEditMode}
            itemName={itemName}
            expectedWeightKg={expectedWeightKg}
            quantity={quantity}
            packageLines={packageLines}
            category={category}
            temperature={tempCondition}
            errors={errors}
            registerField={registerField}
            registerInput={registerInput}
            onChangeItemName={(value) => updateTextField('itemName', value, setItemName)}
            onChangeExpectedWeight={(value) => updateTextField('expectedWeightKg', value, setExpectedWeightKg)}
            onChangeQuantity={(value) => updateTextField('quantity', value, setQuantity)}
            onChangePackageLine={changePackageLine}
            onAddPackageLine={addPackageLine}
            onRemovePackageLine={removePackageLine}
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
            onFocusField={handleFocusField}
            onBlurField={validateFieldOnBlur}
            onSubmitField={submitTextField}
          />
        ) : null}

        {currentStep === 3 ? (
          <PackagingImageStep
            isEditMode={isEditMode}
            packagingTypes={packagingType}
            lengthCm={lengthCm}
            widthCm={widthCm}
            heightCm={heightCm}
            image={effectiveDocumentImage}
            legalDocument={legalDocument}
            existingCbm={existingOrderCbm}
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
            onPickLegalDocument={() => void pickLegalDocument()}
            onRemoveLegalDocument={removeLegalDocument}
            onFocusField={handleFocusField}
            onBlurField={validateFieldOnBlur}
            onSubmitField={submitTextField}
          />
        ) : null}

        {currentStep === 4 ? (
          <CreateOrderReviewStep
            isEditMode={isEditMode}
            values={formValues}
            selectedRoute={selectedRoute}
            selectedSchedule={selectedSchedule}
            selectedStop={selectedStop}
            onEdit={goToStep}
          />
        ) : null}
        </ScrollView>

        {!shouldHideFooter && (() => {
          let isStepValid = true;
          if (currentStep !== 4) {
            const stepErrors = validateCreateOrderStep(
              currentStep,
              formValues,
              routeOptions,
              bookingOptions,
              isEditMode ? 'edit' : 'create'
            );
            isStepValid = Object.keys(stepErrors).length === 0;
          }
          const primaryLabel = currentStep === 4 ? (isEditMode ? 'Lưu cập nhật' : 'Gửi đơn hàng') : 'Tiếp tục';
          const isPrimaryDisabled = !isStepValid || isLoading;

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
                  isPrimaryDisabled && styles.localNextButtonVisualDisabled,
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator color={isPrimaryDisabled ? colors.text.secondary : '#FFFFFF'} />
                ) : null}
                <Text
                  style={[
                    styles.localNextButtonText,
                    isPrimaryDisabled && styles.localNextButtonTextDisabled,
                  ]}
                >
                  {primaryLabel}
                </Text>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={primaryLabel}
                  accessibilityState={{ disabled: isPrimaryDisabled }}
                  disabled={isPrimaryDisabled}
                  onPress={handleContinue}
                  style={StyleSheet.absoluteFillObject}
                />
              </View>
            </View>
          );
        })()}
      </KeyboardAvoidingView>

      <CreateOrderSuccessModal
        data={successData}
        onViewOrder={() => {
          const createdOrderId = successData?.orderId;
          resetForm();
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
  if (technicalMessage.includes('package_lines') || technicalMessage.includes('capacitykg')) {
    return 'Vui lòng kiểm tra lại quy cách đóng gói.';
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
  if (technicalMessage.includes('receiver') || technicalMessage.includes('người nhận')) {
    return 'Thông tin người nhận (tên hoặc số điện thoại) không hợp lệ.';
  }
  if (technicalMessage.includes('legal') || technicalMessage.includes('document')) {
    return 'Chứng từ hàng hóa không hợp lệ.';
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
  if (technicalMessage.includes('receiver') && technicalMessage.includes('name')) return 'receiverName';
  if (technicalMessage.includes('receiver') && technicalMessage.includes('phone')) return 'receiverPhone';
  if (technicalMessage.includes('receiver') || technicalMessage.includes('người nhận')) return 'receiverName';
  if (technicalMessage.includes('item') || technicalMessage.includes('hàng hóa')) return 'itemName';
  if (technicalMessage.includes('category')) return 'category';
  if (technicalMessage.includes('temperature') || technicalMessage.includes('temp_condition')) return 'tempCondition';
  if (technicalMessage.includes('package_lines') || technicalMessage.includes('capacitykg')) return 'packageLines';
  if (technicalMessage.includes('weight')) return 'expectedWeightKg';
  if (technicalMessage.includes('quantity')) return 'quantity';
  if (technicalMessage.includes('packaging') || technicalMessage.includes('package')) return 'packagingType';
  if (technicalMessage.includes('length')) return 'lengthCm';
  if (technicalMessage.includes('width')) return 'widthCm';
  if (technicalMessage.includes('height') || technicalMessage.includes('dimension')) return 'heightCm';
  if (technicalMessage.includes('legal') || technicalMessage.includes('document')) return 'legalDocument';
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
    destAddressText: 'receiverName',
    receiverName: 'receiverPhone',
    receiverPhone: 'itemName',
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
