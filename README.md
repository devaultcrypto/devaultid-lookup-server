# Cash Account Lookup Server

## Installation

```
# git clone ...
# cd lookup-server
# npm install
```

## Configuration

Operation modes:

* `minimal`: Stores account names and number, and looks up the transaction hex and inclusion proofs on-demand.
* `default`: Stores the account names and number as well as the transaction hex and inclusion proofs.
* `extended`: Stores the full account information, transaction and statistical metadata.