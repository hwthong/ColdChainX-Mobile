import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useFocusEffect } from 'expo-router';

import { AppButton } from '../../components/AppButton';
import { AppInfoRow } from '../../components/AppInfoRow';
import { AppMessage } from '../../components/AppMessage';
import { EmptyState } from '../../components/EmptyState';
import { StatusBadge } from '../../components/StatusBadge';
import { WH_COLORS, formatDateTimeVi } from '../../constants/warehouseTheme';
import { getApiErrorMessage } from '../../services/apiClient';
import {
  getInboundReceiptById,
  getInboundReceiptPdf,
  getInboundReceipts,
  type InboundReceiptDetailDto,
  type InboundReceiptDto,
} from '../../services/inboundApi';
import { useAuthStore } from '../../store/useAuthStore';

export default function WarehouseReceiptsScreen() {
  const token = useAuthStore((state) => state.token);
  const [receipts, setReceipts] = useState<InboundReceiptDto[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<InboundReceiptDetailDto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadReceipts = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      const result = await getInboundReceipts(token);
      setReceipts(result);
    } catch (error) {
      setMessage(getApiErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      loadReceipts();
    }, [loadReceipts])
  );

  const openDetail = async (receiptId: string) => {
    setMessage(null);
    try {
      const detail = await getInboundReceiptById(token, receiptId);
      setSelectedReceipt(detail);
    } catch (error) {
      setMessage(getApiErrorMessage(error));
    }
  };

  const openPdf = async (receiptId: string) => {
    await WebBrowser.openBrowserAsync(encodeURI(getInboundReceiptPdf(receiptId)));
  };

  return (
    <View style={{ flex: 1, backgroundColor: WH_COLORS.background }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 36 }}>
        {/* Header row */}
        <View style={{ marginBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ fontSize: 24, fontWeight: '700', color: WH_COLORS.textPrimary }}>
              Danh sách phiếu nhập
            </Text>
            <Text style={{ marginTop: 4, fontSize: 12, fontWeight: '500', color: WH_COLORS.textSecondary }}>
              Phiếu nhập kho đã tạo
            </Text>
          </View>
          <Pressable
            onPress={loadReceipts}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              borderRadius: 12,
              backgroundColor: WH_COLORS.primary,
              paddingHorizontal: 16,
              paddingVertical: 12,
            }}
          >
            <Ionicons name="refresh-outline" size={16} color="#FFFFFF" />
            <Text style={{ fontWeight: '700', color: '#FFFFFF' }}>Làm mới</Text>
          </Pressable>
        </View>

        {isLoading ? <ActivityIndicator style={{ marginVertical: 16 }} color={WH_COLORS.primary} /> : null}
        {message ? <AppMessage text={message} tone="error" /> : null}
        {!isLoading && receipts.length === 0 ? (
          <EmptyState icon="document-text-outline" message="Chưa có phiếu nhập kho." />
        ) : null}

        {/* Receipt list */}
        <View style={{ gap: 12 }}>
          {receipts.map((receipt) => (
            <View
              key={receipt.receiptId}
              style={{
                borderRadius: 16,
                backgroundColor: WH_COLORS.cardBg,
                padding: 16,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: WH_COLORS.textPrimary }}>
                    {receipt.receiptCode}
                  </Text>
                  <Text style={{ marginTop: 4, fontSize: 12, color: WH_COLORS.textSecondary }}>
                    {receipt.orderId}
                  </Text>
                </View>
                <StatusBadge status={receipt.status || 'N/A'} showVietnameseLabel />
              </View>
              <AppInfoRow label="Thời gian đến" value={formatDateTimeVi(receipt.arrivalTime)} />
              <AppInfoRow label="Người giao" value={receipt.driverName || 'N/A'} />
              <View style={{ marginTop: 16, flexDirection: 'row', gap: 8 }}>
                <AppButton icon="eye-outline" label="Chi tiết" onPress={() => openDetail(receipt.receiptId)} compact />
                <AppButton icon="open-outline" label="Mở PDF" onPress={() => openPdf(receipt.receiptId)} compact variant="secondary" />
              </View>
            </View>
          ))}
        </View>

        {/* Receipt detail panel */}
        {selectedReceipt ? (
          <View
            style={{
              marginTop: 20,
              borderRadius: 16,
              backgroundColor: WH_COLORS.cardBg,
              padding: 16,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.04,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '700', color: WH_COLORS.textPrimary }}>
              Chi tiết phiếu nhập
            </Text>
            <AppInfoRow label="Mã phiếu" value={selectedReceipt.receiptCode} />
            <AppInfoRow label="Trạng thái" value={selectedReceipt.status || 'N/A'} />
            <AppInfoRow label="Đơn hàng" value={selectedReceipt.orderId} />
            <AppInfoRow label="Người giao" value={selectedReceipt.driverName || 'N/A'} />

            <Text style={{ marginTop: 16, fontSize: 14, fontWeight: '700', color: WH_COLORS.textPrimary }}>
              Danh sách hàng
            </Text>
            {selectedReceipt.items.length === 0 ? (
              <Text style={{ marginTop: 8, fontSize: 12, color: WH_COLORS.textSecondary }}>
                Chưa có thông tin hàng hóa.
              </Text>
            ) : (
              selectedReceipt.items.map((item) => (
                <View
                  key={item.receiptItemId}
                  style={{
                    marginTop: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: WH_COLORS.cardBorder,
                    padding: 12,
                  }}
                >
                  <Text style={{ fontWeight: '700', color: WH_COLORS.textPrimary }}>{item.itemName}</Text>
                  <AppInfoRow label="Dự kiến" value={String(item.expectedQuantity)} />
                  <AppInfoRow label="Thực tế" value={String(item.actualQuantity)} />
                  <AppInfoRow label="Tình trạng" value={item.conditionStatus} />
                </View>
              ))
            )}

            <View style={{ marginTop: 16 }}>
              <AppButton
                icon="close-outline"
                label="Đóng"
                onPress={() => setSelectedReceipt(null)}
                variant="secondary"
              />
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
