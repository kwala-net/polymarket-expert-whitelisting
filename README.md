# Polymarket Expert Whitelisting — powered by Kwala

A demo of [Kwala](https://kwala.network) decentralized workflow automation.

Users connect their wallet, register their Polymarket identity, and a Kwala cron workflow
automatically mints them a soulbound ERC-721 "Expert" NFT if they have at least one
closed position on Polymarket.

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Flow                               │
│                                                                 │
│  1. Connect wallet (RainbowKit)                                 │
│  2. Click "Register" → POST /api/register                       │
│       ├─ Calls gamma-api to get proxyWallet                     │
│       └─ Calls ExpertWhitelist.register(eoa, proxyWallet)       │
│                                                                 │
│  3. Kwala cron (every 15 min) → POST /api/checkexpertise        │
│       ├─ Reads registered list from contract (getRegistered)    │
│       ├─ Checks each proxyWallet via Polymarket data-api        │
│       └─ Calls ExpertWhitelist.mintExpert(proxyWallet) for      │
│          experts → NFT minted to their EOA wallet               │
└─────────────────────────────────────────────────────────────────┘
```

## Monorepo structure

```
contracts/    Foundry — ExpertWhitelist ERC-721 + tests + deploy script
frontend/     Next.js 14 App Router — UI + API routes
kwala/        Kwala workflow YAML
```

---

## 1. Contracts

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Some Amoy testnet MATIC — grab from the [Polygon faucet](https://faucet.polygon.technology/)

### Run tests

```bash
cd contracts
forge test -vvv
```

### Deploy to Polygon Amoy

```bash
cd contracts
export PRIVATE_KEY=0x<your_deployer_key>
export AMOY_RPC_URL=https://rpc-amoy.polygon.technology

forge script script/Deploy.s.sol \
  --rpc-url $AMOY_RPC_URL \
  --broadcast \
  --verify          # optional, needs POLYGONSCAN_API_KEY
```

Note the deployed contract address printed in the output — you'll need it for the frontend.

After deploying, copy the ABI into the frontend:

```bash
cp contracts/out/ExpertWhitelist.sol/ExpertWhitelist.json frontend/abi/ExpertWhitelist.json
```

---

## 2. Frontend

### Prerequisites

- Node.js ≥ 18
- A [WalletConnect Cloud](https://cloud.walletconnect.com) project ID (free)
- An RPC URL for Polygon Amoy (e.g. from Alchemy or Infura — free tier is fine)

### Setup

```bash
cd frontend
cp .env.local.example .env.local
# Fill in all values in .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

| Variable | Description |
| --- | --- |
| `OWNER_PRIVATE_KEY` | Private key of the contract owner (backend signer) |
| `RPC_URL` | JSON-RPC URL for writing txs (server-side) |
| `EXPERT_WHITELIST_ADDRESS` | Deployed contract address |
| `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` | WalletConnect project ID |
| `NEXT_PUBLIC_EXPERT_WHITELIST_ADDRESS` | Same contract address (client-side reads) |
| `NEXT_PUBLIC_CHAIN_ID` | `80002` for Amoy, `137` for mainnet |

### API routes

#### `POST /api/register`

Registers a connected wallet. Called automatically by the frontend button.

```jsonc
// Request
{ "eoa": "0xYourWalletAddress" }

// Response 200
{ "ok": true, "txHash": "0x...", "proxyWallet": "0x..." }

// Response 404 — no Polymarket profile found
{ "error": "No Polymarket profile found for this address" }

// Response 409 — already registered
{ "error": "Address already registered", "proxyWallet": "0x..." }
```

#### `POST /api/checkexpertise`

Checks trading history and mints NFTs for qualifying experts.
Called by the Kwala cron workflow (or manually for testing).

```jsonc
// Payload mode — check specific proxy addresses
{ "user_ids": ["0xproxy1", "0xproxy2"] }

// Contract mode — fetch list from on-chain (empty body or no user_ids)
{}

// Response
{
  "checked": 3,
  "experts": ["0xproxy1"],
  "minted": [{ "proxyWallet": "0xproxy1", "eoa": "0xEOA1", "txHash": "0x..." }],
  "skipped": [{ "proxyWallet": "0xproxy2", "reason": "already minted" }]
}
```

---

## 3. Kwala workflow

Edit `kwala/check-experts.kwala.yaml` and set the `CHECKEXPERTISE_URL` environment
variable in your Kwala project to your deployed endpoint URL.

```bash
# Install Kwala CLI (see https://kwala.network/docs)
kwala deploy kwala/check-experts.kwala.yaml
```

The workflow fires every 15 minutes and POSTs to `/api/checkexpertise` with an empty
body, triggering the contract-fetch mode.

---

## Testing the full flow

```bash
# 1. Register a known Polymarket user (test fixture from the spec)
curl -X POST http://localhost:3000/api/register \
  -H 'content-type: application/json' \
  -d '{"eoa":"0x06aC22BAbE1ae2eF7a1124aab9EE0988850D6211"}'

# 2. Trigger expertise check (payload mode)
curl -X POST http://localhost:3000/api/checkexpertise \
  -H 'content-type: application/json' \
  -d '{"user_ids":["0x06ac22babe1ae2ef7a1124aab9ee0988850d6211"]}'

# 3. Trigger expertise check (contract mode — self-fetches the list)
curl -X POST http://localhost:3000/api/checkexpertise \
  -H 'content-type: application/json' \
  -d '{}'

# 4. Verify idempotency — second call should return skipped, not minted
curl -X POST http://localhost:3000/api/checkexpertise \
  -H 'content-type: application/json' \
  -d '{}'
```
