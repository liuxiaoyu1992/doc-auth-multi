import {Authority} from "./Authority.sol";

// Don't extend.
contract MultiSignerAuthority is Authority {

    function MultiSignerAuthority(address[] signers) {
        uint len = signers.length;
        if (len == 0 || len > 192)
            throw;
        // Write them to storage.
        assembly {
                let i := 0
                let startAddr := add(0x20, signers)
                sstore(0x1, len)
            loop:
                jumpi(end, eq(i, len))
                {
                    let j := i
                    i := add(i, 1)
                    let elem := mload(add(signers, mul(i, 0x20)))
                    jumpi(0, not(elem)) // Illegal jump to throw if address is 0.
                    jumpi(write, not(j)) // If this is the first element, skip next check
                    {
                        let prev := mload(add(signers, mul(j, 0x20)))
                        jumpi(0, not(gt(elem, prev)))// Illegal jump to throw.
                    }
                    write:
                        sstore(add(i, 1), elem)
                }
                jump(loop)
            end:
        }
    }

    function _signedBy(bytes32 hash, uint signerIndex) internal constant returns (bool signedBy) {
        assembly {
            signedBy := and(div(sload(hash), exp(2, signerIndex)), 1)
        }
    }

    function _signerIndex(address addr) internal constant returns (uint signerIndex) {
        assembly {
                // Binary search over signers.
                let min := 0
                let max := sub(sload(0x1), 1)
                let elem := 0
            loop:
                {
                        jumpi(fail, gt(min, max))
                        signerIndex := div(add(min, max), 2)
                        elem := sload(add(signerIndex, 0x2))
                        jumpi(end, eq(elem, addr))
                        jumpi(less, lt(elem, addr))
                        max := sub(signerIndex, 1)
                        jump(loop)
                    less:
                        min := add(signerIndex, 1)
                        jump(loop)
                }
            fail:
                signerIndex := 256
            end:
        }
    }

    function sign(bytes32 hash) returns (Error error) {
        if (hash < 194)
            error = Error.InvalidHash;
        else if (signed(hash)) // Early out if already signed by all.
            error = Error.HashAlreadySigned;
        else {
            var signerIndex = _signerIndex(msg.sender);
            if (signerIndex == 256)
                error = Error.AccessDenied;
            else if (_signedBy(hash, signerIndex))
                error = Error.HashAlreadySigned;
            else {
                assembly {
                    let numSigners := sload(0x1)
                    let data := sload(hash)
                    data := or(data, exp(2, signerIndex)) // Sign
                    // Check if this was the last needed signature.
                    let signedByAll := eq(data, sub(exp(2, numSigners), 1))
                    // If so, mark as signed by timestamping
                    let fact := 0x1000000000000000000000000000000000000000000000000
                    data := or(data, mul(mul(timestamp, fact), signedByAll))
                    sstore(hash, data)
                }
            }
        }
        Sign(hash, uint(error));
    }

    function signed(bytes32 hash) constant returns (bool signed) {
        assembly {
            let fact := 0x1000000000000000000000000000000000000000000000000
            signed := gt(mul(div(sload(hash), fact), gt(hash, 193)), 0)
        }
    }

    function signedBy(bytes32 hash, address signer) constant returns (bool signedBy) {
        if (hash < 194)
            return false;
        var signerIndex = _signerIndex(signer);
        if (signerIndex == 256)
            return false;
        else
            return _signedBy(hash, signerIndex);
    }

    function isSigner(address addr) constant returns (bool) {
        return _signerIndex(addr) != 256;
    }

    function signDate(bytes32 hash) constant returns (uint date) {
        assembly {
            let fact := 0x1000000000000000000000000000000000000000000000000
            date := mul(div(sload(hash), fact), gt(hash, 193))
        }
    }

    function hashData(bytes32 hash) constant returns (uint data) {
        assembly {
            data := mul(sload(hash), gt(hash, 193))
        }
    }

    function signers() constant returns (address[]) {
        assembly {
                let arr := mload(0x40)
                mstore(arr, 0x20)
                let len := sload(0x1)
                mstore(add(arr, 0x20), len)
                let i := 0
            loop:
                jumpi(end, eq(i, len))
                {
                    i := add(i, 1)
                    let offset := add(add(arr, 0x20), mul(i, 0x20))
                    mstore(offset, sload(add(i, 1)))
                }
                jump(loop)
            end:
                return(arr, add(0x40, mul(len, 32)))
        }
    }

    function authType() constant returns (Type authType) {
        return Type.MultiSigner;
    }

}