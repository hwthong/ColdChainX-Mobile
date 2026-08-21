import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../../constants/colors';
import { customerRadius } from '../../../../constants/customerTheme';
import {
  CREATE_ORDER_PACKAGING_OPTIONS,
  getCreateOrderPackagingLabel,
} from '../createOrderOptions';
import type {
  CreateOrderFieldKey,
  CreateOrderValidationErrors,
  DocumentImage,
} from '../createOrderValidation';
import {
  CreateOrderFormSection,
  CreateOrderTextField,
  type RegisterCreateOrderField,
  type RegisterCreateOrderInput,
} from './CreateOrderUi';

export const PACKAGING_OPTIONS = CREATE_ORDER_PACKAGING_OPTIONS;

export function getPackagingTypeLabel(type: string): string {
  return getCreateOrderPackagingLabel(type);
}

const PACKAGING_ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  'Carton Box': 'cube-outline',
  'Foam Box': 'snow-outline',
  'Plastic Box': 'file-tray-full-outline',
  Pallet: 'grid-outline',
  Thùng: 'archive-outline',
  Bao: 'bag-handle-outline',
};

type PackagingImageStepProps = {
  isEditMode: boolean;
  packagingTypes: string[];
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  image: DocumentImage | null;
  legalDocument: DocumentImage | null;
  existingCbm?: number | null;
  errors: CreateOrderValidationErrors;
  registerField: RegisterCreateOrderField;
  registerInput: RegisterCreateOrderInput;
  onChangePackagingTypes: (value: string[]) => void;
  onChangeLength: (value: string) => void;
  onChangeWidth: (value: string) => void;
  onChangeHeight: (value: string) => void;
  onPickImage: () => void;
  onRemoveImage: () => void;
  onPickLegalDocument: () => void;
  onRemoveLegalDocument: () => void;
  onFocusField?: (field: CreateOrderFieldKey) => void;
  onBlurField: (field: CreateOrderFieldKey) => void;
  onSubmitField: (field: CreateOrderFieldKey) => void;
};

