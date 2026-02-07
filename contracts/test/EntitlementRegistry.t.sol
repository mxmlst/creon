// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {EntitlementRegistry} from "../src/EntitlementRegistry.sol";
import {IReceiver} from "../src/interfaces/IReceiver.sol";
import {ReceiverTemplate} from "../src/interfaces/ReceiverTemplate.sol";

contract MockKeystoneForwarder {
    function deliver(address receiver, bytes calldata metadata, bytes calldata report) external {
        IReceiver(receiver).onReport(metadata, report);
    }
}

contract EntitlementRegistryTest is Test {
    EntitlementRegistry private registry;
    MockKeystoneForwarder private forwarder;

    bytes32 private constant MERCHANT = keccak256("demo-merchant");
    bytes32 private constant PRODUCT = keccak256("article:42");
    address private constant BUYER = address(0x000000000000000000000000000000000000dEaD);

    function setUp() public {
        forwarder = new MockKeystoneForwarder();
        registry = new EntitlementRegistry(address(forwarder));
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

    function test_OnReport_RevertsIfNotForwarder() public {
        bytes memory metadata = abi.encodePacked(bytes32(0), bytes10(0), address(0));
        bytes memory report = abi.encodePacked(uint8(1), abi.encode(MERCHANT, BUYER, PRODUCT, uint64(0), uint32(0), bytes32(0)));

        vm.expectRevert(abi.encodeWithSelector(ReceiverTemplate.InvalidSender.selector, address(this), address(forwarder)));
        registry.onReport(metadata, report);
    }

    function test_OnReport_Grant_IsIdempotentWhenSame() public {
        bytes memory metadata = abi.encodePacked(bytes32(0), bytes10(0), address(0));
        bytes memory report = abi.encodePacked(uint8(1), abi.encode(MERCHANT, BUYER, PRODUCT, uint64(0), uint32(2), bytes32(uint256(123))));

        forwarder.deliver(address(registry), metadata, report);
        forwarder.deliver(address(registry), metadata, report);

        (bool active,, uint64 validUntil, uint32 maxUses, uint32 uses, bytes32 metadataHash) = registry.getEntitlement(MERCHANT, BUYER, PRODUCT);
        assertTrue(active);
        assertEq(validUntil, 0);
        assertEq(maxUses, 2);
        assertEq(uses, 0);
        assertEq(metadataHash, bytes32(uint256(123)));
    }

    function test_OnReport_Grant_RevertsWhenDifferent() public {
        bytes memory metadata = abi.encodePacked(bytes32(0), bytes10(0), address(0));
        bytes memory reportA = abi.encodePacked(uint8(1), abi.encode(MERCHANT, BUYER, PRODUCT, uint64(0), uint32(2), bytes32(uint256(123))));
        bytes memory reportB = abi.encodePacked(uint8(1), abi.encode(MERCHANT, BUYER, PRODUCT, uint64(0), uint32(3), bytes32(uint256(123))));

        forwarder.deliver(address(registry), metadata, reportA);

        vm.expectRevert(EntitlementRegistry.EntitlementAlreadyActive.selector);
        forwarder.deliver(address(registry), metadata, reportB);
    }

    function test_OnReport_Revoke_IsNoopWhenInactive() public {
        bytes memory metadata = abi.encodePacked(bytes32(0), bytes10(0), address(0));
        bytes memory revokeReport = abi.encodePacked(uint8(2), abi.encode(MERCHANT, BUYER, PRODUCT));

        forwarder.deliver(address(registry), metadata, revokeReport);
        (bool active,,,,,) = registry.getEntitlement(MERCHANT, BUYER, PRODUCT);
        assertFalse(active);
    }
}
