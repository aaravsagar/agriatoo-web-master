import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';

interface QRScannerProps {
  onScan: (result: string) => void;
  onError?: (error: string) => void;
  isActive: boolean;
  manualTrigger?: boolean;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScan, onError, isActive, manualTrigger = false }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [codeReader, setCodeReader] = useState<BrowserMultiFormatReader | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

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
    if (!manualTrigger && isActive && codeReader && videoRef.current && !isScanning) {
      startScanning();
    } else if (!isActive && codeReader) {
      stopScanning();
    }
  }, [isActive, codeReader, manualTrigger]);

  const requestCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      // Stop the stream immediately - we just needed to check permission
      stream.getTracks().forEach(track => track.stop());
      setHasPermission(true);
      return true;
    } catch (error: any) {
      console.error('Camera permission error:', error);
      setHasPermission(false);
      
      if (onError) {
        if (error.name === 'NotAllowedError') {
          onError('Camera permission denied. Please allow camera access and try again.');
        } else if (error.name === 'NotFoundError') {
          onError('No camera found on this device.');
        } else {
          onError('Unable to access camera: ' + error.message);
        }
      }
      return false;
    }
  };

  const startScanning = async () => {
    if (!codeReader || !videoRef.current || isScanning) return;

    try {
      setIsScanning(true);
      
      // Check camera permission first
      if (hasPermission === null) {
        const permissionGranted = await requestCameraPermission();
        if (!permissionGranted) {
          setIsScanning(false);
          return;
        }
      }
      
      // Get video devices
      const videoInputDevices = await codeReader.listVideoInputDevices();
      
      if (videoInputDevices.length === 0) {
        throw new Error('No camera devices found');
      }
      
      // Prefer back camera
      const backCamera = videoInputDevices.find(device => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('rear') ||
        device.label.toLowerCase().includes('environment')
      );
      
      const deviceId = backCamera ? backCamera.deviceId : videoInputDevices[0]?.deviceId;
      
      if (!deviceId) {
        throw new Error('No suitable camera device found');
      }

      console.log('Starting QR scanner with device:', deviceId);

      // Start decoding with proper error handling
      const result = await codeReader.decodeFromVideoDevice(
        deviceId, 
        videoRef.current, 
        (result, error) => {
          if (result) {
            console.log('QR Code detected:', result.getText());
            onScan(result.getText());
            // Don't stop scanning for continuous mode
          }
          if (error && error.name !== 'NotFoundException') {
            console.warn('QR scan error:', error);
            // Don't report NotFoundException as it's normal when no QR is visible
          }
        }
      );

    } catch (error: any) {
      console.error('Error starting QR scanner:', error);
      setIsScanning(false);
      
      if (onError) {
        if (error.name === 'NotAllowedError') {
          onError('Camera permission denied. Please allow camera access in browser settings.');
        } else if (error.name === 'NotFoundError') {
          onError('No camera found on this device.');
        } else if (error.name === 'NotReadableError') {
          onError('Camera is being used by another application.');
        } else {
          onError('Failed to start camera: ' + error.message);
        }
      }
    }
  };

  const stopScanning = () => {
    if (codeReader) {
      try {
        codeReader.reset();
        console.log('QR scanner stopped');
      } catch (error) {
        console.error('Error stopping QR scanner:', error);
      }
    }
    setIsScanning(false);
  };

  const triggerScan = () => {
    if (manualTrigger) {
      startScanning();
    }
  };

  return (
    <div className="relative w-full">
      <video
        ref={videoRef}
        className="w-full h-64 object-cover rounded-lg bg-black"
        playsInline
        muted
      />
      
      {/* Scanning overlay */}
      <div className="absolute inset-0 border-2 border-green-500 border-dashed rounded-lg pointer-events-none">
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-2 border-green-400 rounded-lg"></div>
        
        {/* Corner markers */}
        <div className="absolute top-4 left-4 w-6 h-6 border-l-4 border-t-4 border-green-400"></div>
        <div className="absolute top-4 right-4 w-6 h-6 border-r-4 border-t-4 border-green-400"></div>
        <div className="absolute bottom-4 left-4 w-6 h-6 border-l-4 border-b-4 border-green-400"></div>
        <div className="absolute bottom-4 right-4 w-6 h-6 border-r-4 border-b-4 border-green-400"></div>
      </div>
      
      {/* Status indicators */}
      {isScanning && (
        <div className="absolute top-2 left-2 bg-green-600 text-white px-3 py-1 rounded-full text-sm flex items-center space-x-2">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
          <span>Scanning...</span>
        </div>
      )}
      
      {hasPermission === false && (
        <div className="absolute top-2 right-2 bg-red-600 text-white px-3 py-1 rounded-full text-sm">
          Camera Access Denied
        </div>
      )}
      
      {!isScanning && isActive && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="text-white text-center">
            {manualTrigger ? (
              <button
                onClick={triggerScan}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                📸 Tap to Scan QR Code
              </button>
            ) : (
              <>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                <p className="text-sm">Starting camera...</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default QRScanner;