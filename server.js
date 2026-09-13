/* =========================================================
   THE POTTER'S HOUSE CHURCH SERVER   // Hello from Nehem
   + EMAIL LOGIN / AUTHENTICATION
   + MONGODB GRIDFS FILE UPLOADS FOR VERCEL
========================================================= */

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
require("dotenv").config();

/* =========================================================
   MODELS
========================================================= */

const Home = require("./models/Home");
const Event = require("./models/Event");
const SpecialEvent = require("./models/SpecialEvent");
const Featured = require("./models/Featured");
const Welcome = require("./models/Welcome");
const Explore = require("./models/Explore");

/* =========================================================
   APP / CONFIG
========================================================= */

const app = express();

const PORT = Number(process.env.PORT) || 5000;

const MONGO_URI =
    process.env.MONGO_URI ||
    "mongodb://127.0.0.1:27017/potters_house";

const JWT_SECRET =
    process.env.JWT_SECRET ||
    "email_login_secret_2026_change_this";

/* =========================================================
   UPLOAD DIRECTORIES
========================================================= */

const UPLOAD_ROOT = process.env.VERCEL
    ? path.join("/tmp", "uploads")
    : path.join(__dirname, "uploads");

const uploadFolders = [
    "",
    "home",
    "hero",
    "logo",
    "events",
    "special-events",
    "featured",
    "welcome",
    "background",
    "calendar"
];

for (const folder of uploadFolders) {
    fs.mkdirSync(path.join(UPLOAD_ROOT, folder), {
        recursive: true
    });
}

/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(
    cors({
        origin: true,
        credentials: true
    })
);

app.use(express.json({ limit: "20mb" }));

app.use(
    express.urlencoded({
        extended: true,
        limit: "20mb"
    })
);

app.use(cookieParser());

/* =========================================================
   STATIC FILES
========================================================= */

app.use(
    express.static(path.join(__dirname, "public"), {
        index: false
    })
);

app.use(
    "/uploads",
    express.static(path.join(__dirname, "uploads"), {
        maxAge: "1h"
    })
);

/* =========================================================
   VERCEL DATABASE MIDDLEWARE
========================================================= */

app.use("/api", async (req, res, next) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(MONGO_URI);
        }

        next();

    } catch (error) {

        console.error("MongoDB connection failed:", error);

        res.status(500).json({
            success: false,
            message: "Database connection failed"
        });
    }
});

/* =========================================================
   MONGODB EVENTS
========================================================= */

mongoose.set("strictQuery", false);

mongoose.connection.on("connected", () => {
    console.log("MongoDB connected successfully.");
    console.log("Database:", mongoose.connection.name);
});

mongoose.connection.on("error", (error) => {
    console.error("MongoDB error:", error);
});

mongoose.connection.on("disconnected", () => {
    console.log("MongoDB disconnected.");
});

/* =========================================================
   UPLOAD FOLDER RESOLVER
========================================================= */

function getUploadFolder(req) {

    const route = String(req.path || "").toLowerCase();

    if (route.startsWith("/api/featured")) {
        return "uploads/featured";
    }

    if (route.startsWith("/api/welcome")) {
        return "uploads/welcome";
    }

    if (route.startsWith("/api/special-events")) {
        return "uploads/special-events";
    }

    if (route.startsWith("/api/events")) {
        return "uploads/events";
    }

    if (
        route.startsWith("/api/calendar") ||
        route.startsWith("/api/content/calendar")
    ) {
        return "uploads/calendar";
    }

    if (route.startsWith("/api/home-background")) {
        return "uploads/background";
    }

    if (route.startsWith("/api/home")) {
        return "uploads/home";
    }

    const section = String(
        req.body?.section || ""
    ).toLowerCase();

    if (section === "featured") {
        return "uploads/featured";
    }

    if (section === "welcome") {
        return "uploads/welcome";
    }

    if (section.includes("special")) {
        return "uploads/special-events";
    }

    if (
        section === "events" ||
        section === "event"
    ) {
        return "uploads/events";
    }

    if (section.includes("background")) {
        return "uploads/background";
    }

    if (section === "calendar") {
        return "uploads/calendar";
    }

    return "uploads";
}

/* =========================================================
   FILE TYPES
========================================================= */

const allowedExtensions = new Set([
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".gif",
    ".mp4",
    ".webm",
    ".mov",
    ".m4v",
    ".pdf"
]);

/* =========================================================
   MULTER STORAGE
   VERCEL = MEMORY
   LOCAL = DISK
========================================================= */

const diskStorage = multer.diskStorage({

    destination: function (req, file, cb) {

        const folder = getUploadFolder(req);

        cb(null, path.join(__dirname, folder));
    },

    filename: function (req, file, cb) {

        const extension = path
            .extname(file.originalname || "")
            .toLowerCase();

        const filename =
            Date.now() +
            "-" +
            Math.round(Math.random() * 1000000000) +
            extension;

        cb(null, filename);
    }
});

const storage = process.env.VERCEL
    ? multer.memoryStorage()
    : diskStorage;

/* =========================================================
   MULTER
========================================================= */

const upload = multer({

    storage,

    limits: {
        fileSize: 150 * 1024 * 1024,
        files: 50
    },

    fileFilter: function (req, file, cb) {

        const extension = path
            .extname(file.originalname || "")
            .toLowerCase();

        const mime = file.mimetype || "";

        const mimeAllowed =
            mime.startsWith("image/") ||
            mime.startsWith("video/") ||
            mime === "application/pdf";

        if (
            mimeAllowed ||
            allowedExtensions.has(extension) ||
            mime === "application/octet-stream"
        ) {
            return cb(null, true);
        }

        cb(
            new Error(
                "Unsupported file type. Allowed: JPG, JPEG, PNG, WEBP, GIF, MP4, WEBM, MOV, M4V and PDF."
            )
        );
    }
});

/* =========================================================
   FILE HELPERS
========================================================= */

function getFiles(req) {

    if (!req.files) return [];

    if (Array.isArray(req.files)) {
        return req.files;
    }

    return Object.values(req.files).flat();
}

function getFirstFile(req) {

    const files = getFiles(req);

    return files.length ? files[0] : null;
}

function getFileByFields(req, names) {

    const files = getFiles(req);

    for (const name of names) {

        const found = files.find(
            file => file.fieldname === name
        );

        if (found) return found;
    }

    return files[0] || null;
}

/* =========================================================
   GRIDFS
========================================================= */

let gridFSBucket = null;

