const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action: { 
    type: String, 
    required: true,
    index: true
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    index: true
  },
  targetUserId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    index: true
  },
  adminId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    index: true
  },
  amount: { 
    type: Number,
    index: true
  },
  reason: { 
    type: String 
  },
  details: { 
    type: mongoose.Schema.Types.Mixed 
  },
  ipAddress: { 
    type: String 
  },
  userAgent: { 
    type: String 
  }
}, { 
  timestamps: true 
});

// Compound indexes for common queries
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ userId: 1, action: 1, createdAt: -1 });
auditLogSchema.index({ adminId: 1, action: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);