const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

const User = require("../models/User");

const router = express.Router();


// =====================================================
// CONFIGURATION
// =====================================================

const JWT_SECRET =
    process.env.JWT_SECRET || "email_login_secret_2026_change_this";

const OTP_EXPIRY = 10 * 60 * 1000;

const COOKIE_OPTIONS = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 24 * 60 * 60 * 1000
};


// =====================================================
// EMAIL TRANSPORTER
// =====================================================

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});


// =====================================================
// HELPER FUNCTIONS
// =====================================================

function normalizeEmail(email) {
    return email.trim().toLowerCase();
}

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function getOTPExpiry() {
    return new Date(Date.now() + OTP_EXPIRY);
}

function isOTPExpired(expiry) {
    return !expiry || expiry < new Date();
}

function createAuthCookie(res, token) {
    res.cookie("authToken", token, COOKIE_OPTIONS);
}

function clearAuthCookie(res) {
    res.clearCookie("authToken", COOKIE_OPTIONS);
}


// =====================================================
// SEND OTP EMAIL
// =====================================================

async function sendOTP(email, otp, subject) {
    await transporter.sendMail({
        from: `"Email Login" <${process.env.EMAIL_USER}>`,
        to: email,
        subject,

        html: `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Email Verification</title>
</head>

<body style="
    margin:0;
    padding:30px;
    background:#f5f5f5;
    font-family:Arial,sans-serif;
">

<div style="
    max-width:500px;
    margin:auto;
    background:white;
    padding:30px;
    border-radius:12px;
    text-align:center;
">

<h2 style="
    margin-top:0;
    color:#111;
">
    Email Verification
</h2>

<p style="color:#444;">
    Your verification code is:
</p>

<div style="
    font-size:36px;
    font-weight:bold;
    letter-spacing:8px;
    margin:25px 0;
    color:#111;
">
    ${otp}
</div>

<p style="color:#555;">
    This OTP will expire in 10 minutes.
</p>

<p style="
    color:#777;
    font-size:13px;
">
    If you did not request this code,
    you can ignore this email.
</p>

</div>

</body>
</html>
`
    });
}


// =====================================================
// REGISTER
// =====================================================

router.post("/register", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters"
            });
        }

        const normalizedEmail = normalizeEmail(email);

        let user = await User.findOne({
            email: normalizedEmail
        });

        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = generateOTP();
        const otpExpires = getOTPExpiry();

        if (user) {

            if (user.emailVerified) {
                return res.status(400).json({
                    success: false,
                    message: "Email is already registered"
                });
            }

            user.password = hashedPassword;
            user.otp = otp;
            user.otpExpires = otpExpires;

        } else {

            user = new User({
                email: normalizedEmail,
                password: hashedPassword,
                emailVerified: false,
                otp,
                otpExpires
            });
        }

        await user.save();

        await sendOTP(
            normalizedEmail,
            otp,
            "Verify your email"
        );

        res.json({
            success: true,
            message: "Registration successful. OTP sent to your email.",
            email: normalizedEmail
        });

    } catch (error) {

        console.error("Register error:", error);

        res.status(500).json({
            success: false,
            message: "Registration failed"
        });
    }
});


// =====================================================
// VERIFY REGISTRATION OTP
// =====================================================

router.post("/verify-otp", async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: "Email and OTP are required"
            });
        }

        const normalizedEmail = normalizeEmail(email);

        const user = await User.findOne({
            email: normalizedEmail,
            otp
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Invalid OTP"
            });
        }

        if (isOTPExpired(user.otpExpires)) {
            return res.status(400).json({
                success: false,
                message: "OTP has expired"
            });
        }

        user.emailVerified = true;
        user.otp = null;
        user.otpExpires = null;

        await user.save();

        res.json({
            success: true,
            message: "Email verified successfully"
        });

    } catch (error) {

        console.error("Verify OTP error:", error);

        res.status(500).json({
            success: false,
            message: "OTP verification failed"
        });
    }
});


// =====================================================
// RESEND REGISTRATION OTP
// =====================================================

router.post("/resend-otp", async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required"
            });
        }

        const normalizedEmail = normalizeEmail(email);

        const user = await User.findOne({
            email: normalizedEmail
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        if (user.emailVerified) {
            return res.status(400).json({
                success: false,
                message: "Email is already verified"
            });
        }

        const otp = generateOTP();

        user.otp = otp;
        user.otpExpires = getOTPExpiry();

        await user.save();

        await sendOTP(
            normalizedEmail,
            otp,
            "Your new verification OTP"
        );

        res.json({
            success: true,
            message: "New OTP sent successfully"
        });

    } catch (error) {

        console.error("Resend OTP error:", error);

        res.status(500).json({
            success: false,
            message: "Could not resend OTP"
        });
    }
});


// =====================================================
// LOGIN
// =====================================================

