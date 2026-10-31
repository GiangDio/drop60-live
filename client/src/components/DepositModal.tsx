"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X,
  QrCode,
  Copy,
  Check,
  Zap,
  Loader2,
  ShieldAlert,
  Sparkles,
  Smartphone,
  ExternalLink,
} from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import { User } from "@/lib/api";

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  user: User;
  onSuccess?: (newBalance: number, amount: number) => void;
}

interface QrData {
  qrUrl: string;
  bankId: string;
  accountNo: string;
  accountName: string;
  amount: number;
  transferContent: string;
  userNumber?: number;
}

const PRESET_AMOUNTS = [20000, 50000, 100000, 200000];

export default function DepositModal({
  isOpen,
  onClose,
  token,
  user,
  onSuccess,
}: DepositModalProps) {
  const [selectedAmount, setSelectedAmount] = useState<number>(20000);
  const [qrData, setQrData] = useState<QrData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [simulating, setSimulating] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [simulationToast, setSimulationToast] = useState<string>("");

  const fetchDepositQr = useCallback(
    async (amount: number) => {
      if (!token) return;
      setLoading(true);
      const API_URL = API_BASE_URL;

      try {
        const res = await fetch(`${API_URL}/api/wallet/deposit-qr?amount=${amount}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          setQrData(data);
        }
      } catch (err) {
        console.error("Failed to load VietQR:", err);
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (isOpen) {
      fetchDepositQr(selectedAmount);
    }
  }, [isOpen, selectedAmount, fetchDepositQr]);

  if (!isOpen) return null;

  const handleCopy = (text: string, field: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  const handleSimulateWebhook = async () => {
    if (!qrData) return;
    setSimulating(true);
    setSimulationToast("");

    const API_URL = API_BASE_URL;

    try {
      const res = await fetch(`${API_URL}/api/webhook/payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Apikey drop60_secret_webhook_key",
        },
        body: JSON.stringify({
          gateway: qrData.bankId,
          content: qrData.transferContent,
          transferAmount: selectedAmount,
          referenceCode: `SIM_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          secretKey: "drop60_secret_webhook_key",
          isLocalSimulation: true,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSimulationToast("⚡ Webhook ngân hàng đã báo về thành công!");
        const updated = data.results?.[0];
        if (updated && onSuccess) {
          onSuccess(updated.newBalance, updated.amount);
        }
      } else {
        setSimulationToast("Lỗi giả lập: " + (data.error || "Thất bại"));
      }
    } catch {
      setSimulationToast("Lỗi kết nối khi gửi Webhook");
    } finally {
      setSimulating(false);
      setTimeout(() => setSimulationToast(""), 4000);
    }
  };

  const formatVND = (num: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(num);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-in fade-in select-none">
      <div className="w-full max-w-sm sm:max-w-md max-h-[95vh] bg-neutral-900 border border-amber-500/50 rounded-3xl shadow-[0_0_60px_rgba(245,158,11,0.25)] flex flex-col overflow-hidden relative">
        {/* Header */}
        <div className="p-3.5 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-black text-sm text-amber-300 tracking-wide flex items-center gap-1.5">
                <span>NẠP TIỀN TỰ ĐỘNG VIETQR</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                  24/7
                </span>
              </h2>
              <p className="text-[10px] text-neutral-400">Webhook SePay / Casso xác nhận tức thì</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {/* Preset Amounts */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-neutral-300">Chọn số tiền nạp:</label>
            <div className="grid grid-cols-4 gap-1.5">
              {PRESET_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setSelectedAmount(amt)}
                  className={`py-1.5 rounded-xl text-xs font-mono font-bold transition-all border ${
                    selectedAmount === amt
                      ? "bg-amber-500 text-black border-amber-400 shadow-md shadow-amber-500/30 scale-102"
                      : "bg-neutral-950 text-neutral-300 border-neutral-800 hover:border-neutral-700"
                  }`}
                >
                  {formatVND(amt).replace("₫", "")}
                </button>
              ))}
            </div>
          </div>

          {/* VietQR Image Card */}
          <div className="p-3 rounded-2xl bg-white flex flex-col items-center justify-center relative shadow-lg min-h-[220px]">
            {loading ? (
              <div className="flex flex-col items-center gap-2 text-neutral-600">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                <span className="text-xs font-mono">Đang tạo mã VietQR...</span>
              </div>
            ) : qrData ? (
              <>
                <img
                  src={qrData.qrUrl}
                  alt="VietQR Deposit Code"
                  className="w-48 sm:w-56 h-auto object-contain rounded-lg"
                />
                <div className="flex items-center gap-1 text-[10px] text-neutral-500 font-sans mt-1">
                  <Smartphone className="w-3 h-3 text-emerald-600" />
                  <span>Quét bằng app ngân hàng (MB, VCB, Momo, Techcom...)</span>
                </div>
              </>
            ) : (
              <div className="text-xs text-red-500">Không thể tải mã VietQR</div>
            )}
          </div>

          {/* Bank Transfer Details with Copy Buttons */}
          {qrData && (
            <div className="p-3 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-2 text-xs">
              {/* Account Number */}
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Số tài khoản:</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-black text-white">{qrData.accountNo}</span>
                  <button
                    onClick={() => handleCopy(qrData.accountNo, "acc")}
                    className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                    title="Sao chép số tài khoản"
                  >
                    {copiedField === "acc" ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>

              {/* Bank Name */}
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Ngân hàng:</span>
                <span className="font-bold text-white uppercase">{qrData.bankId}</span>
              </div>

              {/* Account Name */}
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Chủ tài khoản:</span>
                <span className="font-bold text-amber-300 uppercase">{qrData.accountName}</span>
              </div>

              {/* Amount */}
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Số tiền:</span>
                <span className="font-mono font-black text-emerald-400">{formatVND(qrData.amount)}</span>
              </div>

              {/* Transfer Content (Important!) */}
              <div className="pt-1 border-t border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-1 text-amber-300 font-bold">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Nội dung CK:</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-black text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded-lg border border-amber-500/40">
                    {qrData.transferContent}
                  </span>
                  <button
                    onClick={() => handleCopy(qrData.transferContent, "content")}
                    className="p-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40"
                    title="Sao chép nội dung chuyển khoản"
                  >
                    {copiedField === "content" ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Listening Indicator */}
          <div className="flex items-center justify-center gap-2 py-1 text-[11px] text-neutral-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Đang lắng nghe biến động số dư qua Webhook...</span>
          </div>

          {/* Local Simulation Button (Test Webhook Local) */}
          <div className="pt-1">
            <button
              type="button"
              disabled={simulating || loading || !qrData}
              onClick={handleSimulateWebhook}
              className="w-full py-2.5 px-3 rounded-xl border border-amber-500/60 bg-gradient-to-r from-neutral-800 via-amber-950/60 to-neutral-800 hover:brightness-125 text-amber-300 font-bold text-xs shadow-lg active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {simulating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Đang gửi Webhook SePay/Casso...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-amber-400 animate-pulse" />
                  <span>⚡ Giả lập Webhook Ngân Hàng báo về (+{formatVND(selectedAmount).replace("₫", "")})</span>
                </>
              )}
            </button>

            {simulationToast && (
              <div className="mt-2 p-2 rounded-xl bg-neutral-950 border border-amber-400/50 text-amber-300 text-center text-xs font-bold animate-in fade-in">
                {simulationToast}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
