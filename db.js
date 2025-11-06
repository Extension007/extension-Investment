const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");

const db = new sqlite3.Database("./data/exto.db");

db.serialize(() => {
  // Таблица товаров
  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    description TEXT,
    price REAL,
    link TEXT,
    image_path TEXT
  )`);

  // Таблица пользователей
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password_hash TEXT
  )`);

  // Создать администратора по умолчанию
  const adminPass = bcrypt.hashSync("admin123", 10);
  db.run("INSERT OR IGNORE INTO users (username, password_hash) VALUES (?, ?)", ["admin", adminPass]);
});

module.exports = db;
