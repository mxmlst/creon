// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {EntitlementRegistry} from "../src/EntitlementRegistry.sol";

contract EntitlementRegistryTest is Test {
    EntitlementRegistry private registry;

    bytes32 private constant MERCHANT = keccak256("demo-merchant");
    bytes32 private constant PRODUCT = keccak256("article:42");
    address private constant BUYER = address(0x000000000000000000000000000000000000dEaD);

    function setUp() public {
        registry = new EntitlementRegistry();
    }

    function test_GrantAndGet() public {
        bytes32 id = registry.grantEntitlement(MERCHANT, BUYER, PRODUCT, 0, 0, bytes32(0));

        (bool active, uint64 validFrom,, uint32 maxUses, uint32 uses,) = registry.getEntitlement(MERCHANT, BUYER, PRODUCT);

        assertTrue(active);
        assertGt(validFrom, 0);
        assertEq(maxUses, 0);
        assertEq(uses, 0);
        assertEq(id, registry.entitlementId(MERCHANT, BUYER, PRODUCT));
    }

    function test_Revoke() public {
        registry.grantEntitlement(MERCHANT, BUYER, PRODUCT, 0, 0, bytes32(0));
        registry.revokeEntitlement(MERCHANT, BUYER, PRODUCT);

        (bool active,,,,,) = registry.getEntitlement(MERCHANT, BUYER, PRODUCT);
        assertFalse(active);
    }

    function test_ConsumeUnlimited() public {
        registry.grantEntitlement(MERCHANT, BUYER, PRODUCT, 0, 0, bytes32(0));
        assertEq(registry.consumeEntitlement(MERCHANT, BUYER, PRODUCT), 1);
        assertEq(registry.consumeEntitlement(MERCHANT, BUYER, PRODUCT), 2);
    }

    function test_ConsumeUsageLimited() public {
        registry.grantEntitlement(MERCHANT, BUYER, PRODUCT, 0, 2, bytes32(0));
        assertEq(registry.consumeEntitlement(MERCHANT, BUYER, PRODUCT), 1);
        assertEq(registry.consumeEntitlement(MERCHANT, BUYER, PRODUCT), 2);

        vm.expectRevert(EntitlementRegistry.EntitlementUsesExceeded.selector);
        registry.consumeEntitlement(MERCHANT, BUYER, PRODUCT);
    }

    function test_ConsumeExpired() public {
        uint64 validUntil = uint64(block.timestamp + 10);
        registry.grantEntitlement(MERCHANT, BUYER, PRODUCT, validUntil, 0, bytes32(0));

        vm.warp(block.timestamp + 11);
        vm.expectRevert(EntitlementRegistry.EntitlementExpired.selector);
        registry.consumeEntitlement(MERCHANT, BUYER, PRODUCT);
    }
}