function getGridFSBucket() {

    if (!mongoose.connection.db) {
        throw new Error(
            "MongoDB is not connected"
        );
    }

    if (!gridFSBucket) {

        gridFSBucket =
            new mongoose.mongo.GridFSBucket(
                mongoose.connection.db,
                {
                    bucketName: "uploads"
                }
            );
    }

    return gridFSBucket;
}

function saveBufferToGridFS(file) {

    return new Promise((resolve, reject) => {

        try {

            const bucket =
                getGridFSBucket();

            const extension =
                path.extname(
                    file.originalname || ""
                ).toLowerCase();

            const filename =
                Date.now() +
                "-" +
                Math.round(
                    Math.random() * 1000000000
                ) +
                extension;

            const stream =
                bucket.openUploadStream(
                    filename,
                    {
                        contentType:
                            file.mimetype ||
                            "application/octet-stream",

                        metadata: {
                            originalName:
                                file.originalname ||
                                filename
                        }
                    }
                );

            stream.on(
                "error",
                reject
            );

            stream.on(
                "finish",
                () => {

                    file.gridfsId =
                        stream.id.toString();

                    file.gridfsFilename =
                        filename;

                    resolve(file);
                }
            );

            stream.end(file.buffer);

        } catch (error) {

            reject(error);
        }
    });
}

async function persistUploadedFiles(
    req,
    res,
    next
) {

    if (!process.env.VERCEL) {
        return next();
    }

    try {

        const files = getFiles(req);

        for (const file of files) {

            await saveBufferToGridFS(
                file
            );
        }

        next();

    } catch (error) {

        console.error(
            "GridFS upload error:",
            error
        );

        for (const file of getFiles(req)) {

            if (file?.gridfsId) {

                try {

                    await getGridFSBucket()
                        .delete(
                            new mongoose.mongo.ObjectId(
                                file.gridfsId
                            )
                        );

                } catch {}
            }
        }

        res.status(500).json({

            success: false,

            message:
                "Failed to store uploaded media",

            error:
                error.message
        });
    }
}

/* =========================================================
   UPLOAD MIDDLEWARE
========================================================= */

const uploadAny = [
    upload.any(),
    persistUploadedFiles
];

/* =========================================================
   UPLOAD URL
========================================================= */

function normalizeUploadUrl(file) {

    if (!file) return "";

    if (file.gridfsId) {

        return "/api/files/" +
            file.gridfsId;
    }

    if (!file.path) return "";

    const uploadsRoot =
        path.resolve(
            path.join(
                __dirname,
                "uploads"
            )
        );

    const relative =
        path.relative(
            uploadsRoot,
            file.path
        );

    return "/uploads/" +
        relative.replace(
            /\\/g,
            "/"
        );
}

/* =========================================================
   DELETE UPLOADED FILE
========================================================= */

function deleteUploadedFile(fileUrl) {

    if (typeof fileUrl !== "string") {
        return;
    }

    /* ---------- GRIDFS FILE ---------- */

    if (
        fileUrl.startsWith(
            "/api/files/"
        )
    ) {

        const idString =
            fileUrl
                .replace(
                    /^\/api\/files\//,
                    ""
                )
                .split("?")[0];

        if (
            !validObjectId(
                idString
            )
        ) {
            return;
        }

        try {

            getGridFSBucket()
                .delete(
                    new mongoose.mongo.ObjectId(
                        idString
                    )
                )
                .catch(error => {

                    console.error(
                        "GridFS file delete error:",
                        error.message
                    );
                });

        } catch (error) {

            console.error(
                "GridFS file delete error:",
                error.message
            );
        }

        return;
    }

    /* ---------- OLD LOCAL FILE ---------- */

    if (
        !fileUrl.startsWith(
            "/uploads/"
        )
    ) {
        return;
    }

    const uploadsRoot =
        path.resolve(
            path.join(
                __dirname,
                "uploads"
            )
        );

    const fullPath =
        path.resolve(
            path.join(
                __dirname,
                "uploads",
                fileUrl.replace(
                    /^\/uploads\//,
                    ""
                )
            )
        );

    if (
        !fullPath.startsWith(
            uploadsRoot + path.sep
        )
    ) {
        return;
    }

    if (
        fs.existsSync(fullPath)
    ) {

        try {

            fs.unlinkSync(
                fullPath
            );

        } catch (error) {

            console.error(
                "File delete error:",
                error.message
            );
        }
    }
}

/* =========================================================
   REMOVE NEW FILES
========================================================= */

function removeNewFiles(req) {

    const files = getFiles(req);

    for (const file of files) {

        if (file?.gridfsId) {

            deleteUploadedFile(
                "/api/files/" +
                file.gridfsId
            );

            continue;
        }

        if (
            file?.path &&
            fs.existsSync(
                file.path
            )
        ) {

            try {

                fs.unlinkSync(
                    file.path
                );

            } catch {}
        }
    }
}

function validObjectId(id) {

    return mongoose.Types.ObjectId.isValid(id);
}

/* =========================================================
   GRIDFS FILE DOWNLOAD
========================================================= */

app.get(
    "/api/files/:id",
    async (req, res) => {

        try {

            if (
                !validObjectId(
                    req.params.id
                )
            ) {

                return res
                    .status(400)
                    .send(
                        "Invalid file ID"
                    );
            }

            const id =
                new mongoose.mongo.ObjectId(
                    req.params.id
                );

            const bucket =
                getGridFSBucket();

            const files =
                await mongoose.connection.db
                    .collection(
                        "uploads.files"
                    )
                    .find({
                        _id: id
                    })
                    .limit(1)
                    .toArray();

            if (!files.length) {

                return res
                    .status(404)
                    .send(
                        "File not found"
                    );
            }

            const file =
                files[0];

            /*
             * GridFS may contain older uploads whose contentType is
             * application/octet-stream. That makes Chrome download the
             * calendar instead of displaying it in the preview.
             * Recover the correct MIME type from the original filename.
             */
            const originalName =
                file.metadata?.originalName ||
                file.filename ||
                "";

            const extension =
                path.extname(originalName).toLowerCase();

            const mimeByExtension = {
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".png": "image/png",
                ".webp": "image/webp",
                ".gif": "image/gif",
                ".svg": "image/svg+xml",
                ".mp4": "video/mp4",
                ".webm": "video/webm",
                ".mov": "video/quicktime",
                ".m4v": "video/x-m4v",
                ".pdf": "application/pdf"
            };

            const storedType =
                file.contentType ||
                "application/octet-stream";

            const contentType =
                storedType === "application/octet-stream"
                    ? (mimeByExtension[extension] || storedType)
                    : storedType;

            res.setHeader(
                "Content-Type",
                contentType
            );

            res.setHeader(
                "Content-Disposition",
                "inline"
            );

            res.setHeader(
                "X-Content-Type-Options",
                "nosniff"
            );

            res.setHeader(
                "Cache-Control",
                "public, max-age=31536000, immutable"
            );

            bucket
                .openDownloadStream(id)
                .on(
                    "error",
                    error => {

                        console.error(
                            "GridFS download error:",
                            error.message
                        );

                        if (
                            !res.headersSent
                        ) {

                            res
                                .status(500)
                                .send(
                                    "Failed to load file"
                                );

                        } else {

                            res.end();
                        }
                    }
                )
                .pipe(res);

        } catch (error) {

            console.error(
                "GridFS download error:",
                error
            );

            if (
                !res.headersSent
            ) {

                res
                    .status(500)
                    .send(
                        "Failed to load file"
                    );
            }
        }
    }
);



