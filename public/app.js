// public/app.js
let web3, cloneFactoryContract, numericalGameContract, accountHost, accountPlayer, accountTemplate, accountUniversal, cloneInstanceAddress;
let gameDataInterval, timerInterval;
let selectedFactoryAddress; // Track which factory is selected

// Store event subscriptions to prevent duplicates
let eventSubscriptions = [];

let popupTimeout;
function showSingleAlert(message) {
  if (popupTimeout) {
    clearTimeout(popupTimeout);
    const existing = document.getElementById("customPopup");
    if (existing) existing.remove();
  }
  const popup = document.createElement("div");
  popup.id = "customPopup";
  popup.style.position = "fixed";
  popup.style.top = "30px";
  popup.style.left = "50%";
  popup.style.transform = "translateX(-50%)";
  popup.style.background = "#fff";
  popup.style.border = "2px solid #333";
  popup.style.padding = "18px 32px";
  popup.style.zIndex = 9999;
  popup.style.fontSize = "1.2em";
  popup.style.borderRadius = "8px";
  popup.style.boxShadow = "0 2px 12px rgba(0,0,0,0.15)";
  popup.innerText = message;
  document.body.appendChild(popup);
  popupTimeout = setTimeout(() => {
    popup.remove();
    popupTimeout = null;
  }, 3500);
}

// Initialize web3 with a default Alchemy provider (Sepolia)
web3 = new Web3(new Web3.providers.HttpProvider("https://eth-sepolia.g.alchemy.com/v2/8QaMRi6Brp94-dLWq09GKVKqf7mEijtn")); // Replace with your Alchemy API Key

// Load template data on page load
window.addEventListener("load", async () => {
  try {
    const response = await fetch("/contract-data");
    const contractData = await response.json();
    const numericalGameContract = new web3.eth.Contract(contractData.numericalGameABI, contractData.templateAddress);
    const templateOwner = await numericalGameContract.methods.templateOwner().call();
    const royaltiesPercentage = await numericalGameContract.methods.royaltiesPercentage().call();
    document.getElementById("templateContract").innerHTML = `<strong>Template Contract:</strong> ${contractData.templateAddress} <a href="https://sepolia.etherscan.io/address/${contractData.templateAddress}" target="_blank">View on Etherscan</a>`;
    document.getElementById("templateOwner").innerHTML = `<strong>Template Owner:</strong> ${templateOwner}`;
    document.getElementById("templateOwnerRoyalties").innerHTML = `<strong>Template Owner Royalties:</strong> ${royaltiesPercentage}% (of all collected Service Fees)`;

    // Set recommended factory address
    selectedFactoryAddress = contractData.cloneFactoryAddress;
    document.getElementById("recommendedFactory").innerHTML = `<strong>Recommended Clone Factory:</strong> ${contractData.cloneFactoryAddress} <a href="https://sepolia.etherscan.io/address/${contractData.cloneFactoryAddress}" target="_blank">View on Etherscan</a>`;
    document.getElementById("recommendedFactoryAddress").innerText = contractData.cloneFactoryAddress;

    // Check factory trust status
    const isTrusted = await numericalGameContract.methods.getIsTrustedCloneFactory(contractData.cloneFactoryAddress).call();
    document.getElementById("factoryTrustStatus").innerHTML = `<strong>Whitelist Status:</strong> ${isTrusted ? "True" : "False"}`;
  } catch (error) {
    document.getElementById("templateContract").innerHTML = `<strong>Template Contract:</strong> Error loading: ${error.message}`;
    document.getElementById("templateOwner").innerHTML = `<strong>Template Owner:</strong> Error loading`;
    document.getElementById("templateOwnerRoyalties").innerHTML = `<strong>Template Owner Royalties:</strong> Error loading`;
    document.getElementById("recommendedFactory").innerHTML = `<strong>Recommended Clone Factory:</strong> Error loading`;
    document.getElementById("factoryTrustStatus").innerHTML = `<strong>Whitelist Status:</strong> Error loading`;
  }
});

// Expandable section functionality
function toggleSection(sectionId) {
  const content = document.getElementById(sectionId);
  const button = content.previousElementSibling;

  if (content.classList.contains("show")) {
    content.classList.remove("show");
    button.textContent = button.textContent.replace("▼", "▶");
  } else {
    content.classList.add("show");
    button.textContent = button.textContent.replace("▶", "▼");
  }
}

