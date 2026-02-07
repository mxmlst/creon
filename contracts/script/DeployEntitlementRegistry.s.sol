// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.13;

import {Script} from "forge-std/Script.sol";
import {EntitlementRegistry} from "../src/EntitlementRegistry.sol";

contract DeployEntitlementRegistry is Script {
    function run() external returns (EntitlementRegistry deployed) {
        address forwarder = vm.envOr("CRE_FORWARDER_ADDRESS", address(0xF8344CFd5c43616a4366C34E3EEE75af79a74482));
        vm.startBroadcast();
        deployed = new EntitlementRegistry(forwarder);
        vm.stopBroadcast();
    }
}