/* =========================================================
   SERVER SENT EVENTS
========================================================= */

let sseClients = [];

app.get("/api/updates", (req, res) => {

    res.status(200);

    res.setHeader(
        "Content-Type",
        "text/event-stream"
    );

    res.setHeader(
        "Cache-Control",
        "no-cache, no-transform"
    );

    res.setHeader(
        "Connection",
        "keep-alive"
    );

    res.setHeader(
        "X-Accel-Buffering",
        "no"
    );

    res.flushHeaders();

    const connectedMessage =
        "data: " +
        JSON.stringify({
            type: "connected",
            timestamp: Date.now()
        }) +
        "\n\n";

    res.write(connectedMessage);

    sseClients.push(res);

    req.on("close", () => {

        sseClients = sseClients.filter(
            client => client !== res
        );
    });
});

const sseHeartbeat = setInterval(() => {

    sseClients = sseClients.filter(client => {

        try {

            client.write(
                ": heartbeat " +
                Date.now() +
                "\n\n"
            );

            return true;

        } catch {

            return false;
        }
    });

}, 25000);

function notifyClients(type) {

    const message =
        "data: " +
        JSON.stringify({
            type:
                type ||
                "content-updated",
            timestamp: Date.now()
        }) +
        "\n\n";

    sseClients = sseClients.filter(client => {

        try {

            client.write(message);

            return true;

        } catch {

            return false;
        }
    });
}


/* =========================================================
   AUTH MIDDLEWARE
========================================================= */

function requireAuth(req, res, next) {

    const token = req.cookies.authToken;

    if (!token) {

        if (
            req.path === "/admin.html" ||
            req.path === "/admin"
        ) {

            return res.redirect(
                "/login.html"
            );
        }

        return res.status(401).json({
            success: false,
            message:
                "Authentication required"
        });
    }

    try {

        const decoded = jwt.verify(
            token,
            JWT_SECRET
        );

        req.user = decoded;

        next();

    } catch (error) {

        console.log(
            "Invalid authentication token"
        );

        res.clearCookie(
            "authToken",
            {
                httpOnly: true,
                sameSite: "lax",
                secure:
                    process.env.NODE_ENV ===
                    "production"
            }
        );

        if (
            req.path === "/admin.html" ||
            req.path === "/admin"
        ) {

            return res.redirect(
                "/login.html"
            );
        }

        return res.status(401).json({
            success: false,
            message:
                "Invalid or expired login session"
        });
    }
}


/* =========================================================
   AUTH ROUTES
========================================================= */

let authRoutes;

try {

    authRoutes = require(
        "./routes/auth"
    );

} catch (error) {

    console.error("");
    console.error(
        "======================================"
    );
    console.error(
        "       AUTH ROUTE LOAD ERROR"
    );
    console.error(
        "======================================"
    );
    console.error(error);
    console.error("");

    process.exit(1);
}

if (
    typeof authRoutes !== "function"
) {

    console.error("");
    console.error(
        "======================================"
    );
    console.error(
        "       AUTH ROUTER ERROR"
    );
    console.error(
        "======================================"
    );
    console.error(
        "routes/auth.js is not exporting the Express router correctly."
    );
    console.error("");
    console.error(
        "Make sure the LAST line of routes/auth.js is:"
    );
    console.error("");
    console.error(
        "module.exports = router;"
    );
    console.error("");

    process.exit(1);
}

app.use(
    "/api/auth",
    authRoutes
);


/* =========================================================
   STATUS / HEALTH
========================================================= */

app.get(
    "/api/status",
    (req, res) => {

        res.json({

            success: true,

            message:
                "Email Login API is running",

            database:
                mongoose.connection
                    .readyState === 1
                    ? "connected"
                    : "disconnected"
        });
    }
);

app.get(
    "/api/health",
    (req, res) => {

        res.json({

            success: true,

            server: "running",

            mongodb:
                mongoose.connection
                    .readyState === 1
                    ? "connected"
                    : "disconnected",

            timestamp:
                new Date().toISOString()
        });
    }
);


/* =========================================================
   HOME
========================================================= */

app.get(
    "/api/home",
    async (req, res) => {

        try {

            let home =
                await Home.findOne();

            if (!home) {

                home =
                    await Home.create({

                        badge:
                            "Welcome Home",

                        title:
                            "The Potter's House",

                        subtitle:
                            "Church Bengaluru",

                        location:
                            "Bengaluru, Karnataka, India",

                        mapLink:
                            "https://maps.google.com",

                        logo:
                            "/logo.jpeg"
                    });
            }

            res.setHeader(
                "Cache-Control",
                "no-store"
            );

            res.json(home);

        } catch (error) {

            console.error(
                "Home GET error:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Failed to load home data",

                error:
                    error.message
            });
        }
    }
);


/* =========================================================
   HOME UPDATE
========================================================= */

app.put(
    "/api/home",
    ...uploadAny,
    async (req, res) => {

        try {

            let home =
                await Home.findOne();

            if (!home) {
                home = new Home();
            }

            const fields = [
                "badge",
                "title",
                "subtitle",
                "location",
                "mapLink"
            ];

            for (const field of fields) {

                if (
                    req.body[field] !==
                    undefined
                ) {

                    home[field] =
                        req.body[field];
                }
            }

            const logoFile =
                getFileByFields(
                    req,
                    [
                        "logo",
                        "homeLogo"
                    ]
                );

            const oldLogo =
                home.logo;

            if (logoFile) {

                home.logo =
                    normalizeUploadUrl(
                        logoFile
                    );
            }

            await home.save();

            if (
                logoFile &&
                oldLogo &&
                oldLogo !== home.logo
            ) {

                deleteUploadedFile(
                    oldLogo
                );
            }

            notifyClients(
                "home-updated"
            );

            res.json({

                success: true,

                message:
                    "Home updated successfully",

                data: home
            });

        } catch (error) {

            removeNewFiles(req);

            console.error(
                "Home PUT error:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Failed to update home",

                error:
                    error.message
            });
        }
    }
);


