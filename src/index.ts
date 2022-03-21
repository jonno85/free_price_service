import config from "config";
import { Server } from "http";
import os from "os";
import express from "express";
import { createConnectionPool } from "./database/createConnectionPool";
import CustomLogger from "./common/custom-logger";
import { buildApp } from "./app";
import { buildBrokerService, buildClaimService } from "./services";
import { buildAssetRepository } from "./dao/assets";
import { buildAccountRepository } from "./dao/accounts";
import { buildClaimRepository } from "./dao/claim";

const db = createConnectionPool();
const logger = CustomLogger;
const assetRepository = buildAssetRepository({ db, logger });
const accountRepository = buildAccountRepository({ db, logger });
const claimRepository = buildClaimRepository({ db, logger });
const brokerService = buildBrokerService({ db, logger, assetRepository, accountRepository });
const claimService = buildClaimService({ db, logger, brokerService, claimRepository });

const appDependencies = {
  db,
  logger,
  brokerService,
  claimService,
};

let server: Server;

const setupServer = (app: express.Express): void => {
  server = app.listen(config.get("app.port") || 3000, async () => {
    logger.info(`Server running - ENV:${process.env.NODE_ENV} - PORT:${config.get("app.port")}`);
    logger.info("[Server information]", {
      platform: os.platform(),
      osRelease: os.release(),
      totalMemory: `${(os.totalmem() / 1024 ** 3).toFixed(2)} GB`, // bytes to GB
    });
  });

  server.on("close", () => {
    logger.info("SERVER SHUTDOWN");
  });
};

async function exitGracefully(
  eventName: NodeJS.Signals | "uncaughtException",
  exitCode: number,
  error?: Error
): Promise<void> {
  if (error) {
    logger.error("Error while exiting: " + error.message, { error });
  }
  logger.info(`Exit Gracefully Received "${eventName}" event`, {
    eventName,
    exitCode,
  });
  server.close();
  await db.destroy();
}

process.on("SIGTERM", () => exitGracefully("SIGTERM", 0));
process.on("SIGINT", () => exitGracefully("SIGINT", 0));
process.on("uncaughtException", (err: Error) => exitGracefully("uncaughtException", 1, err));

buildApp(appDependencies).then(setupServer).catch(logger.error);
