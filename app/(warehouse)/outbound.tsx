import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { AppPressable as Pressable } from '../../components/AppPressable';
import { AppButton } from '../../components/AppButton';
import { AppInfoRow } from '../../components/AppInfoRow';
import { AppInput } from '../../components/AppInput';
import { AppMessage } from '../../components/AppMessage';
import { EmptyState } from '../../components/EmptyState';
import { StatusBadge } from '../../components/StatusBadge';
import { colors } from '../../constants/colors';
import {
  WH_COLORS,
  STATUS_STYLES,
  formatDateTimeVi,
  type MessageTone,
} from '../../constants/warehouseTheme';
import { ApiClientError, getApiErrorMessage } from '../../services/apiClient';
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
type SectionLoadingState = Record<OutboundSection, boolean>;
type SectionErrorState = Record<OutboundSection, string | null>;

const SECTIONS: { key: OutboundSection; label: string }[] = [
  { key: 'planned', label: 'Chờ bốc hàng' },
  { key: 'picking', label: 'Đang bốc hàng' },
  { key: 'seal', label: 'Chờ kẹp chì' },
];

const SECTION_ENDPOINTS: Record<OutboundSection, string> = {
  planned: '/api/Dispatch/trips/can-start-picking',
  picking: '/api/Outbound/available-trips',
  seal: '/api/Dispatch/trips/ready-to-seal',
};

