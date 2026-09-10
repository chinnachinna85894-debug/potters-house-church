const mongoose = require("mongoose");

const welcomeSchema = new mongoose.Schema(
  {
    badge: {
      type: String,
      default: "A Message From Leadership",
    },

    title: {
      type: String,
      default: "Welcome To Church",
    },

    paragraph1: {
      type: String,
      default:
        "Thank you for visiting us online. My wife and I are dedicated to serving this community and reaching families with hope.",
    },

    paragraph2: {
      type: String,
      default:
        "Whether you are seeking a spiritual home or just passing through, we invite you to join us at any of our weekly services.",
    },

    leaderName: {
      type: String,
      default: "Leadership Team",
    },

    newHereText: {
      type: String,
      default: "New Here?",
    },

    newHereLink: {
      type: String,
      default: "#",
    },

    contactText: {
      type: String,
      default: "Contact Us",
    },

    contactLink: {
      type: String,
      default: "#",
    },

    image: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "Welcome",
  welcomeSchema
);