import {MultiSignerAuthority} from "./MultiSignerAuthority.sol";
import {Authority} from "./Authority.sol";
import {Test} from "./Test.sol";
import {SignerProxy} from "./SignerProxy.sol";

contract MultiSignerAuthorityTest is Test {

    bytes32 constant TEST_HASH = 0x123456789abcdef;

    function testCreate() {
        address[] memory signers = new address[](1);
        signers[0] = this;
        var msa = new MultiSignerAuthority(signers);
        assert(msa.isSigner(this), "Wrong signer address.");
        assert(msa.authType() == Authority.Type.MultiSigner, "authType failed.");
    }

    function testSignSingleSignerSuccess() {
        address[] memory signers = new address[](1);
        signers[0] = this;
        var msa = new MultiSignerAuthority(signers);
        assert(msa.sign(TEST_HASH) == Authority.Error.NoError, "sign returned error");
        assert(msa.signed(TEST_HASH), "signed not true");
        assert(msa.signedBy(TEST_HASH, this), "signedby not true");
        assert(msa.signDate(TEST_HASH) == now, "timestamp wrong");
    }

    function testSignSingleSignerFailedAlreadySigned() {
        address[] memory signers = new address[](1);
        signers[0] = this;
        var msa = new MultiSignerAuthority(signers);
        msa.sign(TEST_HASH);
        assert(msa.sign(TEST_HASH) == Authority.Error.HashAlreadySigned, "sign returned the wrong error");
    }

    function testSignTwoSignersSuccess() {
        var signer = new SignerProxy();
        address[] memory signers = new address[](2);
        signers[0] = this;
        signers[1] = signer;
        sort(signers);
        var msa = new MultiSignerAuthority(signers);
        assert(msa.isSigner(this), "'this' is not a signer");
        assert(msa.isSigner(signer), "'signer' is not a signer");

        assert(msa.sign(TEST_HASH) == Authority.Error.NoError, "sign returned error for 'this'");
        assert(!msa.signed(TEST_HASH), "signed true");
        assert(msa.signedBy(TEST_HASH, this), "signedby 'this' not true");

        assert(signer.sign(msa, TEST_HASH) == Authority.Error.NoError, "sign returned error for 'signer'");
        assert(msa.signed(TEST_HASH), "signed not true");
        assert(msa.signedBy(TEST_HASH, signer), "signedby 'signer' not true");
    }

    function testGetSigners() {
        address[] memory signers = new address[](16);
        signers[0] = this;
        for (uint i = 1; i < 16; i++)
            signers[i] = address(new SignerProxy());
        sort(signers);
        var msa = new MultiSignerAuthority(signers);

        address[] memory signersRet;
        // Temp until EIP5
        var msaAddr = address(msa);
        assembly {
            let offset := mload(0x40)
            mstore(offset, mul(0x46f0975a, exp(256, 28)))
            let retOffset := add(offset, 0x20)
            // Just use the standard gas value even though it's way too high.
            call(sub(gas, 25050), msaAddr, 0, offset, 4, retOffset, 0x300)
            pop
            signersRet := add(retOffset, 0x20)
            mstore(0x40, add(retOffset, 0x300))
        }
        for (i = 0; i < 16; i++) {
            var result = signers[i] == signersRet[i];
            if (result)
                assert(true, "");
            else
                assert(false, appendTagged(tagUint(i, "Index"), "Failed."));
        }
    }

    // Simple bubble sort, arrays are usually tiny.
    function sort(address[] memory arr) internal {
        bool repeat = true;
        while (repeat) {
            repeat = false;
            uint i = 1;
            while (i < arr.length) {
                var elem = arr[i];
                var prev = arr[i - 1];
                if (elem <= prev) {
                    arr[i] = prev;
                    arr[i - 1] = elem;
                    repeat = true;
                }
                i++;
            }
        }
    }

}