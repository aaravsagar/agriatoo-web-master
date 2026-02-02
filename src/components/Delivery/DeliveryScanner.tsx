import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Scan, Zap } from 'lucide-react';

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScanSuccess, onClose }) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string>('');
  const [hasFlash, setHasFlash] = useState(false);
  const [flashOn, setFlashOn] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const startScanner = async () => {
      try {
        const scanner = new Html5Qrcode('qr-reader');
        scannerRef.current = scanner;

        const config = {
          fps: 10,
          qrbox: { width: 280, height: 280 },
          aspectRatio: 16 / 9,
        };

        const constraints = {
          facingMode: 'environment',
          advanced: [{ torch: true }]
        };

        await scanner.start(
          constraints,
          config,
          (decodedText) => {
            if (isMounted) {
              onScanSuccess(decodedText);
            }
          },
          (errorMessage) => {
            // Ignore scan errors, they happen frequently
          }
        );

        if (isMounted) {
          setIsScanning(true);
          
          // Check if device has flash
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
          });
          const track = stream.getVideoTracks()[0];
          const capabilities = track.getCapabilities() as any;
          if (capabilities.torch) {
            setHasFlash(true);
          }
          track.stop();
        }
      } catch (err: any) {
        console.error('Error starting scanner:', err);
        if (isMounted) {
          setError('Failed to start camera. Please check permissions.');
        }
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      // Cleanup function to properly stop the camera
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .then(() => {
            scannerRef.current?.clear();
            scannerRef.current = null;
            console.log('Camera stopped successfully');
          })
          .catch((err) => {
            console.error('Error stopping camera:', err);
          });
      }
    };
  }, [onScanSuccess]);

  const handleClose = async () => {
    try {
      if (scannerRef.current && isScanning) {
        await scannerRef.current.stop();
        scannerRef.current.clear();
        scannerRef.current = null;
        setIsScanning(false);
      }
    } catch (err) {
      console.error('Error closing scanner:', err);
    } finally {
      onClose();
    }
  };

  const toggleFlash = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      const track = stream.getVideoTracks()[0];
      await track.applyConstraints({
        advanced: [{ torch: !flashOn } as any]
      });
      setFlashOn(!flashOn);
    } catch (err) {
      console.error('Error toggling flash:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black overflow-hidden">
      {/* Camera Feed Background */}
      <div id="qr-reader" className="absolute inset-0 w-full h-full"></div>

      {/* Dark Overlay with Transparent Center */}
      <div className="absolute inset-0 pointer-events-none">
        <svg className="w-full h-full">
          <defs>
            <mask id="scan-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect 
                x="50%" 
                y="50%" 
                width="320" 
                height="320" 
                transform="translate(-160, -160)" 
                rx="20" 
                fill="black" 
              />
            </mask>
          </defs>
          <rect 
            width="100%" 
            height="100%" 
            fill="rgba(0, 0, 0, 0.7)" 
            mask="url(#scan-mask)" 
          />
        </svg>

        {/* Scan Frame with Corner Brackets */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80">
          {/* Top Left Corner */}
          <div className="absolute -top-1 -left-1">
            <div className="w-16 h-1 bg-green-500 rounded-full shadow-lg shadow-green-500/50"></div>
            <div className="w-1 h-16 bg-green-500 rounded-full shadow-lg shadow-green-500/50"></div>
          </div>
          
          {/* Top Right Corner */}
          <div className="absolute -top-1 -right-1">
            <div className="w-16 h-1 bg-green-500 rounded-full ml-auto shadow-lg shadow-green-500/50"></div>
            <div className="w-1 h-16 bg-green-500 rounded-full ml-auto shadow-lg shadow-green-500/50"></div>
          </div>
          
          {/* Bottom Left Corner */}
          <div className="absolute -bottom-1 -left-1">
            <div className="w-1 h-16 bg-green-500 rounded-full shadow-lg shadow-green-500/50"></div>
            <div className="w-16 h-1 bg-green-500 rounded-full shadow-lg shadow-green-500/50"></div>
          </div>
          
          {/* Bottom Right Corner */}
          <div className="absolute -bottom-1 -right-1">
            <div className="w-1 h-16 bg-green-500 rounded-full ml-auto shadow-lg shadow-green-500/50"></div>
            <div className="w-16 h-1 bg-green-500 rounded-full ml-auto shadow-lg shadow-green-500/50"></div>
          </div>

          {/* Animated Scanning Line */}
          <div className="absolute inset-0 overflow-hidden rounded-2xl">
            <div className="scan-line"></div>
          </div>

          {/* Center Glow Effect */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 bg-green-500/20 rounded-full blur-3xl animate-pulse"></div>
          </div>
        </div>
      </div>

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-black via-black/80 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={handleClose}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all backdrop-blur-sm border border-white/20"
            >
              <X className="w-6 h-6 text-white" />
            </button>
            <h2 className="text-white text-xl font-semibold">Scan QR Code</h2>
          </div>
          
          {hasFlash && (
            <button
              onClick={toggleFlash}
              className={`p-2 rounded-full transition-all backdrop-blur-sm border ${
                flashOn 
                  ? 'bg-yellow-500/30 border-yellow-500/50' 
                  : 'bg-white/10 border-white/20 hover:bg-white/20'
              }`}
            >
              <Zap className={`w-6 h-6 ${flashOn ? 'text-yellow-300' : 'text-white'}`} />
            </button>
          )}
        </div>
      </div>

      {/* Bottom Instructions */}
      <div className="absolute bottom-0 left-0 right-0 z-10 p-8 bg-gradient-to-t from-black via-black/80 to-transparent">
        <div className="max-w-md mx-auto">
          <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="p-3 bg-green-500/20 rounded-full">
                <Scan className="w-8 h-8 text-green-400 animate-pulse" />
              </div>
              <div>
                <p className="text-white text-lg font-semibold mb-1">
                  Position QR Code
                </p>
                <p className="text-gray-300 text-sm">
                  Align the QR code within the frame to scan
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="absolute top-24 left-0 right-0 z-20 px-4">
          <div className="max-w-md mx-auto bg-red-500/90 backdrop-blur-sm text-white px-6 py-4 rounded-2xl shadow-2xl border border-red-400/50">
            <p className="text-center font-medium">{error}</p>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes scanAnimation {
          0% {
            transform: translateY(-100%);
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
          100% {
            transform: translateY(100%);
            opacity: 0;
          }
        }

        .scan-line {
          position: absolute;
          width: 100%;
          height: 3px;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(16, 185, 129, 0.3),
            rgba(16, 185, 129, 1),
            rgba(16, 185, 129, 0.3),
            transparent
          );
          box-shadow: 
            0 0 20px rgba(16, 185, 129, 0.8),
            0 0 40px rgba(16, 185, 129, 0.5),
            0 0 60px rgba(16, 185, 129, 0.3);
          animation: scanAnimation 3s ease-in-out infinite;
        }

        #qr-reader {
          width: 100% !important;
          height: 100% !important;
          border: none !important;
        }

        #qr-reader > div {
          width: 100% !important;
          height: 100% !important;
        }

        #qr-reader video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
        }

        #qr-reader__dashboard,
        #qr-reader__dashboard_section,
        #qr-reader__dashboard_section_swaplink,
        #qr-reader__header_message {
          display: none !important;
        }

        #qr-reader__scan_region {
          border: none !important;
        }
      `}</style>
    </div>
  );
};

export default QRScanner;