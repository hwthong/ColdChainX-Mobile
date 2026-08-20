import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors } from '../../constants/colors';
import { isCustomerClaimEligibleOrderStatus } from '../../constants/customerOrderPresentation';
import { API_BASE_URL, getApiErrorMessage, getCustomerDataErrorMessage } from '../../services/apiClient';
import {
  ClaimCategory,
  ClaimEvidenceImage,
  ClaimResponse,
  createClaim,
  getAllClaims,
  getClaimsByOrder,
} from '../../services/claimApi';
import { customerApi, CustomerOrderSummaryResponse } from '../../services/customerApi';
import { useAuthStore } from '../../store/useAuthStore';

const ORDER_PAGE_SIZE = 100;
const MAX_EVIDENCE_IMAGES = 5;

const CLAIM_CATEGORIES: {
  value: ClaimCategory;
  label: string;
  helper: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: 'DAMAGE', label: 'Hư hỏng', helper: 'Hàng móp, vỡ hoặc rách bao bì', icon: 'cube-outline' },
  { value: 'QUALITY_VIOLATION', label: 'Nhiệt độ', helper: 'Không đúng điều kiện bảo quản', icon: 'thermometer-outline' },
  { value: 'LOSS', label: 'Thất lạc', helper: 'Thiếu kiện hoặc mất hàng', icon: 'file-tray-outline' },
  { value: 'DELAY', label: 'Chậm trễ', helper: 'Giao hoặc nhận trễ cam kết', icon: 'time-outline' },
  { value: 'WRONG_ITEM', label: 'Sai hàng', helper: 'Sai mặt hàng hoặc số lượng', icon: 'swap-horizontal-outline' },
];

