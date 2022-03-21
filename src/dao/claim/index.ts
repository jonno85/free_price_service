import { CustomLogger } from "ajv";
import { Knex } from "knex";
import { OutcomeFailure, OutcomeSuccess } from "../../common/outcome/outcome";

export interface ClaimDBRecord {
  name: string;
  stocks: any;
}

export type StockBought = {
  tickerSymbol: string;
  quantity: number;
};

export type Claim = {
  name: string;
  stocks: StockBought[];
};
export interface GetAllSuccess extends OutcomeSuccess {
  data: {
    claims: Claim[];
  };
}

export interface GetByIdSucces extends OutcomeSuccess {
  data: {
    account: Claim;
  };
}

export type GetAllResult = GetAllSuccess | OutcomeFailure;
export type GetByIdResult = GetByIdSucces | OutcomeFailure;
export type SaveClaimResult = SaveAccountSuccess | OutcomeFailure;

export interface SaveAccountSuccess extends OutcomeSuccess {
  data: {
    name: string;
  };
}

export interface ClaimRepository {
  save(claim: Claim): Promise<SaveClaimResult>;
  getAll(): Promise<GetAllResult>;
  getByName(name: string): Promise<GetByIdResult>;
}

export function buildClaimRepository(dependencies: { db: Knex; logger: CustomLogger }): ClaimRepository {
  const { db, logger } = dependencies;

  return {
    save: async (claim: Claim) => {
      const dbTransaction = await db.transaction();
      const { name, stocks } = claim;
      try {
        await dbTransaction<ClaimDBRecord>("claims").insert({
          name,
          stocks: JSON.stringify(stocks),
        });

        await dbTransaction.commit();

        return {
          outcome: "SUCCESS",
          data: {
            name,
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
        const dbResult = await db.select("*").from<ClaimDBRecord>("claims");

        return {
          outcome: "SUCCESS",
          data: {
            claims: dbResult,
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
        const dbResult = await db.select("*").from<ClaimDBRecord>("claims").where({ name });

        if(dbResult.length === 0) {
          return {
            outcome: "FAILURE",
            errorCode: "CLAIM_NOT_FOUND",
            reason: "There is no claim that matches this name",
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
