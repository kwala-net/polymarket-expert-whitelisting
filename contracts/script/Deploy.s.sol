// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/ExpertWhitelist.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        console.log("Deploying ExpertWhitelist from:", deployer);

        vm.startBroadcast(deployerKey);
        ExpertWhitelist whitelist = new ExpertWhitelist();
        vm.stopBroadcast();

        console.log("ExpertWhitelist deployed at:", address(whitelist));
        console.log("Owner (backend signer):", whitelist.owner());
    }
}
