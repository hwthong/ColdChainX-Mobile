import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { API_BASE_URL, getApiErrorMessage, getCustomerDataErrorMessage } from '../../services/apiClient';
import {
  ClaimCategory,
  ClaimEvidenceImage,
  ClaimResponse,
  createClaim,
  getClaimsByOrder,
} from '../../services/claimApi';
import { customerApi, CustomerOrderSummaryResponse } from '../../services/customerApi';
import { useAuthStore } from '../../store/useAuthStore';

const ORDER_PAGE_SIZE = 100;
const CLAIM_PAGE_SIZE = 50;
const MAX_EVIDENCE_IMAGES = 5;
const CLAIMABLE_DELIVERY_STATUSES = new Set([
  'DELIVERED',
  'COMPLETED',
  'PARTIALLY_DELIVERED',
  'PARTIAL_DELIVER_OSD',
]);

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
  const params = useLocalSearchParams<{ orderId?: string | string[]; trackingCode?: string | string[] }>();
  const requestedOrderId = getSingleParam(params.orderId);
  const requestedTrackingCode = getSingleParam(params.trackingCode);
  const accessToken = useAuthStore((state) => state.token);

  const [orders, setOrders] = useState<CustomerOrderSummaryResponse[]>([]);
  const [claimedOrderIds, setClaimedOrderIds] = useState<string[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
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
    () => orders.find((order) => order.orderId === selectedOrderId) ?? null,
    [orders, selectedOrderId]
  );
  const claimedOrderIdSet = useMemo(() => new Set(claimedOrderIds), [claimedOrderIds]);
  const claimableOrders = useMemo(
    () => orders.filter((order) => !claimedOrderIdSet.has(order.orderId)),
    [claimedOrderIdSet, orders]
  );

  const selectedOrderLabel =
    selectedOrder?.trackingCode ??
    requestedTrackingCode ??
    (selectedOrderId ? selectedOrderId.slice(0, 8).toUpperCase() : null);

  const loadOrders = useCallback(async (showRequestedOrderError = true) => {
    if (!accessToken) {
      setOrders([]);
      setSelectedOrderId(null);
      setOrdersError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      setIsOrdersLoading(false);
      return;
    }

    try {
      setOrdersError(null);
      const allOrders = await fetchAllCustomerOrders();
      const deliveredOrders = allOrders.filter(isClaimableDeliveryOrder);
      const claimedIds = await fetchClaimedOrderIds(accessToken, deliveredOrders);
      const claimedSet = new Set(claimedIds);
      const nextClaimableOrders = deliveredOrders.filter((order) => !claimedSet.has(order.orderId));

      setOrders(deliveredOrders);
      setClaimedOrderIds(claimedIds);

      setSelectedOrderId((currentOrderId) => {
        if (requestedOrderId && nextClaimableOrders.some((order) => order.orderId === requestedOrderId)) {
          return requestedOrderId;
        }

        if (currentOrderId && nextClaimableOrders.some((order) => order.orderId === currentOrderId)) {
          return currentOrderId;
        }

        return nextClaimableOrders[0]?.orderId ?? null;
      });

      if (requestedOrderId && showRequestedOrderError) {
        const requestedOrder = allOrders.find((order) => order.orderId === requestedOrderId);
        if (!requestedOrder) {
          setOrdersError('Không tìm thấy đơn hàng này trong tài khoản Customer hiện tại.');
        } else if (!isClaimableDeliveryOrder(requestedOrder)) {
          setOrdersError('Chỉ đơn hàng đã giao xong mới có thể gửi khiếu nại.');
        } else if (claimedSet.has(requestedOrderId)) {
          setOrdersError('Đơn hàng này đã có khiếu nại, không thể tạo thêm.');
        }
      }
    } catch (error) {
      setOrders([]);
      setClaimedOrderIds([]);
      setSelectedOrderId(null);
      setOrdersError(getCustomerDataErrorMessage(error));
    } finally {
      setIsOrdersLoading(false);
    }
  }, [accessToken, requestedOrderId]);

  const loadClaims = useCallback(async (orderId: string) => {
    if (!accessToken) return;

    setIsClaimsLoading(true);
    try {
      setClaimsError(null);
      const response = await getClaimsByOrder(accessToken, orderId, 1, CLAIM_PAGE_SIZE);
      if (!response.success) {
        setClaims([]);
        setClaimsError(response.message || 'Không thể tải danh sách khiếu nại.');
        return;
      }

      setClaims(response.data?.data ?? []);
    } catch (error) {
      setClaims([]);
      setClaimsError(getApiErrorMessage(error));
    } finally {
      setIsClaimsLoading(false);
    }
  }, [accessToken]);

  useFocusEffect(
    useCallback(() => {
      setIsOrdersLoading(true);
      void loadOrders();
    }, [loadOrders])
  );

  useEffect(() => {
    if (!selectedOrderId) {
      setClaims([]);
      setClaimsError(null);
      return;
    }

    void loadClaims(selectedOrderId);
  }, [loadClaims, selectedOrderId]);

  const refreshScreen = useCallback(async () => {
    setIsRefreshing(true);
    await loadOrders();
    if (selectedOrderId) await loadClaims(selectedOrderId);
    setIsRefreshing(false);
  }, [loadClaims, loadOrders, selectedOrderId]);

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
      setFormError('Chỉ đơn hàng đã giao xong mới có thể gửi khiếu nại.');
      return;
    }

    if (claimedOrderIdSet.has(selectedOrderId)) {
      setFormError('Đơn hàng này đã có khiếu nại, không thể tạo thêm.');
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
      await loadOrders(false);
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
        <Text style={{ color: colors.brand.primary }} className="mt-4 font-medium">Đang tải khiếu nại...</Text>
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
        <View style={{ backgroundColor: colors.text.primary }} className="rounded-3xl p-5">
          <View className="flex-row items-start justify-between gap-4">
            <View className="flex-1">
              <Text style={{ color: colors.brand.primaryForeground }} className="text-xl font-bold">Khiếu nại vận chuyển</Text>
              <Text className="mt-2 text-sm leading-5 text-white/70">
                Chỉ đơn đã giao xong và chưa từng khiếu nại mới có thể tạo hồ sơ mới.
              </Text>
            </View>
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
              <Ionicons name="alert-circle-outline" size={24} color={colors.brand.primaryForeground} />
            </View>
          </View>
        </View>

        {ordersError ? <ErrorBlock message={ordersError} onRetry={loadOrders} /> : null}
        {successMessage ? <SuccessBlock message={successMessage} /> : null}

        {!ordersError && orders.length === 0 ? (
          <EmptyState
            icon="receipt-outline"
            title="Chưa có đơn đã giao"
            message="Khiếu nại chỉ áp dụng cho đơn hàng đã giao xong."
            actionLabel="Xem đơn hàng"
            onAction={() => router.push('/(customer)/status' as never)}
          />
        ) : null}

        {orders.length > 0 ? (
          <>
            <OrderSelector
              orders={orders}
              claimedOrderIds={claimedOrderIdSet}
              selectedOrderId={selectedOrderId}
              onSelect={(orderId) => {
                setSelectedOrderId(orderId);
                setSuccessMessage(null);
                setFormError(null);
              }}
            />

            {claimableOrders.length === 0 ? (
              <EmptyState
                compact
                icon="checkmark-done-circle-outline"
                title="Không còn đơn có thể khiếu nại"
                message="Các đơn đã giao hiện có đều đã được gửi khiếu nại trước đó."
              />
            ) : null}

            {selectedOrderId ? (
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
            ) : null}

            {selectedOrderId ? (
              <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="rounded-2xl border p-5">
              <View className="mb-4 flex-row items-center justify-between gap-3">
                <View className="flex-1 flex-row items-center gap-2">
                  <Ionicons name="list-outline" size={18} color={colors.brand.primary} />
                  <Text style={{ color: colors.text.primary }} className="text-base font-bold">Khiếu nại đã gửi</Text>
                </View>
                <Pressable onPress={() => selectedOrderId && void loadClaims(selectedOrderId)} className="min-h-10 justify-center">
                  <Text style={{ color: colors.brand.primary }} className="text-sm font-bold">Làm mới</Text>
                </Pressable>
              </View>

              {isClaimsLoading ? <SectionLoader label="Đang tải danh sách..." /> : null}
              {claimsError ? (
                <View className="rounded-xl border border-red-200 bg-red-50 p-3">
                  <Text className="text-sm font-semibold leading-5 text-red-700">{claimsError}</Text>
                </View>
              ) : null}
              {!isClaimsLoading && !claimsError && claims.length === 0 ? (
                <EmptyState
                  compact
                  icon="chatbox-ellipses-outline"
                  title="Chưa có khiếu nại"
                  message="Khiếu nại của đơn này sẽ xuất hiện tại đây sau khi gửi."
                />
              ) : null}
              {!isClaimsLoading && !claimsError && claims.length > 0 ? (
                <View className="gap-3">
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
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function OrderSelector({
  orders,
  claimedOrderIds,
  selectedOrderId,
  onSelect,
}: {
  orders: CustomerOrderSummaryResponse[];
  claimedOrderIds: Set<string>;
  selectedOrderId: string | null;
  onSelect: (orderId: string) => void;
}) {
  return (
    <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="rounded-2xl border p-5">
      <View className="mb-3 flex-row items-center gap-2">
        <Ionicons name="receipt-outline" size={18} color={colors.brand.primary} />
        <Text style={{ color: colors.text.primary }} className="text-base font-bold">Chọn đơn hàng</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 4 }}>
        {orders.map((order) => {
          const selected = order.orderId === selectedOrderId;
          const hasClaim = claimedOrderIds.has(order.orderId);
          return (
            <Pressable
              key={order.orderId}
              onPress={() => {
                if (!hasClaim) onSelect(order.orderId);
              }}
              disabled={hasClaim}
              accessibilityRole="button"
              accessibilityState={{ disabled: hasClaim, selected }}
              style={{
                backgroundColor: selected ? colors.surface.selected : colors.surface.page,
                borderColor: selected ? colors.border.selected : colors.border.default,
                opacity: hasClaim ? 0.55 : 1,
                width: 220,
              }}
              className="rounded-2xl border p-4"
            >
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text style={{ color: selected ? colors.text.brand : colors.text.primary }} className="font-bold" numberOfLines={1}>
                    {order.trackingCode}
                  </Text>
                  <Text style={{ color: colors.text.secondary }} className="mt-1 text-sm" numberOfLines={2}>
                    {order.itemName}
                  </Text>
                  <Text style={{ color: hasClaim ? colors.status.warning.main : colors.status.success.main }} className="mt-2 text-xs font-bold">
                    {hasClaim ? 'Đã có khiếu nại' : 'Có thể khiếu nại'}
                  </Text>
                </View>
                {selected ? <Ionicons name="checkmark-circle" size={20} color={colors.brand.primary} /> : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
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
          <Text style={{ color: colors.text.primary }} className="text-base font-bold">Tạo khiếu nại mới</Text>
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
        placeholder="Ví dụ: Kiện hàng số 2 bị móp méo khi nhận tại điểm giao..."
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
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text style={{ color: colors.brand.primary }} className="font-bold">{claim.claimCode}</Text>
          <Text style={{ color: colors.text.secondary }} className="mt-1 text-xs">{formatDateTime(claim.createdAt)}</Text>
        </View>
        <ClaimStatusBadge status={claim.status} />
      </View>

      <View className="mt-3 flex-row items-center gap-2">
        <Ionicons name={getClaimCategoryIcon(claim.claimType)} size={16} color={colors.brand.primary} />
        <Text style={{ color: colors.text.primary }} className="font-semibold">{getClaimCategoryLabel(claim.claimType)}</Text>
      </View>

      <Text style={{ color: colors.text.secondary }} className="mt-2 text-sm leading-5">{claim.description}</Text>

      {claim.resolutionNote ? (
        <View className="mt-3 rounded-xl border border-green-200 bg-green-50 p-3">
          <Text className="text-xs font-bold uppercase text-green-700">Phản hồi xử lý</Text>
          <Text className="mt-1 text-sm leading-5 text-green-800">{claim.resolutionNote}</Text>
        </View>
      ) : null}

      {evidences.length > 0 ? (
        <View className="mt-3 flex-row flex-wrap gap-2">
          {evidences.map((evidence) => {
            const imageUrl = getFullAssetUrl(evidence.imageUrl);
            if (!imageUrl) return null;
            return <Image key={evidence.evidenceId} source={{ uri: imageUrl }} className="h-16 w-16 rounded-xl bg-gray-100" resizeMode="cover" />;
          })}
        </View>
      ) : null}

      <View className="mt-3 flex-row items-center justify-between gap-3">
        <Text style={{ color: colors.text.muted }} className="flex-1 text-xs" numberOfLines={1}>
          Đơn {claim.orderTrackingCode || claim.orderId?.slice(0, 8).toUpperCase() || '--'}
        </Text>
        <Pressable onPress={onOpenOrder} className="min-h-10 justify-center">
          <Text style={{ color: colors.brand.primary }} className="text-sm font-bold">Xem đơn</Text>
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

async function fetchClaimedOrderIds(accessToken: string, orders: CustomerOrderSummaryResponse[]): Promise<string[]> {
  if (orders.length === 0) return [];

  const claimChecks = await Promise.all(
    orders.map(async (order) => {
      const response = await getClaimsByOrder(accessToken, order.orderId, 1, 1);
      if (!response.success) {
        throw new Error(response.message || 'Không thể kiểm tra khiếu nại của đơn hàng.');
      }

      const claimCount = response.data?.totalRecords ?? response.data?.data?.length ?? 0;
      return claimCount > 0 ? order.orderId : null;
    })
  );

  return claimChecks.filter((orderId): orderId is string => Boolean(orderId));
}

function isClaimableDeliveryOrder(order: CustomerOrderSummaryResponse) {
  return CLAIMABLE_DELIVERY_STATUSES.has(order.status?.trim().toUpperCase());
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
      return { label: 'Đã giải ngân', color: colors.status.success.main, bg: colors.status.success.bg, border: colors.status.success.border };
    case 'REJECTED':
      return { label: 'Đã từ chối', color: colors.status.danger.main, bg: colors.status.danger.bg, border: colors.status.danger.border };
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
