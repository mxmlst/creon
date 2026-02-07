## Foundry

**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**

## Creon contracts

- `src/EntitlementRegistry.sol` is the onchain source of truth for “who owns what”.
- It implements the Chainlink CRE receiver pattern (`IReceiver.onReport`) via `src/interfaces/ReceiverTemplate.sol`.

### CRE receiver integration

`EntitlementRegistry` accepts reports only from a configured **KeystoneForwarder** address (passed to the constructor).
Optionally, the owner can pin an expected workflow id/name/owner via `setExpectedWorkflowId`,
`setExpectedWorkflowName`, and `setExpectedAuthor`.

Metadata encoding expected by `ReceiverTemplate` is:

- `abi.encodePacked(bytes32 workflowId, bytes10 workflowName, address workflowOwner)` (74 bytes)

Report encoding expected by `EntitlementRegistry` is:

- first byte `action`
  - `1` = grant entitlement (payload: `EntitlementGrant`)
  - `2` = revoke entitlement (payload: `(bytes32 merchantIdHash, address buyer, bytes32 productIdHash)`)

Foundry consists of:

- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
- **Chisel**: Fast, utilitarian, and verbose solidity REPL.

## Documentation

https://book.getfoundry.sh/

## Usage

### Build

```shell
$ forge build
```

### Test

```shell
$ forge test
```

### Format

```shell
$ forge fmt
```

### Gas Snapshots

```shell
$ forge snapshot
```

### Anvil

```shell
$ anvil
```

### Deploy

```shell
$ export CRE_FORWARDER_ADDRESS=0xF8344CFd5c43616a4366C34E3EEE75af79a74482
$ forge script script/DeployEntitlementRegistry.s.sol:DeployEntitlementRegistry --rpc-url <your_rpc_url> --broadcast
```

### Cast

```shell
$ cast <subcommand>
```

### Help

```shell
$ forge --help
$ anvil --help
$ cast --help
```
