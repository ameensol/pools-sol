# Features

-   Deposited funds cannot be locked or stolen (non-custodial and non-restrictive)
-   Zero knowledge proofs secure user's privacy
-   Users have the freedom to choose an anonymity set upon withdrawal
-   Removing illicit deposits from an anonymity subset accomplished two things:
    -   Proves a withdrawal is clean without violating the privacy of the specific user, and
    -   Reduces the anonymity sets of hackers, acting as a deterrent and as a dampening force for illicit activity
-   Enables customizable community driven anti blackhat and anti money laundering coordination in a credibly neutral way

## Read More
You can read more about privacy pools in [docs](./docs).

# Dependencies

-   [npm](https://www.npmjs.com/) / [yarn](https://yarnpkg.com/)
-   [rust](https://www.rust-lang.org/tools/install) / [circom2](https://docs.circom.io/getting-started/installation/)
-   [python3](https://www.python.org/downloads/)

# Install and Test Locally
Only tested on a UNIX-like OS (linux or mac).

## Clone the Repo
```sh
$ git clone https://github.com/ameensol/privacy-pools
$ cd privacy-pools
```

## Install Dependencies
```sh
$ yarn
```

or

```sh
$ npm install .
```

## Setup Circuit Locally
```sh
$ bash ./scripts/setup.sh
```

## Run the Tests
```sh
$ hardhat test
```

## Setup and Run Slither
Install the [solc](https://github.com/ethereum/solidity#build-and-install) compiler. If you're on linux and use `apt` you can install it this way:
```sh
$ sudo add-apt-repository ppa:ethereum/ethereum
$ sudo apt-get update
$ sudo apt-get install solc
```


Setup python virtual environment:
```sh
$ python3 -m venv venv
$ source ./venv/bin/activate
(venv) $ pip3 install -r requirements.txt
```
Run slither:
```sh
(venv) $ slither --hardhat-cache-directory=./build/cache --hardhat-artifacts-directory=./build/artifacts .
```

If you don't activate the python venv you can use:
```sh
$ ./venv/bin/slither --hardhat-cache-directory=./build/cache --hardhat-artifacts-directory=./build/artifacts .
```

# Working To Do List
2. AccessList Lib
    - Add compression
    - Extend js unit tests
    - NFT api: deploy, mint, upload to IPFS
    - Define IPFS Metadata interface
    - Deposit event listener + AccessList maintainer
3. AccessList NFT Contract
    - ERC721 NFT contract for storing access lists on chain
    - Currently maintains blocknumber + treeType per subsetRoot
    - Need to add chainId and contractAddress
    - Optional to add asset and denomination
    - Integrate Owner.sol
    - Integrate an initial bootstrap list of sus addresses
4. Interface and testnet deployment
    - Simple UI
    - Deposit and withdraw
    - Simple subsetRoot table
    - Testnet deployment
    - Answer open questions
        - Public registry of relayer IPs?
        - Should it display the connected wallet's status (e.g. if its sanctioned)?
        - Should it display any deposits that have been flagged by the list providers as being sus?
        - Should it display a list of the user's deposits?
        - Should it give an anonymity estimate based on number of new deposits?
5. Relayer server
    - Only accepts withdrawals from roots that are publicly posted in chosen NFT contracts
    - Tracks the deposits and subsets internally
    - Public registry of relayer IPs, permissionless listing? Since we want to make a static site, there should be some route for relayers to add themselves to the list without needing to update the site
    - I can probably think of multiple ways to decentralize this but probably for the initial demo we should just have one and ignore unknown subset roots