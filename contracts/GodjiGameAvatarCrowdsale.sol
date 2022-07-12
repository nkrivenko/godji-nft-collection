// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./GodjiGameAvatar.sol";

/**
 * @title The presale step of Godji Game Avatars crowdsale. 
 */
contract GodjiGameAvatarCrowdsale is ReentrancyGuard, Ownable {

    event NFTPurchased(address indexed beneficiary, uint256 amount, uint256 payment);

    IERC20 private immutable _quoteToken;
    GodjiGameAvatar private immutable _nft;
    address private immutable _wallet;
    uint256 private immutable _cap;
    uint256 private immutable _maxNftsPerAddress;

    uint256 private _rate;
    mapping(address => uint256) _amountsOfNftOnAddress;
    uint256 private _totalMinted;

    constructor(IERC20 quoteToken_, GodjiGameAvatar nft_, uint256 rate_, address wallet_,
                uint256 cap_, uint256 maxPerAddress) {
        require(wallet_ != address(0), "GGAC: wallet must not be zero");
        require(rate_ > 0, "GGAC: rate must be positive");
        require(maxPerAddress > 0, "GGAC: max nfts per address must be positive");
        require(cap_ > 0, "GGAC: cap must be positive");

        _quoteToken = quoteToken_;
        _nft = nft_;
        _wallet = wallet_;
        _rate = rate_;
        _cap = cap_;
        _maxNftsPerAddress = maxPerAddress;

        _totalMinted = 0;
    }

    function wallet() public view returns (address) {
        return _wallet;
    }

    function rate() public view returns (uint256) {
        return _rate;
    }

    function cap() public view returns (uint256) {
        return _cap;
    }

    function nft() public view returns (GodjiGameAvatar) {
        return _nft;
    }

    function token() public view returns (IERC20) {
        return _quoteToken;
    }

    function totalMinted() public view returns (uint256) {
        return _totalMinted;
    }

    function maxNftsPerAddress() public view returns (uint256) {
        return _maxNftsPerAddress;
    }

    function boughtAmountOf(address buyer) public view returns (uint256) {
        return _amountsOfNftOnAddress[buyer];
    }

    function transferAndBuy(uint256 amount) public nonReentrant {
        address to = msg.sender;

        _preValidatePurchase(to, amount);

        uint256 tokensToTransfer = _calculateTokensToWithdraw(amount);

        _updateState(to, amount);
        _processPurchase(to, tokensToTransfer, amount);

        emit NFTPurchased(to, amount, tokensToTransfer);
    }

    function _preValidatePurchase(address beneficiary, uint256 amount) internal view {
        require(amount > 0, "GGAC: amount must be positive");

        require(_totalMinted + amount <= _cap, "GGAC: cap reached");
        require(_amountsOfNftOnAddress[beneficiary] + amount <= _maxNftsPerAddress, "GGAC: per-user cap reached");
    }

    function _calculateTokensToWithdraw(uint256 amount) internal view returns (uint256) {
        return _rate * amount;
    }

    function _updateState(address beneficiary, uint256 nftAmountToMint) internal {
        _totalMinted += nftAmountToMint;
        _amountsOfNftOnAddress[beneficiary] += nftAmountToMint;
    }

    function _processPurchase(address beneficiary, uint256 tokenAmount, uint256 nftAmount) internal {
        _quoteToken.transferFrom(beneficiary, _wallet, tokenAmount);
        _nft.safeMint(beneficiary, nftAmount);
    }
}
