import * as WebBrowser from 'expo-web-browser';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { EmptyState } from '../../components/EmptyState';
import { StatusBadge } from '../../components/StatusBadge';
import {
  WH_COLORS,
  formatDateTimeVi,
  type MessageTone,
} from '../../constants/warehouseTheme';
import { getApiErrorMessage } from '../../services/apiClient';
import {
  buildDispatchDocumentUrl,
  getTripLifoPdfUrl,
  getTripWaybillPdfUrl,
  getTripsCanStartPicking,
  getTripsReadyToSeal,
  sealAndDispatch,
  startPickingTrip,
  type DispatchEnvelope,
  type PlannedDispatchTripDto,
  type ReadyToSealTripDto,
  type SealAndDispatchResult,
} from '../../services/dispatchApi';
import {
  completeTripLoading,
  getAvailableOutboundLpns,
  getAvailableOutboundTrips,
  pickOutboundLpn,
  type AvailableLpnDto,
  type AvailableTripDto,
  type AvailableTripLpnDto,
  type CompleteTripLoadingResponse,
} from '../../services/outboundApi';
import { useAuthStore } from '../../store/useAuthStore';

type OutboundSection = 'planned' | 'picking' | 'seal';

const SECTIONS: { key: OutboundSection; label: string }[] = [
  { key: 'planned', label: 'Chờ bốc hàng' },
  { key: 'picking', label: 'Đang bốc hàng' },
  { key: 'seal', label: 'Chờ kẹp chì' },
];

