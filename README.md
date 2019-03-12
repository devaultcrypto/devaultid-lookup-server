# Cash Account Lookup Server

## Requirements

This lookup server is written for NodeJS and fetches data and gets information about new blocks from a full node supporting the Bitcoin RPC interface configured to index all transactions.

## Installation

```
# git clone https://gitlab.com/cash-accounts/lookup-server
# cd lookup-server
# npm install
```

## Configuration

Edit the `config.json` file to your desired **server** and **node** settings.

#### Server settings:

* `port`: Which port the server should listen for requests on.
* `database`: Where to store the servers database file(s).
* `storage`: What data should be cached by the server.

#### Node settings:

* `address`: ip number or domain to an full node.
* `port`: port to connect to the full node.
* `user`: username that is allowed to use RPC calls.
* `pass`: password for the username.

#### Automatic block notifications

To make the server automatically respond to new blocks, add a line in `/etc/bitcoin/bitcoin.conf`:

```
# Update cash account index upon new block.
blocknotify=curl "http://localhost:8585/newblock"
```

## How to use

Before you can use the lookup server you need to start it by running:

```
# node server.js
```

#### Server status (NOT IMPLEMENTED)

* `https://hostname:port/status`

   Returns a JSON object with information about the indexing process and server configuration.
   
   ```
   {
       status: '',
       block_height: 0,
       block_chain: '0xABCDEF0123456789ABCDEF0123456789',
       registrations: false
   }
   ```


#### Look up account registrations

Once the server has indexed an account, the registration transaction(s) and there inclusion proofs can be retrieved with a GET request to the following locations:

* `https://hostname:port/lookup/<accountNumber>`

   Returns a list of all registrations with the requested account numbers.

* `https://hostname:port/lookup/<accountNumber>/<accountName>`

   Returns a list of all registrations with the requested name and number.


#### Look up account metadata

Once the server has indexed an account, the account metadata can be retrieved with a GET request to the following locations:

* `https://hostname:port/account/<accountNumber>/<accountName>/<accountHash>`

   Returns metadata for a single account.


#### Register new accounts (NOT IMPLEMENTED)

If the server is configured to enable registrations, new accounts can be requested by sending a GET request to the following location:

* `https://hostname:port/register/<accountName>/<paymentData>`