# Godji Game NFT & Crowdsale

![CI status](https://github.com/nkrivenko/eosio-proxy-service/actions/workflows/pipeline.yml/badge.svg)
[![Coverage Status](https://coveralls.io/repos/github/nkrivenko/godji-nft-collection/badge.svg?branch=master)](https://coveralls.io/github/nkrivenko/godji-nft-collection?branch=master)
[![Collection Address](https://badgen.net/badge/Collection%20Address/0xf3c959830be64aaa6b0010687e7c8eb1f906fc60/blue)](https://opensea.io/collection/godji-game-genesis-avatars)
[![Crowdsale Address](https://badgen.net/badge/Crowdsale%20Address/0xb8a5bf69Afb311c4399AECB6419f9288D35d2595/blue)](https://polygonscan.com/address/0xb8a5bf69afb311c4399aecb6419f9288d35d2595#code)


## Summary

The project contains the code base for the [Godji Game Genesis Avatars](https://opensea.io/collection/godji-game-genesis-avatars) NFT collection and its initial crowdsale.

The Godji Game Genesis Avatars are ERC721-compatible tokens.

The crowdsale contract gives an opportunity to buy the avatars for ERC20 tokens.

## Collection

The collection smart contract is located at *contracts/GodjiGameAvatar.sol*

The collection implements the ERC721 interface with some extensions. First of all, an owner cannot transfer tokens before the presale step is finished. The collection contract also implements the transparent proxy upgrade pattern.

The collection also defines the development team and the project team and allows to premint some avatars to the wallets of these teams. The contract defines two roles: *ADMIN* and *MINTER*. Addresses with *ADMIN* role can add and remove *MINTER*s, finish the presale step, and set the metadata URI. Addresses with the *MINTER* role can mint tokens to the given address.

The collection has the upper limit of elements.

## Crowdsale

The crowdsale smart contract is located at *contracts/GodjiGameAvatarCrowdsale.sol*.

The crowdsale contract allows purchasing the NFTs for ERC20 tokens. Two conditions should be met in order to purchase avatars:

- The crowdsale contract should have the *MINTER* role in the collection contract
- The buyer has to approve the spending for the crowdsale contract.

The crowdsale contract also implements the overall crowdsale round cap and per-address cap. The user cannot purchase more than the amount of the per-address cap on a single address.

## How to use

Test
> `npx hardhat test`

Measure test coverage
> `npx hardhat coverage`

### Deployment

To deploy the contract to (public) network you should create the .env file in project root directory. The following properties should be defined:
- `POLYGONSCAN_API_KEY` - API KEY from polygonscan
- `PRIVATE_KEY` - Deployer account private key

Deploy to Mumbai test network
> `npx hardhat run scripts/deploy.ts --network mumbai`

Deploy to Polygon Mainnet
> `npx hardhat run scripts/deploy.ts --network matic`
