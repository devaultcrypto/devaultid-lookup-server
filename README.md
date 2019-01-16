# Cash Account Lookup Server

## Installation

```
# git clone ...
# cd lookup-server
# npm install
```

## Configuration

Edit the `config.json` file to your desired **operation mode** and **node connection**

Operation modes:

* `minimal`: Stores account names and number, and looks up the transaction hex and inclusion proofs on-demand.
* `default`: Stores the account names and number as well as the transaction hex and inclusion proofs.
* `extended`: Stores the full account information, transaction and statistical metadata.

Node settings:

* `address`: ip number or domain to an full node.
* `port`: port to connect to the full node.
* `user`: username that is allowed to use RPC calls.
* `pass`: password for the username.