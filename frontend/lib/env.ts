import { z } from "zod";

const serverEnvSchema = z.object({
  OWNER_PRIVATE_KEY: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/, "Must be a 0x-prefixed 32-byte hex key"),
  RPC_URL: z.string().url("Must be a valid RPC URL"),
  EXPERT_WHITELIST_ADDRESS: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/, "Must be a valid Ethereum address"),
});

const clientEnvSchema = z.object({
  NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID: z.string().min(1),
  NEXT_PUBLIC_EXPERT_WHITELIST_ADDRESS: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/, "Must be a valid Ethereum address"),
  NEXT_PUBLIC_CHAIN_ID: z.coerce.number().default(11155111), // Sepolia
});

// Server-side env (only safe to call in API routes / server components)
export function getServerEnv() {
  return serverEnvSchema.parse({
    OWNER_PRIVATE_KEY: process.env.OWNER_PRIVATE_KEY,
    RPC_URL: process.env.RPC_URL,
    EXPERT_WHITELIST_ADDRESS: process.env.EXPERT_WHITELIST_ADDRESS,
  });
}

// Client-safe env (NEXT_PUBLIC_ prefixed)
export const clientEnv = clientEnvSchema.parse({
  NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID:
    process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID ?? "demo-project-id",
  NEXT_PUBLIC_EXPERT_WHITELIST_ADDRESS:
    process.env.NEXT_PUBLIC_EXPERT_WHITELIST_ADDRESS ?? "0x0000000000000000000000000000000000000000",
  NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID ?? 11155111,
});
