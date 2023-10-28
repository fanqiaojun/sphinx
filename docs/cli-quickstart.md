# Getting Started in a New Repository

This guide will show you how to setup Sphinx's Foundry CLI plugin in a fresh repository. We'll create a sample project, then test and deploy it locally.

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Update Foundry](#2-update-foundry)
3. [Create a new directory](#3-create-a-new-directory)
4. [Install dependencies](#4-install-dependencies)
5. [Initialize a project](#5-initialize-a-project)
6. [Generate clients](#6-generate-clients)
7. [Update your build command (optional)](#7-update-your-build-command-optional)
8. [Run the tests](#8-run-the-tests)
9. [Broadcast a deployment on Anvil (optional)](#9-broadcast-a-deployment-on-anvil-optional)
10. [Next steps](#10-next-steps)

## 1. Prerequisites

The following must be installed on your machine:
- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- [Yarn](https://classic.yarnpkg.com/lang/en/docs/install/), [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm), or [pnpm](https://pnpm.io/installation)

You must also have a basic understanding of how to use Foundry and Forge scripts. Here are the relevant guides in the Foundry docs:
* [Getting Started with Foundry](https://book.getfoundry.sh/getting-started/first-steps)
* [Writing Deployment Scripts with Foundry](https://book.getfoundry.sh/tutorials/solidity-scripting)

## 2. Update Foundry

Make sure you're using the latest version of Foundry.

```
foundryup
```

## 3. Create a new directory

First, navigate to a fresh directory.

Then, run:

```
mkdir hello_sphinx && cd hello_sphinx
```

## 4. Install dependencies

Install Sphinx, forge-std, and ds-test using your preferred package manager.

Yarn:
```
yarn add --dev @sphinx-labs/plugins https://github.com/foundry-rs/forge-std.git#v1.7.1 https://github.com/dapphub/ds-test.git#e282159d5170298eb2455a6c05280ab5a73a4ef0
```

npm:
```
npm install --save-dev @sphinx-labs/plugins https://github.com/foundry-rs/forge-std.git#v1.7.1 https://github.com/dapphub/ds-test.git#e282159d5170298eb2455a6c05280ab5a73a4ef0
```

pnpm:
```
pnpm add -D @sphinx-labs/plugins https://github.com/foundry-rs/forge-std.git#v1.7.1 https://github.com/dapphub/ds-test.git#e282159d5170298eb2455a6c05280ab5a73a4ef0
```

## 5. Initialize a project

```
npx sphinx init --quickstart
```

This command created a few files:
- `src/HelloSphinx.sol`: A sample contract to deploy.
- `test/HelloSphinx.t.sol`: A test file for the deployment.
- `script/HelloSphinx.s.sol`: A sample Sphinx deployment script.
- `foundry.toml`: The Foundry config file, which contains a few settings that are needed to run Sphinx.
- `.env`: A sample `.env` file that contains a valid private key on Anvil.

## 6. Generate clients

Sphinx currently only supports CREATE3 deployments.

To improve the UX of CREATE3 deployments, Sphinx autogenerates **clients**, which are thin wrappers over your contracts that provide type safety for your constructor arguments. You'll need to use clients when deploying your contracts.

Generate the clients with the command:

```
npx sphinx generate
```

This command writes the clients into a new `client` folder.

If you change the interface of one of your contract's constructors, you'll also need to re-run the `generate` command.

## 7. Update your build command (optional)

Follow this step if you plan to use a build command to compile your contracts (e.g. `yarn build`). Otherwise, skip to the next step.

You'll need to generate the Sphinx clients in your build command or else the compilation process will fail.

Copy and paste the following into your `package.json`:
```json
{
  "scripts": {
    "build": "npx sphinx generate"
  }
}
```

You can use the `sphinx generate` command as a drop-in replacement for `forge build`, since it runs this command under the hood.

## 8. Run the tests

Run the test file at `test/HelloSphinx.t.sol`:

```
forge test
```

## 9. Broadcast a deployment on Anvil (optional)

Sphinx has its own CLI task for broadcasting deployments onto stand-alone networks. This is useful for situations where you'd rather deploy using a funded private key from your local machine. For example, you may use this command to deploy your contracts onto Anvil when integrating your contracts with your front-end.


First, start an Anvil node:
```
anvil
```

Then, navigate to a new terminal window. Deploy using the command:

```
npx sphinx deploy ./script/HelloSphinx.s.sol --network anvil
```

You'll be shown a preview of your deployment and prompted to confirm. Any transactions that are broadcasted by Foundry will be included.

Once the deployment completes, you'll find the deployment artifacts written to `./deployments/anvil-31337.json`. Whenever a deployment is broadcasted, Sphinx will automatically generate deployment artifacts, which are in the same format as [`hardhat-deploy`](https://github.com/wighawag/hardhat-deploy).

When deploying on a live network, you can verify your contracts on block explorers using the `--verify` flag.

## 10. Next steps

Your next step is to follow the [Getting Started with the DevOps Platform](https://github.com/sphinx-labs/sphinx/blob/develop/docs/ops-getting-started.md) guide.