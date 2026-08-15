import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';

import { AppButton } from '../../components/AppButton';
import { AppInfoRow } from '../../components/AppInfoRow';
import { AppMessage } from '../../components/AppMessage';
import { EmptyState } from '../../components/EmptyState';
import { PdfViewerModal } from '../../components/PdfViewerModal';
import { StatusBadge } from '../../components/StatusBadge';
import { WH_COLORS, formatDateTimeVi } from '../../constants/warehouseTheme';
import { getApiErrorMessage } from '../../services/apiClient';
import {
  downloadInboundReceiptPdf,
  getInboundReceiptById,
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);
  const [openingPdfId, setOpeningPdfId] = useState<string | null>(null);
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);
  const [viewingPdfCode, setViewingPdfCode] = useState<string | null>(null);

  const loadReceipts = useCallback(async (refreshing = false) => {
    if (refreshing) setIsRefreshing(true);
    else setIsLoading(true);
    setMessage(null);

    try {
      const result = await getInboundReceipts(token);
      setReceipts(result.data);
    } catch (error) {
      setMessage(getApiErrorMessage(error));
    } finally {
      if (refreshing) setIsRefreshing(false);
      else setIsLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      loadReceipts();
    }, [loadReceipts])
  );

  const handleOpenDetail = async (receiptId: string) => {
    if (loadingDetailId || openingPdfId) return;

    setLoadingDetailId(receiptId);
    try {
      const detail = await getInboundReceiptById(token, receiptId);
      setSelectedReceipt(detail);
    } catch (error) {
      Alert.alert('Không thể tải chi tiết', getApiErrorMessage(error));
    } finally {
      setLoadingDetailId(null);
    }
  };

  const handleOpenPdf = async (receiptId: string, receiptCode: string) => {
    if (loadingDetailId || openingPdfId) return;

    if (!token) {
      Alert.alert('Chưa đăng nhập', 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      return;
    }

    setOpeningPdfId(receiptId);
    try {
      const dataUrl = await downloadInboundReceiptPdf(token, receiptId);
      setViewingPdfCode(receiptCode);
      setPdfDataUrl(dataUrl);
    } catch (error) {
      Alert.alert('Không thể mở Phiếu nhập kho', getApiErrorMessage(error));
    } finally {
      setOpeningPdfId(null);
    }
  };

  const handleCloseDetail = () => {
    setSelectedReceipt(null);
  };

  const handleClosePdf = () => {
    setPdfDataUrl(null);
    setViewingPdfCode(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: WH_COLORS.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 36 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadReceipts(true)}
            colors={[WH_COLORS.primary]}
            tintColor={WH_COLORS.primary}
          />
        }
      >
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
            onPress={() => loadReceipts()}
            disabled={isLoading || isRefreshing}
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
        {message ? (
          <View style={{ gap: 12 }}>
            <AppMessage text={message} tone="error" />
            <AppButton icon="refresh-outline" label="Thử lại" onPress={() => loadReceipts()} variant="secondary" />
          </View>
        ) : null}
        {!isLoading && !message && receipts.length === 0 ? (
          <EmptyState icon="document-text-outline" message="Chưa có phiếu nhập kho." />
        ) : null}

        <View style={{ gap: 12 }}>
          {receipts.map((receipt) => {
            const isDetailLoading = loadingDetailId === receipt.receiptId;
            const isPdfLoading = openingPdfId === receipt.receiptId;
            const isAnyActionRunning = Boolean(loadingDetailId || openingPdfId);

            return (
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
                  <StatusBadge status={getReceiptTypeLabel(receipt.status)} />
                </View>
                <AppInfoRow label="Thời gian đến" value={formatDateTimeVi(receipt.arrivalTime)} />
                <AppInfoRow label="Người giao" value={receipt.driverName || 'Chưa cập nhật'} />
                <View style={{ marginTop: 16, flexDirection: 'row', gap: 8 }}>
                  <AppButton
                    icon="eye-outline"
                    label="Chi tiết"
                    onPress={() => handleOpenDetail(receipt.receiptId)}
                    compact
                    loading={isDetailLoading}
                    disabled={isAnyActionRunning}
                  />
                  <AppButton
                    icon="open-outline"
                    label="Mở PDF"
                    onPress={() => handleOpenPdf(receipt.receiptId, receipt.receiptCode)}
                    compact
                    variant="secondary"
                    loading={isPdfLoading}
                    disabled={isAnyActionRunning}
                  />
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <Modal
        visible={Boolean(selectedReceipt)}
        transparent
        animationType="fade"
        onRequestClose={handleCloseDetail}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 16,
          }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: 480,
              maxHeight: '85%',
              borderRadius: 20,
              backgroundColor: WH_COLORS.cardBg,
              padding: 20,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.15,
              shadowRadius: 16,
              elevation: 6,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottomWidth: 1,
                borderBottomColor: WH_COLORS.cardBorder,
                paddingBottom: 12,
                marginBottom: 12,
              }}
            >
              <View>
                <Text style={{ fontSize: 18, fontWeight: '700', color: WH_COLORS.textPrimary }}>
                  Chi tiết phiếu nhập
                </Text>
                {selectedReceipt ? (
                  <Text style={{ marginTop: 2, fontSize: 12, color: WH_COLORS.primary, fontWeight: '600' }}>
                    {selectedReceipt.receiptCode}
                  </Text>
                ) : null}
              </View>
              <Pressable
                onPress={handleCloseDetail}
                hitSlop={8}
                style={{
                  padding: 6,
                  borderRadius: 16,
                  backgroundColor: WH_COLORS.background,
                }}
              >
                <Ionicons name="close" size={20} color={WH_COLORS.textPrimary} />
              </Pressable>
            </View>

            {selectedReceipt ? (
              <ScrollView
                style={{ flexGrow: 0 }}
                contentContainerStyle={{ paddingBottom: 12 }}
                showsVerticalScrollIndicator
              >
                <AppInfoRow label="Mã phiếu" value={selectedReceipt.receiptCode} />
                <AppInfoRow label="Loại phiếu" value={getReceiptTypeLabel(selectedReceipt.status)} />
                <AppInfoRow label="Đơn hàng" value={selectedReceipt.orderId} />
                <AppInfoRow label="Người giao" value={selectedReceipt.driverName || 'Chưa cập nhật'} />
                <AppInfoRow
                  label="Biển số xe"
                  value={selectedReceipt.truckPlate && selectedReceipt.truckPlate !== 'N/A' ? selectedReceipt.truckPlate : 'Chưa cập nhật'}
                />
                <AppInfoRow label="Thời gian đến" value={formatDateTimeVi(selectedReceipt.arrivalTime)} />
                <AppInfoRow label="Thời gian hoàn tất" value={formatDateTimeVi(selectedReceipt.completionTime)} />

                <Text style={{ marginTop: 16, marginBottom: 8, fontSize: 14, fontWeight: '700', color: WH_COLORS.textPrimary }}>
                  Danh sách hàng hóa ({selectedReceipt.items.length})
                </Text>

                {selectedReceipt.items.length === 0 ? (
                  <Text style={{ marginTop: 4, fontSize: 12, color: WH_COLORS.textSecondary }}>
                    Chưa có thông tin hàng hóa.
                  </Text>
                ) : (
                  selectedReceipt.items.map((item, index) => (
                    <View
                      key={item.receiptItemId || String(index)}
                      style={{
                        marginTop: 8,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: WH_COLORS.cardBorder,
                        padding: 12,
                        backgroundColor: WH_COLORS.background,
                      }}
                    >
                      <Text style={{ fontWeight: '700', color: WH_COLORS.textPrimary }}>
                        {item.itemName}
                      </Text>
                      <AppInfoRow label="Dự kiến" value={String(item.expectedQuantity)} />
                      <AppInfoRow label="Thực tế" value={String(item.actualQuantity)} />
                      <AppInfoRow label="Tình trạng" value={getConditionStatusLabel(item.conditionStatus)} />
                    </View>
                  ))
                )}
              </ScrollView>
            ) : null}

            <View style={{ marginTop: 16, flexDirection: 'row', gap: 8 }}>
              {selectedReceipt ? (
                <AppButton
                  icon="open-outline"
                  label="Mở PDF"
                  onPress={() => {
                    const id = selectedReceipt.receiptId;
                    const code = selectedReceipt.receiptCode;
                    handleCloseDetail();
                    handleOpenPdf(id, code);
                  }}
                  compact
                />
              ) : null}
              <AppButton
                icon="close-outline"
                label="Đóng"
                onPress={handleCloseDetail}
                variant="secondary"
                compact={Boolean(selectedReceipt)}
              />
            </View>
          </View>
        </View>
      </Modal>

      <PdfViewerModal
        visible={Boolean(pdfDataUrl)}
        title="Phiếu nhập kho"
        subtitle={viewingPdfCode}
        base64Data={pdfDataUrl}
        onClose={handleClosePdf}
        primaryColor={WH_COLORS.primary}
        backgroundColor={WH_COLORS.background}
        cardBackgroundColor={WH_COLORS.cardBg}
        textColor={WH_COLORS.textPrimary}
        borderColor={WH_COLORS.cardBorder}
      />
    </View>
  );
}

function getReceiptTypeLabel(status?: string | null) {
  return status?.trim().toUpperCase() === 'INBOUND' ? 'Phiếu nhập kho' : 'Phiếu kho';
}

function getConditionStatusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    GOOD: 'Đạt',
    DAMAGED: 'Hư hỏng',
    DISCREPANCY: 'Có sai lệch',
  };

  return labels[status?.trim().toUpperCase() ?? ''] ?? 'Chưa xác định';
}
