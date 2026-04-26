const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    content: {
      type: String,
      default: '',
    },
    title: {
      type: String,
      default: 'Untitled Document',
    },
    wordCount: {
      type: Number,
      default: 0,
    },
    charCount: {
      type: Number,
      default: 0,
    },
    lastEditedBy: {
      type: String,
      default: null,
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    aiMetadata: {
      lastSuggestion: String,
      lastUsedAt: Date,
    },
    
    collaborators: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      }
    ],
    versions: [
      {
        content: String,
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true, // adds createdAt, updatedAt
  }
);

// Update word/char counts before saving
documentSchema.pre('save', async function () {
  if (this.isModified('content')) {
    this.charCount = this.content.length;
    this.wordCount = this.content.trim()
      ? this.content.trim().split(/\s+/).length
      : 0;
  }
});
documentSchema.pre('save', function () {
  if (this.collaborators) {
    const mongoose = require('mongoose');

    this.collaborators = this.collaborators.filter(id =>
      mongoose.Types.ObjectId.isValid(id)
    );
  }
});
// Static: load by roomId
documentSchema.statics.findByRoom = function (roomId) {
  return this.findOne({ roomId });
};

// Static: upsert document content
documentSchema.statics.upsertByRoom = async function (roomId, data) {
  const doc = await this.findOne({ roomId });

  if (!doc) {
    return this.create({
      roomId,
      ...data,
    });
  }

  // 🔥 Save previous version BEFORE updating
  if (data.content && data.content !== doc.content) {
    doc.versions.push({
      content: doc.content,
    });

    // Limit versions (avoid DB bloat)
    if (doc.versions.length > 50) {
      doc.versions.shift();
    }
  }

  Object.assign(doc, data, {
    lastActivityAt: new Date(),
  });

  return doc.save();
};

// Static: list all documents (lightweight projection)
documentSchema.statics.listAll = function (projection = {}) {
  return this.find(
    {},
    { roomId: 1, title: 1, wordCount: 1, lastActivityAt: 1, updatedAt: 1, ...projection }
  ).sort({ lastActivityAt: -1 });
};
// Static: find documents accessible by user
documentSchema.statics.findAccessible = function (userId) {
  return this.find({
    $or: [
      { ownerId: userId },
      { collaborators: userId }
    ]
  });
};
documentSchema.methods.hasAccess = function (userId) {
  if (!userId) return false;

  return (
    this.ownerId?.toString() === userId.toString() ||
    this.collaborators.some(c => c.toString() === userId.toString())
  );
};
const Document = mongoose.model('Document', documentSchema);

module.exports = Document;
