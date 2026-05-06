// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title MemoryRegistry — append-only on-chain log of encrypted memory roots
/// @notice Each Tonara user has a per-address log of (rootHash, sizeBytes,
///         timestamp, kind, sessionId). The agent's hot wallet may commit on
///         behalf of users that have explicitly delegated it.
contract MemoryRegistry is Ownable {
    enum MemoryKind { User, Assistant, ResearchBrief, Custom }

    struct MemoryRecord {
        bytes32 rootHash;
        uint64  sizeBytes;
        uint64  timestamp;
        MemoryKind kind;
        bytes32 sessionId;
        bool revoked;
    }

    mapping(address => MemoryRecord[]) private _records;
    mapping(address => mapping(address => bool)) public delegates;

    event MemoryCommitted(address indexed owner, uint256 indexed index, bytes32 rootHash, MemoryKind kind, bytes32 sessionId);
    event MemoryRevoked(address indexed owner, uint256 indexed index);
    event DelegateSet(address indexed owner, address indexed delegate, bool allowed);

    constructor(address initialOwner) Ownable(initialOwner) {}

    function setDelegate(address delegate, bool allowed) external {
        delegates[msg.sender][delegate] = allowed;
        emit DelegateSet(msg.sender, delegate, allowed);
    }

    function commit(bytes32 rootHash, uint64 sizeBytes, MemoryKind kind, bytes32 sessionId)
        external
        returns (uint256 index)
    {
        return _commit(msg.sender, rootHash, sizeBytes, kind, sessionId);
    }

    function commitFor(address owner, bytes32 rootHash, uint64 sizeBytes, MemoryKind kind, bytes32 sessionId)
        external
        returns (uint256)
    {
        require(delegates[owner][msg.sender], "not delegated");
        return _commit(owner, rootHash, sizeBytes, kind, sessionId);
    }

    function commitBatch(
        bytes32[] calldata roots,
        uint64[]  calldata sizes,
        MemoryKind[] calldata kinds,
        bytes32 sessionId
    ) external returns (uint256 firstIndex) {
        require(roots.length == sizes.length && sizes.length == kinds.length, "len mismatch");
        firstIndex = _records[msg.sender].length;
        for (uint256 i = 0; i < roots.length; i++) {
            _commit(msg.sender, roots[i], sizes[i], kinds[i], sessionId);
        }
    }

    function _commit(address owner, bytes32 rootHash, uint64 sizeBytes, MemoryKind kind, bytes32 sessionId)
        internal
        returns (uint256 index)
    {
        index = _records[owner].length;
        _records[owner].push(MemoryRecord({
            rootHash: rootHash,
            sizeBytes: sizeBytes,
            timestamp: uint64(block.timestamp),
            kind: kind,
            sessionId: sessionId,
            revoked: false
        }));
        emit MemoryCommitted(owner, index, rootHash, kind, sessionId);
    }

    function revoke(uint256 index) external {
        require(index < _records[msg.sender].length, "out of range");
        _records[msg.sender][index].revoked = true;
        emit MemoryRevoked(msg.sender, index);
    }

    function recordCount(address owner) external view returns (uint256) {
        return _records[owner].length;
    }

    function recordsOf(address owner, uint256 offset, uint256 limit)
        external
        view
        returns (MemoryRecord[] memory page)
    {
        uint256 total = _records[owner].length;
        if (offset >= total) return new MemoryRecord[](0);
        uint256 end = offset + limit;
        if (end > total) end = total;
        page = new MemoryRecord[](end - offset);
        for (uint256 i = 0; i < page.length; i++) {
            page[i] = _records[owner][offset + i];
        }
    }
}
