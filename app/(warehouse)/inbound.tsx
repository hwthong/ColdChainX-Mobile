import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../constants/colors';
import { AppButton } from '../../components/AppButton';
import { AppInfoRow } from '../../components/AppInfoRow';
import { AppInput } from '../../components/AppInput';
import { AppMessage } from '../../components/AppMessage';
import { StatusBadge } from '../../components/StatusBadge';
import { InboundAsnCard } from '../../components/warehouse/InboundAsnCard';
import {
  InboundWorkflowStepper,
  type StepKey,
  type WorkflowStepConfig,
} from '../../components/warehouse/InboundWorkflowStepper';
import { WH_COLORS, getStatusStyle, formatDateTimeVi, type MessageTone } from '../../constants/warehouseTheme';
import {
  getAsnSchedule,
  getInboundAsns,
  type AsnScheduleResponse,
  type InboundScheduleResponse,
} from '../../services/asnApi';
import { getApiErrorMessage } from '../../services/apiClient';
import { getDiscrepancyPdf } from '../../services/discrepancyApi';
import {
  generateInboundReceipt,
  getInboundReceiptPdf,
  putaway,
  reEvaluateInboundQc,
  submitInboundQc,
  type EvidenceImage,
  type GenerateInboundReceiptResponse,
  type InboundQcResponse,
  type PutawayResponse,
} from '../../services/inboundApi';
import { getInventoryLpnById, hasGeneratedWarehouseReceipt, type LpnDto } from '../../services/inventoryApi';
import { getWarehouseIdFromToken } from '../../services/jwt';
import { useAuthStore } from '../../store/useAuthStore';

const STATUS_CHIPS = [
  { key: '', label: 'Tất cả' },
  { key: 'SCHEDULED', label: 'Đã đặt lịch' },
  { key: 'ARRIVED', label: 'Hàng đã đến' },
  { key: 'QC_PASSED', label: 'QC đạt' },
  { key: 'RECEIVING', label: 'Đang nhận' },
  { key: 'DISCREPANCY_HOLD', label: 'Sai lệch' },
  { key: 'IN_STOCK', label: 'Đã nhập kho' },
];

type ScheduleSource = 'LOADING' | 'PRIMARY' | 'FALLBACK' | 'ERROR';

const todayInput = formatDateInput(new Date());

