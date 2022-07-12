import { ethers, upgrades, web3 } from "hardhat";

const NAME = 'GODJI GAME Genesis Avatars';
const TICKER = 'GGA';
const METADATA_URI = 'ipfs://bafybeiauot55t4zyf4mh4blh5zc2smk3ywbw34xemcy2izewafw4q5a7vq/';
const RATE = '80000000';
const CAP = '2000';
const MAX_PER_ADDRESS = '3';
const MINTER_ROLE = web3.utils.soliditySha3('MINTER_ROLE');

async function main() {
  const usdcContract = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
  const devAddress = '0xE4F127199BD02c97a0021D1232ad62A518A24dD8';
  const teamAddress = '0xAC04da80645Ca025ef4E512C485498F4Dad003DF';

  const GodjiGameAvatar = await ethers.getContractFactory("GodjiGameAvatar");
  const nftContract = await upgrades.deployProxy(GodjiGameAvatar, [NAME, TICKER, METADATA_URI, teamAddress, devAddress]);

  await nftContract.deployed().then(async nft => {
    console.log("Upgradeable NFT contract deployed at", nft.address);

    const GodjiGameAvatarCrowdsale = await ethers.getContractFactory("GodjiGameAvatarCrowdsale");
    const crowdsaleContract = await GodjiGameAvatarCrowdsale.deploy(usdcContract, nft.address, RATE, teamAddress, CAP, MAX_PER_ADDRESS);

    return crowdsaleContract.deployed();
  }).then(crowdsale => {
    console.log("NFT crowdsale contract deployed at", crowdsale.address);  
    nftContract.grantRole(MINTER_ROLE, crowdsale.address);
  });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
