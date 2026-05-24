// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title SessionAccess — granular sharing for Tonara agent memories
/// @notice Lets a memory owner grant another address read-access to a specific sessionId.
contract SessionAccess {
    // Mapping: owner => sessionId => reader => expiresAt
    mapping(address => mapping(bytes32 => mapping(address => uint64))) public accessExpiry;

    event AccessGranted(address indexed owner, bytes32 indexed sessionId, address indexed reader, uint64 expiresAt);
    event AccessRevoked(address indexed owner, bytes32 indexed sessionId, address indexed reader);

    /// @notice Grant read access to a session until `expiresAt`
    function grant(bytes32 sessionId, address reader, uint64 expiresAt) external {
        accessExpiry[msg.sender][sessionId][reader] = expiresAt;
        emit AccessGranted(msg.sender, sessionId, reader, expiresAt);
    }

    /// @notice Revoke read access to a session immediately
    function revoke(bytes32 sessionId, address reader) external {
        accessExpiry[msg.sender][sessionId][reader] = 0;
        emit AccessRevoked(msg.sender, sessionId, reader);
    }

    /// @notice Check if a reader is currently authorized to read a session
    function canRead(address owner, bytes32 sessionId, address reader) external view returns (bool) {
        // Owner can always read their own session
        if (owner == reader) return true;
        // Check if expiry timestamp is in the future
        return accessExpiry[owner][sessionId][reader] > block.timestamp;
    }
}
