// @ts-nocheck

import { ethers, upgrades, web3 } from "hardhat";
import { expect } from "chai";
import { constants } from "@openzeppelin/test-helpers";

const MINTER_ROLE = web3.utils.soliditySha3('MINTER_ROLE');
const INIT_IPFS_URL = 'https://ipfs.io/ipfs/QmNoHTHHbZcMzxxiWYPqz8aEpvqdJzSZ1DUZYDVj7TWZD6/metadata/';
const NAME = "Godji Game Avatar";
const SYMBOL = "GGA";

const expectRevert = async (promise: Promise<Any>, message: string) => expect(promise).to.be.revertedWith(message);

describe("GodjiGameAvatarCrowdsale", function () {

  const RATE = '80000000';
  const CAP = '2000';
  const MAX_PER_ADDRESS = '3';

  beforeEach(async () => {

    [this.investor, this.wallet, this.buyer, this.team, this.dev] = await ethers.getSigners();

    const GodjiGameAvatarCrowdsale = await ethers.getContractFactory("GodjiGameAvatarCrowdsale");
    const GodjiGameAvatar = await ethers.getContractFactory("GodjiGameAvatar");
    const ERC20Token = await ethers.getContractFactory("SimpleErc20Token");

    this.token = await ERC20Token.deploy();
    this.nft = await upgrades.deployProxy(GodjiGameAvatar, [NAME, SYMBOL, INIT_IPFS_URL, await this.team.getAddress(), await this.dev.getAddress()]);

    this.crowdsale = await GodjiGameAvatarCrowdsale.deploy(this.token.address, this.nft.address, RATE, await this.wallet.getAddress(), CAP, MAX_PER_ADDRESS);

    await this.token.mint(this.buyer.getAddress(), ethers.BigNumber.from(RATE).mul('1000'));
    await this.nft.grantRole(MINTER_ROLE, this.crowdsale.address);
  });

  describe('create contract', () => {

    beforeEach(async () => {
        this.GodjiGameAvatarCrowdsale = await ethers.getContractFactory("GodjiGameAvatarCrowdsale");
    });

    it('should create crowdsale with correct parameters', async () => {
        expect(RATE).to.equal(await this.crowdsale.rate());
        expect(CAP).to.equal(await this.crowdsale.cap());
        expect(MAX_PER_ADDRESS).to.equal(await this.crowdsale.maxNftsPerAddress());
        expect(await this.wallet.getAddress()).to.equal(await this.crowdsale.wallet());
    
        expect(this.token.address).to.equal(await this.crowdsale.token());
        expect(this.nft.address).to.equal(await this.crowdsale.nft());
    });

    it('should not create crowdsale with zero wallet address', async () => {
        await expectRevert(this.GodjiGameAvatarCrowdsale.deploy(this.token.address, this.nft.address, RATE, constants.ZERO_ADDRESS, CAP, MAX_PER_ADDRESS), "GGAC: wallet must not be zero");
    });
  
    it('should not create crowdsale with zero rate', async () => {
        const wallet = await this.wallet.getAddress();
        const creationPromise = this.GodjiGameAvatarCrowdsale.deploy(this.token.address, this.nft.address, 0, wallet, CAP, MAX_PER_ADDRESS);
        await expectRevert(creationPromise, "GGAC: rate must be positive");
    });

    it('should not create crowdsale with zero minting cap', async () => {
        const wallet = await this.wallet.getAddress();
        const creationPromise = this.GodjiGameAvatarCrowdsale.deploy(this.token.address, this.nft.address, RATE, wallet, 0, MAX_PER_ADDRESS);
        await expectRevert(creationPromise, "GGAC: cap must be positive");
    });

    it('should not create crowdsale with zero per-address minting cap', async () => {
        const wallet = await this.wallet.getAddress();
        const creationPromise = this.GodjiGameAvatarCrowdsale.deploy(this.token.address, this.nft.address, RATE, wallet, CAP, 0);
        await expectRevert(creationPromise, "GGAC: max nfts per address must be positive");
    });
  });

  describe('buying process', () => {
    it('should sell NFTs for tokens', async () => {
        const oldBalance = await this.nft.balanceOf(this.buyer.getAddress());
        const oldWalletErc20Balance = await this.token.balanceOf(this.wallet.getAddress());
    
        await this.token.connect(this.buyer).approve(this.crowdsale.address, RATE);
        await this.crowdsale.connect(this.buyer).transferAndBuy(1);
    
        const balanceDiff = (await this.nft.balanceOf(this.buyer.getAddress())).sub(oldBalance);
        const newWalletErc20Balance = await this.token.balanceOf(this.wallet.getAddress());
    
        expect(balanceDiff).to.equal(1);
        expect(newWalletErc20Balance).to.equal(oldWalletErc20Balance + RATE);
      });
    
      it('should mint multiple tokens', async () => {
        const tokenAmount = 2;
    
        const oldBalance = await this.nft.balanceOf(this.buyer.getAddress());
        const oldWalletErc20Balance = await this.token.balanceOf(this.wallet.getAddress());
    
        await this.token.connect(this.buyer).approve(this.crowdsale.address, RATE * tokenAmount);
        await this.crowdsale.connect(this.buyer).transferAndBuy(tokenAmount);
    
        const balanceDiff = (await this.nft.balanceOf(this.buyer.getAddress())).sub(oldBalance);
        const newWalletErc20Balance = await this.token.balanceOf(this.wallet.getAddress());
    
        expect(balanceDiff).to.equal(tokenAmount);
        expect(newWalletErc20Balance).to.equal(oldWalletErc20Balance + RATE * tokenAmount);
      });
    
      it('should mint maximum tokens', async () => {
        const oldBalance = await this.nft.balanceOf(this.buyer.getAddress());
    
        await this.token.connect(this.buyer).approve(this.crowdsale.address, RATE * MAX_PER_ADDRESS);
        await this.crowdsale.connect(this.buyer).transferAndBuy(MAX_PER_ADDRESS);
    
        const balanceDiff = (await this.nft.balanceOf(this.buyer.getAddress())).sub(oldBalance);
        expect(balanceDiff).to.equal(MAX_PER_ADDRESS);
      });
      
      it('should update minted tokens amount', async () => {
        const mintedAmountBeforePurchase = await this.crowdsale.totalMinted();

        await this.token.connect(this.buyer).approve(this.crowdsale.address, RATE * MAX_PER_ADDRESS)
            .then(_ => this.crowdsale.connect(this.buyer).transferAndBuy(MAX_PER_ADDRESS));

        const mintedAmountAfterPurchase = await this.crowdsale.totalMinted();

        expect(mintedAmountAfterPurchase).to.equal(mintedAmountBeforePurchase + MAX_PER_ADDRESS);
      });

      it('should not allow to purchase zero NFTs', async () => {
        const purchasePromise = this.crowdsale.connect(this.buyer).transferAndBuy(0);

        await expectRevert(purchasePromise, "GGAC: amount must be positive");
      });
  });

  describe('round minting constraints', () => {
    it('should not mint if more than max per address', async () => {
      await this.token.connect(this.buyer).approve(this.crowdsale.address, RATE * (MAX_PER_ADDRESS + 1));
    
      await expectRevert(this.crowdsale.connect(this.buyer).transferAndBuy(MAX_PER_ADDRESS + 1), 'GGAC: per-user cap reached');
    });

    it('should return the amount of NFT purchased by user in this round', async () => {
        await this.token.connect(this.buyer).approve(this.crowdsale.address, RATE);
    
        const purchasedAmountBeforePurchase = await this.crowdsale.boughtAmountOf(this.buyer.getAddress());
        await this.crowdsale.connect(this.buyer).transferAndBuy(1);
        const purchasedAmountAfterPurchase = await this.crowdsale.boughtAmountOf(this.buyer.getAddress());

        expect(purchasedAmountAfterPurchase).to.equal(purchasedAmountBeforePurchase + 1);
    });

    context('overall cap', () => {
      const MAX_PER_ADDRESS_FOR_OVERALL = CAP + 1;
  
      beforeEach(async () => {
        const GodjiGameAvatarCrowdsale = await ethers.getContractFactory("GodjiGameAvatarCrowdsale");
  
        this.crowdsale = await GodjiGameAvatarCrowdsale.deploy(this.token.address, this.nft.address, RATE, this.wallet.getAddress(), CAP, MAX_PER_ADDRESS_FOR_OVERALL);
        await this.nft.grantRole(MINTER_ROLE, this.crowdsale.address);
      });
  
      it('should not mint if more than cap', async () => {
        await this.token.connect(this.buyer).approve(this.crowdsale.address, RATE * MAX_PER_ADDRESS_FOR_OVERALL);
        await expectRevert(this.crowdsale.connect(this.buyer).transferAndBuy(MAX_PER_ADDRESS_FOR_OVERALL), 'GGAC: cap reached');
      });
    });
  });
});
