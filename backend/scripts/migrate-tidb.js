"use strict";

const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");

async function migrate() {
  console.log("Connecting to TiDB Cloud...");
  const conn = await mysql.createConnection({
    host: "gateway01.ap-northeast-1.prod.aws.tidbcloud.com",
    port: 4000,
    user: "2M9f6Xj1nbaebUM.root",
    password: "eacpmyTXg7bD9irW",
    multipleStatements: true,
    ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true }
  });

  console.log("Connected! Creating database `injured_animal_detection`...");
  await conn.query("CREATE DATABASE IF NOT EXISTS `injured_animal_detection`;");
  await conn.query("USE `injured_animal_detection`;");

  const sqlFile = path.join(__dirname, "../database.sql");
  let sql = fs.readFileSync(sqlFile, "utf8");

  // Remove dump-specific directives that can cause issues in TiDB
  sql = sql
    .replace(/LOCK TABLES `?\w+`? WRITE;/gi, "")
    .replace(/UNLOCK TABLES;/gi, "")
    .replace(/\/\*!40000 ALTER TABLE `?\w+`? (DISABLE|ENABLE) KEYS \*\/;/gi, "")
    .replace(/\/\*!80016 DEFAULT ENCRYPTION='N' \*\//gi, "");

  console.log("Executing database.sql against TiDB Cloud...");
  await conn.query(sql);

  console.log("Validating tables created in `injured_animal_detection`...");
  const [tables] = await conn.query("SHOW TABLES;");
  console.log("Tables in database:", tables.map(t => Object.values(t)[0]));

  const [contacts] = await conn.query("SELECT * FROM rescue_contacts;");
  console.log(`Rescue contacts loaded: ${contacts.length}`);

  const [cameras] = await conn.query("SELECT * FROM cameras;");
  console.log(`Cameras loaded: ${cameras.length}`);

  await conn.end();
  console.log("✅ TiDB Cloud Database migration SUCCESSFUL!");
}

migrate().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
