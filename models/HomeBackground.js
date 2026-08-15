const mongoose = require("mongoose");

const HomeBackgroundSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: "",
    },

    originalName: {
      type: String,
      default: "",
    },

    filename: {
      type: String,
      required: true,
    },

    url: {
      type: String,
      required: true,
    },

    type: {
      type: String,
      enum: ["image", "video"],
      required: true,
    },

    mimeType: {
      type: String,
      default: "",
    },

    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "HomeBackground",
  HomeBackgroundSchema
);