export function PackagingImageStep({
  isEditMode,
  packagingTypes,
  lengthCm,
  widthCm,
  heightCm,
  image,
  legalDocument,
  existingCbm,
  errors,
  registerField,
  registerInput,
  onChangePackagingTypes,
  onChangeLength,
  onChangeWidth,
  onChangeHeight,
  onPickImage,
  onRemoveImage,
  onPickLegalDocument,
  onRemoveLegalDocument,
  onFocusField,
  onBlurField,
  onSubmitField,
}: PackagingImageStepProps) {
  const [touchedFields, setTouchedFields] = React.useState<Record<string, boolean>>({});

  const touchField = (field: string) => {
    setTouchedFields((previous) => ({ ...previous, [field]: true }));
  };

  const selectPackagingType = (value: string) => {
    touchField('packagingType');
    if (packagingTypes[0] === value && packagingTypes.length === 1) return;
    onChangePackagingTypes([value]);
  };

  const handleFieldBlur = (field: CreateOrderFieldKey) => {
    touchField(field);
    onBlurField(field);
  };

  return (
    <View className="gap-4">
      <CreateOrderFormSection
        title="Đóng gói *"
        icon="archive-outline"
        description="Chọn cách đóng gói phù hợp với lô hàng."
      >
        <View ref={(node) => registerField('packagingType', node)}>
          <View style={styles.packagingGrid}>
            {PACKAGING_OPTIONS.map((option) => {
              const selected = packagingTypes.includes(option.value);
              const iconName = PACKAGING_ICON_MAP[option.value] || 'cube-outline';
              return (
                <View
                  key={option.value}
                  style={[styles.packagingTile, selected && styles.packagingTileSelected]}
                >
                  <Ionicons
                    name={iconName}
                    size={18}
                    color={selected ? colors.brand.primary : colors.text.secondary}
                  />
                  <Text
                    numberOfLines={2}
                    style={[styles.packagingTileText, selected && styles.packagingTileTextSelected]}
                  >
                    {option.label}
                  </Text>
                  {selected ? (
                    <Ionicons name="checkmark-circle" size={18} color={colors.brand.primary} />
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={option.label}
                    onPress={() => selectPackagingType(option.value)}
                    style={StyleSheet.absoluteFillObject}
                  />
                </View>
              );
            })}
          </View>
          {touchedFields.packagingType && errors.packagingType ? (
            <FieldError message={errors.packagingType} />
          ) : null}
        </View>
      </CreateOrderFormSection>

      {isEditMode ? (
        <CreateOrderFormSection
          title="Kích thước mỗi kiện"
          icon="resize-outline"
          description="Giữ trống để dùng kích thước hiện tại, hoặc nhập đủ ba chiều để cập nhật."
        >
          <View className="gap-3">
            <View className="flex-row gap-2.5">
              <View className="flex-1">
                <CreateOrderTextField
                  field="lengthCm"
                  label="Dài (cm)"
                  placeholder="0"
                  value={lengthCm}
                  error={touchedFields.lengthCm ? errors.lengthCm : undefined}
                  keyboardType="decimal-pad"
                  returnKeyType="next"
                  onChangeText={(value) => {
                    touchField('lengthCm');
                    onChangeLength(value);
                  }}
                  onFocus={() => onFocusField?.('lengthCm')}
                  onBlur={() => handleFieldBlur('lengthCm')}
                  onSubmitEditing={() => onSubmitField('lengthCm')}
                  registerField={registerField}
                  registerInput={registerInput}
                />
              </View>
              <View className="flex-1">
                <CreateOrderTextField
                  field="widthCm"
                  label="Rộng (cm)"
                  placeholder="0"
                  value={widthCm}
                  error={touchedFields.widthCm ? errors.widthCm : undefined}
                  keyboardType="decimal-pad"
                  returnKeyType="next"
                  onChangeText={(value) => {
                    touchField('widthCm');
                    onChangeWidth(value);
                  }}
                  onFocus={() => onFocusField?.('widthCm')}
                  onBlur={() => handleFieldBlur('widthCm')}
                  onSubmitEditing={() => onSubmitField('widthCm')}
                  registerField={registerField}
                  registerInput={registerInput}
                />
              </View>
              <View className="flex-1">
                <CreateOrderTextField
                  field="heightCm"
                  label="Cao (cm)"
                  placeholder="0"
                  value={heightCm}
                  error={touchedFields.heightCm ? errors.heightCm : undefined}
                  keyboardType="decimal-pad"
                  onChangeText={(value) => {
                    touchField('heightCm');
                    onChangeHeight(value);
                  }}
                  onFocus={() => onFocusField?.('heightCm')}
                  onBlur={() => handleFieldBlur('heightCm')}
                  onSubmitEditing={() => onSubmitField('heightCm')}
                  registerField={registerField}
                  registerInput={registerInput}
                />
              </View>
            </View>
            {existingCbm ? (
              <View style={styles.existingCbmNotice}>
                <Text style={styles.existingCbmLabel}>Thể tích hiện tại của đơn hàng</Text>
                <Text style={styles.existingCbmValue}>{existingCbm} m³</Text>
              </View>
            ) : null}
          </View>
        </CreateOrderFormSection>
      ) : null}

      <CreateOrderFormSection
        title={`Ảnh lô hàng${isEditMode ? '' : ' *'}`}
        icon="camera-outline"
        description="Thêm ảnh để kiểm tra tình trạng và cách đóng gói."
      >
        <View ref={(node) => registerField('documentImage', node)} className="gap-3">
          {image ? (
            <>
              <Image
                source={{ uri: image.uri }}
                accessibilityLabel="Ảnh lô hàng đã chọn"
                className="h-44 w-full rounded-2xl"
                resizeMode="cover"
              />
              <FileActionButtons
                replaceLabel="Thay ảnh"
                removeLabel="Xóa ảnh"
                onReplace={onPickImage}
                onRemove={onRemoveImage}
              />
            </>
          ) : (
            <Pressable
              onPress={onPickImage}
              accessibilityRole="button"
              accessibilityLabel="Thêm ảnh lô hàng"
              accessibilityHint="Chụp ảnh hoặc chọn ảnh từ thư viện"
              style={[
                styles.uploadArea,
                errors.documentImage ? styles.uploadAreaError : null,
              ]}
              className="items-center justify-center px-5 py-6"
            >
              <View style={styles.uploadIconCircle} className="h-12 w-12 items-center justify-center rounded-full">
                <Ionicons name="camera-outline" size={24} color={colors.brand.primary} />
              </View>
              <Text style={styles.uploadTitle} className="mt-3 text-center">Thêm ảnh lô hàng</Text>
              <Text style={styles.uploadDescription} className="mt-1 text-center">
                Chụp ảnh hoặc chọn từ thư viện · tối đa 10 MB.
              </Text>
            </Pressable>
          )}
          {errors.documentImage ? <FieldError message={errors.documentImage} /> : null}
        </View>
      </CreateOrderFormSection>

      <CreateOrderFormSection
        title={`Chứng từ hàng hóa${isEditMode ? '' : ' *'}`}
        icon="document-attach-outline"
        description="Chọn hóa đơn, phiếu xuất kho hoặc chứng từ pháp lý liên quan."
      >
        <View ref={(node) => registerField('legalDocument', node)} className="gap-3">
          {legalDocument ? (
            <View style={styles.selectedDocumentCard}>
              <View style={styles.documentIcon}>
                <Ionicons name="document-text-outline" size={24} color={colors.brand.primary} />
              </View>
              <View className="flex-1">
                <Text numberOfLines={2} style={styles.documentName}>
                  {legalDocument.fileName || 'Chứng từ đã chọn'}
                </Text>
                <Text style={styles.documentMeta}>PDF hoặc hình ảnh · tối đa 10 MB</Text>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={onPickLegalDocument}
              accessibilityRole="button"
              accessibilityLabel="Chọn chứng từ hàng hóa"
              style={[
                styles.documentPickerButton,
                errors.legalDocument ? styles.uploadAreaError : null,
              ]}
            >
              <Ionicons name="document-attach-outline" size={22} color={colors.brand.primary} />
              <View className="flex-1">
                <Text style={styles.documentPickerTitle}>Chọn chứng từ</Text>
                <Text style={styles.documentMeta}>PDF hoặc hình ảnh · tối đa 10 MB</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.text.secondary} />
            </Pressable>
          )}
          {legalDocument ? (
            <FileActionButtons
              replaceLabel="Thay chứng từ"
              removeLabel="Xóa chứng từ"
              onReplace={onPickLegalDocument}
              onRemove={onRemoveLegalDocument}
            />
          ) : null}
          {errors.legalDocument ? <FieldError message={errors.legalDocument} /> : null}
        </View>
      </CreateOrderFormSection>
    </View>
  );
}

function FileActionButtons({
  replaceLabel,
  removeLabel,
  onReplace,
  onRemove,
}: {
  replaceLabel: string;
  removeLabel: string;
  onReplace: () => void;
  onRemove: () => void;
}) {
  return (
    <View className="flex-row gap-3">
      <Pressable
        onPress={onReplace}
        accessibilityRole="button"
        accessibilityLabel={replaceLabel}
        style={styles.replaceButton}
        className="flex-1 items-center justify-center"
      >
        <Text style={styles.replaceButtonText}>{replaceLabel}</Text>
      </Pressable>
      <Pressable
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={removeLabel}
        style={styles.removeFileButton}
        className="flex-1 items-center justify-center"
      >
        <Text style={styles.removeFileButtonText}>{removeLabel}</Text>
      </Pressable>
    </View>
  );
}

function FieldError({ message }: { message: string }) {
  return (
    <Text accessibilityLiveRegion="polite" className="text-xs font-medium text-red-600">
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  packagingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  packagingTile: {
    width: '48.5%',
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
  },
  packagingTileSelected: {
    backgroundColor: colors.brand.primarySoft,
    borderColor: colors.brand.primary,
  },
  packagingTileText: {
    flexShrink: 1,
    flexGrow: 1,
    marginLeft: 8,
    marginRight: 6,
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '600',
    includeFontPadding: false,
  },
  packagingTileTextSelected: {
    color: colors.brand.primary,
  },
  existingCbmNotice: {
    backgroundColor: colors.surface.selected,
    borderRadius: customerRadius.control,
    gap: 3,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  existingCbmLabel: {
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '500',
  },
  existingCbmValue: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  uploadArea: {
    backgroundColor: 'rgba(238, 246, 252, 0.5)',
    borderColor: 'rgba(114, 169, 210, 0.45)',
    borderRadius: 18,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    minHeight: 136,
  },
  uploadAreaError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  uploadIconCircle: {
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#173b59',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  uploadTitle: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  uploadDescription: {
    color: colors.text.secondary,
    fontSize: 12,
    lineHeight: 20,
  },
  replaceButton: {
    backgroundColor: colors.brand.primarySoft,
    borderRadius: 14,
    minHeight: 46,
  },
  replaceButtonText: {
    color: colors.brand.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  removeFileButton: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(189, 214, 231, 0.5)',
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 46,
  },
  removeFileButtonText: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  documentPickerButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(238, 246, 252, 0.5)',
    borderColor: 'rgba(114, 169, 210, 0.45)',
    borderRadius: 16,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 12,
    minHeight: 76,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  documentPickerTitle: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  selectedDocumentCard: {
    alignItems: 'center',
    backgroundColor: colors.surface.selected,
    borderColor: colors.border.default,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 76,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  documentIcon: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  documentName: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  documentMeta: {
    color: colors.text.secondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
});
