import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { deliveryApi, CheckinDriverResponse, HandoverConfirmResponse, RecordCodPaymentResponse, DepartResponse, TripDeliveryProgressResponse } from '../../../../services/deliveryApi';
import { tripApi, TripRouteResponse, OptimizedTripStopDto } from '../../../../services/tripApi';
import { AppButton } from '../../../../components/AppButton';
import { SignaturePad } from '../../../../components/SignaturePad';
import { useFocusEffect } from '@react-navigation/native';
import { AppInput } from '../../../../components/AppInput';

// Mock Location since expo-location is not installed
const Location = {
  requestForegroundPermissionsAsync: async () => ({ status: 'granted' }),
  getCurrentPositionAsync: async () => ({ coords: { latitude: 10.762622, longitude: 106.660172 } })
};

export default function StopDetailScreen() {
  const params = useLocalSearchParams<{ stopId: string, tripId: string }>();
  const stopId = params.stopId as string;
  const tripId = params.tripId as string;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [stopData, setStopData] = useState<OptimizedTripStopDto | null>(null);
  const [progress, setProgress] = useState<TripDeliveryProgressResponse | null>(null);
  const [checkinData, setCheckinData] = useState<CheckinDriverResponse | null>(null);
  
  const [step, setStep] = useState<'INITIAL' | 'CHECKED_IN' | 'SIGNATURE' | 'COD' | 'DEPARTURE'>('INITIAL');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Handover state
  const [receiverName, setReceiverName] = useState('');
  const [epodId, setEpodId] = useState<string>('');
  const [codAmountDue, setCodAmountDue] = useState<number>(0);
  
  // Departure state
  const [newSealCode, setNewSealCode] = useState('');

  const loadData = useCallback(async () => {
    if (!stopId || !tripId) return;
    try {
      setLoading(true);
      const [routeResult, progressResult] = await Promise.all([
        tripApi.getTripRoute(tripId),
        deliveryApi.getTripDeliveryProgress(tripId)
      ]);
      const currentStop = routeResult.optimizedStops.find(s => s.stopId === stopId);
      if (currentStop) setStopData(currentStop);
      setProgress(progressResult);
    } catch (error: any) {
      Alert.alert('Lỗi', error.message || 'Không thể tải chi tiết điểm dừng');
    } finally {
      setLoading(false);
    }
  }, [stopId, tripId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleCheckIn = async () => {
    try {
      setIsProcessing(true);
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Quyền vị trí', 'Vui lòng cấp quyền vị trí để Check-in.');
        setIsProcessing(false);
        return;
      }

      let location = await Location.getCurrentPositionAsync();
      
      const res = await deliveryApi.checkInStop(stopId, {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });
      setCheckinData(res);
      setStep('CHECKED_IN');
      Alert.alert('Check-in thành công', 'Bạn đã đến điểm giao hàng.');
    } catch (error: any) {
      Alert.alert('Lỗi Check-in', error.message || 'Không thể check-in.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleHandoverNext = () => {
    if (!receiverName.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên người nhận.');
      return;
    }
    setStep('SIGNATURE');
  };

  const handleSignatureConfirm = async (signatureUrl: string) => {
    if (!stopData?.orders?.[0]?.orderId) {
      Alert.alert('Lỗi', 'Không tìm thấy OrderId cho điểm dừng này.');
      return;
    }
    try {
      setIsProcessing(true);
      
      const formData = new FormData();
      formData.append('OrderId', stopData.orders[0].orderId);
      formData.append('ReceiverName', receiverName);
      
      // Convert mock base64 to Blob for fetch
      const res = await fetch(signatureUrl);
      const blob = await res.blob();
      formData.append('SignatureFile', blob, 'signature.png');
      
      const result = await deliveryApi.confirmHandover(stopId, formData);
      setEpodId(result.epodId);
      setCodAmountDue(result.codAmountDue);
      
      if (result.codAmountDue > 0) {
        setStep('COD');
      } else {
        setStep('DEPARTURE');
      }
    } catch (error: any) {
      Alert.alert('Lỗi Ký nhận', error.message || 'Không thể xác nhận bàn giao.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCodPayment = async (method: 'CASH' | 'QR') => {
    try {
      setIsProcessing(true);
      const formData = new FormData();
      formData.append('PaymentMethod', method);
      formData.append('CodAmountPaid', codAmountDue.toString());
      
      await deliveryApi.recordCodPayment(epodId, formData);
      Alert.alert('Thành công', 'Đã ghi nhận thanh toán COD.');
      setStep('DEPARTURE');
    } catch (error: any) {
      Alert.alert('Lỗi COD', error.message || 'Không thể ghi nhận COD.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeparture = async () => {
    try {
      setIsProcessing(true);
      await deliveryApi.departStop(stopId, { newSealCode });
      Alert.alert('Hoàn tất', 'Đã xác nhận rời điểm giao.');
      router.back();
    } catch (error: any) {
      Alert.alert('Lỗi Rời đi', error.message || 'Không thể xác nhận rời đi.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F6F8F2]">
        <ActivityIndicator size="large" color="#8B4513" />
      </View>
    );
  }

  if (!stopData) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F6F8F2]">
        <Text>Không tìm thấy dữ liệu điểm dừng.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F6F8F2]" edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        <View className="mb-6 rounded-2xl bg-white p-4 shadow-sm border border-amber-200">
          <Text className="text-sm text-amber-700 font-bold mb-1">ĐIỂM DỪNG {stopData.optimizedSequence}</Text>
          <Text className="text-lg font-bold text-amber-950 mb-2">{stopData.address}</Text>
          <Text className="text-sm text-amber-700">{stopData.orders.length} Đơn hàng • {stopData.lpns.length} LPN</Text>
        </View>

        {step === 'INITIAL' && (
          <View className="items-center mt-10">
            <Ionicons name="location" size={64} color="#8B4513" className="mb-4" />
            <Text className="text-base text-amber-900 text-center mb-6">
              Bạn đã đến điểm giao hàng? Hãy Check-in để bắt đầu dỡ hàng.
            </Text>
            <View style={{ width: '100%' }}>
              <AppButton 
                label="Check-in ngay" 
                onPress={handleCheckIn} 
                loading={isProcessing} 
              />
            </View>
          </View>
        )}

        {step === 'CHECKED_IN' && (
          <View>
            <Text className="text-lg font-bold text-amber-950 mb-4">Danh sách hàng dỡ (LPN)</Text>
            {checkinData?.lpnsToUnload.map((lpn) => (
              <View key={lpn.lpnId} className="mb-3 rounded-xl bg-white p-4 border border-amber-200">
                <Text className="font-bold text-amber-900">{lpn.lpnCode}</Text>
                <Text className="text-sm text-amber-700">{lpn.itemName} • SL: {lpn.quantity}</Text>
              </View>
            ))}
            
            <View className="mt-6">
              <AppInput 
                label="Tên người nhận hàng" 
                value={receiverName}
                onChangeText={setReceiverName}
                placeholder="Nhập tên người nhận..."
              />
              <View className="mt-4">
                <AppButton 
                  label="Tiếp tục (Bàn giao)" 
                  onPress={handleHandoverNext} 
                />
              </View>
            </View>
          </View>
        )}

        {step === 'SIGNATURE' && (
          <View>
            <Text className="text-lg font-bold text-amber-950 mb-4">Khách hàng ký nhận</Text>
            <SignaturePad 
              onOK={handleSignatureConfirm} 
              onClear={() => {}}
            />
            {isProcessing && <ActivityIndicator size="small" color="#8B4513" className="mt-4" />}
          </View>
        )}

        {step === 'COD' && (
          <View className="items-center mt-10">
            <Ionicons name="cash-outline" size={64} color="#15803d" className="mb-4" />
            <Text className="text-lg font-bold text-green-800 mb-2">Thu hộ COD</Text>
            <Text className="text-3xl font-bold text-green-900 mb-6">
              {codAmountDue.toLocaleString('vi-VN')} ₫
            </Text>
            <View className="flex-row w-full mt-2" style={{ gap: 16 }}>
              <View className="flex-1">
                <AppButton 
                  label="Thu Tiền Mặt" 
                  onPress={() => handleCodPayment('CASH')} 
                  loading={isProcessing} 
                />
              </View>
              <View className="flex-1">
                <AppButton 
                  label="Khách quét QR" 
                  onPress={() => handleCodPayment('QR')} 
                  loading={isProcessing} 
                  variant="secondary"
                />
              </View>
            </View>
          </View>
        )}

        {step === 'DEPARTURE' && (
          <View className="mt-10">
            <Ionicons name="shield-checkmark" size={64} color="#8B4513" className="self-center mb-4" />
            <Text className="text-lg font-bold text-amber-950 mb-2 text-center">Niêm phong thùng xe</Text>
            <Text className="text-sm text-amber-700 mb-6 text-center">
              Vui lòng kẹp chì mới và nhập mã chì để xác nhận rời điểm giao.
            </Text>
            <AppInput 
              label="Mã chì mới (Seal Code)" 
              value={newSealCode}
              onChangeText={setNewSealCode}
              placeholder="Nhập mã chì..."
            />
            <View className="mt-6">
              <AppButton 
                label="Xác nhận Rời đi" 
                onPress={handleDeparture} 
                loading={isProcessing} 
              />
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