/* =========================================================
   HOME BACKGROUND
========================================================= */

function getBackgroundCollection() {

    if (!mongoose.connection.db) {

        throw new Error(
            "MongoDB is not connected"
        );
    }

    return mongoose.connection.db.collection(
        "home_background_media"
    );
}

app.get(
    "/api/home-background",
    async (req, res) => {

        try {

            const collection =
                getBackgroundCollection();

            const items =
                await collection
                    .find({})
                    .sort({
                        order: 1,
                        createdAt: 1
                    })
                    .toArray();

            res.setHeader(
                "Cache-Control",
                "no-store"
            );

            res.json(items);

        } catch (error) {

            res.status(500).json({

                success: false,

                message:
                    "Failed to load home background media",

                error:
                    error.message
            });
        }
    }
);

app.post(
    "/api/home-background",
    ...uploadAny,
    async (req, res) => {

        try {

            const files =
                getFiles(req);

            if (files.length === 0) {

                return res.status(
                    400
                ).json({

                    success: false,

                    message:
                        "Please select at least one background image or video."
                });
            }

            const collection =
                getBackgroundCollection();

            let order =
                Number(req.body.order);

            if (!Number.isFinite(order)) {

                order =
                    await collection
                        .countDocuments();
            }

            const documents =
                files.map(
                    (file, index) => {

                        const type =
                            (
                                file.mimetype ||
                                ""
                            ).startsWith(
                                "video/"
                            )
                                ? "video"
                                : "image";

                        return {

                            title:
                                req.body.title ||
                                file.originalname,

                            type,

                            url:
                                normalizeUploadUrl(
                                    file
                                ),

                            order:
                                order + index,

                            createdAt:
                                new Date(),

                            updatedAt:
                                new Date()
                        };
                    }
                );

            const inserted =
                await collection.insertMany(
                    documents
                );

            notifyClients(
                "home-background-updated"
            );

            res.json({

                success: true,

                message:
                    "Background media uploaded successfully",

                data:
                    Object.values(
                        inserted.insertedIds
                    ).map(
                        id =>
                            documents.find(
                                (_, index) =>
                                    index ===
                                    Object.keys(
                                        inserted.insertedIds
                                    ).indexOf(
                                        String(id)
                                    )
                            )
                    )
            });

        } catch (error) {

            removeNewFiles(req);

            console.error(
                "Home background POST error:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Failed to upload background media",

                error:
                    error.message
            });
        }
    }
);

app.delete(
    "/api/home-background/:id",
    async (req, res) => {

        try {

            const id =
                req.params.id;

            if (!validObjectId(id)) {

                return res.status(
                    400
                ).json({

                    success: false,

                    message:
                        "Invalid background media ID"
                });
            }

            const collection =
                getBackgroundCollection();

            const { ObjectId } =
                mongoose.mongo;

            const item =
                await collection.findOne({
                    _id: new ObjectId(id)
                });

            if (!item) {

                return res.status(
                    404
                ).json({

                    success: false,

                    message:
                        "Background media not found"
                });
            }

            await collection.deleteOne({
                _id: new ObjectId(id)
            });

            if (item.url) {
                deleteUploadedFile(
                    item.url
                );
            }

            notifyClients(
                "home-background-updated"
            );

            res.json({

                success: true,

                message:
                    "Background media deleted successfully"
            });

        } catch (error) {

            console.error(
                "Home background DELETE error:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Failed to delete background media",

                error:
                    error.message
            });
        }
    }
);


/* =========================================================
   COMING EVENTS
========================================================= */

app.get(
    "/api/events",
    async (req, res) => {

        try {

            const events =
                await Event.find().sort({
                    order: 1,
                    createdAt: 1
                });

            res.setHeader(
                "Cache-Control",
                "no-store"
            );

            res.json(events);

        } catch (error) {

            res.status(500).json({

                success: false,

                message:
                    "Failed to load events",

                error:
                    error.message
            });
        }
    }
);

app.post(
    "/api/events",
    ...uploadAny,
    async (req, res) => {

        try {

            const imageFile =
                getFileByFields(
                    req,
                    [
                        "image",
                        "eventImage"
                    ]
                );

            const eventData = {

                category:
                    req.body.category ||
                    "Morning",

                day:
                    req.body.day ||
                    "Sunday",

                service:
                    req.body.service ||
                    req.body.title ||
                    "Worship Service",

                time:
                    req.body.time ||
                    "10:30 AM",

                order:
                    Number(
                        req.body.order
                    ) || 0
            };

            if (imageFile) {

                eventData.image =
                    normalizeUploadUrl(
                        imageFile
                    );
            }

            const event =
                await Event.create(
                    eventData
                );

            notifyClients(
                "events-updated"
            );

            res.status(201).json({

                success: true,

                message:
                    "Event added successfully",

                data: event
            });

        } catch (error) {

            removeNewFiles(req);

            res.status(500).json({

                success: false,

                message:
                    "Failed to add event",

                error:
                    error.message
            });
        }
    }
);

app.put(
    "/api/events/:id",
    ...uploadAny,
    async (req, res) => {

        try {

            if (
                !validObjectId(
                    req.params.id
                )
            ) {

                removeNewFiles(req);

                return res.status(
                    400
                ).json({

                    success: false,

                    message:
                        "Invalid event ID"
                });
            }

            const event =
                await Event.findById(
                    req.params.id
                );

            if (!event) {

                removeNewFiles(req);

                return res.status(
                    404
                ).json({

                    success: false,

                    message:
                        "Event not found"
                });
            }

            for (
                const field of [
                    "category",
                    "day",
                    "service",
                    "time"
                ]
            ) {

                if (
                    req.body[field] !==
                    undefined
                ) {

                    event[field] =
                        req.body[field];
                }
            }

            if (
                req.body.order !==
                undefined
            ) {

                event.order =
                    Number(
                        req.body.order
                    ) || 0;
            }

            const imageFile =
                getFileByFields(
                    req,
                    [
                        "image",
                        "eventImage"
                    ]
                );

            if (imageFile) {

                const oldImage =
                    event.image;

                event.image =
                    normalizeUploadUrl(
                        imageFile
                    );

                await event.save();

                if (
                    oldImage &&
                    oldImage !==
                        event.image
                ) {

                    deleteUploadedFile(
                        oldImage
                    );
                }

            } else {

                await event.save();
            }

            notifyClients(
                "events-updated"
            );

            res.json({

                success: true,

                message:
                    "Event updated successfully",

                data: event
            });

        } catch (error) {

            removeNewFiles(req);

            res.status(500).json({

                success: false,

                message:
                    "Failed to update event",

                error:
                    error.message
            });
        }
    }
);

