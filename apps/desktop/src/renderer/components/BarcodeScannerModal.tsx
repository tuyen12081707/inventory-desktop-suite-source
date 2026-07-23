import type { IScannerControls } from '@zxing/browser';
import { Alert, Modal, Spin, Typography } from 'antd';
import { useEffect, useRef, useState } from 'react';

interface BarcodeScannerModalProps {
  open: boolean;
  onClose(): void;
  onDetected(code: string): void;
}

export function BarcodeScannerModal({
  open,
  onClose,
  onDetected,
}: BarcodeScannerModalProps): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const detectedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    detectedRef.current = false;
    setError(null);
    setStarting(true);

    const start = async (): Promise<void> => {
      if (!videoRef.current) return;
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const reader = new BrowserMultiFormatReader(undefined, {
        delayBetweenScanAttempts: 150,
        delayBetweenScanSuccess: 800,
      });
      try {
        const controls = await reader.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          videoRef.current,
          (result, _scanError, scannerControls) => {
            if (!active || !result || detectedRef.current) return;
            detectedRef.current = true;
            scannerControls.stop();
            onDetected(result.getText());
          },
        );
        if (!active) controls.stop();
        else controlsRef.current = controls;
      } catch {
        if (active) {
          setError(
            'Không mở được camera. Hãy cấp quyền camera hoặc dùng máy quét USB/nhập mã thủ công.',
          );
        }
      } finally {
        if (active) setStarting(false);
      }
    };

    void start();
    return () => {
      active = false;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [onDetected, open]);

  return (
    <Modal
      title="Quét barcode bằng camera"
      open={open}
      footer={null}
      onCancel={onClose}
      destroyOnHidden
      width={680}
    >
      <div className="camera-scanner">
        <video ref={videoRef} className="camera-preview" muted playsInline />
        <div className="camera-frame" />
        {starting && (
          <div className="camera-loading">
            <Spin />
            <Typography.Text>Đang mở camera…</Typography.Text>
          </div>
        )}
      </div>
      {error && <Alert type="warning" showIcon message={error} className="camera-alert" />}
      <Typography.Paragraph type="secondary" className="camera-tip">
        Đưa barcode vào giữa khung. Camera cần HTTPS trên trình duyệt; ứng dụng Electron có thể yêu
        cầu quyền camera lần đầu.
      </Typography.Paragraph>
    </Modal>
  );
}
