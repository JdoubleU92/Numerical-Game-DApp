// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/utils/Strings.sol"; // Library, daher keine Vererbung erforderlich

contract NumericalGame {
    // (Die enthaltene Logik dieses Template Contracts wird von Klon-Instanzen über delegate calls ausgeführt)

    // Storage Slot [0] ... 
    // Optimales "packing" für die am häufigsten genutzen Funktionen. Hier ist alles enthalten was commit() und revealAndVerify() benötigt (inklusive Modifier)
    address public cloneInstanceOwner; // Besitzer (& Spielleiter) der jeweiligen Klon-Instanz (erzeugt mittels ApprovedCloneFactory.sol)
    uint56 public buyIn; // Eintrittsgebühr für das Spiel (in Wei)
    uint32 public commitPhase_END; // Ende der Commit-Phase; Overflow (durch UNIX Time) erreicht in ~ 80 Jahren. Ist so beabsichtigt vom Template Owner.
    uint8 public requiredPlayerAmount; // Geforderte Spieleranzahl
    // Storage Slot Nutzung: 32 von 32 Bytes

    // Storage Slot [1] ... 
    address public templateOwner; // Besitzer des Template Contracts
    uint56 public prizeAmount; // Gewinnsumme
    uint32 public revealPhase_END; // Ende der Reveal-Phase; Overflow (durch UNIX Time) erreicht in ~ 80 Jahren. Ist so beabsichtigt vom Template Owner.
    uint8 public royaltiesPercentage; // Prozent-Wert der Royalties. Geht an den Template Owner.
    // Storage Slot Nutzung: 32 von 32 Bytes

    // Storage Slot [2] ... 
    address public templateCA; // Template Contract (NumericalGame.sol)
    uint56 public serviceFee; // Servicegebühr, geht an den Spielleiter (abzüglich der Royalties and den Template Owner)
    uint16 public gameCount; // Spielzähler, Maximum bevor Overflow: 65.535 (Automatischer Reset durch unchecked{})
    bool public isEntered; // Custom Reentrancy Guard    
    bool public gameIsActive; // Spielstatus
    bool public cloneIsInitialized; // Klon-Initialisierung
    // Storage Slot Nutzung: 32 von 32 Bytes

    address[] public addrCommitted;
    address[] public addrRevealedSuccessful;

    mapping(address => Player) public playersByAddr;
    mapping(address => uint) public totalWinsByAddr;
    mapping(address => uint) public refundsAndPayoutsByAddr; // Rückerstattungen und Auszahlungen
    mapping(address => bool) public isTrustedCloneFactory; // Nur im state des template contracts gültig! Siehe Custom Getter: getIsTrustedCloneFactory().

    struct Player {
        bytes32 saltedAndHashedNumber; // Eigener Storage Slot
        bool hasPaidBuyIn; // Bedeutet Spieler hat commited
        bool hasRevealedSuccessful;
        uint16 revealedNumber;
    }
    
    event CloneInitialized(address indexed clone, address indexed owner);
    event GameStarted(uint required_PlayerAmount, uint buyIn, uint serviceFee_Percentage, uint serviceFee, uint royalties_Percentage, uint prizeAmount,
                      uint commitPhase_Start, uint commitPhase_Duration, uint commitPhase_End, uint revealPhase_Duration, uint revealPhase_End, uint gameCount);
    event PlayerCommitted(address indexed player, bytes32 saltedAndHashedNumber);
    event PlayerRevealed(address indexed player, uint revealedNumber);
    event GameResults(address indexed winner, uint totalWins, uint winnersNumber, uint targetNumber);
    event GameEnded(uint gameCount);
    event RefundOrPayoutStored(address indexed payee, uint amount);
    event RefundOrPayoutWithdrawn(address indexed payee, uint amount);
    event Received(address indexed msgDotSender, address indexed txDotOrigin, uint amountReceived);
    event FallbackUsed(address indexed msgDotSender, address indexed txDotOrigin, uint amountReceived, bytes msgDotData);

    // Modifier, um Zugriff auf Funktionen zu beschränken
    modifier onlyCloneInstanceOwner() {
        require(msg.sender == cloneInstanceOwner, "Error: You are not the clone instance owner!");
        _;
    }

    modifier onlyTemplateOwner() {
        require(msg.sender == templateOwner, "Error: You are not the template owner!");
        _;
    }

    modifier onlyDuringCommitPhase() {
        require(block.timestamp <= commitPhase_END, "Error: Commit phase must be active in order to call this function!");
        _;
    }

    modifier onlyDuringRevealPhase() {
        require(block.timestamp > commitPhase_END && block.timestamp <= revealPhase_END,
            "Error: Reveal phase must be active in order to call this function!");
        _;
    }

    modifier onlyAfterRevealPhase() {
        require(block.timestamp > revealPhase_END, "Error: Reveal phase has not ended yet!");
        _;
    }

    modifier triggerByPlayersOnlyAfterTimeout() {
        if (msg.sender != cloneInstanceOwner) {
            require(block.timestamp > revealPhase_END + 24 hours, "Error: Players can trigger only from 24 hours after reveal phase has ended!");
            require(playersByAddr[msg.sender].hasPaidBuyIn, "Error: Only Players that paid the buy-in can call this function!");
        }
        _;
    }

    // Initialisierung Template Contract. Achtung: Klone müssen eigenständig initialisieren. (State wird nicht vererbt bei Klon-Erzeugung).
    constructor(uint8 _royaltiesPercentage) {
        templateCA = address(this);
        templateOwner = msg.sender; // Deployer des Template Contracts wird zum Besitzer
        require(_royaltiesPercentage <= 5, "Error: Royalties percentage value must be within allowed range! [0 - 5]");
        royaltiesPercentage = _royaltiesPercentage;
    }

    // Klon-Initialisierung
    function initializeClone(address _cIO, address _templateCA, address _templateOwner, uint8 _royaltiesPercentage) external {

        require(!cloneIsInitialized, "Error: This clone instance is already initialized!");
        require(address(this) != _templateCA, "Error: You cannot initialize the template contract!");
        require(NumericalGame(payable(_templateCA)).isTrustedCloneFactory(msg.sender) == true, "Error: Unauthorized Caller!");
        require(tx.origin == _cIO, "Error: Transaction origin address must match input value _cIO!");
        cloneInstanceOwner = _cIO; // Der Ersteller der neuen Klon-Instanz wird zum Besitzer und Spielleiter aller darauf erstellten Spiele

        // Setzen der Constructor Variablen. Das ist wichtig, denn bei der Erzeugung eines Klons wird der Constructor des Template Contracts nicht ausgeführt!
        templateCA = _templateCA;
        templateOwner = _templateOwner;
        royaltiesPercentage = _royaltiesPercentage;
        cloneIsInitialized = true;

        emit CloneInitialized(address(this), _cIO);
    }

    // Funktion für das Erstellen und Starten neuer Spiele
    function startNewGame(uint8 _setPlayerAmount, uint56 _buyIn, uint8 _serviceFeePercentage, uint24 _commitPhaseDuration, uint24 _revealPhaseDuration) external onlyCloneInstanceOwner {

        require(!gameIsActive, "Error: Please wait until the current Game has ended!");
        require(_setPlayerAmount >= 3 && _setPlayerAmount <= 25, "Error: Player amount must be within allowed range! [3 - 25]");
        require(_buyIn <= 0.1 ether, "Error: Buy-in maximum is 0.1 Ether!");
        require(_serviceFeePercentage > 0 && _serviceFeePercentage <= 20, "Error: Service fee percentage value must be within allowed range! [1 - 20]");
        require(_commitPhaseDuration >= 120 && _commitPhaseDuration <= 86400, "Error: Commit phase duration must be within allowed range! [120 - 86400] seconds.");
        require(_revealPhaseDuration >= 120 && _revealPhaseDuration <= 86400, "Error: Reveal phase duration must be within allowed range! [120 - 86400] seconds.");

        requiredPlayerAmount = _setPlayerAmount;
        buyIn = _buyIn; // Setzen der Eintrittsgebühr
        serviceFee = (_buyIn * _setPlayerAmount * _serviceFeePercentage) / 100; // Servicegebühr, geht an den Spielleiter (abzüglich Royalties)
        prizeAmount = (_setPlayerAmount * _buyIn) - serviceFee; // Berechne den Gewinnbetrag
        
        uint commitPhase_START = block.timestamp;  // Referenzpunkt der Startzeit der Commit-Phase. (Timestamp des aktuell gültigen Blocks)
        commitPhase_END = uint32(commitPhase_START + _commitPhaseDuration);
        revealPhase_END = commitPhase_END + _revealPhaseDuration;

        gameIsActive = true;
        unchecked{++gameCount;} // Überspringe out-of-bounds Checks. Kein revert bei overflow. Automatischer Reset auf 0.
        
        emit GameStarted(_setPlayerAmount, _buyIn, _serviceFeePercentage, serviceFee, royaltiesPercentage, prizeAmount,
                            commitPhase_START, _commitPhaseDuration, commitPhase_END, _revealPhaseDuration, revealPhase_END, gameCount);
    }

    // Einreichen der verdeckten Spielzahl (vorher salted & hashed über sha-256-generator, integriert im front-end)
    function commit(bytes32 _saltedAndHashedNumber) external payable onlyDuringCommitPhase {

        Player storage playerRef = playersByAddr[msg.sender]; // Lokale Storage Referenz zum Spieler-Struct (spart Gas)
        if(playerRef.hasPaidBuyIn) {
            playerRef.saltedAndHashedNumber = _saltedAndHashedNumber; // Commitment kann noch geändert werden, sofern bereits bezahlt wurde
        } 
        else {
            require(addrCommitted.length < requiredPlayerAmount, "Error: The maximum number of players has already commited!");
            require(msg.value == buyIn, "Error: Please pay the exact entry fee!");
            require(msg.sender != cloneInstanceOwner, "Error: Game host cannot participate as a player.");

            playerRef.saltedAndHashedNumber = _saltedAndHashedNumber;
            playerRef.hasPaidBuyIn = true;
            addrCommitted.push(msg.sender);
        }
        emit PlayerCommitted(msg.sender, playerRef.saltedAndHashedNumber);
    }

    // Funktion zum Einreichen von Spielzahl und Salt. Und Prüfung ob Hash-Wert übereinstimmt
    function revealAndVerify(uint16 _revealedNumber, string memory _salt) external onlyDuringRevealPhase {

        require(addrCommitted.length == requiredPlayerAmount, "Error: Not enough players have commited for this game! Refunds will be available after the end of the game.");
        require(_revealedNumber <= 1000, "Error: Number must be within range [0 - 1000]!");

        Player storage playerRef = playersByAddr[msg.sender]; // Lokale Storage Referenz zum Spieler-Struct (spart Gas)
        require(playerRef.hasPaidBuyIn, "Error: Player did not commit!");
        require(!playerRef.hasRevealedSuccessful, "Error: Player has already revealed successfully!");
        require(msg.sender != cloneInstanceOwner, "Error: Game host cannot participate as a player.");

        string memory numberStr = Strings.toString(_revealedNumber); // Umwandeln der Zahl in einen String
        require(sha256(abi.encodePacked(_salt, numberStr)) == playerRef.saltedAndHashedNumber, "Error: Invalid reveal! Compared hashes don't match.");

        playerRef.revealedNumber = _revealedNumber;
        playerRef.hasRevealedSuccessful = true;
        addrRevealedSuccessful.push(msg.sender);

        emit PlayerRevealed(msg.sender, playerRef.revealedNumber);
    }

    // Hilfs-Funktion zur präzisen Berechnung der Target Number des Spiels
    function calculateTargetNumber(uint successfulRevealedCount) internal view returns (uint) {

        uint sum = 0;
        for (uint i = 0; i < successfulRevealedCount; i++) {
            sum += playersByAddr[addrRevealedSuccessful[i]].revealedNumber;
        }
        uint average = sum / successfulRevealedCount; // Durchschnittswert aller eingereichten (gültigen) Spielzahlen
        uint remainderAv = sum % successfulRevealedCount; // Rest der Division zur genaueren Berechnung nutzen
        uint scaledRemainderAv = (2 * remainderAv) / successfulRevealedCount; // korrekte Skalierung des Remainders
        uint targetNumber = ((2 * average) + scaledRemainderAv) / 3;
        uint remainderTN = ((2 * average) + scaledRemainderAv) % 3; // Rest von targetNumber
        if (remainderTN == 2) { // Prüfen, ob der Restwert 2 ist (entspricht 2/3, bzw 0.66666...)
            ++targetNumber; // targetNumber um 1 erhöhen, um Genauigkeit zu verbessern
        }
        return targetNumber;
    }

    // Funktion zur Ermittlung des Gewinners
    // Der Clone Instance Owner hat 24 Stunden Zeit nach Ende der Reveal-Phase um diese Funktion zu callen. Danach kann jeder Spieler die Funktion callen. 
    // (Der Caller wird belohnt, der Clone Instance Owner wird bestraft, falls möglich)
    function determineWinnerAndEndGame() external onlyAfterRevealPhase triggerByPlayersOnlyAfterTimeout {

        require(!isEntered, "Error: Reentrancy detected!");
        isEntered = true;
        require(gameIsActive, "Error: The game ended already!");

        uint commitedCount = addrCommitted.length;
        uint successfulRevealedCount = addrRevealedSuccessful.length;

        // Falls Spielanforderungen nicht erfüllt wurden
        if (commitedCount < requiredPlayerAmount || successfulRevealedCount < 3) {

            if (commitedCount < requiredPlayerAmount) {
                // Erlaube Rückerstattung des Buy-ins für Spieler die "committed" haben, jedoch die geforderte Anzahl an Spielern nicht erreicht wurde
                for (uint i = 0; i < commitedCount; i++) {
                    asyncTransfer(addrCommitted[i], buyIn);
                }
            }     
            else if (successfulRevealedCount < 3) {
                // Erlaube Rückerstattung des Buy-ins für Spieler die erfolgreich "revealed" haben, wenn es weniger als 3 sind
                for (uint i = 0; i < successfulRevealedCount; i++) {
                    asyncTransfer(addrRevealedSuccessful[i], buyIn);
                }
            }
            // Falls Spielleiter nicht reagiert hat
            if (msg.sender != cloneInstanceOwner) {
                uint balance_CIO = refundsAndPayoutsByAddr[cloneInstanceOwner];
                // Mögliche Belohnung/Bestrafung (keine Garantie)
                if (balance_CIO > 0) {
                    uint callerReward = (serviceFee * 2) / 3;
                    if (balance_CIO < callerReward) { 
                    callerReward = balance_CIO;
                    }
                    refundsAndPayoutsByAddr[cloneInstanceOwner] -= callerReward; // Bestrafung
                    safeSendOrStore(payable(msg.sender), callerReward); // Belohnung
                }
            }
            endGame();
            isEntered = false;
            return;
        }
        else {
            // Spielanforderungen wurden erfüllt
            uint targetNumber = calculateTargetNumber(successfulRevealedCount); // Ermittle targetNumber (Entspricht 2/3 des Durchschnittswert aller korrekt revealten Spielzahlen, als Integer-Wert)
            address[] memory potentialWinners = new address[](successfulRevealedCount); // Für den Fall dass es mehrere "Gewinner" gibt
            uint[] memory unpredictableNumbers = new uint[](successfulRevealedCount); // Die erfolgreich revealten Zahlen stehen erst fest sobald der letzte Spieler innerhalb der Reveal Phase revealed hat
            uint pWcount = 0; // potential Winner count
            address winner;
            uint winnersNumber;
            uint closest = 1001; // Startwert: Eine Zahl größer als die maximal mögliche Differenz zur Target Number
            
            for (uint i = 0; i < successfulRevealedCount; i++) {
                uint number = playersByAddr[addrRevealedSuccessful[i]].revealedNumber;
                unpredictableNumbers[i] = number;
                uint diff = (number > targetNumber) ? (number - targetNumber) : (targetNumber - number);
                if (diff < closest) {
                    closest = diff;
                    winnersNumber = number;
                    pWcount = 1; // Reset des Zählers, da ein neuer bester Kandidat gefunden wurde
                    potentialWinners = new address[](successfulRevealedCount); // Reset des Arrays
                    potentialWinners[0] = addrRevealedSuccessful[i]; // Beginne das Array neu mit dem aktuell besten Kandidaten
                } else if (diff == closest) {
                    potentialWinners[pWcount] = addrRevealedSuccessful[i]; // Füge weitere Spieler mit der gleichen Differenz hinzu
                    ++pWcount;
                }
            }
            // Falls mehrere Spieler die Gewinner Zahl gewählt haben  
            if (pWcount > 1) { 
                uint unpredictableIndex = uint(keccak256(abi.encodePacked(addrCommitted, unpredictableNumbers))) % pWcount; // Hier wurden bewusst keine (block.)-variablen genutzt um block grinding zu verhindern
                // Der Index kann zwar bereits ausgerechnet werden sobald der letzte Spieler revealt hat, doch er kann nicht vom letzten Revealer manipuliert werden da er gezwungen ist korrekt zu revealen
                winner = potentialWinners[unpredictableIndex]; // Zufälliger Gewinner
            }
            // Anderenfalls 
            else if (pWcount == 1) {
                winner = potentialWinners[0]; // Eindeutiger Gewinner
            }
            ++totalWinsByAddr[winner]; // Gewinnzähler

            safeSendOrStore(payable(winner), prizeAmount); // Gewinnauszahlung

            uint royaltiesTemplateOwner = (serviceFee * royaltiesPercentage) / 100; // Berechnen der Royalties, an den Template Owner
            if (royaltiesPercentage > 0) {
                safeSendOrStore(payable(templateOwner), royaltiesTemplateOwner); // Auszahlung der Royalties
            }
            if (msg.sender == cloneInstanceOwner) {
                asyncTransfer(cloneInstanceOwner, serviceFee - royaltiesTemplateOwner); // Gutschrift der Servicegebühr (auf Pull-Konto)
            }
            else {
                // Falls Spielleiter nicht reagiert hat
                uint callerReward = (serviceFee * 2) / 3;
                safeSendOrStore(payable(msg.sender), callerReward); // Garantierte Belohnung
                asyncTransfer(cloneInstanceOwner, serviceFee - callerReward - royaltiesTemplateOwner); // Garantierte Bestrafung
            }
            emit GameResults(winner, totalWinsByAddr[winner], winnersNumber, targetNumber);
            endGame();
            isEntered = false;
        }
    }

    // Hilfs-Funktion um Spiel offiziell zu beenden
    function endGame() internal {
        
        for (uint i = 0; i < addrCommitted.length; i++) {
            delete playersByAddr[addrCommitted[i]]; // Löscht Mapping zum Struct. Spieler Daten im Struct werden dadurch zurückgesetzt.
        }
        delete addrCommitted; // Löscht Array
        delete addrRevealedSuccessful; // Löscht Array
        requiredPlayerAmount = 0;
        buyIn = 0;
        prizeAmount = 0;
        serviceFee = 0;
        commitPhase_END = 0;
        revealPhase_END = 0;
        gameIsActive = false;
        emit GameEnded(gameCount);
    }
    
    // Sicheres Senden von Ether mit Gas-Limit. Wenn der Transfer fehlschlägt, kann der Betrag später vom Empfänger abgehoben werden.
    function safeSendOrStore(address payable _recipient, uint256 _amount) internal {

        (bool success, ) = _recipient.call{value: _amount, gas: 5000}(""); // Gas-Limit: 5000 Einheiten
        if (!success) {
            refundsAndPayoutsByAddr[_recipient] += _amount;
            emit RefundOrPayoutStored(_recipient, _amount);
        }
    }

    // Gutschrift auf Pull-Konto (Empfänger muss eigenständig davon abheben)
    function asyncTransfer(address _payee, uint _amount) internal {

        require(_payee != address(0), "Error: Invalid payee address!");
        require(_amount > 0, "Error: Amount must be > 0");
        refundsAndPayoutsByAddr[_payee] += _amount;
        emit RefundOrPayoutStored(_payee, _amount);
    }

    // Erlaube das Abheben von Rückerstattungen und (fehlgeschlagenen) Auszahlungen
    function withdrawRefundsOrPayoutsFromClone() external {
        // Wird ein delegatecall über eine clone instance gemacht, so entspricht address(this) der clone instance
        require(address(this) != templateCA, "Error: You cannot withdraw from the template contract!");
        
        uint balance = refundsAndPayoutsByAddr[msg.sender];
        require(balance > 0, "Error: No refunds or payouts available!");
        refundsAndPayoutsByAddr[msg.sender] = 0; // Verhindert Reentrancy

        (bool success, ) = msg.sender.call{value: balance}("");
        require(success, "Error: Withdrawal failed!");

        emit RefundOrPayoutWithdrawn(msg.sender, balance);
    }

    // Erlaube dem cloneInstanceOwner alle (freien!) Ether-Bestände des clone instance contracts abzuheben
    function withdrawBalanceFromClone() external onlyCloneInstanceOwner {
        // Wird ein delegatecall über eine clone instance gemacht, so entspricht address(this) der clone instance
        require(address(this) != templateCA, "Error: You cannot withdraw from the template contract!");

        uint balance = refundsAndPayoutsByAddr[address(this)]; // Nur receive() und fallback() können hierfür Gutschriften erteilen
        require(balance > 0, "Error: No funds available!");
        refundsAndPayoutsByAddr[address(this)] = 0; // Verhindert Reentrancy

        (bool success, ) = msg.sender.call{value: balance}("");
        require(success, "Error: Withdrawal failed!");
    }

    // Erlaube dem templateOwner alle Ether-Bestände des template contracts abzuheben
    function withdrawBalanceFromTemplate() external onlyTemplateOwner {
        require(address(this) == templateCA, "Error: You cannot withdraw from a clone instance!");
        (bool success, ) = msg.sender.call{value: address(this).balance}("");
        require(success, "Error: Withdrawal failed!");
    }

    // Clone Factory zur Whitelist hinzufügen
    function addCloneFactory(address _cloneFactoryCA) external onlyTemplateOwner {
        require(_cloneFactoryCA != address(0), "Error: Invalid address!");
        isTrustedCloneFactory[_cloneFactoryCA] = true;
    }

    // Clone Factory aus der Whitelist entfernen
    function removeCloneFactory(address _cloneFactoryCA) external onlyTemplateOwner {
        isTrustedCloneFactory[_cloneFactoryCA] = false;
    }

    // Whitelist Getter (Nur der template state ist gültig)
    function getIsTrustedCloneFactory(address _cloneFactoryCA) public view returns(bool) {
        if (address(this) != templateCA) {
            return NumericalGame(payable(templateCA)).isTrustedCloneFactory(_cloneFactoryCA);
        }
        return isTrustedCloneFactory[_cloneFactoryCA];
    }

    // Balance Getter
    function getContractBalance() public view returns(uint) {
        // Bei einem direkten call entspricht address(this) dem template contract (NumericalGame.sol)
        // Wird ein delegatecall über eine clone instance gemacht, so entspricht address(this) der clone instance
        return address(this).balance;
    }

    // Wird aufgerufen, wenn der Contract Ether ohne Daten erhält. Kann für Einzahlungen oder Spenden genutzt werden.
    receive() external payable {
        require(msg.value > 0, "Error: No ETH received by receive()!");
        // Achtung: Direkte calls zahlen in den Template Contract ein. Delegate calls zahlen in den Caller-Contract (Klon-Instanz) ein.
        if (address(this) != templateCA) {
            asyncTransfer(address(this), msg.value);
        }
        emit Received(msg.sender, tx.origin, msg.value);
    }

    // Wird aufgerufen, wenn keine andere Funktion zu der aufgerufenen Funktionssignatur passt. Kann für Einzahlungen oder Spenden genutzt werden.
    fallback() external payable {
        require(msg.value > 0, "Error: No ETH received by fallback()!");
        // Achtung: Direkte calls zahlen in den Template Contract ein. Delegate calls zahlen in den Caller-Contract (Klon-Instanz) ein
        if (address(this) != templateCA) {
            asyncTransfer(address(this), msg.value);
        }
        emit FallbackUsed(msg.sender, tx.origin, msg.value, msg.data);
    }

}
