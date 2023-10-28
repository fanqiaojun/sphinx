// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import { Script, console } from "sphinx-forge-std/Script.sol";
import { SphinxClient, SphinxConfig, Version } from "../client/SphinxClient.sol";
import { Network } from "../contracts/foundry/SphinxPluginTypes.sol";
import { MyContract1 } from "../contracts/test/MyContracts.sol";

contract Sample is Script, SphinxClient {

    MyContract1 myContract;

    function setUp() public {
        sphinxConfig.projectName = "My Project";
        sphinxConfig.owners = [0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266];
        sphinxConfig.threshold = 1;
        sphinxConfig.proposers = [0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266];
        sphinxConfig.testnets = [Network.goerli, Network.arbitrum_goerli];
        sphinxConfig.orgId = "asdf";
    }

    function run() public override sphinx {
        MyContract1 myClient = deployMyContract1(
            -1,
            2,
            address(1),
            address(2)
        );
        MyContract1.MyStruct memory myStruct = myClient.myPureFunction();
        myClient.set(myStruct.a);
        myClient.incrementUint();
        myClient.incrementUint();
        myClient.incrementUint();

        myContract = MyContract1(address(myClient));
        console.logInt(myContract.intArg());
    }
}