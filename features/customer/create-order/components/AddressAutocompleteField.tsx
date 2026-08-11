import React, { forwardRef, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../../constants/colors';
import { customerControl, customerRadius } from '../../../../constants/customerTheme';
import { searchGoongAddressSuggestions, type GoongAddressSuggestion } from '../../../../services/goongPlacesApi';

type AddressAutocompleteFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
  onSelectAddress: (address: string) => void;
  error?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
};

type SearchState = 'idle' | 'loading' | 'empty' | 'error';

export const AddressAutocompleteField = forwardRef<TextInput, AddressAutocompleteFieldProps>(function AddressAutocompleteField(
  {
    value,
    onChangeText,
    onSelectAddress,
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
  const requestIdRef = useRef(0);
  const selectedAddressRef = useRef<string | null>(null);

  useEffect(() => {
    if (selectedAddressRef.current && value === selectedAddressRef.current) return;
    selectedAddressRef.current = null;

    const query = value.trim();
    if (query.length < 3) {
      setSuggestions([]);
      setSearchState('idle');
      return;
    }

    const currentRequestId = requestIdRef.current + 1;
    requestIdRef.current = currentRequestId;
    setSearchState('loading');

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const results = await searchGoongAddressSuggestions(query);
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
  }, [value]);

  const clearValue = () => {
    requestIdRef.current += 1;
    selectedAddressRef.current = null;
    setSuggestions([]);
    setSearchState('idle');
    onChangeText('');
  };

  const selectSuggestion = (suggestion: GoongAddressSuggestion) => {
    requestIdRef.current += 1;
    selectedAddressRef.current = suggestion.address.trim();
    setSuggestions([]);
    setSearchState('idle');
    onSelectAddress(suggestion.address);
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
          backgroundColor: colors.surface.card,
          borderColor: error ? '#FCA5A5' : isFocused ? colors.border.focus : colors.border.default,
          borderRadius: customerRadius.control,
          borderWidth: 1,
          minHeight: customerControl.height,
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <Ionicons name="location-outline" size={18} color={colors.brand.primary} />
        <TextInput
          ref={ref}
          className="flex-1 px-3 text-[14px] font-medium"
          style={{ minHeight: customerControl.height, color: colors.text.primary }}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
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
            <Ionicons name="close-circle" size={19} color={colors.text.secondary} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text accessibilityLiveRegion="polite" className="text-xs font-medium text-red-600">{error}</Text> : null}
      {showSuggestions && suggestions.length > 0 ? (
        <View
          className="overflow-hidden shadow-sm"
          style={{
            backgroundColor: colors.surface.card,
            borderColor: colors.border.default,
            borderRadius: customerRadius.control,
            borderWidth: 1,
          }}
        >
          {suggestions.map((suggestion, index) => (
            <Pressable
              key={suggestion.placeId}
              onPress={() => selectSuggestion(suggestion)}
              accessibilityRole="button"
              accessibilityLabel={`Chọn địa chỉ ${suggestion.address}`}
              style={({ pressed }) => ({ backgroundColor: pressed ? colors.surface.selected : colors.surface.card })}
              className="flex-row gap-3 px-4 py-3"
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
    </View>
  );
});
