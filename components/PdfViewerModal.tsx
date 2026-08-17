import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';

interface PdfViewerModalProps {
  visible: boolean;
  title: string;
  subtitle?: string | null;
  base64Data?: string | null;
  onClose: () => void;
  onDownload?: () => void;
  primaryColor?: string;
  backgroundColor?: string;
  cardBackgroundColor?: string;
  textColor?: string;
  borderColor?: string;
}

/**
 * In-app PDF Viewer Modal using Mozilla PDF.js Canvas renderer.
 * Compatible with Android and iOS without requiring external browser or plugins.
 */
export function PdfViewerModal({
  visible,
  title,
  subtitle,
  base64Data,
  onClose,
  onDownload,
  primaryColor = '#0284c7',
  backgroundColor = '#f8fafc',
  cardBackgroundColor = '#ffffff',
  textColor = '#0f172a',
  borderColor = '#e2e8f0',
}: PdfViewerModalProps) {
  if (!visible || !base64Data) return null;

  const htmlContent = getPdfJsHtml(base64Data, title);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: borderColor,
            backgroundColor: cardBackgroundColor,
          }}
        >
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: textColor }} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={{ fontSize: 12, color: primaryColor, fontWeight: '600' }} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {onDownload ? (
              <Pressable
                onPress={onDownload}
                hitSlop={8}
                style={{
                  padding: 8,
                  borderRadius: 20,
                  backgroundColor,
                }}
              >
                <Ionicons name="download-outline" size={22} color={textColor} />
              </Pressable>
            ) : null}
            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={{
                padding: 8,
                borderRadius: 20,
                backgroundColor,
              }}
            >
              <Ionicons name="close" size={22} color={textColor} />
            </Pressable>
          </View>
        </View>

        {/* WebView with PDF.js Engine */}
        <WebView
          originWhitelist={['*']}
          source={{ html: htmlContent }}
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
                backgroundColor,
              }}
            >
              <ActivityIndicator size="large" color={primaryColor} />
              <Text style={{ marginTop: 12, fontSize: 13, color: '#64748b' }}>
                Đang hiển thị tài liệu...
              </Text>
            </View>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}

function getPdfJsHtml(base64Data: string, title: string): string {
  const rawBase64 = base64Data.includes('base64,') ? base64Data.split('base64,')[1] : base64Data;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0, user-scalable=yes">
  <title>${title}</title>
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
    <div>Đang kết xuất tài liệu...</div>
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
