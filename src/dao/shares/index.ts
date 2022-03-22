import { CustomLogger } from "ajv";
import { Knex } from "knex";
import { OutcomeFailure, OutcomeSuccess } from "../../common/outcome/outcome";

export interface ShareDBRecord {
  account: string;
  order: any;
  amount: number;
  date: Date;
}

export type orderItem = {
  tickerSymbol: string;
  quantity: number;
  sharePricePaid: number;
};

export type Share = {
  account: string;
  order: orderItem[];
  amount: number;
  date: Date;
};
export interface GetAllSuccess extends OutcomeSuccess {
  data: {
    shares: Share[];
  };
}

export interface GetByIdSucces extends OutcomeSuccess {
  data: {
    share: Share;
  };
}

export type GetAllResult = GetAllSuccess | OutcomeFailure;
export type GetByIdResult = GetByIdSucces | OutcomeFailure;
export type SaveShareResult = SaveShareSuccess | OutcomeFailure;

export interface SaveShareSuccess extends OutcomeSuccess {
  data: {
    account: string;
  };
}

export interface ShareRepository {
  save(share: Share): Promise<SaveShareResult>;
  getAll(): Promise<GetAllResult>;
  getByName(name: string): Promise<GetByIdResult>;
}

export function buildShareRepository(dependencies: { db: Knex; logger: CustomLogger }): ShareRepository {
  const { db, logger } = dependencies;

  return {
    save: async (share: Share) => {
      const dbTransaction = await db.transaction();
      const { account, order, amount, date } = share;
      console.log("share is", share);

      try {
        await dbTransaction<ShareDBRecord>("shares").insert({
          account,
          order: JSON.stringify(order),
          amount,
          date,
        });

        await dbTransaction.commit();

        return {
          outcome: "SUCCESS",
          data: {
            account,
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
        const dbResult = await db.select("*").from<ShareDBRecord>("shares");
        console.log("getallllllllllll");

        return {
          outcome: "SUCCESS",
          data: {
            shares: dbResult,
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

    getByName: async (account: string) => {
      try {
        const dbResult = await db.select("*").from<ShareDBRecord>("shares").where({ account });

        if (dbResult.length === 0) {
          return {
            outcome: "FAILURE",
            errorCode: "SHARE_NOT_FOUND",
            reason: "There is no share that matches this account",
            context: {
              account,
            },
          };
        }
        return {
          outcome: "SUCCESS",
          data: {
            share: dbResult[0],
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
