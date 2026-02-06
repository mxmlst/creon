// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.13;

contract EntitlementRegistry {
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

    mapping(bytes32 merchantIdHash => mapping(address buyer => mapping(bytes32 productIdHash => Entitlement))) private
        _entitlements;

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
}