export default function CustomerClaimsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    orderId?: string | string[];
    trackingCode?: string | string[];
    mode?: string | string[];
  }>();
  const requestedOrderId = getSingleParam(params.orderId);
  const requestedTrackingCode = getSingleParam(params.trackingCode);
  const requestedMode = getSingleParam(params.mode);
  const accessToken = useAuthStore((state) => state.token);

  const [orders, setOrders] = useState<CustomerOrderSummaryResponse[]>([]);
  const [claimedOrders, setClaimedOrders] = useState<CustomerOrderSummaryResponse[]>([]);
  const [claimsByOrderId, setClaimsByOrderId] = useState<Record<string, ClaimResponse[]>>({});
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [claims, setClaims] = useState<ClaimResponse[]>([]);
  const [claimType, setClaimType] = useState<ClaimCategory>('DAMAGE');
  const [description, setDescription] = useState('');
  const [evidenceImages, setEvidenceImages] = useState<ClaimEvidenceImage[]>([]);
  const [isOrdersLoading, setIsOrdersLoading] = useState(true);
  const [isClaimsLoading, setIsClaimsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [claimsError, setClaimsError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const selectedOrder = useMemo(
    () =>
      claimedOrders.find((order) => order.orderId === selectedOrderId) ??
      orders.find((order) => order.orderId === selectedOrderId) ??
      null,
    [claimedOrders, orders, selectedOrderId]
  );

  const selectedOrderLabel =
    selectedOrder?.trackingCode ??
    requestedTrackingCode ??
    (selectedOrderId ? selectedOrderId.slice(0, 8).toUpperCase() : null);

  const loadData = useCallback(async () => {
    if (!accessToken) {
      setOrders([]);
      setClaimedOrders([]);
      setClaimsByOrderId({});
      setSelectedOrderId(null);
      setOrdersError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      setIsOrdersLoading(false);
      return;
    }

    try {
      setOrdersError(null);

      // 1. Fetch customer's own orders
      const allOrders = await fetchAllCustomerOrders().catch(() => []);
      const myOrderIds = new Set(allOrders.map((order) => order.orderId));

      // 2. Fetch claims
      const claimsResponse = await getAllClaims(accessToken, 1, 100).catch(() => ({ success: false, data: null }));
      const allClaims = claimsResponse.data?.data ?? [];

      // 3. Strictly filter claims to ONLY orders belonging to this customer
      const myClaims = allClaims.filter((claim) => claim.orderId && myOrderIds.has(claim.orderId));

      const newClaimsMap: Record<string, ClaimResponse[]> = {};
      myClaims.forEach((claim) => {
        if (claim.orderId) {
          if (!newClaimsMap[claim.orderId]) newClaimsMap[claim.orderId] = [];
          newClaimsMap[claim.orderId].push(claim);
        }
      });

      // 4. Build claimed orders list: ONLY customer's own orders that have claims
      const claimedList = allOrders.filter((order) => newClaimsMap[order.orderId]?.length > 0);

      setOrders(allOrders);
      setClaimedOrders(claimedList);
      setClaimsByOrderId(newClaimsMap);

      // Decide target selected order & mode. Create mode is only honored for a concrete eligible order.
      let targetOrderId: string | null = null;
      let shouldBeCreateMode = false;

      if (requestedOrderId && myOrderIds.has(requestedOrderId)) {
        targetOrderId = requestedOrderId;
        const requestedOrder = allOrders.find((order) => order.orderId === requestedOrderId) ?? null;
        const requestedOrderHasClaim = (newClaimsMap[requestedOrderId]?.length ?? 0) > 0;
        shouldBeCreateMode =
          requestedMode === 'create' &&
          !requestedOrderHasClaim &&
          Boolean(requestedOrder && isClaimableDeliveryOrder(requestedOrder));
      } else {
        targetOrderId = claimedList[0]?.orderId ?? null;
      }

      setSelectedOrderId(targetOrderId);
      setIsCreateMode(shouldBeCreateMode);

      if (targetOrderId && newClaimsMap[targetOrderId]) {
        setClaims(newClaimsMap[targetOrderId]);
      } else if (targetOrderId && !shouldBeCreateMode) {
        // Fallback fetch for individual order
        try {
          const singleOrderClaims = await getClaimsByOrder(accessToken, targetOrderId, 1, 20);
          setClaims(singleOrderClaims.data?.data ?? []);
        } catch {
          setClaims([]);
        }
      } else {
        setClaims([]);
      }
    } catch (error) {
      setOrders([]);
      setClaimedOrders([]);
      setClaimsByOrderId({});
      setSelectedOrderId(null);
      setOrdersError(getCustomerDataErrorMessage(error));
    } finally {
      setIsOrdersLoading(false);
    }
  }, [accessToken, requestedMode, requestedOrderId]);

  useFocusEffect(
    useCallback(() => {
      setIsOrdersLoading(true);
      void loadData();
    }, [loadData])
  );

  const handleSelectOrder = useCallback(
    async (orderId: string) => {
      setSelectedOrderId(orderId);
      setSuccessMessage(null);
      setFormError(null);
      setClaimsError(null);

      // Instantly load from memory if available
      if (claimsByOrderId[orderId]?.length > 0) {
        setClaims(claimsByOrderId[orderId]);
        return;
      }

      // Or fetch from API
      if (accessToken) {
        setIsClaimsLoading(true);
        try {
          const response = await getClaimsByOrder(accessToken, orderId, 1, 20);
          const list = response.data?.data ?? [];
          setClaims(list);
          setClaimsByOrderId((prev) => ({ ...prev, [orderId]: list }));
        } catch (err) {
          setClaimsError(getApiErrorMessage(err));
          setClaims([]);
        } finally {
          setIsClaimsLoading(false);
        }
      }
    },
    [accessToken, claimsByOrderId]
  );

  const refreshScreen = useCallback(async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  }, [loadData]);

  const openImagePicker = () => {
    if (evidenceImages.length >= MAX_EVIDENCE_IMAGES) {
      setFormError(`Tối đa ${MAX_EVIDENCE_IMAGES} ảnh bằng chứng.`);
      return;
    }

    Alert.alert('Ảnh bằng chứng', 'Chọn nguồn ảnh cho khiếu nại', [
      { text: 'Chụp ảnh', onPress: () => void captureEvidenceImage() },
      { text: 'Chọn từ thư viện', onPress: () => void selectEvidenceImages() },
      { text: 'Hủy', style: 'cancel' },
    ]);
  };

  const selectEvidenceImages = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      handleImagePermissionDenied(permission, 'thư viện ảnh');
      return;
    }

    const remainingSlots = MAX_EVIDENCE_IMAGES - evidenceImages.length;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: remainingSlots > 1,
      selectionLimit: remainingSlots,
      quality: 0.75,
    });
    handleImageResult(result);
  };

  const captureEvidenceImage = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      handleImagePermissionDenied(permission, 'camera');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.75,
    });
    handleImageResult(result);
  };

  const handleImagePermissionDenied = (permission: { canAskAgain: boolean }, source: string) => {
    if (!permission.canAskAgain) {
      Alert.alert(
        'Cần quyền truy cập',
        `Vui lòng mở Cài đặt để cấp quyền ${source} trước khi thêm ảnh bằng chứng.`,
        [
          { text: 'Để sau', style: 'cancel' },
          { text: 'Mở Cài đặt', onPress: () => void Linking.openSettings() },
        ]
      );
      return;
    }

    setFormError(`Vui lòng cấp quyền ${source} để thêm ảnh bằng chứng.`);
  };

  const handleImageResult = (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled) return;

    const images = result.assets
      .filter((asset) => asset.uri && asset.type !== 'video')
      .map((asset, index): ClaimEvidenceImage => ({
        uri: asset.uri,
        mimeType: asset.mimeType || 'image/jpeg',
        fileName: asset.fileName || `claim-evidence-${Date.now()}-${index + 1}.jpg`,
      }));

    if (images.length === 0) {
      setFormError('Vui lòng chọn ảnh, không chọn video.');
      return;
    }

    setEvidenceImages((current) => [...current, ...images].slice(0, MAX_EVIDENCE_IMAGES));
    setFormError(null);
  };

  const removeEvidenceImage = (uri: string) => {
    setEvidenceImages((current) => current.filter((image) => image.uri !== uri));
  };

  const handleSubmitClaim = async () => {
    const trimmedDescription = description.trim();

    if (!accessToken) {
      setFormError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      return;
    }

    if (!selectedOrderId) {
      setFormError('Vui lòng chọn đơn hàng cần khiếu nại.');
      return;
    }

    if (!selectedOrder || !isClaimableDeliveryOrder(selectedOrder)) {
      setFormError('Chỉ có thể tạo khiếu nại sau khi đơn hàng đã giao thành công.');
      return;
    }

    if ((claimsByOrderId[selectedOrderId]?.length ?? 0) > 0) {
      setFormError('Đơn hàng này đã có khiếu nại.');
      return;
    }

    if (trimmedDescription.length < 10) {
      setFormError('Vui lòng mô tả sự cố ít nhất 10 ký tự.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    setSuccessMessage(null);

    try {
      const response = await createClaim(accessToken, {
        orderId: selectedOrderId,
        claimType,
        description: trimmedDescription,
        evidenceImages,
      });

      if (!response.success) {
        throw new Error(response.message || 'Không thể gửi khiếu nại.');
      }

      setDescription('');
      setEvidenceImages([]);
      setSuccessMessage(`Đã gửi khiếu nại ${response.data?.claimCode ?? ''}. Bộ phận vận hành sẽ xử lý.`);
      setIsCreateMode(false);
      await loadData();
    } catch (error) {
      setFormError(getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isOrdersLoading) {
    return (
      <View style={{ backgroundColor: colors.surface.page }} className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.brand.primary} />
        <Text style={{ color: colors.brand.primary }} className="mt-4 font-medium">Đang tải thông tin khiếu nại...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.surface.page }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={88}
    >
      <ScrollView
        style={{ backgroundColor: colors.surface.page }}
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 120, gap: 16 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void refreshScreen()} tintColor={colors.brand.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {isCreateMode ? (
          <View style={{ backgroundColor: colors.text.primary }} className="rounded-3xl p-5">
            <View className="flex-row items-start justify-between gap-4">
              <View className="flex-1">
                <Text style={{ color: colors.brand.primaryForeground }} className="text-xl font-bold">
                  Tạo khiếu nại
                </Text>
                <Text className="mt-2 text-sm leading-5 text-white/70">
                  Gửi thông tin sự cố hàng hóa hoặc vận chuyển cho đơn hàng đã giao thành công.
                </Text>
              </View>
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                <Ionicons name="create-outline" size={24} color={colors.brand.primaryForeground} />
              </View>
            </View>

            <View className="mt-4 flex-row items-center gap-3">
              <Pressable
                onPress={() => {
                  setIsCreateMode(false);
                  setFormError(null);
                  if (claimedOrders.length > 0) {
                    setSelectedOrderId(claimedOrders[0].orderId);
                    setClaims(claimsByOrderId[claimedOrders[0].orderId] ?? []);
                  }
                }}
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)' }}
                className="flex-row items-center gap-2 rounded-xl px-4 py-2.5"
              >
                <Ionicons name="arrow-back" size={16} color="#FFFFFF" />
                <Text className="text-sm font-bold text-white">Xem danh sách khiếu nại</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {ordersError ? <ErrorBlock message={ordersError} onRetry={loadData} /> : null}
        {successMessage ? <SuccessBlock message={successMessage} /> : null}

        {/* ── CREATE MODE ── */}
        {isCreateMode ? (
          <View className="gap-4">
            <ClaimForm
              selectedOrderLabel={selectedOrderLabel}
              claimType={claimType}
              description={description}
              evidenceImages={evidenceImages}
              formError={formError}
              isSubmitting={isSubmitting}
              onChangeDescription={(value) => {
                setDescription(value);
                if (formError) setFormError(null);
              }}
              onChangeType={setClaimType}
              onOpenImagePicker={openImagePicker}
              onRemoveEvidenceImage={removeEvidenceImage}
              onSubmit={handleSubmitClaim}
            />
          </View>
        ) : null}

        {/* ── VIEW MODE: Trang khiếu nại CHỈ hiển thị các order đã có khiếu nại ── */}
        {!isCreateMode ? (
          <>
            {claimedOrders.length === 0 ? (
              <EmptyState
                icon="chatbox-ellipses-outline"
                title="Chưa có khiếu nại nào"
                message="Trang này chỉ hiển thị các đơn hàng đã có khiếu nại. Khi có sự cố về hàng hóa hoặc thời gian giao, bạn có thể tạo khiếu nại từ chi tiết đơn hàng."
                actionLabel="Xem danh sách đơn hàng"
                onAction={() => router.push('/(customer)/status' as never)}
              />
            ) : (
              <>
                {/* ── Claimed Orders Carousel Selector (Chỉ hiển thị các đơn đã có khiếu nại) ── */}
                <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="rounded-2xl border p-5">
                  <View className="mb-3 flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                      <Ionicons name="receipt-outline" size={18} color={colors.brand.primary} />
                      <Text style={{ color: colors.text.primary }} className="text-base font-bold">
                        Đơn đã khiếu nại ({claimedOrders.length})
                      </Text>
                    </View>
                    <Text style={{ color: colors.text.muted }} className="text-xs">
                      Chọn đơn để xem khiếu nại
                    </Text>
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 4 }}>
                    {claimedOrders.map((order) => {
                      const selected = order.orderId === selectedOrderId;
                      const orderClaimsList = claimsByOrderId[order.orderId] ?? [];
                      const latestClaimStatus = orderClaimsList[0]?.status;

                      return (
                        <Pressable
                          key={order.orderId}
                          onPress={() => void handleSelectOrder(order.orderId)}
                          style={{
                            backgroundColor: selected ? colors.surface.selected : colors.surface.page,
                            borderColor: selected ? colors.border.selected : colors.border.default,
                            borderWidth: selected ? 2 : 1,
                            width: 230,
                          }}
                          className="rounded-2xl p-4 shadow-sm"
                        >
                          <View className="flex-row items-start justify-between gap-2">
                            <View className="flex-1">
                              <Text style={{ color: selected ? colors.text.brand : colors.text.primary }} className="font-bold" numberOfLines={1}>
                                {order.trackingCode}
                              </Text>
                              <Text style={{ color: colors.text.secondary }} className="mt-1 text-xs" numberOfLines={2}>
                                {order.itemName}
                              </Text>
                              <View className="mt-2.5 flex-row items-center gap-1.5">
                                <ClaimStatusBadge status={latestClaimStatus} />
                              </View>
                            </View>
                            {selected ? (
                              <View className="h-6 w-6 items-center justify-center rounded-full bg-[#367eb8]">
                                <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                              </View>
                            ) : null}
                          </View>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* ── Thông tin khiếu nại của order đang chọn ── */}
                {selectedOrderId ? (
                  <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="rounded-2xl border p-5 shadow-sm">
                    <View className="mb-4 flex-row items-center justify-between gap-3 border-b border-gray-100 pb-3">
                      <View className="flex-1 flex-row items-center gap-2">
                        <Ionicons name="document-text-outline" size={20} color={colors.brand.primary} />
                        <Text style={{ color: colors.text.primary }} className="text-base font-bold">
                          Thông tin khiếu nại {selectedOrder?.trackingCode ? `· ${selectedOrder.trackingCode}` : ''}
                        </Text>
                      </View>
                      <Pressable onPress={() => void handleSelectOrder(selectedOrderId)} className="min-h-10 justify-center">
                        <Text style={{ color: colors.brand.primary }} className="text-sm font-bold">Làm mới</Text>
                      </Pressable>
                    </View>

                    {isClaimsLoading ? <SectionLoader label="Đang tải thông tin khiếu nại..." /> : null}

                    {claimsError ? (
                      <View className="rounded-xl border border-red-200 bg-red-50 p-3">
                        <Text className="text-sm font-semibold leading-5 text-red-700">{claimsError}</Text>
                      </View>
                    ) : null}

                    {!isClaimsLoading && !claimsError && claims.length === 0 ? (
                      <EmptyState
                        compact
                        icon="chatbox-ellipses-outline"
                        title="Chưa có thông tin khiếu nại"
                        message="Không tìm thấy chi tiết khiếu nại cho đơn hàng này."
                      />
                    ) : null}

                    {!isClaimsLoading && !claimsError && claims.length > 0 ? (
                      <View className="gap-4">
                        {claims.map((claim) => (
                          <ClaimCard
                            key={claim.claimId}
                            claim={claim}
                            onOpenOrder={() => {
                              const orderId = claim.orderId ?? selectedOrderId;
                              if (orderId) router.push(`/(customer)/orders/${orderId}` as never);
                            }}
                          />
                        ))}
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </>
            )}
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ClaimForm({
  selectedOrderLabel,
  claimType,
  description,
  evidenceImages,
  formError,
  isSubmitting,
  onChangeDescription,
  onChangeType,
  onOpenImagePicker,
  onRemoveEvidenceImage,
  onSubmit,
}: {
  selectedOrderLabel: string | null;
  claimType: ClaimCategory;
  description: string;
  evidenceImages: ClaimEvidenceImage[];
  formError: string | null;
  isSubmitting: boolean;
  onChangeDescription: (value: string) => void;
  onChangeType: (value: ClaimCategory) => void;
  onOpenImagePicker: () => void;
  onRemoveEvidenceImage: (uri: string) => void;
  onSubmit: () => void;
}) {
  return (
    <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="rounded-2xl border p-5">
      <View className="mb-4 flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text style={{ color: colors.text.primary }} className="text-base font-bold">Nội dung khiếu nại</Text>
          <Text style={{ color: colors.text.secondary }} className="mt-1 text-sm leading-5">
            {selectedOrderLabel ? `Đơn đang chọn: ${selectedOrderLabel}` : 'Chọn đơn hàng trước khi gửi.'}
          </Text>
        </View>
        <Ionicons name="create-outline" size={22} color={colors.brand.primary} />
      </View>

      <Text style={{ color: colors.text.secondary }} className="mb-2 text-xs font-bold uppercase">Loại khiếu nại</Text>
      <View className="gap-2">
        {CLAIM_CATEGORIES.map((item) => {
          const selected = item.value === claimType;
          return (
            <Pressable
              key={item.value}
              onPress={() => onChangeType(item.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={{
                backgroundColor: selected ? colors.surface.selected : colors.surface.page,
                borderColor: selected ? colors.border.selected : colors.border.default,
              }}
              className="flex-row items-center gap-3 rounded-2xl border px-4 py-3"
            >
              <Ionicons name={item.icon} size={19} color={selected ? colors.brand.primary : colors.text.secondary} />
              <View className="flex-1">
                <Text style={{ color: selected ? colors.text.brand : colors.text.primary }} className="font-bold">{item.label}</Text>
                <Text style={{ color: colors.text.secondary }} className="mt-1 text-xs">{item.helper}</Text>
              </View>
              {selected ? <Ionicons name="checkmark-circle" size={20} color={colors.brand.primary} /> : null}
            </Pressable>
          );
        })}
      </View>

      <Text style={{ color: colors.text.secondary }} className="mb-2 mt-5 text-xs font-bold uppercase">Mô tả sự cố</Text>
      <TextInput
        value={description}
        onChangeText={onChangeDescription}
        placeholder="Ví dụ: Kiện hàng số 2 bị móp méo, rách bao bì khi nhận tại điểm giao..."
        placeholderTextColor={colors.text.muted}
        multiline
        textAlignVertical="top"
        maxLength={1000}
        style={{
          backgroundColor: colors.surface.page,
          borderColor: colors.border.default,
          color: colors.text.primary,
          minHeight: 120,
        }}
        className="rounded-2xl border px-4 py-3 text-sm leading-5"
      />
      <Text style={{ color: colors.text.muted }} className="mt-1 text-right text-xs">
        {description.trim().length}/1000
      </Text>

      <View className="mt-4 flex-row items-center justify-between gap-3">
        <View className="flex-1">
          <Text style={{ color: colors.text.secondary }} className="text-xs font-bold uppercase">Ảnh bằng chứng</Text>
          <Text style={{ color: colors.text.muted }} className="mt-1 text-xs">
            {evidenceImages.length}/{MAX_EVIDENCE_IMAGES} ảnh
          </Text>
        </View>
        <Pressable
          onPress={onOpenImagePicker}
          disabled={evidenceImages.length >= MAX_EVIDENCE_IMAGES}
          style={{
            backgroundColor: colors.surface.card,
            borderColor: evidenceImages.length >= MAX_EVIDENCE_IMAGES ? colors.border.default : colors.brand.primary,
            opacity: evidenceImages.length >= MAX_EVIDENCE_IMAGES ? 0.55 : 1,
          }}
          className="h-11 flex-row items-center justify-center gap-2 rounded-xl border px-4"
        >
          <Ionicons name="image-outline" size={17} color={colors.brand.primary} />
          <Text style={{ color: colors.brand.primary }} className="font-bold">Thêm ảnh</Text>
        </Pressable>
      </View>

      {evidenceImages.length > 0 ? (
        <View className="mt-3 flex-row flex-wrap gap-2">
          {evidenceImages.map((image) => (
            <View key={image.uri} className="relative">
              <Image source={{ uri: image.uri }} className="h-20 w-20 rounded-xl bg-gray-100" resizeMode="cover" />
              <Pressable
                onPress={() => onRemoveEvidenceImage(image.uri)}
                style={{ backgroundColor: 'rgba(23, 59, 89, 0.86)' }}
                className="absolute -right-1 -top-1 h-7 w-7 items-center justify-center rounded-full"
              >
                <Ionicons name="close" size={15} color="#FFFFFF" />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {formError ? (
        <View className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3">
          <Text className="text-sm font-semibold leading-5 text-red-700">{formError}</Text>
        </View>
      ) : null}

      <Pressable
        onPress={onSubmit}
        disabled={isSubmitting}
        style={{ backgroundColor: colors.brand.primary, opacity: isSubmitting ? 0.65 : 1 }}
        className="mt-5 h-12 flex-row items-center justify-center gap-2 rounded-xl"
      >
        {isSubmitting ? <ActivityIndicator size="small" color={colors.text.onPrimary} /> : <Ionicons name="send-outline" size={18} color={colors.text.onPrimary} />}
        <Text style={{ color: colors.text.onPrimary }} className="font-bold">
          {isSubmitting ? 'Đang gửi...' : 'Gửi khiếu nại'}
        </Text>
      </Pressable>
    </View>
  );
}

function ClaimCard({ claim, onOpenOrder }: { claim: ClaimResponse; onOpenOrder: () => void }) {
  const evidences = claim.evidences ?? [];

  return (
    <View style={{ backgroundColor: colors.surface.page, borderColor: colors.border.default }} className="rounded-2xl border p-4">
      {/* Header with code, date and status badge */}
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text style={{ color: colors.brand.primary }} className="text-base font-bold">{claim.claimCode}</Text>
          <Text style={{ color: colors.text.secondary }} className="mt-1 text-xs">
            Gửi lúc: {formatDateTime(claim.createdAt)}
          </Text>
        </View>
        <ClaimStatusBadge status={claim.status} />
      </View>

      {/* Claim Type */}
      <View className="mt-3 flex-row items-center gap-2 rounded-xl bg-white/70 p-2.5">
        <Ionicons name={getClaimCategoryIcon(claim.claimType)} size={18} color={colors.brand.primary} />
        <View className="flex-1">
          <Text style={{ color: colors.text.muted }} className="text-[11px] font-bold uppercase">Loại khiếu nại</Text>
          <Text style={{ color: colors.text.primary }} className="font-semibold">{getClaimCategoryLabel(claim.claimType)}</Text>
        </View>
      </View>

      {/* Incident Description */}
      <View className="mt-3">
        <Text style={{ color: colors.text.muted }} className="text-[11px] font-bold uppercase">Mô tả sự cố</Text>
        <Text style={{ color: colors.text.primary }} className="mt-1 text-sm leading-5">{claim.description}</Text>
      </View>

      {/* Resolution Note if present */}
      {claim.resolutionNote ? (
        <View className="mt-3 rounded-xl border border-green-200 bg-green-50 p-3">
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="checkmark-circle" size={16} color="#15803D" />
            <Text className="text-xs font-bold uppercase text-green-800">Phản hồi xử lý</Text>
          </View>
          <Text className="mt-1 text-sm leading-5 text-green-900">{claim.resolutionNote}</Text>
          {claim.resolvedAt ? (
            <Text className="mt-1 text-[11px] text-green-700">Thời gian: {formatDateTime(claim.resolvedAt)}</Text>
          ) : null}
        </View>
      ) : null}

      {/* Evidence Images */}
      {evidences.length > 0 ? (
        <View className="mt-3">
          <Text style={{ color: colors.text.muted }} className="mb-1.5 text-[11px] font-bold uppercase">
            Ảnh bằng chứng ({evidences.length})
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {evidences.map((evidence) => {
              const imageUrl = getFullAssetUrl(evidence.imageUrl);
              if (!imageUrl) return null;
              return <Image key={evidence.evidenceId} source={{ uri: imageUrl }} className="h-16 w-16 rounded-xl bg-gray-100" resizeMode="cover" />;
            })}
          </View>
        </View>
      ) : null}

      {/* Order Link */}
      <View style={{ borderTopColor: colors.border.default }} className="mt-4 flex-row items-center justify-between border-t pt-3">
        <Text style={{ color: colors.text.muted }} className="flex-1 text-xs" numberOfLines={1}>
          Đơn: {claim.orderTrackingCode || claim.orderId?.slice(0, 8).toUpperCase() || '--'}
        </Text>
        <Pressable onPress={onOpenOrder} className="flex-row items-center gap-1">
          <Text style={{ color: colors.brand.primary }} className="text-sm font-bold">Xem chi tiết đơn</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.brand.primary} />
        </Pressable>
      </View>
    </View>
  );
}

function ClaimStatusBadge({ status }: { status?: string | null }) {
  const presentation = getClaimStatusPresentation(status);
  return (
    <View style={{ backgroundColor: presentation.bg, borderColor: presentation.border }} className="rounded-full border px-2.5 py-1">
      <Text style={{ color: presentation.color }} className="text-[10px] font-bold uppercase">{presentation.label}</Text>
    </View>
  );
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void | Promise<unknown> }) {
  return (
    <View className="rounded-2xl border border-red-200 bg-red-50 p-4">
      <Text className="text-sm font-semibold leading-5 text-red-700">{message}</Text>
      <Pressable onPress={() => void onRetry()} style={{ backgroundColor: colors.brand.primary }} className="mt-3 self-start rounded-xl px-4 py-2">
        <Text style={{ color: colors.text.onPrimary }} className="font-bold">Thử lại</Text>
      </Pressable>
    </View>
  );
}

function SuccessBlock({ message }: { message: string }) {
  return (
    <View className="rounded-2xl border border-green-200 bg-green-50 p-4">
      <Text className="text-sm font-semibold leading-5 text-green-700">{message}</Text>
    </View>
  );
}

function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  compact = false,
  onAction,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  actionLabel?: string;
  compact?: boolean;
  onAction?: () => void;
}) {
  return (
    <View style={{ backgroundColor: compact ? 'transparent' : colors.surface.card }} className={compact ? 'items-center py-8' : 'items-center rounded-2xl p-8'}>
      <Ionicons name={icon} size={compact ? 42 : 56} color={colors.text.muted} />
      <Text style={{ color: colors.text.primary }} className="mt-3 text-center font-bold">{title}</Text>
      <Text style={{ color: colors.text.secondary }} className="mt-2 text-center text-sm leading-5">{message}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={{ backgroundColor: colors.brand.primary }} className="mt-5 rounded-xl px-5 py-3">
          <Text style={{ color: colors.text.onPrimary }} className="font-bold">{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function SectionLoader({ label }: { label: string }) {
  return (
    <View className="items-center py-6">
      <ActivityIndicator color={colors.brand.primary} size="small" />
      <Text style={{ color: colors.text.secondary }} className="mt-3 text-sm font-semibold">{label}</Text>
    </View>
  );
}

async function fetchAllCustomerOrders(): Promise<CustomerOrderSummaryResponse[]> {
  const firstPage = await customerApi.getMyOrders(1, ORDER_PAGE_SIZE);
  const totalPages = firstPage?.totalPages ?? 1;
  if (totalPages <= 1) return firstPage?.data ?? [];

  const remainingPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) => customerApi.getMyOrders(index + 2, ORDER_PAGE_SIZE))
  );

  return [
    ...(firstPage.data ?? []),
    ...remainingPages.flatMap((page) => page.data ?? []),
  ];
}

function isClaimableDeliveryOrder(order: CustomerOrderSummaryResponse) {
  return isCustomerClaimEligibleOrderStatus(order.status);
}

function getClaimCategoryLabel(value?: string | null) {
  const normalized = value?.trim().toUpperCase();
  return CLAIM_CATEGORIES.find((item) => item.value === normalized)?.label ?? value ?? 'Chưa phân loại';
}

function getClaimCategoryIcon(value?: string | null): keyof typeof Ionicons.glyphMap {
  const normalized = value?.trim().toUpperCase();
  return CLAIM_CATEGORIES.find((item) => item.value === normalized)?.icon ?? 'alert-circle-outline';
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

function getFullAssetUrl(url?: string | null) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  const assetBaseUrl = API_BASE_URL.replace(/\/api$/i, '');
  return `${assetBaseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Chưa cập nhật';
  let iso = value.trim();
  if (!iso.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(iso)) {
    iso += 'Z';
  }
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? 'Chưa cập nhật' : date.toLocaleString('vi-VN');
}

function getSingleParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}
