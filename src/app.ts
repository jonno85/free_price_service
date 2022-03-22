import { CustomLogger } from "ajv";
import express from "express";
import httpErrors from "http-errors";
import { Knex } from "knex";
import path from "path";

import customErrorHandler from "./common/custom-error-handler";
import buildClaimRouter from "./routes/api/v1/claim";
import buildShareRouter from "./routes/api/v1/share";
import healthRouter from "./routes/health";
import { BrokerService, ClaimService } from "./services";
import { ShareService } from "./services/buy/interface";

export type AppDependencies = {
  logger: CustomLogger;
  db: Knex;
  claimService: ClaimService;
  brokerService: BrokerService;
  shareService: ShareService;
};

export async function buildApp(dependencies: AppDependencies): Promise<express.Express> {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(express.static(path.join(__dirname, "public")));

  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    next();
  });

  const claimRouter = buildClaimRouter(dependencies);
  const shareRouter = buildShareRouter(dependencies);

  app.use("/health", healthRouter);
  app.use("/v1", claimRouter);
  app.use("/v1", shareRouter);

  app.use((req, res, next) => {
    next(httpErrors(404));
  });

  app.use(customErrorHandler);

  return app;
}
