import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { AppButton } from '../../components/AppButton';
import { AppInfoRow } from '../../components/AppInfoRow';
import { AppInput } from '../../components/AppInput';
import { AppMessage } from '../../components/AppMessage';
import { StatusBadge } from '../../components/StatusBadge';
import { WH_COLORS, getStatusStyle, formatDateTimeVi, type MessageTone } from '../../constants/warehouseTheme';
import { getAsnSchedule, type AsnScheduleResponse } from '../../services/asnApi';
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

type StepKey = 'qc' | 'measurements' | 'discrepancy' | 'receipt' | 'putaway';

const STEPS: { key: StepKey; label: string }[] = [
  { key: 'qc', label: 'QC' },
  { key: 'measurements', label: 'Kiểm tra lại' },
  { key: 'discrepancy', label: 'Sai lệch' },
  { key: 'receipt', label: 'Phiếu nhập' },
  { key: 'putaway', label: 'Nhập kho' },
];

const todayInput = formatDateInput(new Date());

export default function WarehouseInboundScreen() {
  const token = useAuthStore((state) => state.token);
  const storedWarehouseId = useAuthStore((state) => state.warehouseId ?? state.user?.warehouseId ?? null);
  const [scheduleDate, setScheduleDate] = useState(todayInput);
  const [statusFilter, setStatusFilter] = useState('');
  const [schedule, setSchedule] = useState<AsnScheduleResponse[]>([]);
  const [selectedAsn, setSelectedAsn] = useState<AsnScheduleResponse | null>(null);
  const [manualAsnId, setManualAsnId] = useState('');
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

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
  const warehouseIdForPutaway = storedWarehouseId ?? warehouseIdFromToken ?? lpnWarehouseId;

  const loadSchedule = useCallback(async () => {
    setIsLoadingSchedule(true);
    setScheduleError(null);

    try {
      const response = await getAsnSchedule(token, {
        date: scheduleDate.trim() || undefined,
        status: statusFilter.trim() || undefined,
      });

      if (!response.success) {
        throw new Error(response.message || 'Không thể tải lịch ASN.');
      }

      setSchedule(response.data ?? []);
    } catch (error) {
      setScheduleError(getApiErrorMessage(error));
    } finally {
      setIsLoadingSchedule(false);
    }
  }, [scheduleDate, statusFilter, token]);

  useFocusEffect(
    useCallback(() => {
      loadSchedule();
    }, [loadSchedule])
  );

  const applyLpnSnapshot = (lpn: LpnDto) => {
    setLpnStatus(lpn.state || null);
    setLpnWarehouseId(lpn.warehouseId ?? null);
    setLpnHasWarehouseReceipt(hasGeneratedWarehouseReceipt(lpn));
    setLpnReceiptPdfUrl(lpn.warehouseReceiptPdfUrl ?? null);
    if (lpn.storageLocation) {
      setStorageLocation(lpn.storageLocation);
    }
  };

  const selectAsn = (asn: AsnScheduleResponse) => {
    setSelectedAsn(asn);
    setManualAsnId(asn.asnId);
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
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 36 }}>
          {/* ── Section: Lịch hàng đến ── */}
          <Section title="Lịch hàng đến">
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <AppInput label="Ngày" value={scheduleDate} onChangeText={setScheduleDate} placeholder="YYYY-MM-DD" />
                <AppInput label="Trạng thái" value={statusFilter} onChangeText={setStatusFilter} placeholder="SCHEDULED" />
              </View>
              <AppButton icon="refresh-outline" label="Làm mới lịch" onPress={loadSchedule} loading={isLoadingSchedule} />
              {scheduleError ? <AppMessage tone="error" text={scheduleError} /> : null}
              {!isLoadingSchedule && schedule.length === 0 ? (
                <AppMessage
                  tone="neutral"
                  text="Chưa có ASN nào cho ngày/trạng thái này. Bạn có thể nhập mã ASN thủ công bên dưới."
                />
              ) : null}
              {schedule.map((asn) => (
                <Pressable
                  key={asn.asnId}
                  onPress={() => selectAsn(asn)}
                  style={{
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: WH_COLORS.cardBorder,
                    backgroundColor: WH_COLORS.cardBg,
                    padding: 16,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: WH_COLORS.textPrimary }}>{asn.asnCode}</Text>
                      <Text style={{ marginTop: 4, fontSize: 12, color: WH_COLORS.textSecondary }}>
                        {asn.customerName || asn.customerEmail || 'Khách hàng chưa rõ'}
                      </Text>
                    </View>
                    <StatusBadge status={asn.status} showVietnameseLabel />
                  </View>
                  <AppInfoRow label="Tracking" value={asn.trackingCode || 'N/A'} />
                  <AppInfoRow label="Đơn hàng" value={asn.orderId} />
                  <AppInfoRow label="Tuyến" value={asn.routeCode || asn.routeId || 'N/A'} />
                  <AppInfoRow label="Giờ giao kho" value={formatDateTimeVi(asn.requestedDropoffTime)} />
                  <AppInfoRow label="Cut-off" value={asn.cutOffTime || 'N/A'} />
                  <AppInfoRow label="QR" value={asn.qrCodeValue || 'N/A'} />
                </Pressable>
              ))}
              <View
                style={{
                  borderRadius: 14,
                  borderWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: WH_COLORS.inputBorder,
                  backgroundColor: WH_COLORS.cardBg,
                  padding: 16,
                }}
              >
                <AppInput label="Mã ASN thủ công" value={manualAsnId} onChangeText={setManualAsnId} placeholder="Nhập mã ASN (GUID)" />
                <View style={{ marginTop: 12 }}>
                  <AppButton
                    icon="keypad-outline"
                    label="Sử dụng ASN thủ công"
                    variant="secondary"
                    onPress={() => {
                      setSelectedAsn(null);
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

          {/* ── Section: Xử lý nhập kho ── */}
          <Section title="Xử lý nhập kho" subtitle={activeAsnId ? `ASN: ${activeAsnId}` : 'Chọn ASN hoặc nhập mã ASN thủ công'}>
            {/* Step tabs */}
            <View style={{ marginBottom: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {STEPS.map((step) => {
                const isActive = activeStep === step.key;
                return (
                  <Pressable
                    key={step.key}
                    onPress={() => setActiveStep(step.key)}
                    style={{
                      borderRadius: 10,
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      backgroundColor: isActive ? WH_COLORS.primary : WH_COLORS.primaryLight,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '700',
                        color: isActive ? '#FFFFFF' : WH_COLORS.primary,
                      }}
                    >
                      {step.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {actionMessage ? <AppMessage tone={messageTone} text={actionMessage} /> : null}
            {isSubmitting ? <ActivityIndicator style={{ marginVertical: 12 }} color={WH_COLORS.primary} /> : null}

            {/* ── QC tab ── */}
            {activeStep === 'qc' ? (
              <View style={{ gap: 12 }}>
                <AppInput label="Mã ASN" value={manualAsnId} onChangeText={setManualAsnId} placeholder="Mã ASN" />
                <MeasurementFields
                  weight={qcWeight} setWeight={setQcWeight}
                  length={qcLength} setLength={setQcLength}
                  width={qcWidth} setWidth={setQcWidth}
                  height={qcHeight} setHeight={setQcHeight}
                  temperature={qcTemperature} setTemperature={setQcTemperature}
                />
                <EvidencePicker images={qcEvidence} onPick={() => pickEvidenceImages('qc')} onClear={() => setQcEvidence([])} />
                <AppButton icon="checkmark-circle-outline" label="Gửi kết quả QC" onPress={handleSubmitQc} loading={isSubmitting} />
                {qcResult ? <ResultBox title="Kết quả QC" result={qcResult} /> : null}
              </View>
            ) : null}

            {/* ── Re-check tab ── */}
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

            {/* ── Discrepancy tab ── */}
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

            {/* ── Receipt tab ── */}
            {activeStep === 'receipt' ? (
              <View style={{ gap: 12 }}>
                {currentLpnState === 'IN_STOCK' ? (
                  <AppMessage tone="success" text="LPN này đã nhập kho, không thể tạo phiếu nhập lại." />
                ) : null}
                {currentLpnState !== 'IN_STOCK' && hasReceiptForCurrentLpn ? (
                  <AppMessage tone="success" text="LPN đã có phiếu nhập kho. Có thể chuyển sang bước nhập vị trí kho." />
                ) : null}
                <AppInput label="Mã ASN" value={manualAsnId} onChangeText={setManualAsnId} placeholder="Mã ASN" />
                <AppInput label="Người giao hàng" value={delivererName} onChangeText={setDelivererName} placeholder="Tên tài xế hoặc khách hàng" />
                <AppInput label="Biển số xe" value={vehiclePlate} onChangeText={setVehiclePlate} placeholder="Không bắt buộc" />
                <AppInput label="Ghi chú" value={receiptNote} onChangeText={setReceiptNote} placeholder="Không bắt buộc" multiline />
                <AppButton
                  icon="document-text-outline"
                  label="Tạo phiếu nhập kho"
                  onPress={handleGenerateReceipt}
                  loading={isSubmitting}
                  disabled={!canGenerateReceipt}
                />
                <AppButton
                  icon="open-outline"
                  label="Mở phiếu nhập PDF"
                  onPress={openReceiptPdf}
                  variant="secondary"
                  disabled={!hasReceiptForCurrentLpn && !receiptResult?.pdfUrl}
                />
                {receiptResult ? <AppMessage tone={receiptResult.success ? 'success' : 'error'} text={receiptResult.message} /> : null}
              </View>
            ) : null}

            {/* ── Putaway tab ── */}
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
                    <Text style={{ fontSize: 16, fontWeight: '700', color: WH_COLORS.textPrimary }}>Nhập vị trí kho</Text>
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

/* ── Inline sub-components (only used in this screen) ── */

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
  const temperatureKeyboardType = Platform.OS === 'ios' ? 'numbers-and-punctuation' as const : 'numeric' as const;

  return (
    <View style={{ gap: 12 }}>
      <AppInput label="Cân nặng thực tế (kg)" value={weight} onChangeText={setWeight} placeholder="120" keyboardType="numeric" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <AppInput label="Dài (cm)" value={length} onChangeText={setLength} placeholder="80" keyboardType="numeric" />
        <AppInput label="Rộng (cm)" value={width} onChangeText={setWidth} placeholder="60" keyboardType="numeric" />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <AppInput label="Cao (cm)" value={height} onChangeText={setHeight} placeholder="50" keyboardType="numeric" />
        <AppInput label="Nhiệt độ (°C)" value={temperature} onChangeText={setTemperature} placeholder="-6" keyboardType={temperatureKeyboardType} />
      </View>
    </View>
  );
}

function EvidencePicker({ images, onPick, onClear }: { images: EvidenceImage[]; onPick: () => void; onClear: () => void }) {
  return (
    <View
      style={{
        borderRadius: 14,
        borderWidth: 1,
        borderColor: WH_COLORS.cardBorder,
        backgroundColor: WH_COLORS.cardBg,
        padding: 14,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: WH_COLORS.textPrimary }}>Ảnh bằng chứng</Text>
        <Text style={{ fontSize: 12, fontWeight: '600', color: WH_COLORS.textSecondary }}>
          {images.length} đã chọn
        </Text>
      </View>
      <View style={{ marginTop: 12, flexDirection: 'row', gap: 8 }}>
        <AppButton icon="image-outline" label="Thêm ảnh" onPress={onPick} compact variant="secondary" />
        <AppButton icon="trash-outline" label="Xoá" onPress={onClear} compact variant="secondary" />
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
        backgroundColor: WH_COLORS.cardBg,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: '700', color: WH_COLORS.textPrimary }}>{title}</Text>
      {subtitle ? (
        <Text style={{ marginTop: 4, fontSize: 12, fontWeight: '500', color: WH_COLORS.textSecondary }}>{subtitle}</Text>
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
        borderColor: WH_COLORS.cardBorder,
        backgroundColor: WH_COLORS.primaryLight,
        padding: 14,
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: '700', color: WH_COLORS.textPrimary }}>{title}</Text>
      <AppInfoRow label="Thông báo" value={result.message} />
      <AppInfoRow label="Mã LPN" value={result.lpnCode || result.lpnId || 'N/A'} />
      <AppInfoRow label="Phiếu nhập" value={result.receiptId || 'N/A'} />
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 }}>
        <Text style={{ width: 90, fontSize: 12, fontWeight: '700', color: WH_COLORS.textSecondary }}>Trạng thái</Text>
        {result.state ? <StatusBadge status={result.state} showVietnameseLabel /> : <Text style={{ fontSize: 12, color: WH_COLORS.textPrimary }}>N/A</Text>}
      </View>
      <AppInfoRow label="Chênh lệch" value={`${result.diffPercent}%`} />
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
