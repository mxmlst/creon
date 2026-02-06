// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.13;

import {Script} from "forge-std/Script.sol";
import {EntitlementRegistry} from "../src/EntitlementRegistry.sol";

contract DeployEntitlementRegistry is Script {
    function run() external returns (EntitlementRegistry deployed) {
        vm.startBroadcast();
        deployed = new EntitlementRegistry();
        vm.stopBroadcast();
    }
}

