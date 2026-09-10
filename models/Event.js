const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: true,
      default: "Morning",
    },

    day: {
      type: String,
      required: true,
      default: "Sunday",
    },

    service: {
      type: String,
      required: true,
      default: "Worship Service",
    },

    time: {
      type: String,
      required: true,
      default: "10:30 AM",
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

module.exports = mongoose.model("Event", eventSchema);