# Privacy Pools with Voluntary Anonymity Sets

This is an experiment in the next generation of non-custodial privacy pools on Ethereum. It demonstrates a system where withdrawals add a second proof of inclusion within an arbitrary subset of deposits. Using this tool, users may remove themselves from an anonymity set containing hacked funds, and this is done completely in zero knowledge without sacrificing the privacy of the user. This tool allows communities to "fork" an anonymity set to exclude laundered funds or funds originating from on-chain hacks.

## Overall Purpose

**Design, implement, and test the next generation of simple privacy pools on Ethereum.**

## Why Is This Important?

Lazarus group used sophisticated social engineering attacks (and malware from a PDF) to target specific human beings that operated validators in the largest cyber heist in history. It is true that sanctioning Tornado Cash hinders the ability of North Korean hackers and other blackhat hackers to launder funds stolen in this heist and in others, but this comes at the cost of reduced security for regular users and developers within the Ethereum ecosystem, and it exposes developers within OFAC jurisdictions to personal legal issues despite not being North Koreans or blackhat hackers.

Lack of privacy on the Ethereum blockchain, over the long term, will steadily increase the likelihood of blackhat hacks due to an increasing ability to de-anonymize key controllers that operate high TVL systems (e.g. bridges, DAOs, oracles, side-chains, DeFi protocols, etc.). Therefore, as time goes on, without privacy tools, lazarus group and other malicious hackers paradoxically have an increased cyber capability to steal more funds by using forensic analysis to deanonymize targets using public blockchain data.

**To protect the Ethereum ecosystem and to help prevent further acquisition of funds by scammers, hackers, and rogue states, an evolved privacy solution must fill the security gap that has been left in the wake of the tornado sanctions.**

This experiment is also important to demonstrate and explore the limits of zero knowledge proofs as a financial privacy tool. Combining sophisticated zero knowledge schemes with timely, statistically accurate information about illicit activity allows credibly neutral procedures to react to hackers.

## Features

-   Deposited funds cannot be locked or stolen (non-custodial and non-restrictive)
-   Zero knowledge proofs secure user's privacy
-   Users have the freedom to choose an anonymity set upon withdrawal
-   Removing illicit deposits from an anonymity subset accomplished two things:
    -   Proves a withdrawal is clean without violating the privacy of the specific user, and
    -   Reduces the anonymity sets of hackers, acting as a deterrent and as a dampening force for illicit activity
-   Enables customizable community driven anti blackhat and anti money laundering coordination in a credibly neutral way

## Main Contents

-   Circom circuit for proof of membership in a subset:
    -   [withdraw_from_subset.circom](../circuits/withdraw_from_subset.circom)
-   Scripts to generate local proving keys:
    -   [scripts/](../scripts/)
-   Unit tests:
    -   [test/](../test/)
-   Example build of non-custodial privacy pool:
    -   [PrivacyTokenPool.sol](../contracts/PrivacyTokenPool.sol)

# How it Works

The procedure of using the privacy pool can be broken into three stages.

## 1. Deposit

The deposit stage requires interacting directly with the blockchain. This is the most decentralized and censorship resistant part of the protocol.

1. Generate a cryptographic commitment from a secure secret.
2. Call `approve` on the token contract (if depositing an ERC20 token).
3. Call `deposit` on the privacy pool contract, using the commitment from 1.
    - The contract recomputes the new merkle root of the deposits tree, which now includes the user's commitment.
    - The user's deposit gets a unique integer value `index` that is the equivalent of their path in the deposits tree.

## 2. Wait

Wait for the anonymity set to grow. Practically speaking, this means waiting for other users to deposit. If a depositor is identified as a hacker or a sanctioned address, then their deposits can be excluded from the withdrawal anonymity set in the final stage. If a blackhat hack happens on-chain, and if the hacker tries to use the privacy pool, then the optimal play for a regular user is to wait until a DAO or a forensic analysis firm generates a safe subset list that doesn't include the hacker's funds.

## 3. Withdraw

The withdraw stage requires interacting indirectly with the blockchain via a third party relayer. This is the area where centralization, censorship or noncompliance is a greater risk.

Users achieve compliance at the moment of withdrawal by generating a proof of inclusion within a subset of deposits containing only licit deposits. Such a subset proof of inclusion cryptographically guarantees that the deposit doesn't come from a hacker or a sanctioned address, but it doesn't reveal the specific deposit, so it maintains its anonymity of the user within the subset of good deposits. An external observer can verify that the withdrawal came from regular users, but can't tell which regular user it was specifically.

