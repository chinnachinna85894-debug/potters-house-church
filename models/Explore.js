const mongoose = require("mongoose");

const ExploreSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },

    description: {
      type: String,
      default: "",
      trim: true
    },

    buttonText: {
      type: String,
      default: "Learn More",
      trim: true
    },

    buttonLink: {
      type: String,
      default: "#",
      trim: true
    },

    image: {
      type: String,
      default: ""
    },

    order: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

/*
  IMPORTANT:
  Do not register the same Mongoose model twice.
*/
module.exports =
  mongoose.models.Explore ||
  mongoose.model("Explore", ExploreSchema);