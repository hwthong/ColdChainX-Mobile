import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppPressable as Pressable } from '../../../../components/AppPressable';
import { PdfViewerModal } from '../../../../components/PdfViewerModal';
import { colors } from '../../../../constants/colors';
import { WH_COLORS } from '../../../../constants/warehouseTheme';
import { driverApi } from '../../../../services/driverApi';
import { useAuthStore } from '../../../../store/useAuthStore';
import { downloadDocumentAsBase64 } from '../../../../utils/documentViewer';

export default function DriverTripDocumentsScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  
  const [loading, setLoading] = useState(true);
  const [waybillUrl, setWaybillUrl] = useState('');
  const [error, setError] = useState('');
  const [viewingPdf, setViewingPdf] = useState<string | null>(null);
  const [openingPdf, setOpeningPdf] = useState(false);

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

  const handleOpenWaybill = async () => {
    if (!waybillUrl) return;
    setOpeningPdf(true);
    try {
      const base64Data = await downloadDocumentAsBase64(waybillUrl, token);
      setViewingPdf(base64Data);
    } catch (err: any) {
      Alert.alert('Không thể mở tài liệu', err.message || 'Lỗi tải file');
    } finally {
      setOpeningPdf(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: WH_COLORS.background }}>
        <ActivityIndicator size="large" color={WH_COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: WH_COLORS.background }}>
      {/* AppBar Header */}
      <View
        style={{
          backgroundColor: colors.surface.card,
          borderColor: colors.border.default,
          paddingTop: Math.max(insets.top + 6, 48),
        }}
        className="border-b px-4 pb-3 shadow-sm"
      >
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => router.back()}
            style={{ backgroundColor: colors.brand.primarySoft }}
            className="rounded-full p-2.5"
          >
            <Ionicons name="arrow-back" size={18} color={colors.brand.primary} />
          </Pressable>
          <View className="flex-1 px-3">
            <Text style={{ color: colors.text.secondary }} className="text-[10px] font-bold uppercase tracking-wider">
              Hồ Sơ Chứng Từ
            </Text>
            <Text numberOfLines={1} style={{ color: colors.text.primary }} className="text-base font-bold">
              Chuyến #{id?.slice(0, 8).toUpperCase()}
            </Text>
          </View>
          <View className="w-10" />
        </View>
      </View>

      <View className="flex-1 p-5">
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: WH_COLORS.textPrimary, marginBottom: 16 }}>
          Chứng từ & E-Waybill
        </Text>

        {error ? (
          <View style={{ backgroundColor: '#FEF2F2', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#FECACA', marginBottom: 20 }}>
            <Text style={{ color: '#991B1B' }}>{error}</Text>
          </View>
        ) : (
          <Pressable
            onPress={handleOpenWaybill}
            disabled={openingPdf}
            style={({ pressed }) => ({
              backgroundColor: WH_COLORS.cardBg,
              padding: 20,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: WH_COLORS.cardBorder,
              flexDirection: 'row',
              alignItems: 'center',
              opacity: pressed || openingPdf ? 0.7 : 1,
            })}
          >
            <View style={{ backgroundColor: '#EEF2FF', padding: 12, borderRadius: 12, marginRight: 16 }}>
              <Ionicons name="document-text" size={32} color="#3730A3" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: WH_COLORS.textPrimary }}>Giấy Đi Đường (E-Waybill)</Text>
              <Text style={{ fontSize: 13, color: WH_COLORS.textSecondary, marginTop: 4 }}>
                {openingPdf ? 'Đang tải PDF...' : 'Bản PDF điện tử'}
              </Text>
            </View>
            {openingPdf ? (
              <ActivityIndicator size="small" color={WH_COLORS.primary} />
            ) : (
              <Ionicons name="eye-outline" size={24} color={WH_COLORS.primary} />
            )}
          </Pressable>
        )}
      </View>

      <PdfViewerModal
        visible={Boolean(viewingPdf)}
        title="Giấy Đi Đường (E-Waybill)"
        subtitle={`Chuyến xe #${id?.slice(0, 8).toUpperCase()}`}
        base64Data={viewingPdf}
        onClose={() => setViewingPdf(null)}
        primaryColor={WH_COLORS.primary}
        backgroundColor={WH_COLORS.background}
        cardBackgroundColor={WH_COLORS.cardBg}
        textColor={WH_COLORS.textPrimary}
        borderColor={WH_COLORS.cardBorder}
      />
    </View>
  );
}
