import express from "express";
import { ShareService } from "../../../../services/buy/interface";
import { buildBuyShareHandler } from "./share.post";

export default function buildShareRouter(dependencies: { shareService: ShareService }) {
  const { shareService } = dependencies;
  const shareRouter = express.Router();

  const shareHandler = buildBuyShareHandler({ shareService });

  shareRouter.post("/share", shareHandler);

  return shareRouter;
}
