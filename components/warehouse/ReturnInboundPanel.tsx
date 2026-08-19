import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';

import { colors } from '../../constants/colors';
import { getApiErrorMessage } from '../../services/apiClient';
import {
  getPendingReturnSlips,
  PendingReturnSlip,
  processInboundDisposition,
  processReverseInbound,
  ProcessReverseInboundReturnLine,
  ProcessReverseInboundResponse,
} from '../../services/inboundApi';
import { AppButton } from '../AppButton';

type ReturnInboundPanelProps = {
  token: string | null;
  warehouseId: string | null | undefined;
};

export function ReturnInboundPanel({ token, warehouseId }: ReturnInboundPanelProps) {
  const [slips, setSlips] = useState<PendingReturnSlip[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingLpn, setProcessingLpn] = useState<string | null>(null);
  const [received, setReceived] = useState<Record<string, ProcessReverseInboundResponse>>({});
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadSlips = useCallback(async () => {
    if (!token) {
      setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      setSlips(await getPendingReturnSlips(token));
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadSlips();
  }, [loadSlips]);

  const receiveReturn = async (slip: PendingReturnSlip) => {
    const normalizedWarehouseId = warehouseId?.trim();
    if (!token) {
      setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      return;
    }
    if (!normalizedWarehouseId) {
      setError('Không xác định được WarehouseId của tài khoản hiện tại. Vui lòng đăng nhập lại.');
      return;
    }

    try {
      setProcessingLpn(slip.lpnCode);
      setError(null);
      setSuccessMessage(null);
      const result = await processReverseInbound(token, {
        warehouseId: normalizedWarehouseId,
        lpnCodes: [slip.lpnCode],
      });
      setReceived((current) => ({ ...current, [slip.lpnCode]: result }));
    } catch (receiveError) {
      setError(getApiErrorMessage(receiveError));
    } finally {
      setProcessingLpn(null);
    }
  };

  const classifyReturn = async (slip: PendingReturnSlip) => {
    const normalizedWarehouseId = warehouseId?.trim();
    if (!token) {
      setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      return;
    }
    if (!normalizedWarehouseId) {
      setError('Không xác định được WarehouseId của tài khoản hiện tại. Vui lòng đăng nhập lại.');
      return;
    }

    try {
      setProcessingLpn(slip.lpnCode);
      setError(null);
      const result = await processInboundDisposition(token, {
        lpnCode: slip.lpnCode,
        returnWarehouseId: normalizedWarehouseId,
      });
      const state = result.newLpnState.toUpperCase();
      setSuccessMessage(state === 'IN_STOCK'
        ? 'Đã nhập lại kho. Đơn hàng sẵn sàng để điều phối giao lại.'
        : state === 'DISCREPANCY_HOLD'
          ? 'Đã tiếp nhận hàng trả. Hàng đang được giữ để xử lý sai lệch/bồi thường.'
          : result.message);
      setReceived((current) => {
        const next = { ...current };
        delete next[slip.lpnCode];
        return next;
      });
      await loadSlips();
    } catch (dispositionError) {
      setError(getApiErrorMessage(dispositionError));
    } finally {
      setProcessingLpn(null);
    }
  };

  const finishPartialReceipt = async (
    slip: PendingReturnSlip,
    returnLine?: ProcessReverseInboundReturnLine
  ) => {
    const returnedQuantity = returnLine?.returnedQuantity ?? slip.returnedQty;
    const acceptedQuantity = returnLine?.acceptedLpnQuantityPreserved;
    setSuccessMessage(
      `Đã tiếp nhận ${returnedQuantity ?? 'phần'} kiện trả về. ${
        acceptedQuantity !== undefined && acceptedQuantity !== null
          ? `${acceptedQuantity} kiện đã giao vẫn được giữ nguyên.`
          : 'Phần hàng đã giao vẫn được giữ nguyên.'
      }`
    );
    setReceived((current) => {
      const next = { ...current };
      delete next[slip.lpnCode];
      return next;
    });
    await loadSlips();
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={loadSlips}
          colors={[colors.brand.primary]}
          tintColor={colors.brand.primary}
        />
      }
    >
      <View className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
        <View className="flex-row items-center gap-3">
          <Ionicons name="return-down-back-outline" size={26} color={colors.brand.primary} />
          <View className="flex-1">
            <Text style={{ color: colors.text.primary }} className="text-lg font-bold">Hàng trả về</Text>
            <Text style={{ color: colors.text.secondary }} className="mt-1 text-sm">
              Tiếp nhận LPN theo phiếu trả, sau đó để Backend tự động phân loại xử lý.
            </Text>
          </View>
        </View>
      </View>

      {error ? (
        <View className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3">
          <Text className="text-sm text-red-800">{error}</Text>
          <View className="mt-3">
            <AppButton label="Thử lại" variant="secondary" onPress={() => void loadSlips()} />
          </View>
        </View>
      ) : null}

      {successMessage ? (
        <View className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3">
          <Text className="font-semibold text-green-900">{successMessage}</Text>
        </View>
      ) : null}

      {loading && slips.length === 0 ? (
        <View className="items-center py-12">
          <ActivityIndicator size="large" color={colors.brand.primary} />
          <Text style={{ color: colors.text.secondary }} className="mt-3">Đang tải hàng trả về...</Text>
        </View>
      ) : null}

      {!loading && slips.length === 0 && !error ? (
        <View className="items-center rounded-2xl border border-slate-200 bg-white p-8">
          <Ionicons name="checkmark-circle-outline" size={48} color="#15803d" />
          <Text style={{ color: colors.text.primary }} className="mt-3 text-center font-bold">Không có hàng trả đang chờ</Text>
          <Text style={{ color: colors.text.secondary }} className="mt-2 text-center text-sm">
            Danh sách sẽ cập nhật khi tài xế hoàn tất luồng trả hàng.
          </Text>
        </View>
      ) : null}

      {slips.map((slip) => {
        const receipt = received[slip.lpnCode];
        const returnLine = receipt?.returnLines?.find(
          (line) => line.lpnCode.toUpperCase() === slip.lpnCode.toUpperCase()
        );
        const isPartialReceipt = returnLine?.isPartialReturn === true
          || slip.lpnState?.toUpperCase() === 'DELIVERED';
        const processing = processingLpn === slip.lpnCode;
        return (
          <View key={slip.returnSlipId || slip.lpnCode} className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text style={{ color: colors.text.primary }} className="text-lg font-bold">{slip.lpnCode}</Text>
                {slip.returnedQty !== undefined && slip.returnedQty !== null ? (
                  <Text style={{ color: colors.text.secondary }} className="mt-1">{slip.returnedQty} kiện</Text>
                ) : null}
              </View>
              {slip.status ? (
                <View className="rounded-lg bg-amber-100 px-3 py-2">
                  <Text className="text-xs font-bold text-amber-900">{slip.status}</Text>
                </View>
              ) : null}
            </View>

            <Text style={{ color: colors.text.secondary }} className="mt-3 text-sm">Lý do</Text>
            <Text style={{ color: colors.text.primary }} className="mt-1 font-semibold">
              {formatReturnReason(slip.reason)}
            </Text>

            {receipt ? (
              <View className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3">
                <Text className="font-bold text-green-900">Đã tiếp nhận tại kho</Text>
                <Text className="mt-1 text-sm text-green-800">Phiếu nhận: {receipt.receiptCode}</Text>
                {isPartialReceipt ? (
                  <Text className="mt-2 text-sm font-semibold text-green-900">
                    Chỉ tiếp nhận {returnLine?.returnedQuantity ?? slip.returnedQty ?? 'phần'} kiện trả về.
                    {returnLine?.acceptedLpnQuantityPreserved !== undefined
                      && returnLine.acceptedLpnQuantityPreserved !== null
                      ? ` ${returnLine.acceptedLpnQuantityPreserved} kiện đã giao vẫn giữ nguyên.`
                      : ' Phần hàng đã giao vẫn giữ nguyên.'}
                  </Text>
                ) : null}
              </View>
            ) : null}

            <View className="mt-4">
              {receipt ? (
                isPartialReceipt ? (
                  <AppButton
                    label="Hoàn tất"
                    variant="secondary"
                    onPress={() => void finishPartialReceipt(slip, returnLine)}
                  />
                ) : (
                  <AppButton
                    label="Phân loại xử lý"
                    loading={processing}
                    onPress={() => void classifyReturn(slip)}
                  />
                )
              ) : (
                <AppButton
                  label="Tiếp nhận"
                  loading={processing}
                  onPress={() => void receiveReturn(slip)}
                />
              )}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

function formatReturnReason(reason?: string | null) {
  const normalized = reason?.trim();
  if (!normalized) return 'Chưa có mô tả từ Backend';
  if (/NO[_ -]?SHOW|NOSHOW/i.test(normalized)) return 'Khách không có mặt';
  return normalized;
}
