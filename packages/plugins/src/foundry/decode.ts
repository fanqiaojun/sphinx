import {
  isLabel,
  isRawCreate2ActionInput,
  isRawFunctionCallActionInput,
  isString,
  ActionInput,
  ConfigArtifacts,
  DeploymentInfo,
  FunctionCallActionInput,
  Label,
  ParsedConfig,
  RawActionInput,
  RawCreate2ActionInput,
  RawFunctionCallActionInput,
  SphinxActionType,
  networkEnumToName,
  assertValidProjectName,
  getCurrentGitCommitHash,
  ParsedContractDeployment,
} from '@sphinx-labs/core'
import { AbiCoder, ethers } from 'ethers'
import {
  CREATE3_PROXY_INITCODE,
  DETERMINISTIC_DEPLOYMENT_PROXY_ADDRESS,
  Operation,
  recursivelyConvertResult,
} from '@sphinx-labs/contracts'

import { FoundrySingleChainDryRun } from './types'
import {
  convertLibraryFormat,
  findFunctionFragment,
  getConfigArtifactForContractName,
} from './utils'

export const decodeDeploymentInfo = (
  abiEncodedDeploymentInfo: string,
  sphinxPluginTypesInterface: ethers.Interface
): DeploymentInfo => {
  const deploymentInfoFragment = findFunctionFragment(
    sphinxPluginTypesInterface,
    'getDeploymentInfo'
  )

  const deploymentInfoResult = AbiCoder.defaultAbiCoder().decode(
    deploymentInfoFragment.outputs,
    abiEncodedDeploymentInfo
  )

  const { deploymentInfo: deploymentInfoBigInt } = recursivelyConvertResult(
    deploymentInfoFragment.outputs,
    deploymentInfoResult
  ) as any

  const {
    safeAddress,
    moduleAddress,
    executorAddress,
    nonce,
    chainId,
    blockGasLimit,
    initialState,
    executionMode,
    newConfig,
    labels,
    requireSuccess,
    safeInitData,
    arbitraryChain,
  } = deploymentInfoBigInt

  const deploymentInfo: DeploymentInfo = {
    labels,
    safeAddress,
    moduleAddress,
    safeInitData,
    executorAddress,
    requireSuccess,
    nonce: nonce.toString(),
    chainId: chainId.toString(),
    blockGasLimit: blockGasLimit.toString(),
    initialState: {
      ...initialState,
    },
    executionMode: Number(executionMode),
    newConfig: {
      ...newConfig,
      testnets: newConfig.testnets.map(networkEnumToName),
      mainnets: newConfig.mainnets.map(networkEnumToName),
      threshold: newConfig.threshold.toString(),
      saltNonce: newConfig.saltNonce.toString(),
    },
    arbitraryChain,
  }

  assertValidProjectName(deploymentInfo.newConfig.projectName)

  return deploymentInfo
}