export default function WarehouseOutboundScreen() {
  const token = useAuthStore((state) => state.token);
  const [activeSection, setActiveSection] = useState<OutboundSection>('planned');
  const [plannedTrips, setPlannedTrips] = useState<PlannedDispatchTripDto[]>([]);
  const [pickingTrips, setPickingTrips] = useState<AvailableTripDto[]>([]);
  const [sealTrips, setSealTrips] = useState<ReadyToSealTripDto[]>([]);
  const [pendingLpns, setPendingLpns] = useState<AvailableLpnDto[]>([]);
  const [selectedPickingTrip, setSelectedPickingTrip] = useState<AvailableTripDto | null>(null);
  const [selectedSealTrip, setSelectedSealTrip] = useState<ReadyToSealTripDto | null>(null);
  const [scanLpnCode, setScanLpnCode] = useState('');
  const [pickLocation, setPickLocation] = useState('');
  const [sealCode, setSealCode] = useState('');
  const [notice, setNotice] = useState<{ text: string; tone: MessageTone } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [startingTripId, setStartingTripId] = useState<string | null>(null);
  const [pickingLpnId, setPickingLpnId] = useState<string | null>(null);
  const [completingTripId, setCompletingTripId] = useState<string | null>(null);
  const [sealingTripId, setSealingTripId] = useState<string | null>(null);
  const [documentTripId, setDocumentTripId] = useState<string | null>(null);
  const [lastLoadingResult, setLastLoadingResult] = useState<CompleteTripLoadingResponse | null>(null);
  const [lastSealResult, setLastSealResult] = useState<SealAndDispatchResult | null>(null);

  const pendingLocationByLpn = useMemo(() => {
    const locations = new Map<string, string>();
    pendingLpns.forEach((lpn) => {
      const location = lpn.storageLocation?.trim();
      if (!location || normalizeStatus(location) === 'N/A') return;
      locations.set(normalizeLookupKey(lpn.lpnId), location);
      locations.set(normalizeLookupKey(lpn.lpnCode), location);
    });
    return locations;
  }, [pendingLpns]);

  const loadPendingLpns = useCallback(
    async (tripId: string) => {
      if (!token) return;
      try {
        const lpns = await getAvailableOutboundLpns(token, tripId);
        setPendingLpns(lpns);
      } catch (error) {
        setNotice({ text: getApiErrorMessage(error), tone: 'error' });
      }
    },
    [token]
  );

  const loadOutboundData = useCallback(async () => {
    if (!token) {
      setNotice({ text: 'Thiếu token xác thực. Vui lòng đăng nhập lại.', tone: 'error' });
      setPlannedTrips([]);
      setPickingTrips([]);
      setSealTrips([]);
      return [] as AvailableTripDto[];
    }

    setIsLoading(true);
    setNotice(null);

    try {
      const [plannedResponse, pickingResponse, sealResponse] = await Promise.all([
        getTripsCanStartPicking(token),
        getAvailableOutboundTrips(token),
        getTripsReadyToSeal(token),
      ]);

      assertDispatchSuccess(plannedResponse);
      assertDispatchSuccess(sealResponse);

      const plannedData = getDispatchData(plannedResponse, []);
      const pickingData = pickingResponse ?? [];
      const sealData = getDispatchData(sealResponse, []);

      setPlannedTrips(plannedData);
      setPickingTrips(pickingData);
      setSealTrips(sealData);
      setSelectedPickingTrip((current) =>
        current ? pickingData.find((trip) => trip.tripId === current.tripId) ?? null : null
      );
      setSelectedSealTrip((current) =>
        current ? sealData.find((trip) => trip.tripId === current.tripId) ?? null : null
      );

      return pickingData;
    } catch (error) {
      setNotice({ text: getApiErrorMessage(error), tone: 'error' });
      return [] as AvailableTripDto[];
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void loadOutboundData();
    }, [loadOutboundData])
  );

  const handleStartPicking = async (trip: PlannedDispatchTripDto) => {
    try {
      requireToken(token);
      const totalLpns = toNumber(trip.totalLpns);
      const allocatedLpns = toNumber(trip.allocatedLpns);
      if (normalizeStatus(trip.status) !== 'PLANNED') {
        throw new Error('Chỉ có thể bắt đầu bốc hàng khi chuyến đang ở trạng thái PLANNED.');
      }
      if (totalLpns <= 0 || allocatedLpns !== totalLpns) {
        throw new Error('Chuyến chưa đủ LPN ở trạng thái ALLOCATED để bắt đầu bốc hàng.');
      }

      setStartingTripId(trip.tripId);
      setNotice(null);

      const response = await startPickingTrip(token, trip.tripId);
      assertDispatchSuccess(response);
      const result = getDispatchData(response, null);
      setNotice({
        text: `Đã bắt đầu bốc hàng. ${result?.lpnCount ?? totalLpns} LPN chuyển sang LOADING.`,
        tone: 'success',
      });
      Alert.alert('Thành công', 'Đã bắt đầu bốc hàng.');
      setActiveSection('picking');

      const pickingData = await loadOutboundData();
      const updatedTrip = pickingData.find((item) => item.tripId === trip.tripId) ?? null;
      setSelectedPickingTrip(updatedTrip);
      if (updatedTrip) {
        await loadPendingLpns(updatedTrip.tripId);
      }
    } catch (error) {
      setNotice({ text: getApiErrorMessage(error), tone: 'error' });
    } finally {
      setStartingTripId(null);
    }
  };

  const handleSelectPickingTrip = (trip: AvailableTripDto) => {
    setSelectedPickingTrip(trip);
    setScanLpnCode('');
    setPickLocation('');
    setNotice(null);
    void loadPendingLpns(trip.tripId);
  };

  const handlePickLpn = async () => {
    try {
      requireToken(token);
      if (!selectedPickingTrip) {
        throw new Error('Vui lòng chọn chuyến đang bốc hàng.');
      }

      const scannedValue = scanLpnCode.trim();
      if (!scannedValue) {
        throw new Error('Vui lòng scan hoặc nhập mã LPN.');
      }

      const enteredLocation = pickLocation.trim();
      if (!enteredLocation) {
        throw new Error('Vui lòng nhập vị trí kệ lấy hàng.');
      }

      const targetLpn = findLpnInTrip(selectedPickingTrip.lpns, scannedValue);
      if (!targetLpn) {
        throw new Error('LPN không thuộc chuyến đang chọn.');
      }

      const expectedLocation =
        pendingLocationByLpn.get(normalizeLookupKey(targetLpn.lpnId)) ??
        pendingLocationByLpn.get(normalizeLookupKey(targetLpn.lpnCode));
      if (expectedLocation && normalizeLookupKey(expectedLocation) !== normalizeLookupKey(enteredLocation)) {
        throw new Error(`Vị trí kệ không khớp. LPN đang ở vị trí ${expectedLocation}.`);
      }

      const currentState = normalizeStatus(targetLpn.state);
      if (currentState === 'LOADING_COMPLETED') {
        throw new Error('LPN này đã được xác nhận bốc hàng.');
      }
      if (currentState !== 'LOADING') {
        throw new Error(`Chỉ có thể bốc LPN ở trạng thái LOADING. Trạng thái hiện tại: ${targetLpn.state}.`);
      }

      setPickingLpnId(targetLpn.lpnId);
      setNotice(null);

      const response = await pickOutboundLpn(token, { lpnId: targetLpn.lpnId });
      if (!response.success) {
        throw new Error(response.message || 'Không thể xác nhận bốc LPN.');
      }

      setNotice({ text: response.message || 'Đã xác nhận bốc LPN.', tone: 'success' });
      setScanLpnCode('');
      setPickLocation('');

      const pickingData = await loadOutboundData();
      const updatedTrip = pickingData.find((trip) => trip.tripId === selectedPickingTrip.tripId) ?? null;
      setSelectedPickingTrip(updatedTrip);
      await loadPendingLpns(selectedPickingTrip.tripId);
    } catch (error) {
      setNotice({ text: getApiErrorMessage(error), tone: 'error' });
    } finally {
      setPickingLpnId(null);
    }
  };

  const handleCompleteTripLoading = async () => {
    try {
      requireToken(token);
      if (!selectedPickingTrip) {
        throw new Error('Vui lòng chọn chuyến đang bốc hàng.');
      }
      if (!selectedPickingTrip.readyToLoad) {
        throw new Error('Cần bốc đủ tất cả LPN trước khi hoàn tất chuyến.');
      }

      setCompletingTripId(selectedPickingTrip.tripId);
      setNotice(null);

      const response = await completeTripLoading(token, {
        tripId: selectedPickingTrip.tripId,
        loadedLpnIds: selectedPickingTrip.lpns.map((lpn) => lpn.lpnId),
      });

      if (!response.success) {
        throw new Error(response.message || 'Không thể hoàn tất bốc hàng cho chuyến.');
      }

      setLastLoadingResult(response);
      setNotice({ text: response.message || 'Đã hoàn tất bốc hàng cho chuyến.', tone: 'success' });
      Alert.alert('Thành công', 'Đã hoàn tất bốc hàng cho chuyến.');
      setSelectedPickingTrip(null);
      setPendingLpns([]);
      setActiveSection('seal');
      await loadOutboundData();
    } catch (error) {
      setNotice({ text: getApiErrorMessage(error), tone: 'error' });
    } finally {
      setCompletingTripId(null);
    }
  };

  const handleSelectSealTrip = (trip: ReadyToSealTripDto) => {
    setSelectedSealTrip(trip);
    setSealCode('');
    setNotice(null);
  };

  const handleSealAndDispatch = async () => {
    try {
      requireToken(token);
      if (!selectedSealTrip) {
        throw new Error('Vui lòng chọn chuyến chờ kẹp chì.');
      }
      if (normalizeStatus(selectedSealTrip.status) !== 'LOADING_COMPLETED') {
        throw new Error('Chỉ có thể kẹp chì khi chuyến ở trạng thái LOADING_COMPLETED.');
      }
      if (toNumber(selectedSealTrip.totalLpns) <= 0 || toNumber(selectedSealTrip.releasedLpns) !== toNumber(selectedSealTrip.totalLpns)) {
        throw new Error('Tất cả LPN phải ở trạng thái RELEASED trước khi kẹp chì.');
      }
      if (!sealCode.trim()) {
        throw new Error('Vui lòng nhập mã seal.');
      }

      setSealingTripId(selectedSealTrip.tripId);
      setNotice(null);

      const response = await sealAndDispatch(token, selectedSealTrip.tripId, sealCode.trim());
      assertDispatchSuccess(response);
      const result = getDispatchData(response, null);
      if (result) {
        setLastSealResult(result);
      }

      setNotice({
        text: `Kẹp chì thành công. Trạng thái chuyến: ${result?.tripStatus || 'SEALED/DISPATCHED'}.`,
        tone: 'success',
      });
      Alert.alert('Thành công', 'Kẹp chì và xuất kho thành công.');
      setSealCode('');
      setSelectedSealTrip(null);
      await loadOutboundData();
    } catch (error) {
      setNotice({ text: getApiErrorMessage(error), tone: 'error' });
    } finally {
      setSealingTripId(null);
    }
  };

  const openLifoPdf = async (tripId: string) => {
    try {
      requireToken(token);
      setDocumentTripId(tripId);
      const url = await getTripLifoPdfUrl(token, tripId);
      if (!url) {
        throw new Error('Chưa có link sơ đồ LIFO cho chuyến này.');
      }
      await WebBrowser.openBrowserAsync(encodeURI(buildDispatchDocumentUrl(url)));
    } catch (error) {
      setNotice({ text: getApiErrorMessage(error), tone: 'error' });
    } finally {
      setDocumentTripId(null);
    }
  };

  const openWaybillPdf = async (tripId: string, knownUrl?: string | null) => {
    try {
      requireToken(token);
      setDocumentTripId(tripId);
      const url = knownUrl || (await getTripWaybillPdfUrl(token, tripId));
      if (!url) {
        throw new Error('Chưa có link giấy đi đường cho chuyến này.');
      }
      await WebBrowser.openBrowserAsync(encodeURI(buildDispatchDocumentUrl(url)));
    } catch (error) {
      setNotice({ text: getApiErrorMessage(error), tone: 'error' });
    } finally {
      setDocumentTripId(null);
    }
  };

  const openOutboundDocument = async (url?: string | null) => {
    if (!url) return;
    await WebBrowser.openBrowserAsync(encodeURI(buildDispatchDocumentUrl(url)));
  };

  return (
    <View style={{ flex: 1, backgroundColor: WH_COLORS.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 36 }}>
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 24, fontWeight: '700', color: WH_COLORS.textPrimary }}>Xuất kho</Text>
            <Text style={{ marginTop: 4, fontSize: 12, fontWeight: '500', color: WH_COLORS.textSecondary }}>
              Bốc hàng theo chuyến, hoàn tất xuất kho và kẹp chì xe.
            </Text>
          </View>

          <View style={{ marginBottom: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {SECTIONS.map((section) => {
              const isActive = activeSection === section.key;
              return (
                <Pressable
                  key={section.key}
                  onPress={() => setActiveSection(section.key)}
                  style={{
                    borderRadius: 10,
                    paddingHorizontal: 12,
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
                    {section.label} ({getSectionCount(section.key, plannedTrips, pickingTrips, sealTrips)})
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ marginBottom: 12 }}>
            <AppButton
              icon="refresh-outline"
              label="Làm mới"
              onPress={() => void loadOutboundData()}
              loading={isLoading}
              variant="secondary"
            />
          </View>

          {notice ? <View style={{ marginBottom: 12 }}><AppMessage text={notice.text} tone={notice.tone} /></View> : null}
          {isLoading ? <ActivityIndicator style={{ marginVertical: 12 }} color={WH_COLORS.primary} /> : null}

          {activeSection === 'planned' ? (
            <Section title="Chuyến chờ bốc hàng" subtitle="Trip PLANNED, LPN ALLOCATED">
              {plannedTrips.length === 0 ? (
                <EmptyState icon="cube-outline" message="Không có chuyến nào đang chờ bốc hàng." />
              ) : (
                <View style={{ gap: 12 }}>
                  {plannedTrips.map((trip) => (
                    <PlannedTripCard
                      key={trip.tripId}
                      trip={trip}
                      openingDocument={documentTripId === trip.tripId}
                      starting={startingTripId === trip.tripId}
                      onOpenLifo={() => void openLifoPdf(trip.tripId)}
                      onStart={() => void handleStartPicking(trip)}
                    />
                  ))}
                </View>
              )}
            </Section>
          ) : null}

          {activeSection === 'picking' ? (
            <Section title="Đang bốc hàng" subtitle="Trip PICKING, scan từng LPN LOADING">
              {pickingTrips.length === 0 ? (
                <EmptyState icon="barcode-outline" message="Không có chuyến nào đang bốc hàng." />
              ) : (
                <View style={{ gap: 12 }}>
                  {pickingTrips.map((trip) => (
                    <PickingTripCard
                      key={trip.tripId}
                      trip={trip}
                      selected={selectedPickingTrip?.tripId === trip.tripId}
                      onPress={() => handleSelectPickingTrip(trip)}
                    />
                  ))}
                </View>
              )}

              {selectedPickingTrip ? (
                <View style={{ marginTop: 16, gap: 12 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: WH_COLORS.textPrimary }}>
                    Scan LPN bốc hàng
                  </Text>
                  <AppMessage
                    tone={selectedPickingTrip.readyToLoad ? 'success' : 'neutral'}
                    text={`Tiến độ: ${selectedPickingTrip.loadingCompletedLpns}/${selectedPickingTrip.totalLpns} LPN đã bốc.`}
                  />
                  <AppInput
                    label="Mã LPN"
                    value={scanLpnCode}
                    onChangeText={setScanLpnCode}
                    placeholder="Scan hoặc nhập mã LPN"
                  />
                  <AppInput
                    label="Vị trí kệ lấy hàng"
                    value={pickLocation}
                    onChangeText={setPickLocation}
                    placeholder="Ví dụ: A-01-01"
                  />
                  <AppButton
                    icon="barcode-outline"
                    label="Xác nhận đã bốc LPN"
                    onPress={() => void handlePickLpn()}
                    loading={Boolean(pickingLpnId)}
                  />

                  <View style={{ gap: 10 }}>
                    {selectedPickingTrip.lpns.map((lpn) => (
                      <LpnProgressRow
                        key={lpn.lpnId}
                        lpn={lpn}
                        storageLocation={
                          pendingLocationByLpn.get(normalizeLookupKey(lpn.lpnId)) ??
                          pendingLocationByLpn.get(normalizeLookupKey(lpn.lpnCode))
                        }
                      />
                    ))}
                  </View>

                  <AppButton
                    icon="checkmark-done-outline"
                    label="Hoàn tất bốc hàng cho chuyến"
                    onPress={() => void handleCompleteTripLoading()}
                    loading={completingTripId === selectedPickingTrip.tripId}
                    disabled={!selectedPickingTrip.readyToLoad}
                  />
                  {!selectedPickingTrip.readyToLoad ? (
                    <AppMessage
                      tone="warning"
                      text="Cần scan đủ tất cả LPN trong chuyến trước khi hoàn tất bốc hàng."
                    />
                  ) : null}
                </View>
              ) : null}

              {lastLoadingResult ? (
                <OutboundDocuments result={lastLoadingResult} onOpenDocument={openOutboundDocument} />
              ) : null}
            </Section>
          ) : null}

          {activeSection === 'seal' ? (
            <Section title="Chờ kẹp chì" subtitle="Trip LOADING_COMPLETED, LPN RELEASED">
              {sealTrips.length === 0 ? (
                <EmptyState icon="lock-closed-outline" message="Không có chuyến nào đang chờ kẹp chì." />
              ) : (
                <View style={{ gap: 12 }}>
                  {sealTrips.map((trip) => (
                    <ReadyToSealTripCard
                      key={trip.tripId}
                      trip={trip}
                      selected={selectedSealTrip?.tripId === trip.tripId}
                      onPress={() => handleSelectSealTrip(trip)}
                    />
                  ))}
                </View>
              )}

              {selectedSealTrip ? (
                <View style={{ marginTop: 16, gap: 12 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: WH_COLORS.textPrimary }}>
                    Kẹp chì xe
                  </Text>
                  <AppInput
                    label="Mã seal"
                    value={sealCode}
                    onChangeText={setSealCode}
                    placeholder="Nhập mã seal"
                  />
                  <AppButton
                    icon="lock-closed-outline"
                    label="Xác nhận kẹp chì và xuất kho"
                    onPress={() => void handleSealAndDispatch()}
                    loading={sealingTripId === selectedSealTrip.tripId}
                  />
                </View>
              ) : null}

              {lastSealResult ? (
                <View style={{ marginTop: 16, gap: 12 }}>
                  <AppMessage
                    tone="success"
                    text={`Chuyến ${formatShortId(lastSealResult.tripId)} đã kẹp chì ${lastSealResult.sealCode}. Trạng thái: ${lastSealResult.tripStatus || 'DISPATCHED'}.`}
                  />
                  <AppButton
                    icon="document-text-outline"
                    label="Mở giấy đi đường"
                    onPress={() => void openWaybillPdf(lastSealResult.tripId, lastSealResult.waybillUrl)}
                    loading={documentTripId === lastSealResult.tripId}
                    variant="secondary"
                  />
                </View>
              ) : null}
            </Section>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function PlannedTripCard({
  trip,
  openingDocument,
  starting,
  onOpenLifo,
  onStart,
}: {
  trip: PlannedDispatchTripDto;
  openingDocument: boolean;
  starting: boolean;
  onOpenLifo: () => void;
  onStart: () => void;
}) {
  const totalLpns = toNumber(trip.totalLpns);
  const allocatedLpns = toNumber(trip.allocatedLpns);
  const canStart = normalizeStatus(trip.status) === 'PLANNED' && totalLpns > 0 && allocatedLpns === totalLpns;

  return (
    <TripCard title={`Chuyến ${formatShortId(trip.tripId)}`} status={trip.status}>
      <AppInfoRow label="Xe" value={trip.vehicle || 'N/A'} />
      <AppInfoRow label="Tài xế" value={trip.driver || 'N/A'} />
      <AppInfoRow label="Bắt đầu" value={formatDateTimeVi(trip.plannedStartTime)} />
      <AppInfoRow label="Kết thúc" value={formatDateTimeVi(trip.plannedEndTime)} />
      <AppInfoRow label="LPN" value={`${allocatedLpns}/${totalLpns} ALLOCATED`} />
      {trip.estimatedDurationHours !== undefined && trip.estimatedDurationHours !== null ? (
        <AppInfoRow label="Thời lượng" value={`${trip.estimatedDurationHours} giờ`} />
      ) : null}
      {!canStart ? (
        <View style={{ marginTop: 12 }}>
          <AppMessage tone="warning" text="Chuyến chưa đủ điều kiện bắt đầu bốc hàng." />
        </View>
      ) : null}
      <View style={{ marginTop: 14, flexDirection: 'row', gap: 8 }}>
        <AppButton
          icon="document-text-outline"
          label="LIFO"
          onPress={onOpenLifo}
          loading={openingDocument}
          compact
          variant="secondary"
        />
        <AppButton
          icon="play-outline"
          label="Bắt đầu bốc"
          onPress={onStart}
          loading={starting}
          disabled={!canStart}
          compact
        />
      </View>
    </TripCard>
  );
}

function PickingTripCard({
  trip,
  selected,
  onPress,
}: {
  trip: AvailableTripDto;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <TripCard title={`Chuyến ${formatShortId(trip.tripId)}`} status={trip.status || 'PICKING'} selected={selected}>
        <AppInfoRow label="Tiến độ" value={`${trip.loadingCompletedLpns}/${trip.totalLpns} LPN`} />
        <AppInfoRow label="Sẵn sàng" value={trip.readyToLoad ? 'Đã đủ LPN' : 'Chưa đủ LPN'} />
        <View style={{ marginTop: 12 }}>
          <AppMessage
            tone={trip.readyToLoad ? 'success' : 'neutral'}
            text={trip.readyToLoad ? 'Có thể hoàn tất bốc hàng cho chuyến.' : 'Tiếp tục scan các LPN còn lại.'}
          />
        </View>
      </TripCard>
    </Pressable>
  );
}

function ReadyToSealTripCard({
  trip,
  selected,
  onPress,
}: {
  trip: ReadyToSealTripDto;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <TripCard title={`Chuyến ${formatShortId(trip.tripId)}`} status={trip.status} selected={selected}>
        <AppInfoRow label="Xe" value={trip.vehicle || 'N/A'} />
        <AppInfoRow label="Tài xế" value={trip.driver || 'N/A'} />
        <AppInfoRow label="Bắt đầu" value={formatDateTimeVi(trip.plannedStartTime)} />
        <AppInfoRow label="Kết thúc" value={formatDateTimeVi(trip.plannedEndTime)} />
        <AppInfoRow label="LPN" value={`${toNumber(trip.releasedLpns)}/${toNumber(trip.totalLpns)} RELEASED`} />
      </TripCard>
    </Pressable>
  );
}

function LpnProgressRow({
  lpn,
  storageLocation,
}: {
  lpn: AvailableTripLpnDto;
  storageLocation?: string;
}) {
  return (
    <View
      style={{
        borderRadius: 12,
        borderWidth: 1,
        borderColor: WH_COLORS.cardBorder,
        backgroundColor: '#FFFFFF',
        padding: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: WH_COLORS.textPrimary }}>{lpn.lpnCode}</Text>
          <Text style={{ marginTop: 4, fontSize: 12, color: WH_COLORS.textSecondary }}>
            {lpn.itemName || 'N/A'}
          </Text>
        </View>
        <StatusBadge status={lpn.state} showVietnameseLabel />
      </View>
      <AppInfoRow label="Đơn hàng" value={lpn.orderCode || lpn.orderId} />
      <AppInfoRow label="Số lượng" value={String(lpn.quantity)} />
      {storageLocation ? <AppInfoRow label="Vị trí" value={storageLocation} /> : null}
    </View>
  );
}

function OutboundDocuments({
  result,
  onOpenDocument,
}: {
  result: CompleteTripLoadingResponse;
  onOpenDocument: (url?: string | null) => void;
}) {
  if (!result.manifestPdfUrl && !result.outboundTicketPdfUrl && !result.handoverPdfUrl) {
    return null;
  }

  return (
    <View style={{ marginTop: 16, gap: 8 }}>
      <Text style={{ fontSize: 14, fontWeight: '700', color: WH_COLORS.textPrimary }}>Chứng từ xuất kho</Text>
      {result.manifestPdfUrl ? (
        <AppButton
          icon="document-text-outline"
          label="Mở Manifest"
          onPress={() => onOpenDocument(result.manifestPdfUrl)}
          variant="secondary"
        />
      ) : null}
      {result.outboundTicketPdfUrl ? (
        <AppButton
          icon="document-attach-outline"
          label="Mở phiếu xuất kho"
          onPress={() => onOpenDocument(result.outboundTicketPdfUrl)}
          variant="secondary"
        />
      ) : null}
      {result.handoverPdfUrl ? (
        <AppButton
          icon="reader-outline"
          label="Mở biên bản bàn giao"
          onPress={() => onOpenDocument(result.handoverPdfUrl)}
          variant="secondary"
        />
      ) : null}
    </View>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
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

function TripCard({
  title,
  status,
  selected = false,
  children,
}: {
  title: string;
  status: string;
  selected?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        borderRadius: 14,
        borderWidth: 1,
        borderColor: selected ? WH_COLORS.primary : WH_COLORS.cardBorder,
        backgroundColor: selected ? WH_COLORS.primaryLight : WH_COLORS.cardBg,
        padding: 14,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: WH_COLORS.textPrimary }}>
          {title}
        </Text>
        <StatusBadge status={status} showVietnameseLabel />
      </View>
      <View style={{ marginTop: 4 }}>{children}</View>
    </View>
  );
}

function getSectionCount(
  section: OutboundSection,
  plannedTrips: PlannedDispatchTripDto[],
  pickingTrips: AvailableTripDto[],
  sealTrips: ReadyToSealTripDto[]
) {
  if (section === 'planned') return plannedTrips.length;
  if (section === 'picking') return pickingTrips.length;
  return sealTrips.length;
}

function assertDispatchSuccess<T>(response: DispatchEnvelope<T>) {
  if (!(response.success ?? response.Success)) {
    throw new Error(response.error ?? response.Error ?? response.message ?? response.Message ?? 'Yêu cầu thất bại.');
  }
}

function getDispatchData<T>(response: DispatchEnvelope<T>, fallback: T) {
  return response.data ?? response.Data ?? fallback;
}

function findLpnInTrip(lpns: AvailableTripLpnDto[], rawValue: string) {
  const lookupValue = normalizeLookupKey(rawValue);
  return lpns.find(
    (lpn) =>
      normalizeLookupKey(lpn.lpnId) === lookupValue ||
      normalizeLookupKey(lpn.lpnCode) === lookupValue
  );
}

function normalizeLookupKey(value?: string | null) {
  return value?.trim().toUpperCase() ?? '';
}

function normalizeStatus(value?: string | null) {
  return value?.trim().toUpperCase() ?? '';
}

function toNumber(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function formatShortId(value?: string | null) {
  return value ? value.slice(0, 8) : 'N/A';
}

function requireToken(token: string | null): asserts token is string {
  if (!token) {
    throw new Error('Thiếu token xác thực. Vui lòng đăng nhập lại.');
  }
}
