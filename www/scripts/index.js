(function () {
    "use strict";
    var web3 = new Web3();

    // NOTE - This is all that needs to change when switching to a new authority contract.
    var contractAddress = '0xd419eb21a189095dfc596011835bb6227546d748';
    var httpProvider = new web3.providers.HttpProvider('http://localhost:8545');

    var abi = [{"constant":true,"inputs":[],"name":"authType","outputs":[{"name":"authType","type":"uint8"}],"type":"function"},{"constant":true,"inputs":[{"name":"hash","type":"bytes32"}],"name":"signDate","outputs":[{"name":"date","type":"uint256"}],"type":"function"},{"constant":true,"inputs":[],"name":"signers","outputs":[{"name":"","type":"address[]"}],"type":"function"},{"constant":true,"inputs":[{"name":"hash","type":"bytes32"}],"name":"signed","outputs":[{"name":"signed","type":"bool"}],"type":"function"},{"constant":false,"inputs":[{"name":"hash","type":"bytes32"}],"name":"sign","outputs":[{"name":"error","type":"uint8"}],"type":"function"},{"constant":true,"inputs":[{"name":"addr","type":"address"}],"name":"isSigner","outputs":[{"name":"","type":"bool"}],"type":"function"},{"constant":true,"inputs":[{"name":"hash","type":"bytes32"},{"name":"signer","type":"address"}],"name":"signedBy","outputs":[{"name":"signedBy","type":"bool"}],"type":"function"},{"constant":true,"inputs":[{"name":"hash","type":"bytes32"}],"name":"hashData","outputs":[{"name":"data","type":"uint256"}],"type":"function"},{"inputs":[{"name":"signers","type":"address[]"}],"type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"name":"hash","type":"bytes32"},{"indexed":true,"name":"error","type":"uint256"}],"name":"Sign","type":"event"}];
    var hashRE = new RegExp('^(0[xX])?[0-9a-fA-F]{64}$');
    var contract;

    var signers;

    var accounts;
    var currentAddress = 0;

    $(document).ready(function () {

        web3.setProvider(httpProvider);
        try {
            // Set the user address and the web3 default sender address to coinbase.
            accounts = web3.eth.accounts;
            currentAddress = web3.eth.defaultAccount = accounts[0];
        } catch (error) {
            alert("Failed to connect to ethereum node over RPC;\nthe app will not function.");
            return;
        }

        // Display the address in the footer.
        addAccounts(accounts);
        // Create a web3 contract and point it to 'contractAddress'.
        contract = web3.eth.contract(abi).at(contractAddress);

        // Get the 'Type' from the contract. This needs to be 1
        // or the contract is not valid.
        var authType = contract.authType().toNumber();
        var authTypeName = "";
        if (authType === 2)
            authTypeName = "Multi-signature Authority";
        else {
            alert("Failed to read authority contract type;\nthe app will not function.");
            return;
        }

        // Get the signer address from the contract. This is the address that
        // is used to sign hashes. If this fails, the contract is not valid.
        // If this succeeds, and the caller is the signer, add a 'sign' button
        // that allows the user to sign hashes through the UI.
        signers = contract.signers();
        if (!signers || signers.length == 0) {
            alert("Failed to read authority contract signer;\nthe app will not function.");
            return;
        }
        addAuthorizedSigners(signers);

        $("#ms-authority-type").html(authTypeName);
        $("#ms-authority-contract").html(contractAddress);

        // No errors means we can now display the page.
        $.mobile.changePage( "#main-page", { transition: "pop" });
    });

    $("#check-hash-button").click(function (event) {

        // Get the hash from the input field.
        $("#hash-data-hash").html("");
        $("#current-signatures").empty().listview('refresh');

        $("#hash-data-signed").html("No");
        var hash = $("#hash-input").val().trim();
        if(hash) {
            event.preventDefault();
            // Check that the hash is valid.
            if(!hashRE.exec(hash)) {
                return;
            }
            // Get the hash timestamp from the contract. A timestamp of 0 means
            // the hash is not signed.
            contract.signDate(hash, function(err, ts){
                if (err) {
                    console.error(err);
                    alert("Failed to read hash from blockchain:\n" + err.message + "\n");
                    return;
                }
                // Show the results.
                var timestamp = ts.toNumber();
                $("#hash-data-hash").html(hash);
                $("#hash-data-signed").html(timestamp !== 0 ? new Date(timestamp*1000).toString() : "No");
                var hashData = contract.hashData(hash);
                console.log(hashData.toString(16));
                var sArr = [];
                for(var i = 0; i < signers.length; i++) {
                    var sect = Math.floor(i / 8);
                    console.log(sect);
                    var posInSect = i & 8;
                    console.log(posInSect);
                    var shifted = hashData.div(new BigNumber(2).pow(i));
                    var num = shifted.mod(2).toNumber();
                    console.log(num);
                    if(num)
                        sArr.push(signers[i]);
                }
                addHashSigners(sArr);
            });
        }
    });

    $("#sign-hash-button").click(function (event) {

        // Get the hash from the input field.
        var hash = $("#hash-input").val().trim();

        if(hash) {
            event.preventDefault();
            // Match
            if(!hashRE.exec(hash)) {
                return;
            }

            // Get the hash timestamp from the contract. A timestamp of 0 means
            // the hash is not signed.
            contract.signDate(hash, function(err, ts){
                if (err) {
                    console.error(err);
                    alert("Failed to read hash from blockchain:\n" + err.message + "\n");
                    return;
                }

                var timestamp = ts.toNumber();
                // Don't send if we can see now that the hash is already signed,
                // meaning the transaction would just return an error.
                if (timestamp) {
                    alert("Hash already signed.");
                    return;
                }

                // Estimate gas.
                var gasEstimate = contract.sign.estimateGas(hash);

                var from = $( "#my-address option:selected" ).text();

                // Run it by the user before sending.
                if (!verifySend(gasEstimate, from))
                    return;

                // Prepare the event-listener.
                var cEvent = contract.Sign();

                var txHash = "";

                if (!from) {
                    alert("Error when reading the address. Please reload the page.");
                    return;
                }
                // Sign the hash.
                contract.sign(hash, {from: from}, function(err, txHash){
                    if (err) {
                        console.error(err);
                        cEvent.stopWatching();
                        alert("Error when sending transaction:\n\n" + err.toString());
                        return;
                    }
                    // Subscribe to the event generated by this transaction.
                    sub(cEvent, txHash);
                    // Show the transaction in the transaction list.
                    addTx("Sign: " + hash, txHash);

                    // Clear the hash display data.
                    $("#hash-data-hash").html("");
                    $("#hash-data-signed").html("No");
                    // Alert the user that the transaction was successfully sent.
                    alert("Transaction sent.");
                });

            });
        }


    });

    $( "#my-address" )[0].onchange = function( event ) {
        var addr = event.target.value;
        var isAuth = false;
        for (var i = 0; i < accounts.length; i++) {
            if (accounts[i] === addr) {
                isAuth = true;
                break;
            }
        }
        var signBtn = $("#sign-hash-button");
        isAuth ? signBtn.show() : signBtn.hide();
    };

    function verifySend(gasEstimate, from){
        var confirm = window.prompt("Estimated gas-cost for transaction: " + gasEstimate.toString() +
            "\nWith a gas-price of 20 GWei, the estimated cost is:\n\n" +
            new BigNumber(gasEstimate).times("20000000000").div("1000000000000000000").toString() + " Ether.\n\n" +
            "DISCLAIMER\n\n" +
            "The transaction will be sent from the account with address\n'" + from + "', \n" +
            "which has to be unlocked and have the required balance.\n" +
            "The value of this transaction is 0, meaning no ether is\n" +
            "transferred from the sender to the target account.\n\n" +
            "If value is somehow transfered, for example by tampering\n" +
            "with the javascript, there is no way to return the funds.\n" +
            "Do not use this unless you know what you're doing.\n\n" +
            "To proceed with the transaction, type 'Send' in the textfield.","");
        if (!confirm || confirm !== "Send") {
            console.log("Aborting");
            alert("Transaction aborted.");
            return false;
        }
        return true;
    }

    // Listen for the 'Send' event matching the given tx hash.
    function sub(evt, txHash) {
        evt.watch(function(error, result){
            if (error)
                console.error(error);
            else {
                // Check if tx hash matches.
                if (result.transactionHash === txHash) {
                    // Modify the transaction display.
                    var errorCode = result.args.error.toNumber();
                    if(errorCode !== 0) {
                        console.log("Incoming Send event for tx '%s'. Errorcode: %d\n", txHash, errorCode);
                        addTxResult(txHash, errorCode, errorCodeToMessage(errorCode));
                    } else {
                        addTxResult(txHash, 0, "");
                    }
                }
                evt.stopWatching();
            }
        });
    }

    function addAccounts(accounts) {
        var addrElem = $("#my-address");
        for(var i = 0; i < accounts.length; i++) {
            addrElem.append('<option>' + accounts[i] + '</option>')
        }
    }

    // Add a new transaction to the transaction list.
    function addAuthorizedSigners(signers) {
        var list = $("#ms-authorized-signers");

        for(var i = 0; i < signers.length; i++) {
            var userAddress = $( "#my-address option:selected" ).text();
            list.append('<li><p>' + signers[i] + '</p></li>');
            var isSigner = signers[i] === userAddress;
            if (isSigner) {
                $("#sign-hash-button").show();
            }
        }
    }

    // Add a new transaction to the transaction list.
    function addHashSigners(signers) {
        var list = $("#current-signatures");
        for(var i = 0; i < signers.length; i++) {
            list.append('<li><p>' + signers[i] + '</p></li>');
            list.listview('refresh');
        }
    }

    // Add a new transaction to the transaction list.
    function addTx(data, txHash) {
        $("#transactions li:eq(0)").after('<li><h3>' + data + '</h3><p>' + "txHash: " +  txHash + '</p><p class="ui-li-aside tx-status-pending" id="' + txHash + '" >Pending...</p></li>');
        $("#transactions").listview('refresh');
        console.log("Tx added for: " + txHash);
    }

    // Modify transaction data in the list. This is done as a response
    // to an incoming 'Send' event matching the hash of a pending transaction.
    function addTxResult(txHash, errorCode, errorMessage) {
        var msg = "";
        var newClass = "";
        if (errorCode === 0) {
            msg = "Success!";
            newClass = "tx-status-success";
        }
        else {
            msg = "Failed: " + errorMessage;
            newClass = "tx-status-failure";
        }
        $("#" + txHash).html(msg).removeClass("tx-status-pending").addClass(newClass);
        $("#transactions").listview('refresh');
        console.log("Tx updated for: " + txHash);
    }

    function errorCodeToMessage(errorCode) {
        switch (errorCode) {
            case 0x0:
                return "No Error";
            case 0x1:
                return "Access Denied";
            case 0x2:
                return "Invalid Hash";
            case 0x3:
                return "Hash Not Found";
            case 0x4:
                return "Hash Is Already Signed";
            default:
                return "UNKNOWN_ERROR";
        }
    }

})();