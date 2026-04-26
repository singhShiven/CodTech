const mongoose = require('mongoose');

const versionSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
      default: '',
    },
    versionNumber: {
      type: Number,
      required: true,
    },
    savedBy: {
      type: String,
      default: 'system',
    },
    label: {
      type: String,
      default: null, // optional human-readable label, e.g. "Auto-save #3"
    },
    wordCount: {
      type: Number,
      default: 0,
    },
    charCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);
versionSchema.pre('save', function () {
    if (!this.content || typeof this.content !== 'string') return;
  
    this.charCount = this.content.length;
    this.wordCount = this.content.trim()
      ? this.content.trim().split(/\s+/).length
      : 0;
  });

// Compound unique index: one versionNumber per room
versionSchema.index({ roomId: 1, versionNumber: 1 }, { unique: true });



// Static: get full version history for a room, newest first
versionSchema.statics.getHistory = function (roomId, limit = 50) {
    return this.find({ roomId })
      .sort({ versionNumber: -1 })
      .limit(limit)
      .lean();
  };
// Static: get a single version with content
versionSchema.statics.getVersion = function (roomId, versionNumber) {
  return this.findOne({ roomId, versionNumber });
};

// Static: get the latest version number for a room
versionSchema.statics.getLatestNumber = async function (roomId) {
  const latest = await this.findOne({ roomId })
    .sort({ versionNumber: -1 })
    .select('versionNumber');
  return latest ? latest.versionNumber : 0;
};

// Static: save a new version, enforcing maxVersions cap
versionSchema.statics.saveVersion = async function (
  roomId,
  content,
  savedBy = 'system',
  maxVersions = 50
) {
  const latestNumber = await this.getLatestNumber(roomId);
  const versionNumber = latestNumber + 1;

  const safeContent = content || '';

const version = new this({
  roomId,
  content: safeContent,
  versionNumber,
  savedBy,
  label: `Auto-save #${versionNumber}`,
  charCount: safeContent.length,
  wordCount: safeContent.trim()
    ? safeContent.trim().split(/\s+/).length
    : 0,
});
  
  await version.save();

  // Prune old versions beyond the cap
  const count = await this.countDocuments({ roomId });
  if (count > maxVersions) {
    const excess = count - maxVersions;
    const oldest = await this.find({ roomId })
      .sort({ versionNumber: 1 })
      .limit(excess)
      .select('_id');
    await this.deleteMany({ _id: { $in: oldest.map((v) => v._id) } });
  }

  return version;
};

const Version = mongoose.model('Version', versionSchema);

module.exports = Version;