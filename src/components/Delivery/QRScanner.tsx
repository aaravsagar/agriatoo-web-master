import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';

interface QRScannerProps {
  onScan: (result: string) => void;
  onError?: (error: string) => void;
  isActive: boolean;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScan, onError, isActive }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [codeReader, setCodeReader] = useState<BrowserMultiFormatReader | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (isActive && !codeReader) {
      const reader = new BrowserMultiFormatReader();
      setCodeReader(reader);
    }

    return () => {
      if (codeReader) {
        codeReader.reset();
      }
    };
  }, [isActive]);

  useEffect(() => {
    if (isActive && codeReader && videoRef.current && !isScanning) {
      startScanning();
    } else if (!isActive && codeReader) {
      stopScanning();
    }
  }, [isActive, codeReader]);

  const startScanning = async () => {
    if (!codeReader || !videoRef.current || isScanning) return;

    try {
      setIsScanning(true);
      
      // Get video devices
      const videoInputDevices = await codeReader.listVideoInputDevices();
      
      // Prefer back camera
      const backCamera = videoInputDevices.find(device => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('rear') ||
        device.label.toLowerCase().includes('environment')
      );
      
      const deviceId = backCamera ? backCamera.deviceId : videoInputDevices[0]?.deviceId;
      
      if (!deviceId) {
        throw new Error('No camera devices found');
      }

      // Start decoding
      codeReader.decodeFromVideoDevice(deviceId, videoRef.current, (result, error) => {
        if (result) {
          onScan(result.getText());
        }
        if (error && onError) {
          console.warn('QR scan error:', error);
        }
      });

    } catch (error) {
      console.error('Error starting QR scanner:', error);
      if (onError) {
        onError('Failed to start camera. Please check permissions.');
      }
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    if (codeReader) {
      codeReader.reset();
    }
    setIsScanning(false);
  };

  return (
    <div className="relative">
      <video
        ref={videoRef}
        className="w-full h-64 object-cover rounded-lg bg-black"
        playsInline
      />
      <div className="absolute inset-0 border-2 border-green-500 border-dashed rounded-lg pointer-events-none">
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-2 border-green-400 rounded-lg"></div>
      </div>
      {isScanning && (
        <div className="absolute top-2 left-2 bg-green-600 text-white px-2 py-1 rounded text-sm">
          Scanning...
        </div>
      )}
    </div>
  );
};

export default QRScanner;