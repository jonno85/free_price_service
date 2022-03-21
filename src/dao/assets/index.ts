import { CustomLogger } from "ajv";
import { Knex } from "knex";
import { OutcomeFailure, OutcomeSuccess } from "../../common/outcome/outcome";

export interface AssetDBRecord {
  id: string;
  name: string;
  price: number;
}

export type Asset = {
  id: string;
  name: string;
  price: number;
};
export interface GetAllSuccess extends OutcomeSuccess {
  data: {
    assets: Asset[];
  };
}

export interface GetByIdSucces extends OutcomeSuccess {
  data: {
    asset: Asset;
  };
}

export type GetAllResult = GetAllSuccess | OutcomeFailure;
export type GetByIdResult = GetByIdSucces | OutcomeFailure;
export type SaveAssetResult = SaveAssetSuccess | OutcomeFailure;

export interface SaveAssetSuccess extends OutcomeSuccess {
  data: {
    id: string;
  };
}

export interface AssetRepository {
  save(asset: Asset): Promise<SaveAssetResult>;
  getAll(): Promise<GetAllResult>;
  getByName(name: string): Promise<GetByIdResult>;
}

export function buildAssetRepository(dependencies: { db: Knex; logger: CustomLogger }): AssetRepository {
  const { db, logger } = dependencies;

  // To emulate asset market fluctuation
  const updateAssetsPrices = async () => {
    const dbAssetsResult = await db.select("*").from<AssetDBRecord>("assets");

    const trx = await db.transaction();
    try {
      for (let i = 0; i < dbAssetsResult.length; i++) {
        let asset = dbAssetsResult[i];
        asset.price = await trx<AssetDBRecord>("assets")
          .update({
            price: Number(asset.price + (Math.round(Math.random()) * 2 - 1) * Math.random()),
          })
          .where({ id: asset.id });
      }
      trx.commit();

      // This code does not work :(
      //   await Promise.all(
      //     dbAssetsResult.map((asset) => {
      //       asset.price = 1; //Number(asset.price + (Math.round(Math.random()) * 2 - 1) * Math.random());
      //       db("assets").where({ id: asset.id }).update({ price: asset.price }).transacting(trx);
      //     })
      //   );
      //   await trx.commit();
    } catch (error) {
      await trx.rollback();
    }
  };

  return {
    save: async (asset: Asset) => {
      const dbTransaction = await db.transaction();
      const { id, name, price = 10.0 } = asset;
      try {
        await dbTransaction<AssetDBRecord>("assets").insert({
          id,
          name,
          price,
        });

        await dbTransaction.commit();

        setTimeout(updateAssetsPrices, 100);
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
        const dbResult = await db.select("*").from<AssetDBRecord>("assets");
        setTimeout(updateAssetsPrices, 100);
        return {
          outcome: "SUCCESS",
          data: {
            assets: dbResult,
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
        const dbResult = await db.select("*").from<AssetDBRecord>("assets").where({ name });
        setTimeout(updateAssetsPrices, 100);
        return {
          outcome: "SUCCESS",
          data: {
            asset: dbResult[0],
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
