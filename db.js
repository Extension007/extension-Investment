require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

// Подключение к MongoDB Atlas
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", async () => {
  console.log("MongoDB connected");

  // Проверка и создание администратора
  const User = require("./models/User");

  const adminExists = await User.findOne({ username: "admin" });
  if (!adminExists) {
    const adminPass = bcrypt.hashSync("admin123", 10);
    await User.create({ username: "admin", password_hash: adminPass });
    console.log("Admin user created");
  }
});

module.exports = mongoose;
