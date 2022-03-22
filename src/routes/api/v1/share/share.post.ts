import Boom from "@hapi/boom";
import { NextFunction, Request, Response } from "express";

import CustomLogger from "../../../../common/custom-logger";
import { ShareService } from "../../../../services/buy/interface";
import { buyShareValidationSchema } from "./validation";

export function buildBuyShareHandler(dependencies: { shareService: ShareService }) {
  const { shareService } = dependencies;
  return async function buyShareHandler(req: Request, res: Response, next: NextFunction) {
    try {
      const validationResult = buyShareValidationSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).send(validationResult.error);
      }

      const { user, quantity, tickerSymbol } = validationResult.data;
      const result = await shareService.buyShare(user, quantity, tickerSymbol);

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