// Factory selection functionality
document.addEventListener("DOMContentLoaded", function () {
  const checkbox = document.getElementById("useRecommendedFactory");
  const customInput = document.getElementById("customFactoryAddress");

  checkbox.addEventListener("change", function () {
    if (this.checked) {
      customInput.disabled = true;
      customInput.value = "";
      // Get the recommended factory address from the recommendedFactory element
      const recommendedFactoryText = document.getElementById("recommendedFactory").innerText;
      selectedFactoryAddress = recommendedFactoryText.split(": ")[1].split(" ")[0]; // Get address before "View on Etherscan"
    } else {
      customInput.disabled = false;
    }
  });

  customInput.addEventListener("input", function () {
    if (!checkbox.checked) {
      selectedFactoryAddress = this.value;
      const responseDiv = document.getElementById("customFactoryResponse");
      if (web3.utils.isAddress(this.value)) {
        responseDiv.innerHTML = `<span style="color: green;">✓ Valid factory address: ${this.value}</span>`;
      } else if (this.value.length > 0) {
        responseDiv.innerHTML = `<span style="color: red;">✗ Invalid factory address</span>`;
      } else {
        responseDiv.innerHTML = "";
      }
    }
  });

  // Clone address input listeners
  const hostCloneInput = document.getElementById("hostCloneAddress");
  const playerCloneInput = document.getElementById("playerCloneAddress");
  const universalCloneInput = document.getElementById("universalCloneAddress");

  hostCloneInput.addEventListener("input", function () {
    const isValid = web3.utils.isAddress(this.value);
    document.getElementById("hostCloneStatus").innerText = isValid ? `Status: Active - ${this.value}` : "Status: Invalid address";
    if (isValid) {
      cloneInstanceAddress = this.value;
      // Listen to events for this clone instance
      const response = fetch("/contract-data")
        .then((res) => res.json())
        .then((contractData) => {
          listenToCloneEvents(this.value, contractData.numericalGameABI);
        });
    }
  });

  playerCloneInput.addEventListener("input", function () {
    const isValid = web3.utils.isAddress(this.value);
    document.getElementById("playerCloneStatus").innerText = isValid ? `Status: Active - ${this.value}` : "Status: Invalid address";
    if (isValid) {
      cloneInstanceAddress = this.value;
      // Listen to events for this clone instance
      const response = fetch("/contract-data")
        .then((res) => res.json())
        .then((contractData) => {
          listenToCloneEvents(this.value, contractData.numericalGameABI);
        });
    }
  });

  universalCloneInput.addEventListener("input", function () {
    const isValid = web3.utils.isAddress(this.value);
    document.getElementById("universalCloneStatus").innerText = isValid ? `Status: Active - ${this.value}` : "Status: Invalid address";
    document.getElementById("readUniversalRefunds").disabled = !isValid;
    document.getElementById("withdrawUniversalRefunds").disabled = !isValid;
    if (isValid) {
      // Listen to events for this clone instance
      const response = fetch("/contract-data")
        .then((res) => res.json())
        .then((contractData) => {
          listenToCloneEvents(this.value, contractData.numericalGameABI);
        });
    }
  });

  // Verify address input listener
  const verifyAddressInput = document.getElementById("verifyAddress");
  verifyAddressInput.addEventListener("input", function () {
    const isValid = web3.utils.isAddress(this.value);
    document.getElementById("verifyOwnership").disabled = !isValid;
  });
});

