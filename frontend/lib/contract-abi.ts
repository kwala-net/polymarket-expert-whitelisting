/**
 * Client-safe ABI export — no private keys, no server env.
 * Import this in client components / pages for wagmi hooks.
 */
import artifact from "../abi/ExpertWhitelist.json";
import type { Abi } from "viem";

export const expertWhitelistAbi = artifact.abi as Abi;