export const convertFoundryDryRunToActionInputs = (
  deploymentInfo: DeploymentInfo,
  dryRun: FoundrySingleChainDryRun,
  dryRunPath: string
): Array<RawActionInput> => {
  const notFromGnosisSafe = dryRun.transactions
    .map((t) => t.transaction.from)
    .filter(isString)
    .filter(
      (from) =>
        // Convert the 'from' field to a checksum address.
        ethers.getAddress(from) !== deploymentInfo.safeAddress
    )
  if (notFromGnosisSafe.length > 0) {
    // The user must broadcast/prank from the Gnosis Safe so that the msg.sender for function calls
    // is the same as it would be in a production deployment.
    throw new Error(
      `Sphinx: Detected transaction(s) in the deployment that weren't sent by the user's Safe contracti.\n` +
        `The 'run()' function must have the 'sphinx' modifier and cannot contain any pranks or broadcasts.\n`
    )
  }

  const actionInputs: Array<RawActionInput> = []
  for (const {
    transaction,
    contractName,
    transactionType,
    additionalContracts,
    arguments: callArguments,
    function: functionName,
  } of dryRun.transactions) {
    const contractNameWithoutPath = contractName?.includes(':')
      ? contractName.split(':')[1]
      : contractName

    if (transaction.value !== undefined && transaction.value !== '0x0') {
      console.error(
        `Sphinx does not support sending ETH during deployments. Let us know if you want this feature!`
      )
      process.exit(1)
    }

    if (transactionType === 'CREATE') {
      console.error(
        `Sphinx does not support the 'CREATE' opcode, i.e. 'new MyContract(...)'. Please use CREATE2 or CREATE3 instead.`
      )
      process.exit(1)
    } else {
      if (!transaction.to) {
        throw new Error(
          `Transaction does not have the 'to' field. Should never happen.`
        )
      }

      const to = ethers.getAddress(transaction.to)
      if (transactionType === 'CREATE2') {
        if (to !== DETERMINISTIC_DEPLOYMENT_PROXY_ADDRESS) {
          console.error(
            `Detected unsupported CREATE2 factory. Please use the standard factory at: 0x4e59b44847b379578588920cA78FbF26c0B4956C`
          )
          process.exit(1)
        }

        if (!transaction.data || !transaction.gas) {
          throw new Error(
            `CREATE2 transaction is missing field(s). Should never happen.`
          )
        }

        const salt = ethers.dataSlice(transaction.data, 0, 32)
        const initCodeWithArgs = ethers.dataSlice(transaction.data, 32)
        const create2Address = ethers.getCreate2Address(
          to,
          salt,
          ethers.keccak256(initCodeWithArgs)
        )

        const rawCreate2: RawCreate2ActionInput = {
          to,
          create2Address,
          contractName,
          value: transaction.value ?? '0x0',
          operation: Operation.Call,
          txData: transaction.data,
          initCodeWithArgs,
          actionType: SphinxActionType.CALL.toString(),
          gas: transaction.gas,
          additionalContracts,
          requireSuccess: deploymentInfo.requireSuccess,
          decodedAction: {
            referenceName: contractNameWithoutPath ?? create2Address,
            functionName: 'deploy',
            variables: callArguments ?? [],
            address: create2Address,
          },
        }
        actionInputs.push(rawCreate2)
      } else if (transactionType === 'CALL') {
        if (!transaction.data || !transaction.gas) {
          throw new Error(
            `CALL transaction is missing field(s). Should never happen.`
          )
        }

        const variables = callArguments ?? [
          transaction.data.length > 1000
            ? `Very large calldata. View it in Foundry's dry run file: ${dryRunPath}`
            : transaction.data,
        ]

        const rawCall: RawFunctionCallActionInput = {
          actionType: SphinxActionType.CALL.toString(),
          to,
          value: transaction.value ?? '0x0',
          txData: transaction.data,
          operation: Operation.Call,
          gas: transaction.gas,
          contractName,
          additionalContracts,
          requireSuccess: deploymentInfo.requireSuccess,
          decodedAction: {
            referenceName:
              contractNameWithoutPath ?? ethers.getAddress(transaction.to),
            functionName: functionName?.split('(')[0] ?? 'call',
            variables,
            address: contractNameWithoutPath !== null ? to : '',
          },
        }

        actionInputs.push(rawCall)
      } else {
        throw new Error(`Unknown transaction type: ${transactionType}.`)
      }
    }
  }

  return actionInputs
}

