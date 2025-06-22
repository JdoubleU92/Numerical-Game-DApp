# Numerical Game DApp

Eine dezentrale Anwendung (DApp) für ein numerisches Spiel, das auf Ethereum Smart Contracts basiert (Sepolia Testnet).
Das Spiel ermöglicht es Spielern, verdeckte Zahlen zu committen und zu revealen, wobei der Spieler gewinnt,
der mit seiner Zahl am nähsten an 2/3 des Durchschnitts aller erfolgreich revealten Zahlen liegt.

## 🚀 Features

- **Clone Factory System**: Jeder Game Host kann eigene Clone-Instanzen erstellen
- **Multi-Role Support**: Separate Funktionen für Template Owner, Game Hosts und Spieler
- **Real-time Events**: Live-Updates für alle Spielereignisse
- **Hash Generator**: Integrierte SHA-256 Hash-Generierung für Commitments
- **Universal Functions**: Refund- und Payout-Management für alle Benutzer
- **Responsive UI**: Minimalistische, benutzerfreundliche Oberfläche

## 🛠️ Technologie-Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Backend**: Node.js mit Express.js
- **Blockchain**: Ethereum (Sepolia Testnet)
- **Web3**: Web3.js v1.7.4
- **Smart Contracts**: Solidity v0.8.25 mit OpenZeppelin Libraries
- **Build Tool**: Hardhat

## 📋 Voraussetzungen

- Node.js (Version 16 oder höher)
- npm oder yarn
- MetaMask Browser Extension
- Ethereum Sepolia Testnet ETH

## ⚙️ Installation & Setup

### 1. Repository klonen

```bash
git clone <repository-url>
cd DApp-BC3
```

### 2. Abhängigkeiten installieren

```bash
npm install
```

### 3. Umgebungsvariablen konfigurieren

Erstellen Sie eine `.env`-Datei im Hauptverzeichnis:

```env
CLONEFACTORY_ADDRESS=0x... # Adresse des deployed ApprovedCloneFactory Contracts
TEMPLATE_ADDRESS=0x... # Adresse des deployed NumericalGame Template Contracts
NETWORK_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY
```

### 4. Smart Contracts kompilieren

```bash
npm run compile
```

### 5. Server starten

```bash
npm start
# oder
node server.js
```

### 6. DApp öffnen

Öffnen Sie `http://localhost:3000` in Ihrem Browser.

## 🎮 Spielablauf

### Spielleiter (Clone Instance Owner)

1. **Wallet verbinden**: MetaMask mit dem Host-Account verbinden
2. **Klon-Instanz erstellen**: Neue Klon-Instanz für das Spiel erstellen
3. **Spiel initialisieren**:
   - Spieleranzahl (3-25) festlegen
   - Buy-In Betrag setzen
   - Service Fee Prozente (1-20%) definieren
   - Commit- und Reveal-Phasen konfigurieren
4. **Spiel überwachen**: Live-Updates zu Spieler-Commitments und Reveals
5. **Gewinner ermitteln**: Nach Ende der Reveal-Phase Gewinner ermitteln und Spiel beenden
6. **Auszahlungen verwalten**: Service Fees und unallocated Balances abheben

### Spieler

1. **Wallet verbinden**: MetaMask mit dem Player-Account verbinden
2. **Spiel beitreten**: Über Klon-Instanz-Adresse laufende Spiele finden
3. **Commit-Phase**:
   - Lucky Number (0-1000) wählen
   - Salt wählen
   - SHA-256 Hash erstellen (mit integriertem Generator)
   - Commitment (Hash) mit Buy-In einreichen
4. **Reveal-Phase**:
   - Lucky Number und Salt offenlegen
   - Verifizierung durch Smart Contract
5. **Gewinn**: Automatische Auszahlung bei Gewinn (Nachträgliche Abhebung bei Fehlgeschlag)

### Template Owner

1. **Clone Factory Management**: Whitelist für vertrauenswürdige Factory-Contracts verwalten

## 🏗️ Smart Contract Architektur

### Core Contracts

- **ApprovedCloneFactory**: Factory-Contract zum Erstellen von Klon-Instanzen
- **NumericalGame**: Template-Contract mit der Spiel-Logik
- **Klon-Instanzen**: Individueller State, gleiche Logik wie Template

### Key Features

- **Clone Pattern**: Jeder Host erhält eigene Spiel-Instanz
- **Access Control**: Rollenbasierte Berechtigungen
- **Event System**: Umfassende Event-Logs für Transparenz
- **Refund System**: Automatische Rückerstattungen bei nicht-erfüllen der Spielanforderungen

## 🎯 Spielmechanik

### Gewinner-Ermittlung

1. **Target Number**: 2/3 des Durchschnitts aller erfolgreich revealed Zahlen
2. **Gewinner**: Spieler mit der nähsten Zahl zur Target Number gewinnt
3. **Tie-Break**: Bei Gleichstand wird zufällig ein Gewinner ausgewählt

### Phasen

- **Commit Phase**: Spieler committen verdeckte Zahlen (salted und hashed)
- **Reveal Phase**: Spieler revealen Zahlen zur Verifizierung
- **Timeout Phase**: 24h Zeitfenster für Gewinner-Ermittlung

### Auszahlungen

- **Gewinner**: Erhält den gesamten Preis
- **Host**: Erhält Service Fee minus Royalties
- **Template Owner**: Erhält Royalties
- **Refunds**: Ehrliche Spieler erhalten Buy-In zurück bei Spielabbruch

## 🔧 Entwicklung

### Projektstruktur

```
DApp-BC3/
├── contracts/          # Smart Contracts (Solidity)
├── public/             # Frontend (HTML, CSS, JS)
├── artifacts/          # Kompilierte Contracts (generiert)
├── cache/              # Hardhat Cache (generiert)
├── server.js           # Express Server
├── hardhat.config.js   # Hardhat Konfiguration
└── package.json        # Dependencies
```

### Wichtige Befehle

```bash
npm run compile        # Smart Contracts kompilieren
npm start              # Server starten
npm test               # Tests ausführen (falls vorhanden)
```

## 🌐 Netzwerk

- **Testnet**: Ethereum Sepolia
- **RPC Provider**: Alchemy (empfohlen)
- **Block Explorer**: Sepolia Etherscan

## 📝 Lizenz

ISC License

## 🤝 Beitragen

1. Fork des Repositories
2. Feature Branch erstellen (`git checkout -b feature/AmazingFeature`)
3. Änderungen committen (`git commit -m 'Add some AmazingFeature'`)
4. Branch pushen (`git push origin feature/AmazingFeature`)
5. Pull Request erstellen

## 📞 Support

Bei Fragen oder Problemen erstellen Sie bitte ein Issue im GitHub Repository.
