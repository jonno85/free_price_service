# Description

Emma technical Task

The system serves the endpoint `/claim-free-share` which takes the input `user` field to return a random amount of share as a reward according to the initial distribution map.

# Broker service

it is the API service (not REST), acting as blackbox to the system which maintains table for `accounts` and `assets`.

# Claim service

it is the service that takes the input request and contacts the broker api to reward the user with a random number of share and values.

# Share service (not finished due to miss of information)

for the bonus task #1, the CPA value considers the amount of value bought from users in stocks. This service enable a second api endpoint `/buy-share` to let any already registered user buy any stock from the broker. (For simplicity, an initial amount of 1000 is added to the registered user, in any case the user cash availability is not checked to avoid below 0 situations.)

# Implementation

I tried this task leveraging `expressjs` (not experienced but worth to try), I used the IoC pattern to let the dependencies injection and test better the code.
All the path, except the healtcheck, are behind the `v1` subpath for api versioning.

# To prepare the environment

1. docker-compose up -d
2. npm install
3. npm run migrate:up

# Tests (e2e)

4. npm run test

# To run the application

5. npm run dev

# Containerazed app
Normally to create and run the containered app the following steps are enoguh
to build the container:
`docker build -t emma_app .`
to run the container:
`docker run -p 8000:8000 --network=host emma_app`

Unfortunately I am not able to let communicate the dockerized app with the running postgres sql execution
