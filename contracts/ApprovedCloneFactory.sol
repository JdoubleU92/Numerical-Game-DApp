// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/proxy/Clones.sol"; // Library
import "./NumericalGame.sol"; // Template Contract

contract ApprovedCloneFactory {
    
    // Immutable Variablen nutzen keine Storage Slots, sind nur im Bytecode existent
    address public immutable templateCA; // Addresse des Template Contracts (NumericalGame.sol)
    address public immutable templateOwner; // Besitzer des Template Contracts
    uint8 public immutable royaltiesPercentage; // Prozent-Wert der Royalties an den Template Owner
    
    // key: Adresse des Besitzer der Klon-Instanz, => value: Adresse der Klon-Instanz
    mapping(address => address) public cloneInstanceAddrByOwner; 

    event NewCloneCreated(address indexed newCloneAddr, address indexed cloneInstanceOwner);

    constructor(address _templateCA) {
        NumericalGame NG = NumericalGame(payable(_templateCA));
        require(_templateCA == NG.templateCA()); // Hier wird der public getter im template überprüft
        require(msg.sender == NG.templateOwner()); // Hier wird sichergestellt dass der Deployer der Template Owner ist. (Optional)
        templateCA = NG.templateCA(); 
        templateOwner = NG.templateOwner(); 
        royaltiesPercentage = NG.royaltiesPercentage();
    }

    // Klon-Erzeugung 
    function createClone() external {
        // Jeder Spielleiter ezeugt seinen eigenen Klon, über den er dann Spiele erstellt und leitet
        // Achtung: Nur Factories, die vom Template Owner zur Whitelist hinzugefügt wurden, sind in der Lage die initializeClone()-Funktion zu callen
        require(cloneInstanceAddrByOwner[msg.sender] == address(0), "Error: You already own a clone instance! Only one per address!");

        address newCloneAddr = Clones.clone(templateCA); // Erzeuge Klon-Adresse
        NumericalGame NG_clone = NumericalGame(payable(newCloneAddr)); // Klon-Instanz

        // Initialisiere den Klon mit der Addresse des Klon-Erstellers und mit den Constructor Variablen des Template Contracts
        NG_clone.initializeClone(msg.sender, templateCA, templateOwner, royaltiesPercentage); // Nur möglich wenn whitelisted!
        cloneInstanceAddrByOwner[msg.sender] = newCloneAddr; // Speichere Klon-Adresse in Mapping

        emit NewCloneCreated(newCloneAddr, NG_clone.cloneInstanceOwner());
    }

    // CA-Getter
    function getContractAddress() public view returns (address) {
        return address(this);
    }

}
