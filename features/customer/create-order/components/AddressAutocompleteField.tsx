import React, { forwardRef, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
  const [suggestions, setSuggestions] = useState<GoongAddressSuggestion[]>([]);
  const [searchState, setSearchState] = useState<SearchState>('idle');
  const requestIdRef = useRef(0);
  const selectedAddressRef = useRef<string | null>(null);

  useEffect(() => {
    const query = value.trim();
    if (selectedAddressRef.current === query) {
      selectedAddressRef.current = null;
      return;
    }
    if (query.length < 3 || disabled) {
      setSuggestions([]);
      setSearchState('idle');
      return;
    }

    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearchState('loading');
      try {
        const results = await searchGoongAddressSuggestions(query, controller.signal);
        if (requestId !== requestIdRef.current) return;
        setSuggestions(results);
        setSearchState(results.length ? 'idle' : 'empty');
      } catch {
        if (controller.signal.aborted || requestId !== requestIdRef.current) return;
        setSuggestions([]);
        setSearchState('error');
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [disabled, value]);

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
      <Text className="text-[13px] font-bold text-[#3A1F04]">
        {label} {required ? <Text className="text-red-600">*</Text> : null}
      </Text>
      <View className={[
        'min-h-[52px] flex-row items-center rounded-[14px] border bg-[#F8F9FA] px-4',
        error ? 'border-red-300' : 'border-[#DAC2B6]/60',
      ].join(' ')}>
        <Ionicons name="location-outline" size={18} color="#8B4513" />
        <TextInput
          ref={ref}
          className="min-h-[52px] flex-1 px-3 text-[14px] font-medium text-[#3A1F04]"
          value={value}
          onChangeText={onChangeText}
          editable={!disabled}
          placeholder="Nhập số nhà, đường, phường/xã..."
          placeholderTextColor="#877369"
          accessibilityLabel={`${label}${required ? ', bắt buộc' : ''}`}
          accessibilityHint={error || 'Nhập ít nhất 3 ký tự để nhận gợi ý địa chỉ'}
          returnKeyType="done"
        />
        {searchState === 'loading' ? <ActivityIndicator size="small" color="#8B4513" accessibilityLabel="Đang tải gợi ý địa chỉ" /> : null}
        {value.length > 0 && !disabled ? (
          <Pressable onPress={clearValue} accessibilityRole="button" accessibilityLabel="Xóa địa chỉ giao hàng" className="h-10 w-10 items-center justify-center">
            <Ionicons name="close-circle" size={19} color="#877369" />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text accessibilityLiveRegion="polite" className="text-xs font-medium text-red-600">{error}</Text> : null}
      {showSuggestions && suggestions.length > 0 ? (
        <View className="overflow-hidden rounded-xl border border-[#DAC2B6]/60 bg-white shadow-sm">
          {suggestions.map((suggestion, index) => (
            <Pressable
              key={suggestion.placeId}
              onPress={() => selectSuggestion(suggestion)}
              accessibilityRole="button"
              accessibilityLabel={`Chọn địa chỉ ${suggestion.address}`}
              className={['flex-row gap-3 px-4 py-3 active:bg-[#F8F3EF]', index > 0 ? 'border-t border-[#DAC2B6]/40' : ''].join(' ')}
            >
              <Ionicons name="location-outline" size={18} color="#8B4513" />
              <View className="flex-1">
                <Text className="text-sm font-semibold text-[#3A1F04]" numberOfLines={2}>{suggestion.primaryText}</Text>
                {suggestion.secondaryText ? <Text className="mt-0.5 text-xs leading-5 text-[#877369]" numberOfLines={2}>{suggestion.secondaryText}</Text> : null}
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
      {showSuggestions && searchState === 'empty' ? <Text className="text-xs leading-5 text-[#877369]">Không tìm thấy địa chỉ phù hợp.</Text> : null}
      {showSuggestions && searchState === 'error' ? <Text accessibilityLiveRegion="polite" className="text-xs leading-5 text-[#877369]">Không thể tải gợi ý địa chỉ. Bạn vẫn có thể nhập địa chỉ thủ công.</Text> : null}
    </View>
  );
});