export const makeParsedConfig = (
  deploymentInfo: DeploymentInfo,
  rawInputs: Array<RawActionInput>,
  gasEstimates: Array<string>,
  isSystemDeployed: boolean,
  configArtifacts: ConfigArtifacts,
  libraries: Array<string>
): ParsedConfig => {
  const {
    safeAddress,
    moduleAddress,
    nonce,
    chainId,
    blockGasLimit,
    newConfig,
    executionMode,
    initialState,
    labels,
    safeInitData,
    arbitraryChain,
  } = deploymentInfo

  // Each Merkle leaf must have a gas amount that's at most 80% of the block gas limit. This ensures
  // that it's possible to execute the transaction on-chain. Specifically, there must be enough gas
  // to execute the Sphinx Module's logic, which isn't included in the gas estimate of the Merkle
  // leaf. The 80% was chosen arbitrarily.
  const maxAllowedGasPerLeaf = (BigInt(8) * BigInt(blockGasLimit)) / BigInt(10)

  const parsedActionInputs: Array<ActionInput> = []
  const unlabeledAddresses: Array<string> = []
  // We start with an action index of 1 because the `APPROVE` leaf always has an index of 0, which
  // means the `EXECUTE` leaves start with an index of 1.
  let actionIndex = 1
  for (let i = 0; i < rawInputs.length; i++) {
    const input = rawInputs[i]
    const gas = gasEstimates[i]

    if (BigInt(gas) > maxAllowedGasPerLeaf) {
      throw new Error(
        `Estimated gas for a transaction is too close to the block gas limit.`
      )
    }

    const { parsedContracts, unlabeledAdditionalContracts } =
      parseAdditionalContracts(input, rawInputs, labels, configArtifacts)
    unlabeledAddresses.push(...unlabeledAdditionalContracts)

    if (isRawCreate2ActionInput(input)) {
      // Get the creation code of the CREATE2 deployment by removing the salt,
      // which is the first 32 bytes of the data.
      const initCodeWithArgs = ethers.dataSlice(input.txData, 32)

      // Check if the contract is a CREATE3 proxy. If it is, we won't attempt to verify it because
      // it doesn't have its own source file in any commonly used CREATE3 library.
      if (initCodeWithArgs !== CREATE3_PROXY_INITCODE) {
        // Check if the `contractName` is a fully qualified name.
        if (input.contractName && input.contractName.includes(':')) {
          // It's a fully qualified name.

          const fullyQualifiedName = input.contractName

          parsedContracts.push({
            address: input.create2Address,
            fullyQualifiedName,
            initCodeWithArgs,
          })
        } else if (
          // Check if the `contractName` is a standard contract name (not a fully qualified name).
          input.contractName
        ) {
          const { fullyQualifiedName } = getConfigArtifactForContractName(
            input.contractName,
            configArtifacts
          )

          parsedContracts.push({
            address: input.create2Address,
            fullyQualifiedName,
            initCodeWithArgs,
          })
        } else {
          // There's no contract name in this CREATE2 transaction.
          const label = labels.find((l) => l.addr === input.create2Address)
          if (isLabel(label)) {
            parsedContracts.push({
              address: input.create2Address,
              fullyQualifiedName: label.fullyQualifiedName,
              initCodeWithArgs,
            })

            const contractName = label.fullyQualifiedName.split(':')[1]
            input.decodedAction = {
              referenceName: contractName,
              functionName: 'deploy',
              variables: {
                initCode: initCodeWithArgs,
              },
              address: '',
            }
          } else {
            // Attempt to infer the name of the contract deployed using CREATE2. We may need to do this
            // if the contract name isn't unique in the repo. This is likely a bug in Foundry.
            const contractName = rawInputs
              .filter(isRawFunctionCallActionInput)
              .filter((e) => e.to === input.create2Address)
              .map((e) => e.contractName)
              .find(isString)
            if (contractName) {
              const fullyQualifiedName = contractName.includes(':')
                ? contractName
                : getConfigArtifactForContractName(
                    contractName,
                    configArtifacts
                  ).fullyQualifiedName

              parsedContracts.push({
                address: input.create2Address,
                fullyQualifiedName,
                initCodeWithArgs,
              })

              input.decodedAction = {
                referenceName: fullyQualifiedName.split(':')[1],
                functionName: 'deploy',
                variables: [
                  {
                    initCode: initCodeWithArgs,
                  },
                ],
                address: '',
              }
            } else {
              unlabeledAddresses.push(input.create2Address)
            }
          }
        }
      }

      parsedActionInputs.push({
        contracts: parsedContracts,
        index: actionIndex.toString(),
        ...input,
        gas,
      })
    } else if (isRawFunctionCallActionInput(input)) {
      const callInput: FunctionCallActionInput = {
        contracts: parsedContracts,
        index: actionIndex.toString(),
        ...input,
        gas,
      }

      parsedActionInputs.push(callInput)
    } else {
      throw new Error(`Unknown action input type. Should never happen.`)
    }
    actionIndex += 1
  }

  const parsedConfig: ParsedConfig = {
    safeAddress,
    moduleAddress,
    safeInitData,
    nonce,
    chainId,
    blockGasLimit,
    newConfig,
    executionMode,
    initialState,
    isSystemDeployed,
    actionInputs: parsedActionInputs,
    unlabeledAddresses,
    arbitraryChain,
    executorAddress: deploymentInfo.executorAddress,
    libraries: convertLibraryFormat(libraries),
    gitCommit: getCurrentGitCommitHash(),
  }

  return parsedConfig
}

const parseAdditionalContracts = (
  currentInput: RawActionInput,
  allInputs: Array<RawActionInput>,
  labels: Array<Label>,
  configArtifacts: ConfigArtifacts
): {
  parsedContracts: Array<ParsedContractDeployment>
  unlabeledAdditionalContracts: Array<string>
} => {
  const parsedContracts: Array<ParsedContractDeployment> = []
  const unlabeled: Array<string> = []
  for (const additionalContract of currentInput.additionalContracts) {
    const address = ethers.getAddress(additionalContract.address)

    const label = labels.find((l) => l.addr === address)
    if (isLabel(label)) {
      if (label.fullyQualifiedName !== '') {
        parsedContracts.push({
          address,
          fullyQualifiedName: label.fullyQualifiedName,
          initCodeWithArgs: additionalContract.initCode,
        })
      }
    } else if (
      // Check if the current transaction is a call to deploy a contract using CREATE3. CREATE3
      // transactions are 'CALL' types where the 'data' field of the transaction is equal to the
      // contract's creation code. This transaction happens when calling the minimal CREATE3 proxy.
      isRawFunctionCallActionInput(currentInput) &&
      currentInput.txData === additionalContract.initCode
    ) {
      // We'll attempt to infer the name of the contract that was deployed using CREATE3.
      const contractName = allInputs
        .filter(isRawFunctionCallActionInput)
        .filter((e) => e.to === address)
        .map((e) => e.contractName)
        .find(isString)

      if (contractName) {
        const fullyQualifiedName = contractName.includes(':')
          ? contractName
          : getConfigArtifactForContractName(contractName, configArtifacts)
              .fullyQualifiedName

        parsedContracts.push({
          address,
          fullyQualifiedName,
          initCodeWithArgs: additionalContract.initCode,
        })
      } else {
        unlabeled.push(address)
      }
    } else {
      unlabeled.push(address)
    }
  }

  return {
    parsedContracts,
    unlabeledAdditionalContracts: unlabeled,
  }
}