app.delete(
    "/api/events/:id",
    async (req, res) => {

        try {

            if (
                !validObjectId(
                    req.params.id
                )
            ) {

                return res.status(
                    400
                ).json({

                    success: false,

                    message:
                        "Invalid event ID"
                });
            }

            const event =
                await Event.findByIdAndDelete(
                    req.params.id
                );

            if (!event) {

                return res.status(
                    404
                ).json({

                    success: false,

                    message:
                        "Event not found"
                });
            }

            if (event.image) {

                deleteUploadedFile(
                    event.image
                );
            }

            notifyClients(
                "events-updated"
            );

            res.json({

                success: true,

                message:
                    "Event deleted successfully"
            });

        } catch (error) {

            res.status(500).json({

                success: false,

                message:
                    "Failed to delete event",

                error:
                    error.message
            });
        }
    }
);


/* =========================================================
   SPECIAL EVENTS
========================================================= */

app.get(
    "/api/special-events",
    async (req, res) => {

        try {

            const events =
                await SpecialEvent.find().sort({
                    order: 1,
                    createdAt: 1
                });

            res.setHeader(
                "Cache-Control",
                "no-store"
            );

            res.json(events);

        } catch (error) {

            res.status(500).json({

                success: false,

                message:
                    "Failed to load special events",

                error:
                    error.message
            });
        }
    }
);

app.post(
    "/api/special-events",
    ...uploadAny,
    async (req, res) => {

        try {

            const imageFile =
                getFileByFields(
                    req,
                    [
                        "image",
                        "eventImage",
                        "specialImage"
                    ]
                );

            const event =
                await SpecialEvent.create({

                    title:
                        req.body.title ||
                        "",

                    date:
                        req.body.date ||
                        "",

                    time:
                        req.body.time ||
                        "",

                    description:
                        req.body.description ||
                        "",

                    link:
                        req.body.link ||
                        "#",

                    image:
                        imageFile
                            ? normalizeUploadUrl(
                                imageFile
                            )
                            : "",

                    order:
                        Number(
                            req.body.order
                        ) || 0
                });

            notifyClients(
                "special-events-updated"
            );

            res.status(201).json({

                success: true,

                message:
                    "Special event added successfully",

                data: event
            });

        } catch (error) {

            removeNewFiles(req);

            res.status(500).json({

                success: false,

                message:
                    "Failed to add special event",

                error:
                    error.message
            });
        }
    }
);

app.put(
    "/api/special-events/:id",
    ...uploadAny,
    async (req, res) => {

        try {

            if (
                !validObjectId(
                    req.params.id
                )
            ) {

                removeNewFiles(req);

                return res.status(
                    400
                ).json({

                    success: false,

                    message:
                        "Invalid special event ID"
                });
            }

            const event =
                await SpecialEvent.findById(
                    req.params.id
                );

            if (!event) {

                removeNewFiles(req);

                return res.status(
                    404
                ).json({

                    success: false,

                    message:
                        "Special event not found"
                });
            }

            for (
                const field of [
                    "title",
                    "date",
                    "time",
                    "description",
                    "link"
                ]
            ) {

                if (
                    req.body[field] !==
                    undefined
                ) {

                    event[field] =
                        req.body[field];
                }
            }

            if (
                req.body.order !==
                undefined
            ) {

                event.order =
                    Number(
                        req.body.order
                    ) || 0;
            }

            const imageFile =
                getFileByFields(
                    req,
                    [
                        "image",
                        "eventImage",
                        "specialImage"
                    ]
                );

            if (imageFile) {

                const oldImage =
                    event.image;

                event.image =
                    normalizeUploadUrl(
                        imageFile
                    );

                await event.save();

                if (
                    oldImage &&
                    oldImage !==
                        event.image
                ) {

                    deleteUploadedFile(
                        oldImage
                    );
                }

            } else {

                await event.save();
            }

            notifyClients(
                "special-events-updated"
            );

            res.json({

                success: true,

                message:
                    "Special event updated successfully",

                data: event
            });

        } catch (error) {

            removeNewFiles(req);

            res.status(500).json({

                success: false,

                message:
                    "Failed to update special event",

                error:
                    error.message
            });
        }
    }
);

app.delete(
    "/api/special-events/:id",
    async (req, res) => {

        try {

            if (
                !validObjectId(
                    req.params.id
                )
            ) {

                return res.status(
                    400
                ).json({

                    success: false,

                    message:
                        "Invalid special event ID"
                });
            }

            const event =
                await SpecialEvent.findByIdAndDelete(
                    req.params.id
                );

            if (!event) {

                return res.status(
                    404
                ).json({

                    success: false,

                    message:
                        "Special event not found"
                });
            }

            if (event.image) {

                deleteUploadedFile(
                    event.image
                );
            }

            notifyClients(
                "special-events-updated"
            );

            res.json({

                success: true,

                message:
                    "Special event deleted successfully"
            });

        } catch (error) {

            res.status(500).json({

                success: false,

                message:
                    "Failed to delete special event",

                error:
                    error.message
            });
        }
    }
);


/* =========================================================
   FEATURED
========================================================= */

app.get(
    "/api/featured",
    async (req, res) => {

        try {

            let featured =
                await Featured.findOne();

            if (!featured) {

                featured =
                    await Featured.create({

                        title:
                            "Featured",

                        description:
                            "",

                        image:
                            ""
                    });
            }

            res.setHeader(
                "Cache-Control",
                "no-store"
            );

            res.json(featured);

        } catch (error) {

            console.error(
                "Featured GET error:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Failed to load featured content",

                error:
                    error.message
            });
        }
    }
);

