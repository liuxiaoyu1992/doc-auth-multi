import {SingleSignerAuthority} from "./SingleSignerAuthority.sol";
import {Authority} from "./Authority.sol";
import {Test} from "./Test.sol";
import {SignerProxy} from "./SignerProxy.sol";

contract SingleSignerAuthorityTest is Test {

    bytes32 constant TEST_HASH = 0x123456789abcdef;

    function testCreate() {
        var ssa = new SingleSignerAuthority();
        assert(ssa.signer() == address(this), "Wrong signer address.");
        assert(ssa.authType() == Authority.Type.SingleSigner, "authType failed.");
    }

    function testSignSuccess() {
        var ssa = new SingleSignerAuthority();
        assert(ssa.sign(TEST_HASH) == Authority.Error.NoError, "sign failed.");
        assert(ssa.signDate(TEST_HASH) == now, "signDate failed.");
        assert(ssa.signed(TEST_HASH), "signed not true");
    }

    function testSignFailHashIsZero() {
        var ssa = new SingleSignerAuthority();
        assert(ssa.sign(BYTES32_NULL) == Authority.Error.InvalidHash, "Failed to detect invalid hash.");
        assert(!ssa.signed(TEST_HASH), "signed is true");
    }

    function testSignFailHashAlreadyExists() {
        var ssa = new SingleSignerAuthority();
        ssa.sign(TEST_HASH);
        assert(ssa.sign(TEST_HASH) == Authority.Error.HashAlreadySigned, "Failed to detect already signed hash.");
    }

    function testSignFailNotSigner() {
        var ssa = new SingleSignerAuthority();
        var acc = new SignerProxy();
        assert(acc.sign(ssa, TEST_HASH) == Authority.Error.AccessDenied, "Failed to detect wrong signer address.");
        assert(!ssa.signed(TEST_HASH), "signed is true");
    }

}