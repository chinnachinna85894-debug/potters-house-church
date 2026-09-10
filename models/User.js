const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },

        password: {
            type: String,
            required: true
        },

        role: {
            type: String,
            enum: ["user", "admin"],
            default: "user"
        },

        emailVerified: {
            type: Boolean,
            default: false
        },

        otp: {
            type: String,
            default: null
        },

        otpExpires: {
            type: Date,
            default: null
        },

        resetOtp: {
            type: String,
            default: null
        },

        resetOtpExpires: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("User", userSchema);