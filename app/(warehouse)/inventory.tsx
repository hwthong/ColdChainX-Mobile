import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useFocusEffect, useRouter } from 'expo-router';

import { AppButton } from '../../components/AppButton';
import { AppInfoRow } from '../../components/AppInfoRow';
import { AppInput } from '../../components/AppInput';
import { AppMessage } from '../../components/AppMessage';
import { EmptyState } from '../../components/EmptyState';
import { StatusBadge } from '../../components/StatusBadge';
import { WH_COLORS, formatDateTimeVi, type MessageTone } from '../../constants/warehouseTheme';
import { getApiErrorMessage } from '../../services/apiClient';
import { putaway } from '../../services/inboundApi';
import {
  buildInventoryDocumentUrl,
  getInventoryLpnById,
  getInventoryLpns,
  getLpnDocuments,
  hasGeneratedWarehouseReceipt,
  type LpnDocumentDto,
  type LpnDto,
  type LpnState,
} from '../../services/inventoryApi';
import { getWarehouseIdFromToken } from '../../services/jwt';
import { useAuthStore } from '../../store/useAuthStore';

const STATUS_FILTERS: { label: string; value: LpnState | '' }[] = [
  { label: 'Tất cả', value: '' },
  { label: 'Chờ nhập', value: 'RECEIVING' },
  { label: 'Sai lệch', value: 'DISCREPANCY_HOLD' },
  { label: 'Đã nhập', value: 'IN_STOCK' },
  { label: 'Chờ trả', value: 'RETURN_PENDING' },
];

/** Map for document type Vietnamese labels */
const DOC_TYPE_LABELS: Record<string, string> = {
  WarehouseReceipt: 'Phiếu nhập kho',
  InboundReceipt: 'Phiếu nhập kho',
  DiscrepancyNote: 'Biên bản bất thường',
  DiscrepancyReport: 'Biên bản bất thường',
  EvidenceImage: 'Hình ảnh bằng chứng QC',
  QcEvidence: 'Hình ảnh bằng chứng QC',
};