async function connectWallet(buttonId) {
  if (window.ethereum) {
    try {
      // Disconnect current account
      await window.ethereum.request({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] });
      // Request new connection with proper error handling
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" }).catch((error) => {
        throw new Error(`Failed to get accounts: ${error.message}`);
      });
      const account = accounts[0];

      web3 = new Web3(window.ethereum);
      const response = await fetch("/contract-data");
      const contractData = await response.json();

      // Check if template owner for template owner box
      if (buttonId === "connectWalletTemplate") {
        const templateContract = new web3.eth.Contract(contractData.numericalGameABI, contractData.templateAddress);
        const templateOwner = await templateContract.methods.templateOwner().call();

        if (account.toLowerCase() !== templateOwner.toLowerCase()) {
          document.getElementById("statusTemplate").innerText = "Error: Only template owner can connect to this box!";
          return;
        }
      }

      // Update status based on the button clicked
      if (buttonId === "connectWalletHost") {
        accountHost = account;
        document.getElementById("statusHost").innerText = `Connected: ${accountHost}`;
        if (accountPlayer) {
          document.getElementById("statusPlayer").innerText = "Not connected";
          // Disable player buttons
          document.getElementById("commit").disabled = true;
          document.getElementById("reveal").disabled = true;
          document.getElementById("determineWinnerPlayer").disabled = true;
        }
        if (accountTemplate) {
          document.getElementById("statusTemplate").innerText = "Not connected";
          // Disable template buttons
          document.getElementById("addCloneFactory").disabled = true;
          document.getElementById("removeCloneFactory").disabled = true;
          document.getElementById("checkTrustStatus").disabled = true;
          document.getElementById("withdrawTemplateBalance").disabled = true;
          document.getElementById("readTemplateBalance").disabled = true;
        }
        if (accountUniversal) {
          document.getElementById("statusUniversal").innerText = "Not connected";
          // Disable universal buttons
          document.getElementById("readUniversalRefunds").disabled = true;
          document.getElementById("withdrawUniversalRefunds").disabled = true;
        }
      } else if (buttonId === "connectWalletPlayer") {
        accountPlayer = account;
        document.getElementById("statusPlayer").innerText = `Connected: ${accountPlayer}`;
        if (accountHost) {
          document.getElementById("statusHost").innerText = "Not connected";
          // Disable host buttons
          document.getElementById("createClone").disabled = true;
          document.getElementById("initGame").disabled = true;
          document.getElementById("determineWinner").disabled = true;
          document.getElementById("withdrawCloneBalance").disabled = true;
          document.getElementById("readCloneBalance").disabled = true;
          document.getElementById("hostCheckTrustStatus").disabled = true;
        }
        if (accountTemplate) {
          document.getElementById("statusTemplate").innerText = "Not connected";
          // Disable template buttons
          document.getElementById("addCloneFactory").disabled = true;
          document.getElementById("removeCloneFactory").disabled = true;
          document.getElementById("checkTrustStatus").disabled = true;
          document.getElementById("withdrawTemplateBalance").disabled = true;
          document.getElementById("readTemplateBalance").disabled = true;
        }
        if (accountUniversal) {
          document.getElementById("statusUniversal").innerText = "Not connected";
          // Disable universal buttons
          document.getElementById("readUniversalRefunds").disabled = true;
          document.getElementById("withdrawUniversalRefunds").disabled = true;
        }
      } else if (buttonId === "connectWalletTemplate") {
        accountTemplate = account;
        document.getElementById("statusTemplate").innerText = `Connected: ${accountTemplate}`;
        if (accountHost) {
          document.getElementById("statusHost").innerText = "Not connected";
          // Disable host buttons
          document.getElementById("createClone").disabled = true;
          document.getElementById("initGame").disabled = true;
          document.getElementById("determineWinner").disabled = true;
          document.getElementById("withdrawCloneBalance").disabled = true;
          document.getElementById("readCloneBalance").disabled = true;
          document.getElementById("hostCheckTrustStatus").disabled = true;
        }
        if (accountPlayer) {
          document.getElementById("statusPlayer").innerText = "Not connected";
          // Disable player buttons
          document.getElementById("commit").disabled = true;
          document.getElementById("reveal").disabled = true;
          document.getElementById("determineWinnerPlayer").disabled = true;
        }
        if (accountUniversal) {
          document.getElementById("statusUniversal").innerText = "Not connected";
          // Disable universal buttons
          document.getElementById("readUniversalRefunds").disabled = true;
          document.getElementById("withdrawUniversalRefunds").disabled = true;
        }
      } else if (buttonId === "connectWalletUniversal") {
        accountUniversal = account;
        document.getElementById("statusUniversal").innerText = `Connected: ${accountUniversal}`;
        if (accountHost) {
          document.getElementById("statusHost").innerText = "Not connected";
          // Disable host buttons
          document.getElementById("createClone").disabled = true;
          document.getElementById("initGame").disabled = true;
          document.getElementById("determineWinner").disabled = true;
          document.getElementById("withdrawCloneBalance").disabled = true;
          document.getElementById("readCloneBalance").disabled = true;
          document.getElementById("hostCheckTrustStatus").disabled = true;
        }
        if (accountPlayer) {
          document.getElementById("statusPlayer").innerText = "Not connected";
          // Disable player buttons
          document.getElementById("commit").disabled = true;
          document.getElementById("reveal").disabled = true;
          document.getElementById("determineWinnerPlayer").disabled = true;
        }
        if (accountTemplate) {
          document.getElementById("statusTemplate").innerText = "Not connected";
          // Disable template buttons
          document.getElementById("addCloneFactory").disabled = true;
          document.getElementById("removeCloneFactory").disabled = true;
          document.getElementById("checkTrustStatus").disabled = true;
          document.getElementById("withdrawTemplateBalance").disabled = true;
          document.getElementById("readTemplateBalance").disabled = true;
        }
      }

      // Initialize factory contract with selected address
      cloneFactoryContract = new web3.eth.Contract(contractData.cloneFactoryABI, selectedFactoryAddress || contractData.cloneFactoryAddress);

      // Enable buttons based on connection - only enable buttons for the connected box
      if (buttonId === "connectWalletHost") {
        document.getElementById("createClone").disabled = false;
        document.getElementById("initGame").disabled = false;
        document.getElementById("determineWinner").disabled = false;
        document.getElementById("withdrawCloneBalance").disabled = false;
        document.getElementById("readCloneBalance").disabled = false;
        document.getElementById("hostCheckTrustStatus").disabled = false;
      } else if (buttonId === "connectWalletTemplate") {
        document.getElementById("addCloneFactory").disabled = false;
        document.getElementById("removeCloneFactory").disabled = false;
        document.getElementById("checkTrustStatus").disabled = false;
        document.getElementById("withdrawTemplateBalance").disabled = false;
        document.getElementById("readTemplateBalance").disabled = false;
      } else if (buttonId === "connectWalletPlayer") {
        document.getElementById("commit").disabled = false;
        document.getElementById("reveal").disabled = false;
        document.getElementById("determineWinnerPlayer").disabled = false;
      } else if (buttonId === "connectWalletUniversal") {
        document.getElementById("readUniversalRefunds").disabled = false;
        document.getElementById("withdrawUniversalRefunds").disabled = false;
      }

      // Listen for events if host is connected
      if (accountHost) {
        await listenForEvents(accountHost, contractData.numericalGameABI);
        startGameDataUpdates();
      }
    } catch (error) {
      console.error("Connection error handled:", error);
      if (buttonId === "connectWalletHost") {
        document.getElementById("statusHost").innerText = `Error: ${error.message}`;
      } else if (buttonId === "connectWalletPlayer") {
        document.getElementById("statusPlayer").innerText = `Error: ${error.message}`;
      } else if (buttonId === "connectWalletTemplate") {
        document.getElementById("statusTemplate").innerText = `Error: ${error.message}`;
      } else if (buttonId === "connectWalletUniversal") {
        document.getElementById("statusUniversal").innerText = `Error: ${error.message}`;
      }
    }
  } else {
    if (buttonId === "connectWalletHost") {
      document.getElementById("statusHost").innerText = "Please install MetaMask!";
    } else if (buttonId === "connectWalletPlayer") {
      document.getElementById("statusPlayer").innerText = "Please install MetaMask!";
    } else if (buttonId === "connectWalletTemplate") {
      document.getElementById("statusTemplate").innerText = "Please install MetaMask!";
    } else if (buttonId === "connectWalletUniversal") {
      document.getElementById("statusUniversal").innerText = "Please install MetaMask!";
    }
  }
}

// Template Owner Functions
async function addCloneFactory() {
  try {
    const factoryAddress = document.getElementById("addFactoryAddress").value;
    if (!web3.utils.isAddress(factoryAddress)) {
      showSingleAlert("Please enter a valid factory address!");
      return;
    }

    const response = await fetch("/contract-data");
    const contractData = await response.json();
    const templateContract = new web3.eth.Contract(contractData.numericalGameABI, contractData.templateAddress);

    await templateContract.methods.addCloneFactory(factoryAddress).call({ from: accountTemplate });
    await templateContract.methods.addCloneFactory(factoryAddress).send({ from: accountTemplate });
    showSingleAlert("Clone factory added to whitelist successfully!");

    // Update trust status
    const isTrusted = await templateContract.methods.getIsTrustedCloneFactory(factoryAddress).call();
    document.getElementById("factoryTrustStatus").innerHTML = `<strong>Whitelist Status:</strong> ${isTrusted ? "True" : "False"}`;
  } catch (error) {
    showSingleAlert(extractRevertReason(error));
  }
}

