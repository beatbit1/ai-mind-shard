// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AgentRegistry — named registry of agents (Mnemos, Atlas, future custom)
contract AgentRegistry {
    struct Agent {
        bytes32 id;
        address owner;
        string  name;
        string  metadataURI;
        bool    active;
    }

    mapping(bytes32 => Agent) private _agents;
    bytes32[] private _ids;

    event AgentRegistered(bytes32 indexed id, address indexed owner, string name);
    event AgentUpdated(bytes32 indexed id, string metadataURI, bool active);
    event AgentTransferred(bytes32 indexed id, address indexed from, address indexed to);

    function register(string calldata name, string calldata metadataURI) external returns (bytes32 id) {
        id = keccak256(abi.encodePacked(msg.sender, name));
        require(_agents[id].owner == address(0), "exists");
        _agents[id] = Agent(id, msg.sender, name, metadataURI, true);
        _ids.push(id);
        emit AgentRegistered(id, msg.sender, name);
    }

    function update(bytes32 id, string calldata metadataURI, bool active) external {
        require(_agents[id].owner == msg.sender, "not owner");
        _agents[id].metadataURI = metadataURI;
        _agents[id].active = active;
        emit AgentUpdated(id, metadataURI, active);
    }

    function transfer(bytes32 id, address newOwner) external {
        require(_agents[id].owner == msg.sender, "not owner");
        address from = _agents[id].owner;
        _agents[id].owner = newOwner;
        emit AgentTransferred(id, from, newOwner);
    }

    function get(bytes32 id) external view returns (Agent memory) {
        return _agents[id];
    }

    function ownerOf(bytes32 id) external view returns (address) {
        return _agents[id].owner;
    }

    function totalAgents() external view returns (uint256) {
        return _ids.length;
    }

    function agentIdAt(uint256 index) external view returns (bytes32) {
        return _ids[index];
    }
}
