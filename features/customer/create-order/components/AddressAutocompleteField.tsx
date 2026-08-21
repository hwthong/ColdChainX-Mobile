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

  useEffect(() => {
    if (!isOpen || stage !== 'search') return;

    const rawQuery = query.trim();
    if (rawQuery.length < 3) {
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
      void searchGoongAddressSuggestions(searchQuery, controller.signal)
        .then((results) => {
          setSuggestions(results);
          setSearchState(results.length > 0 ? 'idle' : 'empty');
        })
        .catch((requestError: unknown) => {
          if (requestError instanceof Error && requestError.name === 'AbortError') return;
          setSuggestions([]);
          setSearchState('error');
        });
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [destinationCity, isOpen, query, stage]);

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
      setLocationError('Chưa thể xác định vị trí này. Vui lòng thử lại hoặc chọn địa chỉ khác.');
    } finally {
      setIsResolvingLocation(false);
    }
  };

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
  const secondaryAddress = getSecondaryAddress(selectedLocation, value);

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
            accessibilityLabel={`Sửa điểm giao hàng ${primaryAddress}, người nhận ${receiverName || ''}`}
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
            {/* Top Row: Address */}
            <View style={styles.cardAddressRow}>
              <View style={styles.cardIcon}>
                <Ionicons name="location" size={20} color={colors.brand.primary} />
              </View>
              <View style={styles.cardCopy}>
                <Text numberOfLines={1} style={styles.selectedTitle}>
                  {primaryAddress}
                </Text>
                {secondaryAddress ? (
                  <Text numberOfLines={2} style={styles.selectedSubtitle}>
                    {secondaryAddress}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Divider */}
            <View style={styles.cardDivider} />

            {/* Bottom Row: Receiver */}
            <View style={styles.cardReceiverRow}>
              <View style={styles.receiverIcon}>
                <Ionicons name="person-outline" size={17} color={colors.brand.primary} />
              </View>
              <View style={styles.receiverCopy}>
                <Text numberOfLines={1} style={styles.receiverNameText}>
                  {receiverName || 'Chưa nhập họ tên'}
                </Text>
                <Text numberOfLines={1} style={styles.receiverPhoneText}>
                  {receiverPhone || 'Chưa nhập số điện thoại'}
                </Text>
              </View>
              <View style={styles.editBadge}>
                <Text style={styles.editText}>Sửa</Text>
                <Ionicons name="chevron-forward" size={15} color={colors.brand.primary} />
              </View>
            </View>
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
            <View style={styles.cardIcon}>
              <Ionicons name="location" size={20} color={colors.brand.primary} />
            </View>
            <View style={styles.cardCopy}>
              <Text numberOfLines={1} style={styles.emptyCardTitle}>
                {disabled ? 'Chọn điểm dừng trên tuyến trước' : 'Chọn điểm giao hàng'}
              </Text>
              <Text numberOfLines={1} style={styles.emptyCardSubtitle}>
                {disabled ? 'Cần chọn điểm dừng để mở bản đồ' : 'Địa chỉ, tên và SĐT người nhận'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.text.secondary} />
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
            <View style={styles.headerCenter}>
              <Text numberOfLines={1} style={styles.headerTitle}>
                {stage === 'confirm' && pendingLocation
                  ? (pendingLocation.name?.trim() || primaryAddress)
                  : 'Chọn điểm giao hàng'}
              </Text>
              {stage === 'confirm' && pendingLocation && pendingLocation.address ? (
                <Text numberOfLines={2} style={styles.headerSubtitle}>
                  {pendingLocation.address}
                </Text>
              ) : null}
            </View>
            <View style={styles.headerSpacer} />
          </View>

          {stage === 'search' ? (
            <View style={styles.searchStage}>
              <View style={styles.searchShell}>
                <Ionicons name="search-outline" size={20} color={colors.brand.primary} />
                <TextInput
                  ref={searchInputRef}
                  autoFocus
                  value={query}
                  onChangeText={(nextQuery) => {
                    setQuery(nextQuery);
                    setLocationError(null);
                  }}
                  placeholder="Nhập địa chỉ giao hàng..."
                  placeholderTextColor={colors.text.muted}
                  selectionColor={colors.brand.primary}
                  returnKeyType="search"
                  accessibilityLabel="Tìm địa chỉ giao hàng"
                  style={styles.searchInput}
                />
                {searchState === 'loading' ? (
                  <ActivityIndicator size="small" color={colors.brand.primary} />
                ) : query ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Xóa nội dung tìm kiếm"
                    hitSlop={6}
                    onPress={() => setQuery('')}
                    style={styles.clearButton}
                  >
                    <Ionicons name="close-circle" size={20} color={colors.text.muted} />
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
                ListHeaderComponent={suggestions.length ? <Text style={styles.resultsHeading}>Kết quả</Text> : null}
                ListEmptyComponent={<SearchEmptyState query={query} searchState={searchState} />}
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

function SearchEmptyState({ query, searchState }: { query: string; searchState: SearchState }) {
  if (query.trim().length < 3) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="location-outline" size={26} color={colors.text.muted} />
        <Text style={styles.emptyTitle}>Tìm điểm giao hàng</Text>
        <Text style={styles.emptySubtitle}>Nhập ít nhất 3 ký tự để tìm địa chỉ.</Text>
      </View>
    );
  }
  if (searchState === 'loading') return null;
  if (searchState === 'error') {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="cloud-offline-outline" size={26} color={colors.text.muted} />
        <Text style={styles.emptyTitle}>Không thể tải kết quả</Text>
        <Text style={styles.emptySubtitle}>Kiểm tra kết nối và thử tìm lại.</Text>
      </View>
    );
  }
  if (searchState === 'empty') {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="search-outline" size={26} color={colors.text.muted} />
        <Text style={styles.emptyTitle}>Không tìm thấy địa chỉ</Text>
        <Text style={styles.emptySubtitle}>Thử thêm tên đường, phường hoặc quận.</Text>
      </View>
    );
  }
  return null;
}

function getPrimaryAddress(location: GoongPlaceDetail | null, value: string) {
  return location?.name?.trim() || value.split(',')[0]?.trim() || value;
}

function getSecondaryAddress(location: GoongPlaceDetail | null, value: string) {
  if (location?.name) return value;
  return value.split(',').slice(1).join(',').trim();
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
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  confirmedDestinationCard: {
    backgroundColor: colors.surface.card,
    borderColor: colors.border.default,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  cardAddressRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  cardDivider: {
    backgroundColor: colors.border.default,
    height: StyleSheet.hairlineWidth,
    marginLeft: 46,
  },
  cardReceiverRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  receiverIcon: {
    alignItems: 'center',
    backgroundColor: colors.brand.primarySoft,
    borderRadius: 10,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  receiverCopy: {
    flex: 1,
    minWidth: 0,
  },
  receiverNameText: {
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  receiverPhoneText: {
    color: colors.text.secondary,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 1,
  },
  editBadge: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
    paddingLeft: 6,
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
  cardIcon: {
    alignItems: 'center',
    backgroundColor: colors.brand.primarySoft,
    borderRadius: 12,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  cardCopy: {
    flex: 1,
    minWidth: 0,
  },
  emptyCardTitle: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  emptyCardSubtitle: {
    color: colors.text.secondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  selectedTitle: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  selectedSubtitle: {
    color: colors.text.secondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  editText: {
    color: colors.brand.primary,
    fontSize: 13,
    fontWeight: '700',
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
