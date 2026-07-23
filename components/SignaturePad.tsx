import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

interface SignaturePadProps {
  onOK: (signatureUrl: string) => void;
  onClear: () => void;
}

export function SignaturePad({ onOK, onClear }: SignaturePadProps) {
  // A mock base64 image for the signature (a 1x1 black pixel)
  const MOCK_SIGNATURE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

  return (
    <View style={styles.container}>
      <View style={styles.pad}>
        <Text style={styles.placeholderText}>
          (Màn hình ký tên giả lập - Chưa cài thư viện signature)
        </Text>
        <Text style={styles.subText}>
          Vui lòng bấm "Xác nhận ký" để tiếp tục luồng.
        </Text>
      </View>
      <View style={styles.row}>
        <Pressable onPress={onClear} style={[styles.button, styles.clearBtn]}>
          <Text style={styles.clearText}>Xóa ký lại</Text>
        </Pressable>
        <Pressable onPress={() => onOK(MOCK_SIGNATURE)} style={[styles.button, styles.okBtn]}>
          <Text style={styles.okText}>Xác nhận ký</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 300,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  pad: {
    flex: 1,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  placeholderText: {
    color: '#6b7280',
    fontSize: 14,
    textAlign: 'center',
  },
  subText: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtn: {
    backgroundColor: '#fff',
  },
  clearText: {
    color: '#ef4444',
    fontWeight: 'bold',
  },
  okBtn: {
    backgroundColor: '#15803d',
  },
  okText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