export default function WarehouseInboundScreen() {
  const token = useAuthStore((state) => state.token);
  const storedWarehouseId = useAuthStore((state) => state.warehouseId ?? state.user?.warehouseId ?? null);
  const [searchQuery, setSearchQuery] = useState('');
  const [scheduleDate, setScheduleDate] = useState(todayInput);
  const [statusFilter, setStatusFilter] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [schedule, setSchedule] = useState<InboundScheduleResponse[]>([]);
  const [selectedAsn, setSelectedAsn] = useState<InboundScheduleResponse | null>(null);
  const [manualAsnId, setManualAsnId] = useState('');
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleSource, setScheduleSource] = useState<ScheduleSource>('LOADING');
  const scheduleRequestId = useRef(0);

  const [activeStep, setActiveStep] = useState<StepKey>('qc');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [qcWeight, setQcWeight] = useState('');
  const [qcLength, setQcLength] = useState('');
  const [qcWidth, setQcWidth] = useState('');
  const [qcHeight, setQcHeight] = useState('');
  const [qcTemperature, setQcTemperature] = useState('');
  const [qcEvidence, setQcEvidence] = useState<EvidenceImage[]>([]);
  const [qcResult, setQcResult] = useState<InboundQcResponse | null>(null);

  const [lpnId, setLpnId] = useState('');
  const [receiptId, setReceiptId] = useState('');
  const [recheckWeight, setRecheckWeight] = useState('');
  const [recheckLength, setRecheckLength] = useState('');
  const [recheckWidth, setRecheckWidth] = useState('');
  const [recheckHeight, setRecheckHeight] = useState('');
  const [recheckTemperature, setRecheckTemperature] = useState('');
  const [recheckEvidence, setRecheckEvidence] = useState<EvidenceImage[]>([]);
  const [recheckResult, setRecheckResult] = useState<InboundQcResponse | null>(null);
  const [lpnStatus, setLpnStatus] = useState<string | null>(null);
  const [lpnWarehouseId, setLpnWarehouseId] = useState<string | null>(null);
  const [lpnHasWarehouseReceipt, setLpnHasWarehouseReceipt] = useState(false);
  const [lpnReceiptPdfUrl, setLpnReceiptPdfUrl] = useState<string | null>(null);

  const [delivererName, setDelivererName] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [receiptNote, setReceiptNote] = useState('');
  const [receiptResult, setReceiptResult] = useState<GenerateInboundReceiptResponse | null>(null);

  const [storageLocation, setStorageLocation] = useState('');
  const [putawayResult, setPutawayResult] = useState<PutawayResponse | null>(null);

  const activeAsnId = useMemo(() => selectedAsn?.asnId ?? manualAsnId.trim(), [manualAsnId, selectedAsn]);
  const latestInboundResult = recheckResult ?? qcResult;
  const latestResultForCurrentLpn =
    latestInboundResult?.lpnId && latestInboundResult.lpnId === lpnId.trim() ? latestInboundResult : null;
  const currentLpnState = lpnStatus ?? latestResultForCurrentLpn?.state ?? null;
  const hasReceiptForCurrentLpn =
    lpnHasWarehouseReceipt || Boolean(lpnReceiptPdfUrl?.trim() || receiptResult?.success || receiptResult?.pdfUrl);
  const canPutaway = currentLpnState === 'RECEIVING' && hasReceiptForCurrentLpn;
  const canGenerateReceipt = (!currentLpnState || currentLpnState === 'RECEIVING') && !hasReceiptForCurrentLpn;
  const warehouseIdFromToken = useMemo(() => (token ? getWarehouseIdFromToken(token) : null), [token]);
  const warehouseIdForInbound = storedWarehouseId ?? warehouseIdFromToken;
  const warehouseIdForPutaway = storedWarehouseId ?? warehouseIdFromToken ?? lpnWarehouseId;

  const workflowStepsConfig: WorkflowStepConfig[] = useMemo(() => {
    const isQcCompleted = Boolean(qcResult?.success || recheckResult?.success || currentLpnState === 'RECEIVING' || currentLpnState === 'IN_STOCK');
    const isRetestAvailable = Boolean(qcResult || lpnId.trim());
    const isDiscrepancyAvailable = Boolean(currentLpnState === 'DISCREPANCY_HOLD' || latestInboundResult?.state === 'DISCREPANCY_HOLD');
    const isReceiptCompleted = Boolean(hasReceiptForCurrentLpn);
    const isReceiptAvailable = Boolean(canGenerateReceipt || currentLpnState === 'RECEIVING');
    const isPutawayCompleted = Boolean(currentLpnState === 'IN_STOCK');
    const isPutawayAvailable = Boolean(canPutaway || currentLpnState === 'RECEIVING');

    return [
      {
        key: 'qc',
        label: 'QC',
        stepNumber: 1,
        state: activeStep === 'qc' ? 'ACTIVE' : isQcCompleted ? 'COMPLETED' : 'AVAILABLE',
      },
      {
        key: 'measurements',
        label: 'Kiểm tra',
        stepNumber: 2,
        state: activeStep === 'measurements' ? 'ACTIVE' : recheckResult?.success ? 'COMPLETED' : isRetestAvailable ? 'AVAILABLE' : 'LOCKED',
      },
      {
        key: 'discrepancy',
        label: 'Sai lệch',
        stepNumber: 3,
        state: activeStep === 'discrepancy' ? 'ACTIVE' : isDiscrepancyAvailable ? 'AVAILABLE' : 'LOCKED',
      },
      {
        key: 'receipt',
        label: 'Phiếu nhập',
        stepNumber: 4,
        state: activeStep === 'receipt' ? 'ACTIVE' : isReceiptCompleted ? 'COMPLETED' : isReceiptAvailable ? 'AVAILABLE' : 'LOCKED',
      },
      {
        key: 'putaway',
        label: 'Nhập kho',
        stepNumber: 5,
        state: activeStep === 'putaway' ? 'ACTIVE' : isPutawayCompleted ? 'COMPLETED' : isPutawayAvailable ? 'AVAILABLE' : 'LOCKED',
      },
    ];
  }, [activeStep, canGenerateReceipt, canPutaway, currentLpnState, hasReceiptForCurrentLpn, latestInboundResult?.state, lpnId, qcResult, recheckResult]);

  const loadSchedule = useCallback(async () => {
    const requestId = ++scheduleRequestId.current;
    const isLatestRequest = () => requestId === scheduleRequestId.current;

    setIsLoadingSchedule(true);
    setScheduleError(null);
    setScheduleSource('LOADING');

    if (!token) {
      setSchedule([]);
      setScheduleSource('ERROR');
      setScheduleError('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
      setIsLoadingSchedule(false);
      return;
    }

    const warehouseId = warehouseIdForInbound?.trim();
    if (!warehouseId) {
      setSchedule([]);
      setScheduleSource('ERROR');
      setScheduleError('Tài khoản chưa được gán kho. Vui lòng liên hệ quản trị viên.');
      setIsLoadingSchedule(false);
      return;
    }

    const selectedDate = scheduleDate.trim();
    let primaryError: unknown = null;
    let fallbackError: unknown = null;

    try {
      try {
        const response = await getInboundAsns(token, {
          dateFrom: selectedDate || undefined,
          dateTo: selectedDate || undefined,
          status: statusFilter.trim() || undefined,
          searchQuery: searchQuery.trim() || undefined,
          warehouseId,
          pageNumber: 1,
          pageSize: 50,
        });

        if (response.success && Array.isArray(response.data?.data)) {
          if (isLatestRequest()) {
            setSchedule(response.data.data);
            setScheduleSource('PRIMARY');
          }
          return;
        }

        primaryError = new Error(response.message || 'Nguồn ASN chính trả về dữ liệu không hợp lệ.');
      } catch (error) {
        primaryError = error;
      }

      try {
        const fallbackResponse = await getAsnSchedule(token, {
          date: selectedDate || undefined,
          status: statusFilter.trim() || undefined,
          warehouseId,
        });

        if (fallbackResponse.success && Array.isArray(fallbackResponse.data)) {
          const mapped: InboundScheduleResponse[] = fallbackResponse.data.map((item) => ({
            asnId: item.asnId,
            asnCode: item.asnCode,
            orderId: item.orderId,
            trackingCode: item.trackingCode,
            itemName: item.itemName,
            customerName: item.customerName || item.customerEmail,
            requestedDropoffTime: item.requestedDropoffTime,
            status: item.status,
            qrCodeValue: item.qrCodeValue,
            warehouseId: item.warehouseId,
          }));

          if (isLatestRequest()) {
            setSchedule(mapped);
            setScheduleSource('FALLBACK');
          }
          return;
        }

        fallbackError = new Error(fallbackResponse.message || 'Nguồn ASN dự phòng trả về dữ liệu không hợp lệ.');
      } catch (error) {
        fallbackError = error;
      }

      if (isLatestRequest()) {
        setSchedule([]);
        setScheduleSource('ERROR');
        setScheduleError(buildScheduleLoadError(primaryError, fallbackError));
      }
    } finally {
      if (isLatestRequest()) {
        setIsLoadingSchedule(false);
      }
    }
  }, [scheduleDate, searchQuery, statusFilter, token, warehouseIdForInbound]);

  useFocusEffect(
    useCallback(() => {
      loadSchedule();

      return () => {
        scheduleRequestId.current += 1;
      };
    }, [loadSchedule])
  );

  const filteredSchedule = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return schedule;
    return schedule.filter((asn) => {
      const codeMatch = asn.asnCode?.toLowerCase().includes(query);
      const trackingMatch = asn.trackingCode?.toLowerCase().includes(query);
      const itemMatch = asn.itemName?.toLowerCase().includes(query);
      return codeMatch || trackingMatch || itemMatch;
    });
  }, [schedule, searchQuery]);

  const handleDateChange = (event: DateTimePickerEvent, date?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (date) {
      setScheduleDate(formatDateInput(date));
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
    setScheduleDate(todayInput);
  };

  const applyLpnSnapshot = (lpn: LpnDto) => {
    setLpnStatus(lpn.state || null);
    setLpnWarehouseId(lpn.warehouseId ?? null);
    setLpnHasWarehouseReceipt(hasGeneratedWarehouseReceipt(lpn));
    setLpnReceiptPdfUrl(lpn.warehouseReceiptPdfUrl ?? null);
    if (lpn.storageLocation) {
      setStorageLocation(lpn.storageLocation);
    }
  };

  const resetQcWorkflow = () => {
    setQcWeight('');
    setQcLength('');
    setQcWidth('');
    setQcHeight('');
    setQcTemperature('');
    setQcEvidence([]);
    setQcResult(null);
    setRecheckWeight('');
    setRecheckLength('');
    setRecheckWidth('');
    setRecheckHeight('');
    setRecheckTemperature('');
    setRecheckEvidence([]);
    setRecheckResult(null);
    setLpnId('');
    setReceiptId('');
  };

  const selectAsn = (asn: InboundScheduleResponse) => {
    setSelectedAsn(asn);
    setManualAsnId(asn.asnId);
    resetQcWorkflow();
    setLpnStatus(null);
    setLpnWarehouseId(null);
    setLpnHasWarehouseReceipt(false);
    setLpnReceiptPdfUrl(null);
    setReceiptResult(null);
    setPutawayResult(null);
    setActiveStep('qc');
    setActionMessage(`Đã chọn ${asn.asnCode}.`);
  };

  const updateLpnId = (value: string) => {
    setLpnId(value);
    setRecheckWeight('');
    setRecheckLength('');
    setRecheckWidth('');
    setRecheckHeight('');
    setRecheckTemperature('');
    setRecheckEvidence([]);
    setRecheckResult(null);
    setLpnStatus(null);
    setLpnWarehouseId(null);
    setLpnHasWarehouseReceipt(false);
    setLpnReceiptPdfUrl(null);
    setReceiptResult(null);
    setPutawayResult(null);
  };

  const handleSubmitQc = async () => {
    try {
      requireToken(token);
      requireGuid(activeAsnId, 'Mã ASN');
      setIsSubmitting(true);
      setActionMessage(null);

      const response = await submitInboundQc(token, {
        asnId: activeAsnId,
        actualWeightKg: parseRequiredDecimal(qcWeight, 'Cân nặng thực tế'),
        lengthCm: parseRequiredDecimal(qcLength, 'Chiều dài'),
        widthCm: parseRequiredDecimal(qcWidth, 'Chiều rộng'),
        heightCm: parseRequiredDecimal(qcHeight, 'Chiều cao'),
        temperature: parseOptionalDecimal(qcTemperature, 'Nhiệt độ'),
        evidenceImages: qcEvidence,
      });

      setQcResult(response);
      setRecheckResult(null);
      if (response.lpnId) setLpnId(response.lpnId);
      if (response.receiptId) setReceiptId(response.receiptId);
      setLpnStatus(response.state ?? null);
      setLpnHasWarehouseReceipt(false);
      setLpnReceiptPdfUrl(null);
      setReceiptResult(null);
      setPutawayResult(null);
      setActionMessage(response.message);
      setActiveStep(response.state === 'DISCREPANCY_HOLD' ? 'measurements' : 'receipt');
    } catch (error) {
      setActionMessage(getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReEvaluate = async () => {
    try {
      requireToken(token);
      requireGuid(lpnId.trim(), 'Mã LPN');
      setIsSubmitting(true);
      setActionMessage(null);

      const response = await reEvaluateInboundQc(token, {
        lpnId: lpnId.trim(),
        actualWeightKg: parseRequiredDecimal(recheckWeight, 'Cân nặng thực tế'),
        lengthCm: parseRequiredDecimal(recheckLength, 'Chiều dài'),
        widthCm: parseRequiredDecimal(recheckWidth, 'Chiều rộng'),
        heightCm: parseRequiredDecimal(recheckHeight, 'Chiều cao'),
        temperature: parseOptionalDecimal(recheckTemperature, 'Nhiệt độ'),
        evidenceImages: recheckEvidence,
      });

      setRecheckResult(response);
      if (response.lpnId) setLpnId(response.lpnId);
      setLpnStatus(response.state ?? null);
      setLpnHasWarehouseReceipt(response.state === 'RECEIVING' && Boolean(response.pdfUrl));
      setLpnReceiptPdfUrl(response.state === 'RECEIVING' ? response.pdfUrl ?? null : null);
      setReceiptResult(null);
      setPutawayResult(null);
      setActionMessage(response.message);
      setActiveStep(response.state === 'DISCREPANCY_HOLD' ? 'discrepancy' : 'receipt');
    } catch (error) {
      setActionMessage(getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const refreshLpnStatus = async () => {
    try {
      requireToken(token);
      requireGuid(lpnId.trim(), 'Mã LPN');
      setIsSubmitting(true);
      setActionMessage(null);

      const lpn = await getInventoryLpnById(token, lpnId.trim());
      applyLpnSnapshot(lpn);

      if (lpn.state === 'RECEIVING') {
        setActionMessage(
          hasGeneratedWarehouseReceipt(lpn)
            ? 'Trạng thái LPN: RECEIVING. Đã có phiếu nhập, có thể nhập vị trí kho.'
            : 'LPN đang chờ tạo phiếu nhập kho. Vui lòng tạo phiếu nhập trước khi nhập vị trí kho.'
        );
        setActiveStep('putaway');
      } else if (lpn.state === 'RETURN_PENDING') {
        setActionMessage('Lô hàng đang chờ trả hàng, không thể nhập kho.');
        setActiveStep('putaway');
      } else if (lpn.state === 'IN_STOCK') {
        setActionMessage('Lô hàng đã được nhập kho.');
        setActiveStep('putaway');
      } else {
        const stateLabel = getStatusStyle(lpn.state || '').label;
        setActionMessage(`Trạng thái LPN: ${stateLabel}. Sales/Admin cần xử lý sai lệch trước khi nhập kho.`);
      }
    } catch (error) {
      setActionMessage(getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateReceipt = async () => {
    try {
      requireToken(token);
      requireGuid(activeAsnId, 'Mã ASN');
      if (!delivererName.trim()) {
        throw new Error('Vui lòng nhập tên người giao hàng.');
      }
      setIsSubmitting(true);
      setActionMessage(null);

      const currentLpnId = lpnId.trim();
      let latestStateForReceipt = currentLpnState;
      if (currentLpnId) {
        const latestLpn = await getInventoryLpnById(token, currentLpnId);
        applyLpnSnapshot(latestLpn);
        latestStateForReceipt = latestLpn.state;

        if (latestLpn.state === 'IN_STOCK') {
          throw new Error('LPN này đã nhập kho, không thể tạo phiếu nhập lại.');
        }

        if (hasGeneratedWarehouseReceipt(latestLpn)) {
          throw new Error('LPN đã có phiếu nhập kho, không thể tạo lại.');
        }

        if (latestLpn.state && latestLpn.state !== 'RECEIVING') {
          throw new Error(`Không thể tạo phiếu nhập khi LPN đang ở trạng thái ${getStatusStyle(latestLpn.state).label}.`);
        }
      }

      const response = await generateInboundReceipt(token, {
        asnId: activeAsnId,
        delivererName: delivererName.trim(),
        vehiclePlate: vehiclePlate.trim() || null,
        note: receiptNote.trim() || null,
      });

      setReceiptResult(response);
      if (response.receiptId) setReceiptId(response.receiptId);
      if (response.success) {
        setLpnHasWarehouseReceipt(true);
        setLpnReceiptPdfUrl(response.pdfUrl ?? null);
      }
      setActionMessage(response.message);
      if (response.success && latestStateForReceipt === 'RECEIVING') {
        setActiveStep('putaway');
      }
    } catch (error) {
      setActionMessage(getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePutaway = async () => {
    try {
      requireToken(token);
      const currentLpnId = lpnId.trim();
      requireGuid(currentLpnId, 'Mã LPN');
      if (!storageLocation.trim()) {
        throw new Error('Vui lòng nhập vị trí lưu kho.');
      }
      setIsSubmitting(true);
      setActionMessage(null);

      const latestLpn = await getInventoryLpnById(token, currentLpnId);
      applyLpnSnapshot(latestLpn);

      if (latestLpn.state !== 'RECEIVING') {
        const stateLabel = latestLpn.state ? getStatusStyle(latestLpn.state).label : 'không xác định';
        throw new Error(
          `Chỉ có thể nhập kho khi trạng thái LPN là RECEIVING. Trạng thái hiện tại: ${stateLabel}.`
        );
      }

      if (!hasGeneratedWarehouseReceipt(latestLpn)) {
        throw new Error('LPN đang chờ tạo phiếu nhập kho. Vui lòng tạo phiếu nhập trước khi nhập vị trí kho.');
      }

      let warehouseId = warehouseIdForPutaway?.trim() ?? '';
      if (!warehouseId) {
        const lpn = await getInventoryLpnById(token, currentLpnId);
        applyLpnSnapshot(lpn);
        warehouseId = lpn.warehouseId?.trim() ?? '';
      }

      if (!warehouseId) {
        throw new Error('Không xác định được kho của tài khoản hiện tại. Vui lòng đăng nhập lại bằng tài khoản Warehouse.');
      }

      const response = await putaway(token, {
        lpnId: currentLpnId,
        warehouseId,
        storageLocation: storageLocation.trim(),
      });

      setPutawayResult(response);
      if (response.success) {
        setLpnStatus('IN_STOCK');
        setLpnWarehouseId(warehouseId);
        setActionMessage('Nhập kho thành công.');
        Alert.alert('Thành công', 'Nhập kho thành công.');

        try {
          const refreshedLpn = await getInventoryLpnById(token, currentLpnId);
          setLpnStatus(refreshedLpn.state || 'IN_STOCK');
          setLpnWarehouseId(refreshedLpn.warehouseId ?? warehouseId);
          if (refreshedLpn.storageLocation) {
            setStorageLocation(refreshedLpn.storageLocation);
          }
        } catch (refreshError) {
          console.warn('[WarehouseInbound] Putaway succeeded but LPN refresh failed', {
            message: getApiErrorMessage(refreshError),
          });
        }
      } else {
        setActionMessage(response.message);
      }
    } catch (error) {
      setActionMessage(getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const pickEvidenceImages = async (target: 'qc' | 'recheck') => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setActionMessage('Cần cấp quyền truy cập thư viện ảnh.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.75,
    });

    if (result.canceled) return;

    const images = result.assets
      .filter((asset) => asset.type !== 'video')
      .map((asset, index) => ({
        uri: asset.uri,
        mimeType: asset.mimeType || 'image/jpeg',
        fileName: asset.fileName || `evidence-${index + 1}.jpg`,
      }));

    if (target === 'qc') {
      setQcEvidence((current) => [...current, ...images]);
    } else {
      setRecheckEvidence((current) => [...current, ...images]);
    }
  };

  const openReceiptPdf = async () => {
    const url =
      receiptResult?.pdfUrl ||
      lpnReceiptPdfUrl ||
      recheckResult?.pdfUrl ||
      qcResult?.pdfUrl ||
      (hasReceiptForCurrentLpn && receiptId ? getInboundReceiptPdf(receiptId) : null);
    if (!url) {
      setActionMessage('Chưa tạo phiếu nhập kho. Vui lòng tạo phiếu nhập trước khi mở PDF.');
      return;
    }
    await WebBrowser.openBrowserAsync(encodeURI(url));
  };

  const openDiscrepancyPdf = async () => {
    if (!receiptId) {
      setActionMessage('Cần mã phiếu nhập để mở biên bản bất thường.');
      return;
    }
    await WebBrowser.openBrowserAsync(encodeURI(getDiscrepancyPdf(receiptId)));
  };

  const messageTone: MessageTone = actionMessage?.toLowerCase().includes('failed') || actionMessage?.toLowerCase().includes('error')
    ? 'error'
    : 'neutral';

  return (
    <View style={{ flex: 1, backgroundColor: WH_COLORS.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 36 }}
          refreshControl={
            <RefreshControl
              refreshing={isLoadingSchedule}
              onRefresh={loadSchedule}
              colors={[colors.brand.primary]}
              tintColor={colors.brand.primary}
            />
          }
        >
          {/* ── Section: Lịch hàng đến (Phase 3 Visual Polish) ── */}
          <Section
            title="Lịch hàng đến"
            subtitle={isLoadingSchedule ? 'Đang tải...' : `${filteredSchedule.length} lô hàng đăng ký tiếp nhận`}
          >
            <View style={{ gap: 12 }}>
              {/* ── Search Bar ── */}
              <View style={styles.searchBarContainer}>
                <Ionicons name="search-outline" size={20} color={colors.text.muted} />
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Tìm ASN, tracking hoặc tên hàng"
                  placeholderTextColor={colors.text.muted}
                  returnKeyType="search"
                />
                {searchQuery ? (
                  <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={colors.text.muted} />
                  </Pressable>
                ) : null}
              </View>

              {/* ── Date Filter & Reset Row ── */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <Pressable
                  onPress={() => setShowDatePicker(true)}
                  style={styles.dateSelectorPill}
                >
                  <Ionicons name="calendar-outline" size={16} color={colors.brand.primary} />
                  <Text style={styles.dateSelectorText}>
                    {scheduleDate === todayInput ? `Hôm nay · ${formatDisplayDate(scheduleDate)}` : formatDisplayDate(scheduleDate)}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color={colors.text.secondary} />
                </Pressable>

                <Pressable onPress={handleResetFilters} style={styles.resetButton}>
                  <Ionicons name="refresh-outline" size={14} color={colors.brand.primary} />
                  <Text style={styles.resetButtonText}>Đặt lại</Text>
                </Pressable>
              </View>

              {showDatePicker ? (
                <DateTimePicker
                  value={parseDateInput(scheduleDate)}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  onChange={handleDateChange}
                />
              ) : null}

              {/* ── Status Filter Chips (Horizontal Scroll) ── */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
              >
                {STATUS_CHIPS.map((chip) => {
                  const isActive = statusFilter === chip.key;
                  return (
                    <Pressable
                      key={chip.key || 'ALL'}
                      onPress={() => setStatusFilter(chip.key)}
                      style={[
                        styles.statusChip,
                        isActive ? styles.statusChipActive : styles.statusChipInactive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusChipText,
                          isActive ? styles.statusChipTextActive : styles.statusChipTextInactive,
                        ]}
                      >
                        {chip.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* ── Loading State (Rule 8) ── */}
              {isLoadingSchedule ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 24 }}>
                  <ActivityIndicator size="small" color={colors.brand.primary} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text.secondary }}>
                    Đang tải lịch hàng đến...
                  </Text>
                </View>
              ) : null}

              {/* ── Error State (Rule 9) ── */}
              {scheduleSource === 'ERROR' && scheduleError ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, backgroundColor: colors.status.danger.bg, borderRadius: 14, borderWidth: 1, borderColor: colors.status.danger.border, gap: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, flex: 1 }}>
                    <Ionicons name="alert-circle-outline" size={20} color={colors.status.danger.main} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.status.danger.main }}>
                        Không thể tải lịch hàng đến
                      </Text>
                      <Text style={{ marginTop: 2, fontSize: 12, color: colors.status.danger.main }}>
                        {scheduleError}
                      </Text>
                    </View>
                  </View>
                  <Pressable onPress={loadSchedule} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.status.danger.border }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.status.danger.main }}>Thử lại</Text>
                  </Pressable>
                </View>
              ) : null}

              {/* ── Empty States (Rule 7) ── */}
              {!isLoadingSchedule && scheduleSource !== 'ERROR' && !scheduleError && filteredSchedule.length === 0 ? (
                searchQuery || statusFilter ? (
                  <View style={{ alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10, backgroundColor: colors.surface.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border.default }}>
                    <Ionicons name="search-outline" size={36} color={colors.text.muted} />
                    <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text.primary, textAlign: 'center' }}>Không tìm thấy lô hàng</Text>
                    <Text style={{ fontSize: 13, color: colors.text.secondary, textAlign: 'center', lineHeight: 18 }}>Thử thay đổi ngày, trạng thái hoặc từ khóa tìm kiếm.</Text>
                    <Pressable onPress={handleResetFilters} style={{ marginTop: 4, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.brand.primarySoft }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.brand.primary }}>Đặt lại bộ lọc</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={{ alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10, backgroundColor: colors.surface.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border.default }}>
                    <Ionicons name="calendar-outline" size={36} color={colors.text.muted} />
                    <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text.primary, textAlign: 'center' }}>Chưa có lịch hàng đến</Text>
                    <Text style={{ fontSize: 13, color: colors.text.secondary, textAlign: 'center', lineHeight: 18 }}>Các lô hàng được lên lịch tiếp nhận sẽ xuất hiện tại đây.</Text>
                  </View>
                )
              ) : null}

              {/* ── ASN Cards List ── */}
              {!isLoadingSchedule && scheduleSource !== 'ERROR' &&
                filteredSchedule.map((asn) => (
                  <InboundAsnCard
                    key={asn.asnId}
                    asn={asn}
                    isSelected={selectedAsn?.asnId === asn.asnId}
                    onSelect={selectAsn}
                  />
                ))}

              {/* ── Manual ASN Input Box (De-emphasized Fallback) ── */}
              <View
                style={{
                  borderRadius: 14,
                  borderWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: colors.border.default,
                  backgroundColor: colors.surface.card,
                  padding: 14,
                  marginTop: 4,
                }}
              >
                <AppInput label="Mã ASN thủ công" value={manualAsnId} onChangeText={setManualAsnId} placeholder="Nhập mã ASN (GUID)" />
                <View style={{ marginTop: 10 }}>
                  <AppButton
                    icon="keypad-outline"
                    label="Sử dụng ASN thủ công"
                    variant="secondary"
                    onPress={() => {
                      setSelectedAsn(null);
                      resetQcWorkflow();
                      setLpnStatus(null);
                      setLpnWarehouseId(null);
                      setLpnHasWarehouseReceipt(false);
                      setLpnReceiptPdfUrl(null);
                      setReceiptResult(null);
                      setPutawayResult(null);
                      setActiveStep('qc');
                      setActionMessage('Đã chọn ASN thủ công.');
                    }}
                  />
                </View>
              </View>
            </View>
          </Section>

          {/* ── Section: Xử lý nhập kho (Phase 2 Polished Workflow) ── */}
          <Section
            title="Xử lý nhập kho"
            subtitle={selectedAsn ? `Đang xử lý ${selectedAsn.asnCode}` : 'Chọn một lô hàng phía trên để bắt đầu tiếp nhận'}
          >
            {/* Selected ASN Context Summary Card (Rule 8) */}
            {selectedAsn ? (
              <View
                style={{
                  borderRadius: 14,
                  backgroundColor: colors.surface.card,
                  borderWidth: 1,
                  borderColor: colors.brand.primary,
                  padding: 14,
                  marginBottom: 14,
                  gap: 6,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text.primary, flex: 1 }} numberOfLines={1}>
                    {selectedAsn.itemName?.trim() || selectedAsn.asnCode}
                  </Text>
                  <StatusBadge status={selectedAsn.status} showVietnameseLabel />
                </View>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.brand.primary }}>
                  Mã ASN: {selectedAsn.asnCode}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 }}>
                  {selectedAsn.quantity ? (
                    <Text style={{ fontSize: 12, color: colors.text.secondary }}>{selectedAsn.quantity} kiện</Text>
                  ) : null}
                  {selectedAsn.expectedWeightKg ? (
                    <Text style={{ fontSize: 12, color: colors.text.secondary }}>{selectedAsn.expectedWeightKg} kg</Text>
                  ) : null}
                  {selectedAsn.tempCondition ? (
                    <Text style={{ fontSize: 12, color: colors.text.secondary }}>{selectedAsn.tempCondition}</Text>
                  ) : null}
                </View>
              </View>
            ) : (
              <View
                style={{
                  borderRadius: 12,
                  backgroundColor: colors.surface.muted,
                  padding: 12,
                  marginBottom: 14,
                }}
              >
                <Text style={{ fontSize: 12, color: colors.text.secondary, textAlign: 'center' }}>
                  Vui lòng chọn một lô hàng từ danh sách phía trên hoặc nhập mã ASN thủ công để bắt đầu tiếp nhận.
                </Text>
              </View>
            )}

            {/* Stepper Navigation */}
            <InboundWorkflowStepper
              steps={workflowStepsConfig}
              activeStep={activeStep}
              onStepPress={setActiveStep}
            />

            {actionMessage ? <AppMessage tone={messageTone} text={actionMessage} /> : null}
            {isSubmitting ? <ActivityIndicator style={{ marginVertical: 12 }} color={colors.brand.primary} /> : null}

            {/* ── 1. QC Tab ── */}
            {activeStep === 'qc' ? (
              <View style={{ gap: 12 }}>
                {selectedAsn ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.brand.primarySoft, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border.default }}>
                    <Text style={{ fontSize: 12, color: colors.text.secondary, fontWeight: '600' }}>Mã ASN tiếp nhận</Text>
                    <Text style={{ fontSize: 14, color: colors.text.primary, fontWeight: '700' }}>{selectedAsn.asnCode}</Text>
                  </View>
                ) : (
                  <AppInput label="Mã ASN (GUID)" value={manualAsnId} onChangeText={setManualAsnId} placeholder="Mã ASN" />
                )}

                <MeasurementFields
                  weight={qcWeight} setWeight={setQcWeight}
                  length={qcLength} setLength={setQcLength}
                  width={qcWidth} setWidth={setQcWidth}
                  height={qcHeight} setHeight={setQcHeight}
                  temperature={qcTemperature} setTemperature={setQcTemperature}
                />

                <EvidencePicker images={qcEvidence} onPick={() => pickEvidenceImages('qc')} onClear={() => setQcEvidence([])} />

                {/* Polished Primary QC CTA (Rule 14 & 15 - Diagnostic removed) */}
                <View
                  style={[
                    styles.qcSubmitVisual,
                    isSubmitting && styles.qcSubmitVisualDisabled,
                  ]}
                >
                  {isSubmitting ? (
                    <View style={styles.qcSubmitContent}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={styles.qcSubmitText}>Đang gửi kết quả...</Text>
                    </View>
                  ) : (
                    <Text style={styles.qcSubmitText}>Gửi kết quả QC</Text>
                  )}

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Gửi kết quả QC"
                    disabled={isSubmitting}
                    onPress={handleSubmitQc}
                    style={StyleSheet.absoluteFillObject}
                  />
                </View>

                {qcResult ? <ResultBox title="Kết quả QC" result={qcResult} /> : null}
              </View>
            ) : null}

            {/* ── 2. Re-check / Measurements Tab ── */}
            {activeStep === 'measurements' ? (
              <View style={{ gap: 12 }}>
                <AppInput label="Mã LPN" value={lpnId} onChangeText={updateLpnId} placeholder="Mã LPN" />
                <MeasurementFields
                  weight={recheckWeight} setWeight={setRecheckWeight}
                  length={recheckLength} setLength={setRecheckLength}
                  width={recheckWidth} setWidth={setRecheckWidth}
                  height={recheckHeight} setHeight={setRecheckHeight}
                  temperature={recheckTemperature} setTemperature={setRecheckTemperature}
                />
                <EvidencePicker images={recheckEvidence} onPick={() => pickEvidenceImages('recheck')} onClear={() => setRecheckEvidence([])} />
                <AppButton icon="calculator-outline" label="Gửi kết quả kiểm tra lại" onPress={handleReEvaluate} loading={isSubmitting} />
                {recheckResult ? <ResultBox title="Kết quả kiểm tra lại" result={recheckResult} /> : null}
              </View>
            ) : null}

            {/* ── 3. Discrepancy Tab ── */}
            {activeStep === 'discrepancy' ? (
              <View style={{ gap: 12 }}>
                <AppMessage
                  tone={currentLpnState === 'DISCREPANCY_HOLD' ? 'warning' : 'neutral'}
                  text={`Trạng thái hiện tại: ${currentLpnState ? getStatusStyle(currentLpnState).label : 'N/A'} | Chênh lệch: ${latestInboundResult?.diffPercent ?? 0}%`}
                />
                <AppMessage
                  tone="warning"
                  text="Lô hàng đang bị giữ do sai lệch. Sales/Admin cần xử lý sai lệch trước khi nhập kho."
                />
                <AppInput label="Mã LPN" value={lpnId} onChangeText={updateLpnId} placeholder="Mã LPN" />
                <AppButton icon="calculator-outline" label="Kiểm tra lại số đo" onPress={() => setActiveStep('measurements')} variant="secondary" />
                <AppButton icon="document-attach-outline" label="Mở biên bản bất thường" onPress={openDiscrepancyPdf} variant="secondary" />
                <AppButton icon="refresh-outline" label="Làm mới trạng thái LPN" onPress={refreshLpnStatus} loading={isSubmitting} variant="secondary" />
              </View>
            ) : null}

            {/* ── 4. Receipt Tab ── */}
            {activeStep === 'receipt' ? (
              <View style={{ gap: 12 }}>
                {latestResultForCurrentLpn?.state === 'RECEIVING' ? (
                  <ResultBox title="Kết quả QC hiện hành" result={latestResultForCurrentLpn} />
                ) : null}
                {currentLpnState === 'IN_STOCK' ? (
                  <AppMessage tone="success" text="LPN này đã nhập kho, không thể tạo phiếu nhập lại." />
                ) : null}
                {currentLpnState !== 'IN_STOCK' && hasReceiptForCurrentLpn ? (
                  <AppMessage tone="success" text="LPN đã có phiếu nhập kho. Có thể chuyển sang bước nhập vị trí kho." />
                ) : null}
                {selectedAsn ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.brand.primarySoft, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border.default }}>
                    <Text style={{ fontSize: 12, color: colors.text.secondary, fontWeight: '600' }}>Mã ASN</Text>
                    <Text style={{ fontSize: 14, color: colors.text.primary, fontWeight: '700' }}>{selectedAsn.asnCode}</Text>
                  </View>
                ) : (
                  <AppInput label="Mã ASN" value={manualAsnId} onChangeText={setManualAsnId} placeholder="Mã ASN" />
                )}
                <AppInput label="Người giao hàng" value={delivererName} onChangeText={setDelivererName} placeholder="Tên tài xế hoặc khách hàng" />
                <AppInput label="Biển số xe" value={vehiclePlate} onChangeText={setVehiclePlate} placeholder="Không bắt buộc" />
                <AppInput label="Ghi chú" value={receiptNote} onChangeText={setReceiptNote} placeholder="Không bắt buộc" multiline />
                <View
                  style={{
                    height: 52,
                    borderRadius: 14,
                    borderWidth: 1,
                    backgroundColor: isSubmitting || canGenerateReceipt ? colors.brand.primary : colors.brand.primarySoft,
                    borderColor: isSubmitting || canGenerateReceipt ? colors.brand.primary : colors.border.default,
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: 8,
                    overflow: 'hidden',
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700', includeFontPadding: false }}>
                        Đang tạo phiếu nhập...
                      </Text>
                    </>
                  ) : (
                    <>
                      <Ionicons
                        name="document-text-outline"
                        size={20}
                        color={canGenerateReceipt ? '#FFFFFF' : colors.text.secondary}
                      />
                      <Text
                        style={{
                          color: canGenerateReceipt ? '#FFFFFF' : colors.text.secondary,
                          fontSize: 15,
                          fontWeight: '700',
                          includeFontPadding: false,
                        }}
                      >
                        Tạo phiếu nhập kho
                      </Text>
                    </>
                  )}

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Tạo phiếu nhập kho"
                    disabled={!canGenerateReceipt || isSubmitting}
                    onPress={handleGenerateReceipt}
                    style={StyleSheet.absoluteFillObject}
                  />
                </View>
                <Pressable
                  disabled={!hasReceiptForCurrentLpn && !receiptResult?.pdfUrl}
                  onPress={openReceiptPdf}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    borderRadius: 14,
                    backgroundColor: colors.surface.card,
                    borderWidth: 1,
                    borderColor: colors.border.default,
                    opacity: (!hasReceiptForCurrentLpn && !receiptResult?.pdfUrl) ? 0.5 : 1,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Ionicons name="document-text-outline" size={20} color={colors.brand.primary} />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text.primary }}>
                      Mở phiếu nhập PDF
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
                </Pressable>
                {receiptResult ? <AppMessage tone={receiptResult.success ? 'success' : 'error'} text={receiptResult.message} /> : null}
              </View>
            ) : null}

            {/* ── 5. Putaway Tab ── */}
            {activeStep === 'putaway' ? (
              <View style={{ gap: 12 }}>
                <AppInput label="Mã LPN" value={lpnId} onChangeText={updateLpnId} placeholder="Mã LPN" />
                <AppButton icon="refresh-outline" label="Làm mới trạng thái" onPress={refreshLpnStatus} loading={isSubmitting} variant="secondary" />
                {currentLpnState === 'DISCREPANCY_HOLD' ? (
                  <AppMessage
                    tone="warning"
                    text="Lô hàng đang chờ xử lý sai lệch. Sales/Admin cần hoàn tất phụ lục trước khi nhập kho."
                  />
                ) : null}
                {currentLpnState === 'RETURN_PENDING' ? (
                  <AppMessage
                    tone="warning"
                    text="Lô hàng đang chờ trả hàng, không thể nhập kho."
                  />
                ) : null}
                {currentLpnState === 'IN_STOCK' ? (
                  <AppMessage
                    tone="success"
                    text={`Lô hàng đã được nhập kho.\nVị trí: ${storageLocation || 'N/A'}`}
                  />
                ) : null}
                {currentLpnState === 'RECEIVING' && !hasReceiptForCurrentLpn ? (
                  <AppMessage
                    tone="warning"
                    text="LPN đang chờ tạo phiếu nhập kho. Vui lòng tạo phiếu nhập trước khi nhập vị trí kho."
                  />
                ) : null}
                {!currentLpnState ? (
                  <AppMessage
                    tone="warning"
                    text="Chưa xác định trạng thái LPN. Vui lòng làm mới trạng thái trước khi nhập kho."
                  />
                ) : null}
                {currentLpnState && !canPutaway && currentLpnState !== 'RECEIVING' && !['DISCREPANCY_HOLD', 'RETURN_PENDING', 'IN_STOCK'].includes(currentLpnState) ? (
                  <AppMessage
                    tone="warning"
                    text={`Chưa thể nhập kho. Trạng thái LPN hiện tại: ${getStatusStyle(currentLpnState).label}.`}
                  />
                ) : null}
                {canPutaway ? (
                  <View style={{ gap: 12 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text.primary }}>Nhập vị trí kho</Text>
                    <AppInput label="Vị trí lưu kho" value={storageLocation} onChangeText={setStorageLocation} placeholder="A-01-01" />
                    <AppButton icon="archive-outline" label="Xác nhận nhập kho" onPress={handlePutaway} loading={isSubmitting} />
                  </View>
                ) : null}
                {currentLpnState === 'DISCREPANCY_HOLD' ? (
                  <View style={{ gap: 12 }}>
                    <AppButton icon="document-attach-outline" label="Mở biên bản bất thường" onPress={openDiscrepancyPdf} variant="secondary" />
                    <AppButton icon="calculator-outline" label="Kiểm tra lại số đo" onPress={() => setActiveStep('measurements')} variant="secondary" />
                  </View>
                ) : null}
                {putawayResult && !putawayResult.success ? <AppMessage tone="error" text={putawayResult.message} /> : null}
              </View>
            ) : null}
          </Section>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/* ── Inline sub-components (Polished for Phase 2) ── */

