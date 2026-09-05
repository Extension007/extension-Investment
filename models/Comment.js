const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Comment = sequelize.define('Comment', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  cardId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  cardType: {
    type: DataTypes.STRING(20),
    allowNull: false,
    validate: {
      isIn: [['Product', 'Service', 'Banner']]
    }
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  text: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      len: [1, 1000]
    }
  },
  deleted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  indexes: [
    { fields: ['card_id', 'card_type'] },
    { fields: ['user_id'] },
    { fields: ['created_at'] },
    { fields: ['deleted'] }
  ],
  tableName: 'comments'
});

// Static method to get comments by card with pagination
Comment.getCommentsByCard = async function(cardId, _cardType, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const { serializeComment } = require('../utils/commentSerialize');
  // Filter by cardId only so comments still show if cardType was stored as Product vs Service.
  const rows = await this.findAll({
    where: {
      cardId,
      deleted: false
    },
    include: [{
      model: require('../models/User'),
      as: 'user',
      attributes: ['id', 'username']
    }],
    order: [['createdAt', 'ASC']],
    offset: skip,
    limit: limit
  });
  return rows.map((row) => serializeComment(row)).filter(Boolean);
};

Comment.getCommentCount = async function(cardId) {
  return this.count({
    where: {
      cardId,
      deleted: false
    }
  });
};

module.exports = Comment;
