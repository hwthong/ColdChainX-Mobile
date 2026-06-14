import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GoodsType, GoodsTypeSelector } from '../../components/GoodsTypeSelector';
import { TemperatureSelector } from '../../components/TemperatureSelector';
import { useRouter } from 'expo-router';

interface Quote {
  id: string;
  price: string;
}

export default function CreateOrderScreen() {
  const router = useRouter();
  const [goodsType, setGoodsType] = useState<GoodsType>('Pharma');
  const [temperature, setTemperature] = useState<number>(-18);
  const [pickupAddress, setPickupAddress] = useState('Kho lạnh Mega Hub, Bình Dương');
  const [deliveryAddress, setDeliveryAddress] = useState('Bệnh viện Chợ Rẫy, Q5, TP.HCM');
  const [quotePopup, setQuotePopup] = useState<Quote | null>(null);

  const handleSubmit = () => {
    if (!pickupAddress.trim() || !deliveryAddress.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ điểm lấy hàng và điểm giao hàng.');
      return;
    }
    
    // Show Quote Popup
    setQuotePopup({
      id: 'ORD-' + Math.floor(Math.random() * 10000),
      price: '2,450,000 VND',
    });
  };

  const handleAcceptQuote = () => {
    setQuotePopup(null);
    // Navigate to status tab
    router.replace('/(customer)/status');
  };

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
        {/* Map Header Section - Heritage Style */}
        <View className="h-[210px] w-full bg-[#EAE6E1] relative overflow-hidden border-b border-[#DAC2B6]/60">
          {/* Mock Map Background */}
          <View className="absolute inset-0 opacity-10 bg-[#8B4513]" />

          {/* Pick Up Pin */}
          <View className="absolute left-[90px] top-[90px] flex-col items-center -ml-5 -mt-10">
            <View className="w-10 h-10 rounded-full bg-white shadow-sm items-center justify-center border-2 border-[#8B4513] mb-1.5 overflow-hidden">
              <View className="absolute inset-0 bg-[#8B4513]/5" />
              <Ionicons name="cube-outline" size={20} color="#8B4513" />
            </View>
            <View className="w-2 h-2 bg-[#8B4513] border-2 border-white rounded-full shadow-sm" />
          </View>

          {/* Drop Off Pin */}
          <View className="absolute left-[310px] top-[140px] flex-col items-center -ml-5 -mt-10">
            <View className="w-10 h-10 rounded-full bg-[#006E0A] shadow-sm items-center justify-center border-2 border-white mb-1.5">
              <Ionicons name="location-sharp" size={20} color="white" />
            </View>
            <View className="w-2 h-2 bg-[#006E0A] border-2 border-white rounded-full shadow-sm" />
          </View>
        </View>

        <View className="px-5 -mt-10 relative z-20 gap-5">
          {/* Locations Input */}
          <View className="bg-white rounded-2xl p-6 shadow-sm border border-[#DAC2B6]/50 gap-4">
            <Text className="text-[#8B4513] font-bold text-base mb-1">Thông Tin Hành Trình</Text>

            {/* Pick Up Input */}
            <View className="w-full flex-row items-center pr-2 bg-[#F8F9FA] border border-[#DAC2B6]/60 rounded-[14px] mb-4 h-[52px]">
              <View className="w-12 h-[52px] items-center justify-center">
                <View className="w-5 h-5 bg-[#8B4513] rounded-full items-center justify-center shadow-md border-2 border-white">
                  <View className="w-1.5 h-1.5 bg-white rounded-full" />
                </View>
              </View>
              <TextInput
                className="flex-1 h-[52px] text-[#3A1F04] font-medium text-[13px]"
                placeholder="Nhập điểm lấy hàng..."
                placeholderTextColor="#877369"
                value={pickupAddress}
                onChangeText={setPickupAddress}
              />
              <Pressable className="p-2 flex-row items-center gap-1.5 bg-white border border-[#DAC2B6]/60 rounded-xl shadow-sm">
                <Ionicons name="locate" size={16} color="#8B4513" />
              </Pressable>
            </View>

            {/* Drop Off Input */}
            <View className="w-full flex-row items-center pr-2 bg-[#F8F9FA] border border-[#DAC2B6]/60 rounded-[14px] h-[52px]">
              <View className="w-12 h-[52px] items-center justify-center">
                <View className="w-5 h-5 bg-[#006E0A] rounded-full items-center justify-center shadow-md border-2 border-white">
                  <View className="w-1.5 h-1.5 bg-white rounded-full" />
                </View>
              </View>
              <TextInput
                className="flex-1 h-[52px] text-[#3A1F04] font-medium text-[13px]"
                placeholder="Nhập điểm giao hàng..."
                placeholderTextColor="#877369"
                value={deliveryAddress}
                onChangeText={setDeliveryAddress}
              />
              <Pressable className="p-2 flex-row items-center gap-1.5 bg-white border border-[#DAC2B6]/60 rounded-xl shadow-sm">
                <Ionicons name="locate" size={16} color="#006E0A" />
              </Pressable>
            </View>
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
        {/* Fake gradient background using an overlay view with opacity could be used here, but keeping it simple */}
        <Pressable
          onPress={handleSubmit}
          className="w-full h-14 bg-[#8B4513] rounded-[16px] items-center justify-center shadow-md pointer-events-auto active:opacity-80"
        >
          <Text className="text-[#FFC29F] font-bold text-[18px] tracking-wide">
            LÊN ĐƠN GIAO HÀNG
          </Text>
        </Pressable>
      </View>

      {/* Quote Popup Overlay */}
      <Modal visible={!!quotePopup} transparent animationType="fade">
        <View className="flex-1 bg-black/70 justify-center items-center p-6">
          <View className="w-full bg-white rounded-3xl p-6 shadow-2xl border border-[#DAC2B6]/50">
            <Pressable
              onPress={() => setQuotePopup(null)}
              className="absolute top-4 right-4 bg-gray-100 rounded-full p-1"
            >
              <Ionicons name="close" size={20} color="#666" />
            </Pressable>

            <View className="flex-row items-center gap-2 mt-2">
              <View className="w-10 h-10 rounded-full bg-[#006E0A]/10 items-center justify-center">
                <Ionicons name="checkmark-circle" size={24} color="#006E0A" />
              </View>
              <Text className="text-[#191C1D] font-bold text-xl">Đã xác nhận</Text>
            </View>

            <Text className="text-[#877369] font-medium text-sm border-b border-gray-200 pb-4 mt-2">
              Mã vận đơn:{' '}
              <Text className="text-[#8B4513] font-bold">{quotePopup?.id}</Text>
            </Text>

            <View className="bg-[#F8F9FA] rounded-[20px] p-5 border border-[#DAC2B6]/30 items-center my-4">
              <Text className="text-[#54433A] text-xs font-semibold uppercase tracking-wider mb-2">
                Tổng chi phí dự kiến
              </Text>
              <Text className="text-3xl font-bold text-[#8B4513] mb-1">
                {quotePopup?.price}
              </Text>
              <Text className="text-[#877369] text-[10px] italic">
                * Đã bao gồm phí giám sát nhiệt độ 24/7
              </Text>
            </View>

            <Pressable
              onPress={handleAcceptQuote}
              className="w-full h-14 bg-[#006E0A] rounded-xl items-center justify-center active:opacity-80"
            >
              <Text className="text-white font-bold text-lg">CHUYỂN SANG ĐANG GIAO</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
