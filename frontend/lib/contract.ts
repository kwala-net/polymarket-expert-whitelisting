import {
  createPublicClient,
  createWalletClient,
  http,
  type Abi,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygonAmoy } from "viem/chains";
import { getServerEnv } from "./env";
import artifact from "../abi/ExpertWhitelist.json";

export const expertWhitelistAbi = artifact.abi as Abi;

/**
 * Build viem clients from server-side env.
 * Called only inside API routes (never on the client).
 */
export function getContractClients() {
  const env = getServerEnv();

  const account = privateKeyToAccount(env.OWNER_PRIVATE_KEY as `0x${string}`);

  const publicClient = createPublicClient({
    chain: polygonAmoy,
    transport: http(env.RPC_URL),
  });

  const walletClient = createWalletClient({
    chain: polygonAmoy,
    transport: http(env.RPC_URL),
    account,
  });

  const contractAddress = env.EXPERT_WHITELIST_ADDRESS as Address;

  return { publicClient, walletClient, contractAddress, account };
}

/**
 * Helper: write to the contract and wait for the tx receipt.
 */
export async function writeContract(
  functionName: string,
  args: unknown[]
): Promise<{ txHash: `0x${string}`; blockNumber: bigint }> {
  const { publicClient, walletClient, contractAddress } = getContractClients();

  const hash = await walletClient.writeContract({
    address: contractAddress,
    abi: expertWhitelistAbi,
    functionName,
    args,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return { txHash: hash, blockNumber: receipt.blockNumber };
}

/**
 * Helper: read from the contract.
 */
export async function readContract<T>(
  functionName: string,
  args: unknown[] = []
): Promise<T> {
  const { publicClient, contractAddress } = getContractClients();

  return publicClient.readContract({
    address: contractAddress,
    abi: expertWhitelistAbi,
    functionName,
    args,
  }) as Promise<T>;
}
