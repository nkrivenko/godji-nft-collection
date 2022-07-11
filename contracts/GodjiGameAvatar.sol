// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";

/**
 * @title Godji Game Genesis Avatar collection.
 * @notice This contract represents Godji Game Genesis Avatar ERC721 tokens.
 * @dev The contract implements ERC721 standard with minting access control.
 * @dev Also some of the tokens reserved by dev and project teams.
 * @dev The contract uses Transparent Proxy pattern for upgrades.
 */
contract GodjiGameAvatar is Initializable, ERC721Upgradeable, ERC721EnumerableUpgradeable, AccessControlUpgradeable {
    using CountersUpgradeable for CountersUpgradeable.Counter;

    uint256 private constant DEV_TEAM_RESERVED_AVATARS = 6;
    uint256 private constant TEAM_RESERVED_AVATARS = 494;
    uint256 private constant MAX_AVATARS = 9500;
    address private constant OPENSEA_PROXY_ADDRESS = 0x58807baD0B376efc12F5AD86aAc70E78ed67deaE;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    CountersUpgradeable.Counter private _tokenIdCounter;

    string private _metadataURI;
    bool private _presaleActive;
    uint256 private _devReservedSupply;
    uint256 private _teamReservedSupply;
    address private _teamWallet;
    address private _devWallet;

    modifier duringPreSale() {
        require(_presaleActive, "GGT: presale is inactive");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Transparent proxy initializer. Grants admin role to deployer.
     * @param name_ The token name as per ERC721Metadata standard.
     * @param symbol_ The token symbol as per ERC721Metadata standard.
     * @param metadataURI_ Initial token metadata URI (IPFS preferred).
     * @param teamWallet_ Wallet of the project team where reserved NFTs will be minted. 
     * @param devWallet_ Wallet of the development team where reserved NFTs will be minted. 
     */
    function initialize(string memory name_, string memory symbol_, string memory metadataURI_,
                        address teamWallet_, address devWallet_) public initializer {
        __ERC721_init(name_, symbol_);
        __ERC721Enumerable_init();
        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

        _metadataURI = metadataURI_;
        _teamWallet = teamWallet_;
        _devWallet = devWallet_;

        _teamReservedSupply = 0;
        _devReservedSupply = 0;
        _presaleActive = true;
    }

    function devReservedSupply() public view returns (uint256) {
        return _devReservedSupply;
    }

    function teamReservedSupply() public view returns (uint256) {
        return _teamReservedSupply;
    }

    /**
     * @notice Sets the base URI used for the tokens. This will be updated when new masks are uploaded to IPFS.
     * @dev Sets the base URI used for the tokens. This will be updated when new masks are uploaded to IPFS.
     * @dev Can be called only by admin.
     */
    function setBaseURI(string memory newURI) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _metadataURI = newURI;
    }

    /**
     * @dev Mint given amount of tokens. Only accounts with MINTER_ROLE can mint.
     * @dev Total amount of minted avatars must not exceed the `MAX_AVATARS` amount.
     * @param to The new token recipient.
     * @param amount The amount of tokens to mint. Cannot exceed the publicly available token amount.
     */
    function safeMint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        require(totalSupply() + amount <= MAX_AVATARS, "GGA: cannot mint that much avatars");

        _doSafeMint(to, amount);
    }

    /**
     * @dev Mint given amount of tokens to either dev team or project team. Can be called only by administrator.
     * @param to The new token recipient. Must be either dev team wallet or project team wallet.
     * @param amount The amount of tokens to mint. Must not exceed the corresponding limit.
     */
    function mintReservedAvatars(address to, uint256 amount) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(to == _devWallet || to == _teamWallet, "GGA: reserved avatars can be minted only to devs or team");
        if (to == _devWallet) {
            require(_devReservedSupply + amount <= DEV_TEAM_RESERVED_AVATARS, "GGA: max dev team amount exceeded");
            _devReservedSupply += amount;
        } else {
            require(_teamReservedSupply + amount <= TEAM_RESERVED_AVATARS, "GGA: max team amount exceeded");
            _teamReservedSupply += amount;
        }

        _doSafeMint(to, amount);
    }

    /**
     * @dev Finish presale step and thus allow the NFT owners to transfer.
     * @dev Also change metadata from placeholder pictures to avatars.
     * @dev Can be called only by administrator of the contract.
     * @param baseURI New metadata URI.
     */
    function finishPreSale(string memory baseURI) public onlyRole(DEFAULT_ADMIN_ROLE) duringPreSale {
        _metadataURI = baseURI;
        _presaleActive = false;
    }

    function isApprovedForAll(
        address _owner,
        address _operator
    ) public override view returns (bool isOperator) {
        if (_operator == address(OPENSEA_PROXY_ADDRESS)) {
            return true;
        }
        
        return ERC721Upgradeable.isApprovedForAll(_owner, _operator);
    }

    function _doSafeMint(address to, uint256 amount) internal {
        for (uint256 index = 0; index < amount; index++) {
            _tokenIdCounter.increment();
            uint256 tokenId = _tokenIdCounter.current();
            _safeMint(to, tokenId);   
        }
    }

    function _baseURI() internal view override returns (string memory) {
        return _metadataURI;
    }

    function _beforeTokenTransfer(address from, address to, uint256 tokenId)
        internal
        override(ERC721Upgradeable, ERC721EnumerableUpgradeable)
    {
        // Token cannot be transfered during presale but can be minted.
        // If safeTransferFrom is called with zero `from` address, new token is minted. 
        if (from != address(0)) {
            require(!_presaleActive, "GGAC: cannot transfer during presale");
        }
        super._beforeTokenTransfer(from, to, tokenId);
    }

    // The following functions are overrides required by Solidity.

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Upgradeable, ERC721EnumerableUpgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