app.put(
    "/api/featured",
    ...uploadAny,
    async (req, res) => {

        try {

            let featured =
                await Featured.findOne();

            if (!featured) {
                featured = new Featured();
            }

            for (
                const field of [
                    "title",
                    "description",
                    "link",
                    "buttonText"
                ]
            ) {

                if (
                    req.body[field] !==
                    undefined
                ) {

                    featured[field] =
                        req.body[field];
                }
            }

            const imageFile =
                getFileByFields(
                    req,
                    [
                        "image",
                        "featuredImage"
                    ]
                );

            if (imageFile) {

                const oldImage =
                    featured.image;

                featured.image =
                    normalizeUploadUrl(
                        imageFile
                    );

                await featured.save();

                if (
                    oldImage &&
                    oldImage !==
                        featured.image
                ) {

                    deleteUploadedFile(
                        oldImage
                    );
                }

            } else {

                await featured.save();
            }

            notifyClients(
                "featured-updated"
            );

            res.json({

                success: true,

                message:
                    "Featured content updated successfully",

                data: featured
            });

        } catch (error) {

            removeNewFiles(req);

            console.error(
                "Featured PUT error:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Failed to update featured content",

                error:
                    error.message
            });
        }
    }
);


/* =========================================================
   WELCOME
========================================================= */

app.get(
    "/api/welcome",
    async (req, res) => {

        try {

            let welcome =
                await Welcome.findOne();

            if (!welcome) {

                welcome =
                    await Welcome.create({

                        title:
                            "Welcome to The Potter's House",

                        description:
                            "",

                        image:
                            ""
                    });
            }

            res.setHeader(
                "Cache-Control",
                "no-store"
            );

            res.json(welcome);

        } catch (error) {

            console.error(
                "Welcome GET error:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Failed to load welcome content",

                error:
                    error.message
            });
        }
    }
);

app.put(
    "/api/welcome",
    ...uploadAny,
    async (req, res) => {

        try {

            let welcome =
                await Welcome.findOne();

            if (!welcome) {
                welcome = new Welcome();
            }

            for (
                const field of [
                    "title",
                    "description",
                    "subtitle"
                ]
            ) {

                if (
                    req.body[field] !==
                    undefined
                ) {

                    welcome[field] =
                        req.body[field];
                }
            }

            const imageFile =
                getFileByFields(
                    req,
                    [
                        "image",
                        "welcomeImage"
                    ]
                );

            if (imageFile) {

                const oldImage =
                    welcome.image;

                welcome.image =
                    normalizeUploadUrl(
                        imageFile
                    );

                await welcome.save();

                if (
                    oldImage &&
                    oldImage !==
                        welcome.image
                ) {

                    deleteUploadedFile(
                        oldImage
                    );
                }

            } else {

                await welcome.save();
            }

            notifyClients(
                "welcome-updated"
            );

            res.json({

                success: true,

                message:
                    "Welcome content updated successfully",

                data: welcome
            });

        } catch (error) {

            removeNewFiles(req);

            console.error(
                "Welcome PUT error:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Failed to update welcome content",

                error:
                    error.message
            });
        }
    }
);


/* =========================================================
   EXPLORE
========================================================= */

app.get(
    "/api/explore",
    async (req, res) => {

        try {

            const items =
                await Explore.find().sort({
                    order: 1,
                    createdAt: 1
                });

            res.setHeader(
                "Cache-Control",
                "no-store"
            );

            res.json(items);

        } catch (error) {

            console.error(
                "Explore GET error:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Failed to load explore content",

                error:
                    error.message
            });
        }
    }
);

app.post(
    "/api/explore",
    ...uploadAny,
    async (req, res) => {

        try {

            const imageFile =
                getFileByFields(
                    req,
                    [
                        "image",
                        "exploreImage"
                    ]
                );

            const item =
                await Explore.create({

                    title:
                        req.body.title ||
                        "",

                    description:
                        req.body.description ||
                        "",

                    link:
                        req.body.link ||
                        "#",

                    image:
                        imageFile
                            ? normalizeUploadUrl(
                                imageFile
                            )
                            : "",

                    order:
                        Number(
                            req.body.order
                        ) || 0
                });

            notifyClients(
                "explore-updated"
            );

            res.status(201).json({

                success: true,

                message:
                    "Explore item added successfully",

                data: item
            });

        } catch (error) {

            removeNewFiles(req);

            console.error(
                "Explore POST error:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Failed to add explore item",

                error:
                    error.message
            });
        }
    }
);

app.put(
    "/api/explore/:id",
    ...uploadAny,
    async (req, res) => {

        try {

            if (
                !validObjectId(
                    req.params.id
                )
            ) {

                removeNewFiles(req);

                return res.status(
                    400
                ).json({

                    success: false,

                    message:
                        "Invalid explore item ID"
                });
            }

            const item =
                await Explore.findById(
                    req.params.id
                );

            if (!item) {

                removeNewFiles(req);

                return res.status(
                    404
                ).json({

                    success: false,

                    message:
                        "Explore item not found"
                });
            }

            for (
                const field of [
                    "title",
                    "description",
                    "link"
                ]
            ) {

                if (
                    req.body[field] !==
                    undefined
                ) {

                    item[field] =
                        req.body[field];
                }
            }

            if (
                req.body.order !==
                undefined
            ) {

                item.order =
                    Number(
                        req.body.order
                    ) || 0;
            }

            const imageFile =
                getFileByFields(
                    req,
                    [
                        "image",
                        "exploreImage"
                    ]
                );

            if (imageFile) {

                const oldImage =
                    item.image;

                item.image =
                    normalizeUploadUrl(
                        imageFile
                    );

                await item.save();

                if (
                    oldImage &&
                    oldImage !==
                        item.image
                ) {

                    deleteUploadedFile(
                        oldImage
                    );
                }

            } else {

                await item.save();
            }

            notifyClients(
                "explore-updated"
            );

            res.json({

                success: true,

                message:
                    "Explore item updated successfully",

                data: item
            });

        } catch (error) {

            removeNewFiles(req);

            console.error(
                "Explore PUT error:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Failed to update explore item",

                error:
                    error.message
            });
        }
    }
);

app.delete(
    "/api/explore/:id",
    async (req, res) => {

        try {

            if (
                !validObjectId(
                    req.params.id
                )
            ) {

                return res.status(
                    400
                ).json({

                    success: false,

                    message:
                        "Invalid explore item ID"
                });
            }

            const item =
                await Explore.findByIdAndDelete(
                    req.params.id
                );

            if (!item) {

                return res.status(
                    404
                ).json({

                    success: false,

                    message:
                        "Explore item not found"
                });
            }

            if (item.image) {

                deleteUploadedFile(
                    item.image
                );
            }

            notifyClients(
                "explore-updated"
            );

            res.json({

                success: true,

                message:
                    "Explore item deleted successfully"
            });

        } catch (error) {

            console.error(
                "Explore DELETE error:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Failed to delete explore item",

                error:
                    error.message
            });
        }
    }
);


