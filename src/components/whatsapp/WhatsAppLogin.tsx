"use client";

import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import QRCode from "qrcode";
import Image from "next/image";

interface WhatsAppLoginProps {
  wsRef: React.RefObject<WebSocket | null>;
  onConnectionStatusChange?: (status: { whatsappConnected: boolean, whatsappAuthenticated: boolean }) => void;
  wsData: any;
}

export default function WhatsAppLogin({ wsRef, onConnectionStatusChange, wsData }: WhatsAppLoginProps) {
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [renderedQrCode, setRenderedQrCode] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<{ whatsappConnected: boolean, whatsappAuthenticated: boolean }>({ whatsappConnected: false, whatsappAuthenticated: false });
  const [showSuccess, setShowSuccess] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  // Function to generate QR code image from raw data
  const generateQRCode = async (data: string) => {
    try {
      // Clean the QR data - remove any extra characters or formatting
      const cleanData = data.trim();

      const qrCodeImageUrl = await QRCode.toDataURL(cleanData, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M',
        type: 'image/png'
      });
      setQrCodeImage(qrCodeImageUrl);
      console.log('QR code image generated successfully');
    } catch (error) {
      console.error('Error generating QR code:', error);
      console.error('QR data that failed:', data);
      setError('Failed to generate QR code');
    }
  };

  useEffect(() => {
    console.log("QR Code received", wsData);
    if (!wsData) return;

    switch (wsData.type) {
      case "qr_code":
        console.log("QR Code data structure:", wsData.data);
        setQrCodeData(wsData.data.qr || wsData.data.qrCode);
        // Always generate QR code image for better display
        console.log("Generating QR code image from raw data");
        const qrData = wsData.data.qr || wsData.data.qrCode;
        if (qrData) {
          generateQRCode(qrData);
          setRenderedQrCode(null); // Clear ASCII art
        } else {
          console.error("No QR code data found in:", wsData.data);
          setError("Invalid QR code data received");
        }
        setAttempts(wsData.data.attempts || 0);
        setTimeLeft(60);
        setError(null);
        break;
      case "is_initializing":
        setIsInitializing(wsData.data.isInitializing);
        break;
      case "connection_status":
        setConnectionStatus(wsData.data);
        onConnectionStatusChange?.(wsData.data);
        if (wsData.data.status === "successChat") {
          setQrCodeData(null);
          setQrCodeImage(null);
          setError(null);
          setShowSuccess(true);
          // Hide success message after 3 seconds
          setTimeout(() => setShowSuccess(false), 3000);
          setAttempts(0);
          setTimeLeft(60);
          setIsLoading(false);
        }
        break;
      case "login_response":
        if (wsData.status === "error") {
          setError(wsData.error || "Failed to connect to WhatsApp");
        }
        break;
      case "error":
        setError(wsData.error);
        break;
    }
  }, [wsData, onConnectionStatusChange]);

  const handleLogin = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setIsLoading(true);
      setError(null);
      wsRef.current.send(JSON.stringify({ type: "login" }));
    } else {
      setError("Not connected to server");
    }
  };

  const handleLogout = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "logout" }));
    }
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if ((qrCodeData || qrCodeImage) && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setError("Time expired. Please try again.");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [qrCodeData, qrCodeImage, timeLeft]);

  return (
    <div>
      {error && (
        <div className="bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {showSuccess && (
        <div className="bg-green-100 dark:bg-green-900/20 border border-green-400 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded mb-4">
          Successfully connected to WhatsApp!
        </div>
      )}

      {/* <div className="mb-4">
        <p className="text-sm text-muted-foreground">Status: {connectionStatus.whatsappConnected ? "Connected" : "Disconnected"}</p>
      </div> */}

      {(qrCodeImage || qrCodeData) ? (
        <div className="flex flex-col items-center gap-4">
          <div className="bg-white dark:bg-white rounded-lg p-4 border border-border">
            {qrCodeImage ? (
              // Display generated QR code image
              <div className="relative w-64 h-64">
                <Image
                  src={qrCodeImage}
                  alt="WhatsApp QR Code"
                  fill
                  className="object-contain"
                />
              </div>
            ) : qrCodeData ? (
              // Fallback: show raw QR data for debugging
              <div className="w-64 h-64 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">QR Code Data Received</p>
                  <p className="text-xs text-muted-foreground break-all">
                    {qrCodeData.substring(0, 50)}...
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Please scan with WhatsApp
                  </p>
                </div>
              </div>
            ) : null}
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-foreground">
              Time remaining: {timeLeft} seconds
            </p>
            <p className="text-sm text-muted-foreground">Attempt {attempts} of 3</p>
          </div>
        </div>
      ) : connectionStatus.whatsappConnected ? (
        <Button onClick={handleLogout} className="w-full sm:w-auto">
          Disconnect from WhatsApp
        </Button>
      ) : (
        <Button
          onClick={handleLogin}
          disabled={isLoading || isInitializing}
          className="w-full sm:w-auto"
        >
          {isLoading ? "Loading..." : isInitializing ? "Initializing server, please wait..." : "Connect to WhatsApp"}
        </Button>
      )}
    </div>
  );
} 