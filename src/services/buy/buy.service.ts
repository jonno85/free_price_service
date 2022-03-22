import { CustomLogger } from "ajv";
import { Knex } from "knex";
import { BuyShareSuccess, ShareService } from "./interface";
import { BrokerService } from "../broker/interface";
import { OutcomeFailure } from "../../common/outcome/outcome";
import { ShareRepository } from "../../dao/shares";

export interface ShareServiceConfiguration {
  db: Knex;
  logger: CustomLogger;
  brokerService: BrokerService;
  shareRepository: ShareRepository;
}

export function buildShareService(dependencies: ShareServiceConfiguration): ShareService {
  const { brokerService, logger, shareRepository } = dependencies;

  const buyShare = async (
    user: string,
    quantity: number,
    tickerSymbol: string
  ): Promise<BuyShareSuccess | OutcomeFailure> => {
    const marketOpenResult = await brokerService.isMarketOpen();

    if (!marketOpenResult.open) {
      return {
        outcome: "FAILURE",
        errorCode: "MARKET_CLOSE",
        reason: "Market will reopen at " + marketOpenResult.nextOpeningTime,
      };
    }

    // To keep things simple, the check on available money in user account is not performed
    const buySharesResult = await brokerService.buySharesInRewardsAccount(tickerSymbol, quantity);

    if (!buySharesResult.success) {
      return {
        outcome: "FAILURE",
        errorCode: "FAILS_TO_BUY_SHARE",
        reason: "Cannot buy shares",
      };
    }

    const sharePricePaid = buySharesResult.sharePricePaid;
    const amount = sharePricePaid * quantity;
    const moveSharesFromRewardsAccountResult = await brokerService.moveSharesFromRewardsAccount(
      user,
      tickerSymbol,
      quantity
    );
    if (!moveSharesFromRewardsAccountResult.success) {
      return {
        outcome: "FAILURE",
        errorCode: "FAILS_TO_MOVE_SHARE",
        reason: "Cannot move shares",
      };
    }

    const saveResult = await shareRepository.save({
      amount,
      date: new Date(),
      account: user,
      order: [
        {
          tickerSymbol,
          quantity,
          sharePricePaid,
        },
      ],
    });

    if (saveResult.outcome === "FAILURE") {
      return {
        outcome: "FAILURE",
        errorCode: "FAILS_TO_SAVE_CLAIM",
        reason: "Cannot save claim",
      };
    }

    return {
      outcome: "SUCCESS",
      data: {
        success: true,
        quantity,
        sharePricePaid,
        tickerSymbol,
      },
    };
  };

  return {
    buyShare,
  };
}