export default function WarehouseOutboundScreen() {
  const token = useAuthStore((state) => state.token);
  const appRole = useAuthStore((state) => state.role);
  const backendRole = useAuthStore((state) => state.user?.backendRole ?? null);
  const warehouseId = useAuthStore((state) => state.warehouseId ?? state.user?.warehouseId ?? null);
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
  const [loadingBySection, setLoadingBySection] = useState<SectionLoadingState>({
    planned: false,
    picking: false,
    seal: false,
  });
  const [errorBySection, setErrorBySection] = useState<SectionErrorState>({
    planned: null,
    picking: null,
    seal: null,
  });
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

  const runSectionRequest = useCallback(
    async <T,>(
      section: OutboundSection,
      request: (accessToken: string) => Promise<T>,
      onSuccess: (data: T) => void,
      onClear: () => void
    ): Promise<T | null> => {
      setLoadingBySection((current) => ({ ...current, [section]: true }));
      setErrorBySection((current) => ({ ...current, [section]: null }));

      if (!token) {
        onClear();
        setErrorBySection((current) => ({
          ...current,
          [section]: 'Không thể tải danh sách chuyến. Phiên đăng nhập không hợp lệ, vui lòng đăng nhập lại.',
        }));
        setLoadingBySection((current) => ({ ...current, [section]: false }));
        return null;
      }

      if (__DEV__) {
        console.log('[WarehouseOutbound] Loading tab', {
          tab: section,
          method: 'GET',
          endpoint: SECTION_ENDPOINTS[section],
          appRole,
          backendRole,
          warehouseId,
        });
      }

      try {
        const data = await request(token);
        onSuccess(data);
        return data;
      } catch (error) {
        onClear();
        const message = getOutboundListError(error);
        setErrorBySection((current) => ({ ...current, [section]: message }));

        if (__DEV__) {
          console.warn('[WarehouseOutbound] Failed to load tab', {
            tab: section,
            endpoint: SECTION_ENDPOINTS[section],
            status: error instanceof ApiClientError ? error.status : undefined,
            message: getApiErrorMessage(error),
            appRole,
            backendRole,
            warehouseId,
          });
        }

        return null;
      } finally {
        setLoadingBySection((current) => ({ ...current, [section]: false }));
      }
    },
    [appRole, backendRole, token, warehouseId]
  );

  const loadPlannedTrips = useCallback(
    () =>
      runSectionRequest(
        'planned',
        getTripsCanStartPicking,
        (data) => setPlannedTrips(data),
        () => setPlannedTrips([])
      ),
    [runSectionRequest]
  );

  const loadPickingTrips = useCallback(
    () =>
      runSectionRequest(
        'picking',
        getAvailableOutboundTrips,
        (data) => {
          setPickingTrips(data);
          setSelectedPickingTrip((current) =>
            current ? data.find((trip) => trip.tripId === current.tripId) ?? null : null
          );
        },
        () => {
          setPickingTrips([]);
          setSelectedPickingTrip(null);
          setPendingLpns([]);
        }
      ),
    [runSectionRequest]
  );

  const loadSealTrips = useCallback(
    () =>
      runSectionRequest(
        'seal',
        getTripsReadyToSeal,
        (data) => {
          setSealTrips(data);
          setSelectedSealTrip((current) =>
            current ? data.find((trip) => trip.tripId === current.tripId) ?? null : null
          );
        },
        () => {
          setSealTrips([]);
          setSelectedSealTrip(null);
        }
      ),
    [runSectionRequest]
  );

  const loadAllOutboundData = useCallback(async () => {
    await Promise.all([loadPlannedTrips(), loadPickingTrips(), loadSealTrips()]);
  }, [loadPickingTrips, loadPlannedTrips, loadSealTrips]);

  const loadActiveSection = useCallback(async () => {
    setNotice(null);
    if (activeSection === 'planned') {
      await loadPlannedTrips();
      return;
    }
    if (activeSection === 'picking') {
      await loadPickingTrips();
      return;
    }
    await loadSealTrips();
  }, [activeSection, loadPickingTrips, loadPlannedTrips, loadSealTrips]);

  useFocusEffect(
    useCallback(() => {
      setNotice(null);
      void loadAllOutboundData();
    }, [loadAllOutboundData])
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

      const [pickingData] = await Promise.all([loadPickingTrips(), loadPlannedTrips()]);
      const updatedTrip = pickingData?.find((item) => item.tripId === trip.tripId) ?? null;
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

      const pickingData = await loadPickingTrips();
      const updatedTrip = pickingData?.find((trip) => trip.tripId === selectedPickingTrip.tripId) ?? null;
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
      await Promise.all([loadPickingTrips(), loadSealTrips()]);
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
      await loadSealTrips();
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
                  onPress={() => {
                    setActiveSection(section.key);
                    setNotice(null);
                  }}
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
              onPress={() => void loadActiveSection()}
              loading={loadingBySection[activeSection]}
              variant="secondary"
            />
          </View>

          {notice ? <View style={{ marginBottom: 12 }}><AppMessage text={notice.text} tone={notice.tone} /></View> : null}

          {activeSection === 'planned' ? (
            <Section title="Chuyến chờ bốc hàng" subtitle="Các chuyến cần bắt đầu bốc hàng lên xe">
              {loadingBySection.planned ? (
                <OutboundLoadingState />
              ) : errorBySection.planned ? (
                <OutboundErrorState
                  message={errorBySection.planned}
                  onRetry={() => void loadPlannedTrips()}
                />
              ) : plannedTrips.length === 0 ? (
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
            <Section title="Đang bốc hàng" subtitle="Quét từng mã LPN tại kệ lấy hàng">
              {loadingBySection.picking ? (
                <OutboundLoadingState />
              ) : errorBySection.picking ? (
                <OutboundErrorState
                  message={errorBySection.picking}
                  onRetry={() => void loadPickingTrips()}
                />
              ) : pickingTrips.length === 0 ? (
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

              {!loadingBySection.picking && !errorBySection.picking && selectedPickingTrip ? (
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

              {!loadingBySection.picking && !errorBySection.picking && lastLoadingResult ? (
                <OutboundDocuments result={lastLoadingResult} onOpenDocument={openOutboundDocument} />
              ) : null}
            </Section>
          ) : null}

          {activeSection === 'seal' ? (
            <Section title="Chờ kẹp chì" subtitle="Kẹp chì bảo mật và hoàn tất xuất kho">
              {loadingBySection.seal ? (
                <OutboundLoadingState />
              ) : errorBySection.seal ? (
                <OutboundErrorState
                  message={errorBySection.seal}
                  onRetry={() => void loadSealTrips()}
                />
              ) : sealTrips.length === 0 ? (
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

              {!loadingBySection.seal && !errorBySection.seal && selectedSealTrip ? (
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
                    disabled={
                      normalizeStatus(selectedSealTrip.status) !== 'LOADING_COMPLETED' ||
                      toNumber(selectedSealTrip.totalLpns) <= 0 ||
                      toNumber(selectedSealTrip.releasedLpns) !== toNumber(selectedSealTrip.totalLpns) ||
                      !sealCode.trim()
                    }
                  />
                </View>
              ) : null}

              {!loadingBySection.seal && !errorBySection.seal && lastSealResult ? (
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

function OutboundLoadingState() {
  return (
    <View style={{ alignItems: 'center', gap: 10, paddingVertical: 28 }}>
      <ActivityIndicator color={WH_COLORS.primary} />
      <Text style={{ fontSize: 14, color: WH_COLORS.textSecondary }}>
        Đang tải danh sách chuyến...
      </Text>
    </View>
  );
}

function OutboundErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <View style={{ gap: 12 }}>
      <AppMessage text={message} tone="error" />
      <AppButton
        icon="refresh-outline"
        label="Thử lại"
        onPress={onRetry}
        variant="secondary"
      />
    </View>
  );
}

function formatTripTimeRange(startTime?: string | null, endTime?: string | null, fallback = 'N/A'): string {
  if (!startTime) return fallback;
  const startDate = new Date(startTime);
  if (Number.isNaN(startDate.getTime())) return startTime;

  const startDayStr = `${String(startDate.getDate()).padStart(2, '0')}/${String(startDate.getMonth() + 1).padStart(2, '0')}`;
  const startTimeStr = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;

  if (!endTime) return `${startDayStr} · ${startTimeStr}`;

  const endDate = new Date(endTime);
  if (Number.isNaN(endDate.getTime())) return `${startDayStr} · ${startTimeStr}`;

  const endDayStr = `${String(endDate.getDate()).padStart(2, '0')}/${String(endDate.getMonth() + 1).padStart(2, '0')}`;
  const endTimeStr = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

  if (startDayStr === endDayStr) {
    return `${startDayStr} · ${startTimeStr} – ${endTimeStr}`;
  }

  return `${startDayStr} ${startTimeStr} – ${endDayStr} ${endTimeStr}`;
}

function formatDurationVi(hours?: number | null): string | null {
  if (typeof hours !== 'number' || !Number.isFinite(hours) || hours <= 0) return null;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h > 0 && m > 0) return `${h} giờ ${m} phút`;
  if (h > 0) return `${h} giờ`;
  return `${m} phút`;
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

  const timeDisplay = formatTripTimeRange(trip.plannedStartTime, trip.plannedEndTime);
  const durationDisplay = formatDurationVi(trip.estimatedDurationHours);

  return (
    <TripCard title={`Chuyến ${formatShortId(trip.tripId)}`} status={trip.status}>
      <AppInfoRow label="Xe" value={trip.vehicle || 'N/A'} />
      <AppInfoRow label="Tài xế" value={trip.driver || 'N/A'} />
      <AppInfoRow label="Thời gian" value={timeDisplay} />
      <AppInfoRow label="Tiến độ LPN" value={`${allocatedLpns}/${totalLpns} LPN sẵn sàng`} />
      {durationDisplay ? <AppInfoRow label="Thời lượng" value={durationDisplay} /> : null}

      {!canStart ? (
        <View style={{ marginTop: 10 }}>
          <AppMessage
            tone="warning"
            text={
              normalizeStatus(trip.status) !== 'PLANNED'
                ? `Chuyến đang ở trạng thái ${STATUS_STYLES[normalizeStatus(trip.status)]?.label || trip.status}.`
                : totalLpns === 0
                ? 'Chuyến chưa có LPN nào.'
                : 'Chưa đủ LPN sẵn sàng để bắt đầu bốc hàng.'
            }
          />
        </View>
      ) : null}

      <Pressable
        onPress={onOpenLifo}
        disabled={openingDocument}
        style={({ pressed }) => ({
          alignSelf: 'flex-start',
          height: 42,
          marginTop: 12,
          paddingHorizontal: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border.default,
          backgroundColor: pressed ? colors.brand.primarySoft : '#FFFFFF',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        })}
      >
        {openingDocument ? (
          <ActivityIndicator size="small" color={colors.brand.primary} />
        ) : (
          <Ionicons name="document-text-outline" size={18} color={colors.brand.primary} />
        )}
        <Text style={{ color: colors.brand.primary, fontSize: 14, fontWeight: '600' }}>
          Sơ đồ LIFO
        </Text>
      </Pressable>

      <Pressable
        onPress={onStart}
        disabled={!canStart || starting}
        style={({ pressed }) => ({
          width: '100%',
          height: 52,
          marginTop: 12,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: canStart ? colors.brand.primary : colors.border.default,
          backgroundColor: !canStart
            ? colors.brand.primarySoft
            : pressed
            ? colors.brand.primaryPressed
            : colors.brand.primary,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          overflow: 'hidden',
        })}
      >
        {starting ? (
          <ActivityIndicator size="small" color={canStart ? '#FFFFFF' : colors.text.secondary} />
        ) : (
          <Ionicons
            name="play-outline"
            size={20}
            color={canStart ? '#FFFFFF' : colors.text.secondary}
          />
        )}
        <Text
          style={{
            color: canStart ? '#FFFFFF' : colors.text.secondary,
            fontSize: 15,
            fontWeight: '700',
          }}
        >
          {starting ? 'Đang xử lý...' : 'Bắt đầu bốc hàng'}
        </Text>
      </Pressable>
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
  const timeDisplay = formatTripTimeRange(trip.plannedStartTime, trip.plannedEndTime);

  return (
    <Pressable onPress={onPress}>
      <TripCard title={`Chuyến ${formatShortId(trip.tripId)}`} status={trip.status} selected={selected}>
        <AppInfoRow label="Xe" value={trip.vehicle || 'N/A'} />
        <AppInfoRow label="Tài xế" value={trip.driver || 'N/A'} />
        <AppInfoRow label="Thời gian" value={timeDisplay} />
        <AppInfoRow label="Tiến độ LPN" value={`${toNumber(trip.releasedLpns)}/${toNumber(trip.totalLpns)} LPN sẵn sàng xuất kho`} />
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

function getOutboundListError(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.status === 401) {
      return 'Không thể tải danh sách chuyến. Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.';
    }
    if (error.status === 403) {
      return 'Không thể tải danh sách chuyến. Tài khoản hiện tại không có quyền truy cập.';
    }
    if (error.status === 404) {
      return 'Không thể tải danh sách chuyến. Endpoint chưa có trên Backend deploy.';
    }
    if (error.status && error.status >= 500) {
      return 'Không thể tải danh sách chuyến. Backend đang gặp lỗi, vui lòng thử lại.';
    }
  }

  return 'Không thể tải danh sách chuyến.';
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
