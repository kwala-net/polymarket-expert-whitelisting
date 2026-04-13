"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract } from "wagmi";
import { useState, useCallback } from "react";
import { expertWhitelistAbi } from "@/lib/contract-abi";

const CONTRACT_ADDRESS = process.env
  .NEXT_PUBLIC_EXPERT_WHITELIST_ADDRESS as `0x${string}`;

type RegisterStatus = "idle" | "loading" | "registered" | "error";

export default function Home() {
  const { address, isConnected } = useAccount();

  const { data: isRegistered, refetch: refetchRegistered } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: expertWhitelistAbi,
    functionName: "isRegistered",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!CONTRACT_ADDRESS },
  });

  const { data: isExpert, refetch: refetchExpert } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: expertWhitelistAbi,
    functionName: "isExpert",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!CONTRACT_ADDRESS },
  });

  // useReadContract returns `unknown` without explicit generics; cast for JSX safety
  const registered = Boolean(isRegistered);
  const expert = Boolean(isExpert);

  const [status, setStatus] = useState<RegisterStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [txHash, setTxHash] = useState<string>("");

  const handleRegister = useCallback(async () => {
    if (!address) return;
    setStatus("loading");
    setErrorMsg("");
    setTxHash("");

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eoa: address }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          // Already registered — just refresh contract state
          await refetchRegistered();
          await refetchExpert();
          setStatus("registered");
          return;
        }
        throw new Error(data.error ?? "Registration failed");
      }

      setTxHash(data.txHash);
      setStatus("registered");
      await refetchRegistered();
      await refetchExpert();
    } catch (err: unknown) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  }, [address, refetchRegistered, refetchExpert]);

  const statusBadge = () => {
    if (!isConnected) return null;
    if (expert)
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800">
          Expert ✓
        </span>
      );
    if (registered)
      return (
        <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-800">
          Registered — pending expert check
        </span>
      );
    return (
      <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-600">
        Not registered
      </span>
    );
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
        <div>
          <h1 className="text-lg font-bold tracking-tight">
            Polymarket Expert Whitelisting
          </h1>
          <p className="text-xs text-slate-400">
            Powered by{" "}
            <a
              href="https://kwala.network"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-white"
            >
              Kwala
            </a>
          </p>
        </div>
        <ConnectButton />
      </header>

      {/* Body */}
      <div className="flex flex-col items-center justify-center px-4 py-24 gap-8">
        {!isConnected ? (
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold">Connect your wallet</h2>
            <p className="text-slate-400 max-w-sm">
              Connect your wallet to check whether you qualify as a Polymarket
              expert and receive your on-chain badge.
            </p>
          </div>
        ) : (
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 w-full max-w-md space-y-6">
            {/* Address */}
            <div>
              <p className="text-xs text-slate-400 mb-1">Connected wallet</p>
              <p className="font-mono text-sm break-all">{address}</p>
            </div>

            {/* Status badge */}
            <div className="flex items-center gap-2">
              <p className="text-xs text-slate-400">Status:</p>
              {statusBadge()}
            </div>

            {/* Register button — only show if not yet registered */}
            {!registered && !expert && (
              <button
                onClick={handleRegister}
                disabled={status === "loading"}
                className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed py-3 font-semibold transition-colors"
              >
                {status === "loading"
                  ? "Registering…"
                  : "Register as Polymarket user"}
              </button>
            )}

            {/* Success / tx hash */}
            {txHash && (
              <div className="rounded-lg bg-green-900/40 border border-green-700 px-4 py-3 text-sm">
                <p className="font-semibold text-green-400 mb-1">
                  Registered successfully!
                </p>
                <p className="text-slate-400 text-xs break-all">Tx: {txHash}</p>
              </div>
            )}

            {/* Error */}
            {status === "error" && errorMsg && (
              <div className="rounded-lg bg-red-900/40 border border-red-700 px-4 py-3 text-sm text-red-300">
                {errorMsg}
              </div>
            )}

            {/* Expert CTA */}
            {expert && (
              <div className="rounded-lg bg-green-900/30 border border-green-700 px-4 py-3 text-sm text-green-300">
                You hold the Polymarket Expert NFT. Welcome to the whitelist!
              </div>
            )}

            {/* Already registered, awaiting check */}
            {registered && !expert && (
              <p className="text-xs text-slate-500 text-center">
                A Kwala automation runs every 15 minutes to check your trading
                history and mint your badge if you qualify.
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
