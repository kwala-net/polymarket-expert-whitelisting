// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ExpertWhitelist
 * @notice Soulbound ERC-721 badge for Polymarket experts.
 *
 * Flow:
 *  1. Backend calls `register(eoa, proxyWallet)` when a user connects their
 *     wallet and their Polymarket proxyWallet is resolved via gamma-api.
 *  2. A Kwala cron workflow calls the backend's POST /api/checkexpertise,
 *     which fetches each registered proxyWallet's closed-position history and
 *     calls `mintExpert(proxyWallet)` for qualified users.
 *  3. The contract maps proxyWallet → EOA internally so the NFT is always
 *     minted to the user's real wallet, not the Polymarket proxy.
 *
 * Soulbound: tokens cannot be transferred (only minted / burned).
 */
contract ExpertWhitelist is ERC721, Ownable {
    // ─── Storage ────────────────────────────────────────────────────────────

    /// @notice Ordered list of registered EOA addresses (for on-chain enumeration).
    address[] private _registeredEoas;

    /// @notice EOA wallet → Polymarket proxyWallet
    mapping(address => address) public eoaToProxy;

    /// @notice Polymarket proxyWallet → EOA wallet (reverse lookup for minting)
    mapping(address => address) public proxyToEoa;

    /// @notice Whether an EOA has been registered
    mapping(address => bool) public isRegistered;

    /// @notice Whether an EOA has already received the expert NFT
    mapping(address => bool) public isExpert;

    uint256 private _nextTokenId;

    // ─── Errors ─────────────────────────────────────────────────────────────

    error AlreadyRegistered(address eoa);
    error ZeroProxyWallet();
    error NotRegistered(address proxyWallet);
    error AlreadyMinted(address eoa);
    error Soulbound();

    // ─── Events ─────────────────────────────────────────────────────────────

    event UserRegistered(address indexed eoa, address indexed proxyWallet);
    event ExpertMinted(address indexed eoa, address indexed proxyWallet, uint256 tokenId);

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor() ERC721("Polymarket Expert", "PMEXP") Ownable(msg.sender) {}

    // ─── Owner functions ────────────────────────────────────────────────────

    /**
     * @notice Register a user's EOA ↔ proxyWallet mapping.
     * @dev Called by the backend after resolving the proxyWallet from gamma-api.
     *      Only callable by the contract owner (backend signer).
     * @param eoa         The user's real wallet address.
     * @param proxyWallet The Polymarket proxyWallet address returned by gamma-api.
     */
    function register(address eoa, address proxyWallet) external {
        if (isRegistered[eoa]) revert AlreadyRegistered(eoa);
        if (proxyWallet == address(0)) revert ZeroProxyWallet();

        _registeredEoas.push(eoa);
        eoaToProxy[eoa] = proxyWallet;
        proxyToEoa[proxyWallet] = eoa;
        isRegistered[eoa] = true;

        emit UserRegistered(eoa, proxyWallet);
    }

    /**
     * @notice Mint an Expert NFT to the EOA associated with `proxyWallet`.
     * @dev Called by the backend's /api/checkexpertise route when a user qualifies.
     *      Looks up EOA from proxyWallet internally so the backend never needs
     *      to track this mapping separately.
     *      Reverts with `AlreadyMinted` if the user already holds the badge —
     *      callers should catch this revert for idempotent batch processing.
     * @param proxyWallet The Polymarket proxyWallet of the expert.
     */
    function mintExpert(address proxyWallet) external {
        address eoa = proxyToEoa[proxyWallet];
        if (eoa == address(0)) revert NotRegistered(proxyWallet);
        if (isExpert[eoa]) revert AlreadyMinted(eoa);

        isExpert[eoa] = true;
        uint256 tokenId = ++_nextTokenId;
        _safeMint(eoa, tokenId);

        emit ExpertMinted(eoa, proxyWallet, tokenId);
    }

    // ─── View functions ──────────────────────────────────────────────────────

    /**
     * @notice Returns all registered EOA addresses.
     */
    function getRegisteredEoas() external view returns (address[] memory) {
        return _registeredEoas;
    }

    /**
     * @notice Returns all registered proxyWallet addresses (same order as EOAs).
     */
    function getRegisteredProxies() external view returns (address[] memory proxies) {
        uint256 len = _registeredEoas.length;
        proxies = new address[](len);
        for (uint256 i = 0; i < len; i++) {
            proxies[i] = eoaToProxy[_registeredEoas[i]];
        }
    }

    /**
     * @notice Returns both EOA and proxyWallet arrays in a single call.
     *         Used by /api/checkexpertise when fetching the list from the contract.
     */
    function getRegistered()
        external
        view
        returns (address[] memory eoas, address[] memory proxies)
    {
        uint256 len = _registeredEoas.length;
        eoas = _registeredEoas;
        proxies = new address[](len);
        for (uint256 i = 0; i < len; i++) {
            proxies[i] = eoaToProxy[_registeredEoas[i]];
        }
    }

    /**
     * @notice Number of registered users.
     */
    function registeredCount() external view returns (uint256) {
        return _registeredEoas.length;
    }

    // ─── Soulbound ───────────────────────────────────────────────────────────

    /**
     * @dev Prevent all transfers. Mints (from == address(0)) and burns
     *      (to == address(0)) are allowed; everything else reverts.
     */
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert Soulbound();
        return super._update(to, tokenId, auth);
    }
}