async function removeCloneFactory() {
  try {
    const factoryAddress = document.getElementById("removeFactoryAddress").value;
    if (!web3.utils.isAddress(factoryAddress)) {
      showSingleAlert("Please enter a valid factory address!");
      return;
    }

    const response = await fetch("/contract-data");
    const contractData = await response.json();
    const templateContract = new web3.eth.Contract(contractData.numericalGameABI, contractData.templateAddress);

    await templateContract.methods.removeCloneFactory(factoryAddress).call({ from: accountTemplate });
    await templateContract.methods.removeCloneFactory(factoryAddress).send({ from: accountTemplate });
    showSingleAlert("Clone factory removed from whitelist successfully!");

    // Update trust status
    const isTrusted = await templateContract.methods.getIsTrustedCloneFactory(factoryAddress).call();
    document.getElementById("factoryTrustStatus").innerHTML = `<strong>Whitelist Status:</strong> ${isTrusted ? "True" : "False"}`;
  } catch (error) {
    showSingleAlert(extractRevertReason(error));
  }
}

async function checkTrustStatus() {
  try {
    const factoryAddress = document.getElementById("checkTrustAddress").value;
    if (!web3.utils.isAddress(factoryAddress)) {
      showSingleAlert("Please enter a valid factory address!");
      return;
    }

    const response = await fetch("/contract-data");
    const contractData = await response.json();
    const templateContract = new web3.eth.Contract(contractData.numericalGameABI, contractData.templateAddress);

    const isTrusted = await templateContract.methods.getIsTrustedCloneFactory(factoryAddress).call();
    showSingleAlert(`Return value: ${isTrusted}`);
  } catch (error) {
    showSingleAlert(extractRevertReason(error));
  }
}

async function withdrawTemplateBalance() {
  try {
    const response = await fetch("/contract-data");
    const contractData = await response.json();
    const templateContract = new web3.eth.Contract(contractData.numericalGameABI, contractData.templateAddress);

    await templateContract.methods.withdrawBalanceFromTemplate().call({ from: accountTemplate });
    await templateContract.methods.withdrawBalanceFromTemplate().send({ from: accountTemplate });
    showSingleAlert("Template balance withdrawn successfully!");
  } catch (error) {
    showSingleAlert(extractRevertReason(error));
  }
}

async function getTemplateBalance() {
  try {
    const response = await fetch("/contract-data");
    const contractData = await response.json();
    const templateContract = new web3.eth.Contract(contractData.numericalGameABI, contractData.templateAddress);

    const balance = await templateContract.methods.getContractBalance().call();
    showSingleAlert(`Return value: ${web3.utils.fromWei(balance, "ether")} ETH`);
  } catch (error) {
    showSingleAlert(extractRevertReason(error));
  }
}

// Game Host Functions
async function listenForEvents(account, numericalGameABI) {
  try {
    // Clear existing subscriptions
    eventSubscriptions.forEach((sub) => sub.unsubscribe());
    eventSubscriptions = [];

    const cloneAddress = await cloneFactoryContract.methods.cloneInstanceAddrByOwner(account).call();
    if (cloneAddress !== "0x0000000000000000000000000000000000000000") {
      cloneInstanceAddress = cloneAddress;
      // Listen to events for the host's clone instance
      listenToCloneEvents(cloneAddress, numericalGameABI);
    }

    // Also listen to clone factory events
    cloneFactoryContract.events.CloneCreated().on("data", (event) => {
      showSingleAlert(`Clone Created: Clone=${event.returnValues.clone}, Owner=${event.returnValues.owner}`);
    });
  } catch (error) {
    console.error("Event listening error:", error);
  }
}

async function createClone() {
  try {
    await cloneFactoryContract.methods.createClone().call({ from: accountHost });
    await cloneFactoryContract.methods.createClone().send({ from: accountHost });
    showSingleAlert("Clone created successfully!");

    // Refresh clone address after creation
    const cloneAddress = await cloneFactoryContract.methods.cloneInstanceAddrByOwner(accountHost).call();
    cloneInstanceAddress = cloneAddress;
    document.getElementById("verifyResult").innerText = `Clone created: ${cloneAddress}`;

    // Update clone initialization status
    await updateCloneInitializationStatus();
  } catch (error) {
    showSingleAlert(extractRevertReason(error));
  }
}

async function updateCloneInitializationStatus() {
  if (!cloneInstanceAddress) return;

  try {
    const response = await fetch("/contract-data");
    const contractData = await response.json();
    const cloneContract = new web3.eth.Contract(contractData.numericalGameABI, cloneInstanceAddress);

    const isInitialized = await cloneContract.methods.cloneIsInitialized().call();
    document.getElementById("cloneInitialized").innerText = `Clone initialized: ${isInitialized ? "True" : "False"}`;
  } catch (error) {
    console.error("Error updating clone initialization status:", error);
    document.getElementById("cloneInitialized").innerText = "Clone initialized: Error";
  }
}

async function initializeNewGame() {
  try {
    const cloneAddress = document.getElementById("hostCloneAddress").value;
    if (!web3.utils.isAddress(cloneAddress)) {
      showSingleAlert("Please enter a valid clone instance address!");
      return;
    }

    const playerAmount = document.getElementById("playerAmount").value;
    const buyIn = document.getElementById("buyIn").value;
    const serviceFee = document.getElementById("serviceFee").value;
    const commitPhase = document.getElementById("commitPhase").value;
    const revealPhase = document.getElementById("revealPhase").value;

    if (!playerAmount || !buyIn || !serviceFee || !commitPhase || !revealPhase) {
      showSingleAlert("Please fill all fields for initializing a game!");
      return;
    }

    const response = await fetch("/contract-data");
    const contractData = await response.json();
    const cloneContract = new web3.eth.Contract(contractData.numericalGameABI, cloneAddress);

    await cloneContract.methods.startNewGame(playerAmount, buyIn, serviceFee, commitPhase, revealPhase).call({ from: accountHost });
    await cloneContract.methods.startNewGame(playerAmount, buyIn, serviceFee, commitPhase, revealPhase).send({ from: accountHost });

    showSingleAlert("Game initialized successfully!");
  } catch (error) {
    showSingleAlert(extractRevertReason(error));
  }
}

