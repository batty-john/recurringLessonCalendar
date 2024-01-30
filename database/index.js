// database/index.js
const mysql = require('mysql2/promise');
require('dotenv').config();

const poolConfig = {
    connectionLimit : 10, // You can set the limit based on your application's needs
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
};

const pool = mysql.createPool(poolConfig);

module.exports = pool;


/*
// database/index.js
const mysql = require('mysql');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
};

const connection = mysql.createConnection(dbConfig);

module.exports = connection;
*/
