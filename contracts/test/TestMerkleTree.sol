// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "../interface/Poseidon.sol";

contract TestMerkleTree {
    error IndexOutOfRange();
    error MerkleTreeCapacity();
    error UnknownRoot();
    IPoseidon public hasher;
    // do not change the LEVELS value. there's a hardcoded loop below.
    uint256 public constant LEVELS = 20;
    // length of roots history
    uint256 public constant ROOTS_CAPACITY = 30;
    // index of latest root in roots history
    uint256 public currentRootIndex;
    // index of next leaf to be inserted
    uint256 public currentLeafIndex;
    // filled subtrees cached to reconstruct the root
    mapping(uint256 => uint256) public filledSubtrees;
    // historic roots (only holds up to ROOTS_CAPACITY roots)
    mapping(uint256 => uint256) public roots;
    // zero values, but in storage
    mapping(uint256 => uint256) public z;

    // solhint-disable-next-line func-visibility
    constructor(address poseidon) {
        hasher = IPoseidon(poseidon);
        for (uint256 i = 0; i < LEVELS; ) {
            z[i] = zeros(i);
            // filledSubtrees[i] = zeros(i);
            unchecked {
                ++i;
            }
        }
        roots[0] = zeros(20);
    }

    function getLatestRoot() public view returns (uint256) {
        return roots[currentRootIndex];
    }

    function isKnownRoot(uint256 root) public view returns (bool) {
        if (root == 0) return false;
        uint256 checkIndex = currentRootIndex;
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

    // zero values, in bytecode (using stack)
    function zeros(uint256 i) internal pure returns (uint256 zero) {
        if (i == 0)
            return
                543544072303548185257517071258879077999438229338741863745347926248040160894;
        else if (i == 1)
            return
                5263148031615500517773789998166832002359358478815380373385457941076984476107;
        else if (i == 2)
            return
                17956485954079679132773811758681578949163794793418771629775186921851074473020;
        else if (i == 3)
            return
                12818849578198618706853641503807770441784379819766699750158640467167373686827;
        else if (i == 4)
            return
                20855805136626712543492304455032428762867320990141515473916248306878494117308;
        else if (i == 5)
            return
                16078145596845420873218387454438458413474087448530358305197693667765135117;
        else if (i == 6)
            return
                21469358837161435717475425023508741936366411081678940161225564928734007400175;
        else if (i == 7)
            return
                97392844013092531948986239638340052193563694412037219481774368684748869683;
        else if (i == 8)
            return
                9815574307005671302652737758332422327334048281128864225462159121130705840521;
        else if (i == 9)
            return
                7087204700527144239556873464136052126786766979088398104134271794395334453517;
        else if (i == 10)
            return
                10181090640042689059947552705763203436486859531084608903098065737516252860965;
        else if (i == 11)
            return
                18768849884748869821279983937428267667824021795115145745181803419204387232793;
        else if (i == 12)
            return
                2933336925830545942990247205542297128021746154492853303202253775340852058090;
        else if (i == 13)
            return
                19969264030889959278249843814460631197595484808175492092586113505583667929727;
        else if (i == 14)
            return
                20630468938722375422373209141732067356319655406689772991063986092557143438884;
        else if (i == 15)
            return
                16112017084498001096426326752234891940073685446685262588324357827862522787584;
        else if (i == 16)
            return
                5014107601768362368954905654771638641173580301154118547630986651087486382582;
        else if (i == 17)
            return
                19913447121430317358013346685585730169311308417727954536999999362867231935974;
        else if (i == 18)
            return
                5383269053000864513406337829703884940333204026496599059703565359684796208512;
        else if (i == 19)
            return
                13643259613994876902857690028538868307758819349041069235229132599319944746418;
        else if (i == 20)
            return
                21581843949009751067133004474045855475316029363599471302179162475240986081250;
    }

    /* parametric step function gang */
    function wtf(uint256 ei, uint256 li) internal pure returns (uint256) {
        unchecked {
            return 2 * (ei / (1 << (li + 1)));
        }
    }

    function testUpdate(
        uint256 oldLeaf,
        uint256 newLeaf,
        uint256 oldIndex,
        uint256[] calldata siblings
    ) public {
        uint256 latestIndex = currentLeafIndex - 1;
        if (oldIndex > latestIndex) revert IndexOutOfRange();
        for (uint256 i = 0; i < 20; ) {
            if ((oldIndex >> i) & 1 == 0) {
                if (wtf(oldIndex, i) == wtf(latestIndex, i)) {
                    filledSubtrees[i] = newLeaf;
                }
                oldLeaf = hasher.poseidon([oldLeaf, siblings[i]]);
                newLeaf = hasher.poseidon([newLeaf, siblings[i]]);
            } else {
                oldLeaf = hasher.poseidon([siblings[i], oldLeaf]);
                newLeaf = hasher.poseidon([siblings[i], newLeaf]);
            }
            unchecked {
                ++i;
            }
        }
        uint256 _currentRootIndex = currentRootIndex;
        if (oldLeaf != roots[_currentRootIndex]) revert UnknownRoot();
        roots[_currentRootIndex] = newLeaf;
    }

    function testInsertLoop(uint256 leaf) public returns (uint256) {
        uint256 checkIndex = currentLeafIndex;
        if (checkIndex == 1 << LEVELS) revert MerkleTreeCapacity();

        uint256 left;
        uint256 right;
        for (uint256 i = 0; i < LEVELS; ) {
            if (((checkIndex >> i) & 1) == 0) {
                left = leaf;
                right = zeros(i);
                filledSubtrees[i] = leaf;
            } else {
                left = filledSubtrees[i];
                right = leaf;
            }
            leaf = hasher.poseidon([left, right]);
            unchecked {
                ++i;
            }
        }
        unchecked {
            uint256 rootIndex = addmod(currentRootIndex, 1, ROOTS_CAPACITY);
            currentRootIndex = rootIndex;
            roots[rootIndex] = leaf;
            currentLeafIndex = checkIndex + 1;
        }
        return checkIndex;
    }

    function testInsertStorage(uint256 leaf) public returns (uint256) {
        uint256 checkIndex = currentLeafIndex;
        if (checkIndex == 1 << LEVELS) revert MerkleTreeCapacity();
        uint256 left;
        uint256 right;
        for (uint256 i = 0; i < LEVELS; ) {
            if ((checkIndex >> i) & 1 == 0) {
                left = leaf;
                right = z[i];
                filledSubtrees[i] = leaf;
            } else {
                left = filledSubtrees[i];
                right = leaf;
            }
            leaf = hasher.poseidon([left, right]);
            unchecked {
                ++i;
            }
        }
        unchecked {
            uint256 rootIndex = addmod(currentRootIndex, 1, ROOTS_CAPACITY);
            currentRootIndex = rootIndex;
            roots[rootIndex] = leaf;
            currentLeafIndex = checkIndex + 1;
        }
        return checkIndex;
    }

    function testInsert(uint256 leaf) public returns (uint256) {
        uint256 checkIndex = currentLeafIndex;
        if (checkIndex == 1 << LEVELS) revert MerkleTreeCapacity();
        uint256 left;
        uint256 right;
        // i == 0
        if ((checkIndex >> 0) & 1 == 0) {
            left = leaf;
            right = 543544072303548185257517071258879077999438229338741863745347926248040160894;
            filledSubtrees[0] = leaf;
        } else {
            left = filledSubtrees[0];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        // i == 1
        if ((checkIndex >> 1) & 1 == 0) {
            left = leaf;
            right = 5263148031615500517773789998166832002359358478815380373385457941076984476107;
            filledSubtrees[1] = leaf;
        } else {
            left = filledSubtrees[1];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        // i == 2
        if ((checkIndex >> 2) & 1 == 0) {
            left = leaf;
            right = 17956485954079679132773811758681578949163794793418771629775186921851074473020;
            filledSubtrees[2] = leaf;
        } else {
            left = filledSubtrees[2];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        // i == 3
        if ((checkIndex >> 3) & 1 == 0) {
            left = leaf;
            right = 12818849578198618706853641503807770441784379819766699750158640467167373686827;
            filledSubtrees[3] = leaf;
        } else {
            left = filledSubtrees[3];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        // i == 4
        if ((checkIndex >> 4) & 1 == 0) {
            left = leaf;
            right = 20855805136626712543492304455032428762867320990141515473916248306878494117308;
            filledSubtrees[4] = leaf;
        } else {
            left = filledSubtrees[4];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        // i == 5
        if ((checkIndex >> 5) & 1 == 0) {
            left = leaf;
            right = 16078145596845420873218387454438458413474087448530358305197693667765135117;
            filledSubtrees[5] = leaf;
        } else {
            left = filledSubtrees[5];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        // i == 6
        if ((checkIndex >> 6) & 1 == 0) {
            left = leaf;
            right = 21469358837161435717475425023508741936366411081678940161225564928734007400175;
            filledSubtrees[6] = leaf;
        } else {
            left = filledSubtrees[6];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        // i == 7
        if ((checkIndex >> 7) & 1 == 0) {
            left = leaf;
            right = 97392844013092531948986239638340052193563694412037219481774368684748869683;
            filledSubtrees[7] = leaf;
        } else {
            left = filledSubtrees[7];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        // i == 8
        if ((checkIndex >> 8) & 1 == 0) {
            left = leaf;
            right = 9815574307005671302652737758332422327334048281128864225462159121130705840521;
            filledSubtrees[8] = leaf;
        } else {
            left = filledSubtrees[8];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        // i == 9
        if ((checkIndex >> 9) & 1 == 0) {
            left = leaf;
            right = 7087204700527144239556873464136052126786766979088398104134271794395334453517;
            filledSubtrees[9] = leaf;
        } else {
            left = filledSubtrees[9];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        // i == 10
        if ((checkIndex >> 10) & 1 == 0) {
            left = leaf;
            right = 10181090640042689059947552705763203436486859531084608903098065737516252860965;
            filledSubtrees[10] = leaf;
        } else {
            left = filledSubtrees[10];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        // i == 11
        if ((checkIndex >> 11) & 1 == 0) {
            left = leaf;
            right = 18768849884748869821279983937428267667824021795115145745181803419204387232793;
            filledSubtrees[11] = leaf;
        } else {
            left = filledSubtrees[11];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        // i == 12
        if ((checkIndex >> 12) & 1 == 0) {
            left = leaf;
            right = 2933336925830545942990247205542297128021746154492853303202253775340852058090;
            filledSubtrees[12] = leaf;
        } else {
            left = filledSubtrees[12];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        // i == 13
        if ((checkIndex >> 13) & 1 == 0) {
            left = leaf;
            right = 19969264030889959278249843814460631197595484808175492092586113505583667929727;
            filledSubtrees[13] = leaf;
        } else {
            left = filledSubtrees[13];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        // i == 14
        if ((checkIndex >> 14) & 1 == 0) {
            left = leaf;
            right = 20630468938722375422373209141732067356319655406689772991063986092557143438884;
            filledSubtrees[14] = leaf;
        } else {
            left = filledSubtrees[14];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        // i == 15
        if ((checkIndex >> 15) & 1 == 0) {
            left = leaf;
            right = 16112017084498001096426326752234891940073685446685262588324357827862522787584;
            filledSubtrees[15] = leaf;
        } else {
            left = filledSubtrees[15];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        // i == 16
        if ((checkIndex >> 16) & 1 == 0) {
            left = leaf;
            right = 5014107601768362368954905654771638641173580301154118547630986651087486382582;
            filledSubtrees[16] = leaf;
        } else {
            left = filledSubtrees[16];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        // i == 17
        if ((checkIndex >> 17) & 1 == 0) {
            left = leaf;
            right = 19913447121430317358013346685585730169311308417727954536999999362867231935974;
            filledSubtrees[17] = leaf;
        } else {
            left = filledSubtrees[17];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        // i == 18
        if ((checkIndex >> 18) & 1 == 0) {
            left = leaf;
            right = 5383269053000864513406337829703884940333204026496599059703565359684796208512;
            filledSubtrees[18] = leaf;
        } else {
            left = filledSubtrees[18];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        // i == 19
        if ((checkIndex >> 19) & 1 == 0) {
            left = leaf;
            right = 13643259613994876902857690028538868307758819349041069235229132599319944746418;
            filledSubtrees[19] = leaf;
        } else {
            left = filledSubtrees[19];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        unchecked {
            uint256 rootIndex = addmod(currentRootIndex, 1, ROOTS_CAPACITY);
            currentRootIndex = rootIndex;
            roots[rootIndex] = leaf;
            currentLeafIndex = checkIndex + 1;
        }
        return checkIndex;
    }

    function testInsertMod(uint256 leaf) public returns (uint256) {
        uint256 checkIndex = currentLeafIndex;
        if (checkIndex == 1 << LEVELS) revert MerkleTreeCapacity();
        uint256 left;
        uint256 right;
        // i == 0
        if (checkIndex % 2 == 0) {
            left = leaf;
            right = 543544072303548185257517071258879077999438229338741863745347926248040160894;
            filledSubtrees[0] = leaf;
        } else {
            left = filledSubtrees[0];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        checkIndex >>= 1;
        // i == 1
        if (checkIndex % 2 == 0) {
            left = leaf;
            right = 5263148031615500517773789998166832002359358478815380373385457941076984476107;
            filledSubtrees[1] = leaf;
        } else {
            left = filledSubtrees[1];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        checkIndex >>= 1;
        // i == 2
        if (checkIndex % 2 == 0) {
            left = leaf;
            right = 17956485954079679132773811758681578949163794793418771629775186921851074473020;
            filledSubtrees[2] = leaf;
        } else {
            left = filledSubtrees[2];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        checkIndex >>= 1;
        // i == 3
        if (checkIndex % 2 == 0) {
            left = leaf;
            right = 12818849578198618706853641503807770441784379819766699750158640467167373686827;
            filledSubtrees[3] = leaf;
        } else {
            left = filledSubtrees[3];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        checkIndex >>= 1;
        // i == 4
        if (checkIndex % 2 == 0) {
            left = leaf;
            right = 20855805136626712543492304455032428762867320990141515473916248306878494117308;
            filledSubtrees[4] = leaf;
        } else {
            left = filledSubtrees[4];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        checkIndex >>= 1;
        // i == 5
        if (checkIndex % 2 == 0) {
            left = leaf;
            right = 16078145596845420873218387454438458413474087448530358305197693667765135117;
            filledSubtrees[5] = leaf;
        } else {
            left = filledSubtrees[5];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        checkIndex >>= 1;
        // i == 6
        if (checkIndex % 2 == 0) {
            left = leaf;
            right = 21469358837161435717475425023508741936366411081678940161225564928734007400175;
            filledSubtrees[6] = leaf;
        } else {
            left = filledSubtrees[6];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        checkIndex >>= 1;
        // i == 7
        if (checkIndex % 2 == 0) {
            left = leaf;
            right = 97392844013092531948986239638340052193563694412037219481774368684748869683;
            filledSubtrees[7] = leaf;
        } else {
            left = filledSubtrees[7];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        checkIndex >>= 1;
        // i == 8
        if (checkIndex % 2 == 0) {
            left = leaf;
            right = 9815574307005671302652737758332422327334048281128864225462159121130705840521;
            filledSubtrees[8] = leaf;
        } else {
            left = filledSubtrees[8];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        checkIndex >>= 1;
        // i == 9
        if (checkIndex % 2 == 0) {
            left = leaf;
            right = 7087204700527144239556873464136052126786766979088398104134271794395334453517;
            filledSubtrees[9] = leaf;
        } else {
            left = filledSubtrees[9];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        checkIndex >>= 1;
        // i == 10
        if (checkIndex % 2 == 0) {
            left = leaf;
            right = 10181090640042689059947552705763203436486859531084608903098065737516252860965;
            filledSubtrees[10] = leaf;
        } else {
            left = filledSubtrees[10];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        checkIndex >>= 1;
        // i == 11
        if (checkIndex % 2 == 0) {
            left = leaf;
            right = 18768849884748869821279983937428267667824021795115145745181803419204387232793;
            filledSubtrees[11] = leaf;
        } else {
            left = filledSubtrees[11];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        checkIndex >>= 1;
        // i == 12
        if (checkIndex % 2 == 0) {
            left = leaf;
            right = 2933336925830545942990247205542297128021746154492853303202253775340852058090;
            filledSubtrees[12] = leaf;
        } else {
            left = filledSubtrees[12];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        checkIndex >>= 1;
        // i == 13
        if (checkIndex % 2 == 0) {
            left = leaf;
            right = 19969264030889959278249843814460631197595484808175492092586113505583667929727;
            filledSubtrees[13] = leaf;
        } else {
            left = filledSubtrees[13];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        checkIndex >>= 1;
        // i == 14
        if (checkIndex % 2 == 0) {
            left = leaf;
            right = 20630468938722375422373209141732067356319655406689772991063986092557143438884;
            filledSubtrees[14] = leaf;
        } else {
            left = filledSubtrees[14];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        checkIndex >>= 1;
        // i == 15
        if (checkIndex % 2 == 0) {
            left = leaf;
            right = 16112017084498001096426326752234891940073685446685262588324357827862522787584;
            filledSubtrees[15] = leaf;
        } else {
            left = filledSubtrees[15];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        checkIndex >>= 1;
        // i == 16
        if (checkIndex % 2 == 0) {
            left = leaf;
            right = 5014107601768362368954905654771638641173580301154118547630986651087486382582;
            filledSubtrees[16] = leaf;
        } else {
            left = filledSubtrees[16];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        checkIndex >>= 1;
        // i == 17
        if (checkIndex % 2 == 0) {
            left = leaf;
            right = 19913447121430317358013346685585730169311308417727954536999999362867231935974;
            filledSubtrees[17] = leaf;
        } else {
            left = filledSubtrees[17];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        checkIndex >>= 1;
        // i == 18
        if (checkIndex % 2 == 0) {
            left = leaf;
            right = 5383269053000864513406337829703884940333204026496599059703565359684796208512;
            filledSubtrees[18] = leaf;
        } else {
            left = filledSubtrees[18];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        checkIndex >>= 1;
        // i == 19
        if (checkIndex % 2 == 0) {
            left = leaf;
            right = 13643259613994876902857690028538868307758819349041069235229132599319944746418;
            filledSubtrees[19] = leaf;
        } else {
            left = filledSubtrees[19];
            right = leaf;
        }
        leaf = hasher.poseidon([left, right]);
        unchecked {
            uint256 rootIndex = addmod(currentRootIndex, 1, ROOTS_CAPACITY);
            currentRootIndex = rootIndex;
            roots[rootIndex] = leaf;
            return currentLeafIndex++;
        }
    }
}
