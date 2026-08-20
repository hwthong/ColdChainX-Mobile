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
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';

import { API_BASE_URL, ApiClientError, getApiErrorMessage } from '../../../services/apiClient';
import { colors } from '../../../constants/colors';
import { PdfViewerModal } from '../../../components/PdfViewerModal';
import { downloadDocumentAsBase64 } from '../../../utils/documentViewer';
import {
  acceptAppendix,
  ContractAppendixResponse,
  getAppendixByOrder,
  rejectAppendix,
} from '../../../services/appendixApi';
import { ClaimResponse, getClaimsByOrder } from '../../../services/claimApi';
import { customerApi } from '../../../services/customerApi';
import {
  formatCityName,
  formatTransitDuration,
  getContractStatusPresentation,
  getCustomerOrderCategoryLabel,
  getCustomerOrderStatusPresentation,
  getPackagingLabel,
  isActiveTrackingStatus,
  isCustomerClaimEligibleOrderStatus,
} from '../../../constants/customerOrderPresentation';
import {
  ContractInfoResponse,
  getContractByOrder,
  SignedContractFile,
  uploadSignedContract,
} from '../../../services/contractApi';
import { getCustomerIdFromToken } from '../../../services/jwt';
import {
  acceptQuotation,
  getOrderById,
  getOrderQuotations,
  OrderResponse,
  QuotationResponse,
} from '../../../services/orderApi';
import {
  getActiveServiceCatalogs,
  ServiceCatalogItem,
} from '../../../services/serviceCatalogApi';
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
  const [claims, setClaims] = useState<ClaimResponse[]>([]);
  const [trackingDetail, setTrackingDetail] = useState<any>(null);
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
  const [catalogServices, setCatalogServices] = useState<ServiceCatalogItem[]>([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [viewingDoc, setViewingDoc] = useState<{ base64: string; title: string; url?: string } | null>(null);
  const [isOpeningDoc, setIsOpeningDoc] = useState(false);

  const orderId = Array.isArray(id) ? id[0] : id;

  const handleOpenDocument = useCallback(
    async (url?: string | null, title?: string) => {
      if (!url) {
        Alert.alert('Không có file', 'File tài liệu chưa sẵn sàng.');
        return;
      }

      setIsOpeningDoc(true);
      try {
        const base64Data = await downloadDocumentAsBase64(url, accessToken);
        setViewingDoc({
          base64: base64Data,
          title: title || 'Tài liệu',
          url,
        });
      } catch (err) {
        Alert.alert('Không thể mở tài liệu', getApiErrorMessage(err));
      } finally {
        setIsOpeningDoc(false);
      }
    },
    [accessToken]
  );

  const handleDownloadDocument = useCallback(
    async (url?: string | null, title?: string) => {
      if (!url) {
        Alert.alert('Không có file', 'Đường dẫn file chưa sẵn sàng.');
        return;
      }

      const fullUrl = getFullAssetUrl(url) || url;
      try {
        const canOpen = await Linking.canOpenURL(fullUrl);
        if (canOpen) {
          await Linking.openURL(fullUrl);
        } else {
          await WebBrowser.openBrowserAsync(fullUrl);
        }
      } catch (err) {
        try {
          await WebBrowser.openBrowserAsync(fullUrl);
        } catch {
          Alert.alert('Không thể tải file', getApiErrorMessage(err));
        }
      }
    },
    []
  );

  const fetchCatalogServices = useCallback(async () => {
    if (!accessToken) return;
    setIsCatalogLoading(true);
    setCatalogError(null);
    try {
      const response = await getActiveServiceCatalogs(accessToken);
      if (response.success && response.data) {
        const optionalServices = response.data.filter(
          (s) => s.isActive && s.isMandatory === false
        );
        setCatalogServices(optionalServices);
      } else {
        setCatalogError('Không thể tải danh sách dịch vụ.');
      }
    } catch {
      setCatalogError('Không thể tải danh sách dịch vụ.');
    } finally {
      setIsCatalogLoading(false);
    }
  }, [accessToken]);

  const handleToggleServiceSelection = useCallback((serviceId: string) => {
    setSelectedServiceIds((prev) => {
      const next = prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId];
      return Array.from(new Set(next));
    });
  }, []);

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

  const fetchClaimsDetail = useCallback(async () => {
    if (!accessToken || !orderId) {
      setClaims([]);
      return;
    }

    try {
      const response = await getClaimsByOrder(accessToken, orderId, 1, 10);
      if (response.success && Array.isArray(response.data?.data)) {
        setClaims(response.data.data);
      } else {
        setClaims([]);
      }
    } catch {
      setClaims([]);
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

      try {
        const detail = await customerApi.getMyOrderTrackingDetail(orderId);
        setTrackingDetail(detail);
      } catch {
        // Optional tracking detail
      }

      await Promise.all([fetchContractDetail(), fetchAppendixDetail(), fetchCatalogServices(), fetchClaimsDetail()]);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, fetchAppendixDetail, fetchContractDetail, fetchCatalogServices, fetchClaimsDetail, orderId]);

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
      const uniqueServiceCatalogIds = Array.from(new Set(selectedServiceIds));
      const response = await acceptQuotation(
        accessToken,
        quote.quoteId,
        customerId,
        uniqueServiceCatalogIds
      );
      if (!response.success) {
        throw new Error(response.message || 'Không thể chấp nhận báo giá.');
      }

      setSuccessMessage('Bạn đã chấp nhận báo giá thành công.');
      setSelectedServiceIds([]);
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
      setContractError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      return;
    }

    if (!contract) {
      setContractError('Chưa có hợp đồng cho đơn hàng này.');
      return;
    }

    if (!selectedSignedFile) {
      setContractError('Vui lòng chọn file hợp đồng đã ký trước khi gửi.');
      return;
    }

    setIsUploadingContract(true);
    setContractError(null);
    setSuccessMessage(null);

    try {
      const response = await uploadSignedContract(contract.contractId, selectedSignedFile);

      if (!response.success) {
        throw new Error(response.message || 'Không thể tải lên hợp đồng đã ký.');
      }

      setSelectedSignedFile(null);
      setSuccessMessage('Đã tải hợp đồng đã ký lên. Đang chờ bộ phận Sales xác nhận.');
      Alert.alert('Hoàn tất tải lên', 'Đã tải hợp đồng đã ký lên. Đang chờ bộ phận Sales xác nhận.');
      await fetchOrderDetail();
    } catch (err) {
      setContractError(getApiErrorMessage(err));
    } finally {
      setIsUploadingContract(false);
    }
  };

  const handleViewAppendix = async () => {
    if (!appendix?.pdfUrl) {
      Alert.alert('Không có PDF', 'File PDF của phụ lục chưa sẵn sàng.');
      return;
    }

    await handleOpenDocument(appendix.pdfUrl, 'Phụ lục hợp đồng');
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
      setSuccessMessage('Đã chấp nhận phụ lục. Vui lòng chờ bộ phận Sales xác nhận thực thi.');
      Alert.alert('Đã chấp nhận', 'Đã chấp nhận phụ lục. Vui lòng chờ bộ phận Sales xác nhận thực thi.');
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
      <View style={{ backgroundColor: colors.surface.page }} className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.brand.primary} />
        <Text style={{ color: colors.brand.primary }} className="mt-4 font-medium">Đang tải chi tiết đơn...</Text>
      </View>
    );
  }

  if (error && !order) {
    return (
      <View style={{ backgroundColor: colors.surface.page }} className="flex-1 items-center justify-center p-6">
        <Ionicons name="alert-circle-outline" size={48} color={colors.status.danger.main} />
        <Text style={{ color: colors.status.danger.main }} className="mt-4 text-center font-medium leading-6">{error}</Text>
        <Pressable onPress={() => router.back()} className="mt-4 rounded-xl bg-gray-200 px-6 py-2">
          <Text className="font-bold text-gray-800">Quay lại</Text>
        </Pressable>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={{ backgroundColor: colors.surface.page }} className="flex-1 items-center justify-center p-6">
        <Text style={{ color: colors.text.secondary }} className="text-center font-medium">Không tìm thấy đơn hàng.</Text>
      </View>
    );
  }

  const stageDescription = getStageAwareHeaderDescription(order.status, Boolean(order.masterTripId));

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface.page }}>
      <ScrollView style={{ backgroundColor: colors.surface.page }} className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 80 }}>
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

        {order.status?.toUpperCase() === 'NEEDS_UPDATE' ? (
          <View className="mb-4 rounded-2xl border border-orange-300 bg-orange-50 p-4">
            <View className="flex-row items-center gap-2">
              <Ionicons name="alert-circle" size={22} color="#c2410c" />
              <Text className="text-base font-bold text-orange-950">Đơn hàng cần cập nhật</Text>
            </View>
            <Text className="mt-2 text-sm leading-5 text-orange-800">
              Bộ phận Sales yêu cầu bạn cập nhật lại thông tin đơn hàng trước khi tiếp tục duyệt.
            </Text>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/(customer)/create-order',
                  params: { orderId: order.orderId, mode: 'edit' },
                })
              }
              style={{ backgroundColor: '#ea580c' }}
              className="mt-3 flex-row items-center justify-center gap-2 rounded-xl py-3 shadow-sm"
            >
              <Ionicons name="create-outline" size={18} color="#ffffff" />
              <Text className="font-bold text-white">Cập nhật thông tin đơn hàng</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="mb-4 rounded-2xl border p-5 shadow-sm">
          <View className="mb-4 flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Ionicons name="barcode-outline" size={20} color={colors.brand.primary} />
                <Text style={{ color: colors.brand.primary }} className="text-xl font-bold">{order.trackingCode}</Text>
              </View>
              <Text style={{ color: colors.text.secondary }} className="mt-2 text-xs">{formatDateWithoutSeconds(order.createdAt)}</Text>
            </View>
            <StatusBadge status={order.status} />
          </View>

          {order.masterTripId && isActiveTrackingStatus(order.status) ? (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/(customer)/tracking/[orderId]',
                  params: { orderId: order.orderId, trackingCode: order.trackingCode },
                } as never)
              }
              style={{ backgroundColor: colors.brand.primary }}
              className="flex-row items-center justify-center gap-2 rounded-xl px-4 py-3"
            >
              <Ionicons name="navigate-outline" size={18} color={colors.text.onPrimary} />
              <Text style={{ color: colors.text.onPrimary }} className="font-bold">Mở giám sát chuyến</Text>
            </Pressable>
          ) : (
            <Text style={{ color: colors.text.secondary }} className="text-sm font-medium leading-6">
              {stageDescription}
            </Text>
          )}

          {order.status?.toUpperCase() === 'CONTRACT_SIGNED' ? (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/(customer)/schedule-delivery',
                  params: { orderId: order.orderId },
                } as never)
              }
              style={{ backgroundColor: colors.brand.primary }}
              className="mt-3 flex-row items-center justify-center gap-2 rounded-xl px-4 py-3 shadow-sm"
            >
              <Ionicons name="calendar-outline" size={18} color={colors.text.onPrimary} />
              <Text style={{ color: colors.text.onPrimary }} className="font-bold">
                Đặt lịch hẹn giao kho & Nhận mã QR
              </Text>
            </Pressable>
          ) : null}

          {claims.length > 0 ? (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/(customer)/claims',
                  params: { orderId: order.orderId, trackingCode: order.trackingCode, mode: 'view' },
                } as never)
              }
              style={{ backgroundColor: colors.surface.card, borderColor: colors.brand.primary }}
              className="mt-3 flex-row items-center justify-center gap-2 rounded-xl border px-4 py-3"
            >
              <Ionicons name="document-text-outline" size={18} color={colors.brand.primary} />
              <Text style={{ color: colors.brand.primary }} className="font-bold">Xem khiếu nại</Text>
            </Pressable>
          ) : isCustomerClaimEligibleOrderStatus(order.status) ? (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/(customer)/claims',
                  params: { orderId: order.orderId, trackingCode: order.trackingCode, mode: 'create' },
                } as never)
              }
              style={{ backgroundColor: colors.surface.card, borderColor: colors.brand.primary }}
              className="mt-3 flex-row items-center justify-center gap-2 rounded-xl border px-4 py-3"
            >
              <Ionicons name="alert-circle-outline" size={18} color={colors.brand.primary} />
              <Text style={{ color: colors.brand.primary }} className="font-bold">Tạo khiếu nại</Text>
            </Pressable>
          ) : null}

          {order.status?.toUpperCase() === 'PENDING_REVIEW' ? (
            <View className="mt-4">
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/(customer)/create-order',
                    params: { orderId: order.orderId, mode: 'edit' },
                  })
                }
                style={{ borderColor: colors.brand.primary }}
                className="flex-row items-center justify-center gap-2 rounded-xl border bg-white py-2.5"
              >
                <Ionicons name="create-outline" size={18} color={colors.brand.primary} />
                <Text style={{ color: colors.brand.primary }} className="font-bold">
                  Chỉnh sửa đơn hàng
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {claims.length > 0 && claims[0] ? (
          <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="mb-4 rounded-2xl border p-5 shadow-sm">
            <View style={{ borderBottomColor: colors.border.default }} className="mb-3 flex-row items-center justify-between border-b pb-3">
              <View className="flex-row items-center gap-2">
                <Ionicons name="alert-circle-outline" size={18} color={colors.brand.primary} />
                <Text style={{ color: colors.brand.primary }} className="text-base font-bold">Thông tin khiếu nại</Text>
              </View>
              <ClaimStatusBadge status={claims[0].status} />
            </View>

            <View className="gap-3">
              <InfoRow label="Mã khiếu nại" value={claims[0].claimCode} />
              <InfoRow label="Loại khiếu nại" value={getClaimCategoryLabel(claims[0].claimType)} />
              <View>
                <Text style={{ color: colors.text.secondary }} className="text-sm">Mô tả sự cố</Text>
                <Text style={{ color: colors.text.primary }} className="mt-1 text-sm font-semibold leading-5">
                  {claims[0].description}
                </Text>
              </View>

              {claims[0].resolutionNote ? (
                <View className="rounded-xl border border-green-200 bg-green-50 p-3">
                  <Text className="text-xs font-bold uppercase text-green-700">Phản hồi xử lý</Text>
                  <Text className="mt-1 text-sm font-semibold text-green-800">{claims[0].resolutionNote}</Text>
                </View>
              ) : null}

              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/(customer)/claims',
                    params: { orderId: order.orderId, trackingCode: order.trackingCode, mode: 'view' },
                  } as never)
                }
                style={{ backgroundColor: colors.surface.page, borderColor: colors.brand.primary }}
                className="mt-1 flex-row items-center justify-center gap-2 rounded-xl border py-2.5"
              >
                <Ionicons name="eye-outline" size={16} color={colors.brand.primary} />
                <Text style={{ color: colors.brand.primary }} className="text-sm font-bold">Xem chi tiết trên trang khiếu nại</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <InfoCard title="Thông tin hàng hóa" icon="cube-outline">
          <InfoRow label="Tên hàng" value={order.itemName} />
          <InfoRow label="Phân loại" value={formatCategory(order.category)} />
          <InfoRow label="Số kiện" value={`${order.quantity}`} />
          <InfoRow label="Đóng gói" value={getPackagingLabel(order.packingType)} />
          <InfoRow label="Tổng khối lượng" value={`${order.expectedWeightKg} kg`} />
          <InfoRow label="Nhiệt độ yêu cầu" value={formatTemperature(order.tempCondition)} strong />
        </InfoCard>

        {order.route ? (
          <InfoCard title="Tuyến vận chuyển" icon="git-branch-outline">
            <InfoRow label="Điểm đi" value={formatCityName(order.route.originCity)} />
            <InfoRow label="Điểm đến" value={formatCityName(order.route.destCity)} />
            <InfoRow label="Thời gian vận chuyển" value={formatTransitDuration(order.route.transitTime)} />
            <InfoRow label="Hạn nhận hàng tại kho" value={formatCutOffTime(order.route.cutOffTime)} />
            {order.route.routeCode ? (
              <View style={{ borderTopColor: colors.border.default }} className="mt-1 border-t pt-2">
                <Text style={{ color: colors.text.muted }} className="text-[11px]">Mã tuyến: {order.route.routeCode}</Text>
              </View>
            ) : null}
          </InfoCard>
        ) : null}

        <InfoCard title="Giao hàng đến" icon="location-sharp">
          <Text style={{ color: colors.text.primary }} className="text-sm font-semibold leading-5">
            {order.destination?.address || 'Chưa cập nhật địa chỉ'}
          </Text>
        </InfoCard>

        {hasCoordinates(order) ? (
          <InfoCard title="Vị trí giao hàng" icon="map-outline">
            <InfoRow label="Vĩ độ (Latitude)" value={`${order.destination?.latitude}`} />
            <InfoRow label="Kinh độ (Longitude)" value={`${order.destination?.longitude}`} />
            <Text style={{ color: colors.text.secondary }} className="mt-2 text-xs leading-5">
              Bản đồ sẽ được hiển thị khi ứng dụng tích hợp thư viện bản đồ phù hợp.
            </Text>
          </InfoCard>
        ) : null}

        {documentImage ? (
          <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="mb-4 rounded-2xl border p-5 shadow-sm">
            <View style={{ borderBottomColor: colors.border.default }} className="mb-3 flex-row items-center gap-2 border-b pb-3">
              <Ionicons name="image-outline" size={18} color={colors.brand.primary} />
              <Text style={{ color: colors.brand.primary }} className="text-base font-bold">Ảnh kiện hàng</Text>
            </View>
            <Image source={{ uri: documentImage }} className="h-52 w-full rounded-xl bg-gray-100" resizeMode="cover" />
          </View>
        ) : null}

        <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="mb-4 rounded-2xl border p-5 shadow-sm">
          <View style={{ borderBottomColor: colors.border.default }} className="mb-3 flex-row items-center gap-2 border-b pb-3">
            <Ionicons name="receipt-outline" size={18} color={colors.brand.primary} />
            <Text style={{ color: colors.brand.primary }} className="text-base font-bold">Báo giá</Text>
          </View>

          {displayedQuotations.length === 0 ? (
            <Text style={{ color: colors.text.secondary }} className="text-sm leading-6">
              Đơn hàng đang chờ bộ phận Sales kiểm duyệt và gửi báo giá.
            </Text>
          ) : (
            <View className="gap-4">
              {displayedQuotations.map((quote) => (
                <QuotationCard
                  key={quote.quoteId}
                  quote={quote}
                  hasContract={Boolean(contract)}
                  isAccepting={isAcceptingQuoteId === quote.quoteId}
                  optionalServices={catalogServices}
                  isCatalogLoading={isCatalogLoading}
                  catalogError={catalogError}
                  selectedServiceIds={selectedServiceIds}
                  onToggleService={handleToggleServiceSelection}
                  onAccept={() => handleAcceptQuotation(quote)}
                  onOpenQuote={(url) => handleOpenDocument(url, 'Báo giá chi tiết')}
                  isOpeningQuote={isOpeningDoc}
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
          onOpenDoc={handleOpenDocument}
          onDownloadDoc={handleDownloadDocument}
        />

        <AppendixSection
          appendix={appendix}
          appendixError={appendixError}
          action={appendixAction}
          isLoading={isAppendixLoading}
          orderStatus={order.status}
          onAccept={handleAcceptAppendix}
          onReject={handleRejectAppendix}
          onView={handleViewAppendix}
        />

        {trackingDetail?.warehouse ? (
          <InfoCard title="Giao hàng tại Hub" icon="business-outline">
            <InfoRow label="Kho nhận" value={trackingDetail.warehouse.warehouseName} strong />
            <InfoRow label="Nhiệt độ ghi nhận" value={formatTemperature(trackingDetail.warehouse.storedTemperature)} />
            <InfoRow label="Thời gian nhận" value={formatDateWithoutSeconds(trackingDetail.warehouse.receivedAt)} />
          </InfoCard>
        ) : null}

        {trackingDetail?.tripInfo ? (
          <InfoCard title="Điều phối & xếp xe" icon="file-tray-stacked-outline">
            <InfoRow label="Chuyến xe" value={trackingDetail.tripInfo.tripId?.slice(0, 8).toUpperCase()} strong />
            <InfoRow label="Số seal" value={trackingDetail.tripInfo.sealNumber || '--'} />
            {trackingDetail.vehicle ? (
              <InfoRow label="Xe vận chuyển" value={`${trackingDetail.vehicle.truckPlate} - ${trackingDetail.vehicle.vehicleType}`} />
            ) : null}
            {trackingDetail.drivers?.length > 0 ? (
              <InfoRow label="Tài xế" value={trackingDetail.drivers.map((d: any) => d.fullName).join(', ')} />
            ) : null}
            {trackingDetail.route ? (
              <InfoRow label="Tuyến" value={`${formatCityName(trackingDetail.route.originCity)} -> ${formatCityName(trackingDetail.route.destCity)}`} />
            ) : null}
            <InfoRow label="Khởi hành" value={formatDateWithoutSeconds(trackingDetail.tripInfo.departedAt)} />
            <InfoRow label="Dự kiến đến" value={formatDateWithoutSeconds(trackingDetail.estimatedArrival)} />
          </InfoCard>
        ) : null}

        {trackingDetail?.delivery ? (
          <InfoCard title="Giao hàng & ePOD" icon="home-outline">
            <InfoRow label="Người nhận" value={trackingDetail.delivery.receiverName} strong />
            <InfoRow label="SĐT nhận" value={trackingDetail.delivery.receiverPhone} />
            <InfoRow label="Ghi chú ePOD" value={trackingDetail.delivery.note || '--'} />
            <InfoRow label="Thời gian ký nhận" value={formatDateWithoutSeconds(trackingDetail.delivery.signedAt)} />

            {trackingDetail?.returnedItems?.length > 0 ? (
              <View className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3">
                <Text className="text-sm font-bold text-red-700">Hàng trả về ({trackingDetail.returnedItems.length})</Text>
                {trackingDetail.returnedItems.map((item: any, idx: number) => (
                  <View key={idx} className="mt-2">
                    <Text className="text-xs font-semibold text-red-800">{item.itemName} (SL: {item.quantity})</Text>
                    <Text className="text-xs text-red-600">Lý do: {item.reasonNote || item.reasonType}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </InfoCard>
        ) : null}
      </ScrollView>

      <PdfViewerModal
        visible={Boolean(viewingDoc)}
        title={viewingDoc?.title ?? 'Tài liệu'}
        subtitle={order?.trackingCode}
        base64Data={viewingDoc?.base64}
        onClose={() => setViewingDoc(null)}
        onDownload={viewingDoc?.url ? () => handleDownloadDocument(viewingDoc.url, viewingDoc.title) : undefined}
        primaryColor={colors.brand.primary}
        backgroundColor={colors.surface.page}
        cardBackgroundColor={colors.surface.card}
        textColor={colors.text.primary}
        borderColor={colors.border.default}
      />
    </View>
  );
}

function QuotationCard({
  quote,
  hasContract,
  isAccepting,
  optionalServices,
  isCatalogLoading,
  catalogError,
  selectedServiceIds,
  onToggleService,
  onAccept,
  onOpenQuote,
  isOpeningQuote,
}: {
  quote: QuotationResponse;
  hasContract: boolean;
  isAccepting: boolean;
  optionalServices: ServiceCatalogItem[];
  isCatalogLoading: boolean;
  catalogError: string | null;
  selectedServiceIds: string[];
  onToggleService: (id: string) => void;
  onAccept: () => void;
  onOpenQuote?: (url: string) => void;
  isOpeningQuote?: boolean;
}) {
  const canAccept = isAcceptableQuote(quote.status);
  const accepted = isAcceptedQuote(quote.status);
  const fullFileUrl = getFullAssetUrl(quote.fileUrl);

  const optionalTotal = optionalServices
    .filter((s) => selectedServiceIds.includes(s.serviceCatalogId))
    .reduce((acc, s) => acc + (s.defaultPrice || 0), 0);

  return (
    <View style={{ backgroundColor: colors.surface.page, borderColor: colors.border.default }} className="rounded-2xl border p-4">
      <View className="mb-3 flex-row items-start justify-between gap-3">
        <View>
          <Text style={{ color: colors.text.primary }} className="text-sm font-bold">Báo giá chi tiết</Text>
          <Text style={{ color: colors.text.secondary }} className="mt-1 text-xs">{formatDateWithoutSeconds(quote.createdAt)}</Text>
        </View>
        <StatusBadge status={quote.status} />
      </View>

      <View className="gap-2">
        <InfoRow label="Tổng tiền" value={formatMoney(quote.finalAmount)} strong />
        <InfoRow label="Cước vận chuyển" value={formatMoney(quote.baseFreight)} />
        <InfoRow label="Phụ phí last-mile" value={formatMoney(quote.lastMileSurcharge)} />
        <InfoRow label="VAS" value={formatMoney(quote.vasAmount)} />
        <InfoRow label="VAT" value={formatMoney(quote.vatAmount)} />
        {optionalTotal > 0 ? (
          <InfoRow
            label="Dự kiến tổng sau chọn dịch vụ"
            value={formatMoney(quote.finalAmount + optionalTotal)}
            strong
          />
        ) : null}
      </View>

      {fullFileUrl ? (
        <Pressable
          onPress={() => onOpenQuote?.(fullFileUrl)}
          disabled={isOpeningQuote}
          className="mt-4 flex-row items-center gap-2"
        >
          {isOpeningQuote ? (
            <ActivityIndicator size="small" color={colors.brand.primary} />
          ) : (
            <Ionicons name="document-attach-outline" size={16} color={colors.brand.primary} />
          )}
          <Text style={{ color: colors.brand.primary }} className="text-sm font-semibold">
            {isOpeningQuote ? 'Đang mở báo giá...' : 'Xem báo giá'}
          </Text>
        </Pressable>
      ) : null}

      {canAccept ? (
        <View className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <Text style={{ color: colors.text.primary }} className="mb-2 text-sm font-bold">
            Chọn thêm dịch vụ
          </Text>
          {isCatalogLoading ? (
            <ActivityIndicator size="small" color={colors.brand.primary} className="my-2" />
          ) : catalogError ? (
            <Text className="text-xs text-red-500">{catalogError}</Text>
          ) : optionalServices.length === 0 ? (
            <Text style={{ color: colors.text.secondary }} className="text-xs">
              Hiện chưa có dịch vụ bổ sung.
            </Text>
          ) : (
            <View className="gap-2">
              {optionalServices.map((service) => {
                const isChecked = selectedServiceIds.includes(service.serviceCatalogId);
                return (
                  <Pressable
                    key={service.serviceCatalogId}
                    onPress={() => onToggleService(service.serviceCatalogId)}
                    className="flex-row items-start gap-3 rounded-lg border border-gray-200 bg-white p-3"
                  >
                    <Ionicons
                      name={isChecked ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={isChecked ? colors.brand.primary : colors.text.secondary}
                      style={{ marginTop: 2 }}
                    />
                    <View className="flex-1">
                      <View className="flex-row items-center justify-between gap-2">
                        <Text style={{ color: colors.text.primary }} className="text-sm font-semibold">
                          {service.serviceName}
                        </Text>
                        <Text style={{ color: colors.brand.primary }} className="text-xs font-bold">
                          {formatMoney(service.defaultPrice)}
                        </Text>
                      </View>
                      {service.description ? (
                        <Text style={{ color: colors.text.secondary }} className="mt-1 text-xs leading-4">
                          {service.description}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      ) : null}

      {canAccept ? (
        <Pressable
          onPress={onAccept}
          disabled={isAccepting}
          style={{ backgroundColor: colors.brand.primary }}
          className={[
            'mt-4 h-12 items-center justify-center rounded-xl',
            isAccepting ? 'opacity-70' : '',
          ].join(' ')}
        >
          <Text style={{ color: colors.text.onPrimary }} className="font-bold">
            {isAccepting ? 'ĐANG XỬ LÝ...' : 'Chấp nhận báo giá'}
          </Text>
        </Pressable>
      ) : null}

      {accepted && !hasContract ? (
        <View className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3">
          <Text className="text-sm font-semibold leading-5 text-green-700">
            Báo giá đã được chấp nhận. Đang chờ bộ phận Sales tạo hợp đồng.
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
  onOpenDoc,
  onDownloadDoc,
}: {
  contract: ContractInfoResponse | null;
  contractError: string | null;
  isLoading: boolean;
  isUploading: boolean;
  orderTrackingCode?: string | null;
  selectedFile: SignedContractFile | null;
  onPickFile: () => void;
  onSubmit: () => void;
  onOpenDoc?: (url?: string | null, title?: string) => void;
  onDownloadDoc?: (url?: string | null, title?: string) => void;
}) {
  const status = contract?.status.toUpperCase() ?? '';
  const contractFileUrl = getFullAssetUrl(contract?.fileUrl);
  const signedFileUrl = getFullAssetUrl(contract?.signedFileUrl);
  const canUpload = status === 'PENDING_CUSTOMER_SIGNATURE';

  return (
    <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="mb-4 rounded-2xl border p-5 shadow-sm">
      <View style={{ borderBottomColor: colors.border.default }} className="mb-3 flex-row items-center gap-2 border-b pb-3">
        <Ionicons name="document-text-outline" size={18} color={colors.brand.primary} />
        <Text style={{ color: colors.brand.primary }} className="text-base font-bold">Hợp đồng</Text>
      </View>

      {isLoading ? (
        <View style={{ backgroundColor: colors.surface.page }} className="flex-row items-center gap-3 rounded-xl p-3">
          <ActivityIndicator size="small" color={colors.brand.primary} />
          <Text style={{ color: colors.text.secondary }} className="text-sm font-semibold">Đang tải hợp đồng...</Text>
        </View>
      ) : null}

      {contractError ? (
        <View className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3">
          <Text className="text-sm font-semibold leading-5 text-red-700">{contractError}</Text>
        </View>
      ) : null}

      {!isLoading && !contract ? (
        <Text style={{ color: colors.text.secondary }} className="text-sm leading-6">Chưa có hợp đồng cho đơn hàng này.</Text>
      ) : null}

      {!isLoading && contract ? (
        <View className="gap-3">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text style={{ color: colors.text.primary }} className="text-sm font-bold">{contract.contractNumber}</Text>
              <Text style={{ color: colors.text.secondary }} className="mt-1 text-xs">Đã gửi: {formatDateWithoutSeconds(contract.sentAt)}</Text>
            </View>
            <ContractStatusBadge status={contract.status} />
          </View>

          {contractFileUrl ? (
            <View className="flex-row items-center gap-2.5">
              <Pressable
                onPress={() => onOpenDoc?.(contractFileUrl, 'Hợp đồng vận chuyển')}
                style={{ backgroundColor: colors.surface.page, borderColor: colors.brand.primary }}
                className="flex-1 flex-row items-center justify-center gap-2 rounded-xl border py-2.5"
              >
                <Ionicons name="document-attach-outline" size={16} color={colors.brand.primary} />
                <Text style={{ color: colors.brand.primary }} className="text-sm font-semibold">Xem hợp đồng</Text>
              </Pressable>

              <Pressable
                onPress={() => onDownloadDoc?.(contractFileUrl, 'Hợp đồng vận chuyển')}
                style={{ backgroundColor: colors.surface.page, borderColor: colors.border.default }}
                className="flex-1 flex-row items-center justify-center gap-2 rounded-xl border py-2.5"
              >
                <Ionicons name="download-outline" size={16} color={colors.text.primary} />
                <Text style={{ color: colors.text.primary }} className="text-sm font-semibold">Tải file về</Text>
              </Pressable>
            </View>
          ) : null}

          {status === 'DRAFT' || status === 'PENDING_SIGNATURE' ? (
            <Text style={{ color: colors.text.secondary }} className="text-sm leading-6">Hợp đồng đang được bộ phận Sales chuẩn bị.</Text>
          ) : null}

          {canUpload ? (
            <View style={{ backgroundColor: colors.surface.page, borderColor: colors.border.default }} className="gap-3 rounded-2xl border p-4">
              <Text style={{ color: colors.text.secondary }} className="text-sm leading-6">
                Vui lòng tải lên hợp đồng đã ký để bộ phận Sales xác nhận.
              </Text>

              <Pressable
                onPress={onPickFile}
                disabled={isUploading}
                style={{ backgroundColor: colors.surface.card, borderColor: colors.brand.primary }}
                className="h-12 flex-row items-center justify-center gap-2 rounded-xl border"
              >
                <Ionicons name="cloud-upload-outline" size={18} color={colors.brand.primary} />
                <Text style={{ color: colors.brand.primary }} className="font-bold">Chọn file hợp đồng đã ký</Text>
              </Pressable>

              {selectedFile ? (
                <View className="rounded-xl border border-green-200 bg-green-50 p-3">
                  <Text className="text-xs font-semibold uppercase text-green-700">File đã chọn</Text>
                  <Text className="mt-1 text-sm font-bold text-green-800">
                    {selectedFile.name || 'signed-contract.pdf'}
                  </Text>
                </View>
              ) : null}

              <Pressable
                onPress={onSubmit}
                disabled={!selectedFile || isUploading}
                style={{ backgroundColor: colors.brand.primary }}
                className={[
                  'h-12 items-center justify-center rounded-xl',
                  !selectedFile || isUploading ? 'opacity-60' : '',
                ].join(' ')}
              >
                <Text style={{ color: colors.text.onPrimary }} className="font-bold">
                  {isUploading ? 'ĐANG TẢI LÊN...' : 'Tải hợp đồng đã ký lên'}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {signedFileUrl ? (
            <View className="rounded-xl border border-green-200 bg-green-50 p-3">
              <Text className="text-sm font-semibold leading-5 text-green-800">
                Hợp đồng đã ký đã được gửi thành công.
              </Text>
              <View className="mt-2.5 flex-row items-center gap-2.5">
                <Pressable
                  onPress={() => onOpenDoc?.(signedFileUrl, 'Hợp đồng đã ký')}
                  className="flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-green-300 bg-white py-2"
                >
                  <Ionicons name="document-attach-outline" size={16} color="#15803D" />
                  <Text className="text-sm font-bold text-green-800">Xem file đã ký</Text>
                </Pressable>

                <Pressable
                  onPress={() => onDownloadDoc?.(signedFileUrl, 'Hợp đồng đã ký')}
                  className="flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-green-300 bg-white py-2"
                >
                  <Ionicons name="download-outline" size={16} color="#15803D" />
                  <Text className="text-sm font-bold text-green-800">Tải file về</Text>
                </Pressable>
              </View>
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
  onReject,
  onView,
}: {
  appendix: ContractAppendixResponse | null;
  appendixError: string | null;
  action: 'accept' | 'reject' | null;
  isLoading: boolean;
  orderStatus: string;
  onAccept: () => void;
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
    <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="mb-4 rounded-2xl border p-5 shadow-sm">
      <View style={{ borderBottomColor: colors.border.default }} className="mb-3 flex-row items-center gap-2 border-b pb-3">
        <Ionicons name="document-attach-outline" size={18} color={colors.brand.primary} />
        <Text style={{ color: colors.brand.primary }} className="text-base font-bold">Phụ lục điều chỉnh cước</Text>
      </View>

      {isLoading ? (
        <View style={{ backgroundColor: colors.surface.page }} className="flex-row items-center gap-3 rounded-xl p-3">
          <ActivityIndicator size="small" color={colors.brand.primary} />
          <Text style={{ color: colors.text.secondary }} className="text-sm font-semibold">Đang kiểm tra phụ lục...</Text>
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
              <Text style={{ color: colors.text.primary }} className="text-sm font-bold">{appendix.appendixNumber}</Text>
              <Text style={{ color: colors.text.secondary }} className="mt-1 text-xs">Gửi lúc: {formatDateWithoutSeconds(appendix.sentAt)}</Text>
            </View>
            <StatusBadge status={appendix.status} />
          </View>

          <Text style={{ color: colors.text.secondary }} className="text-sm leading-6">
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
                Bạn đã chấp nhận phụ lục. Đang chờ bộ phận Sales thực thi xử lý nhập kho.
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
              disabled={!hasPdf}
              style={{
                backgroundColor: hasPdf ? colors.surface.card : colors.surface.page,
                borderColor: hasPdf ? colors.brand.primary : colors.border.default,
              }}
              className="h-11 flex-row items-center justify-center gap-2 rounded-xl border px-4"
            >
              <Ionicons name="eye-outline" size={16} color={hasPdf ? colors.brand.primary : colors.text.muted} />
              <Text style={{ color: hasPdf ? colors.brand.primary : colors.text.muted }} className="text-sm font-bold">
                Xem phụ lục
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
    <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="mb-4 rounded-2xl border p-5 shadow-sm">
      <View style={{ borderBottomColor: colors.border.default }} className="mb-3 flex-row items-center gap-2 border-b pb-3">
        <Ionicons name={icon} size={18} color={colors.brand.primary} />
        <Text style={{ color: colors.brand.primary }} className="text-base font-bold">{title}</Text>
      </View>
      <View className="gap-3">{children}</View>
    </View>
  );
}

function InfoRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <View className="flex-row items-start justify-between gap-4">
      <Text style={{ color: colors.text.secondary }} className="text-sm">{label}</Text>
      <Text style={{ color: strong ? '#006E0A' : colors.text.primary }} className={['flex-1 text-right text-sm', strong ? 'font-bold' : 'font-semibold'].join(' ')}>
        {value}
      </Text>
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const presentation = getCustomerOrderStatusPresentation(status);

  return (
    <View className={`rounded-full border px-2.5 py-1 ${presentation.containerClass}`}>
      <Text className={`text-[10px] font-bold uppercase tracking-wider ${presentation.textClass}`}>
        {presentation.label}
      </Text>
    </View>
  );
}

function ContractStatusBadge({ status }: { status: string }) {
  const presentation = getContractStatusPresentation(status);

  return (
    <View className={`rounded-full border px-2.5 py-1 ${presentation.containerClass}`}>
      <Text className={`text-[10px] font-bold uppercase tracking-wider ${presentation.textClass}`}>
        {presentation.label}
      </Text>
    </View>
  );
}

function getStageAwareHeaderDescription(status?: string | null, hasMasterTrip?: boolean): string {
  if (hasMasterTrip) return 'Đơn hàng đã được gán vào chuyến xe giám sát.';
  const upper = status?.trim().toUpperCase();
  switch (upper) {
    case 'PENDING':
    case 'PENDING_REVIEW':
      return 'Đơn hàng đang chờ Sales duyệt.';
    case 'NEEDS_UPDATE':
      return 'Bộ phận Sales yêu cầu bạn cập nhật lại thông tin đơn hàng.';
    case 'QUOTING':
    case 'SENT':
      return 'Đang chờ xác nhận báo giá.';
    case 'CONTRACT_PENDING':
    case 'PENDING_CUSTOMER_SIGNATURE':
      return 'Đơn hàng đang ở bước hợp đồng.';
    case 'PENDING_SALES_VERIFICATION':
      return 'Hợp đồng đang được bộ phận Sales xác minh.';
    case 'CONTRACT_SIGNED':
    case 'ACCEPTED':
    case 'ACTIVE':
    case 'EXECUTED':
      return 'Hợp đồng đã xác nhận, sẵn sàng điều phối.';
    case 'SCHEDULED':
    case 'DISPATCHED_PENDING':
      return 'Lịch vận chuyển đã được xác nhận.';
    case 'IN_TRANSIT':
      return 'Đơn hàng đang được vận chuyển.';
    case 'DELIVERED':
      return 'Đơn hàng đã giao thành công.';
    default:
      return 'Đơn hàng đang trong quá trình xử lý.';
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

function getFullAssetUrl(url?: string | null) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  const assetBaseUrl = API_BASE_URL.replace(/\/api$/i, '');
  return `${assetBaseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
}

function formatDateWithoutSeconds(value?: string | null) {
  if (!value) return 'Chưa cập nhật';
  let iso = value.trim();
  if (!iso.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(iso)) {
    iso += 'Z';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Chưa cập nhật';

  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${day}/${month}/${year} · ${hours}:${minutes}`;
}

function formatCutOffTime(value?: string | null) {
  return value?.slice(0, 5) || 'Chưa cập nhật';
}

function formatMoney(value?: number | null) {
  if (value === null || value === undefined) return '0 đ';
  return `${Number(value).toLocaleString('vi-VN')} đ`;
}

function formatTemperature(value?: string | number | null) {
  if (value === null || value === undefined || value === '') return 'Chưa cập nhật';
  const text = String(value).trim();
  const num = parseFloat(text);
  const cleanVal = Number.isNaN(num) ? text : `${num}`;
  return cleanVal.includes('°') ? cleanVal : `${cleanVal}°C`;
}

function formatCategory(category: string) {
  return getCustomerOrderCategoryLabel(category) ?? 'Chưa phân loại';
}

function hasCoordinates(order: OrderResponse) {
  return (
    order.destination?.latitude !== null &&
    order.destination?.latitude !== undefined &&
    order.destination?.longitude !== null &&
    order.destination?.longitude !== undefined
  );
}

const CLAIM_CATEGORY_MAP: Record<string, string> = {
  DAMAGE: 'Hư hỏng',
  QUALITY_VIOLATION: 'Nhiệt độ',
  LOSS: 'Thất lạc',
  DELAY: 'Chậm trễ',
  WRONG_ITEM: 'Sai hàng',
};

function getClaimCategoryLabel(value?: string | null): string {
  const normalized = value?.trim().toUpperCase();
  return (normalized && CLAIM_CATEGORY_MAP[normalized]) || value || 'Chưa phân loại';
}

function getClaimStatusPresentation(status?: string | null) {
  switch (status?.trim().toUpperCase()) {
    case 'OPEN':
      return { label: 'Mới tạo', color: colors.text.secondary, bg: colors.surface.card, border: colors.border.strong };
    case 'PENDING_REVIEW':
    case 'PENDING_DISPATCHER_REVIEW':
      return { label: 'Chờ điều phối', color: colors.status.warning.main, bg: colors.status.warning.bg, border: colors.status.warning.border };
    case 'PENDING_ACCOUNTANT_REVIEW':
      return { label: 'Chờ kế toán', color: colors.status.info.main, bg: colors.status.info.bg, border: colors.status.info.border };
    case 'RESOLVED_PAID':
    case 'RESOLVED':
    case 'APPROVED':
      return { label: 'Đã xử lý', color: colors.status.success.main, bg: colors.status.success.bg, border: colors.status.success.border };
    case 'REJECTED':
      return { label: 'Đã từ chối', color: colors.status.danger.main, bg: colors.status.danger.bg, border: colors.status.danger.border };
    case 'CLOSED':
      return { label: 'Đã đóng', color: colors.text.muted, bg: colors.surface.page, border: colors.border.default };
    default:
      return { label: status || 'Chưa cập nhật', color: colors.text.secondary, bg: colors.surface.card, border: colors.border.default };
  }
}

function ClaimStatusBadge({ status }: { status?: string | null }) {
  const presentation = getClaimStatusPresentation(status);
  return (
    <View style={{ backgroundColor: presentation.bg, borderColor: presentation.border }} className="rounded-full border px-2.5 py-1">
      <Text style={{ color: presentation.color }} className="text-[10px] font-bold uppercase">{presentation.label}</Text>
    </View>
  );
}
