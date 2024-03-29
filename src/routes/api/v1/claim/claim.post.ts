import Boom from "@hapi/boom";
import { NextFunction, Request, Response } from "express";

import CustomLogger from "../../../../common/custom-logger";
import { ClaimService } from "../../../../services";
import { claimFreeShareValidationSchema } from "./validation";

export function buildGetClaimHandler(dependencies: { claimService: ClaimService }) {
  const { claimService } = dependencies;
  return async function getClaimHandler(req: Request, res: Response, next: NextFunction) {
    try {
      const validationResult = claimFreeShareValidationSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).send(validationResult.error);
      }

      const { user } = validationResult.data;
      const result = await claimService.claimFreeShare(user);

      if (result.outcome === "FAILURE") {
        return res.status(400).send(result);
      }

      return res.status(201).send(result);
    } catch (e: any) {
      CustomLogger.error(e);

      return next(Boom.badRequest(e));
    }
  };
}
