import { CustomLogger } from "ajv";
import { Knex } from "knex";
import { Account, AccountRepository } from "../../dao/accounts";
import { AssetRepository } from "../../dao/assets";
import { BrokerService } from "./interface";
import config from "config";

export interface BrokerServiceConfiguration {
  db: Knex;
  logger: CustomLogger;
  assetRepository: AssetRepository;
  accountRepository: AccountRepository;
}

const RewardAccountName = config.get("account.reward") as string;

export function buildBrokerService(dependencies: BrokerServiceConfiguration): BrokerService {
  const listTradableAssets = async (): Promise<Array<{ tickerSymbol: string }>> => {
    const { assetRepository, logger } = dependencies;
    const result = await assetRepository.getAll();

    if (result.outcome === "SUCCESS") {
      return result.data.assets.map((asset) => ({
        tickerSymbol: asset.name,
      }));
    }

    logger.error("cannot get assets", result.errorCode);
    return [];
  };

  // To fetch the latest price for an asset
  const getLatestPrice = async (tickerSymbol: string): Promise<{ sharePrice: number }> => {
    const { assetRepository, logger } = dependencies;
    const result = await assetRepository.getByName(tickerSymbol);
    if (result.outcome === "FAILURE") {
      return {
        sharePrice: -1,
      };
    }
    return {
      sharePrice: result.data.asset.price,
    };
  };

  // To check if the stock market is currently open or closed
  const isMarketOpen = async (): Promise<{ open: boolean; nextOpeningTime: string; nextClosingTime: string }> => {
    const now = new Date();
    const nextOpeningTime = new Date(now.setHours(now.getHours() + 1)).toISOString();
    const nextClosingTime = new Date(now.setHours(now.getHours() + 2)).toISOString();

    if (now.getMinutes() % 2 === 0) {
      return {
        open: true,
        nextOpeningTime,
        nextClosingTime,
      };
    }
    return {
      open: false,
      nextOpeningTime,
      nextClosingTime,
    };
  };

  // To purchase a share in our Firm's rewards account.
  // NOTE: this works only while the stock market is open otherwise throws an error.
  // NOTE 2: quantity is an integer, no fractional shares allowed.
  const buySharesInRewardsAccount = async (
    tickerSymbol: string,
    quantity: number
  ): Promise<{ success: boolean; sharePricePaid: number }> => {
    const { accountRepository, logger, assetRepository } = dependencies;
    if (!(await isMarketOpen()).open) {
      return {
        success: false,
        sharePricePaid: -1,
      };
    }
    const accountResult = await accountRepository.getByName(RewardAccountName);
    if (accountResult.outcome === "FAILURE") {
      logger.error("Reward account does not exist");
      return {
        success: false,
        sharePricePaid: -1,
      };
    }
    const { account } = accountResult.data;
    const assetsPriceResult = await assetRepository.getByName(tickerSymbol);
    if (assetsPriceResult.outcome === "FAILURE") {
      logger.error("Impossible to get share price");
      return {
        success: false,
        sharePricePaid: -1,
      };
    }
    const { price } = assetsPriceResult.data.asset;
    const amountToBeDeducted = price * quantity;
    account.stocks.push({
      tickerSymbol,
      quantity,
      sharePrice: price,
    });
    account.cash -= amountToBeDeducted;
    const updateResult = await accountRepository.update(account);
    if (updateResult.outcome === "FAILURE") {
      logger.error("Impossible to update the Reward account");
      return {
        success: false,
        sharePricePaid: -1,
      };
    }
    return {
      success: true,
      sharePricePaid: amountToBeDeducted,
    };
  };

  // To view the shares that are available in the Firm's rewards account
  const getRewardsAccountPositions = async (): Promise<
    Array<{ tickerSymbol: string; quantity: number; sharePrice: number }>
  > => {
    const { accountRepository } = dependencies;
    const rewardAccountResult = await accountRepository.getByName(RewardAccountName);

    if (rewardAccountResult.outcome === "FAILURE") {
      return [];
    }

    return [...rewardAccountResult.data.account.stocks];
  };

  // To move shares from our Firm's rewards account to a user's own account
  const moveSharesFromRewardsAccount = async (
    toAccount: string,
    tickerSymbol: string,
    quantity: number
  ): Promise<{ success: boolean }> => {
    const { accountRepository, logger } = dependencies;

    const rewardAccountResult = await accountRepository.getByName(RewardAccountName);

    if (rewardAccountResult.outcome === "FAILURE") {
      logger.error("Reward account not found");
      return { success: false };
    }

    let userAccount: Account;
    const userAccountResult = await accountRepository.getByName(toAccount);

    if (userAccountResult.outcome === "FAILURE") {
      logger.warn("User account not found: going to create it");
      // return { success: false };
      const accountSaveResult = await accountRepository.save({
        id: toAccount,
        name: toAccount,
        cash: 0,
        stocks: [],
      });
      if (accountSaveResult.outcome === "FAILURE") {
        logger.warn("User account failed to create account");
        return { success: false };
      }
      userAccount = accountSaveResult.data.account;
    } else {
      userAccount = userAccountResult.data.account;
    }
    const { stocks } = rewardAccountResult.data.account;
    const stockToMoveIndex = stocks.findIndex(
      (stock) => stock.quantity === quantity && stock.tickerSymbol === tickerSymbol
    );

    // might be possible to have multiple exact order? (from different user)
    // in this case it simply moves the first object
    if (stockToMoveIndex === -1) {
      logger.error("Stock not found");
      return { success: false };
    }
    const stockToMove = stocks.splice(stockToMoveIndex);

    userAccount.stocks.push(stockToMove[0]);
    const userAccountUpdateResult = await accountRepository.update(userAccount);
    if (userAccountUpdateResult.outcome === "FAILURE") {
      logger.error("Stock cannot move to user account");
      return { success: false };
    }

    const { account: rewardAccount } = rewardAccountResult.data;
    rewardAccount.stocks = stocks;
    const rewardAccountUpdateResult = await accountRepository.update(rewardAccount);
    if (rewardAccountUpdateResult.outcome === "FAILURE") {
      logger.error("Stock cannot move from reward account");
      return { success: false };
    }

    return { success: true };
  };

  return {
    listTradableAssets,
    getLatestPrice,
    isMarketOpen,
    buySharesInRewardsAccount,
    getRewardsAccountPositions,
    moveSharesFromRewardsAccount,
  };
}
