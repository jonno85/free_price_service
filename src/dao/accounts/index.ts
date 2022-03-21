import { CustomLogger } from "ajv";
import { Knex } from "knex";
import { OutcomeFailure, OutcomeSuccess } from "../../common/outcome/outcome";

export interface AccountDBRecord {
  id: string;
  name: string;
  cash: number;
  stocks: any;
}

export type StockBought = {
  tickerSymbol: string;
  quantity: number;
  sharePrice: number;
};

export type Account = {
  id: string;
  name: string;
  cash: number;
  stocks: StockBought[];
};
export interface GetAllSuccess extends OutcomeSuccess {
  data: {
    accounts: Account[];
  };
}

export interface GetByIdSucces extends OutcomeSuccess {
  data: {
    account: Account;
  };
}

export type GetAllResult = GetAllSuccess | OutcomeFailure;
export type GetByIdResult = GetByIdSucces | OutcomeFailure;
export type SaveAccountResult = SaveAccountSuccess | OutcomeFailure;

export interface SaveAccountSuccess extends OutcomeSuccess {
  data: {
    id: string;
  };
}

export interface AccountRepository {
  save(account: Account): Promise<SaveAccountResult>;
  update(account: Account): Promise<SaveAccountResult>;
  getAll(): Promise<GetAllResult>;
  getByName(name: string): Promise<GetByIdResult>;
}

export function buildAccountRepository(dependencies: { db: Knex; logger: CustomLogger }): AccountRepository {
  const { db, logger } = dependencies;

  return {
    update: async (account: Account) => {
      const dbTransaction = await db.transaction();
      const { id, name, cash, stocks } = account;
      try {
        await dbTransaction<AccountDBRecord>("accounts")
          .update({
            id,
            name,
            cash,
            stocks: JSON.stringify(stocks),
          })
          .where({ id });

        await dbTransaction.commit();

        return {
          outcome: "SUCCESS",
          data: {
            id,
          },
        };
      } catch (err: any) {
        await dbTransaction.rollback();
        logger.error("Cannot save into db", err);
        return {
          outcome: "FAILURE",
          errorCode: "DATABASE_ERROR",
          reason: "Cannot save into the db",
        };
      }
    },
    save: async (account: Account) => {
      const dbTransaction = await db.transaction();
      const { id, name, cash, stocks } = account;
      try {
        await dbTransaction<AccountDBRecord>("accounts").insert({
          id,
          name,
          cash,
          stocks: JSON.stringify(stocks),
        });

        await dbTransaction.commit();

        return {
          outcome: "SUCCESS",
          data: {
            id,
          },
        };
      } catch (err: any) {
        await dbTransaction.rollback();
        logger.error("Cannot save into db", err);
        return {
          outcome: "FAILURE",
          errorCode: "DATABASE_ERROR",
          reason: "Cannot save into the db",
        };
      }
    },
    getAll: async () => {
      try {
        const dbResult = await db.select("*").from<AccountDBRecord>("accounts");

        return {
          outcome: "SUCCESS",
          data: {
            accounts: dbResult,
          },
        };
      } catch (err: any) {
        logger.error("Cannot get db values", err);
        return {
          outcome: "FAILURE",
          errorCode: "DATABASE_ERROR",
          reason: "Cannot get values",
        };
      }
    },

    getByName: async (name: string) => {
      try {
        const dbResult = await db.select("*").from<AccountDBRecord>("accounts").where({ name });

        if (dbResult.length === 0) {
          return {
            outcome: "FAILURE",
            errorCode: "ACCOUNT_NOT_FOUND",
            reason: "There is no account that matches this name",
            context: {
              name,
            },
          };
        }

        return {
          outcome: "SUCCESS",
          data: {
            account: dbResult[0],
          },
        };
      } catch (err: any) {
        logger.error("Cannot get db values", err);
        return {
          outcome: "FAILURE",
          errorCode: "DATABASE_ERROR",
          reason: "Cannot get values",
        };
      }
    },
  };
}
