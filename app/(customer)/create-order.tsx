import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';

import { GoodsType, GoodsTypeSelector } from '../../components/GoodsTypeSelector';
import { TemperatureSelector } from '../../components/TemperatureSelector';
import { createOrder } from '../../services/orderApi';
import { useAuthStore } from '../../store/useAuthStore';
import { getApiErrorMessage } from '../../services/apiClient';

export default function CreateOrderScreen() {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.token);

  // Form State
  const [goodsType, setGoodsType] = useState<GoodsType>('Pharma');
  const [temperature, setTemperature] = useState<number>(-18);
  const [pickupAddress, setPickupAddress] = useState(''); // Not used by backend yet, but keep for UI completeness
  const [deliveryAddress, setDeliveryAddress] = useState('');
  
  // New backend fields
  const [itemName, setItemName] = useState('');
  const [expectedWeightKg, setExpectedWeightKg] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [packagingType, setPackagingType] = useState('Thùng Carton');
  const [lengthCm, setLengthCm] = useState('');
  const [widthCm, setWidthCm] = useState('');
  const [heightCm, setHeightCm] = useState('');
  
  // Image State
  const [imageUri, setImageUri] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (
      !deliveryAddress.trim() ||
      !itemName.trim() ||
      !expectedWeightKg.trim() ||
      !quantity.trim() ||
      !lengthCm.trim() ||
      !widthCm.trim() ||
      !heightCm.trim() ||
      !imageUri
    ) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ thông tin bắt buộc và đính kèm hình ảnh.');
      return;
    }

    if (!accessToken) {
      Alert.alert('Lỗi', 'Bạn chưa đăng nhập.');
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await createOrder(accessToken, {
        ItemName: itemName.trim(),
        Category: goodsType,
        TempCondition: temperature,
        ExpectedWeightKg: parseFloat(expectedWeightKg),
        Quantity: parseInt(quantity, 10),
        PackagingType: packagingType,
        LengthCm: parseFloat(lengthCm),
        WidthCm: parseFloat(widthCm),
        HeightCm: parseFloat(heightCm),
        DestAddressText: deliveryAddress.trim(),
        DocumentImageUri: imageUri,
      });

      if (!response.success) {
        throw new Error(response.message || 'Tạo đơn thất bại.');
      }

      Alert.alert('Thành công', `Tạo đơn thành công!\nMã vận đơn: ${response.data?.trackingCode}`, [
        { text: 'OK', onPress: () => router.replace('/(customer)/status') }
      ]);
    } catch (error) {
      Alert.alert('Lỗi', getApiErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const renderInput = (
    icon: keyof typeof Ionicons.glyphMap,
    iconColor: string,
    placeholder: string,
    value: string,
    onChangeText: (t: string) => void,
    keyboardType: 'default' | 'numeric' = 'default'
  ) => (
    <View className="w-full flex-row items-center pr-2 bg-[#F8F9FA] border border-[#DAC2B6]/60 rounded-[14px] h-[52px]">
      <View className="w-12 h-[52px] items-center justify-center">
        <View className={`w-5 h-5 rounded-full items-center justify-center shadow-md border-2 border-white`} style={{ backgroundColor: iconColor }}>
          <View className="w-1.5 h-1.5 bg-white rounded-full" />
        </View>
      </View>
      <TextInput
        className="flex-1 h-[52px] text-[#3A1F04] font-medium text-[13px]"
        placeholder={placeholder}
        placeholderTextColor="#877369"
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
      />
      <View className="p-2 flex-row items-center gap-1.5 bg-white border border-[#DAC2B6]/60 rounded-xl shadow-sm">
        <Ionicons name={icon} size={16} color={iconColor} />
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-[#F5F2F0]"
    >
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Map Header Section */}
        <View className="h-[210px] w-full bg-[#EAE6E1] relative overflow-hidden border-b border-[#DAC2B6]/60">
          <View className="absolute inset-0 opacity-10 bg-[#8B4513]" />

          <View className="absolute left-[90px] top-[90px] flex-col items-center -ml-5 -mt-10">
            <View className="w-10 h-10 rounded-full bg-white shadow-sm items-center justify-center border-2 border-[#8B4513] mb-1.5 overflow-hidden">
              <View className="absolute inset-0 bg-[#8B4513]/5" />
              <Ionicons name="cube-outline" size={20} color="#8B4513" />
            </View>
            <View className="w-2 h-2 bg-[#8B4513] border-2 border-white rounded-full shadow-sm" />
          </View>

          <View className="absolute left-[310px] top-[140px] flex-col items-center -ml-5 -mt-10">
            <View className="w-10 h-10 rounded-full bg-[#006E0A] shadow-sm items-center justify-center border-2 border-white mb-1.5">
              <Ionicons name="location-sharp" size={20} color="white" />
            </View>
            <View className="w-2 h-2 bg-[#006E0A] border-2 border-white rounded-full shadow-sm" />
          </View>
        </View>

        <View className="px-5 -mt-10 relative z-20 gap-5">
          
          {/* Journey Info */}
          <View className="bg-white rounded-2xl p-6 shadow-sm border border-[#DAC2B6]/50 gap-4">
            <Text className="text-[#8B4513] font-bold text-base mb-1">Thông Tin Hành Trình</Text>
            {renderInput('locate', '#8B4513', 'Nhập điểm lấy hàng...', pickupAddress, setPickupAddress)}
            {renderInput('locate', '#006E0A', 'Nhập điểm giao hàng (Bắt buộc)...', deliveryAddress, setDeliveryAddress)}
          </View>

          {/* Cargo Info */}
          <View className="bg-white rounded-2xl p-6 shadow-sm border border-[#DAC2B6]/50 gap-4">
            <Text className="text-[#8B4513] font-bold text-base mb-1">Thông Tin Hàng Hóa</Text>
            
            {renderInput('cube', '#8B4513', 'Tên hàng hóa...', itemName, setItemName)}
            
            <View className="flex-row gap-3">
              <View className="flex-1">{renderInput('scale', '#8B4513', 'Nặng (KG)', expectedWeightKg, setExpectedWeightKg, 'numeric')}</View>
              <View className="flex-1">{renderInput('apps', '#8B4513', 'Số lượng', quantity, setQuantity, 'numeric')}</View>
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1">{renderInput('resize', '#8B4513', 'Dài (cm)', lengthCm, setLengthCm, 'numeric')}</View>
              <View className="flex-1">{renderInput('resize', '#8B4513', 'Rộng (cm)', widthCm, setWidthCm, 'numeric')}</View>
              <View className="flex-1">{renderInput('resize', '#8B4513', 'Cao (cm)', heightCm, setHeightCm, 'numeric')}</View>
            </View>

            {renderInput('briefcase', '#8B4513', 'Loại bao bì (vd: Thùng Carton)', packagingType, setPackagingType)}

            {/* Image Picker */}
            <Pressable
              onPress={pickImage}
              className="mt-2 w-full h-[120px] rounded-[14px] border-2 border-dashed border-[#DAC2B6]/60 bg-[#F8F9FA] items-center justify-center overflow-hidden"
            >
              {imageUri ? (
                <Image source={{ uri: imageUri }} className="w-full h-full" resizeMode="cover" />
              ) : (
                <View className="items-center">
                  <Ionicons name="camera-outline" size={32} color="#8B4513" />
                  <Text className="text-[#877369] font-medium text-[13px] mt-2">Chụp hoặc tải ảnh kiện hàng</Text>
                </View>
              )}
            </Pressable>
          </View>

          {/* Goods Type Selection */}
          <GoodsTypeSelector value={goodsType} onChange={setGoodsType} />

          {/* Temperature Settings */}
          <TemperatureSelector temperature={temperature} setTemperature={setTemperature} />

          <View className="items-center pt-2 pb-4">
            <Text className="text-[10px] font-medium text-[#877369] uppercase tracking-widest leading-relaxed">
              ColdChainX • Giữ trọn tinh hoa di sản
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Fixed Bottom Action */}
      <View className="absolute bottom-0 inset-x-0 h-32 flex justify-end pb-8 px-5 z-30 pointer-events-none">
        <Pressable
          onPress={handleSubmit}
          disabled={isLoading}
          className={`w-full h-14 bg-[#8B4513] rounded-[16px] items-center justify-center shadow-md pointer-events-auto active:opacity-80 ${isLoading ? 'opacity-70' : ''}`}
        >
          <Text className="text-[#FFC29F] font-bold text-[18px] tracking-wide">
            {isLoading ? 'ĐANG TẠO ĐƠN...' : 'LÊN ĐƠN GIAO HÀNG'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
