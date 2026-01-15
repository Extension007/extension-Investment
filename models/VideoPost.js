const mongoose = require('mongoose');

const VoterSchema = new mongoose.Schema(
  {
    key: { type: String, required: true }, // u:<userId> or g:<guestId>
    vote: { type: String, enum: ['up', 'down'], required: true },
    votedAt: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

const VideoPostSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    nickname: { type: String, default: '' },

    videoUrl: { type: String, required: true },
    platform: { type: String, default: '' },
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    genres: { type: [String], default: [], index: true },

    status: { type: String, enum: ['pending', 'approved', 'rejected', 'blocked'], default: 'pending', index: true },
    adminComment: { type: String, default: '' },
    rejectionReason: { type: String, default: '' },

    rating_up: { type: Number, default: 0 },
    rating_down: { type: Number, default: 0 },
    voters: { type: [VoterSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('VideoPost', VideoPostSchema);
