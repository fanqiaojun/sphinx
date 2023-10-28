// THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY
// SPDX-License-Identifier: MIT
pragma solidity >=0.7.4 <0.9.0;

import { Sphinx } from "@sphinx-labs/plugins/Sphinx.sol";
import { SphinxConfig, DeployOptions } from "@sphinx-labs/plugins/SphinxPluginTypes.sol";
import { ExecutorTest } from "contracts/ExecutorTest.sol";

abstract contract SphinxClient is Sphinx {
  function deployExecutorTest(
    uint8 _val
  ) internal returns (ExecutorTest) {
    return deployExecutorTest(
      _val,
      DeployOptions({ salt: bytes32(0), referenceName: "ExecutorTest" })
    );
  }

  function deployExecutorTest(
    uint8 _val,
    DeployOptions memory _sphinxInternalDeployOptions
  ) internal returns (ExecutorTest) {
    bytes memory sphinxInternalConstructorArgs = abi.encode(
      _val
    );
    return ExecutorTest(
      _sphinxDeployContract(
        _sphinxInternalDeployOptions.referenceName,
        _sphinxInternalDeployOptions.salt,
        sphinxInternalConstructorArgs,
        "contracts/ExecutorTest.sol:ExecutorTest",
        "ExecutorTest.sol:ExecutorTest"
      )
    );
  }
}