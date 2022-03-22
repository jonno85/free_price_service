import { Server } from "http";
import supertest from "supertest";
import { buildApp } from "../app";
import CustomLogger from "../common/custom-logger";
import { buildAccountRepository } from "../dao/accounts";
import { buildAssetRepository } from "../dao/assets";
import { buildClaimRepository } from "../dao/claim";
import { createConnectionPool } from "../database/createConnectionPool";
import { truncateTable } from "../database/scripts/bootstrapDB";
import { buildBrokerService, buildClaimService } from "../services";
import { expect, jest, describe, it, beforeAll, beforeEach, afterAll } from "@jest/globals";

const db = createConnectionPool();
const logger = CustomLogger;
const assetRepository = buildAssetRepository({ db, logger });
const accountRepository = buildAccountRepository({ db, logger });
const claimRepository = buildClaimRepository({ db, logger });
const brokerService = buildBrokerService({ db, logger, assetRepository, accountRepository });
const claimService = buildClaimService({ db, logger, brokerService, claimRepository });

describe("Test the Emma Service", () => {
  let server: Server;
  let app: any;

  beforeAll(async () => {
    app = await buildApp({ brokerService, claimService, db, logger });

    server = app.listen();

    server.on("close", async () => {
      await db.destroy();
    });
  });
  afterAll(() => {
    server.close();
    jest.useRealTimers();
  });

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2020, 3, 1, 11, 0));
    await truncateTable();
  });

  const initDbData = async () => {
    // init db
    await accountRepository.save({ id: "emma", name: "emma", cash: 100000, stocks: [] });
    await accountRepository.save({ id: "user1", name: "user1", cash: 0, stocks: [] });
    await assetRepository.save({ id: "1", name: "AAPL", price: 1.0 });
    await assetRepository.save({ id: "2", name: "WWW", price: 10.0 });
    await assetRepository.save({ id: "3", name: "MSFT", price: 100.0 });
  };

  describe("Get health endpoint", () => {
    it("should get the healthcheck", async () => {
      const res = await supertest(app).get("/health");
      expect(res.status).toEqual(200);
      expect(res.body).toStrictEqual({
        service_name: "Emma Claim service",
        health: "OK",
      });
    });
  });
  describe("Given the Market Close", () => {
    it("should reply with the proper error", async () => {
      jest.setSystemTime(new Date(2020, 3, 1, 11, 1));
      await initDbData();
      const data = {
        user: "user1",
      };
      const res = await supertest(app).post("/v1/claim-free-share").send(data);
      expect(res.body).toStrictEqual({
        outcome: "FAILURE",
        errorCode: "MARKET_CLOSE",
        reason: expect.any(String),
      });
    });
  });
  describe("Given the Market Open", () => {
    describe("Given the Firm Account Emma", () => {
      describe("Given the user Account user1", () => {
        describe("Given some shares available", () => {
          it("should get free share", async () => {
            await initDbData();
            const data = {
              user: "user1",
            };
            const res = await supertest(app).post("/v1/claim-free-share").send(data);
            expect(res.status).toEqual(201);
            expect(res.body.outcome).toEqual("SUCCESS");
            const response = res.body.data;
            expect(res.body.outcome).toEqual("SUCCESS");
            expect(response.quantity).toEqual(expect.any(Number));
            expect(response.success).toEqual(true);
            expect(response.sharePricePaid).toEqual(expect.any(Number));
            expect(response.tickerSymbol).toEqual("AAPL");
          });
        });
        describe("Given the user asking twice the free claims", () => {
          it("should not get free share a second time", async () => {
            await initDbData();
            const data = {
              user: "user1",
            };
            const res = await supertest(app).post("/v1/claim-free-share").send(data);
            expect(res.status).toEqual(201);
            const res2 = await supertest(app).post("/v1/claim-free-share").send(data);

            expect(res2.status).toEqual(400);
            expect(res2.body).toStrictEqual({
              outcome: "FAILURE",
              errorCode: "CLAIMED_ALREADY",
              reason: "The user already claimed the free prize",
            });
          });
        });
      });
      describe("Given the user Account not available", () => {
        it("should create the new account and get free share", async () => {
          await initDbData();
          const data = {
            user: "user2",
          };

          const res = await supertest(app).post("/v1/claim-free-share").send(data);
          expect(res.status).toEqual(201);

          const response = res.body.data;
          expect(res.body.outcome).toEqual("SUCCESS");
          expect(response.quantity).toEqual(expect.any(Number));
          expect(response.success).toEqual(true);
          expect(response.sharePricePaid).toEqual(expect.any(Number));
          expect(response.tickerSymbol).toEqual("AAPL");
        });
      });
    });
  });
});
