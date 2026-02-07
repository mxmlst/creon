// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {IReceiver} from "./IReceiver.sol";

abstract contract ReceiverTemplate is Ownable, IReceiver {
    address private s_forwarderAddress;
    bytes32 private s_workflowId;
    bytes10 private s_workflowName;
    address private s_workflowOwner;

    error InvalidSender(address sender, address forwarderAddress);
    error InvalidMetadata();
    error InvalidWorkflowId(bytes32 workflowId);
    error InvalidWorkflowName(bytes10 workflowName);
    error InvalidWorkflowOwner(address workflowOwner);
    error WorkflowNameRequiresWorkflowOwner();

    event ForwarderAddressSet(address indexed forwarderAddress);
    event WorkflowIdSet(bytes32 indexed workflowId);
    event WorkflowNameSet(bytes10 indexed workflowName);
    event WorkflowOwnerSet(address indexed workflowOwner);

    constructor(address forwarderAddress) Ownable(msg.sender) {
        if (forwarderAddress == address(0)) revert InvalidSender(forwarderAddress, forwarderAddress);
        s_forwarderAddress = forwarderAddress;
        emit ForwarderAddressSet(forwarderAddress);
    }

    function onReport(bytes calldata metadata, bytes calldata report) external override {
        if (msg.sender != s_forwarderAddress) revert InvalidSender(msg.sender, s_forwarderAddress);

        if (s_workflowId != bytes32(0) || s_workflowName != bytes10(0) || s_workflowOwner != address(0)) {
            (bytes32 workflowId, bytes10 workflowName, address workflowOwner) = _decodeMetadata(metadata);
            _validateMetadata(workflowId, workflowName, workflowOwner);
        }

        _processReport(report);
    }

    function setForwarderAddress(address forwarderAddress) external onlyOwner {
        // allowing 0 address is insecure, but it may be useful for local testing
        s_forwarderAddress = forwarderAddress;
        emit ForwarderAddressSet(forwarderAddress);
    }

    function setExpectedWorkflowId(bytes32 workflowId) external onlyOwner {
        s_workflowId = workflowId;
        emit WorkflowIdSet(workflowId);
    }

    function setExpectedWorkflowName(bytes10 workflowName) external onlyOwner {
        if (s_workflowOwner == address(0)) revert WorkflowNameRequiresWorkflowOwner();
        s_workflowName = workflowName;
        emit WorkflowNameSet(workflowName);
    }

    function setExpectedAuthor(address workflowOwner) external onlyOwner {
        s_workflowOwner = workflowOwner;
        emit WorkflowOwnerSet(workflowOwner);
    }

    function getForwarderAddress() external view returns (address) {
        return s_forwarderAddress;
    }

    function getWorkflowId() external view returns (bytes32) {
        return s_workflowId;
    }

    function getWorkflowName() external view returns (bytes10) {
        return s_workflowName;
    }

    function getWorkflowOwner() external view returns (address) {
        return s_workflowOwner;
    }

    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(IReceiver).interfaceId || interfaceId == type(IERC165).interfaceId;
    }

    function _decodeMetadata(bytes memory metadata)
        private
        pure
        returns (bytes32 workflowId, bytes10 workflowName, address workflowOwner)
    {
        if (metadata.length != 74) revert InvalidMetadata();

        assembly {
            workflowId := mload(add(metadata, 32))
            workflowName := mload(add(metadata, 64))
            workflowOwner := mload(add(metadata, 74))
        }
    }

    function _validateMetadata(bytes32 workflowId, bytes10 workflowName, address workflowOwner) private view {
        if (s_workflowId != bytes32(0) && s_workflowId != workflowId) revert InvalidWorkflowId(workflowId);
        if (s_workflowName != bytes10(0) && s_workflowName != workflowName) revert InvalidWorkflowName(workflowName);
        if (s_workflowOwner != address(0) && s_workflowOwner != workflowOwner) revert InvalidWorkflowOwner(workflowOwner);
    }

    function _processReport(bytes calldata report) internal virtual;
}