router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        const normalizedEmail = normalizeEmail(email);

        const user = await User.findOne({
            email: normalizedEmail
        });

        // Email not registered
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "No account found. Please create an account first."
            });
        }

        // Email not verified
        if (!user.emailVerified) {
            return res.status(403).json({
                success: false,
                message: "Please verify your email first"
            });
        }

        // Check password
        const passwordMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        // Create JWT
        const token = jwt.sign(
            {
                id: user._id.toString(),
                email: user.email,
                role: user.role
            },
            JWT_SECRET,
            {
                expiresIn: "1d"
            }
        );

        createAuthCookie(res, token);

        res.json({
            success: true,
            message: "Login successful",
            user: {
                id: user._id,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {

        console.error("Login error:", error);

        res.status(500).json({
            success: false,
            message: "Login failed"
        });
    }
});


// =====================================================
// FORGOT PASSWORD
// =====================================================

router.post("/forgot-password", async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required"
            });
        }

        const normalizedEmail = normalizeEmail(email);

        const user = await User.findOne({
            email: normalizedEmail
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "No account found with this email"
            });
        }

        if (!user.emailVerified) {
            return res.status(400).json({
                success: false,
                message: "Please verify your email first"
            });
        }

        const otp = generateOTP();

        user.resetOtp = otp;
        user.resetOtpExpires = getOTPExpiry();

        await user.save();

        await sendOTP(
            normalizedEmail,
            otp,
            "Password reset OTP"
        );

        res.json({
            success: true,
            message: "Password reset OTP sent"
        });

    } catch (error) {

        console.error("Forgot password error:", error);

        res.status(500).json({
            success: false,
            message: "Could not send reset OTP"
        });
    }
});


// =====================================================
// VERIFY RESET OTP
// =====================================================

router.post("/verify-reset-otp", async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: "Email and OTP are required"
            });
        }

        const normalizedEmail = normalizeEmail(email);

        const user = await User.findOne({
            email: normalizedEmail,
            resetOtp: otp
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Invalid reset OTP"
            });
        }

        if (isOTPExpired(user.resetOtpExpires)) {
            return res.status(400).json({
                success: false,
                message: "Reset OTP has expired"
            });
        }

        res.json({
            success: true,
            message: "Reset OTP verified"
        });

    } catch (error) {

        console.error("Verify reset OTP error:", error);

        res.status(500).json({
            success: false,
            message: "Could not verify reset OTP"
        });
    }
});


// =====================================================
// RESET PASSWORD
// =====================================================

router.post("/reset-password", async (req, res) => {
    try {
        const {
            email,
            otp,
            newPassword
        } = req.body;

        if (!email || !otp || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters"
            });
        }

        const normalizedEmail = normalizeEmail(email);

        const user = await User.findOne({
            email: normalizedEmail,
            resetOtp: otp
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Invalid reset OTP"
            });
        }

        if (isOTPExpired(user.resetOtpExpires)) {
            return res.status(400).json({
                success: false,
                message: "Reset OTP has expired"
            });
        }

        user.password = await bcrypt.hash(
            newPassword,
            10
        );

        user.resetOtp = null;
        user.resetOtpExpires = null;

        await user.save();

        res.json({
            success: true,
            message: "Password reset successfully"
        });

    } catch (error) {

        console.error("Reset password error:", error);

        res.status(500).json({
            success: false,
            message: "Password reset failed"
        });
    }
});


// =====================================================
// VERIFY LOGIN SESSION
// =====================================================

router.get("/verify", async (req, res) => {
    try {
        const token = req.cookies.authToken;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Not logged in"
            });
        }

        const decoded = jwt.verify(
            token,
            JWT_SECRET
        );

        const user = await User.findById(
            decoded.id
        ).select(
            "-password -otp -otpExpires -resetOtp -resetOtpExpires"
        );

        if (!user) {
            clearAuthCookie(res);

            return res.status(401).json({
                success: false,
                message: "User not found"
            });
        }

        res.json({
            success: true,
            user: {
                id: user._id,
                email: user.email,
                role: user.role,
                emailVerified: user.emailVerified
            }
        });

    } catch (error) {

        console.error(
            "Session verification error:",
            error
        );

        clearAuthCookie(res);

        res.status(401).json({
            success: false,
            message: "Login session expired"
        });
    }
});


// =====================================================
// LOGOUT
// =====================================================

router.post("/logout", (req, res) => {

    const token = req.cookies.authToken;

    // Already logged out
    if (!token) {
        return res.status(401).json({
            success: false,
            message: "You are already logged out"
        });
    }

    // Clear login cookie
    clearAuthCookie(res);

    res.json({
        success: true,
        message: "Logged out successfully"
    });
});


// =====================================================
// EXPORT ROUTER
// =====================================================

module.exports = router;