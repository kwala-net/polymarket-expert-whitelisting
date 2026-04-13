// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ExpertWhitelist.sol";

contract ExpertWhitelistTest is Test {
    ExpertWhitelist public whitelist;

    address internal owner   = address(this);
    address internal alice   = makeAddr("alice");   // EOA
    address internal proxy_a = makeAddr("proxy_a"); // proxyWallet for alice
    address internal bob     = makeAddr("bob");     // EOA
    address internal proxy_b = makeAddr("proxy_b"); // proxyWallet for bob
    address internal charlie = makeAddr("charlie"); // non-owner

    function setUp() public {
        whitelist = new ExpertWhitelist();
    }

    // ─── register ────────────────────────────────────────────────────────────

    function test_register_happy_path() public {
        whitelist.register(alice, proxy_a);

        assertTrue(whitelist.isRegistered(alice));
        assertEq(whitelist.eoaToProxy(alice), proxy_a);
        assertEq(whitelist.proxyToEoa(proxy_a), alice);
        assertEq(whitelist.registeredCount(), 1);

        address[] memory eoas = whitelist.getRegisteredEoas();
        assertEq(eoas.length, 1);
        assertEq(eoas[0], alice);
    }

    function test_register_duplicate_reverts() public {
        whitelist.register(alice, proxy_a);
        vm.expectRevert(abi.encodeWithSelector(ExpertWhitelist.AlreadyRegistered.selector, alice));
        whitelist.register(alice, proxy_b);
    }

    function test_register_zero_proxy_reverts() public {
        vm.expectRevert(ExpertWhitelist.ZeroProxyWallet.selector);
        whitelist.register(alice, address(0));
    }

    function test_register_only_owner() public {
        vm.prank(charlie);
        vm.expectRevert();
        whitelist.register(alice, proxy_a);
    }

    // ─── mintExpert ──────────────────────────────────────────────────────────

    function test_mintExpert_happy_path() public {
        whitelist.register(alice, proxy_a);
        whitelist.mintExpert(proxy_a);

        assertTrue(whitelist.isExpert(alice));
        assertEq(whitelist.balanceOf(alice), 1);
        assertEq(whitelist.ownerOf(1), alice);
    }

    function test_mintExpert_without_registration_reverts() public {
        vm.expectRevert(abi.encodeWithSelector(ExpertWhitelist.NotRegistered.selector, proxy_a));
        whitelist.mintExpert(proxy_a);
    }

    function test_mintExpert_idempotent_reverts_with_AlreadyMinted() public {
        whitelist.register(alice, proxy_a);
        whitelist.mintExpert(proxy_a);

        vm.expectRevert(abi.encodeWithSelector(ExpertWhitelist.AlreadyMinted.selector, alice));
        whitelist.mintExpert(proxy_a);

        // Balance unchanged
        assertEq(whitelist.balanceOf(alice), 1);
    }

    function test_mintExpert_mints_to_eoa_not_proxy() public {
        whitelist.register(alice, proxy_a);
        whitelist.mintExpert(proxy_a);

        // Token is owned by alice (EOA), not proxy_a
        assertEq(whitelist.ownerOf(1), alice);
        assertEq(whitelist.balanceOf(proxy_a), 0);
    }

    function test_mintExpert_only_owner() public {
        whitelist.register(alice, proxy_a);
        vm.prank(charlie);
        vm.expectRevert();
        whitelist.mintExpert(proxy_a);
    }

    // ─── Soulbound ───────────────────────────────────────────────────────────

    function test_soulbound_transfer_reverts() public {
        whitelist.register(alice, proxy_a);
        whitelist.mintExpert(proxy_a);

        vm.prank(alice);
        vm.expectRevert(ExpertWhitelist.Soulbound.selector);
        whitelist.transferFrom(alice, bob, 1);
    }

    // ─── getRegistered ───────────────────────────────────────────────────────

    function test_getRegistered_returns_matching_arrays() public {
        whitelist.register(alice, proxy_a);
        whitelist.register(bob, proxy_b);

        (address[] memory eoas, address[] memory proxies) = whitelist.getRegistered();

        assertEq(eoas.length, 2);
        assertEq(proxies.length, 2);
        assertEq(eoas[0], alice);
        assertEq(eoas[1], bob);
        assertEq(proxies[0], proxy_a);
        assertEq(proxies[1], proxy_b);
    }

    function test_getRegisteredProxies() public {
        whitelist.register(alice, proxy_a);
        whitelist.register(bob, proxy_b);

        address[] memory proxies = whitelist.getRegisteredProxies();
        assertEq(proxies.length, 2);
        assertEq(proxies[0], proxy_a);
        assertEq(proxies[1], proxy_b);
    }

    function test_multiple_experts_get_sequential_token_ids() public {
        whitelist.register(alice, proxy_a);
        whitelist.register(bob, proxy_b);
        whitelist.mintExpert(proxy_a);
        whitelist.mintExpert(proxy_b);

        assertEq(whitelist.ownerOf(1), alice);
        assertEq(whitelist.ownerOf(2), bob);
    }
}
