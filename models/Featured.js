const mongoose = require("mongoose");

const FeaturedSchema = new mongoose.Schema(
  {
    badge: {
      type: String,
      required: true,
      trim: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    subtitle: {
      type: String,
      required: true,
      trim: true,
    },

    backgroundImage: {
      type: String,
      required: true,
      trim: true,
    },

    watchLink: {
      type: String,
      required: true,
      trim: true,
    },

    sermonsLink: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.models.Featured ||
  mongoose.model("Featured", FeaturedSchema);