async function determineWinner() {
  try {
    const cloneAddress = document.getElementById("hostCloneAddress").value;
    if (!web3.utils.isAddress(cloneAddress)) {
      showSingleAlert("Please enter a valid clone instance address!");
      return;
    }

    const response = await fetch("/contract-data");
    const contractData = await response.json();
    const cloneContract = new web3.eth.Contract(contractData.numericalGameABI, cloneAddress);

    // Simulate call to get revert reason
    await cloneContract.methods.determineWinnerAndEndGame().call({ from: accountHost });
    await cloneContract.methods.determineWinnerAndEndGame().send({ from: accountHost });
  } catch (error) {
    showSingleAlert(extractRevertReason(error));
  }
}

async function withdrawCloneBalance() {
  try {
    console.log("=== withdrawCloneBalance called ===");
    console.log("accountHost:", accountHost);
    console.log("web3 available:", !!web3);

    if (!accountHost) {
      console.error("No accountHost available");
      showSingleAlert("Error: No host account connected!");
      return;
    }

    const cloneAddress = document.getElementById("hostCloneAddress").value;
    console.log("Clone address from input:", cloneAddress);

    if (!cloneAddress) {
      console.error("No clone address entered");
      showSingleAlert("Please enter a clone instance address!");
      return;
    }

    if (!web3.utils.isAddress(cloneAddress)) {
      console.error("Invalid clone address:", cloneAddress);
      showSingleAlert("Please enter a valid clone instance address!");
      return;
    }

    console.log("Fetching contract data...");
    const response = await fetch("/contract-data");
    const contractData = await response.json();
    console.log("Contract data received, template address:", contractData.templateAddress);

    const cloneContract = new web3.eth.Contract(contractData.numericalGameABI, cloneAddress);
    console.log("Clone contract created for address:", cloneAddress);

    // Simulate call to get revert reason
    console.log("Simulating call with accountHost:", accountHost);
    await cloneContract.methods.withdrawBalanceFromClone().call({ from: accountHost });
    console.log("Call simulation successful, sending transaction...");

    const tx = await cloneContract.methods.withdrawBalanceFromClone().send({ from: accountHost });
    console.log("Transaction sent successfully:", tx);
    showSingleAlert("Clone balance withdrawn successfully!");
  } catch (error) {
    console.error("withdrawCloneBalance error:", error);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    showSingleAlert(extractRevertReason(error));
  }
}

async function getCloneBalance() {
  try {
    const cloneAddress = document.getElementById("hostCloneAddress").value;
    if (!web3.utils.isAddress(cloneAddress)) {
      showSingleAlert("Please enter a valid clone address!");
      return;
    }

    if (!accountHost) {
      showSingleAlert("Error: No host account connected!");
      return;
    }

    const response = await fetch("/contract-data");
    const contractData = await response.json();
    const cloneContract = new web3.eth.Contract(contractData.numericalGameABI, cloneAddress);

    // Call refundsAndPayoutsByAddr() with the selected clone instance address as parameter
    const unallocatedBalance = await cloneContract.methods.refundsAndPayoutsByAddr(cloneAddress).call();
    showSingleAlert(`Unallocated Balance for Clone ${cloneAddress.slice(0, 10)}...: ${web3.utils.fromWei(unallocatedBalance, "ether")} ETH`);
  } catch (error) {
    showSingleAlert(extractRevertReason(error));
  }
}

// Player Functions
async function commit() {
  try {
    const cloneAddress = document.getElementById("playerCloneAddress").value;
    if (!web3.utils.isAddress(cloneAddress)) {
      showSingleAlert("Please enter a valid clone instance address!");
      return;
    }

    const secretNumber = document.getElementById("secretNumber").value;
    const value = document.getElementById("commitValue").value;

    if (!secretNumber.match(/^0x[0-9a-fA-F]{64}$/)) {
      showSingleAlert('Secret Number must be a valid bytes32 (e.g., "0x" + 64 hex chars)');
      return;
    }
    if (!value) {
      showSingleAlert("Please enter a valid value in Wei!");
      return;
    }

    const response = await fetch("/contract-data");
    const contractData = await response.json();
    const cloneContract = new web3.eth.Contract(contractData.numericalGameABI, cloneAddress);

    await cloneContract.methods.commit(secretNumber).call({ from: accountPlayer, value });
    await cloneContract.methods.commit(secretNumber).send({ from: accountPlayer, value });
    showSingleAlert("Commitment successful!");

    // Update player counts after commit
    setTimeout(updatePlayerCounts, 2000);
  } catch (error) {
    showSingleAlert(extractRevertReason(error));
  }
}

async function revealAndVerify() {
  try {
    const cloneAddress = document.getElementById("playerCloneAddress").value;
    if (!web3.utils.isAddress(cloneAddress)) {
      showSingleAlert("Please enter a valid clone instance address!");
      return;
    }

    const number = document.getElementById("number").value;
    const salt = document.getElementById("salt").value;

    if (!number) {
      showSingleAlert("Please enter a valid number!");
      return;
    }
    if (!salt) {
      showSingleAlert("Please enter a salt string (e.g., 'mySecretSalt')!");
      return;
    }

    const response = await fetch("/contract-data");
    const contractData = await response.json();
    const cloneContract = new web3.eth.Contract(contractData.numericalGameABI, cloneAddress);

    await cloneContract.methods.revealAndVerify(number, salt).call({ from: accountPlayer });
    await cloneContract.methods.revealAndVerify(number, salt).send({ from: accountPlayer });
    showSingleAlert("Reveal successful!");

    // Update player counts after reveal
    setTimeout(updatePlayerCounts, 2000);
  } catch (error) {
    showSingleAlert(extractRevertReason(error));
  }
}