/* =========================================================
   CALENDAR
   The church calendar is a single current item.
   Older duplicate records are cleaned up when saving/removing.
========================================================= */

async function getCurrentCalendar() {

    const collection =
        mongoose.connection.db.collection(
            "calendar"
        );

    return await collection
        .findOne(
            {},
            {
                sort: {
                    updatedAt: -1,
                    createdAt: -1
                }
            }
        );
}

async function cleanupOldCalendars(
    collection,
    keepId
) {

    const oldItems =
        await collection
            .find(
                keepId
                    ? {
                        _id: {
                            $ne: keepId
                        }
                    }
                    : {}
            )
            .toArray();

    if (!oldItems.length) {
        return;
    }

    await collection.deleteMany(
        keepId
            ? {
                _id: {
                    $ne: keepId
                }
            }
            : {}
    );

    for (const oldItem of oldItems) {

        if (oldItem?.image) {
            deleteUploadedFile(
                oldItem.image
            );
        }
    }
}

async function saveCurrentCalendar(
    req
) {

    const collection =
        mongoose.connection.db.collection(
            "calendar"
        );

    const imageFile =
        getFileByFields(
            req,
            [
                "calendarFile",
                "image",
                "calendarImage"
            ]
        );

    const current =
        await getCurrentCalendar();

    const item = {

        title:
            req.body.title ||
            "Church Calendar",

        date:
            req.body.date ||
            "",

        time:
            req.body.time ||
            "",

        description:
            req.body.description ||
            "",

        location:
            req.body.location ||
            "",

        link:
            req.body.link ||
            "",

        order:
            Number(
                req.body.order
            ) || 0,

        updatedAt:
            new Date()
    };

    /*
     * Keep the existing file when the user saves
     * without selecting a replacement file.
     */
    if (imageFile) {

        item.image =
            normalizeUploadUrl(
                imageFile
            );
    } else if (current?.image) {

        item.image =
            current.image;
    }

    let savedId;

    if (current?._id) {

        await collection.updateOne(
            {
                _id: current._id
            },
            {
                $set: item
            }
        );

        savedId =
            current._id;

        if (
            imageFile &&
            current.image &&
            current.image !==
                item.image
        ) {

            deleteUploadedFile(
                current.image
            );
        }

    } else {

        item.createdAt =
            new Date();

        const inserted =
            await collection.insertOne(
                item
            );

        savedId =
            inserted.insertedId;
    }

    /*
     * The calendar is singular. Remove any
     * duplicate records left by older versions.
     */
    await cleanupOldCalendars(
        collection,
        savedId
    );

    notifyClients(
        "calendar-updated"
    );

    return {
        success: true,
        message:
            "Calendar updated successfully"
    };
}

app.get(
    "/api/calendar",
    async (req, res) => {

        try {

            const item =
                await getCurrentCalendar();

            res.setHeader(
                "Cache-Control",
                "no-store"
            );

            if (!item) {

                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "No calendar has been configured."
                    });
            }

            res.json(item);

        } catch (error) {

            console.error(
                "Calendar GET error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to load calendar",
                error:
                    error.message
            });
        }
    }
);

app.put(
    "/api/calendar",
    ...uploadAny,
    async (req, res) => {

        try {

            const result =
                await saveCurrentCalendar(
                    req
                );

            res.json(result);

        } catch (error) {

            removeNewFiles(req);

            console.error(
                "Calendar PUT error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to update calendar",
                error:
                    error.message
            });
        }
    }
);

/*
 * Remove the entire current calendar.
 * This matches the Admin button, which calls
 * DELETE /api/calendar without an ID.
 */
app.delete(
    "/api/calendar",
    async (req, res) => {

        try {

            const collection =
                mongoose.connection.db.collection(
                    "calendar"
                );

            const items =
                await collection
                    .find({})
                    .toArray();

            await collection.deleteMany({});

            for (const item of items) {

                if (item?.image) {
                    deleteUploadedFile(
                        item.image
                    );
                }
            }

            notifyClients(
                "calendar-updated"
            );

            res.json({
                success: true,
                message:
                    "Calendar removed successfully"
            });

        } catch (error) {

            console.error(
                "Calendar DELETE error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to remove calendar",
                error:
                    error.message
            });
        }
    }
);

/*
 * Keep the old ID route for compatibility.
 */
app.delete(
    "/api/calendar/:id",
    async (req, res) => {

        try {

            if (
                !validObjectId(
                    req.params.id
                )
            ) {

                return res.status(
                    400
                ).json({
                    success: false,
                    message:
                        "Invalid calendar ID"
                });
            }

            const collection =
                mongoose.connection.db.collection(
                    "calendar"
                );

            const item =
                await collection.findOne({
                    _id:
                        new mongoose.mongo.ObjectId(
                            req.params.id
                        )
                });

            if (!item) {

                return res.status(
                    404
                ).json({
                    success: false,
                    message:
                        "Calendar item not found"
                });
            }

            await collection.deleteOne({
                _id:
                    new mongoose.mongo.ObjectId(
                        req.params.id
                    )
            });

            if (item.image) {
                deleteUploadedFile(
                    item.image
                );
            }

            /*
             * If another legacy duplicate exists,
             * promote the newest one as current.
             */
            const remaining =
                await collection
                    .find({})
                    .sort({
                        updatedAt: -1,
                        createdAt: -1
                    })
                    .limit(1)
                    .toArray();

            if (remaining.length) {

                await cleanupOldCalendars(
                    collection,
                    remaining[0]._id
                );
            }

            notifyClients(
                "calendar-updated"
            );

            res.json({
                success: true,
                message:
                    "Calendar removed successfully"
            });

        } catch (error) {

            console.error(
                "Calendar DELETE by ID error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to remove calendar",
                error:
                    error.message
            });
        }
    }
);


/* =========================================================
   CONTENT CALENDAR
   Compatibility routes used by older code.
========================================================= */

app.get(
    "/api/content/calendar",
    async (req, res) => {

        try {

            const item =
                await getCurrentCalendar();

            res.setHeader(
                "Cache-Control",
                "no-store"
            );

            if (!item) {

                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "No calendar has been configured."
                    });
            }

            res.json(item);

        } catch (error) {

            console.error(
                "Content calendar GET error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to load calendar",
                error:
                    error.message
            });
        }
    }
);