function MeasurementFields({
  weight, setWeight,
  length, setLength,
  width, setWidth,
  height, setHeight,
  temperature, setTemperature,
}: {
  weight: string; setWeight: (v: string) => void;
  length: string; setLength: (v: string) => void;
  width: string; setWidth: (v: string) => void;
  height: string; setHeight: (v: string) => void;
  temperature: string; setTemperature: (v: string) => void;
}) {
  const temperatureKeyboardType = Platform.OS === 'ios' ? ('numbers-and-punctuation' as const) : ('numeric' as const);

  return (
    <View style={{ gap: 12 }}>
      <AppInput label="Cân nặng thực tế (kg)" value={weight} onChangeText={setWeight} placeholder="Ví dụ: 64" keyboardType="numeric" />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <AppInput label="Dài (cm)" value={length} onChangeText={setLength} placeholder="Ví dụ: 80" keyboardType="numeric" />
        </View>
        <View style={{ flex: 1 }}>
          <AppInput label="Rộng (cm)" value={width} onChangeText={setWidth} placeholder="Ví dụ: 60" keyboardType="numeric" />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <AppInput label="Cao (cm)" value={height} onChangeText={setHeight} placeholder="Ví dụ: 50" keyboardType="numeric" />
        </View>
        <View style={{ flex: 1 }}>
          <AppInput label="Nhiệt độ (°C)" value={temperature} onChangeText={setTemperature} placeholder="Ví dụ: 4" keyboardType={temperatureKeyboardType} />
        </View>
      </View>
    </View>
  );
}

