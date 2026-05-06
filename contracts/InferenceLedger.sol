// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @title InferenceLedger — pre-paid OG balance per user; agent debits per call
contract InferenceLedger is AccessControl, ReentrancyGuard, Pausable {
    bytes32 public constant ROUTER_ROLE         = keccak256("ROUTER_ROLE");
    bytes32 public constant PROVIDER_ADMIN_ROLE = keccak256("PROVIDER_ADMIN_ROLE");

    struct Provider {
        string  endpoint;
        uint256 pricePerCall;
        bool    active;
    }

    mapping(address => uint256)  public balanceOf;
    mapping(address => Provider) private _providers;
    mapping(bytes32 => bool)     public chargedRequests;

    uint256 public minDeposit       = 0.01 ether;
    uint256 public maxChargePerCall = 1 ether;

    event Deposited(address indexed user, uint256 amount, uint256 newBalance);
    event Withdrawn(address indexed user, uint256 amount);
    event Charged(address indexed user, address indexed provider, uint256 amount, bytes32 requestId);
    event ProviderRegistered(address indexed provider, string endpoint, uint256 pricePerCall);
    event ProviderRetired(address indexed provider);
    event LimitsUpdated(uint256 minDeposit, uint256 maxChargePerCall);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PROVIDER_ADMIN_ROLE, admin);
    }

    function deposit() external payable whenNotPaused {
        _deposit(msg.sender, msg.value);
    }

    function depositFor(address user) external payable whenNotPaused {
        _deposit(user, msg.value);
    }

    function _deposit(address user, uint256 amount) internal {
        require(amount >= minDeposit, "below min");
        balanceOf[user] += amount;
        emit Deposited(user, amount, balanceOf[user]);
    }

    function withdraw(uint256 amount) external nonReentrant {
        uint256 bal = balanceOf[msg.sender];
        require(amount <= bal, "insufficient");
        balanceOf[msg.sender] = bal - amount;
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "send fail");
        emit Withdrawn(msg.sender, amount);
    }

    function charge(address user, address provider, uint256 amount, bytes32 requestId)
        external
        whenNotPaused
        onlyRole(ROUTER_ROLE)
    {
        require(!chargedRequests[requestId], "dup");
        require(amount <= maxChargePerCall, "over cap");
        require(_providers[provider].active, "provider inactive");
        require(balanceOf[user] >= amount, "low bal");

        chargedRequests[requestId] = true;
        balanceOf[user] -= amount;
        balanceOf[provider] += amount;
        emit Charged(user, provider, amount, requestId);
    }

    function registerProvider(address provider, string calldata endpoint, uint256 pricePerCall)
        external
        onlyRole(PROVIDER_ADMIN_ROLE)
    {
        _providers[provider] = Provider(endpoint, pricePerCall, true);
        emit ProviderRegistered(provider, endpoint, pricePerCall);
    }

    function retireProvider(address provider) external onlyRole(PROVIDER_ADMIN_ROLE) {
        _providers[provider].active = false;
        emit ProviderRetired(provider);
    }

    function provider(address p) external view returns (string memory endpoint, uint256 pricePerCall, bool active) {
        Provider storage pr = _providers[p];
        return (pr.endpoint, pr.pricePerCall, pr.active);
    }

    function setLimits(uint256 _minDeposit, uint256 _maxChargePerCall) external onlyRole(DEFAULT_ADMIN_ROLE) {
        minDeposit = _minDeposit;
        maxChargePerCall = _maxChargePerCall;
        emit LimitsUpdated(_minDeposit, _maxChargePerCall);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
}
