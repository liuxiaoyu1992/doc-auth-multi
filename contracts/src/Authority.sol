contract Authority {

    enum Type {
        Null,
        SingleSigner,
        MultiSigner
    }

    enum Error {
        NoError,
        AccessDenied,
        InvalidHash,
        HashNotFound,
        HashAlreadySigned
    }

    event Sign(bytes32 indexed hash, uint indexed error);

    function sign(bytes32 hash) returns (Error error);
    function signed(bytes32 hash) constant returns (bool signed);
    function signDate(bytes32 hash) constant returns (uint date);
    function isSigner(address addr) constant returns (bool);
    function authType() constant returns (Type authType);
}