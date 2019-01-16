# Cash Account Lookup Server

## Installation

```
# git clone ...
# cd lookup-server
# npm install
```

## Configuration

Edit the `config.json` file to your desired **node**, **registration**, **storage**, and **database** settings.

#### Node settings:

* `address`: ip number or domain to an full node.
* `port`: port to connect to the full node.
* `user`: username that is allowed to use RPC calls.
* `pass`: password for the username.

#### Registrations:

* `registrations`: enabled account registrations if set to **public** or **permissioned**.
* `wallet`: account name for the wallet that will pay for registrations.
* TODO: add access and rate limitation configuration.

#### Storage modes:

* `minimal`: Stores account names and number, and looks up the transaction hex and inclusion proofs on-demand.
* `default`: Stores the account names and number as well as the transaction hex and inclusion proofs.
* `extended`: Stores the full account information, transaction and statistical metadata.

#### Database storage:

* `path`: the path to a folder where the database is stored.
* `file`: the filename for the file the database is stored in.


## How to use

#### Server status

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


#### Look up registrations

Once the server has indexed an account, the data can be retrieved with the following:

* `https://hostname:port/search/accountNumber`

   Returns a list of all registrations with the requested account numbers.

* `https://hostname:port/search/accountNumber/accountName`

   Returns a list of all registrations with the requested name and number.


#### Create new accounts

If the server is configured to enable registrations, new accounts can be requested with the following:

* `https://hostname:port/register/accountName/paymentData`