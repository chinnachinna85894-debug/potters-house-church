const mongoose = require("mongoose");

const homeSchema = new mongoose.Schema(
  {
    badge: {
      type: String,
      default: "Welcome Home",
    },

    title: {
      type: String,
      default: "The Potter's House",
    },

    subtitle: {
      type: String,
      default: "Church Bengaluru",
    },

    location: {
      type: String,
      default: "Bengaluru, Karnataka, India",
    },

    mapLink: {
      type: String,
      default: "https://maps.google.com",
    },

    logo: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Home", homeSchema);