async function determineWinnerPlayer() {
  try {
    const cloneAddress = document.getElementById("playerCloneAddress").value;
    if (!web3.utils.isAddress(cloneAddress)) {
      showSingleAlert("Please enter a valid clone instance address!");
      return;
    }

    const response = await fetch("/contract-data");
    const contractData = await response.json();
    const cloneContract = new web3.eth.Contract(contractData.numericalGameABI, cloneAddress);

    // Simulate call to get revert reason
    await cloneContract.methods.determineWinnerAndEndGame().call({ from: accountPlayer });
    await cloneContract.methods.determineWinnerAndEndGame().send({ from: accountPlayer });
  } catch (error) {
    showSingleAlert(extractRevertReason(error));
  }
}

// Hash Generator Functions
function toggleHashGenerator() {
  const section = document.getElementById("hashGeneratorSection");
  section.style.display = section.style.display === "none" ? "block" : "none";
}

function generateHash() {
  const numberInput = document.getElementById("hashNumber").value;
  const salt = document.getElementById("hashSalt").value;

  if (!numberInput || !salt) {
    showSingleAlert("Please enter both a number and a salt!");
    return;
  }

  // Ensure proper string conversion - convert to number first, then to string
  const number = parseInt(numberInput, 10);
  if (isNaN(number) || number < 0 || number > 1000) {
    showSingleAlert("The number must be between 0 and 1000!");
    return;
  }

  // Convert number to string explicitly
  const numberStr = number.toString();

  // Create hash exactly like the smart contract: sha256(abi.encodePacked(_salt, numberStr))
  const concatenated = salt + numberStr;

  // Use SHA-256 - convert string to bytes and hash
  const encoder = new TextEncoder();
  const data = encoder.encode(concatenated);

  // Use crypto.subtle.digest for SHA-256
  crypto.subtle.digest("SHA-256", data).then((hashBuffer) => {
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = "0x" + hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    document.getElementById("hashResult").innerHTML = `
      <strong>Generated Hash:</strong><br>
      ${hashHex}
    `;
  });
}

// Game Data and Timer Functions
function startGameDataUpdates() {
  if (gameDataInterval) clearInterval(gameDataInterval);
  if (timerInterval) clearInterval(timerInterval);

  gameDataInterval = setInterval(updateGameData, 5000); // Update every 5 seconds
  timerInterval = setInterval(updateTimers, 1000); // Update timers every second

  updateGameData();
  updateTimers();
}

function stopGameDataUpdates() {
  if (gameDataInterval) clearInterval(gameDataInterval);
  if (timerInterval) clearInterval(timerInterval);

  // Reset display
  document.getElementById("cloneInstanceAddress").innerText = "Clone Instance Address: -";
  document.getElementById("cloneInstanceOwner").innerText = "Clone Instance Owner: -";
  document.getElementById("gameStatus").innerText = "No active game";
  document.getElementById("gameCount").innerText = "Game Count: -";
  document.getElementById("requiredPlayers").innerText = "Required Players: -";
  document.getElementById("buyInAmount").innerText = "Buy-In: -";
  document.getElementById("prizeAmount").innerText = "Prize Amount: -";
  document.getElementById("serviceFeeAmount").innerText = "Service Fee: -";
  document.getElementById("commitPhaseTimer").innerText = "Commit Phase: Not active";
  document.getElementById("playersCommitted").innerText = "Players Committed: -";
  document.getElementById("revealPhaseTimer").innerText = "Reveal Phase: Not active";
  document.getElementById("playersRevealed").innerText = "Players Revealed: -";
  document.getElementById("timeoutTimer").innerText = "24h Timeout: Not active";
}

async function updateGameData() {
  if (!cloneInstanceAddress) return;

  try {
    const response = await fetch("/contract-data");
    const contractData = await response.json();
    const cloneContract = new web3.eth.Contract(contractData.numericalGameABI, cloneInstanceAddress);

    const gameIsActive = await cloneContract.methods.gameIsActive().call();
    const gameCount = await cloneContract.methods.gameCount().call();
    const requiredPlayerAmount = await cloneContract.methods.requiredPlayerAmount().call();
    const buyIn = await cloneContract.methods.buyIn().call();
    const prizeAmount = await cloneContract.methods.prizeAmount().call();
    const serviceFee = await cloneContract.methods.serviceFee().call();
    const cloneInstanceOwner = await cloneContract.methods.cloneInstanceOwner().call();

    document.getElementById("cloneInstanceAddress").innerText = `Clone Instance Address: ${cloneInstanceAddress}`;
    document.getElementById("cloneInstanceOwner").innerText = `Clone Instance Owner: ${cloneInstanceOwner}`;
    document.getElementById("gameStatus").innerText = gameIsActive ? "Game is Active" : "No active game";
    document.getElementById("gameCount").innerText = `Game #${gameCount}`;
    document.getElementById("requiredPlayers").innerText = `Required Players: ${requiredPlayerAmount}`;
    document.getElementById("buyInAmount").innerText = `Buy-In: ${web3.utils.fromWei(buyIn, "ether")} ETH`;
    document.getElementById("prizeAmount").innerText = `Prize Amount: ${web3.utils.fromWei(prizeAmount, "ether")} ETH`;
    document.getElementById("serviceFeeAmount").innerText = `Service Fee: ${web3.utils.fromWei(serviceFee, "ether")} ETH`;

    // Update player counts
    await updatePlayerCounts();
  } catch (error) {
    console.error("Error updating game data:", error);
  }
}

async function updatePlayerCounts() {
  if (!cloneInstanceAddress) return;

  try {
    const response = await fetch("/contract-data");
    const contractData = await response.json();
    const cloneContract = new web3.eth.Contract(contractData.numericalGameABI, cloneInstanceAddress);

    const requiredPlayerAmount = await cloneContract.methods.requiredPlayerAmount().call();

    // Count committed players
    let committedCount = 0;
    for (let i = 0; i < 25; i++) {
      try {
        await cloneContract.methods.addrCommitted(i).call();
        committedCount++;
      } catch {
        break;
      }
    }

    // Count revealed players
    let revealedCount = 0;
    for (let i = 0; i < 25; i++) {
      try {
        await cloneContract.methods.addrRevealedSuccessful(i).call();
        revealedCount++;
      } catch {
        break;
      }
    }

    document.getElementById("playersCommitted").innerText = `Players Committed: ${committedCount}/${requiredPlayerAmount}`;
    document.getElementById("playersRevealed").innerText = `Players Revealed: ${revealedCount}/${requiredPlayerAmount}`;
  } catch (error) {
    console.error("Error updating player counts:", error);
  }
}

