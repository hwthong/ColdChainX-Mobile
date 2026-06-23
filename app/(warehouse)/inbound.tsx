import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
import { getInventoryLpnById } from '../../services/inventoryApi';
import { useAuthStore } from '../../store/useAuthStore';

type StepKey = 'qc' | 'measurements' | 'discrepancy' | 'receipt' | 'putaway';

const STEPS: { key: StepKey; label: string }[] = [
  { key: 'qc', label: 'QC' },
  { key: 'measurements', label: 'Re-check' },
  { key: 'discrepancy', label: 'Discrepancy' },
  { key: 'receipt', label: 'Receipt' },
  { key: 'putaway', label: 'Putaway' },
];

const todayInput = formatDateInput(new Date());

export default function WarehouseInboundScreen() {
  const token = useAuthStore((state) => state.token);
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
  const canPutaway = currentLpnState === 'RECEIVING';

  const loadSchedule = useCallback(async () => {
    setIsLoadingSchedule(true);
    setScheduleError(null);

    try {
      const response = await getAsnSchedule(token, {
        date: scheduleDate.trim() || undefined,
        status: statusFilter.trim() || undefined,
      });

      if (!response.success) {
        throw new Error(response.message || 'Unable to load ASN schedule.');
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

  const selectAsn = (asn: AsnScheduleResponse) => {
    setSelectedAsn(asn);
    setManualAsnId(asn.asnId);
    setLpnStatus(null);
    setActiveStep('qc');
    setActionMessage(`Selected ${asn.asnCode}.`);
  };

  const updateLpnId = (value: string) => {
    setLpnId(value);
    setLpnStatus(null);
  };

  const handleSubmitQc = async () => {
    try {
      requireToken(token);
      requireGuid(activeAsnId, 'ASN ID');
      setIsSubmitting(true);
      setActionMessage(null);

      const response = await submitInboundQc(token, {
        asnId: activeAsnId,
        actualWeightKg: parseRequiredDecimal(qcWeight, 'Actual weight'),
        lengthCm: parseRequiredDecimal(qcLength, 'Length'),
        widthCm: parseRequiredDecimal(qcWidth, 'Width'),
        heightCm: parseRequiredDecimal(qcHeight, 'Height'),
        temperature: parseOptionalDecimal(qcTemperature, 'Temperature'),
        evidenceImages: qcEvidence,
      });

      setQcResult(response);
      if (response.lpnId) setLpnId(response.lpnId);
      if (response.receiptId) setReceiptId(response.receiptId);
      setLpnStatus(response.state ?? null);
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
      requireGuid(lpnId.trim(), 'LPN ID');
      setIsSubmitting(true);
      setActionMessage(null);

      const response = await reEvaluateInboundQc(token, {
        lpnId: lpnId.trim(),
        actualWeightKg: parseRequiredDecimal(recheckWeight, 'Actual weight'),
        lengthCm: parseRequiredDecimal(recheckLength, 'Length'),
        widthCm: parseRequiredDecimal(recheckWidth, 'Width'),
        heightCm: parseRequiredDecimal(recheckHeight, 'Height'),
        temperature: parseOptionalDecimal(recheckTemperature, 'Temperature'),
        evidenceImages: recheckEvidence,
      });

      setRecheckResult(response);
      if (response.lpnId) setLpnId(response.lpnId);
      setLpnStatus(response.state ?? null);
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
      requireGuid(lpnId.trim(), 'LPN ID');
      setIsSubmitting(true);
      setActionMessage(null);

      const lpn = await getInventoryLpnById(token, lpnId.trim());
      setLpnStatus(lpn.state || null);

      if (lpn.state === 'RECEIVING') {
        setActionMessage('Latest LPN state: RECEIVING. Putaway is now available.');
        setActiveStep('putaway');
      } else {
        setActionMessage(`Latest LPN state: ${lpn.state || 'N/A'}. Sales/Admin must resolve this discrepancy before putaway.`);
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
      requireGuid(activeAsnId, 'ASN ID');
      if (!delivererName.trim()) {
        throw new Error('Deliverer name is required.');
      }
      setIsSubmitting(true);
      setActionMessage(null);

      const response = await generateInboundReceipt(token, {
        asnId: activeAsnId,
        delivererName: delivererName.trim(),
        vehiclePlate: vehiclePlate.trim() || null,
        note: receiptNote.trim() || null,
      });

      setReceiptResult(response);
      if (response.receiptId) setReceiptId(response.receiptId);
      setActionMessage(response.message);
      if (response.success && canPutaway) {
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
      requireGuid(lpnId.trim(), 'LPN ID');
      if (!storageLocation.trim()) {
        throw new Error('Storage location is required.');
      }
      if (!canPutaway) {
        throw new Error(
          `Putaway is only available when LPN state is RECEIVING. Current state: ${currentLpnState || 'unknown'}. Refresh status after Sales/Admin resolves the discrepancy.`
        );
      }
      setIsSubmitting(true);
      setActionMessage(null);

      const response = await putaway(token, {
        lpnId: lpnId.trim(),
        storageLocation: storageLocation.trim(),
      });

      setPutawayResult(response);
      setActionMessage(response.message);
    } catch (error) {
      setActionMessage(getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const pickEvidenceImages = async (target: 'qc' | 'recheck') => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setActionMessage('Photo library permission is required.');
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
    const url = receiptResult?.pdfUrl || recheckResult?.pdfUrl || qcResult?.pdfUrl || (receiptId ? getInboundReceiptPdf(receiptId) : null);
    if (!url) {
      setActionMessage('Receipt PDF is not available yet.');
      return;
    }
    await WebBrowser.openBrowserAsync(encodeURI(url));
  };

  const openDiscrepancyPdf = async () => {
    if (!receiptId) {
      setActionMessage('Receipt ID is required for discrepancy PDF.');
      return;
    }
    await WebBrowser.openBrowserAsync(encodeURI(getDiscrepancyPdf(receiptId)));
  };

  return (
    <SafeAreaView className="flex-1 bg-[#EEF7F4]" edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 36 }}>
          <Section title="Inbound Schedule" subtitle="GET /api/v1/asns/schedule">
            <View className="gap-3">
              <View className="flex-row gap-2">
                <Field label="Date" value={scheduleDate} onChangeText={setScheduleDate} placeholder="YYYY-MM-DD" />
                <Field label="Status" value={statusFilter} onChangeText={setStatusFilter} placeholder="SCHEDULED" />
              </View>
              <ActionButton icon="refresh-outline" label="Refresh schedule" onPress={loadSchedule} loading={isLoadingSchedule} />
              {scheduleError ? <Message tone="error" text={scheduleError} /> : null}
              {!isLoadingSchedule && schedule.length === 0 ? (
                <Message
                  tone="neutral"
                  text="ASN module is not ready yet or no ASN is scheduled for this filter. You can enter an ASN ID manually for inbound testing."
                />
              ) : null}
              {schedule.map((asn) => (
                <Pressable key={asn.asnId} onPress={() => selectAsn(asn)} className="rounded-xl border border-[#D7E5E4] bg-white p-4">
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <Text className="text-base font-bold text-[#102A2D]">{asn.asnCode}</Text>
                      <Text className="mt-1 text-xs text-[#64748B]">{asn.customerName || asn.customerEmail || 'Unknown customer'}</Text>
                    </View>
                    <StatusPill label={asn.status} />
                  </View>
                  <InfoRow label="Tracking" value={asn.trackingCode || 'N/A'} />
                  <InfoRow label="Order" value={asn.orderId} />
                  <InfoRow label="Route" value={asn.routeCode || asn.routeId || 'N/A'} />
                  <InfoRow label="Drop-off" value={formatDateTime(asn.requestedDropoffTime)} />
                  <InfoRow label="Cut-off" value={asn.cutOffTime || 'N/A'} />
                  <InfoRow label="QR" value={asn.qrCodeValue || 'N/A'} />
                </Pressable>
              ))}
              <View className="rounded-xl border border-dashed border-[#89B8B1] bg-white p-4">
                <Field label="Manual ASN ID" value={manualAsnId} onChangeText={setManualAsnId} placeholder="Enter backend ASN GUID" />
                <ActionButton
                  icon="keypad-outline"
                  label="Use manual ASN"
                  onPress={() => {
                    setSelectedAsn(null);
                    setLpnStatus(null);
                    setActiveStep('qc');
                    setActionMessage('Manual ASN ID selected.');
                  }}
                />
              </View>
            </View>
          </Section>

          <Section title="Inbound Processing" subtitle={activeAsnId ? `ASN ${activeAsnId}` : 'Select ASN or enter manual ASN ID'}>
            <View className="mb-4 flex-row flex-wrap gap-2">
              {STEPS.map((step) => (
                <Pressable
                  key={step.key}
                  onPress={() => setActiveStep(step.key)}
                  className={[
                    'rounded-lg px-3 py-2',
                    activeStep === step.key ? 'bg-[#0F766E]' : 'bg-[#DDF5F0]',
                  ].join(' ')}
                >
                  <Text className={activeStep === step.key ? 'text-xs font-bold text-white' : 'text-xs font-bold text-[#0F766E]'}>
                    {step.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {actionMessage ? <Message tone={actionMessage.toLowerCase().includes('failed') ? 'error' : 'neutral'} text={actionMessage} /> : null}
            {isSubmitting ? <ActivityIndicator className="my-3" color="#0F766E" /> : null}

            {activeStep === 'qc' ? (
              <View className="gap-3">
                <Field label="ASN ID" value={manualAsnId} onChangeText={setManualAsnId} placeholder="AsnId" />
                <MeasurementFields
                  weight={qcWeight}
                  setWeight={setQcWeight}
                  length={qcLength}
                  setLength={setQcLength}
                  width={qcWidth}
                  setWidth={setQcWidth}
                  height={qcHeight}
                  setHeight={setQcHeight}
                  temperature={qcTemperature}
                  setTemperature={setQcTemperature}
                />
                <EvidencePicker images={qcEvidence} onPick={() => pickEvidenceImages('qc')} onClear={() => setQcEvidence([])} />
                <ActionButton icon="checkmark-circle-outline" label="Submit QC" onPress={handleSubmitQc} loading={isSubmitting} />
                {qcResult ? <ResultBox title="QC result" result={qcResult} /> : null}
              </View>
            ) : null}

            {activeStep === 'measurements' ? (
              <View className="gap-3">
                <Field label="LPN ID" value={lpnId} onChangeText={updateLpnId} placeholder="LpnId" />
                <MeasurementFields
                  weight={recheckWeight}
                  setWeight={setRecheckWeight}
                  length={recheckLength}
                  setLength={setRecheckLength}
                  width={recheckWidth}
                  setWidth={setRecheckWidth}
                  height={recheckHeight}
                  setHeight={setRecheckHeight}
                  temperature={recheckTemperature}
                  setTemperature={setRecheckTemperature}
                />
                <EvidencePicker images={recheckEvidence} onPick={() => pickEvidenceImages('recheck')} onClear={() => setRecheckEvidence([])} />
                <ActionButton icon="calculator-outline" label="Re-evaluate measurements" onPress={handleReEvaluate} loading={isSubmitting} />
                {recheckResult ? <ResultBox title="Re-evaluate result" result={recheckResult} /> : null}
              </View>
            ) : null}

            {activeStep === 'discrepancy' ? (
              <View className="gap-3">
                <Message
                  tone={currentLpnState === 'DISCREPANCY_HOLD' ? 'warning' : 'neutral'}
                  text={`Current state: ${currentLpnState || 'N/A'} | Difference: ${latestInboundResult?.diffPercent ?? 0}%`}
                />
                <Message
                  tone="warning"
                  text="This LPN is on discrepancy hold. Sales/Admin must resolve this discrepancy before putaway."
                />
                <Field label="LPN ID" value={lpnId} onChangeText={updateLpnId} placeholder="LpnId" />
                <ActionButton icon="calculator-outline" label="Re-check measurements" onPress={() => setActiveStep('measurements')} />
                <ActionButton icon="document-attach-outline" label="Open discrepancy PDF" onPress={openDiscrepancyPdf} variant="secondary" />
                <ActionButton icon="refresh-outline" label="Refresh LPN status" onPress={refreshLpnStatus} loading={isSubmitting} variant="secondary" />
              </View>
            ) : null}

            {activeStep === 'receipt' ? (
              <View className="gap-3">
                <Field label="ASN ID" value={manualAsnId} onChangeText={setManualAsnId} placeholder="AsnId" />
                <Field label="Deliverer name" value={delivererName} onChangeText={setDelivererName} placeholder="Driver or customer name" />
                <Field label="Vehicle plate" value={vehiclePlate} onChangeText={setVehiclePlate} placeholder="Optional" />
                <Field label="Note" value={receiptNote} onChangeText={setReceiptNote} placeholder="Optional" multiline />
                <ActionButton icon="document-text-outline" label="Generate receipt" onPress={handleGenerateReceipt} loading={isSubmitting} />
                <ActionButton icon="open-outline" label="Open receipt PDF" onPress={openReceiptPdf} variant="secondary" />
                {receiptResult ? <Message tone={receiptResult.success ? 'success' : 'error'} text={receiptResult.message} /> : null}
              </View>
            ) : null}

            {activeStep === 'putaway' ? (
              <View className="gap-3">
                {!canPutaway ? (
                  <Message
                    tone="warning"
                    text={`Putaway is locked until LPN state is RECEIVING. Current state: ${currentLpnState || 'unknown'}.`}
                  />
                ) : null}
                <Field label="LPN ID" value={lpnId} onChangeText={updateLpnId} placeholder="LpnId" />
                <Field label="Storage location" value={storageLocation} onChangeText={setStorageLocation} placeholder="A-01-01" />
                <ActionButton icon="archive-outline" label="Confirm putaway" onPress={handlePutaway} loading={isSubmitting} disabled={!canPutaway} />
                {putawayResult ? <Message tone={putawayResult.success ? 'success' : 'error'} text={putawayResult.message} /> : null}
              </View>
            ) : null}
          </Section>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MeasurementFields({
  weight,
  setWeight,
  length,
  setLength,
  width,
  setWidth,
  height,
  setHeight,
  temperature,
  setTemperature,
}: {
  weight: string;
  setWeight: (value: string) => void;
  length: string;
  setLength: (value: string) => void;
  width: string;
  setWidth: (value: string) => void;
  height: string;
  setHeight: (value: string) => void;
  temperature: string;
  setTemperature: (value: string) => void;
}) {
  const temperatureKeyboardType: TextInputProps['keyboardType'] = Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric';

  return (
    <View className="gap-3">
      <Field label="Actual weight kg" value={weight} onChangeText={setWeight} placeholder="120" keyboardType="numeric" />
      <View className="flex-row gap-2">
        <Field label="Length cm" value={length} onChangeText={setLength} placeholder="80" keyboardType="numeric" />
        <Field label="Width cm" value={width} onChangeText={setWidth} placeholder="60" keyboardType="numeric" />
      </View>
      <View className="flex-row gap-2">
        <Field label="Height cm" value={height} onChangeText={setHeight} placeholder="50" keyboardType="numeric" />
        <Field label="Temperature °C" value={temperature} onChangeText={setTemperature} placeholder="-6" keyboardType={temperatureKeyboardType} />
      </View>
    </View>
  );
}

function EvidencePicker({ images, onPick, onClear }: { images: EvidenceImage[]; onPick: () => void; onClear: () => void }) {
  return (
    <View className="rounded-xl border border-[#D7E5E4] bg-white p-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-bold text-[#102A2D]">Evidence photos</Text>
        <Text className="text-xs font-semibold text-[#64748B]">{images.length} selected</Text>
      </View>
      <View className="mt-3 flex-row gap-2">
        <ActionButton icon="image-outline" label="Add photos" onPress={onPick} compact />
        <ActionButton icon="trash-outline" label="Clear" onPress={onClear} compact variant="secondary" />
      </View>
    </View>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <View className="mb-4 rounded-xl bg-white p-4 shadow-sm">
      <Text className="text-lg font-bold text-[#102A2D]">{title}</Text>
      {subtitle ? <Text className="mt-1 text-xs font-medium text-[#64748B]">{subtitle}</Text> : null}
      <View className="mt-4">{children}</View>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: TextInputProps['keyboardType'];
  multiline?: boolean;
}) {
  return (
    <View className="flex-1 gap-1">
      <Text className="text-xs font-bold text-[#36514D]">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        keyboardType={keyboardType}
        multiline={multiline}
        className={[
          'rounded-lg border border-[#D7E5E4] bg-white px-3 py-2 text-sm text-[#102A2D]',
          multiline ? 'min-h-[86px]' : 'min-h-[42px]',
        ].join(' ')}
      />
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  compact = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  compact?: boolean;
}) {
  const isSecondary = variant === 'secondary';
  const isDisabled = loading || disabled;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className={[
        'flex-row items-center justify-center gap-2 rounded-lg',
        compact ? 'flex-1 px-3 py-2' : 'px-4 py-3',
        isSecondary ? 'border border-[#0F766E]/20 bg-[#DDF5F0]' : 'bg-[#0F766E]',
        isDisabled ? 'opacity-70' : '',
      ].join(' ')}
    >
      <Ionicons name={icon} size={18} color={isSecondary ? '#0F766E' : '#FFFFFF'} />
      <Text className={isSecondary ? 'text-sm font-bold text-[#0F766E]' : 'text-sm font-bold text-white'}>
        {loading ? 'Working...' : label}
      </Text>
    </Pressable>
  );
}

function Message({ text, tone }: { text: string; tone: 'neutral' | 'success' | 'warning' | 'error' }) {
  const colors = {
    neutral: 'border-[#C7D2FE] bg-[#EEF2FF] text-[#3730A3]',
    success: 'border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]',
    warning: 'border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]',
    error: 'border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]',
  }[tone];

  return (
    <View className={`rounded-lg border px-3 py-2 ${colors}`}>
      <Text className={`text-xs font-semibold ${colors}`}>{text}</Text>
    </View>
  );
}

function ResultBox({ title, result }: { title: string; result: InboundQcResponse }) {
  return (
    <View className="rounded-xl border border-[#D7E5E4] bg-[#F8FAFC] p-3">
      <Text className="text-sm font-bold text-[#102A2D]">{title}</Text>
      <InfoRow label="Message" value={result.message} />
      <InfoRow label="LPN" value={result.lpnCode || result.lpnId || 'N/A'} />
      <InfoRow label="Receipt" value={result.receiptId || 'N/A'} />
      <InfoRow label="State" value={result.state || 'N/A'} />
      <InfoRow label="Diff percent" value={`${result.diffPercent}%`} />
      <InfoRow label="PDF" value={result.pdfUrl || 'N/A'} />
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="mt-2 flex-row gap-2">
      <Text className="w-24 text-xs font-bold text-[#64748B]">{label}</Text>
      <Text className="flex-1 text-xs text-[#102A2D]">{value}</Text>
    </View>
  );
}

function StatusPill({ label }: { label: string }) {
  return (
    <View className="rounded-full bg-[#DDF5F0] px-3 py-1">
      <Text className="text-[11px] font-bold text-[#0F766E]">{label}</Text>
    </View>
  );
}

function requireToken(token: string | null): asserts token is string {
  if (!token) {
    throw new Error('Missing authentication token. Please login again.');
  }
}

function requireGuid(value: string, label: string) {
  if (!value.trim()) {
    throw new Error(`${label} is required.`);
  }
}

function parseRequiredDecimal(value: string, label: string) {
  const parsed = parseDecimal(value);
  if (parsed === null || parsed <= 0) {
    throw new Error(`${label} must be greater than 0.`);
  }
  return parsed;
}

function parseOptionalDecimal(value: string, label: string) {
  if (!value.trim()) return null;
  const parsed = parseDecimal(value);
  if (parsed === null) {
    throw new Error(`${label} must be a valid number.`);
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

function formatDateTime(value?: string | null) {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}
