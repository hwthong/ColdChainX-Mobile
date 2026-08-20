import React, { forwardRef, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../../constants/colors';
import { customerRadius } from '../../../../constants/customerTheme';
import {
  getGoongPlaceDetail,
  searchGoongAddressSuggestions,
  type GoongAddressSuggestion,
  type GoongPlaceDetail,
} from '../../../../services/goongPlacesApi';
import { DeliveryLocationPreview } from './DeliveryLocationPreview';

type AddressAutocompleteFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
  onSelectAddress: (address: string) => void;
  onFocus?: () => void;
  destinationCity?: string;
  error?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
};

type SearchState = 'idle' | 'loading' | 'empty' | 'error';
type LocationState = 'idle' | 'loading' | 'ready' | 'error';

export const AddressAutocompleteField = forwardRef<TextInput, AddressAutocompleteFieldProps>(function AddressAutocompleteField(
  {
    value,
    onChangeText,
    onSelectAddress,
    onFocus,
    destinationCity,
    error,
    label = 'Địa chỉ giao hàng',
    required = true,
    disabled = false,
  },
  ref
) {
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<GoongAddressSuggestion[]>([]);
  const [searchState, setSearchState] = useState<SearchState>('idle');
  const [locationState, setLocationState] = useState<LocationState>('idle');
  const [selectedSuggestion, setSelectedSuggestion] = useState<GoongAddressSuggestion | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<GoongPlaceDetail | null>(null);
  const requestIdRef = useRef(0);
  const locationRequestIdRef = useRef(0);
  const selectedAddressRef = useRef<string | null>(null);

  useEffect(() => {
    if (selectedAddressRef.current && value === selectedAddressRef.current) return;
    locationRequestIdRef.current += 1;
    selectedAddressRef.current = null;
    setSelectedSuggestion(null);
    setSelectedLocation(null);
    setLocationState('idle');

    const rawQuery = value.trim();
    if (rawQuery.length < 3) {
      setSuggestions([]);
      setSearchState('idle');
      return;
    }

    const searchQuery = destinationCity && !rawQuery.toLowerCase().includes(destinationCity.toLowerCase())
      ? `${rawQuery}, ${destinationCity}`
      : rawQuery;

    const currentRequestId = requestIdRef.current + 1;
    requestIdRef.current = currentRequestId;
    setSearchState('loading');

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const results = await searchGoongAddressSuggestions(searchQuery);
          if (requestIdRef.current !== currentRequestId) return;
          setSuggestions(results);
          setSearchState(results.length > 0 ? 'idle' : 'empty');
        } catch {
          if (requestIdRef.current !== currentRequestId) return;
          setSuggestions([]);
          setSearchState('error');
        }
      })();
    }, 300);

    return () => clearTimeout(timer);
  }, [value, destinationCity]);

  const clearValue = () => {
    requestIdRef.current += 1;
    locationRequestIdRef.current += 1;
    selectedAddressRef.current = null;
    setSuggestions([]);
    setSearchState('idle');
    setSelectedSuggestion(null);
    setSelectedLocation(null);
    setLocationState('idle');
    onChangeText('');
  };

  const resolveSelectedLocation = async (suggestion: GoongAddressSuggestion) => {
    const currentRequestId = locationRequestIdRef.current + 1;
    locationRequestIdRef.current = currentRequestId;
    setLocationState('loading');
    setSelectedLocation(null);

    try {
      const location = await getGoongPlaceDetail(suggestion.placeId);
      if (locationRequestIdRef.current !== currentRequestId) return;
      setSelectedLocation(location);
      setLocationState('ready');
    } catch {
      if (locationRequestIdRef.current !== currentRequestId) return;
      setSelectedLocation(null);
      setLocationState('error');
    }
  };

  const selectSuggestion = (suggestion: GoongAddressSuggestion) => {
    requestIdRef.current += 1;
    selectedAddressRef.current = suggestion.address.trim();
    setSelectedSuggestion(suggestion);
    setSuggestions([]);
    setSearchState('idle');
    Keyboard.dismiss();
    onSelectAddress(suggestion.address);
    void resolveSelectedLocation(suggestion);
  };

  const changeValue = (nextValue: string) => {
    locationRequestIdRef.current += 1;
    selectedAddressRef.current = null;
    setSelectedSuggestion(null);
    setSelectedLocation(null);
    setLocationState('idle');
    onChangeText(nextValue);
  };

  const showSuggestions = value.trim().length >= 3 && !disabled;

  return (
    <View className="gap-1.5">
      <Text style={{ color: colors.text.primary }} className="text-[13px] font-bold">
        {label} {required ? <Text className="text-red-600">*</Text> : null}
      </Text>
      <View
        className="flex-row items-center px-4"
        style={{
          backgroundColor: '#FFFFFF',
          borderColor: error ? '#FCA5A5' : isFocused ? colors.border.focus : 'rgba(189, 214, 231, 0.5)',
          borderRadius: 16,
          borderWidth: 1,
          minHeight: 54,
          opacity: disabled ? 0.6 : 1,
          shadowColor: isFocused ? colors.brand.primary : '#173b59',
          shadowOffset: { width: 0, height: isFocused ? 2 : 1 },
          shadowOpacity: isFocused ? 0.08 : 0.03,
          shadowRadius: isFocused ? 4 : 2,
          elevation: isFocused ? 2 : 1,
        }}
      >
        <Ionicons name="location-outline" size={19} color={colors.brand.primary} />
        <TextInput
          ref={ref}
          className="flex-1 px-3 text-[14px] font-medium"
          style={{ minHeight: 54, color: colors.text.primary }}
          value={value}
          onChangeText={changeValue}
          onFocus={() => {
            setIsFocused(true);
            onFocus?.();
          }}
          onBlur={() => setIsFocused(false)}
          editable={!disabled}
          placeholder="Nhập số nhà, đường, phường/xã..."
          placeholderTextColor={colors.text.muted}
          accessibilityLabel={`${label}${required ? ', bắt buộc' : ''}`}
          accessibilityHint={error || 'Nhập ít nhất 3 ký tự để nhận gợi ý địa chỉ'}
          accessibilityState={{ disabled }}
          selectionColor={colors.brand.primary}
          returnKeyType="done"
        />
        {searchState === 'loading' ? <ActivityIndicator size="small" color={colors.brand.primary} accessibilityLabel="Đang tải gợi ý địa chỉ" /> : null}
        {value.length > 0 && !disabled ? (
          <Pressable onPress={clearValue} accessibilityRole="button" accessibilityLabel="Xóa địa chỉ giao hàng" className="h-10 w-10 items-center justify-center">
            <Ionicons name="close-circle" size={19} color={colors.text.muted} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text accessibilityLiveRegion="polite" className="text-xs font-medium text-red-600">{error}</Text> : null}
      {showSuggestions && suggestions.length > 0 ? (
        <View
          className="overflow-hidden"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.98)',
            borderColor: 'rgba(189, 214, 231, 0.45)',
            borderRadius: 18,
            borderWidth: 1,
            shadowColor: '#173b59',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.08,
            shadowRadius: 12,
            elevation: 5,
          }}
        >
          {suggestions.map((suggestion, index) => (
            <Pressable
              key={suggestion.placeId}
              onPress={() => selectSuggestion(suggestion)}
              accessibilityRole="button"
              accessibilityLabel={`Chọn địa chỉ ${suggestion.address}`}
              style={({ pressed }) => ({
                backgroundColor: pressed ? colors.brand.primarySoft : '#FFFFFF',
                borderTopWidth: index > 0 ? 1 : 0,
                borderTopColor: 'rgba(238, 246, 252, 0.8)',
              })}
              className="flex-row gap-3 px-4 py-3.5"
            >
              <Ionicons name="location-outline" size={18} color={colors.brand.primary} />
              <View className="flex-1">
                <Text style={{ color: colors.text.primary }} className="text-sm font-semibold" numberOfLines={2}>{suggestion.primaryText}</Text>
                {suggestion.secondaryText ? <Text style={{ color: colors.text.secondary }} className="mt-0.5 text-xs leading-5" numberOfLines={2}>{suggestion.secondaryText}</Text> : null}
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
      {showSuggestions && searchState === 'empty' ? <Text style={{ color: colors.text.secondary }} className="text-xs leading-5">Không tìm thấy địa chỉ phù hợp.</Text> : null}
      {showSuggestions && searchState === 'error' ? <Text accessibilityLiveRegion="polite" style={{ color: colors.text.secondary }} className="text-xs leading-5">Không thể tải gợi ý địa chỉ. Bạn vẫn có thể nhập địa chỉ thủ công.</Text> : null}
      {!selectedSuggestion && searchState !== 'error' ? (
        <View className="flex-row items-start gap-2 px-1 pt-1">
          <Ionicons name="map-outline" size={15} color={colors.text.muted} />
          <Text style={{ color: colors.text.muted }} className="flex-1 text-[11px] leading-4">
            Chọn một địa chỉ trong danh sách gợi ý để kiểm tra vị trí trên bản đồ.
          </Text>
        </View>
      ) : null}
      {locationState === 'loading' ? (
        <View
          accessibilityLiveRegion="polite"
          className="flex-row items-center gap-3 px-4 py-3.5"
          style={{
            backgroundColor: colors.surface.page,
            borderColor: colors.border.default,
            borderRadius: customerRadius.control,
            borderWidth: 1,
          }}
        >
          <ActivityIndicator size="small" color={colors.brand.primary} />
          <Text style={{ color: colors.text.secondary }} className="flex-1 text-xs font-medium">
            Đang xác định chính xác vị trí giao hàng...
          </Text>
        </View>
      ) : null}
      {locationState === 'error' && selectedSuggestion ? (
        <View
          accessibilityLiveRegion="polite"
          className="gap-3 px-4 py-3.5"
          style={{
            backgroundColor: '#FFF7ED',
            borderColor: '#FED7AA',
            borderRadius: customerRadius.control,
            borderWidth: 1,
          }}
        >
          <View className="flex-row items-start gap-2.5">
            <Ionicons name="warning-outline" size={18} color="#C2410C" />
            <Text className="flex-1 text-xs font-medium leading-5 text-orange-800">
              Chưa thể tải vị trí trên bản đồ. Hãy thử lại hoặc chọn một địa chỉ khác.
            </Text>
          </View>
          <Pressable
            onPress={() => void resolveSelectedLocation(selectedSuggestion)}
            accessibilityRole="button"
            accessibilityLabel="Thử tải lại vị trí giao hàng"
            className="min-h-10 self-start justify-center rounded-xl border border-orange-300 px-3"
          >
            <Text className="text-xs font-bold text-orange-800">Thử lại</Text>
          </Pressable>
        </View>
      ) : null}
      {locationState === 'ready' && selectedLocation ? (
        <DeliveryLocationPreview location={selectedLocation} />
      ) : null}
    </View>
  );
});
