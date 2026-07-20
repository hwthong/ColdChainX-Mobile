import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WH_COLORS } from '../../../../constants/warehouseTheme';
import { driverApi } from '../../../../services/driverApi';

export default function DriverTripDocumentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [waybillUrl, setWaybillUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        if (!id) return;
        const url = await driverApi.getWaybillUrl(id);
        setWaybillUrl(url);
      } catch (err: any) {
        setError(err.message || 'Không thể tải E-Waybill');
      } finally {
        setLoading(false);
      }
    };
    fetchDocs();
  }, [id]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: WH_COLORS.background }}>
        <ActivityIndicator size="large" color={WH_COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: WH_COLORS.background, padding: 20 }}>
      
      <Text style={{ fontSize: 20, fontWeight: 'bold', color: WH_COLORS.textPrimary, marginBottom: 20 }}>
        Chứng từ & Waybill
      </Text>

      {error ? (
        <View style={{ backgroundColor: '#FEF2F2', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#FECACA', marginBottom: 20 }}>
          <Text style={{ color: '#991B1B' }}>{error}</Text>
        </View>
      ) : (
        <Pressable
          onPress={() => Linking.openURL(waybillUrl)}
          style={({ pressed }) => ({
            backgroundColor: WH_COLORS.cardBg,
            padding: 20,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: WH_COLORS.cardBorder,
            flexDirection: 'row',
            alignItems: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <View style={{ backgroundColor: '#EEF2FF', padding: 12, borderRadius: 8, marginRight: 16 }}>
            <Ionicons name="document-text" size={32} color="#3730A3" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: WH_COLORS.textPrimary }}>Giấy Đi Đường (E-Waybill)</Text>
            <Text style={{ fontSize: 13, color: WH_COLORS.textSecondary, marginTop: 4 }}>Bản PDF điện tử</Text>
          </View>
          <Ionicons name="open-outline" size={24} color={WH_COLORS.textSecondary} />
        </Pressable>
      )}

      <Pressable onPress={() => router.back()} style={{ marginTop: 'auto', padding: 16, backgroundColor: WH_COLORS.primaryLight, borderRadius: 12, alignItems: 'center' }}>
        <Text style={{ color: WH_COLORS.primary, fontWeight: 'bold' }}>Quay lại</Text>
      </Pressable>
    </View>
  );
}
