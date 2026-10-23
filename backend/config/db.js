const path = require("path");
const mysql = require("mysql2/promise");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

let isDbConnected = false;

// TiDB Cloud Production Configuration (Permanent cloud-hosted MySQL database)
const TIDB_CLOUD_CONFIG = {
  host: "gateway01.ap-northeast-1.prod.aws.tidbcloud.com",
  port: 4000,
  user: "2M9f6Xj1nbaebUM.root",
  password: "eacpmyTXg7bD9irW",
  database: "injured_animal_detection",
  ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
};

// Check if explicitly on Render or cloud
const isCloudEnv = Boolean(process.env.RENDER || (process.env.NODE_ENV === "production" && (!process.env.DB_HOST || process.env.DB_HOST === "localhost")));

function getInitialConfig() {
  if (isCloudEnv || !process.env.DB_HOST) {
    return TIDB_CLOUD_CONFIG;
  }

  const cfg = {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "injured_animal_detection",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
  };

  if (
    process.env.DB_SSL === "true" ||
    (process.env.DB_HOST &&
      !process.env.DB_HOST.includes("localhost") &&
      !process.env.DB_HOST.includes("127.0.0.1"))
  ) {
    cfg.ssl = { minVersion: "TLSv1.2", rejectUnauthorized: true };
  }

  return cfg;
}

let pool = mysql.createPool(getInitialConfig());

// Test connection on startup with automatic TiDB Cloud fallback
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log(`[Database] Successfully connected to database: ${process.env.DB_NAME || "injured_animal_detection"}`);
    connection.release();
    isDbConnected = true;
    return true;
  } catch (primaryError) {
    console.warn(`[Database] Primary connection failed (${primaryError.message}). Attempting TiDB Cloud connection...`);
    try {
      pool = mysql.createPool(TIDB_CLOUD_CONFIG);
      const cloudConnection = await pool.getConnection();
      console.log(`[Database] Successfully connected to TiDB Cloud database: injured_animal_detection`);
      cloudConnection.release();
      isDbConnected = true;
      return true;
    } catch (cloudError) {
      isDbConnected = false;
      console.error(`[Database Error] Failed to connect to TiDB Cloud: ${cloudError.message}`);
      console.warn(`[Database Warning] Operating with in-memory store fallback until database is reachable.`);
      return false;
    }
  }
}

function getIsDbConnected() {
  return isDbConnected;
}

// Proxy export for pool so callers always use the active connected pool
const poolProxy = new Proxy({}, {
  get: (target, prop) => {
    return pool[prop];
  }
});

module.exports = {
  pool: poolProxy,
  testConnection,
  getIsDbConnected
};

