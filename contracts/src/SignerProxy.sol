import {Authority} from "./Authority.sol";

contract SignerProxy {
    function sign(address addr, bytes32 hash) returns (Authority.Error) {
        return Authority(addr).sign(hash);
    }
}