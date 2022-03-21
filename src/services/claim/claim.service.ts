import { CustomLogger } from "ajv";
import { Knex } from "knex";
import { ClaimFreeShareSuccess, ClaimService } from "./interface";
import config from "config";
import { BrokerService } from "../broker/interface";
import { OutcomeFailure } from "../../common/outcome/outcome";
import { ClaimRepository } from "../../dao/claim";

export interface ClaimServiceConfiguration {
  db: Knex;
  logger: CustomLogger;
  brokerService: BrokerService;
  claimRepository: ClaimRepository;
}

export type ClaimEntry = {
  p0: number;
  p1: number;
  min: number;
  max: number;
};
const claimsConfiguration = config.get("claims") as Array<ClaimEntry>;

export function getSelectedValue() {
  const randomClaimAmount = Math.random();

  const selectedRange = claimsConfiguration.filter(
    (entry) => randomClaimAmount >= entry.p0 && entry.p1 > randomClaimAmount
  )?.[0] ?? { min: 3, max: 10 };
  return Math.floor(Math.random() * (selectedRange.max - selectedRange.min) + selectedRange.min);
}

export function buildClaimService(dependencies: ClaimServiceConfiguration): ClaimService {
  const { brokerService, logger, claimRepository } = dependencies;

  const updatedPrices = new Map<string, number>();

  const collectSharePrice = async () => {
    const listTradableAssetsResult = await brokerService.listTradableAssets();
    if (listTradableAssetsResult.length === 0) {
      return {
        outcome: "FAILURE",
        errorCode: "NO_ASSETS",
        reason: "No available assets",
      };
    }
    await Promise.all(
      listTradableAssetsResult.map(async (asset) => {
        const latestPriceResult = await brokerService.getLatestPrice(asset.tickerSymbol);
        updatedPrices.set(asset.tickerSymbol, latestPriceResult.sharePrice);
      })
    );
  };

  const claimFreeShare = async (user: string): Promise<ClaimFreeShareSuccess | OutcomeFailure> => {
    const getByNameResult = await claimRepository.getByName(user);

    if (getByNameResult.outcome === "SUCCESS") {
      return {
        outcome: "FAILURE",
        errorCode: "CLAIMED_ALREADY",
        reason: "The user already claimed the free prize",
      };
    }

    const marketOpenResult = await brokerService.isMarketOpen();

    if (!marketOpenResult.open) {
      return {
        outcome: "FAILURE",
        errorCode: "MARKET_CLOSE",
        reason: "Market will reopen at " + marketOpenResult.nextOpeningTime,
      };
    }

    const selectedValue = getSelectedValue();

    // can be cashed but the stock are fluctuating purposely
    await collectSharePrice();

    let quantity = -1;
    let sharePricePaid = -1;
    let tickerSymbol = "";
    for (let [name, price] of updatedPrices.entries()) {
      if (selectedValue / price >= 1) {
        quantity = Math.floor(selectedValue / price);
        const buySharesResult = await brokerService.buySharesInRewardsAccount(name, quantity);
        if (!buySharesResult.success) {
          return {
            outcome: "FAILURE",
            errorCode: "FAILS_BUY_PRICE",
            reason: "Not enough found",
          };
        }
        sharePricePaid = buySharesResult.sharePricePaid;
        tickerSymbol = name;
        break;
      }
    }

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

    const saveResult = await claimRepository.save({ name: user, stocks: [{ quantity, tickerSymbol }] });
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
    claimFreeShare,
  };
}
