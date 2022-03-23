import config from "config";
import { Knex } from "knex";
import { resolve } from "path";

const connection: Knex.PgConnectionConfig = {
  // host: config.get("postgres.host"),
  database: config.get("postgres.database"),
  user: config.get("postgres.user"),
  password: config.get("postgres.password"),
  port: config.get("postgres.port"),
};

const knexConfig: Knex.Config = {
  client: "postgresql",
  connection,
  pool: {
    min: 2,
    max: 10,
  },
  migrations: {
    extension: "ts",
    tableName: "knex_migrations",
    schemaName: "public",
    loadExtensions: config.get("knex.migrationExtension"),
    directory: [resolve(__dirname, "./src/database/migrations")],
  },
};

export default knexConfig;