app.put(
    "/api/content/calendar",
    ...uploadAny,
    async (req, res) => {

        try {

            const result =
                await saveCurrentCalendar(
                    req
                );

            res.json(result);

        } catch (error) {

            removeNewFiles(req);

            console.error(
                "Content calendar PUT error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to update calendar",
                error:
                    error.message
            });
        }
    }
);

/* =========================================================
   PAGE ROUTES
========================================================= */

app.get("/", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );
});

app.get("/index.html", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );
});

app.get("/login", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "login.html"
        )
    );
});

app.get("/login.html", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "login.html"
        )
    );
});

app.get("/admin", requireAuth, (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "admin.html"
        )
    );
});

app.get("/admin.html", requireAuth, (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "admin.html"
        )
    );
});


/* =========================================================
   ADMIN AUTH CHECK
========================================================= */

app.get(
    "/api/auth/check",
    requireAuth,
    (req, res) => {

        res.json({

            success: true,

            authenticated: true,

            user: req.user || null
        });
    }
);


/* =========================================================
   LOGOUT
========================================================= */

app.post(
    "/api/auth/logout",
    (req, res) => {

        res.clearCookie(
            "authToken",
            {
                httpOnly: true,
                sameSite: "lax",
                secure:
                    process.env.NODE_ENV ===
                    "production"
            }
        );

        res.json({

            success: true,

            message:
                "Logged out successfully"
        });
    }
);


/* =========================================================
   404 API HANDLER
========================================================= */

app.use(
    "/api",
    (req, res) => {

        res.status(404).json({

            success: false,

            message:
                "API endpoint not found",

            path:
                req.originalUrl
        });
    }
);


/* =========================================================
   GENERAL 404 HANDLER
========================================================= */

app.use(
    (req, res) => {

        res.status(404).send(
            "Page not found"
        );
    }
);


/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(
    (error, req, res, next) => {

        console.error(
            "======================================"
        );

        console.error(
            "EXPRESS ERROR"
        );

        console.error(
            error
        );

        console.error(
            "======================================"
        );

        if (
            res.headersSent
        ) {

            return next(error);
        }

        let statusCode = 500;

        if (
            error instanceof multer.MulterError
        ) {

            if (
                error.code ===
                "LIMIT_FILE_SIZE"
            ) {

                statusCode = 413;
            }

            return res
                .status(statusCode)
                .json({

                    success: false,

                    message:
                        error.code ===
                        "LIMIT_FILE_SIZE"
                            ? "File is too large. Maximum size is 150MB."
                            : "Upload error",

                    error:
                        error.message,

                    code:
                        error.code
                });
        }

        res
            .status(statusCode)
            .json({

                success: false,

                message:
                    "Server error",

                error:
                    error.message ||
                    "Unknown server error"
            });
    }
);


/* =========================================================
   DATABASE SEED
========================================================= */

async function seedDatabase() {

    try {

        const homeCount =
            await Home.countDocuments();

        if (
            homeCount === 0
        ) {

            await Home.create({

                badge:
                    "Welcome Home",

                title:
                    "The Potter's House",

                subtitle:
                    "Church Bengaluru",

                location:
                    "Bengaluru, Karnataka, India",

                mapLink:
                    "https://maps.google.com",

                logo:
                    "/logo.jpeg"
            });

            console.log(
                "Default Home document created."
            );
        }


        const featuredCount =
            await Featured.countDocuments();

        if (
            featuredCount === 0
        ) {

            await Featured.create({

                title:
                    "Featured",

                description:
                    "",

                image:
                    ""
            });

            console.log(
                "Default Featured document created."
            );
        }


        const welcomeCount =
            await Welcome.countDocuments();

        if (
            welcomeCount === 0
        ) {

            await Welcome.create({

                title:
                    "Welcome to The Potter's House",

                description:
                    "",

                image:
                    ""
            });

            console.log(
                "Default Welcome document created."
            );
        }

    } catch (error) {

        console.error(
            "Database seed error:",
            error
        );
    }
}


/* =========================================================
   DATABASE CONNECTION
========================================================= */

let server = null;

async function startServer() {

    try {

        console.log(
            "Connecting to MongoDB..."
        );

        await mongoose.connect(
            MONGO_URI
        );

        console.log(
            "MongoDB connection established."
        );

        await seedDatabase();

        /*
         * Vercel imports this file as a serverless
         * function. Do not call app.listen() there.
         */

        if (
            !process.env.VERCEL
        ) {

            server =
                app.listen(
                    PORT,
                    () => {

                        console.log("");
                        console.log(
                            "======================================"
                        );

                        console.log(
                            "THE POTTER'S HOUSE CHURCH SERVER"
                        );

                        console.log(
                            "======================================"
                        );

                        console.log(
                            `Server running on port ${PORT}`
                        );

                        console.log(
                            `http://localhost:${PORT}`
                        );

                        console.log(
                            "======================================"
                        );

                        console.log("");
                    }
                );
        }

    } catch (error) {

        console.error("");
        console.error(
            "======================================"
        );

        console.error(
            "MONGODB CONNECTION FAILED"
        );

        console.error(
            "======================================"
        );

        console.error(
            error
        );

        console.error(
            "======================================"
        );

        /*
         * On Vercel, the request middleware will
         * report database errors to the client.
         *
         * Locally, keep the process alive long enough
         * to make the error visible.
         */

        if (
            !process.env.VERCEL
        ) {

            process.exit(1);
        }
    }
}


/* =========================================================
   GRACEFUL SHUTDOWN
========================================================= */

async function shutdown(
    signal
) {

    console.log(
        `${signal} received. Shutting down...`
    );

    clearInterval(
        sseHeartbeat
    );

    for (
        const client of sseClients
    ) {

        try {

            client.end();

        } catch {}
    }

    sseClients = [];

    if (server) {

        await new Promise(
            resolve => {

                server.close(
                    () => resolve()
                );
            }
        );
    }

    try {

        await mongoose.connection.close();

        console.log(
            "MongoDB connection closed."
        );

    } catch (error) {

        console.error(
            "MongoDB shutdown error:",
            error.message
        );
    }

    process.exit(0);
}

process.on(
    "SIGINT",
    () => shutdown("SIGINT")
);

process.on(
    "SIGTERM",
    () => shutdown("SIGTERM")
);


/* =========================================================
   START SERVER
========================================================= */

startServer();


/* =========================================================
   EXPORT APP
========================================================= */

module.exports = app;