async function updateTimers() {
  if (!cloneInstanceAddress) return;

  try {
    const response = await fetch("/contract-data");
    const contractData = await response.json();
    const cloneContract = new web3.eth.Contract(contractData.numericalGameABI, cloneInstanceAddress);

    const gameIsActive = await cloneContract.methods.gameIsActive().call();
    if (!gameIsActive) {
      document.getElementById("commitPhaseTimer").innerText = "Commit Phase: Not active";
      document.getElementById("revealPhaseTimer").innerText = "Reveal Phase: Not active";
      document.getElementById("timeoutTimer").innerText = "24h Timeout: Not active";
      return;
    }

    const commitPhaseEnd = await cloneContract.methods.commitPhase_END().call();
    const revealPhaseEnd = await cloneContract.methods.revealPhase_END().call();
    const currentTime = Math.floor(Date.now() / 1000);

    // Commit Phase Timer
    if (currentTime <= commitPhaseEnd) {
      const timeLeft = commitPhaseEnd - currentTime;
      const hours = Math.floor(timeLeft / 3600);
      const minutes = Math.floor((timeLeft % 3600) / 60);
      const seconds = timeLeft % 60;
      const timerElement = document.getElementById("commitPhaseTimer");
      timerElement.innerHTML = `Commit Phase: <span class="${timeLeft < 300 ? "timer-active" : timeLeft < 1800 ? "timer-warning" : "timer-normal"}">${hours}h ${minutes}m ${seconds}s remaining</span>`;
    } else {
      document.getElementById("commitPhaseTimer").innerText = "Commit Phase: Ended";
    }

    // Reveal Phase Timer
    if (currentTime > commitPhaseEnd && currentTime <= revealPhaseEnd) {
      const timeLeft = revealPhaseEnd - currentTime;
      const hours = Math.floor(timeLeft / 3600);
      const minutes = Math.floor((timeLeft % 3600) / 60);
      const seconds = timeLeft % 60;
      const timerElement = document.getElementById("revealPhaseTimer");
      timerElement.innerHTML = `Reveal Phase: <span class="${timeLeft < 300 ? "timer-active" : timeLeft < 1800 ? "timer-warning" : "timer-normal"}">${hours}h ${minutes}m ${seconds}s remaining</span>`;
    } else if (currentTime > revealPhaseEnd) {
      document.getElementById("revealPhaseTimer").innerText = "Reveal Phase: Ended";
    } else {
      document.getElementById("revealPhaseTimer").innerText = "Reveal Phase: Not started";
    }

    // 24h Timeout Timer
    if (currentTime > revealPhaseEnd) {
      const timeoutEnd = parseInt(revealPhaseEnd) + 86400; // 24 hours
      if (currentTime <= timeoutEnd) {
        const timeLeft = timeoutEnd - currentTime;
        const hours = Math.floor(timeLeft / 3600);
        const minutes = Math.floor((timeLeft % 3600) / 60);
        const seconds = timeLeft % 60;
        const timerElement = document.getElementById("timeoutTimer");
        timerElement.innerHTML = `24h Timeout: <span class="${timeLeft < 3600 ? "timer-active" : timeLeft < 21600 ? "timer-warning" : "timer-normal"}">${hours}h ${minutes}m ${seconds}s remaining</span>`;
      } else {
        document.getElementById("timeoutTimer").innerText = "24h Timeout: Expired";
      }
    } else {
      document.getElementById("timeoutTimer").innerText = "24h Timeout: Not active";
    }
  } catch (error) {
    console.error("Error updating timers:", error);
  }
}

async function cloneAddressByOwner() {
  try {
    const ownerAddress = document.getElementById("verifyAddress").value;
    if (!web3.utils.isAddress(ownerAddress)) {
      showSingleAlert("Please enter a valid address!");
      return;
    }

    const response = await fetch("/contract-data");
    const contractData = await response.json();
    // Use the clone factory contract and ABI
    const factoryAddress = selectedFactoryAddress || contractData.cloneFactoryAddress;
    const factoryABI = contractData.cloneFactoryABI;
    const factoryContract = new web3.eth.Contract(factoryABI, factoryAddress);
    const cloneAddress = await factoryContract.methods.cloneInstanceAddrByOwner(ownerAddress).call();
    if (cloneAddress && cloneAddress !== "0x0000000000000000000000000000000000000000") {
      document.getElementById("verifyResult").innerHTML = `Input Address is the Owner of Clone Address: <strong>${cloneAddress}</strong>`;
    } else {
      document.getElementById("verifyResult").innerHTML = "No clone instance found for this address.";
    }
  } catch (error) {
    document.getElementById("verifyResult").innerHTML = `Error: ${error.message}`;
  }
}

async function hostCheckTrustStatus() {
  try {
    const factoryAddress = document.getElementById("hostCheckTrustAddress").value;
    if (!web3.utils.isAddress(factoryAddress)) {
      showSingleAlert("Please enter a valid factory address!");
      return;
    }

    const response = await fetch("/contract-data");
    const contractData = await response.json();
    const templateContract = new web3.eth.Contract(contractData.numericalGameABI, contractData.templateAddress);

    const isTrusted = await templateContract.methods.getIsTrustedCloneFactory(factoryAddress).call();
    showSingleAlert(`Return value: ${isTrusted}`);
  } catch (error) {
    showSingleAlert(extractRevertReason(error));
  }
}

