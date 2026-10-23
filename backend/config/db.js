const path = require("path");
const mysql = require("mysql2/promise");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

let isDbConnected = false;

// Create connection pool configuration
const poolConfig = {
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

// Enable SSL automatically for cloud-hosted databases (e.g. TiDB Cloud, Aiven, PlanetScale)
if (
  process.env.DB_SSL === "true" ||
  (process.env.DB_HOST &&
    !process.env.DB_HOST.includes("localhost") &&
    !process.env.DB_HOST.includes("127.0.0.1"))
) {
  poolConfig.ssl = { minVersion: "TLSv1.2", rejectUnauthorized: true };
}

const pool = mysql.createPool(poolConfig);

// Test connection on startup
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log(`[Database] Successfully connected to MySQL database: ${process.env.DB_NAME || "animal_monitoring"}`);
    connection.release();
    isDbConnected = true;
    return true;
  } catch (error) {
    isDbConnected = false;
    console.warn(`[Database Warning] Could not connect to MySQL: ${error.message}`);
    console.warn(`[Database Warning] Operating with in-memory store fallback until MySQL is configured.`);
    return false;
  }
}

function getIsDbConnected() {
  return isDbConnected;
}

module.exports = {
  pool,
  testConnection,
  getIsDbConnected
};