function EvidencePicker({ images, onPick, onClear }: { images: EvidenceImage[]; onPick: () => void; onClear: () => void }) {
  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border.default,
        backgroundColor: colors.surface.card,
        padding: 16,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text.primary }}>Ảnh bằng chứng</Text>
        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text.secondary }}>
          {images.length} ảnh đã chọn
        </Text>
      </View>

      {images.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {images.map((img, idx) => (
            <Image
              key={img.uri || idx}
              source={{ uri: img.uri }}
              style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: colors.surface.muted }}
            />
          ))}
        </ScrollView>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          onPress={onPick}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            height: 44,
            borderRadius: 12,
            backgroundColor: colors.brand.primarySoft,
            borderWidth: 1,
            borderColor: colors.border.default,
          }}
        >
          <Ionicons name="camera-outline" size={18} color={colors.brand.primary} />
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.brand.primary }}>
            {images.length > 0 ? 'Thêm ảnh khác' : 'Chụp / Chọn ảnh bằng chứng'}
          </Text>
        </Pressable>

        {images.length > 0 ? (
          <Pressable
            onPress={onClear}
            style={{
              paddingHorizontal: 16,
              height: 44,
              borderRadius: 12,
              backgroundColor: colors.status.danger.bg,
              borderWidth: 1,
              borderColor: colors.status.danger.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="trash-outline" size={18} color={colors.status.danger.main} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <View
      style={{
        marginBottom: 16,
        borderRadius: 16,
        backgroundColor: colors.surface.card,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border.default,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 1,
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text.primary }}>{title}</Text>
      {subtitle ? (
        <Text style={{ marginTop: 4, fontSize: 12, fontWeight: '500', color: colors.text.secondary }}>{subtitle}</Text>
      ) : null}
      <View style={{ marginTop: 16 }}>{children}</View>
    </View>
  );
}

function ResultBox({ title, result }: { title: string; result: InboundQcResponse }) {
  return (
    <View
      style={{
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border.default,
        backgroundColor: colors.surface.muted,
        padding: 14,
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text.primary }}>{title}</Text>
      <AppInfoRow label="Thông báo" value={result.message} />
      <AppInfoRow label="Mã LPN" value={result.lpnCode || result.lpnId || 'N/A'} />
      <AppInfoRow label="Phiếu nhập" value={result.receiptId || 'N/A'} />
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 }}>
        <Text style={{ width: 90, fontSize: 12, fontWeight: '700', color: colors.text.secondary }}>Trạng thái</Text>
        {result.state ? <StatusBadge status={result.state} showVietnameseLabel /> : <Text style={{ fontSize: 12, color: colors.text.primary }}>N/A</Text>}
      </View>
      <AppInfoRow label="Chênh lệch" value={`${result.diffPercent}%`} />
      <AppInfoRow
        label="Kết quả"
        value={result.state === 'RECEIVING' ? 'Đạt' : result.state === 'DISCREPANCY_HOLD' ? 'Cần xử lý sai lệch' : 'N/A'}
      />
      <AppInfoRow label="PDF" value={result.pdfUrl || 'N/A'} />
    </View>
  );
}

