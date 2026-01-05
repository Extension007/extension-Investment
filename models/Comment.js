const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema({
  cardId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'cardType' // Динамическая ссылка на Product или Service
  },
  cardType: {
    type: String,
    required: true,
    enum: ['Product', 'Service'] // Тип карточки
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  text: {
    type: String,
    required: true,
    maxlength: 1000,
    trim: true
  },
  deleted: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Индексы для оптимизации
commentSchema.index({ cardId: 1, cardType: 1 });
commentSchema.index({ userId: 1 });
commentSchema.index({ createdAt: -1 });
commentSchema.index({ deleted: 1 });

// Статические методы
commentSchema.statics.getCommentsByCard = function(cardId, cardType, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  return this.find({
    cardId,
    cardType,
    deleted: { $ne: true }
  })
  .populate('userId', 'username')
  .sort({ createdAt: -1 })
  .skip(skip)
  .limit(limit)
  .lean();
};

commentSchema.statics.getCommentCount = function(cardId, cardType) {
  return this.countDocuments({
    cardId,
    cardType,
    deleted: { $ne: true }
  });
};

module.exports = mongoose.model("Comment", commentSchema);
