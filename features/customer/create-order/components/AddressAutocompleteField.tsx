import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../../../../constants/colors';
import {
  getGoongPlaceDetail,
  isAbortError,
  searchGoongAddressSuggestions,
  type GoongAddressSuggestion,
  type GoongPlaceDetail,
} from '../../../../services/goongPlacesApi';
import { DeliveryLocationPreview } from './DeliveryLocationPreview';

type AddressAutocompleteFieldProps = {
  value: string;
  selectedLocation: GoongPlaceDetail | null;
  receiverName: string;
  receiverPhone: string;
  onConfirmDeliveryContact: (payload: {
    location: GoongPlaceDetail;
    receiverName: string;
    receiverPhone: string;
  }) => void;
  destinationCity?: string;
  error?: string;
  disabled?: boolean;
};

type SearchState = 'idle' | 'loading' | 'empty' | 'error';
type PickerStage = 'search' | 'confirm';

export function AddressAutocompleteField({
  value,
  selectedLocation,
  receiverName,
  receiverPhone,
  onConfirmDeliveryContact,
  destinationCity,
  error,
  disabled = false,
}: AddressAutocompleteFieldProps) {
  const insets = useSafeAreaInsets();
  const searchInputRef = useRef<TextInput | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [stage, setStage] = useState<PickerStage>('search');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<GoongAddressSuggestion[]>([]);
  const [searchState, setSearchState] = useState<SearchState>('idle');
  const [pendingLocation, setPendingLocation] = useState<GoongPlaceDetail | null>(null);
  const [pendingReceiverName, setPendingReceiverName] = useState('');
  const [pendingReceiverPhone, setPendingReceiverPhone] = useState('');
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [retryTrigger, setRetryTrigger] = useState(0);

  useEffect(() => {
    if (!isOpen || stage !== 'search') return;

    const rawQuery = query.trim();
    if (rawQuery.length < 2) {
      setSuggestions([]);
      setSearchState('idle');
      return;
    }

    const searchQuery = destinationCity && !rawQuery.toLowerCase().includes(destinationCity.toLowerCase())
      ? `${rawQuery}, ${destinationCity}`
      : rawQuery;
    const controller = new AbortController();
    setSearchState('loading');

    const timer = setTimeout(() => {
      void (async () => {
        try {
          let results = await searchGoongAddressSuggestions(searchQuery, controller.signal);

          // If searching with destinationCity suffix yielded 0 results, fallback to raw query
          if (results.length === 0 && searchQuery !== rawQuery && !controller.signal.aborted) {
            results = await searchGoongAddressSuggestions(rawQuery, controller.signal);
          }

          if (controller.signal.aborted) return;

          setSuggestions(results);
          setSearchState(results.length > 0 ? 'idle' : 'empty');
        } catch (requestError: unknown) {
          if (controller.signal.aborted || isAbortError(requestError)) return;
          setSuggestions([]);
          setSearchState('error');
        }
      })();
    }, 280);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [destinationCity, isOpen, query, stage, retryTrigger]);

  const openPicker = () => {
    if (disabled) return;
    if (selectedLocation) {
      // Existing confirmed destination -> open directly in confirm/edit stage
      setPendingLocation(selectedLocation);
      setPendingReceiverName(receiverName);
      setPendingReceiverPhone(receiverPhone);
      setStage('confirm');
    } else {
      // New destination -> open search stage
      setQuery('');
      setSuggestions([]);
      setSearchState('idle');
      setPendingLocation(null);
      setPendingReceiverName(receiverName);
      setPendingReceiverPhone(receiverPhone);
      setStage('search');
    }
    setLocationError(null);
    setIsOpen(true);
  };

  const closePicker = () => {
    Keyboard.dismiss();
    setIsOpen(false);
  };

  const handleBack = () => {
    if (stage === 'confirm') {
      setPendingLocation(null);
      setStage('search');
      return;
    }
    closePicker();
  };

  const selectSuggestion = async (suggestion: GoongAddressSuggestion) => {
    if (isResolvingLocation) return;
    Keyboard.dismiss();
    setLocationError(null);
    setIsResolvingLocation(true);
    try {
      const location = await getGoongPlaceDetail(suggestion.placeId);
      setPendingLocation(location);
      setStage('confirm');
    } catch {
      setLocationError('Chưa thể xác định tọa độ. Bạn có thể chọn "Sử dụng địa chỉ này" bên dưới để tiếp tục.');
    } finally {
      setIsResolvingLocation(false);
    }
  };

  const handleUseManualAddress = (addressText: string) => {
    const trimmed = addressText.trim();
    if (!trimmed) return;
    Keyboard.dismiss();
    setLocationError(null);
    const manualLocation: GoongPlaceDetail = {
      placeId: `manual-${Date.now()}`,
      address: trimmed,
      name: trimmed.split(',')[0]?.trim() || trimmed,
      latitude: 0,
      longitude: 0,
    };
    setPendingLocation(manualLocation);
    setStage('confirm');
  };

  const handleEditAddress = () => {
    if (pendingLocation?.address) {
      setQuery(pendingLocation.name?.trim() || pendingLocation.address);
    }
    setStage('search');
  };

  useEffect(() => {
    if (isOpen && stage === 'search') {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [isOpen, stage]);

  const handleConfirmDeliveryContact = (contact: { receiverName: string; receiverPhone: string }) => {
    if (!pendingLocation) return;
    onConfirmDeliveryContact({
      location: pendingLocation,
      receiverName: contact.receiverName,
      receiverPhone: contact.receiverPhone,
    });
    closePicker();
  };

  const primaryAddress = getPrimaryAddress(selectedLocation, value);
  const receiverSummary = [receiverName.trim(), receiverPhone.trim()].filter(Boolean).join(' • ') || 'Chưa có thông tin người nhận';

  return (
    <>
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>
          Điểm giao hàng <Text style={styles.required}>*</Text>
        </Text>

        {selectedLocation ? (
          /* Confirmed Delivery Destination & Receiver Card */
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Sửa điểm giao hàng ${primaryAddress}, người nhận ${receiverSummary}`}
            accessibilityHint="Mở màn hình xác nhận và chỉnh sửa thông tin giao hàng"
            disabled={disabled}
            onPress={openPicker}
            style={({ pressed }) => [
              styles.confirmedDestinationCard,
              error ? styles.destinationCardError : null,
              disabled ? styles.destinationCardDisabled : null,
              pressed && !disabled ? styles.destinationCardPressed : null,
            ]}
          >
            <View style={styles.cardMainContent}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="location" size={17} color={colors.brand.primary} />
                <Text numberOfLines={1} style={styles.confirmedTitle}>
                  {primaryAddress}
                </Text>
              </View>
              <Text numberOfLines={1} style={styles.confirmedSubtitle}>
                {receiverSummary}
              </Text>
            </View>

            <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
          </Pressable>
        ) : (
          /* Empty state: Select destination */
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chọn điểm giao hàng"
            accessibilityHint={disabled ? 'Chọn điểm dừng trên tuyến trước' : 'Mở màn hình tìm kiếm địa chỉ'}
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={openPicker}
            style={({ pressed }) => [
              styles.emptyDestinationCard,
              error ? styles.destinationCardError : null,
              disabled ? styles.destinationCardDisabled : null,
              pressed && !disabled ? styles.destinationCardPressed : null,
            ]}
          >
            <View style={styles.cardMainContent}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="location-outline" size={17} color={disabled ? colors.text.muted : colors.brand.primary} />
                <Text numberOfLines={1} style={[styles.emptyCardTitle, disabled ? styles.emptyCardTitleDisabled : null]}>
                  {disabled ? 'Chọn điểm dừng trên tuyến trước' : 'Chọn điểm giao hàng'}
                </Text>
              </View>
              <Text numberOfLines={1} style={styles.emptyCardSubtitle}>
                {disabled ? 'Cần chọn điểm dừng để mở bản đồ' : 'Địa chỉ, tên và SĐT người nhận'}
              </Text>
            </View>

            <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
          </Pressable>
        )}

        {error ? (
          <Text accessibilityLiveRegion="polite" style={styles.errorText}>{error}</Text>
        ) : null}
      </View>

      <Modal
        visible={isOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onShow={() => {
          if (stage === 'search') searchInputRef.current?.focus();
        }}
        onRequestClose={handleBack}
      >
        <View style={styles.modalRoot}>
          <View style={[styles.modalHeader, { paddingTop: Math.max(insets.top, 12) }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={stage === 'confirm' ? 'Quay lại tìm kiếm địa chỉ' : 'Đóng chọn điểm giao hàng'}
              hitSlop={8}
              onPress={handleBack}
              style={styles.headerButton}
            >
              <Ionicons name="arrow-back" size={22} color={colors.text.primary} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={stage === 'confirm' ? 'Chỉnh sửa địa chỉ giao hàng' : undefined}
              accessibilityHint={stage === 'confirm' ? 'Chuyển sang màn hình tìm kiếm để đổi địa chỉ' : undefined}
              disabled={stage !== 'confirm'}
              onPress={handleEditAddress}
              style={({ pressed }) => [
                styles.headerCenter,
                stage === 'confirm' && pressed ? styles.headerCenterPressed : null,
              ]}
            >
              <View style={styles.headerTitleRow}>
                <Text numberOfLines={1} style={styles.headerTitle}>
                  {stage === 'confirm' && pendingLocation
                    ? (pendingLocation.name?.trim() || primaryAddress)
                    : 'Chọn điểm giao hàng'}
                </Text>
                {stage === 'confirm' ? (
                  <Ionicons name="pencil" size={13} color={colors.brand.primary} />
                ) : null}
              </View>
              {stage === 'confirm' && pendingLocation ? (
                <Text numberOfLines={1} style={styles.headerSubtitle}>
                  {pendingLocation.address}
                </Text>
              ) : null}
            </Pressable>

            {stage === 'confirm' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sửa địa chỉ giao hàng"
                hitSlop={8}
                onPress={handleEditAddress}
                style={styles.headerEditButton}
              >
                <Text style={styles.headerEditText}>Sửa</Text>
              </Pressable>
            ) : (
              <View style={styles.headerSpacer} />
            )}
          </View>

          {stage === 'search' ? (
            <View style={styles.searchStage}>
              <View style={styles.searchShell}>
                <Ionicons name="search-outline" size={20} color={colors.brand.primary} />
                <TextInput
                  ref={searchInputRef}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Nhập địa chỉ giao hàng..."
                  placeholderTextColor={colors.text.muted}
                  selectionColor={colors.brand.primary}
                  returnKeyType="search"
                  autoCorrect={false}
                  accessibilityLabel="Tìm kiếm địa chỉ giao hàng"
                  style={styles.searchInput}
                />
                {query ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Xóa nội dung tìm kiếm"
                    hitSlop={8}
                    onPress={() => setQuery('')}
                    style={styles.clearButton}
                  >
                    <Ionicons name="close-circle" size={18} color={colors.text.muted} />
                  </Pressable>
                ) : null}
              </View>

              {locationError ? (
                <Text accessibilityLiveRegion="polite" style={styles.searchError}>{locationError}</Text>
              ) : null}

              <FlatList
                data={suggestions}
                keyExtractor={(item) => item.placeId}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={suggestions.length ? styles.resultsContent : styles.emptyContent}
                ListHeaderComponent={suggestions.length ? <Text style={styles.resultsHeading}>Kết quả gợi ý</Text> : null}
                ListFooterComponent={
                  suggestions.length > 0 && query.trim().length >= 2 ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Sử dụng địa chỉ ${query.trim()}`}
                      onPress={() => handleUseManualAddress(query.trim())}
                      style={styles.manualFooterRow}
                    >
                      <View style={styles.manualFooterIcon}>
                        <Ionicons name="pencil" size={15} color={colors.brand.primary} />
                      </View>
                      <View style={styles.resultCopy}>
                        <Text numberOfLines={1} style={styles.manualFooterTitle}>
                          Sử dụng chính xác: "{query.trim()}"
                        </Text>
                        <Text numberOfLines={1} style={styles.manualFooterSubtitle}>
                          Dùng địa chỉ này không cần chọn danh sách gợi ý
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.text.secondary} />
                    </Pressable>
                  ) : null
                }
                ListEmptyComponent={
                  <SearchEmptyState
                    query={query}
                    searchState={searchState}
                    onRetry={() => setRetryTrigger((c) => c + 1)}
                    onUseManualAddress={handleUseManualAddress}
                  />
                }
                renderItem={({ item, index }) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Chọn địa chỉ ${item.address}`}
                    onPress={() => void selectSuggestion(item)}
                    style={({ pressed }) => [
                      styles.resultRow,
                      index > 0 ? styles.resultDivider : null,
                      pressed ? styles.resultRowPressed : null,
                    ]}
                  >
                    <View style={styles.resultIcon}>
                      <Ionicons name="location-outline" size={19} color={colors.brand.primary} />
                    </View>
                    <View style={styles.resultCopy}>
                      <Text numberOfLines={1} style={styles.resultTitle}>{item.primaryText}</Text>
                      {item.secondaryText ? (
                        <Text numberOfLines={2} style={styles.resultSubtitle}>{item.secondaryText}</Text>
                      ) : null}
                    </View>
                  </Pressable>
                )}
              />

              {isResolvingLocation ? (
                <View style={styles.resolvingOverlay}>
                  <View style={styles.resolvingCard}>
                    <ActivityIndicator color={colors.brand.primary} />
                    <Text style={styles.resolvingText}>Đang tải vị trí...</Text>
                  </View>
                </View>
              ) : null}
            </View>
          ) : pendingLocation ? (
            <DeliveryLocationPreview
              location={pendingLocation}
              initialReceiverName={pendingReceiverName}
              initialReceiverPhone={pendingReceiverPhone}
              onConfirm={handleConfirmDeliveryContact}
            />
          ) : null}
        </View>
      </Modal>
    </>
  );
}

function SearchEmptyState({
  query,
  searchState,
  onRetry,
  onUseManualAddress,
}: {
  query: string;
  searchState: SearchState;
  onRetry?: () => void;
  onUseManualAddress: (address: string) => void;
}) {
  const trimmedQuery = query.trim();

  if (trimmedQuery.length < 2) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="location-outline" size={28} color={colors.text.muted} />
        <Text style={styles.emptyTitle}>Tìm điểm giao hàng</Text>
        <Text style={styles.emptySubtitle}>Nhập tên đường, địa điểm hoặc phường/quận.</Text>
      </View>
    );
  }

  if (searchState === 'loading') return null;

  if (searchState === 'error') {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="cloud-offline-outline" size={32} color={colors.text.muted} />
        <Text style={styles.emptyTitle}>Không thể tải gợi ý tự động</Text>
        <Text style={styles.emptySubtitle}>
          Dịch vụ tìm kiếm đang bận hoặc quá tải quota. Bạn có thể sử dụng trực tiếp địa chỉ vừa nhập để tiếp tục.
        </Text>

        {/* Primary Action: Use typed address directly */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Sử dụng địa chỉ ${trimmedQuery}`}
          onPress={() => onUseManualAddress(trimmedQuery)}
          style={styles.manualUseButton}
        >
          <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
          <Text style={styles.manualUseButtonText} numberOfLines={1}>
            Dùng địa chỉ: "{trimmedQuery}"
          </Text>
        </Pressable>

        {onRetry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Thử tìm lại"
            onPress={onRetry}
            style={styles.retryButton}
          >
            <Ionicons name="refresh" size={14} color={colors.brand.primary} />
            <Text style={styles.retryButtonText}>Thử lại tìm kiếm</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (searchState === 'empty') {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="search-outline" size={28} color={colors.text.muted} />
        <Text style={styles.emptyTitle}>Không tìm thấy địa chỉ gợi ý</Text>
        <Text style={styles.emptySubtitle}>
          Bạn có thể sử dụng chính xác địa chỉ đã nhập dưới đây:
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Sử dụng địa chỉ ${trimmedQuery}`}
          onPress={() => onUseManualAddress(trimmedQuery)}
          style={styles.manualUseButton}
        >
          <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
          <Text style={styles.manualUseButtonText} numberOfLines={1}>
            Dùng địa chỉ: "{trimmedQuery}"
          </Text>
        </Pressable>
      </View>
    );
  }

  return null;
}

function getPrimaryAddress(location: GoongPlaceDetail | null, value: string) {
  return location?.name?.trim() || value.split(',')[0]?.trim() || value;
}

const styles = StyleSheet.create({
  fieldGroup: {
    gap: 7,
  },
  label: {
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  required: {
    color: '#DC2626',
  },
  emptyDestinationCard: {
    alignItems: 'center',
    backgroundColor: colors.surface.card,
    borderColor: colors.border.default,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 62,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  confirmedDestinationCard: {
    alignItems: 'center',
    backgroundColor: colors.surface.card,
    borderColor: colors.border.default,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 62,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cardMainContent: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  cardTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  confirmedTitle: {
    color: colors.text.primary,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  confirmedSubtitle: {
    color: colors.text.secondary,
    fontSize: 12,
    lineHeight: 16,
    paddingLeft: 23,
  },
  destinationCardError: {
    borderColor: '#FCA5A5',
  },
  destinationCardDisabled: {
    backgroundColor: colors.surface.page,
    opacity: 0.68,
  },
  destinationCardPressed: {
    backgroundColor: colors.brand.primarySoft,
  },
  emptyCardTitle: {
    color: colors.text.primary,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  emptyCardTitleDisabled: {
    color: colors.text.muted,
  },
  emptyCardSubtitle: {
    color: colors.text.secondary,
    fontSize: 12,
    lineHeight: 16,
    paddingLeft: 23,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '500',
  },
  modalRoot: {
    backgroundColor: colors.surface.page,
    flex: 1,
  },
  modalHeader: {
    alignItems: 'center',
    backgroundColor: colors.surface.card,
    borderBottomColor: colors.border.default,
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 58,
    paddingBottom: 10,
    paddingHorizontal: 12,
  },
  headerButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  headerCenter: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  headerCenterPressed: {
    opacity: 0.65,
  },
  headerTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
  },
  headerTitle: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSubtitle: {
    color: colors.text.secondary,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 44,
  },
  headerEditButton: {
    alignItems: 'center',
    backgroundColor: colors.brand.primarySoft,
    borderRadius: 10,
    height: 32,
    justifyContent: 'center',
    minWidth: 44,
    paddingHorizontal: 10,
  },
  headerEditText: {
    color: colors.brand.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  searchStage: {
    flex: 1,
    paddingTop: 14,
  },
  searchShell: {
    alignItems: 'center',
    backgroundColor: colors.surface.card,
    borderColor: colors.border.default,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    minHeight: 54,
    paddingHorizontal: 14,
  },
  searchInput: {
    color: colors.text.primary,
    flex: 1,
    fontSize: 15,
    minHeight: 52,
  },
  clearButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 36,
  },
  searchError: {
    color: '#B42318',
    fontSize: 12,
    lineHeight: 18,
    marginHorizontal: 18,
    marginTop: 10,
  },
  resultsContent: {
    paddingBottom: 28,
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  emptyContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  resultsHeading: {
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  resultRow: {
    alignItems: 'flex-start',
    backgroundColor: colors.surface.card,
    flexDirection: 'row',
    gap: 12,
    minHeight: 62,
    paddingHorizontal: 4,
    paddingVertical: 12,
  },
  resultDivider: {
    borderTopColor: colors.border.default,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  resultRowPressed: {
    backgroundColor: colors.brand.primarySoft,
  },
  resultIcon: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  resultCopy: {
    flex: 1,
    minWidth: 0,
  },
  resultTitle: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  resultSubtitle: {
    color: colors.text.secondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 80,
  },
  emptyTitle: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySubtitle: {
    color: colors.text.secondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
    textAlign: 'center',
  },
  retryButton: {
    alignItems: 'center',
    backgroundColor: colors.brand.primarySoft,
    borderRadius: 10,
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryButtonText: {
    color: colors.brand.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  manualUseButton: {
    alignItems: 'center',
    backgroundColor: '#1E68A8',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 14,
    maxWidth: 320,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#1E68A8',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
    width: '100%',
  },
  manualUseButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  manualFooterRow: {
    alignItems: 'center',
    backgroundColor: colors.surface.card,
    borderColor: colors.border.default,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    padding: 12,
  },
  manualFooterIcon: {
    alignItems: 'center',
    backgroundColor: colors.brand.primarySoft,
    borderRadius: 10,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  manualFooterTitle: {
    color: colors.brand.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  manualFooterSubtitle: {
    color: colors.text.secondary,
    fontSize: 11,
    marginTop: 1,
  },
  resolvingOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(238, 246, 252, 0.74)',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  resolvingCard: {
    alignItems: 'center',
    backgroundColor: colors.surface.card,
    borderRadius: 16,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  resolvingText: {
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '600',
  },
});
