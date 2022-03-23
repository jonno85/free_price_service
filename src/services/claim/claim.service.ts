import { CustomLogger } from "ajv";
import { Knex } from "knex";
import { ClaimFreeShareSuccess, ClaimService } from "./interface";
import config from "config";
import { BrokerService } from "../broker/interface";
import { OutcomeFailure } from "../../common/outcome/outcome";
import { Claim, ClaimRepository } from "../../dao/claim";
import { ShareRepository } from "../../dao/shares";

export interface ClaimServiceConfiguration {
  db: Knex;
  logger: CustomLogger;
  brokerService: BrokerService;
  claimRepository: ClaimRepository;
  shareRepository: ShareRepository;
}

export type ClaimEntry = {
  p0: number;
  p1: number;
  min: number;
  max: number;
};
const claimsConfiguration = config.get("claims") as Array<ClaimEntry>;
const cpa = config.get("cpa.value") as number;
const user_threshold = config.get("cpa.user_threshold") as number;

export function getSelectedValue(currentTotalStock: number, currentTotalUser: number, currentTotalShareAmount: number) {
  if (currentTotalUser > user_threshold && currentTotalShareAmount / currentTotalStock === cpa) {
    // Logic for bonus point #1
  }

  const randomClaimAmountProb = Math.random();

  const selectedRange = claimsConfiguration.filter(
    (entry) => randomClaimAmountProb >= entry.p0 && entry.p1 > randomClaimAmountProb
  )?.[0] ?? { min: 3, max: 10 };
  return Math.floor(Math.random() * (selectedRange.max - selectedRange.min) + selectedRange.min);
}

export function buildClaimService(dependencies: ClaimServiceConfiguration): ClaimService {
  const { brokerService, logger, claimRepository, shareRepository } = dependencies;

  const updatedPrices = new Map<string, number>();
  // default uninitiated values
  let currentTotalAmount = -1;
  let currentTotalStock = -1;
  let currentTotalUser = -1;
  let currentTotalShareAmount = 0;

  const fetchEmittedClaimsData = () => {
    let currentTotalAmount = 0;
    let currentTotalStock = 0;
    let currentTotalUser = 0;
    return new Promise((resolve) => {
      resolve(
        claimRepository.getAll().then((getAllResult) => {
          if (getAllResult.outcome === "FAILURE") {
            return {
              currentTotalAmount,
              currentTotalStock,
              currentTotalUser,
            };
          }
          getAllResult.data.claims.forEach((claim: Claim) => {
            currentTotalAmount += claim.amount;
            currentTotalStock += claim.stocks.reduce((prev, currentValue) => prev + currentValue.quantity, 0);
            currentTotalUser += 1;
          });
          return {
            currentTotalAmount,
            currentTotalStock,
            currentTotalUser,
          };
        })
      );
    });
  };
  const fetchEmittedClaimsDataResult = fetchEmittedClaimsData();

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

    if (currentTotalAmount === -1 || currentTotalStock === -1) {
      const prefetchedData = (await fetchEmittedClaimsDataResult) as any;
      currentTotalAmount = prefetchedData.currentTotalAmount;
      currentTotalStock = prefetchedData.currentTotalStock;
      currentTotalUser = prefetchedData.currentTotalUser;
    }

    // Bonus task #1
    const totalAmountResult = await shareRepository.getTotalShareAmount();
    if (totalAmountResult.outcome === "SUCCESS") {
      currentTotalShareAmount = totalAmountResult.data.amount;
    }

    const selectedValue = getSelectedValue(currentTotalStock, currentTotalUser, currentTotalShareAmount);

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

    const amount = sharePricePaid * quantity;
    const saveResult = await claimRepository.save({
      name: user,
      stocks: [{ quantity, tickerSymbol }],
      amount,
    });
    if (saveResult.outcome === "FAILURE") {
      return {
        outcome: "FAILURE",
        errorCode: "FAILS_TO_SAVE_CLAIM",
        reason: "Cannot save claim",
      };
    }

    currentTotalStock += quantity;
    currentTotalAmount += amount;
    currentTotalUser += 1;
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