async function getUniversalRefunds() {
  try {
    const cloneAddress = document.getElementById("universalCloneAddress").value;
    if (!web3.utils.isAddress(cloneAddress)) {
      showSingleAlert("Please enter a valid clone address!");
      return;
    }

    const response = await fetch("/contract-data");
    const contractData = await response.json();
    const cloneContract = new web3.eth.Contract(contractData.numericalGameABI, cloneAddress);

    const refunds = await cloneContract.methods.refundsAndPayoutsByAddr(accountUniversal).call();
    showSingleAlert(`Return value: ${web3.utils.fromWei(refunds, "ether")} ETH`);
  } catch (error) {
    showSingleAlert(extractRevertReason(error));
  }
}

async function withdrawUniversalRefunds() {
  try {
    const cloneAddress = document.getElementById("universalCloneAddress").value;
    if (!web3.utils.isAddress(cloneAddress)) {
      showSingleAlert("Please enter a valid clone instance address!");
      return;
    }

    const response = await fetch("/contract-data");
    const contractData = await response.json();
    const cloneContract = new web3.eth.Contract(contractData.numericalGameABI, cloneAddress);

    // Simulate call to get revert reason
    await cloneContract.methods.withdrawRefundsOrPayoutsFromClone().call({ from: accountUniversal });
    await cloneContract.methods.withdrawRefundsOrPayoutsFromClone().send({ from: accountUniversal });
    showSingleAlert("Refunds/payouts withdrawn successfully!");
  } catch (error) {
    showSingleAlert(extractRevertReason(error));
  }
}

// Helper function to extract revert reasons from smart contract errors
function extractRevertReason(error) {
  console.log("Extracting revert reason from error:", error);

  // Check if error has a message property
  if (error.message) {
    // Common patterns for revert reasons in Web3.js errors
    const message = error.message;

    // Pattern 1: "execution reverted: Custom revert message"
    if (message.includes("execution reverted:")) {
      return message.split("execution reverted:")[1].trim();
    }

    // Pattern 2: "VM Exception while processing transaction: revert Custom revert message"
    if (message.includes("VM Exception while processing transaction: revert")) {
      return message.split("revert")[1].trim();
    }

    // Pattern 3: "Returned error: execution reverted: Custom revert message"
    if (message.includes("Returned error: execution reverted:")) {
      return message.split("execution reverted:")[1].trim();
    }

    // Pattern 4: "execution reverted" (no custom message)
    if (message.includes("execution reverted")) {
      return "Transaction reverted by smart contract";
    }

    // If no specific pattern found, return the full message
    return message;
  }

  // If no message property, try to stringify the error
  try {
    return JSON.stringify(error);
  } catch (e) {
    return "Unknown error occurred";
  }
}

// Function to listen to events for any clone instance
function listenToCloneEvents(cloneAddress, numericalGameABI) {
  if (!cloneAddress || !web3.utils.isAddress(cloneAddress)) return;

  try {
    const cloneContract = new web3.eth.Contract(numericalGameABI, cloneAddress);

    // GameStarted event
    cloneContract.events.GameStarted().on("data", (event) => {
      showSingleAlert(`Game Started on ${cloneAddress.slice(0, 10)}...: Players=${event.returnValues.required_PlayerAmount}, Buy-In=${web3.utils.fromWei(event.returnValues.buyIn, "ether")} ETH, Prize=${web3.utils.fromWei(event.returnValues.prizeAmount, "ether")} ETH`);
      if (cloneAddress === cloneInstanceAddress) {
        startGameDataUpdates();
      }
    });

    // PlayerCommitted event
    cloneContract.events.PlayerCommitted().on("data", (event) => {
      showSingleAlert(`Player Committed on ${cloneAddress.slice(0, 10)}...: ${event.returnValues.player}, Secret=${event.returnValues.saltedAndHashedNumber}`);
      if (cloneAddress === cloneInstanceAddress) {
        updatePlayerCounts();
      }
    });

    // PlayerRevealed event
    cloneContract.events.PlayerRevealed().on("data", (event) => {
      showSingleAlert(`Player Revealed on ${cloneAddress.slice(0, 10)}...: ${event.returnValues.player}, Number=${event.returnValues.revealedNumber}`);
      if (cloneAddress === cloneInstanceAddress) {
        updatePlayerCounts();
      }
    });

    // GameResults event
    cloneContract.events.GameResults().on("data", (event) => {
      showSingleAlert(`Game Results on ${cloneAddress.slice(0, 10)}...: Winner=${event.returnValues.winner}, Total Wins=${event.returnValues.totalWins}, Winner's Number=${event.returnValues.winnersNumber}, Target Number=${event.returnValues.targetNumber}`);
    });

    // GameEnded event
    cloneContract.events.GameEnded().on("data", (event) => {
      showSingleAlert(`Game ${event.returnValues.gameCount} ended on ${cloneAddress.slice(0, 10)}...`);
      if (cloneAddress === cloneInstanceAddress) {
        stopGameDataUpdates();
      }
    });

    // Received event
    cloneContract.events.Received().on("data", (event) => {
      showSingleAlert(`Received on ${cloneAddress.slice(0, 10)}...: Sender=${event.returnValues.msgDotSender}, Amount=${web3.utils.fromWei(event.returnValues.amountReceived, "ether")} ETH`);
    });

    // FallbackUsed event
    cloneContract.events.FallbackUsed().on("data", (event) => {
      showSingleAlert(`Fallback Used on ${cloneAddress.slice(0, 10)}...: Sender=${event.returnValues.msgDotSender}, Amount=${web3.utils.fromWei(event.returnValues.amountReceived, "ether")} ETH`);
    });

    // CloneInitialized event
    cloneContract.events.CloneInitialized().on("data", (event) => {
      showSingleAlert(`Clone Initialized: Clone=${event.returnValues.clone}, Owner=${event.returnValues.owner}`);
    });
  } catch (error) {
    console.error("Error setting up event listeners for clone:", cloneAddress, error);
  }
}
