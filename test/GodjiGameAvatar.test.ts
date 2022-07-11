// @ts-nocheck

import { ethers, upgrades, web3 } from "hardhat";
import { expect } from "chai";
import { constants } from "@openzeppelin/test-helpers";

const MINTER_ROLE = web3.utils.soliditySha3('MINTER_ROLE');
const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';
const NEW_IPFS_URL = 'https://ipfs.io/ipfs/QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn/metadata/';
const INIT_IPFS_URL = 'https://ipfs.io/ipfs/QmNoHTHHbZcMzxxiWYPqz8aEpvqdJzSZ1DUZYDVj7TWZD6/metadata/';
const OPENSEA_PROXY_ADDR = '0x58807baD0B376efc12F5AD86aAc70E78ed67deaE';

const expectRevert = async (promise: Promise<Any>, message: string) => expect(promise).to.be.revertedWith(message);

describe("GodjiGameAvatar", () => {

  const NAME = "Godji Game Avatar";
  const SYMBOL = "GGA";

  beforeEach(async () => {
    const GodjiGameAvatar = await ethers.getContractFactory("GodjiGameAvatar");
    const [admin, minter, buyer, receiver, team, dev] = await ethers.getSigners();

    this.minter = minter;
    this.buyer = buyer;
    this.receiver = receiver;
    this.team = team;
    this.dev = dev;

    this.token = await upgrades.deployProxy(GodjiGameAvatar, [NAME, SYMBOL, INIT_IPFS_URL, await team.getAddress(), await dev.getAddress()]);

    await this.token.grantRole(MINTER_ROLE, this.minter.getAddress());
  });

  context('create token', () => {
    it('should create token with parameters needed', async () => {
      expect(this.token).to.exist;
  
      expect(NAME).to.equal(await this.token.name());
      expect(SYMBOL).to.equal(await this.token.symbol());
    });
  });

  context('mint', () => {
    it('should mint NFT from minter', async () => {
      const oldBalance = await this.token.balanceOf(this.buyer.getAddress());

      await this.token.connect(this.minter).safeMint(this.buyer.getAddress(), 1);

      const balanceDiff = (await this.token.balanceOf(this.buyer.getAddress())).sub(oldBalance);
      expect(balanceDiff).to.be.equal(1);
    });

    it('should mint multiple tokens from minter', async () => {
      const oldBalance = await this.token.balanceOf(this.buyer.getAddress());

      await this.token.connect(this.minter).safeMint(this.buyer.getAddress(), 3);

      const balanceDiff = (await this.token.balanceOf(this.buyer.getAddress())).sub(oldBalance);
      expect(balanceDiff).to.be.equal(3);
    });

    it('should not mint NFT from non-minter account', async () => {
      const buyerAddress = await this.buyer.getAddress();

      await expectRevert(this.token.connect(this.buyer).safeMint(buyerAddress, 1),
        `AccessControl: account ${buyerAddress.toLowerCase()} is missing role ${MINTER_ROLE}`);
    });

    xit('should not mint if public cap exceeded', async () => {
      const promises = [];

      for (let i = 0; i < 48; i++) {
        promises.push(this.token.connect(this.minter).safeMint(this.buyer.getAddress(), 200));
      }
      promises.push(this.token.connect(this.minter).safeMint(this.buyer.getAddress(), 100))

      await Promise.all(promises);

      await expectRevert(this.token.connect(this.minter).safeMint(this.buyer.getAddress(), 1), 'GGA: cap exceeded');
    });

    it('should mint reserved tokens to dev team', async () => {
      const oldDevSupply = await this.token.devReservedSupply();
      const oldBalance = await this.token.balanceOf(this.dev.getAddress());

      await this.token.mintReservedAvatars(this.dev.getAddress(), 1);

      const newBalance = await this.token.balanceOf(this.dev.getAddress());
      const newDevSupply = await this.token.devReservedSupply();

      expect(newBalance).to.be.equal(oldBalance + 1);
      expect(newDevSupply).to.equal(oldDevSupply + 1);
    });

    it('should mint reserved tokens to team', async () => {
      const oldTeamSupply = await this.token.teamReservedSupply();
      const oldBalance = await this.token.balanceOf(this.team.getAddress());

      await this.token.mintReservedAvatars(this.team.getAddress(), 1);

      const newBalance = await this.token.balanceOf(this.team.getAddress());
      const newTeamSupply = await this.token.teamReservedSupply();

      expect(newBalance).to.equal(oldBalance + 1);
      expect(newTeamSupply).to.equal(oldTeamSupply + 1);
    });

    it('should not mint reserved tokens to non-dev or non-team wallet', async () => {
      await expectRevert(this.token.mintReservedAvatars(this.buyer.getAddress(), 1), "GGA: reserved avatars can be minted only to devs or team");
    });

    it('should not mint reserved tokens if called not by admin', async () => {
      await this.minter.getAddress().then(
        addr => expectRevert(this.token.connect(this.minter).mintReservedAvatars(this.dev.getAddress(), 1), `AccessControl: account ${addr.toLowerCase()} is missing role ${DEFAULT_ADMIN_ROLE}`)
      );
    });

    it('should not mint reserved tokens for dev team if dev team cap exceeded', async () => {
      await this.token.mintReservedAvatars(this.dev.getAddress(), 6);

      expectRevert(this.token.mintReservedAvatars(this.dev.getAddress(), 1), 'GGA: max dev team amount exceeded');
    });

    it('should not mint reserved tokens for project team if project team cap exceeded', async () => {
      const mintPromises = [];
      for (let i = 0; i < 9; i++) {
        mintPromises.push(this.token.mintReservedAvatars(this.team.getAddress(), 50));
      }
      mintPromises.push(this.token.mintReservedAvatars(this.team.getAddress(), 44));

      await Promise.all(mintPromises);

      await expectRevert(this.token.mintReservedAvatars(this.team.getAddress(), 1), 'GGA: max team amount exceeded');
    });
  });

  context('transfer', () => {
    beforeEach(async () => {
      this.buyerAddress = this.buyer.getAddress();
      this.receiverAddress = this.receiver.getAddress();

      await this.token.connect(this.minter).safeMint(this.buyerAddress, 3);

      await this.token.connect(this.buyer).approve(this.receiverAddress, 1);
      await this.token.connect(this.buyer).approve(this.receiverAddress, 2);
      await this.token.connect(this.buyer).approve(this.receiverAddress, 3);
    });

    it('should not allow to transfer during presale', async () => {
      await expectRevert(this.token.connect(this.buyer)["safeTransferFrom(address,address,uint256)"](this.buyerAddress, this.receiverAddress, 1), 'GGAC: cannot transfer during presale');
      await expectRevert(this.token.connect(this.buyer)["safeTransferFrom(address,address,uint256,bytes)"](this.buyerAddress, this.receiverAddress, 1, web3.utils.asciiToHex('1')), 'GGAC: cannot transfer during presale');
      await expectRevert(this.token.connect(this.buyer)["transferFrom(address,address,uint256)"](this.buyerAddress, this.receiverAddress, 1), 'GGAC: cannot transfer during presale');
    });

    it('should allow to transfer after presale', async () => {
      await this.token.finishPreSale(NEW_IPFS_URL);

      await this.token.connect(this.buyer)["safeTransferFrom(address,address,uint256)"](this.buyerAddress, this.receiverAddress, 1);
      await this.token.connect(this.buyer)["safeTransferFrom(address,address,uint256,bytes)"](this.buyerAddress, this.receiverAddress, 2, web3.utils.asciiToHex('1'));
      await this.token.connect(this.buyer)["transferFrom(address,address,uint256)"](this.buyerAddress, this.receiverAddress, 3);
    });

    it('should return true if isApprovedForAll called from opensea proxy', async () => {
      expect(await this.token.isApprovedForAll(this.buyer.getAddress(), OPENSEA_PROXY_ADDR)).to.true;
    })
  });

  context('presale', () => {
    beforeEach(async () => {
      await this.token.connect(this.minter).safeMint(this.buyer.getAddress(), 1);
    });

    it('should change baseURI when presale finished', async () => {
      const oldUri = await this.token.tokenURI(1);
      await this.token.finishPreSale(NEW_IPFS_URL);
      
      const uri = await this.token.tokenURI(1);

      expect(uri).to.be.equal(`${NEW_IPFS_URL}1`);
      expect(uri).to.be.not.equal(oldUri);
    });

    it('should not change baseURI when called not by admin', async () => {
      await expectRevert(this.token.connect(this.buyer).finishPreSale(NEW_IPFS_URL),
        `AccessControl: account ${(await this.buyer.getAddress()).toLowerCase()} is missing role ${DEFAULT_ADMIN_ROLE}`);
    });

    it('should not finish presale if it is already finished', async () => {
      await this.token.finishPreSale(NEW_IPFS_URL).then(_ => expectRevert(this.token.finishPreSale(NEW_IPFS_URL), 'GGT: presale is inactive'))
    });
  });

  context('access control', () => {
    it('should add minter by admin', async () => {
      await this.token.grantRole(MINTER_ROLE, this.buyer.getAddress());

      const isMinter = await this.token.hasRole(MINTER_ROLE, this.buyer.getAddress());

      expect(isMinter).to.true;
    });

    it('should not add minter by non-admin user', async () => {
      const address = await this.buyer.getAddress().then(addr => addr.toLowerCase());

      await expectRevert(this.token.connect(this.buyer).grantRole(MINTER_ROLE, this.buyer.getAddress()),
        `AccessControl: account ${address} is missing role ${DEFAULT_ADMIN_ROLE}`);
    });

    it('should remove minter by admin', async () => {
      expect(await this.token.hasRole(MINTER_ROLE, this.minter.getAddress())).to.true;

      await this.token.revokeRole(MINTER_ROLE, this.minter.getAddress());
      const isMinter = await this.token.hasRole(MINTER_ROLE, this.minter.getAddress());

      expect(isMinter).to.equal(false);
    });

    it('should remove minter only by admin', async () => {
      const address = await this.buyer.getAddress().then(addr => addr.toLowerCase());

      await expectRevert(this.token.connect(this.buyer).revokeRole(MINTER_ROLE, address),
        `AccessControl: account ${address} is missing role ${DEFAULT_ADMIN_ROLE}`);
    });
  });
});