/* ── Utility functions (business logic unchanged) ── */

function requireToken(token: string | null): asserts token is string {
  if (!token) {
    throw new Error('Thiếu token xác thực. Vui lòng đăng nhập lại.');
  }
}

function requireGuid(value: string, label: string) {
  if (!value.trim()) {
    throw new Error(`${label} là bắt buộc.`);
  }
}

function parseRequiredDecimal(value: string, label: string) {
  const parsed = parseDecimal(value);
  if (parsed === null || parsed <= 0) {
    throw new Error(`${label} phải lớn hơn 0.`);
  }
  return parsed;
}

function parseOptionalDecimal(value: string, label: string) {
  if (!value.trim()) return null;
  const parsed = parseDecimal(value);
  if (parsed === null) {
    throw new Error(`${label} phải là một số hợp lệ.`);
  }
  return parsed;
}

function parseDecimal(value: string) {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDateInput(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

function parseDateInput(dateStr: string): Date {
  if (!dateStr) return new Date();
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function buildScheduleLoadError(primaryError: unknown, fallbackError: unknown): string {
  const primaryMessage = getApiErrorMessage(primaryError);
  const fallbackMessage = getApiErrorMessage(fallbackError);

  if (primaryMessage === fallbackMessage) {
    return primaryMessage;
  }

  return `Nguồn chính: ${primaryMessage}\nNguồn dự phòng: ${fallbackMessage}`;
}

const styles = StyleSheet.create({
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text.primary,
    paddingVertical: 0,
  },
  dateSelectorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.brand.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  dateSelectorText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  resetButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.brand.primary,
  },
  statusChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusChipActive: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primary,
  },
  statusChipInactive: {
    backgroundColor: colors.surface.card,
    borderColor: colors.border.default,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusChipTextActive: {
    color: '#FFFFFF',
  },
  statusChipTextInactive: {
    color: colors.text.secondary,
  },
  qcSubmitVisual: {
    width: '100%',
    height: 54,
    borderRadius: 15,
    backgroundColor: colors.brand.primary,
    borderWidth: 1,
    borderColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  qcSubmitVisualDisabled: {
    backgroundColor: colors.brand.primarySoft,
    borderColor: colors.border.default,
  },
  qcSubmitContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  qcSubmitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    includeFontPadding: false,
  },
  qcSubmitTextDisabled: {
    color: colors.text.secondary,
  },
});
