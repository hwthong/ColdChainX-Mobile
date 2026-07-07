import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { API_BASE_URL, ApiClientError, getApiErrorMessage } from '../../../services/apiClient';
import {
  acceptAppendix,
  ContractAppendixResponse,
  getAppendixByOrder,
  getAppendixHtml,
  rejectAppendix,
} from '../../../services/appendixApi';
import {
  ContractInfoResponse,
  getContractByOrder,
  SignedContractFile,
  uploadSignedContract,
} from '../../../services/contractApi';
import { getCustomerIdFromToken } from '../../../services/jwt';
import { getMockDeliveryFlow, MockDeliveryFlow } from '../../../services/mockDeliveryApi';
import {
  acceptQuotation,
  getOrderById,
  getOrderQuotations,
  OrderResponse,
  QuotationResponse,
} from '../../../services/orderApi';
import { buildDispatchTimeline, buildInboundTimeline, TimelineStep } from '../../../services/trackingMock';
import { useAuthStore } from '../../../store/useAuthStore';

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.token);
  const storedCustomerId = useAuthStore((state) => state.customerId ?? state.user?.customerId ?? null);
  const customerId = storedCustomerId ?? (accessToken ? getCustomerIdFromToken(accessToken) : null);

  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [quotations, setQuotations] = useState<QuotationResponse[]>([]);
  const [contract, setContract] = useState<ContractInfoResponse | null>(null);
  const [appendix, setAppendix] = useState<ContractAppendixResponse | null>(null);
  const [selectedSignedFile, setSelectedSignedFile] = useState<SignedContractFile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isContractLoading, setIsContractLoading] = useState(false);
  const [isAppendixLoading, setIsAppendixLoading] = useState(false);
  const [isUploadingContract, setIsUploadingContract] = useState(false);
  const [isAcceptingQuoteId, setIsAcceptingQuoteId] = useState<string | null>(null);
  const [appendixAction, setAppendixAction] = useState<'accept' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contractError, setContractError] = useState<string | null>(null);
  const [appendixError, setAppendixError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const orderId = Array.isArray(id) ? id[0] : id;

  const fetchContractDetail = useCallback(async () => {
    if (!accessToken || !orderId) {
      setContract(null);
      setIsContractLoading(false);
      return;
    }

    setIsContractLoading(true);
    setContractError(null);

    try {
      const contractResponse = await getContractByOrder(accessToken, orderId);

      if (contractResponse.success && contractResponse.data) {
        setContract(contractResponse.data);
      } else {
        setContract(null);
        setContractError(contractResponse.message || null);
      }
    } catch (err) {
      setContract(null);

      if (err instanceof ApiClientError && err.status === 404) {
        setContractError(null);
      } else {
        setContractError(getApiErrorMessage(err));
      }
    } finally {
      setIsContractLoading(false);
    }
  }, [accessToken, orderId]);

  const fetchAppendixDetail = useCallback(async () => {
    if (!accessToken || !orderId) {
      setAppendix(null);
      setIsAppendixLoading(false);
      return;
    }

    setIsAppendixLoading(true);
    setAppendixError(null);

    try {
      const appendixResponse = await getAppendixByOrder(accessToken, orderId);

      if (appendixResponse.success && appendixResponse.data) {
        setAppendix(appendixResponse.data);
      } else {
        setAppendix(null);
        setAppendixError(appendixResponse.message || null);
      }
    } catch (err) {
      setAppendix(null);

      if (err instanceof ApiClientError && err.status === 404) {
        setAppendixError(null);
      } else {
        setAppendixError(getApiErrorMessage(err));
      }
    } finally {
      setIsAppendixLoading(false);
    }
  }, [accessToken, orderId]);

  const fetchOrderDetail = useCallback(async () => {
    if (!accessToken || !orderId) {
      setError('Không tìm thấy phiên đăng nhập hoặc mã đơn hàng.');
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const orderResponse = await getOrderById(accessToken, orderId);

      if (orderResponse.success && orderResponse.data) {
        setOrder(orderResponse.data);
      } else {
        setError(orderResponse.message || 'Không thể lấy thông tin đơn hàng.');
        return;
      }

      try {
        const quotationsResponse = await getOrderQuotations(accessToken, orderId);
        setQuotations(quotationsResponse.success ? quotationsResponse.data ?? [] : orderResponse.data.quotations);
      } catch {
        setQuotations(orderResponse.data?.quotations ?? []);
      }

      await Promise.all([fetchContractDetail(), fetchAppendixDetail()]);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, fetchAppendixDetail, fetchContractDetail, orderId]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      fetchOrderDetail();
    }, [fetchOrderDetail])
  );

  const displayedQuotations = useMemo(
    () => (quotations.length > 0 ? quotations : order?.quotations ?? []),
    [order?.quotations, quotations]
  );

  const documentImage = getFullAssetUrl(getOrderImageUrl(order));
  const inboundTimeline = useMemo(
    () => buildInboundTimeline(order?.status ?? 'PENDING_REVIEW', appendix?.status),
    [order?.status, appendix?.status]
  );
  const dispatchTimeline = useMemo(
    () => buildDispatchTimeline(order?.status ?? 'PENDING_REVIEW'),
    [order?.status]
  );
  const deliveryFlow = useMemo(
    () => getMockDeliveryFlow(order?.status ?? 'PENDING_REVIEW', order?.destination?.address),
    [order?.destination?.address, order?.status]
  );

  const handleAcceptQuotation = async (quote: QuotationResponse) => {
    if (!accessToken) {
      setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      return;
    }

    if (!customerId) {
      setError('Không tìm thấy mã khách hàng. Vui lòng đăng xuất và đăng nhập lại.');
      return;
    }

    setIsAcceptingQuoteId(quote.quoteId);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await acceptQuotation(accessToken, quote.quoteId, customerId);
      if (!response.success) {
        throw new Error(response.message || 'Không thể chấp nhận báo giá.');
      }

      setSuccessMessage('Bạn đã chấp nhận báo giá.');
      await fetchOrderDetail();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsAcceptingQuoteId(null);
    }
  };

  const handlePickSignedContract = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });
      const pickedFile = getPickedDocumentFile(result);

      if (!pickedFile) {
        return;
      }

      setSelectedSignedFile(pickedFile);
      setContractError(null);
    } catch (err) {
      setContractError(getApiErrorMessage(err));
    }
  };

  const handleUploadSignedContract = async () => {
    if (!accessToken) {
      setContractError('Your session has expired. Please log in again.');
      return;
    }

    if (!contract) {
      setContractError('Contract is not available yet.');
      return;
    }

    if (!selectedSignedFile) {
      setContractError('Please choose a signed contract file before submitting.');
      return;
    }

    setIsUploadingContract(true);
    setContractError(null);
    setSuccessMessage(null);

    try {
      const response = await uploadSignedContract(contract.contractId, selectedSignedFile);

      if (!response.success) {
        throw new Error(response.message || 'Could not upload signed contract.');
      }

      setSelectedSignedFile(null);
      setSuccessMessage('Signed contract uploaded. Waiting for Sales verification.');
      Alert.alert('Upload complete', 'Signed contract uploaded. Waiting for Sales verification.');
      await fetchOrderDetail();
    } catch (err) {
      setContractError(getApiErrorMessage(err));
    } finally {
      setIsUploadingContract(false);
    }
  };

  const handleViewAppendix = async () => {
    if (!appendix) {
      return;
    }

    setAppendixError(null);

    try {
      let htmlContent = appendix.draftHtmlContent;

      if (!htmlContent && accessToken) {
        const response = await getAppendixHtml(accessToken, appendix.appendixId);
        htmlContent = typeof response === 'string' ? response : response.data ?? null;
      }

      if (!htmlContent) {
        Alert.alert('Không có phụ lục', 'Nội dung HTML của phụ lục chưa sẵn sàng.');
        return;
      }

      await WebBrowser.openBrowserAsync(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    } catch (err) {
      setAppendixError(getApiErrorMessage(err));
    }
  };

  const handleOpenAppendixPdf = async () => {
    if (!appendix?.pdfUrl) {
      Alert.alert('Không có PDF', 'File PDF của phụ lục chưa sẵn sàng.');
      return;
    }

    await openContractFile(getFullAssetUrl(appendix.pdfUrl));
  };

  const handleAcceptAppendix = async () => {
    if (!accessToken || !appendix) {
      setAppendixError('Phiên đăng nhập đã hết hạn hoặc phụ lục không khả dụng.');
      return;
    }

    setAppendixAction('accept');
    setAppendixError(null);
    setSuccessMessage(null);

    try {
      const response = await acceptAppendix(accessToken, appendix.appendixId);
      if (!response.success || !response.data) {
        throw new Error(response.message || 'Không thể chấp nhận phụ lục.');
      }

      setAppendix(response.data);
      setSuccessMessage('Đã chấp nhận phụ lục. Vui lòng chờ Sales xác nhận thực thi.');
      Alert.alert('Đã chấp nhận', 'Đã chấp nhận phụ lục. Vui lòng chờ Sales xác nhận thực thi.');
      await fetchOrderDetail();
    } catch (err) {
      setAppendixError(getApiErrorMessage(err));
    } finally {
      setAppendixAction(null);
    }
  };

  const handleRejectAppendix = () => {
    Alert.alert(
      'Từ chối phụ lục?',
      'Bạn có chắc muốn từ chối phụ lục? Đơn hàng sẽ chuyển sang quy trình hoàn trả.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Từ chối',
          style: 'destructive',
          onPress: runRejectAppendix,
        },
      ]
    );
  };

  const runRejectAppendix = async () => {
    if (!accessToken || !appendix) {
      setAppendixError('Phiên đăng nhập đã hết hạn hoặc phụ lục không khả dụng.');
      return;
    }

    setAppendixAction('reject');
    setAppendixError(null);
    setSuccessMessage(null);

    try {
      const response = await rejectAppendix(accessToken, appendix.appendixId);
      if (!response.success || !response.data) {
        throw new Error(response.message || 'Không thể từ chối phụ lục.');
      }

      setAppendix(response.data);
      setSuccessMessage('Đã từ chối phụ lục. Đơn hàng đang chờ hoàn trả.');
      Alert.alert('Đã từ chối', 'Đã từ chối phụ lục. Đơn hàng đang chờ hoàn trả.');
      await fetchOrderDetail();
    } catch (err) {
      setAppendixError(getApiErrorMessage(err));
    } finally {
      setAppendixAction(null);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F5F2F0]">
        <ActivityIndicator size="large" color="#8B4513" />
        <Text className="mt-4 font-medium text-[#8B4513]">Đang tải chi tiết đơn...</Text>
      </View>
    );
  }

  if (error && !order) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F5F2F0] p-6">
        <Ionicons name="alert-circle-outline" size={48} color="#dc2626" />
        <Text className="mt-4 text-center font-medium leading-6 text-red-600">{error}</Text>
        <Pressable onPress={() => router.back()} className="mt-4 rounded-xl bg-gray-200 px-6 py-2">
          <Text className="font-bold text-gray-800">Quay lại</Text>
        </Pressable>
      </View>
    );
  }

  if (!order) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F5F2F0] p-6">
        <Text className="text-center font-medium text-[#877369]">Không tìm thấy đơn hàng.</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-[#F5F2F0]" contentContainerStyle={{ padding: 20, paddingBottom: 80 }}>
      {error ? (
        <View className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4">
          <Text className="font-semibold leading-5 text-red-700">{error}</Text>
        </View>
      ) : null}

      {successMessage ? (
        <View className="mb-4 rounded-2xl border border-green-200 bg-green-50 p-4">
          <Text className="font-semibold leading-5 text-green-700">{successMessage}</Text>
        </View>
      ) : null}

      <View className="mb-4 rounded-2xl border border-[#DAC2B6]/50 bg-white p-5 shadow-sm">
        <View className="mb-4 flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Ionicons name="barcode-outline" size={20} color="#8B4513" />
              <Text className="text-xl font-bold text-[#8B4513]">{order.trackingCode}</Text>
            </View>
            <Text className="mt-2 text-sm text-[#877369]">{formatDate(order.createdAt)}</Text>
          </View>
          <StatusBadge status={order.status} />
        </View>
      </View>

      <InfoCard title="Thông tin hàng hóa" icon="cube-outline">
        <InfoRow label="Tên hàng" value={order.itemName} />
        <InfoRow label="Phân loại" value={formatCategory(order.category)} />
        <InfoRow label="Số lượng" value={`${order.quantity}`} />
        <InfoRow label="Quy cách đóng gói" value={order.packingType} />
        <InfoRow label="Khối lượng dự kiến" value={`${order.expectedWeightKg} kg`} />
        <InfoRow label="Nhiệt độ yêu cầu" value={formatTemperature(order.tempCondition)} strong />
      </InfoCard>

      {order.route ? (
        <InfoCard title="Tuyến vận chuyển" icon="git-branch-outline">
          <InfoRow label="Mã tuyến" value={order.route.routeCode} strong />
          <InfoRow label="Điểm đi" value={order.route.originCity} />
          <InfoRow label="Điểm đến" value={order.route.destCity} />
          <InfoRow label="Thời gian dự kiến" value={order.route.transitTime} />
          <InfoRow label="Cut-off nhập hub" value={formatCutOffTime(order.route.cutOffTime)} />
        </InfoCard>
      ) : null}

      <InfoCard title="Giao hàng đến" icon="location-sharp">
        <Text className="text-sm font-semibold leading-5 text-[#3A1F04]">
          {order.destination?.address || 'Chưa cập nhật địa chỉ'}
        </Text>
      </InfoCard>

      {hasCoordinates(order) ? (
        <InfoCard title="Vị trí giao hàng" icon="map-outline">
          <InfoRow label="Latitude" value={`${order.destination?.latitude}`} />
          <InfoRow label="Longitude" value={`${order.destination?.longitude}`} />
          <Text className="mt-2 text-xs leading-5 text-[#877369]">
            Bản đồ sẽ được hiển thị khi ứng dụng tích hợp thư viện bản đồ phù hợp.
          </Text>
        </InfoCard>
      ) : null}

      {documentImage ? (
        <View className="mb-4 rounded-2xl border border-[#DAC2B6]/50 bg-white p-5 shadow-sm">
          <View className="mb-3 flex-row items-center gap-2 border-b border-[#DAC2B6]/30 pb-3">
            <Ionicons name="image-outline" size={18} color="#8B4513" />
            <Text className="text-base font-bold text-[#8B4513]">Ảnh kiện hàng</Text>
          </View>
          <Image source={{ uri: documentImage }} className="h-52 w-full rounded-xl bg-gray-100" resizeMode="cover" />
        </View>
      ) : null}

      <View className="mb-4 rounded-2xl border border-[#DAC2B6]/50 bg-white p-5 shadow-sm">
        <View className="mb-3 flex-row items-center gap-2 border-b border-[#DAC2B6]/30 pb-3">
          <Ionicons name="receipt-outline" size={18} color="#8B4513" />
          <Text className="text-base font-bold text-[#8B4513]">Báo giá</Text>
        </View>

        {displayedQuotations.length === 0 ? (
          <Text className="text-sm leading-6 text-[#877369]">
            Đơn hàng đang chờ Sales kiểm duyệt và gửi báo giá.
          </Text>
        ) : (
          <View className="gap-4">
            {displayedQuotations.map((quote) => (
              <QuotationCard
                key={quote.quoteId}
                quote={quote}
                isAccepting={isAcceptingQuoteId === quote.quoteId}
                onAccept={() => handleAcceptQuotation(quote)}
              />
            ))}
          </View>
        )}
      </View>

      <ContractSection
        contract={contract}
        contractError={contractError}
        isLoading={isContractLoading}
        isUploading={isUploadingContract}
        orderTrackingCode={order.trackingCode}
        selectedFile={selectedSignedFile}
        onPickFile={handlePickSignedContract}
        onSubmit={handleUploadSignedContract}
      />

      <AppendixSection
        appendix={appendix}
        appendixError={appendixError}
        action={appendixAction}
        isLoading={isAppendixLoading}
        orderStatus={order.status}
        onAccept={handleAcceptAppendix}
        onOpenPdf={handleOpenAppendixPdf}
        onReject={handleRejectAppendix}
        onView={handleViewAppendix}
      />

      <InfoCard title="Giao hàng tại Hub" icon="business-outline">
        {/* TODO: replace inbound timeline with real warehouse receipt status API when available */}
        <TimelineList steps={inboundTimeline} />
      </InfoCard>

      <InfoCard title="Điều phối & xếp xe" icon="file-tray-stacked-outline">
        {/* TODO: connect real dispatch/trip status when customer tracking endpoint is available */}
        <TimelineList steps={dispatchTimeline} />
      </InfoCard>

      <DeliveryFlowCard flow={deliveryFlow} />
    </ScrollView>
  );
}

