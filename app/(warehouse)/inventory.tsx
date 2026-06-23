import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
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
  buildInventoryDocumentUrl,
  getInventoryLpns,
  getLpnDocuments,
  type LpnDocumentDto,
  type LpnDto,
  type LpnState,
} from '../../services/inventoryApi';
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
  InboundReceipt: 'Phiếu nhập kho',
  DiscrepancyReport: 'Biên bản bất thường',
  QcEvidence: 'Hình ảnh bằng chứng QC',
};

export default function WarehouseInventoryScreen() {
  const token = useAuthStore((state) => state.token);
  const [lpns, setLpns] = useState<LpnDto[]>([]);
  const [status, setStatus] = useState<LpnState | ''>('IN_STOCK');
  const [keyword, setKeyword] = useState('');
  const [selectedLpn, setSelectedLpn] = useState<LpnDto | null>(null);
  const [documents, setDocuments] = useState<LpnDocumentDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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

  const openLpn = async (lpn: LpnDto) => {
    setSelectedLpn(lpn);
    setDocuments([]);
    setMessage(null);

    try {
      const response = await getLpnDocuments(token, lpn.lpnId);
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
