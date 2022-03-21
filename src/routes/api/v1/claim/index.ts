import express from "express";
import { ClaimService } from "../../../../services";

import { buildGetClaimHandler } from "./claim.post";

export default function buildClaimRouter(dependencies: { claimService: ClaimService }) {
  const { claimService } = dependencies;
  const claimRouter = express.Router();

  const claimHandler = buildGetClaimHandler({ claimService });

  claimRouter.post("/claim-free-share", claimHandler);

  return claimRouter;
}
