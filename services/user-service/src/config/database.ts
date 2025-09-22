import { Sequelize } from "sequelize";
import { config } from "./env";

const sequelize = new Sequelize({
  dialect: "postgres",
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  username: config.database.username,
  password: config.database.password,
  logging: config.database.logging,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

export default sequelize;