Relayers achieve compliance by denying withdrawals from subset proofs that use an unrecognized subset root or that use a subset that contains illicit deposits. Relayers that engage in activity with noncompliant transactions are susceptible to individual takedown without threatening the protocol for regular users. Having a large set of compliant relayers and the susceptibility of noncompliant relayers to takedowns denies even the opportunity for blackhat hackers to use the privacy pools.

# Technical Description

[Paraphrasing from Vitalik's description in Coinbase's podcast](https://www.youtube.com/clip/Ugkx7LeQPvONM0OFOfAUazyjf0JSj_9y7Tqw), we want to do this one simple thing:

> One simple thing that you can do is you can create a privacy pool where when you withdraw, in addition to just making a zero knowledge proof that proves that you have a valid deposit and that your valid deposit wasn't spent yet, you could also make a zero knowledge proof that says that this withdrawal is not part of one of this subset of deposits or this withdrawal is part of one of this subset of deposits.

-   In addition to proving the existence of an unspent deposit, withdrawals prove inclusion in a subset of the deposits tree.
-   Withdrawals associate with a subset by using a proof of inclusion. This is a regular merkle proof, the same as the proof of a valid deposit.
-   The subset proof uses a merkle tree that is "parallel" to the deposit's tree. The index of the commitment in the deposit tree is the index of the permission status in the access list.
-   Subsets of deposits are efficiently represented as a subset merkle root (1 evm word).
-   A blocked deposit in an access list cannot withdraw using that subset root. This protects the members of that access list from being used to legitimize a withdrawal originating from stolen funds.
-   The difference between a block list and an access list is the default value that the initial root of the tree is constructed from.
    -   A blocklist is not future proof from illicit deposits. In the best case, it is the most efficient to maintain. If only licit deposits enter the privacy pool, then list maintainers perform little to no work. In the worst case, it is the least efficient to maintain. If only illicit deposits enter the privacy pool, then list maintainers must update the subset root after each deposit.
    -   An allowlist is future proof from illicit deposits. In the worst case, it is the most efficient to maintain. If only illicit deposits enter the privacy pool, then list maintainers perform little to no work. In the best case, it is the least efficient to maintain. If only licit deposits enter the privacy pool, then list maintainers must update the subset root after each deposit.
-   Subset merkle roots are provided in calldata at the time of withdrawal and validated in the zero knowledge proof, and there are no restrictions on which subset roots can be chosen.
    -   It shouldn't be possible to provide an invalid subset root, but even if it was possible, that withdrawal would simply be untrusted by default, because it wouldn't be possible to verify which subset of deposits is represented by a nonsensical root.

The fact that every withdrawal must associate with a subset in the deposits tree does not necessarily restrict the anonymity set for a given deposit. Reason: the set of all deposits is a subset of all deposits. It is possible to withdraw by associating with the subset of deposits that is the set of all deposits. The way this is done is by using the empty block list for the subset proof.

## Access Lists

We introduce two types of access lists: block lists and allow lists. Since we're only concerned with proving statements about subsets of deposits, we use merkle trees of matching depth to the deposits tree. We refer to specific deposits in subset trees by their actual index in the deposit tree. That is, the zero knowledge proof requires the second merkle proof (subset proof) to be computed from the same path in the first merkle proof (valid deposit proof).

Only the root of an access tree needs to be posted on-chain, and it can be efficiently verified using off-chain data. If an access list cannot be recovered from its subset merkle root, then that withdrawal is considered unknown and can be assigned a higher risk profile for originating from illicit deposits. Likely unidentifiable roots be ignored by relayers and be forced to choose a different, publicly verified access list, which would outright prevent its withdrawal if the only available lists are compliant lists.

**Deposit list:**

For reference, first we describe the deposit list. The deposit list is represented as a merkle tree root on-chain. When a user makes a deposit, the root of the tree is updated to reflect the new list of deposits. The zero value of a deposit tree is `keccak256("empty")`.

It’s statisically impossible that a depositor will generate a commitment that collides with the zero value, hence we are certain that the funds can’t be rugged.

**Allow list:**

The zero value of an allowed tree is `keccak256("blocked")`.

Deposits are blocked by default. To allow a deposit, set the value at its index in the allow list to `keccak256("allowed")`.

**Block list:**

The zero value of a blocked tree is `keccak256("allowed")`.

Deposits are allowed by default. To block a deposit, set the value at its index in the block list to `keccak256("blocked")`.

**Visualizing the lists**

| ![trees chart](./img/trees_chart.png) |
| :-----------------------------------: |
|     Featuring a naughty multi sig     |

When the proof is generated, the depositor chooses an arbitrary list to prove inclusion with, and this is verified in the zero knowledge proof on-chain. In either case of a block list or an allow list, the proof is only valid if the leaf value at the deposit’s index in the subset tree is equal to `keccak256("allowed")`. Technically, the blocked value is irrelevant, but the convention of choosing `keccak256("blocked")` makes it easier to transmit lists and generate the associated trees.

Strategically choosing allowed and blocked values in this manner simplifies storing and transmitting the subsets because you can represent a subset of deposits with a bit string that has a length at most equal to one plus the index of the last non-default value in the list, where 0 in the bit string denotes the default value for the tree type and 1 in the bit string denotes the opposite value for the tree type.

For example, suppose we wanted to create a block list that blocks deposits 0, 12, 32, and 42. Now consider that the deposits tree has 1000 deposits. We only need to make a bit string of maximum length 42 to fully encode the block list, despite the fact that the deposits tree has many more deposits. E.g.,

```json
{
    "treeType": "blocklist",
    "list": "000000000001000000000000000000010000000001"
}
```

We can take this a step further by omitting all bits up to and including the first non-default value by providing an initial index:

```python
{
    "treeType": "blocklist",
    "firstIndex": 12, // in binary: 0b000000000000000000001100
    "list": "000000000000000000010000000001"
}
```

The size of this list is 30 bits, plus the 3 bytes to represent the first index, summing to 54 bits (excluding json keys). This only saves space when the first index is greater than a certain value.

The maximum length of a subset compressed in this form is $2^{20}$ bits, or 128 KiB. Since that’s relatively small, these lists can be stored on-chain in transaction calldata. The list will consume less than 80k gas to be included in calldata up to the 10,000th deposit, less than 800k gas up to the 100,000th deposit, and roughly 8 million gas to post a list up to the final deposit in the tree. In all cases this can fit within the gas limit of a block, and it’s only a one-time cost. We can also use compression to reduce the on-chain footprint.

An alternatively is to represent the access list by explicitly providing the indices of the affected values as an array of `uint24[]`, which is an integer size that is the nearest multiple of 8 that can accommodate the highest index in the trees ($2^{20}$). Following from above this would look like:

```json
{
    "treeType": "blocklist",
    "list": [0, 12, 32, 42]
}
```

In terms of bit representation this would be:

```python
{
    "treeType": "blocklist",
    "list": [0b000000000000000000000000, 0b000000000000000000001100, 0b000000000000000000100000, 0b000000000000000000101010]
}
```

This kind of deal would only be useful if there was a large gap between two deposits in the tree. For example, blocking deposits 12 and 4077. I think this shows there will be a different optimal compressed form for lists depending on the composition of the list. It may be worthwhile to add another parameter that gives a "compression type" depending on the various potential cases.

Depositors reconstruct the subset tree in the browser with only the bit string and the tree type. A given subset tree has a maximum size that’s equal to the maximum size of the deposit tree. So long as the deposit tree merkle proof can be computed in the browser, the proof of inclusion in a subset can be computed in the browser, therefore the overhead of adding this proof should not impede the feasibility of the system based on hardware constraints.

The zero knowledge proof will publicly expose the subset root of the block or allow list it belongs to, while maintaining the privacy of the deposit. A withdrawal can associate with any valid subset root. It’s up to social consensus to determine which subsets contain exclusively licit actors (for allow lists) or which subsets contain exclusively illicit actors (for block lists). Remember, a withdrawal can simply use the empty blocklist root to avoid proving membership in any smaller subset of the deposits tree, and the privacy pools cannot steal funds or censor any individuals. It's purely neutral infrastructure that enables a layer of social governance on top of a credibly neutral tool. What the communities decide from there cannot destroy any user's funds.

In the ideal case, the community will natively defend itself against blackhat activity, and this will all be publicly verifiable. Money laundering activity may be negligible using this protocol. That would be the ideal outcome of this experiment! Admittedly, this design adds new layers of complexity that will need to be solved, mainly around curating lists, labelling curated lists, and communicating which lists are good or bad in a user friendly way.

One way to facilitate the decentralized curation of the subsets is to use subset root values as token ids of NFTs. The metadata of the NFTs can point to a block number where the subset bitstring representation and tree type of the list is emitted in a transaction’s calldata (or IPFS can be used). A dao, multisig, or EOA can mint NFTs of curated subsets, and users can reconstruct their chosen subset tree for use in their merkle proofs using entirely on-chain data by browsing a catalogue of community-curated lists represented nicely as an NFT gallery.

## ZK Scheme

See [withdraw_from_subset.circom](./circuits/withdraw_from_subset.circom) for the circom implementation of this scheme. I'm not the best with math notation so it might make more sense to read the actual circom file.

### **Definitions**

$$
\begin{aligned}
\psi &= \text{poseidon hash function}\\
\kappa_q &= \text{keccak256 hash function, mod q if necessary}\\
R_{C'} &= \text{Merkle root of all deposits}\\
M_{C'} &= \text{array of elements that form a merkle proof in }R_{C'}\\
R_a &= \text{merkle root of some subset of }R_{C'}\\
M_a &= \text{array of elements that form a merkle proof in }R_a\\
A &= \text{asset public metadata: }\kappa_q(\text{token, denomination})\\
W &= \text{withdraw public metadata: }\kappa_q(\text{recipient, relayer, fee})\\
E &= \text{expected value in the subset: }\kappa_q(\text{"allowed"})\\
s&= \text{crytographically secure random value}\\
C &= \text{raw commitment: }\psi(s)\\
C' &= \text{stamped commitment: }\psi(C, A)\\
C'_i &= \text{$i$-th commitment in } R_{C'}\\
N_i &= \text{nullifier for $C'_i$: }\psi(s, 1, i)\\
\end{aligned}
$$

### **Prove**

$$
\begin{aligned}
C &= \psi(s)\\
C' &= \psi(C, A)\\
N_i &= \psi(s, 1, i)\\
R_{C'} &= \text{VerifyMerkleProof}(C', i, M_{C'})\\
R_{a} &= \text{VerifyMerkleProof}(E, i, M_a)\\
W^2 &= W \cdot W
\end{aligned}
$$

**Private Inputs**

1. $s$
2. $i$
3. $M_{C'}$
4. $M_a$

**Public Inputs**

1. $R_{C'}$
2. $R_a$
3. $N_i$
4. $A$
5. $W$

# To Do

1. Finish Solidity implementation & unit tests
    - PrivacyTokenPool.test.js
        1. Test all revert conditions in the following imported libraries
            - OpenZeppelin reentrancy guard
            - OpenZeppelin safe erc20
        2. Test that an invalid zk proof will revert
        3. Test that a duplicate nullifier (double spend) will revert
        4. Test the msg.value revert conditions in both withdraw and deposit
        5. Test the stale merkle root revert in withdraw
        6. Test the fee > amount revert in withdraw
        7. Test ERC20 token deposits and withdrawals
2. Subset compression and decompression algorithms
    - Merkletree/bitset combo class in accessList.js needs to be finished
    - Finalize the functions (do we need both blockList.js and allowList.js when we have accessList.js?)
    - Implement brotli compression and decompression for the bitstrings
    - Add js unit tests for these algos and functions
3. Contracts/library for posting/retrieving data on-chain
    - ERC721 NFT contract for storing access lists on chain
        1. Will use a `mint` function that emits the `treeType`, `subsetRoot`, and `subsetString` in a log event. The `tokenId = subsetRoot` for the NFT that gets minted. There's not a realistic way to enforce that the subsetString recovers to the subsetRoot, so the minter of the contract should be gated by some admin. Anyone can deploy and manage their own NFT access list contracts.
        2. On-chain metadata will return `block.number` of this event. The user may use the `tokenId` of a `subsetRoot` NFT to recover the `subsetString` and `treeType` from on-chain data. Using this data, they can reconstruct the access list as a merkle tree and use it to do proof of inclusion in either an allow list or a block list.
        3. The maintainers of the NFT contract should digest address information from some authority, ideally a decentralized hacker/scammer/phisher/rugpuller listing dao, but it could be TRM labs or chainalysis oracles as well, or a combination thereof
           a. The js library provides a `createSubsetFromFilter` that generates subset data using a given array of deposits and a user defined `filterFunction`
4. Interface and testnet deployment
    - Simple UI without any styling, can be raw html / css or a framework react/next.js etc
    - The NFT contract might best be deployed on Arbitrum Nova because the dominating cost of the contract execution is going to be calldata for large subsets (anywhere from 80k gas up to 8m gas on mainnet, ouch), and it has low security requirements realistically (since its not enforced by contract storage, but instead just by contract calldata and the zk proof) but we can put the privacy pools somewhere with stronger security guarantees
    - Deposit and withdraw forms
    - Listing of NFTs (somehow make this user friendly, perhaps adding a description to the metadata?) to choose from specific deposit subsets
    - Listing of relayer(s)?
    - Should it display the connected wallet's status (e.g. if its sanctioned)?
    - Should it display any deposits that have been flagged by the list providers as being sus?
    - Should it display a list of the user's deposits
    - Should it give an anonymity estimate based on number of new deposits?
5. Relayer server
    - Only accepts withdrawals from roots that are publicly posted in chosen NFT contracts
    - Tracks the deposits and subsets internally
    - Public registry of relayer IPs, permissionless listing? Since we want to make a static site, there should be some route for relayers to add themselves to the list without needing to update the site
    - I can probably think of multiple ways to decentralize this but probably for the initial demo we should just have one and ignore unknown subset roots
