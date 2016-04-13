var Auth = {
    Type: {
        Null: 0,
        SingleSigner: 1,
        MultiSigner: 2
    },
    Error: {
        NoError: 0,
        AccessDenied: 1,
        InvalidHash: 2,
        HashNotFound: 3,
        HashAlreadySigned: 4
    }
};

var TEST_HASH = "0x123456789abcdef";

var code = "60606040526040516103723803806103728339810160405280510180516000811480602a575060c081115b156044576002565b505050506102eb806100876000396000f35b600082602001826001555b828214603257816001830192506020830285015180156000578115607d576020820286015180821115600057505b600184015550604f566060604052361561006c5760e060020a600035046305915147811461006e5780631a9069cf1461008357806346f0975a1461009a578063775eb900146100e7578063799cd333146101045780637df73e271461011f578063bd2d389914610168578063d3978a2514610182575b005b60025b60408051918252519081900360200190f35b600435805460c060020a900460c190911102610071565b61019260206040519081016040528060008152602001506040516020815260015480602083015260005b8181146102c85760018101905060208102602084010160018201548152506100c4565b6100716004355b8054600060c190921160c060020a909104021190565b61007160043560008060c08310156101dc5760029150610258565b610071600435600061028b825b6000600060016001540360005b8183116102dd576002828401049350600284015490508481146102e3578481106102d257600184039150610139565b61007160043560243560008060c2841015610296576102c1565b600435805460c190911102610071565b60405180806020018281038252838181518152602001915080519060200190602002808383829060006004602084601f0104600f02600301f1509050019250505060405180910390f35b6101e5836100ee565b156101f35760049150610258565b6101fc3361012c565b90508061010014156102115760019150610258565b61022783825b905460029190910a900460011690565b156102355760049150610258565b600154835460c060020a600284810a9092179290910a6000190182144202021783555b604051829084907f96b44c08ba795a44773a7f920b17c02b97f3a555218090672667d531e7e1ee7990600090a350919050565b610100141592915050565b61029f8361012c565b90508061010014156102b457600091506102c1565b6102be8482610217565b91505b5092915050565b6020820260400183f35b600184019250610139565b61010093505b50505091905056";
var abi = [{"constant":true,"inputs":[],"name":"authType","outputs":[{"name":"authType","type":"uint8"}],"type":"function"},{"constant":true,"inputs":[{"name":"hash","type":"bytes32"}],"name":"signDate","outputs":[{"name":"date","type":"uint256"}],"type":"function"},{"constant":true,"inputs":[],"name":"signers","outputs":[{"name":"","type":"address[]"}],"type":"function"},{"constant":true,"inputs":[{"name":"hash","type":"bytes32"}],"name":"signed","outputs":[{"name":"signed","type":"bool"}],"type":"function"},{"constant":false,"inputs":[{"name":"hash","type":"bytes32"}],"name":"sign","outputs":[{"name":"error","type":"uint8"}],"type":"function"},{"constant":true,"inputs":[{"name":"addr","type":"address"}],"name":"isSigner","outputs":[{"name":"","type":"bool"}],"type":"function"},{"constant":true,"inputs":[{"name":"hash","type":"bytes32"},{"name":"signer","type":"address"}],"name":"signedBy","outputs":[{"name":"signedBy","type":"bool"}],"type":"function"},{"constant":true,"inputs":[{"name":"hash","type":"bytes32"}],"name":"hashData","outputs":[{"name":"data","type":"uint256"}],"type":"function"},{"inputs":[{"name":"signers","type":"address[]"}],"type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"name":"hash","type":"bytes32"},{"indexed":true,"name":"error","type":"uint256"}],"name":"Sign","type":"event"}];
var userAddress;

var web3 = new Web3();

web3.setProvider(new web3.providers.HttpProvider('http://localhost:8545'));
try {
    userAddress = web3.eth.defaultAccount = web3.eth.coinbase;
} catch (error) {
    alert("Failed to connect to ethereum node over RPC;\nthe tests will not function.")
}

function deployNew(addresses, callback) {
    web3.eth.contract(abi).new(addresses, {data: code}, function (err, contract) {
        if(err) {
            callback(err);
            // callback fires twice, we only want the second call when the contract is deployed
        } else if(contract.address){
            callback(null, contract);
        }
    });
}

function sign(from, contract, hash, callback) {

    var evt = contract.Sign();
    var txHash;
    evt.watch(function(err, data){
        if(err || (data.transactionHash === txHash && data.blockNumber)) {
            evt.stopWatching();
            return callback(err, err ? null : data.args.error.toNumber(), data.blockNumber);
        }
    });
    try {
        if (!from){
            txHash = contract.sign(hash);
        } else {
            txHash = contract.sign(hash, {from: from});
        }

    } catch (err) {
        evt.stopWatching();
        return callback(err);
    }
}

QUnit.test( "deploy successful", function( assert ) {
    var done = assert.async();
    var addr = web3.eth.accounts[0];
    deployNew([addr], function(error, contract){
        assert.ok(!error, "Failed to deploy contract.");
        try {
            var authType = contract.authType();
            assert.equal(authType.toNumber(), Auth.Type.MultiSigner, "Wrong contract type returned.");
            var isSigner = contract.isSigner(web3.eth.accounts[0]);
            assert.ok(isSigner, "Wrong signer");
            done();
        } catch (error) {
            console.error(error);
            assert.ok(!error, "Failed to access contract.");
            done();
        }
    });
});

QUnit.test( "deploy failed no signers", function( assert ) {
    var done = assert.async();
    deployNew([], function(error){
        assert.ok(error, "Contract deployed successfully.");
        done();
    });
});

QUnit.test( "deploy failed not sorted", function( assert ) {
    var done = assert.async();
    deployNew(["0x34", "0x1"], function(error){
        assert.ok(error, "Contract deployed successfully.");
        done();
    });
});

QUnit.test( "deploy failed has duplicates", function( assert ) {
    var done = assert.async();
    deployNew(["0x34", "0x34"], function(error){
        assert.ok(error, "Contract deployed successfully.");
        done();
    });
});

QUnit.test( "get addresses", function( assert ) {
    var done = assert.async();
    var addresses = web3.eth.accounts.sort(function compare(a, b) {
        return new BigNumber(a).cmp(new BigNumber(b));
    });
    deployNew(addresses, function(error, contract){
        assert.ok(!error, "Failed to deploy contract.");
        contract.signers(function(err, addresses){
            assert.ok(!err, "Failed to deploy contract.");
            assert.deepEqual(addresses, addresses, "Addresses doesn't match.");
            done();
        });
    });
});

QUnit.test( "sign successful", function( assert ) {
    var done = assert.async();
    var addr = web3.eth.accounts[0];
    deployNew([addr], function(error, contract){
        console.log(error);
        assert.ok(!error, "Failed to deploy contract.");
        sign(addr, contract, TEST_HASH, function(error, code, blockNumber){
            assert.ok(!error, "Error when signing.");
            assert.equal(code, Auth.Error.NoError, "Error code is not zero");
            try {
                var signed = contract.signed(TEST_HASH);
                assert.ok(signed, "'signed' is not true");
                var timestamp = contract.signDate(TEST_HASH).toNumber();
                var blockTs = web3.eth.getBlock(blockNumber).timestamp;
                assert.equal(timestamp, blockTs, "Timestamps does not match");
                done();
            } catch (error) {
                assert.ok(!error, "Failed to access contract.");
                done();
            }
        })
    });
});

QUnit.test( "multiple signatures successful", function( assert ) {
    var done = assert.async();
    var addresses = web3.eth.accounts.sort(function compare(a, b) {
        return new BigNumber(a).cmp(new BigNumber(b));
    });
    deployNew(addresses, function(error, contract){
        assert.ok(!error, "Failed to deploy contract.");
        async.eachSeries(addresses, function(addr, cb){
            sign(addr, contract, TEST_HASH, function(error, code){
                assert.ok(!error, "Error when signing.");
                assert.equal(code, Auth.Error.NoError, "Error code is not zero");
                try {
                    var signedBy = contract.signedBy(TEST_HASH, addr);
                    assert.ok(signedBy, "'signedBy' is not true");
                    cb();
                } catch (error) {
                    console.error(error);
                    assert.ok(!error, "Failed to access contract.");
                    cb();
                }
            })
        }, function(){
            contract.signed(TEST_HASH, function(err, signed){
                assert.ok(!err, "Error when calling 'signed'");
                assert.ok(signed, "Hash is not signed.");
                done();
            });

        });

    });
});

/*
QUnit.test( "sign fail already signed", function( assert ) {
    var done = assert.async();
    deployNew(function(error, contract){
        assert.ok(!error, "Failed to deploy contract.");

        sign(null, contract, TEST_HASH, function(error){
            assert.ok(!error, "Error when signing.");
            sign(null, contract, TEST_HASH, function(error, code){
                assert.ok(!error, "Error when signing.");
                assert.equal(code, Auth.Error.HashAlreadySigned, "Error is not 'HashAlreadySigned'");
                contract.signed(TEST_HASH, function(err, signed){
                    assert.ok(!err, "Error when getting contract data.");
                    assert.ok(signed, "Hash not signed despite sign failing for that reason.");
                    done();
                });
            })
        })
    });
});

QUnit.test( "sign fail not signer", function( assert ) {
    var done = assert.async();
    deployNew(function(error, contract){
        assert.ok(!error, "Failed to deploy contract.");
        sign(web3.eth.accounts[1], contract, TEST_HASH, function(error, code){
            assert.ok(!error, "Error when signing.");
            assert.equal(code, Auth.Error.AccessDenied, "Error is not 'AccesDenied'");
            contract.signed(TEST_HASH, function(err, signed){
                assert.ok(!err, "Error when getting contract data.");
                assert.ok(!signed, "Hash is signed by unauthorized account.");
                done();
            });
        })
    });
});
*/