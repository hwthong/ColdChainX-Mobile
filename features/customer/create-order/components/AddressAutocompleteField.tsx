import React, { forwardRef, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { customerColors, customerControl, customerRadius } from '../../../../constants/customerTheme';
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
  const [isFocused, setIsFocused] = useState(false);
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
      <View
        className="flex-row items-center px-4"
        style={{
          backgroundColor: customerColors.surface,
          borderColor: error ? '#FCA5A5' : isFocused ? customerColors.primary : customerColors.border,
          borderRadius: customerRadius.control,
          borderWidth: 1,
          minHeight: customerControl.height,
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <Ionicons name="location-outline" size={18} color="#8B4513" />
        <TextInput
          ref={ref}
          className="flex-1 px-3 text-[14px] font-medium text-[#3A1F04]"
          style={{ minHeight: customerControl.height }}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          editable={!disabled}
          placeholder="Nhập số nhà, đường, phường/xã..."
          placeholderTextColor="#877369"
          accessibilityLabel={`${label}${required ? ', bắt buộc' : ''}`}
          accessibilityHint={error || 'Nhập ít nhất 3 ký tự để nhận gợi ý địa chỉ'}
          accessibilityState={{ disabled }}
          selectionColor="#8B4513"
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
        <View
          className="overflow-hidden shadow-sm"
          style={{
            backgroundColor: customerColors.surface,
            borderColor: customerColors.border,
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
              className="flex-row gap-3 px-4 py-3 active:bg-[#F8F3EF]"
              style={index > 0 ? { borderTopColor: customerColors.borderSubtle, borderTopWidth: 1 } : undefined}
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