function QuotationCard({
  quote,
  isAccepting,
  onAccept,
}: {
  quote: QuotationResponse;
  isAccepting: boolean;
  onAccept: () => void;
}) {
  const canAccept = isAcceptableQuote(quote.status);
  const accepted = isAcceptedQuote(quote.status);
  const fullFileUrl = getFullAssetUrl(quote.fileUrl);

  return (
    <View className="rounded-2xl border border-[#DAC2B6]/60 bg-[#F8F9FA] p-4">
      <View className="mb-3 flex-row items-start justify-between gap-3">
        <View>
          <Text className="text-sm font-bold text-[#3A1F04]">Báo giá</Text>
          <Text className="mt-1 text-xs text-[#877369]">{formatDate(quote.createdAt)}</Text>
        </View>
        <StatusBadge status={quote.status} />
      </View>

      <View className="gap-2">
        <InfoRow label="Tổng tiền" value={formatMoney(quote.finalAmount)} strong />
        <InfoRow label="Cước vận chuyển" value={formatMoney(quote.baseFreight)} />
        <InfoRow label="Phụ phí last-mile" value={formatMoney(quote.lastMileSurcharge)} />
        <InfoRow label="VAS" value={formatMoney(quote.vasAmount)} />
        <InfoRow label="VAT" value={formatMoney(quote.vatAmount)} />
      </View>

      {fullFileUrl ? (
        <Pressable onPress={() => Linking.openURL(fullFileUrl)} className="mt-4 flex-row items-center gap-2">
          <Ionicons name="document-attach-outline" size={16} color="#8B4513" />
          <Text className="text-sm font-semibold text-[#8B4513]">Xem file báo giá</Text>
        </Pressable>
      ) : null}

      {canAccept ? (
        <Pressable
          onPress={onAccept}
          disabled={isAccepting}
          className={[
            'mt-4 h-12 items-center justify-center rounded-xl bg-[#8B4513]',
            isAccepting ? 'opacity-70' : '',
          ].join(' ')}
        >
          <Text className="font-bold text-white">
            {isAccepting ? 'ĐANG XỬ LÝ...' : 'Chấp nhận báo giá'}
          </Text>
        </Pressable>
      ) : null}

      {accepted ? (
        <View className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3">
          <Text className="text-sm font-semibold leading-5 text-green-700">
            Bạn đã chấp nhận báo giá. Hợp đồng sẽ được tạo trong bước tiếp theo.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function ContractSection({
  contract,
  contractError,
  isLoading,
  isUploading,
  orderTrackingCode,
  selectedFile,
  onPickFile,
  onSubmit,
}: {
  contract: ContractInfoResponse | null;
  contractError: string | null;
  isLoading: boolean;
  isUploading: boolean;
  orderTrackingCode?: string | null;
  selectedFile: SignedContractFile | null;
  onPickFile: () => void;
  onSubmit: () => void;
}) {
  const status = contract?.status.toUpperCase() ?? '';
  const contractFileUrl = getFullAssetUrl(contract?.fileUrl);
  const signedFileUrl = getFullAssetUrl(contract?.signedFileUrl);
  const canUpload = status === 'PENDING_CUSTOMER_SIGNATURE';

  return (
    <View className="mb-4 rounded-2xl border border-[#DAC2B6]/50 bg-white p-5 shadow-sm">
      <View className="mb-3 flex-row items-center gap-2 border-b border-[#DAC2B6]/30 pb-3">
        <Ionicons name="document-text-outline" size={18} color="#8B4513" />
        <Text className="text-base font-bold text-[#8B4513]">Contract</Text>
      </View>

      {isLoading ? (
        <View className="flex-row items-center gap-3 rounded-xl bg-[#F8F9FA] p-3">
          <ActivityIndicator size="small" color="#8B4513" />
          <Text className="text-sm font-semibold text-[#877369]">Loading contract...</Text>
        </View>
      ) : null}

      {contractError ? (
        <View className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3">
          <Text className="text-sm font-semibold leading-5 text-red-700">{contractError}</Text>
        </View>
      ) : null}

      {!isLoading && !contract ? (
        <Text className="text-sm leading-6 text-[#877369]">Contract is not available yet.</Text>
      ) : null}

      {!isLoading && contract ? (
        <View className="gap-3">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className="text-sm font-bold text-[#3A1F04]">{contract.contractNumber}</Text>
              <Text className="mt-1 text-xs text-[#877369]">Sent: {formatDate(contract.sentAt)}</Text>
            </View>
            <StatusBadge status={contract.status} />
          </View>

          {contractFileUrl ? (
            <Pressable onPress={() => openContractFile(contractFileUrl)} className="flex-row items-center gap-2">
              <Ionicons name="document-attach-outline" size={16} color="#8B4513" />
              <Text className="text-sm font-semibold text-[#8B4513]">Open contract file</Text>
            </Pressable>
          ) : null}

          {status === 'DRAFT' || status === 'PENDING_SIGNATURE' ? (
            <Text className="text-sm leading-6 text-[#877369]">Contract is being prepared by Sales.</Text>
          ) : null}

          {canUpload ? (
            <View className="gap-3 rounded-2xl border border-[#DAC2B6]/60 bg-[#F8F9FA] p-4">
              <Text className="text-sm leading-6 text-[#877369]">
                Please upload the signed PDF or image contract for Sales verification.
              </Text>

              <Pressable
                onPress={onPickFile}
                disabled={isUploading}
                className="h-12 flex-row items-center justify-center gap-2 rounded-xl border border-[#8B4513] bg-white"
              >
                <Ionicons name="cloud-upload-outline" size={18} color="#8B4513" />
                <Text className="font-bold text-[#8B4513]">Upload Signed Contract</Text>
              </Pressable>

              {selectedFile ? (
                <View className="rounded-xl border border-green-200 bg-green-50 p-3">
                  <Text className="text-xs font-semibold uppercase text-green-700">Selected file</Text>
                  <Text className="mt-1 text-sm font-bold text-green-800">
                    {selectedFile.name || 'signed-contract.pdf'}
                  </Text>
                </View>
              ) : null}

              <Pressable
                onPress={onSubmit}
                disabled={!selectedFile || isUploading}
                className={[
                  'h-12 items-center justify-center rounded-xl bg-[#8B4513]',
                  !selectedFile || isUploading ? 'opacity-60' : '',
                ].join(' ')}
              >
                <Text className="font-bold text-white">
                  {isUploading ? 'SUBMITTING...' : 'Submit Signed Contract'}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {status === 'PENDING_SALES_VERIFICATION' ? (
            <View className="rounded-xl border border-blue-200 bg-blue-50 p-3">
              <Text className="text-sm font-semibold leading-5 text-blue-700">
                Signed contract uploaded. Waiting for Sales verification.
              </Text>
              {signedFileUrl ? (
                <Pressable onPress={() => openContractFile(signedFileUrl)} className="mt-3 flex-row items-center gap-2">
                  <Ionicons name="document-attach-outline" size={16} color="#1d4ed8" />
                  <Text className="text-sm font-semibold text-blue-700">Open signed contract</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {status === 'ACTIVE' ? (
            <View className="rounded-xl border border-green-200 bg-green-50 p-3">
              <Text className="text-sm font-semibold leading-5 text-green-700">Contract verified.</Text>
              {orderTrackingCode ? (
                <Text className="mt-2 text-sm font-bold text-green-800">Tracking code: {orderTrackingCode}</Text>
              ) : null}
              {signedFileUrl ? (
                <Pressable onPress={() => openContractFile(signedFileUrl)} className="mt-3 flex-row items-center gap-2">
                  <Ionicons name="document-attach-outline" size={16} color="#15803d" />
                  <Text className="text-sm font-semibold text-green-700">Open signed contract</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function AppendixSection({
  appendix,
  appendixError,
  action,
  isLoading,
  orderStatus,
  onAccept,
  onOpenPdf,
  onReject,
  onView,
}: {
  appendix: ContractAppendixResponse | null;
  appendixError: string | null;
  action: 'accept' | 'reject' | null;
  isLoading: boolean;
  orderStatus: string;
  onAccept: () => void;
  onOpenPdf: () => void;
  onReject: () => void;
  onView: () => void;
}) {
  if (!isLoading && !appendix && !appendixError) {
    return null;
  }

  const status = appendix?.status.toUpperCase() ?? '';
  const canRespond = status === 'SENT';
  const isAccepted = status === 'ACCEPTED';
  const isRejected = status === 'REJECTED';
  const isExecuted = status === 'EXECUTED';
  const hasPdf = Boolean(appendix?.pdfUrl);
  const orderIsReceiving = orderStatus.toUpperCase() === 'RECEIVING';

  return (
    <View className="mb-4 rounded-2xl border border-[#DAC2B6]/50 bg-white p-5 shadow-sm">
      <View className="mb-3 flex-row items-center gap-2 border-b border-[#DAC2B6]/30 pb-3">
        <Ionicons name="document-attach-outline" size={18} color="#8B4513" />
        <Text className="text-base font-bold text-[#8B4513]">Phụ lục điều chỉnh cước</Text>
      </View>

      {isLoading ? (
        <View className="flex-row items-center gap-3 rounded-xl bg-[#F8F9FA] p-3">
          <ActivityIndicator size="small" color="#8B4513" />
          <Text className="text-sm font-semibold text-[#877369]">Đang kiểm tra phụ lục...</Text>
        </View>
      ) : null}

      {appendixError ? (
        <View className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3">
          <Text className="text-sm font-semibold leading-5 text-red-700">{appendixError}</Text>
        </View>
      ) : null}

      {appendix ? (
        <View className="gap-3">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className="text-sm font-bold text-[#3A1F04]">{appendix.appendixNumber}</Text>
              <Text className="mt-1 text-xs text-[#877369]">Gửi lúc: {formatDate(appendix.sentAt)}</Text>
            </View>
            <StatusBadge status={appendix.status} />
          </View>

          <Text className="text-sm leading-6 text-[#877369]">
            {appendix.reason || 'Phát hiện chênh lệch thực tế khi kiểm đếm QC tại Hub.'}
          </Text>

          <InfoRow label="Phí điều chỉnh" value={formatMoney(appendix.adjustedPrice)} strong />

          {canRespond ? (
            <View className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <Text className="text-sm font-semibold leading-5 text-amber-800">
                Trạng thái: Chờ khách hàng xác nhận
              </Text>
            </View>
          ) : null}

          {isAccepted ? (
            <View className="rounded-xl border border-green-200 bg-green-50 p-3">
              <Text className="text-sm font-semibold leading-5 text-green-700">
                Bạn đã chấp nhận phụ lục. Đang chờ Sales thực thi xử lý nhập kho.
              </Text>
            </View>
          ) : null}

          {isExecuted && orderIsReceiving ? (
            <View className="rounded-xl border border-green-200 bg-green-50 p-3">
              <Text className="text-sm font-semibold leading-5 text-green-700">
                Phụ lục đã xử lý. Đơn hàng tiếp tục nhập kho.
              </Text>
            </View>
          ) : null}

          {isRejected ? (
            <View className="rounded-xl border border-red-200 bg-red-50 p-3">
              <Text className="text-sm font-semibold leading-5 text-red-700">
                Phụ lục đã bị từ chối. Đơn hàng chuyển sang chờ hoàn trả.
              </Text>
            </View>
          ) : null}

          <View className="flex-row flex-wrap gap-3">
            <Pressable
              onPress={onView}
              className="h-11 flex-row items-center justify-center gap-2 rounded-xl border border-[#8B4513] bg-white px-4"
            >
              <Ionicons name="eye-outline" size={16} color="#8B4513" />
              <Text className="text-sm font-bold text-[#8B4513]">Xem phụ lục</Text>
            </Pressable>

            <Pressable
              onPress={onOpenPdf}
              disabled={!hasPdf}
              className={[
                'h-11 flex-row items-center justify-center gap-2 rounded-xl border px-4',
                hasPdf ? 'border-[#8B4513] bg-white' : 'border-[#DAC2B6] bg-[#F8F9FA]',
              ].join(' ')}
            >
              <Ionicons name="open-outline" size={16} color={hasPdf ? '#8B4513' : '#877369'} />
              <Text className={['text-sm font-bold', hasPdf ? 'text-[#8B4513]' : 'text-[#877369]'].join(' ')}>
                Mở PDF
              </Text>
            </Pressable>
          </View>

          {canRespond ? (
            <View className="flex-row gap-3">
              <Pressable
                onPress={onAccept}
                disabled={Boolean(action)}
                className={[
                  'h-12 flex-1 items-center justify-center rounded-xl bg-[#006E0A]',
                  action ? 'opacity-60' : '',
                ].join(' ')}
              >
                <Text className="font-bold text-white">
                  {action === 'accept' ? 'ĐANG XỬ LÝ...' : 'Chấp nhận'}
                </Text>
              </Pressable>

              <Pressable
                onPress={onReject}
                disabled={Boolean(action)}
                className={[
                  'h-12 flex-1 items-center justify-center rounded-xl bg-red-600',
                  action ? 'opacity-60' : '',
                ].join(' ')}
              >
                <Text className="font-bold text-white">
                  {action === 'reject' ? 'ĐANG XỬ LÝ...' : 'Từ chối'}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function TimelineList({ steps }: { steps: TimelineStep[] }) {
  return (
    <View className="gap-3">
      {steps.map((step, index) => {
        const styles = getTimelineStyles(step.state);
        const isLast = index === steps.length - 1;

        return (
          <View key={step.key} className="flex-row gap-3">
            <View className="items-center">
              <View className={`h-8 w-8 items-center justify-center rounded-full ${styles.dot}`}>
                <Ionicons name={styles.icon} size={16} color={styles.iconColor} />
              </View>
              {!isLast ? <View className="mt-2 h-8 w-px bg-[#DAC2B6]/70" /> : null}
            </View>

            <View className="flex-1 pb-1">
              <Text className={`text-sm font-bold ${styles.title}`}>{step.title}</Text>
              <Text className="mt-1 text-xs leading-5 text-[#877369]">{step.description}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function DeliveryFlowCard({ flow }: { flow: MockDeliveryFlow }) {
  const deliverySteps: TimelineStep[] = flow.stops.map((stop) => ({
    key: stop.id,
    title: stop.label,
    description: `${stop.address} - ETA ${stop.eta}`,
    state: mapDeliveryState(stop.status),
  }));

  return (
    <InfoCard title="Giao hàng tận nơi & COD" icon="home-outline">
      {/* TODO: replace mock delivery flow when backend provides delivery/check-in/ePOD/COD APIs */}
      <TimelineList steps={deliverySteps} />

      <View className="mt-2 gap-3 rounded-2xl border border-[#DAC2B6]/50 bg-[#F8F9FA] p-4">
        <InfoRow label="e-POD" value={flow.epodStatus} />
        <InfoRow label="COD" value={flow.codStatus} />
        {flow.rejectionReason ? <InfoRow label="Lý do từ chối" value={flow.rejectionReason} /> : null}
      </View>
    </InfoCard>
  );
}

function InfoCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-4 rounded-2xl border border-[#DAC2B6]/50 bg-white p-5 shadow-sm">
      <View className="mb-3 flex-row items-center gap-2 border-b border-[#DAC2B6]/30 pb-3">
        <Ionicons name={icon} size={18} color="#8B4513" />
        <Text className="text-base font-bold text-[#8B4513]">{title}</Text>
      </View>
      <View className="gap-3">{children}</View>
    </View>
  );
}

function getTimelineStyles(state: TimelineStep['state']): {
  dot: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
} {
  switch (state) {
    case 'done':
      return {
        dot: 'bg-green-100',
        title: 'text-green-700',
        icon: 'checkmark',
        iconColor: '#15803d',
      };
    case 'current':
      return {
        dot: 'bg-[#8B4513]/10',
        title: 'text-[#8B4513]',
        icon: 'ellipse',
        iconColor: '#8B4513',
      };
    case 'issue':
      return {
        dot: 'bg-red-100',
        title: 'text-red-700',
        icon: 'alert',
        iconColor: '#b91c1c',
      };
    default:
      return {
        dot: 'bg-[#DAC2B6]/30',
        title: 'text-[#877369]',
        icon: 'time-outline',
        iconColor: '#877369',
      };
  }
}

function mapDeliveryState(status: MockDeliveryFlow['stops'][number]['status']): TimelineStep['state'] {
  switch (status) {
    case 'done':
      return 'done';
    case 'current':
      return 'current';
    case 'issue':
      return 'issue';
    default:
      return 'pending';
  }
}

function InfoRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <View className="flex-row items-start justify-between gap-4">
      <Text className="text-sm text-[#877369]">{label}</Text>
      <Text className={['flex-1 text-right text-sm', strong ? 'font-bold text-[#006E0A]' : 'font-semibold text-[#3A1F04]'].join(' ')}>
        {value}
      </Text>
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles = getStatusColor(status);

  return (
    <View className={`rounded-full border px-2.5 py-1 ${styles.container}`}>
      <Text className={`text-[10px] font-bold uppercase tracking-wider ${styles.text}`}>
        {translateStatus(status)}
      </Text>
    </View>
  );
}

function getStatusColor(status: string) {
  switch (status.toUpperCase()) {
    case 'PENDING':
    case 'PENDING_REVIEW':
      return { container: 'bg-yellow-100 border-yellow-200', text: 'text-yellow-800' };
    case 'QUOTING':
    case 'SENT':
      return { container: 'bg-orange-100 border-orange-200', text: 'text-orange-800' };
    case 'CONTRACT_PENDING':
      return { container: 'bg-amber-100 border-amber-200', text: 'text-amber-800' };
    case 'PENDING_CUSTOMER_SIGNATURE':
      return { container: 'bg-orange-100 border-orange-200', text: 'text-orange-800' };
    case 'PENDING_SALES_VERIFICATION':
      return { container: 'bg-blue-100 border-blue-200', text: 'text-blue-800' };
    case 'ASSIGNED':
      return { container: 'bg-blue-100 border-blue-200', text: 'text-blue-800' };
    case 'DISCREPANCY_HOLD':
      return { container: 'bg-amber-100 border-amber-200', text: 'text-amber-800' };
    case 'RETURN_PENDING':
      return { container: 'bg-red-100 border-red-200', text: 'text-red-800' };
    case 'IN_TRANSIT':
      return { container: 'bg-purple-100 border-purple-200', text: 'text-purple-800' };
    case 'ACCEPTED':
    case 'ACTIVE':
    case 'CONTRACT_SIGNED':
    case 'EXECUTED':
    case 'RECEIVING':
    case 'DELIVERED':
      return { container: 'bg-green-100 border-green-200', text: 'text-green-800' };
    case 'REJECTED':
    case 'CANCELLED':
      return { container: 'bg-red-100 border-red-200', text: 'text-red-800' };
    default:
      return { container: 'bg-gray-100 border-gray-200', text: 'text-gray-800' };
  }
}

function translateStatus(status: string) {
  switch (status.toUpperCase()) {
    case 'PENDING':
    case 'PENDING_REVIEW':
      return 'Chờ duyệt';
    case 'QUOTING':
      return 'Đang báo giá';
    case 'SENT':
      return 'Đã gửi';
    case 'CONTRACT_PENDING':
      return 'Chờ hợp đồng';
    case 'DISCREPANCY_HOLD':
      return 'Chờ xử lý sai lệch';
    case 'RETURN_PENDING':
      return 'Chờ hoàn trả';
    case 'PENDING_CUSTOMER_SIGNATURE':
      return 'Waiting signature';
    case 'PENDING_SALES_VERIFICATION':
      return 'Waiting Sales verify';
    case 'ACTIVE':
      return 'Verified';
    case 'CONTRACT_SIGNED':
      return 'Contract signed';
    case 'EXECUTED':
      return 'Đã xử lý';
    case 'RECEIVING':
      return 'Đang nhập kho';
    case 'ASSIGNED':
      return 'Đã phân xe';
    case 'IN_TRANSIT':
      return 'Đang giao';
    case 'ACCEPTED':
      return 'Đã chấp nhận';
    case 'DELIVERED':
      return 'Đã giao';
    case 'REJECTED':
      return 'Từ chối';
    case 'CANCELLED':
      return 'Đã hủy';
    default:
      return status;
  }
}

function isAcceptableQuote(status: string) {
  const normalized = status.toUpperCase();
  return normalized === 'SENT' || normalized === 'PENDING';
}

function isAcceptedQuote(status: string) {
  return status.toUpperCase() === 'ACCEPTED';
}

function getOrderImageUrl(order: OrderResponse | null) {
  if (!order) return null;

  return (
    order.documents?.find((document) => document.docType === 'CargoImage')?.imageUrl ??
    order.documents?.[0]?.imageUrl ??
    order.documentUrl
  );
}

function getPickedDocumentFile(result: DocumentPicker.DocumentPickerResult): SignedContractFile | null {
  const resultAny = result as any;

  if (resultAny.canceled || resultAny.type === 'cancel') {
    return null;
  }

  const asset = Array.isArray(resultAny.assets) ? resultAny.assets[0] : resultAny;
  if (!asset?.uri) {
    return null;
  }

  const mimeType = getPickerMimeType(asset);
  const name =
    typeof asset.name === 'string' && asset.name.trim()
      ? asset.name
      : typeof asset.fileName === 'string' && asset.fileName.trim()
        ? asset.fileName
        : `signed-contract.${mimeType === 'application/pdf' ? 'pdf' : 'jpg'}`;

  return {
    uri: String(asset.uri),
    name,
    type: mimeType,
  };
}

function getPickerMimeType(asset: Record<string, unknown>) {
  if (typeof asset.mimeType === 'string' && asset.mimeType.includes('/')) {
    return asset.mimeType;
  }

  if (typeof asset.type === 'string' && asset.type.includes('/')) {
    return asset.type;
  }

  const name = typeof asset.name === 'string' ? asset.name.toLowerCase() : '';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/pdf';
}

async function openContractFile(url?: string | null) {
  if (!url) {
    Alert.alert('No contract file', 'Contract file is not available yet.');
    return;
  }

  try {
    await WebBrowser.openBrowserAsync(encodeURI(url));
  } catch (error) {
    Alert.alert(
      'Cannot open file',
      error instanceof Error ? error.message : 'Unable to open contract file.'
    );
  }
}

function getFullAssetUrl(url?: string | null) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  const assetBaseUrl = API_BASE_URL.replace(/\/api$/i, '');
  return `${assetBaseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('vi-VN') : 'Chưa cập nhật';
}

function formatCutOffTime(value?: string | null) {
  return value?.slice(0, 5) || 'Chưa cập nhật';
}

function formatMoney(value?: number | null) {
  if (value === null || value === undefined) return '0 đ';
  return `${Number(value).toLocaleString('vi-VN')} đ`;
}

function formatTemperature(value: string | number) {
  const text = String(value);
  return text.includes('°') ? text : `${text} °C`;
}

function formatCategory(category: string) {
  switch (category) {
    case 'FROZEN_FRUITS_VEGGIES':
      return 'Thực phẩm đông lạnh';
    case 'PHARMACEUTICALS':
      return 'Dược phẩm';
    case 'MEAT_SEAFOOD':
      return 'Thịt / Hải sản';
    default:
      return category;
  }
}

function hasCoordinates(order: OrderResponse) {
  return (
    order.destination?.latitude !== null &&
    order.destination?.latitude !== undefined &&
    order.destination?.longitude !== null &&
    order.destination?.longitude !== undefined
  );
}