export default function WarehouseInventoryScreen() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const storedWarehouseId = useAuthStore((state) => state.warehouseId ?? state.user?.warehouseId ?? null);
  const [lpns, setLpns] = useState<LpnDto[]>([]);
  const [status, setStatus] = useState<LpnState | ''>('IN_STOCK');
  const [keyword, setKeyword] = useState('');
  const [selectedLpn, setSelectedLpn] = useState<LpnDto | null>(null);
  const [documents, setDocuments] = useState<LpnDocumentDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPuttingAway, setIsPuttingAway] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [putawayLocation, setPutawayLocation] = useState('');
  const [putawayMessage, setPutawayMessage] = useState<{ text: string; tone: MessageTone } | null>(null);

  const loadLpns = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      const result = await getInventoryLpns(token, {
        status,
        keyword: keyword.trim() || undefined,
      });
      setLpns(result);
    } catch (error) {
      setMessage(getApiErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [keyword, status, token]);

  useFocusEffect(
    useCallback(() => {
      loadLpns();
    }, [loadLpns])
  );

  const updateLpnInList = useCallback((updatedLpn: LpnDto) => {
    setLpns((current) => current.map((lpn) => (lpn.lpnId === updatedLpn.lpnId ? updatedLpn : lpn)));
  }, []);

  const refreshSelectedLpn = async (
    lpnId: string,
    options: { preservePutawayLocation?: boolean } = {}
  ) => {
    const refreshedLpn = await getInventoryLpnById(token, lpnId);
    setSelectedLpn(refreshedLpn);
    updateLpnInList(refreshedLpn);

    if (!options.preservePutawayLocation) {
      setPutawayLocation(refreshedLpn.storageLocation ?? '');
    }

    return refreshedLpn;
  };

  const openLpn = async (lpn: LpnDto) => {
    setSelectedLpn(lpn);
    setDocuments([]);
    setPutawayLocation(lpn.storageLocation ?? '');
    setPutawayMessage(null);
    setMessage(null);

    try {
      const [freshLpn, response] = await Promise.all([
        getInventoryLpnById(token, lpn.lpnId),
        getLpnDocuments(token, lpn.lpnId),
      ]);

      setSelectedLpn(freshLpn);
      setPutawayLocation(freshLpn.storageLocation ?? '');
      updateLpnInList(freshLpn);

      if (response.success) {
        setDocuments(response.data ?? []);
      } else {
        setMessage(response.message || 'Không thể tải chứng từ LPN.');
      }
    } catch (error) {
      setMessage(getApiErrorMessage(error));
    }
  };

  const openDocument = async (url: string) => {
    await WebBrowser.openBrowserAsync(encodeURI(buildInventoryDocumentUrl(url)));
  };

  const handlePutaway = async () => {
    if (!selectedLpn) return;

    const currentLpnId = selectedLpn.lpnId?.trim();
    const storageLocation = putawayLocation.trim();

    try {
      if (!token) {
        throw new Error('Thiếu token xác thực. Vui lòng đăng nhập lại.');
      }
      if (!currentLpnId) {
        throw new Error('Không xác định được mã LPN.');
      }
      if (!storageLocation) {
        throw new Error('Vui lòng nhập vị trí lưu kho.');
      }

      setIsPuttingAway(true);
      setPutawayMessage(null);

      const latestLpn = await refreshSelectedLpn(currentLpnId, { preservePutawayLocation: true });
      if (normalizeLpnState(latestLpn.state) !== 'RECEIVING') {
        throw new Error('Chỉ có thể nhập kho khi LPN đang ở trạng thái RECEIVING.');
      }
      if (!hasGeneratedWarehouseReceipt(latestLpn) && !hasWarehouseReceiptDocument(documents)) {
        throw new Error('LPN đang chờ tạo phiếu nhập kho. Vui lòng tạo phiếu nhập trước khi nhập vị trí kho.');
      }

      const warehouseId = resolveWarehouseIdForPutaway({
        token,
        storedWarehouseId,
        lpn: latestLpn,
      });

      if (!warehouseId) {
        throw new Error('Không xác định được warehouseId. Vui lòng đăng nhập lại bằng tài khoản Warehouse.');
      }

      const response = await putaway(token, {
        lpnId: currentLpnId,
        warehouseId,
        storageLocation,
      });

      if (!response.success) {
        throw new Error(response.message || 'Không thể nhập kho LPN.');
      }

      const refreshedLpn = await getInventoryLpnById(token, currentLpnId);
      const updatedLpn: LpnDto = {
        ...refreshedLpn,
        state: refreshedLpn.state || 'IN_STOCK',
        warehouseId: refreshedLpn.warehouseId ?? warehouseId,
        storageLocation: refreshedLpn.storageLocation || storageLocation,
      };

      setSelectedLpn(updatedLpn);
      setPutawayLocation(updatedLpn.storageLocation ?? storageLocation);
      updateLpnInList(updatedLpn);
      setPutawayMessage({ text: 'Nhập kho thành công', tone: 'success' });
      Alert.alert('Thành công', 'Nhập kho thành công');
      await loadLpns();
    } catch (error) {
      setPutawayMessage({ text: getApiErrorMessage(error), tone: 'error' });
    } finally {
      setIsPuttingAway(false);
    }
  };

  const selectedLpnState = normalizeLpnState(selectedLpn?.state);
  const selectedLpnHasWarehouseReceipt = selectedLpn
    ? hasGeneratedWarehouseReceipt(selectedLpn) || hasWarehouseReceiptDocument(documents)
    : false;

  return (
    <View style={{ flex: 1, backgroundColor: WH_COLORS.background }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 36 }}>
        {/* Title */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 24, fontWeight: '700', color: WH_COLORS.textPrimary }}>Tồn kho</Text>
          <Text style={{ marginTop: 4, fontSize: 12, fontWeight: '500', color: WH_COLORS.textSecondary }}>
            Quản lý LPN trong kho
          </Text>
        </View>

        {/* Search & filter */}
        <View
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
          <Text style={{ fontSize: 12, fontWeight: '700', color: WH_COLORS.labelText }}>Tìm kiếm</Text>
          <TextInput
            value={keyword}
            onChangeText={setKeyword}
            placeholder="Mã LPN hoặc tên hàng"
            placeholderTextColor={WH_COLORS.placeholder}
            style={{
              marginTop: 6,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: WH_COLORS.inputBorder,
              paddingHorizontal: 14,
              paddingVertical: 10,
              fontSize: 14,
              color: WH_COLORS.textPrimary,
            }}
          />
          <View style={{ marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {STATUS_FILTERS.map((item) => {
              const isActive = status === item.value;
              return (
                <Pressable
                  key={item.label}
                  onPress={() => setStatus(item.value)}
                  style={{
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    backgroundColor: isActive ? WH_COLORS.primary : WH_COLORS.primaryLight,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: isActive ? '#FFFFFF' : WH_COLORS.primary,
                    }}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={{ marginTop: 16 }}>
            <Pressable
              onPress={loadLpns}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                borderRadius: 12,
                backgroundColor: WH_COLORS.primary,
                paddingHorizontal: 16,
                paddingVertical: 14,
              }}
            >
              <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
              <Text style={{ fontWeight: '700', color: '#FFFFFF' }}>Làm mới</Text>
            </Pressable>
          </View>
        </View>

        {isLoading ? <ActivityIndicator style={{ marginVertical: 16 }} color={WH_COLORS.primary} /> : null}
        {message ? <View style={{ marginTop: 12 }}><AppMessage text={message} tone="error" /></View> : null}
        {!isLoading && lpns.length === 0 ? (
          <EmptyState icon="layers-outline" message="Không tìm thấy LPN nào." />
        ) : null}

        {/* LPN list */}
        <View style={{ marginTop: 16, gap: 12 }}>
          {lpns.map((lpn) => (
            <Pressable
              key={lpn.lpnId}
              onPress={() => openLpn(lpn)}
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
                  <Text style={{ fontSize: 16, fontWeight: '700', color: WH_COLORS.textPrimary }}>{lpn.lpnCode}</Text>
                  <Text style={{ marginTop: 4, fontSize: 12, color: WH_COLORS.textSecondary }}>{lpn.itemName}</Text>
                </View>
                <StatusBadge status={lpn.state} showVietnameseLabel />
              </View>
              <AppInfoRow label="Số lượng" value={String(lpn.quantity)} />
              <AppInfoRow label="Cân nặng" value={`${lpn.actualWeightKg} / ${lpn.expectedWeightKg} kg`} />
              <AppInfoRow label="Vị trí" value={lpn.storageLocation || 'N/A'} />
              <AppInfoRow label="Thời gian nhập" value={formatDateTimeVi(lpn.inboundTime)} />
              {lpn.condition ? <AppInfoRow label="Tình trạng" value={lpn.condition} /> : null}
            </Pressable>
          ))}
        </View>

        {/* LPN detail panel */}
        {selectedLpn ? (
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
              {selectedLpn.lpnCode}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 }}>
              <Text style={{ width: 90, fontSize: 12, fontWeight: '700', color: WH_COLORS.textSecondary }}>Trạng thái</Text>
              <StatusBadge status={selectedLpn.state} showVietnameseLabel />
            </View>
            <AppInfoRow label="Vị trí" value={selectedLpn.storageLocation || 'N/A'} />
            <AppInfoRow label="Hạn SLA" value={formatDateTimeVi(selectedLpn.slaDeadline)} />

            {putawayMessage ? (
              <View style={{ marginTop: 12 }}>
                <AppMessage tone={putawayMessage.tone} text={putawayMessage.text} />
              </View>
            ) : null}

            {selectedLpnState === 'RECEIVING' && !selectedLpnHasWarehouseReceipt ? (
              <View style={{ marginTop: 12, gap: 12 }}>
                <AppMessage
                  tone="warning"
                  text="LPN đang chờ tạo phiếu nhập kho. Vui lòng tạo phiếu nhập trước khi nhập vị trí kho."
                />
                <AppButton
                  icon="document-text-outline"
                  label="Sang tab Phiếu nhập / Nhập kho để tạo phiếu nhập"
                  onPress={() => router.push('/(warehouse)/inbound' as never)}
                  variant="secondary"
                />
              </View>
            ) : null}

            {selectedLpnState === 'RECEIVING' && selectedLpnHasWarehouseReceipt ? (
              <View
                style={{
                  marginTop: 16,
                  gap: 12,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: WH_COLORS.cardBorder,
                  backgroundColor: WH_COLORS.primaryLight,
                  padding: 14,
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: '700', color: WH_COLORS.textPrimary }}>
                  Nhập vị trí kho
                </Text>
                <AppInput
                  label="Vị trí lưu kho"
                  value={putawayLocation}
                  onChangeText={setPutawayLocation}
                  placeholder="Ví dụ: A-01-01"
                />
                <AppButton
                  icon="archive-outline"
                  label="Xác nhận nhập kho"
                  onPress={handlePutaway}
                  loading={isPuttingAway}
                />
              </View>
            ) : null}

            {selectedLpnState === 'DISCREPANCY_HOLD' ? (
              <View style={{ marginTop: 12 }}>
                <AppMessage
                  tone="warning"
                  text="Lô hàng đang chờ xử lý sai lệch."
                />
              </View>
            ) : null}

            {selectedLpnState === 'RETURN_PENDING' ? (
              <View style={{ marginTop: 12 }}>
                <AppMessage tone="warning" text="Lô hàng đang chờ trả hàng." />
              </View>
            ) : null}

            {selectedLpnState === 'IN_STOCK' ? (
              <View style={{ marginTop: 12 }}>
                <AppMessage
                  tone="success"
                  text={`Lô hàng đã được nhập kho.\nVị trí: ${selectedLpn.storageLocation || 'N/A'}`}
                />
              </View>
            ) : null}

            <Text style={{ marginTop: 16, fontSize: 14, fontWeight: '700', color: WH_COLORS.textPrimary }}>
              Chứng từ
            </Text>
            {documents.length === 0 ? (
              <Text style={{ marginTop: 8, fontSize: 12, color: WH_COLORS.textSecondary }}>
                Chưa có chứng từ cho LPN này.
              </Text>
            ) : (
              documents.map((doc) => (
                <Pressable
                  key={`${doc.documentType}-${doc.url}`}
                  onPress={() => openDocument(doc.url)}
                  style={{
                    marginTop: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: WH_COLORS.cardBorder,
                    padding: 12,
                  }}
                >
                  <Ionicons name="document-attach-outline" size={20} color={WH_COLORS.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: WH_COLORS.textPrimary }}>{doc.documentName}</Text>
                    <Text style={{ marginTop: 4, fontSize: 12, color: WH_COLORS.textSecondary }}>
                      {DOC_TYPE_LABELS[doc.documentType] || doc.documentType}
                    </Text>
                  </View>
                  <Ionicons name="open-outline" size={18} color={WH_COLORS.primary} />
                </Pressable>
              ))
            )}

            <View style={{ marginTop: 16 }}>
              <AppButton
                icon="close-outline"
                label="Đóng"
                onPress={() => setSelectedLpn(null)}
                variant="secondary"
              />
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function normalizeLpnState(state?: string | null) {
  return state?.trim().toUpperCase() ?? '';
}

function hasWarehouseReceiptDocument(documents: LpnDocumentDto[]) {
  return documents.some((doc) => normalizeDocumentType(doc.documentType) === 'WAREHOUSERECEIPT');
}

function normalizeDocumentType(documentType?: string | null) {
  return documentType?.replace(/[_\s-]/g, '').trim().toUpperCase() ?? '';
}

function resolveWarehouseIdForPutaway({
  token,
  storedWarehouseId,
  lpn,
}: {
  token: string;
  storedWarehouseId?: string | null;
  lpn: LpnDto;
}) {
  return (
    storedWarehouseId?.trim() ||
    getWarehouseIdFromToken(token)?.trim() ||
    lpn.warehouseId?.trim() ||
    ''
  );
}
