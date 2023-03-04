// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./interface/Poseidon.sol";

error IncrementalMerkleTree__MerkleTreeCapacity();

// Append only merkle tree
contract IncrementalMerkleTree {
    // poseidon hash function with 2 inputs
    IPoseidon public immutable hasher;
    // do not change the LEVELS value. there's a hardcoded loop below.
    uint256 public constant LEVELS = 20;
    // length of roots history
    uint256 public constant ROOTS_CAPACITY = 30;
    // index of next leaf to be inserted
    uint256 public currentLeafIndex;
    // filled subtrees cached to reconstruct the root
    mapping(uint256 => bytes32) public filledSubtrees;
    // historic roots (only holds up to ROOTS_CAPACITY roots)
    mapping(uint256 => bytes32) public roots;

    constructor(address poseidon) {
        hasher = IPoseidon(poseidon);
        // precomputed from zeroValue = keccak("empty") % p
        filledSubtrees[0] = bytes32(uint256(543544072303548185257517071258879077999438229338741863745347926248040160894));
        filledSubtrees[1] = bytes32(uint256(5263148031615500517773789998166832002359358478815380373385457941076984476107));
        filledSubtrees[2] = bytes32(uint256(17956485954079679132773811758681578949163794793418771629775186921851074473020));
        filledSubtrees[3] = bytes32(uint256(12818849578198618706853641503807770441784379819766699750158640467167373686827));
        filledSubtrees[4] = bytes32(uint256(20855805136626712543492304455032428762867320990141515473916248306878494117308));
        filledSubtrees[5] = bytes32(uint256(16078145596845420873218387454438458413474087448530358305197693667765135117));
        filledSubtrees[6] = bytes32(uint256(21469358837161435717475425023508741936366411081678940161225564928734007400175));
        filledSubtrees[7] = bytes32(uint256(97392844013092531948986239638340052193563694412037219481774368684748869683));
        filledSubtrees[8] = bytes32(uint256(9815574307005671302652737758332422327334048281128864225462159121130705840521));
        filledSubtrees[9] = bytes32(uint256(7087204700527144239556873464136052126786766979088398104134271794395334453517));
        filledSubtrees[10] = bytes32(uint256(10181090640042689059947552705763203436486859531084608903098065737516252860965));
        filledSubtrees[11] = bytes32(uint256(18768849884748869821279983937428267667824021795115145745181803419204387232793));
        filledSubtrees[12] = bytes32(uint256(2933336925830545942990247205542297128021746154492853303202253775340852058090));
        filledSubtrees[13] = bytes32(uint256(19969264030889959278249843814460631197595484808175492092586113505583667929727));
        filledSubtrees[14] = bytes32(uint256(20630468938722375422373209141732067356319655406689772991063986092557143438884));
        filledSubtrees[15] = bytes32(uint256(16112017084498001096426326752234891940073685446685262588324357827862522787584));
        filledSubtrees[16] = bytes32(uint256(5014107601768362368954905654771638641173580301154118547630986651087486382582));
        filledSubtrees[17] = bytes32(uint256(19913447121430317358013346685585730169311308417727954536999999362867231935974));
        filledSubtrees[18] = bytes32(uint256(5383269053000864513406337829703884940333204026496599059703565359684796208512));
        filledSubtrees[19] = bytes32(uint256(13643259613994876902857690028538868307758819349041069235229132599319944746418));
        roots[0] = bytes32(uint256(21581843949009751067133004474045855475316029363599471302179162475240986081250));
    }

    /*
        Returns the most recent root of the tree. Might be outdated by the time a transaction
        is process, hence the root history.
    */
    function getLatestRoot() public view returns (bytes32) {
        return roots[currentLeafIndex % ROOTS_CAPACITY];
    }

    /*
        This is a bounded loop, worst case reads from 31 storage slots, best case from 2.
    */
    function isKnownRoot(bytes32 root) public view returns (bool) {
        if (root == 0) return false;
        uint256 checkIndex = currentLeafIndex % ROOTS_CAPACITY;
        for (uint256 i = 0; i < ROOTS_CAPACITY; ) {
            if (root == roots[checkIndex]) return true;
            if (checkIndex == 0) checkIndex = ROOTS_CAPACITY;
            unchecked {
                ++i;
                --checkIndex;
            }
        }
        return false;
    }

    /*
        The reason for hardcoding this loop is to embed the zero values directly for gas savings.
        See TestMerkleTree.sol for some alternatives that are more modular and readable.

        I'd like to look into maybe using CODECOPY to get these values from a function instead
        so we can use the loop for better readability.

        The zeros are calculated from zeroValue = keccak("empty") % p
    */
    function insert(bytes32 leaf) internal returns (uint256) {
        uint256 checkIndex = currentLeafIndex;
        if (checkIndex == 1 << LEVELS) revert IncrementalMerkleTree__MerkleTreeCapacity();
        bytes32 left;
        bytes32 right;
        // i == 0
        if ((checkIndex >> 0) & 1 == 0) {
            left = leaf;
            right = bytes32(uint256(543544072303548185257517071258879077999438229338741863745347926248040160894));
            filledSubtrees[0] = leaf;
        } else {
            left = filledSubtrees[0];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        // i == 1
        if ((checkIndex >> 1) & 1 == 0) {
            left = leaf;
            right = bytes32(uint256(5263148031615500517773789998166832002359358478815380373385457941076984476107));
            filledSubtrees[1] = leaf;
        } else {
            left = filledSubtrees[1];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        // i == 2
        if ((checkIndex >> 2) & 1 == 0) {
            left = leaf;
            right = bytes32(uint256(17956485954079679132773811758681578949163794793418771629775186921851074473020));
            filledSubtrees[2] = leaf;
        } else {
            left = filledSubtrees[2];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        // i == 3
        if ((checkIndex >> 3) & 1 == 0) {
            left = leaf;
            right = bytes32(uint256(12818849578198618706853641503807770441784379819766699750158640467167373686827));
            filledSubtrees[3] = leaf;
        } else {
            left = filledSubtrees[3];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        // i == 4
        if ((checkIndex >> 4) & 1 == 0) {
            left = leaf;
            right = bytes32(uint256(20855805136626712543492304455032428762867320990141515473916248306878494117308));
            filledSubtrees[4] = leaf;
        } else {
            left = filledSubtrees[4];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        // i == 5
        if ((checkIndex >> 5) & 1 == 0) {
            left = leaf;
            right = bytes32(uint256(16078145596845420873218387454438458413474087448530358305197693667765135117));
            filledSubtrees[5] = leaf;
        } else {
            left = filledSubtrees[5];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        // i == 6
        if ((checkIndex >> 6) & 1 == 0) {
            left = leaf;
            right = bytes32(uint256(21469358837161435717475425023508741936366411081678940161225564928734007400175));
            filledSubtrees[6] = leaf;
        } else {
            left = filledSubtrees[6];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        // i == 7
        if ((checkIndex >> 7) & 1 == 0) {
            left = leaf;
            right = bytes32(uint256(97392844013092531948986239638340052193563694412037219481774368684748869683));
            filledSubtrees[7] = leaf;
        } else {
            left = filledSubtrees[7];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        // i == 8
        if ((checkIndex >> 8) & 1 == 0) {
            left = leaf;
            right = bytes32(uint256(9815574307005671302652737758332422327334048281128864225462159121130705840521));
            filledSubtrees[8] = leaf;
        } else {
            left = filledSubtrees[8];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        // i == 9
        if ((checkIndex >> 9) & 1 == 0) {
            left = leaf;
            right = bytes32(uint256(7087204700527144239556873464136052126786766979088398104134271794395334453517));
            filledSubtrees[9] = leaf;
        } else {
            left = filledSubtrees[9];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        // i == 10
        if ((checkIndex >> 10) & 1 == 0) {
            left = leaf;
            right = bytes32(uint256(10181090640042689059947552705763203436486859531084608903098065737516252860965));
            filledSubtrees[10] = leaf;
        } else {
            left = filledSubtrees[10];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        // i == 11
        if ((checkIndex >> 11) & 1 == 0) {
            left = leaf;
            right = bytes32(uint256(18768849884748869821279983937428267667824021795115145745181803419204387232793));
            filledSubtrees[11] = leaf;
        } else {
            left = filledSubtrees[11];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        // i == 12
        if ((checkIndex >> 12) & 1 == 0) {
            left = leaf;
            right = bytes32(uint256(2933336925830545942990247205542297128021746154492853303202253775340852058090));
            filledSubtrees[12] = leaf;
        } else {
            left = filledSubtrees[12];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        // i == 13
        if ((checkIndex >> 13) & 1 == 0) {
            left = leaf;
            right = bytes32(uint256(19969264030889959278249843814460631197595484808175492092586113505583667929727));
            filledSubtrees[13] = leaf;
        } else {
            left = filledSubtrees[13];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        // i == 14
        if ((checkIndex >> 14) & 1 == 0) {
            left = leaf;
            right = bytes32(uint256(20630468938722375422373209141732067356319655406689772991063986092557143438884));
            filledSubtrees[14] = leaf;
        } else {
            left = filledSubtrees[14];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        // i == 15
        if ((checkIndex >> 15) & 1 == 0) {
            left = leaf;
            right = bytes32(uint256(16112017084498001096426326752234891940073685446685262588324357827862522787584));
            filledSubtrees[15] = leaf;
        } else {
            left = filledSubtrees[15];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        // i == 16
        if ((checkIndex >> 16) & 1 == 0) {
            left = leaf;
            right = bytes32(uint256(5014107601768362368954905654771638641173580301154118547630986651087486382582));
            filledSubtrees[16] = leaf;
        } else {
            left = filledSubtrees[16];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        // i == 17
        if ((checkIndex >> 17) & 1 == 0) {
            left = leaf;
            right = bytes32(uint256(19913447121430317358013346685585730169311308417727954536999999362867231935974));
            filledSubtrees[17] = leaf;
        } else {
            left = filledSubtrees[17];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        // i == 18
        if ((checkIndex >> 18) & 1 == 0) {
            left = leaf;
            right = bytes32(uint256(5383269053000864513406337829703884940333204026496599059703565359684796208512));
            filledSubtrees[18] = leaf;
        } else {
            left = filledSubtrees[18];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        // i == 19
        if ((checkIndex >> 19) & 1 == 0) {
            left = leaf;
            right = bytes32(uint256(13643259613994876902857690028538868307758819349041069235229132599319944746418));
            filledSubtrees[19] = leaf;
        } else {
            left = filledSubtrees[19];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        unchecked {
            uint256 rootIndex = (checkIndex + 1) % ROOTS_CAPACITY;
            roots[rootIndex] = leaf;
            currentLeafIndex = checkIndex + 1;
        }
        return checkIndex;
    }
}
