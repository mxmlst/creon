// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.13;

import {ReceiverTemplate} from "./interfaces/ReceiverTemplate.sol";

contract EntitlementRegistry is ReceiverTemplate {
    struct Entitlement {
        bool active;
        uint64 validFrom;
        uint64 validUntil; // 0 means no expiry
        uint32 maxUses; // 0 means unlimited
        uint32 uses;
        bytes32 metadataHash;
    }

    error ZeroBuyer();
    error InvalidKey();
    error EntitlementAlreadyActive();
    error EntitlementNotActive();
    error EntitlementExpired();
    error EntitlementUsesExceeded();
    error InvalidReport();

    event EntitlementGranted(
        bytes32 indexed merchantIdHash,
        address indexed buyer,
        bytes32 indexed productIdHash,
        bytes32 entitlementId,
        uint64 validFrom,
        uint64 validUntil,
        uint32 maxUses,
        bytes32 metadataHash
    );
    event EntitlementRevoked(bytes32 indexed merchantIdHash, address indexed buyer, bytes32 indexed productIdHash);
    event EntitlementUsed(
        bytes32 indexed merchantIdHash,
        address indexed buyer,
        bytes32 indexed productIdHash,
        bytes32 entitlementId,
        uint32 uses
    );
    event EntitlementReportNoop(uint8 indexed action, bytes32 indexed entitlementId);

    mapping(bytes32 merchantIdHash => mapping(address buyer => mapping(bytes32 productIdHash => Entitlement))) private
        _entitlements;

    uint8 private constant ACTION_GRANT = 1;
    uint8 private constant ACTION_REVOKE = 2;

    struct EntitlementGrant {
        bytes32 merchantIdHash;
        address buyer;
        bytes32 productIdHash;
        uint64 validUntil;
        uint32 maxUses;
        bytes32 metadataHash;
    }

    constructor(address forwarderAddress) ReceiverTemplate(forwarderAddress) {}

    function entitlementId(bytes32 merchantIdHash, address buyer, bytes32 productIdHash) public pure returns (bytes32) {
        return keccak256(abi.encode(merchantIdHash, buyer, productIdHash));
    }

    function grantEntitlement(
        bytes32 merchantIdHash,
        address buyer,
        bytes32 productIdHash,
        uint64 validUntil,
        uint32 maxUses,
        bytes32 metadataHash
    ) external returns (bytes32 id) {
        if (buyer == address(0)) revert ZeroBuyer();
        if (merchantIdHash == bytes32(0) || productIdHash == bytes32(0)) revert InvalidKey();

        Entitlement storage e = _entitlements[merchantIdHash][buyer][productIdHash];
        if (e.validFrom != 0 && e.active) revert EntitlementAlreadyActive();

        e.active = true;
        e.validFrom = uint64(block.timestamp);
        e.validUntil = validUntil;
        e.maxUses = maxUses;
        e.uses = 0;
        e.metadataHash = metadataHash;

        id = entitlementId(merchantIdHash, buyer, productIdHash);
        emit EntitlementGranted(merchantIdHash, buyer, productIdHash, id, e.validFrom, validUntil, maxUses, metadataHash);
    }

    function revokeEntitlement(bytes32 merchantIdHash, address buyer, bytes32 productIdHash) external {
        Entitlement storage e = _entitlements[merchantIdHash][buyer][productIdHash];
        if (!e.active) revert EntitlementNotActive();
        e.active = false;
        emit EntitlementRevoked(merchantIdHash, buyer, productIdHash);
    }

    function getEntitlement(bytes32 merchantIdHash, address buyer, bytes32 productIdHash)
        external
        view
        returns (
            bool active,
            uint64 validFrom,
            uint64 validUntil,
            uint32 maxUses,
            uint32 uses,
            bytes32 metadataHash
        )
    {
        Entitlement storage e = _entitlements[merchantIdHash][buyer][productIdHash];
        return (e.active, e.validFrom, e.validUntil, e.maxUses, e.uses, e.metadataHash);
    }

    function consumeEntitlement(bytes32 merchantIdHash, address buyer, bytes32 productIdHash)
        external
        returns (uint32 newUses)
    {
        Entitlement storage e = _entitlements[merchantIdHash][buyer][productIdHash];
        if (!e.active) revert EntitlementNotActive();
        if (e.validUntil != 0 && block.timestamp > e.validUntil) revert EntitlementExpired();
        if (e.maxUses != 0 && e.uses >= e.maxUses) revert EntitlementUsesExceeded();

        unchecked {
            e.uses += 1;
        }

        bytes32 id = entitlementId(merchantIdHash, buyer, productIdHash);
        emit EntitlementUsed(merchantIdHash, buyer, productIdHash, id, e.uses);
        return e.uses;
    }

    function _processReport(bytes calldata report) internal override {
        if (report.length < 1) revert InvalidReport();

        uint8 action = uint8(report[0]);
        bytes calldata payload = report[1:];

        if (action == ACTION_GRANT) {
            EntitlementGrant memory g = abi.decode(payload, (EntitlementGrant));
            _applyGrant(g);
            return;
        }

        if (action == ACTION_REVOKE) {
            (bytes32 merchantIdHash, address buyer, bytes32 productIdHash) = abi.decode(
                payload,
                (bytes32, address, bytes32)
            );
            _applyRevoke(merchantIdHash, buyer, productIdHash);
            return;
        }

        revert InvalidReport();
    }

    function _applyGrant(EntitlementGrant memory g) private {
        if (g.buyer == address(0)) revert ZeroBuyer();
        if (g.merchantIdHash == bytes32(0) || g.productIdHash == bytes32(0)) revert InvalidKey();

        Entitlement storage e = _entitlements[g.merchantIdHash][g.buyer][g.productIdHash];
        bytes32 id = entitlementId(g.merchantIdHash, g.buyer, g.productIdHash);

        if (e.active) {
            if (e.validUntil == g.validUntil && e.maxUses == g.maxUses && e.metadataHash == g.metadataHash) {
                emit EntitlementReportNoop(ACTION_GRANT, id);
                return;
            }
            revert EntitlementAlreadyActive();
        }

        e.active = true;
        e.validFrom = uint64(block.timestamp);
        e.validUntil = g.validUntil;
        e.maxUses = g.maxUses;
        e.uses = 0;
        e.metadataHash = g.metadataHash;

        emit EntitlementGranted(g.merchantIdHash, g.buyer, g.productIdHash, id, e.validFrom, g.validUntil, g.maxUses, g.metadataHash);
    }

    function _applyRevoke(bytes32 merchantIdHash, address buyer, bytes32 productIdHash) private {
        bytes32 id = entitlementId(merchantIdHash, buyer, productIdHash);
        Entitlement storage e = _entitlements[merchantIdHash][buyer][productIdHash];
        if (!e.active) {
            emit EntitlementReportNoop(ACTION_REVOKE, id);
            return;
        }
        e.active = false;
        emit EntitlementRevoked(merchantIdHash, buyer, productIdHash);
    }
}
