const mongoose = require("mongoose");

const contactInfoSchema = new mongoose.Schema({
  type: { 
    type: String, 
    enum: ["admin", "founder", "service"], 
    required: true 
  },
  email: { 
    type: String, 
    required: true 
  },
  phone: { 
    type: String 
  },
  description: { 
    type: String 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
}, { timestamps: true });

// Индекс для поля type для улучшения производительности поиска
contactInfoSchema.index({ type: 1 });

module.exports = mongoose.model("ContactInfo", contactInfoSchema);
