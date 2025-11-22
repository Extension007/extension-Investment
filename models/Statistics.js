const mongoose = require("mongoose");

const statisticsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model("Statistics", statisticsSchema);

