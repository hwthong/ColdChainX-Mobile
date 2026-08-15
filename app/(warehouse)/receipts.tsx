import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { WebView } from 'react-native-webview';

import { AppButton } from '../../components/AppButton';
import { AppInfoRow } from '../../components/AppInfoRow';
import { AppMessage } from '../../components/AppMessage';
import { EmptyState } from '../../components/EmptyState';
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

      <Modal
        visible={Boolean(pdfDataUrl)}
        animationType="slide"
        onRequestClose={handleClosePdf}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: WH_COLORS.background }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: WH_COLORS.cardBorder,
              backgroundColor: WH_COLORS.cardBg,
            }}
          >
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: WH_COLORS.textPrimary }} numberOfLines={1}>
                Phiếu nhập kho
              </Text>
              {viewingPdfCode ? (
                <Text style={{ fontSize: 12, color: WH_COLORS.primary, fontWeight: '600' }} numberOfLines={1}>
                  {viewingPdfCode}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={handleClosePdf}
              hitSlop={8}
              style={{
                padding: 8,
                borderRadius: 20,
                backgroundColor: WH_COLORS.background,
              }}
            >
              <Ionicons name="close" size={22} color={WH_COLORS.textPrimary} />
            </Pressable>
          </View>

          {pdfDataUrl ? (
            <WebView
              originWhitelist={['*']}
              source={{ html: getPdfJsHtml(pdfDataUrl, viewingPdfCode ?? 'REC') }}
              style={{ flex: 1 }}
              allowFileAccess
              allowUniversalAccessFromFileURLs
              javaScriptEnabled
              domStorageEnabled
              scalesPageToFit
              mixedContentMode="always"
              startInLoadingState
              renderLoading={() => (
                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: WH_COLORS.background,
                  }}
                >
                  <ActivityIndicator size="large" color={WH_COLORS.primary} />
                  <Text style={{ marginTop: 12, fontSize: 13, color: WH_COLORS.textSecondary }}>
                    Đang hiển thị Phiếu nhập kho...
                  </Text>
                </View>
              )}
            />
          ) : null}
        </SafeAreaView>
      </Modal>
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

function getPdfJsHtml(base64Data: string, receiptCode: string): string {
  const rawBase64 = base64Data.includes('base64,') ? base64Data.split('base64,')[1] : base64Data;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0, user-scalable=yes">
  <title>Phiếu nhập kho - ${receiptCode}</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      background-color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      width: 100%;
      min-height: 100%;
      -webkit-text-size-adjust: 100%;
    }
    body {
      padding: 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    #loading {
      margin-top: 40px;
      color: #475569;
      font-size: 14px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }
    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid #cbd5e1;
      border-top-color: #0284c7;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    #container {
      width: 100%;
      max-width: 800px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      align-items: center;
    }
    canvas {
      width: 100% !important;
      height: auto !important;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      border-radius: 6px;
      background-color: #ffffff;
    }
    #error {
      display: none;
      margin-top: 40px;
      padding: 16px;
      background: #fee2e2;
      color: #991b1b;
      border-radius: 8px;
      font-size: 14px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div id="loading">
    <div class="spinner"></div>
    <div>Đang kết xuất tài liệu Phiếu nhập kho...</div>
  </div>
  <div id="error"></div>
  <div id="container"></div>

  <script>
    try {
      const rawData = atob("${rawBase64}");
      const uint8Array = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; i++) {
        uint8Array[i] = rawData.charCodeAt(i);
      }

      if (window.pdfjsLib) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        pdfjsLib.getDocument({ data: uint8Array }).promise
          .then(async function(pdf) {
            const loadingEl = document.getElementById('loading');
            if (loadingEl) loadingEl.style.display = 'none';
            const container = document.getElementById('container');

            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
              const page = await pdf.getPage(pageNum);
              const viewport = page.getViewport({ scale: 2.0 });
              const canvas = document.createElement('canvas');
              const context = canvas.getContext('2d');
              canvas.height = viewport.height;
              canvas.width = viewport.width;
              container.appendChild(canvas);

              await page.render({
                canvasContext: context,
                viewport: viewport
              }).promise;
            }
          })
          .catch(function(err) {
            showError('Lỗi đọc file PDF: ' + (err.message || err));
          });
      } else {
        showError('Không thể tải thư viện PDF viewer. Vui lòng kiểm tra kết nối mạng.');
      }
    } catch (e) {
      showError('Lỗi giải mã dữ liệu PDF: ' + (e.message || e));
    }

    function showError(msg) {
      const loadingEl = document.getElementById('loading');
      if (loadingEl) loadingEl.style.display = 'none';
      const errEl = document.getElementById('error');
      if (errEl) {
        errEl.style.display = 'block';
        errEl.textContent = msg;
      }
    }
  </script>
</body>
</html>`;
}
