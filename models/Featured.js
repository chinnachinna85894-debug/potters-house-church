const mongoose = require("mongoose");

const FeaturedSchema =
    new mongoose.Schema(
        {
            badge: {
                type: String,
                default: "FEATURED MESSAGE",
                trim: true
            },

            title: {
                type: String,
                default: "Time Is Running Out",
                trim: true
            },

            subtitle: {
                type: String,
                default: "Bible Conference 2026",
                trim: true
            },

            backgroundImage: {
                type: String,
                default: "",
                trim: true
            },

            watchLink: {
                type: String,
                default: "#",
                trim: true
            },

            sermonsLink: {
                type: String,
                default: "#",
                trim: true
            }
        },
        {
            timestamps: true
        }
    );

module.exports =
    mongoose.models.Featured ||
    mongoose.model(
        "Featured",
        FeaturedSchema
    );