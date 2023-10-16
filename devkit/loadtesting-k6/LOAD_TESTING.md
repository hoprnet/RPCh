# Load test

See architecture overview [https://docs.rpch.net/docs/tutorial-basics/Architecture-overview](https://docs.rpch.net/docs/tutorial-basics/Architecture-overview)

The following step orchestrates all the components (except for entry & exit nodes) locally and use the remote entry and exit nodes. 

## Running RPCh locally

### Build locally

Ensure that node v18 is used

```bash
nvm use 18
```

### Run Postgres database for the “discovery platform”

1. Install Postgres
    
    ```bash
    docker run --name postgres -e POSTGRES_HOST_AUTH_METHOD=trust -p 5432:5432 -d postgres
    ```
    
2. Verify Connect to the postgres server and create a database of name “rpch_dp”
    
    ```bash
    createdb -U postgres -h 127.0.0.1 rpch_dp
    ```
    

### Start the discovery platform

```bash
cd apps/discovery-platform/; DEBUG=rpch:* ADMIN_SECRET=topsecret SESSION_SECRET=toppersecret PORT=3020 URL="http://127.0.0.1:3020" GOOGLE_CLIENT_ID="foo" GOOGLE_CLIENT_SECRET="bar" DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/rpch_dp yarn start
```

### Populate table with remote entry and exit nodes

1. Download the sql file that contains metadata of entry and exits nodes to `NODES_SQL_FILEPATH` and run in a new terminal tab
    
    ```bash
    export NODES_SQL_FILEPATH=~/Downloads/rpch-test/nodes.sql
    ```
    
2. Populate the database with the downloaded file.
    
    ```bash
    psql -U postgres -h 127.0.0.1 -d rpch_dp < $NODES_SQL_FILEPATH
    ```
    
    This command should return `COPY 25`
    
3. Check that the `registered_nodes` table has been populated as expected. . Connect to the database, then run commands in postgres
    
    ```bash
    psql -U postgres -h 127.0.0.1 -d rpch_dp
    ```
    
    1. List all the tables. 20+ rows should be returned.
        
        ```sql
        \d
        ```
        
    2. Check 25 entries are in the `registered_nodes` table
        
        ```sql
        select * from registered_nodes ;
        ```
        
    3. Check 0 pairing between entry and exit nodes
        
        ```sql
        select * from zero_hop_pairings ;
        ```
        
4. In the same session, populate user in the db
    
    ```sql
    select * from users ;
    insert into users (id, name) values (gen_random_uuid(), 'loadtest');
    insert into clients (id, user_id, external_token) values (gen_random_uuid(), (select id from users), 'loadtesting-secret');
    select * from clients ;
    ```
    
5. Now there should be 150 pairing between entry and exit nodes
    
    ```sql
    select * from zero_hop_pairings ;
    ```
    

### Start the availability monitor

In a new terminal tab, run

```bash
cd apps/availability-monitor/; DEBUG=rpch:availability-monitor:* PORT=9080 DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/rpch_dp yarn start
```

### Run RPC server

In a new terminal tab, run

```bash
cd apps/rpc-server/; DEBUG=* FORCE_ZERO_HOP=true PORT=45740 DISCOVERY_PLATFORM_API_ENDPOINT="http://127.0.0.1:3020" CLIENT=loadtesting-secret DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/rpch_dp yarn start | tee ~/Downloads/rpch-test/test.log
```

### Run k6 load test

In a new terminal tab, run

```bash
cd devkit/loadtesting-k6; RPC_SERVER_URL=http://localhost:45740 yarn start:spike-small
```

Check the result json file and "500” means that there’s failure in RPCh side