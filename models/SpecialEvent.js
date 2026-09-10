const mongoose = require("mongoose");

const specialEventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },

    date: {
      type: String,
      default: "",
    },

    time: {
      type: String,
      default: "",
    },

    image: {
      type: String,
      default: "",
    },

    link: {
      type: String,
      default: "#",
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
  "SpecialEvent",
  specialEventSchema
);