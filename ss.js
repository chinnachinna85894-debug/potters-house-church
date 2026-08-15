/* =========================================================
   THE POTTER'S HOUSE CHURCH
   COMPLETE SERVER.JS

   Includes:
   - Express
   - MongoDB / Mongoose
   - Multer uploads
   - Home / Logo
   - Home Background Images + Videos
   - Coming Events
   - Special Events + Images
   - Featured
   - Welcome
   - Explore - UNLIMITED ITEMS
   - Calendar URL / PDF / JPG / PNG / WEBP
   - Server Sent Events (SSE)
   - Automatic live updates
   - Static uploads
   - JSON error responses
   - Express 5 compatible
========================================================= */

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
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
   APP CONFIG
========================================================= */

const app = express();

const PORT = Number(process.env.PORT) || 5000;

const MONGO_URI =
    process.env.MONGO_URI ||
    "mongodb://127.0.0.1:27017/potters_house";

/* =========================================================
   UPLOAD DIRECTORIES
========================================================= */

const uploadFolders = [
    "uploads",
    "uploads/home",
    "uploads/hero",
    "uploads/logo",
    "uploads/events",
    "uploads/special-events",
    "uploads/featured",
    "uploads/welcome",
    "uploads/background",
    "uploads/calendar",
];

for (const folder of uploadFolders) {
    const fullPath = path.join(__dirname, folder);

    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, {
            recursive: true,
        });
    }
}

/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(
    cors({
        origin: true,
        credentials: true,
    })
);

app.use(express.json({ limit: "20mb" }));

app.use(
    express.urlencoded({
        extended: true,
        limit: "20mb",
    })
);

/* =========================================================
   STATIC FILES
========================================================= */

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);

app.use(
    "/uploads",
    express.static(
        path.join(__dirname, "uploads"),
        {
            maxAge: "1h",
        }
    )
);

/* =========================================================
   MONGODB
========================================================= */

mongoose.set(
    "strictQuery",
    false
);

mongoose.connection.on(
    "connected",
    () => {
        console.log(
            "MongoDB connected successfully"
        );

        console.log(
            "Database:",
            mongoose.connection.name
        );
    }
);

mongoose.connection.on(
    "error",
    (error) => {
        console.error(
            "MongoDB error:",
            error
        );
    }
);

mongoose.connection.on(
    "disconnected",
    () => {
        console.log(
            "MongoDB disconnected"
        );
    }
);

/* =========================================================
   MULTER STORAGE
========================================================= */

/*
   IMPORTANT:

   We determine the upload folder from the API route first.

   This means the upload works even when the browser sends
   the "section" field after the file.

   This fixes many of the previous upload problems.
*/

function getUploadFolder(req) {
    const route = String(
        req.path || ""
    ).toLowerCase();

    const section = String(
        req.body?.section || ""
    ).toLowerCase();

    if (
        route === "/api/home" ||
        route.startsWith("/api/home/")
    ) {
        return "uploads/home";
    }

    if (
        route === "/api/home-background" ||
        route.startsWith("/api/home-background/")
    ) {
        return "uploads/background";
    }

    if (
        route === "/api/events" ||
        route.startsWith("/api/events/")
    ) {
        return "uploads/events";
    }

    if (
        route === "/api/special-events" ||
        route.startsWith("/api/special-events/")
    ) {
        return "uploads/special-events";
    }

    if (
        route === "/api/featured" ||
        route.startsWith("/api/featured/")
    ) {
        return "uploads/featured";
    }

    if (
        route === "/api/welcome" ||
        route.startsWith("/api/welcome/")
    ) {
        return "uploads/welcome";
    }

    if (
        route === "/api/calendar" ||
        route.startsWith("/api/calendar/")
    ) {
        return "uploads/calendar";
    }

    /* Fallback for old admin forms */

    if (section === "home") {
        return "uploads/home";
    }

    if (
        section === "background" ||
        section === "home-background"
    ) {
        return "uploads/background";
    }

    if (
        section === "event" ||
        section === "events"
    ) {
        return "uploads/events";
    }

    if (
        section === "special-event" ||
        section === "special-events"
    ) {
        return "uploads/special-events";
    }

    if (section === "featured") {
        return "uploads/featured";
    }

    if (section === "welcome") {
        return "uploads/welcome";
    }

    if (section === "calendar") {
        return "uploads/calendar";
    }

    return "uploads";
}

const storage = multer.diskStorage({
    destination: function (
        req,
        file,
        cb
    ) {
        const folder =
            getUploadFolder(req);

        const destination =
            path.join(
                __dirname,
                folder
            );

        if (
            !fs.existsSync(destination)
        ) {
            fs.mkdirSync(
                destination,
                {
                    recursive: true,
                }
            );
        }

        cb(
            null,
            destination
        );
    },

    filename: function (
        req,
        file,
        cb
    ) {
        const extension =
            path.extname(
                file.originalname
            );

        const safeExtension =
            extension
                ? extension
                : "";

        const filename =
            Date.now() +
            "-" +
            Math.round(
                Math.random() *
                    1000000000
            ) +
            safeExtension;

        cb(
            null,
            filename
        );
    },
});

/* =========================================================
   ALLOWED FILE TYPES
========================================================= */

const imageTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
];

const videoTypes = [
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/x-m4v",
];

const documentTypes = [
    "application/pdf",
];

/*
   Also allow common browser MIME variations.
*/

const allowedTypes = [
    ...imageTypes,
    ...videoTypes,
    ...documentTypes,

    "application/octet-stream",
];

/* =========================================================
   MULTER

   upload.any() is intentional here.

   Your previous error:

       Unexpected field

   happened because the browser/admin page and server did
   not always use exactly the same multipart field name.

   The backend now accepts the file regardless of whether
   the admin sends:

       image
       eventImage
       specialImage
       calendarFile
       file
       media
       backgroundMedia
       logo
       welcomeImage
       backgroundImage

   The application still decides which file to use.
========================================================= */

const upload = multer({
    storage,

    limits: {
        fileSize:
            150 * 1024 * 1024,

        files: 50,
    },

    fileFilter:
        function (
            req,
            file,
            cb
        ) {
            if (
                allowedTypes.includes(
                    file.mimetype
                )
            ) {
                cb(
                    null,
                    true
                );
                return;
            }

            /*
               Some Windows/browser uploads may
               report application/octet-stream.

               We allow it because the extension is
               checked below.
            */

            const extension =
                path.extname(
                    file.originalname
                ).toLowerCase();

            const allowedExtensions = [
                ".jpg",
                ".jpeg",
                ".png",
                ".webp",
                ".gif",
                ".mp4",
                ".webm",
                ".mov",
                ".m4v",
                ".pdf",
            ];

            if (
                allowedExtensions.includes(
                    extension
                )
            ) {
                cb(
                    null,
                    true
                );
                return;
            }

            cb(
                new Error(
                    "Unsupported file type. Allowed: JPG, JPEG, PNG, WEBP, GIF, MP4, WEBM, MOV and PDF."
                )
            );
        },
});

/* =========================================================
   FILE HELPERS
========================================================= */

function getFiles(req) {
    if (
        !req.files
    ) {
        return [];
    }

    if (
        Array.isArray(
            req.files
        )
    ) {
        return req.files;
    }

    return Object.values(
        req.files
    ).flat();
}

function getFirstFile(req) {
    const files =
        getFiles(req);

    return files.length
        ? files[0]
        : null;
}

function getFileByFields(
    req,
    fieldNames
) {
    const files =
        getFiles(req);

    if (
        !files.length
    ) {
        return null;
    }

    for (
        const fieldName of fieldNames
    ) {
        const found =
            files.find(
                (file) =>
                    file.fieldname ===
                    fieldName
            );

        if (found) {
            return found;
        }
    }

    return files[0];
}

function normalizeUploadUrl(
    file
) {
    if (!file) {
        return "";
    }

    const uploadsRoot =
        path.join(
            __dirname,
            "uploads"
        );

    const relative =
        path.relative(
            uploadsRoot,
            file.path
        );

    return (
        "/uploads/" +
        relative.replace(
            /\\/g,
            "/"
        )
    );
}

function deleteUploadedFile(
    fileUrl
) {
    if (
        !fileUrl ||
        typeof fileUrl !==
            "string"
    ) {
        return;
    }

    if (
        !fileUrl.startsWith(
            "/uploads/"
        )
    ) {
        return;
    }

    const relative =
        fileUrl.replace(
            /^\/uploads\//,
            ""
        );

    const fullPath =
        path.join(
            __dirname,
            "uploads",
            relative
        );

    /*
       Security check so a malformed URL
       cannot escape the uploads directory.
    */

    const uploadsRoot =
        path.resolve(
            path.join(
                __dirname,
                "uploads"
            )
        );

    const resolved =
        path.resolve(
            fullPath
        );

    if (
        !resolved.startsWith(
            uploadsRoot +
                path.sep
        )
    ) {
        return;
    }

    if (
        fs.existsSync(
            resolved
        )
    ) {
        try {
            fs.unlinkSync(
                resolved
            );
        } catch (error) {
            console.error(
                "Could not delete uploaded file:",
                error.message
            );
        }
    }
}

function removeUploadedFiles(
    files
) {
    if (!files) {
        return;
    }

    const list =
        Array.isArray(files)
            ? files
            : Object.values(
                  files
              ).flat();

    for (
        const file of list
    ) {
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
            } catch (error) {
                console.error(
                    "Could not remove uploaded file:",
                    error.message
                );
            }
        }
    }
}

function isValidObjectId(
    id
) {
    return mongoose.Types.ObjectId.isValid(
        id
    );
}

/* =========================================================
   SERVER SENT EVENTS
========================================================= */

let sseClients = [];

app.get(
    "/api/updates",
    (req, res) => {
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

        /*
           Initial connection message.
        */

        res.write(
            `data: ${JSON.stringify(
                {
                    type:
                        "connected",
                    timestamp:
                        Date.now(),
                }
            )}\n\n`
        );

        sseClients.push(
            res
        );

        req.on(
            "close",
            () => {
                sseClients =
                    sseClients.filter(
                        (client) =>
                            client !==
                            res
                    );
            }
        );
    }
);

/*
   Keep SSE connections alive.
*/

const sseHeartbeat =
    setInterval(
        () => {
            sseClients =
                sseClients.filter(
                    (client) => {
                        try {
                            client.write(
                                `: heartbeat ${Date.now()}\n\n`
                            );

                            return true;
                        } catch {
                            return false;
                        }
                    }
                );
        },
        25000
    );

function notifyClients(
    type
) {
    const message =
        `data: ${JSON.stringify(
            {
                type:
                    type ||
                    "content-updated",
                timestamp:
                    Date.now(),
            }
        )}\n\n`;

    sseClients =
        sseClients.filter(
            (client) => {
                try {
                    client.write(
                        message
                    );

                    return true;
                } catch {
                    return false;
                }
            }
        );
}

/* =========================================================
   HEALTH CHECK
========================================================= */

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
                new Date().toISOString(),
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

                        logo: "",
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
                    error.message,
            });
        }
    }
);

app.put(
    "/api/home",
    upload.any(),
    async (req, res) => {
        try {
            let home =
                await Home.findOne();

            if (!home) {
                home =
                    new Home();
            }

            const fields = [
                "badge",
                "title",
                "subtitle",
                "location",
                "mapLink",
            ];

            for (
                const field of fields
            ) {
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
                        "homeLogo",
                    ]
                );

            if (logoFile) {
                const oldLogo =
                    home.logo;

                home.logo =
                    normalizeUploadUrl(
                        logoFile
                    );

                await home.save();

                if (
                    oldLogo &&
                    oldLogo !==
                        home.logo
                ) {
                    deleteUploadedFile(
                        oldLogo
                    );
                }
            } else {
                await home.save();
            }

            notifyClients(
                "home-updated"
            );

            res.json({
                success: true,
                message:
                    "Home updated successfully",
                data: home,
            });
        } catch (error) {
            console.error(
                "Home PUT error:",
                error
            );

            removeUploadedFiles(
                req.files
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to update home",
                error:
                    error.message,
            });
        }
    }
);

/* =========================================================
   HOME BACKGROUND
   IMAGES + VIDEOS
========================================================= */

function getBackgroundCollection() {
    if (
        !mongoose.connection.db
    ) {
        throw new Error(
            "MongoDB is not connected"
        );
    }

    return mongoose.connection.db.collection(
        "home_background_media"
    );
}

/* GET BACKGROUND */

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
                        createdAt: 1,
                    })
                    .toArray();

            res.setHeader(
                "Cache-Control",
                "no-store"
            );

            res.json(items);
        } catch (error) {
            console.error(
                "Background GET error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to load home background media",
                error:
                    error.message,
            });
        }
    }
);

/* ADD BACKGROUND */

app.post(
    "/api/home-background",
    upload.any(),
    async (req, res) => {
        try {
            const files =
                getFiles(req);

            if (
                files.length ===
                0
            ) {
                return res
                    .status(400)
                    .json({
                        success:
                            false,
                        message:
                            "Please select at least one background image or video.",
                    });
            }

            const collection =
                getBackgroundCollection();

            let startOrder =
                Number(
                    req.body.order
                );

            if (
                !Number.isFinite(
                    startOrder
                )
            ) {
                startOrder =
                    await collection.countDocuments();
            }

            const title =
                String(
                    req.body.title ||
                        "Home Background"
                ).trim();

            const documents =
                files.map(
                    (
                        file,
                        index
                    ) => {
                        const type =
                            file.mimetype.startsWith(
                                "video/"
                            )
                                ? "video"
                                : "image";

                        return {
                            title:
                                title ||
                                file.originalname,

                            type,

                            url:
                                normalizeUploadUrl(
                                    file
                                ),

                            originalName:
                                file.originalname,

                            mimeType:
                                file.mimetype,

                            order:
                                startOrder +
                                index,

                            createdAt:
                                new Date(),

                            updatedAt:
                                new Date(),
                        };
                    }
                );

            const result =
                await collection.insertMany(
                    documents
                );

            notifyClients(
                "home-background-updated"
            );

            res.status(201).json({
                success: true,

                message:
                    `${files.length} background media file(s) uploaded successfully.`,

                data:
                    documents,

                insertedCount:
                    result.insertedCount,
            });
        } catch (error) {
            console.error(
                "Background POST error:",
                error
            );

            removeUploadedFiles(
                req.files
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to upload background media",
                error:
                    error.message,
            });
        }
    }
);

/* UPDATE BACKGROUND */

app.put(
    "/api/home-background/:id",
    async (req, res) => {
        try {
            if (
                !isValidObjectId(
                    req.params.id
                )
            ) {
                return res
                    .status(400)
                    .json({
                        success:
                            false,
                        message:
                            "Invalid background media ID",
                    });
            }

            const collection =
                getBackgroundCollection();

            const id =
                new mongoose.Types.ObjectId(
                    req.params.id
                );

            const update = {
                updatedAt:
                    new Date(),
            };

            if (
                req.body.title !==
                undefined
            ) {
                update.title =
                    String(
                        req.body.title
                    );
            }

            if (
                req.body.order !==
                undefined
            ) {
                const order =
                    Number(
                        req.body.order
                    );

                update.order =
                    Number.isFinite(
                        order
                    )
                        ? order
                        : 0;
            }

            const result =
                await collection.updateOne(
                    {
                        _id: id,
                    },
                    {
                        $set:
                            update,
                    }
                );

            if (
                result.matchedCount ===
                0
            ) {
                return res
                    .status(404)
                    .json({
                        success:
                            false,
                        message:
                            "Background media not found",
                    });
            }

            const updated =
                await collection.findOne(
                    {
                        _id: id,
                    }
                );

            notifyClients(
                "home-background-updated"
            );

            res.json({
                success: true,
                message:
                    "Background media updated successfully",
                data: updated,
            });
        } catch (error) {
            console.error(
                "Background PUT error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to update background media",
                error:
                    error.message,
            });
        }
    }
);

/* DELETE BACKGROUND */

app.delete(
    "/api/home-background/:id",
    async (req, res) => {
        try {
            if (
                !isValidObjectId(
                    req.params.id
                )
            ) {
                return res
                    .status(400)
                    .json({
                        success:
                            false,
                        message:
                            "Invalid background media ID",
                    });
            }

            const collection =
                getBackgroundCollection();

            const id =
                new mongoose.Types.ObjectId(
                    req.params.id
                );

            const item =
                await collection.findOne(
                    {
                        _id: id,
                    }
                );

            if (!item) {
                return res
                    .status(404)
                    .json({
                        success:
                            false,
                        message:
                            "Background media not found",
                    });
            }

            await collection.deleteOne(
                {
                    _id: id,
                }
            );

            deleteUploadedFile(
                item.url
            );

            notifyClients(
                "home-background-updated"
            );

            res.json({
                success: true,
                message:
                    "Background media deleted successfully",
            });
        } catch (error) {
            console.error(
                "Background DELETE error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to delete background media",
                error:
                    error.message,
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
                await Event.find()
                    .sort({
                        order: 1,
                        createdAt: 1,
                    });

            res.setHeader(
                "Cache-Control",
                "no-store"
            );

            res.json(events);
        } catch (error) {
            console.error(
                "Events GET error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to load events",
                error:
                    error.message,
            });
        }
    }
);

/* ADD EVENT */

app.post(
    "/api/events",
    async (req, res) => {
        try {
            const event =
                await Event.create({
                    category:
                        req.body.category ||
                        "Morning",

                    day:
                        req.body.day ||
                        "Sunday",

                    service:
                        req.body.service ||
                        "Worship Service",

                    time:
                        req.body.time ||
                        "10:30 AM",

                    order:
                        Number(
                            req.body.order
                        ) || 0,
                });

            notifyClients(
                "events-updated"
            );

            res.status(201).json({
                success: true,
                message:
                    "Event added successfully",
                data: event,
            });
        } catch (error) {
            console.error(
                "Event POST error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to add event",
                error:
                    error.message,
            });
        }
    }
);

/* UPDATE EVENT */

app.put(
    "/api/events/:id",
    async (req, res) => {
        try {
            if (
                !isValidObjectId(
                    req.params.id
                )
            ) {
                return res
                    .status(400)
                    .json({
                        success:
                            false,
                        message:
                            "Invalid event ID",
                    });
            }

            const update = {};

            const fields = [
                "category",
                "day",
                "service",
                "time",
            ];

            for (
                const field of fields
            ) {
                if (
                    req.body[field] !==
                    undefined
                ) {
                    update[field] =
                        req.body[field];
                }
            }

            if (
                req.body.order !==
                undefined
            ) {
                update.order =
                    Number(
                        req.body.order
                    ) || 0;
            }

            const event =
                await Event.findByIdAndUpdate(
                    req.params.id,
                    update,
                    {
                        new: true,
                        runValidators:
                            true,
                    }
                );

            if (!event) {
                return res
                    .status(404)
                    .json({
                        success:
                            false,
                        message:
                            "Event not found",
                    });
            }

            notifyClients(
                "events-updated"
            );

            res.json({
                success: true,
                message:
                    "Event updated successfully",
                data: event,
            });
        } catch (error) {
            console.error(
                "Event PUT error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to update event",
                error:
                    error.message,
            });
        }
    }
);

/* DELETE EVENT */

app.delete(
    "/api/events/:id",
    async (req, res) => {
        try {
            if (
                !isValidObjectId(
                    req.params.id
                )
            ) {
                return res
                    .status(400)
                    .json({
                        success:
                            false,
                        message:
                            "Invalid event ID",
                    });
            }

            const event =
                await Event.findByIdAndDelete(
                    req.params.id
                );

            if (!event) {
                return res
                    .status(404)
                    .json({
                        success:
                            false,
                        message:
                            "Event not found",
                    });
            }

            /*
               If an older Event document has an
               uploaded image, remove it.
            */

            if (
                event.image
            ) {
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
                    "Event deleted successfully",
            });
        } catch (error) {
            console.error(
                "Event DELETE error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to delete event",
                error:
                    error.message,
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
                await SpecialEvent.find()
                    .sort({
                        order: 1,
                        createdAt: 1,
                    });

            res.setHeader(
                "Cache-Control",
                "no-store"
            );

            res.json(events);
        } catch (error) {
            console.error(
                "Special events GET error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to load special events",
                error:
                    error.message,
            });
        }
    }
);

/* ADD SPECIAL EVENT */

app.post(
    "/api/special-events",
    upload.any(),
    async (req, res) => {
        try {
            const imageFile =
                getFileByFields(
                    req,
                    [
                        "image",
                        "eventImage",
                        "specialImage",
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
                        ) || 0,
                });

            notifyClients(
                "special-events-updated"
            );

            res.status(201).json({
                success: true,
                message:
                    "Special event added successfully",
                data: event,
            });
        } catch (error) {
            console.error(
                "Special event POST error:",
                error
            );

            removeUploadedFiles(
                req.files
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to add special event",
                error:
                    error.message,
            });
        }
    }
);

/* UPDATE SPECIAL EVENT */

app.put(
    "/api/special-events/:id",
    upload.any(),
    async (req, res) => {
        try {
            if (
                !isValidObjectId(
                    req.params.id
                )
            ) {
                removeUploadedFiles(
                    req.files
                );

                return res
                    .status(400)
                    .json({
                        success:
                            false,
                        message:
                            "Invalid special event ID",
                    });
            }

            const event =
                await SpecialEvent.findById(
                    req.params.id
                );

            if (!event) {
                removeUploadedFiles(
                    req.files
                );

                return res
                    .status(404)
                    .json({
                        success:
                            false,
                        message:
                            "Special event not found",
                    });
            }

            if (
                req.body.title !==
                undefined
            ) {
                event.title =
                    req.body.title;
            }

            if (
                req.body.date !==
                undefined
            ) {
                event.date =
                    req.body.date;
            }

            if (
                req.body.time !==
                undefined
            ) {
                event.time =
                    req.body.time;
            }

            if (
                req.body.link !==
                undefined
            ) {
                event.link =
                    req.body.link;
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
                        "specialImage",
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
                data: event,
            });
        } catch (error) {
            console.error(
                "Special event PUT error:",
                error
            );

            removeUploadedFiles(
                req.files
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to update special event",
                error:
                    error.message,
            });
        }
    }
);

/* DELETE SPECIAL EVENT */

app.delete(
    "/api/special-events/:id",
    async (req, res) => {
        try {
            if (
                !isValidObjectId(
                    req.params.id
                )
            ) {
                return res
                    .status(400)
                    .json({
                        success:
                            false,
                        message:
                            "Invalid special event ID",
                    });
            }

            const event =
                await SpecialEvent.findByIdAndDelete(
                    req.params.id
                );

            if (!event) {
                return res
                    .status(404)
                    .json({
                        success:
                            false,
                        message:
                            "Special event not found",
                    });
            }

            if (
                event.image
            ) {
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
                    "Special event deleted successfully",
            });
        } catch (error) {
            console.error(
                "Special event DELETE error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to delete special event",
                error:
                    error.message,
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
                        badge:
                            "Featured Message",

                        title:
                            "Time Is Running Out",

                        subtitle:
                            "Bible Conference 2026",

                        backgroundImage:
                            "",

                        watchLink:
                            "#",

                        sermonsLink:
                            "#",
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
                    "Failed to load featured section",
                error:
                    error.message,
            });
        }
    }
);

app.put(
    "/api/featured",
    upload.any(),
    async (req, res) => {
        try {
            let featured =
                await Featured.findOne();

            if (!featured) {
                featured =
                    new Featured();
            }

            const fields = [
                "badge",
                "title",
                "subtitle",
                "watchLink",
                "sermonsLink",
            ];

            for (
                const field of fields
            ) {
                if (
                    req.body[field] !==
                    undefined
                ) {
                    featured[field] =
                        req.body[field];
                }
            }

            const backgroundFile =
                getFileByFields(
                    req,
                    [
                        "backgroundImage",
                        "featuredBackground",
                        "featuredBackgroundImage",
                    ]
                );

            if (
                backgroundFile
            ) {
                const oldImage =
                    featured.backgroundImage;

                featured.backgroundImage =
                    normalizeUploadUrl(
                        backgroundFile
                    );

                await featured.save();

                if (
                    oldImage &&
                    oldImage !==
                        featured.backgroundImage
                ) {
                    deleteUploadedFile(
                        oldImage
                    );
                }
            } else {
                /*
                   Support URL entered in the admin.
                */

                const backgroundUrl =
                    req.body.backgroundImageUrl ||
                    req.body.backgroundUrl ||
                    (
                        typeof req.body
                            .backgroundImage ===
                        "string"
                            ? req.body
                                  .backgroundImage
                            : ""
                    );

                if (
                    String(
                        backgroundUrl ||
                            ""
                    ).trim()
                ) {
                    /*
                       If replacing a local image
                       with an external URL,
                       delete the old local file.
                    */

                    const oldImage =
                        featured.backgroundImage;

                    featured.backgroundImage =
                        String(
                            backgroundUrl
                        ).trim();

                    await featured.save();

                    if (
                        oldImage &&
                        oldImage !==
                            featured.backgroundImage
                    ) {
                        deleteUploadedFile(
                            oldImage
                        );
                    }
                } else {
                    await featured.save();
                }
            }

            notifyClients(
                "featured-updated"
            );

            res.json({
                success: true,
                message:
                    "Featured section updated successfully",
                data: featured,
            });
        } catch (error) {
            console.error(
                "Featured PUT error:",
                error
            );

            removeUploadedFiles(
                req.files
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to update featured section",
                error:
                    error.message,
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
                        badge:
                            "A Message From Leadership",

                        title:
                            "Welcome To Church",

                        paragraph1:
                            "Thank you for visiting us online.",

                        paragraph2:
                            "We invite you to join us at any of our weekly services.",

                        leaderName:
                            "Leadership Team",

                        newHereText:
                            "New Here?",

                        newHereLink:
                            "#",

                        contactText:
                            "Contact Us",

                        contactLink:
                            "#",

                        image: "",
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
                    "Failed to load welcome section",
                error:
                    error.message,
            });
        }
    }
);

app.put(
    "/api/welcome",
    upload.any(),
    async (req, res) => {
        try {
            let welcome =
                await Welcome.findOne();

            if (!welcome) {
                welcome =
                    new Welcome();
            }

            const fields = [
                "badge",
                "title",
                "paragraph1",
                "paragraph2",
                "leaderName",
                "newHereText",
                "newHereLink",
                "contactText",
                "contactLink",
            ];

            for (
                const field of fields
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
                        "welcomeImage",
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
                    "Welcome section updated successfully",
                data: welcome,
            });
        } catch (error) {
            console.error(
                "Welcome PUT error:",
                error
            );

            removeUploadedFiles(
                req.files
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to update welcome section",
                error:
                    error.message,
            });
        }
    }
);

/* =========================================================
   EXPLORE
   UNLIMITED ITEMS
========================================================= */

/*
   IMPORTANT:

   There is NO 3-item limit here.

   You can add:
       1
       2
       3
       4
       5
       6
       ...
       unlimited

   The server automatically assigns order.

   This also fixes the problem where Explore was
   effectively treated as only 3 default cards.
*/

async function normalizeExploreOrders() {
    const items =
        await Explore.find()
            .sort({
                order: 1,
                createdAt: 1,
            });

    for (
        let i = 0;
        i < items.length;
        i++
    ) {
        if (
            items[i].order !== i
        ) {
            await Explore.updateOne(
                {
                    _id:
                        items[i]._id,
                },
                {
                    $set: {
                        order: i,
                    },
                }
            );
        }
    }

    return items;
}

/* GET */

app.get(
    "/api/explore",
    async (req, res) => {
        try {
            const items =
                await Explore.find()
                    .sort({
                        order: 1,
                        createdAt: 1,
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
                    "Failed to load explore items",
                error:
                    error.message,
            });
        }
    }
);

/* ADD */

app.post(
    "/api/explore",
    async (req, res) => {
        try {
            const count =
                await Explore.countDocuments();

            /*
               Always append at the end.

               We intentionally do not require
               the admin to choose Display Order.
            */

            const item =
                await Explore.create({
                    title:
                        String(
                            req.body.title ||
                                ""
                        ).trim(),

                    description:
                        String(
                            req.body.description ||
                                ""
                        ).trim(),

                    buttonText:
                        String(
                            req.body.buttonText ||
                                "Learn More"
                        ).trim(),

                    buttonLink:
                        String(
                            req.body.buttonLink ||
                                "#"
                        ).trim(),

                    order: count,
                });

            await normalizeExploreOrders();

            const saved =
                await Explore.findById(
                    item._id
                );

            notifyClients(
                "explore-updated"
            );

            res.status(201).json({
                success: true,
                message:
                    "Explore item added successfully",
                data: saved,
            });
        } catch (error) {
            console.error(
                "Explore POST error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to add explore item",
                error:
                    error.message,
            });
        }
    }
);

/* UPDATE */

app.put(
    "/api/explore/:id",
    async (req, res) => {
        try {
            if (
                !isValidObjectId(
                    req.params.id
                )
            ) {
                return res
                    .status(400)
                    .json({
                        success:
                            false,
                        message:
                            "Invalid explore item ID",
                    });
            }

            const update = {};

            if (
                req.body.title !==
                undefined
            ) {
                update.title =
                    String(
                        req.body.title
                    ).trim();
            }

            if (
                req.body.description !==
                undefined
            ) {
                update.description =
                    String(
                        req.body.description
                    ).trim();
            }

            if (
                req.body.buttonText !==
                undefined
            ) {
                update.buttonText =
                    String(
                        req.body.buttonText
                    ).trim();
            }

            if (
                req.body.buttonLink !==
                undefined
            ) {
                update.buttonLink =
                    String(
                        req.body.buttonLink
                    ).trim();
            }

            /*
               Do NOT allow the browser to break
               the automatic ordering.
            */

            const item =
                await Explore.findByIdAndUpdate(
                    req.params.id,
                    update,
                    {
                        new: true,
                        runValidators:
                            true,
                    }
                );

            if (!item) {
                return res
                    .status(404)
                    .json({
                        success:
                            false,
                        message:
                            "Explore item not found",
                    });
            }

            await normalizeExploreOrders();

            const saved =
                await Explore.findById(
                    item._id
                );

            notifyClients(
                "explore-updated"
            );

            res.json({
                success: true,
                message:
                    "Explore item updated successfully",
                data: saved,
            });
        } catch (error) {
            console.error(
                "Explore PUT error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to update explore item",
                error:
                    error.message,
            });
        }
    }
);

/* DELETE */

app.delete(
    "/api/explore/:id",
    async (req, res) => {
        try {
            if (
                !isValidObjectId(
                    req.params.id
                )
            ) {
                return res
                    .status(400)
                    .json({
                        success:
                            false,
                        message:
                            "Invalid explore item ID",
                    });
            }

            const item =
                await Explore.findByIdAndDelete(
                    req.params.id
                );

            if (!item) {
                return res
                    .status(404)
                    .json({
                        success:
                            false,
                        message:
                            "Explore item not found",
                    });
            }

            /*
               Automatically close the gap.

               Example:

               0
               1
               2
               3

               Delete item 1

               becomes:

               0
               1
               2
            */

            await normalizeExploreOrders();

            notifyClients(
                "explore-updated"
            );

            res.json({
                success: true,
                message:
                    "Explore item deleted successfully",
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
                    error.message,
            });
        }
    }
);

/* =========================================================
   CALENDAR
========================================================= */

/*
   MongoDB collection:

       calendar_settings

   Document:

       {
           _id: "main",
           label: "Church Calendar",
           url: "/uploads/calendar/....pdf"
       }

   The admin can send:

       url
       calendarUrl
       label
       title
       calendarTitle

   and a file using ANY field name.

   This prevents the previous:

       Cannot PUT /api/calendar

   and:

       Unexpected field

   problems.
*/

function getCalendarCollection() {
    if (
        !mongoose.connection.db
    ) {
        throw new Error(
            "MongoDB is not connected"
        );
    }

    return mongoose.connection.db.collection(
        "calendar_settings"
    );
}

/* GET CALENDAR */

app.get(
    "/api/calendar",
    async (req, res) => {
        try {
            const collection =
                getCalendarCollection();

            const calendar =
                await collection.findOne(
                    {
                        _id: "main",
                    }
                );

            res.setHeader(
                "Cache-Control",
                "no-store"
            );

            res.json({
                success: true,

                label:
                    calendar?.label ||
                    "Church Calendar",

                url:
                    calendar?.url ||
                    "",
            });
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
                    error.message,
            });
        }
    }
);

/* SAVE / UPDATE CALENDAR */

app.put(
    "/api/calendar",
    upload.any(),
    async (req, res) => {
        let newFile = null;

        try {
            const collection =
                getCalendarCollection();

            const current =
                await collection.findOne(
                    {
                        _id: "main",
                    }
                );

            /*
               Accept all common URL field names.
            */

            let url;

            if (
                req.body.url !==
                undefined
            ) {
                url =
                    String(
                        req.body.url ||
                            ""
                    ).trim();
            } else if (
                req.body.calendarUrl !==
                undefined
            ) {
                url =
                    String(
                        req.body.calendarUrl ||
                            ""
                    ).trim();
            } else {
                url =
                    current?.url ||
                    "";
            }

            /*
               Accept all common title field names.
            */

            const label =
                String(
                    req.body.label ||
                        req.body.title ||
                        req.body.calendarTitle ||
                        current?.label ||
                        "Church Calendar"
                ).trim() ||
                "Church Calendar";

            /*
               Find uploaded calendar file.

               It can be:
                   file
                   calendarFile
                   calendar
                   image
                   calendarImage
                   upload
               or any other multipart field.
            */

            newFile =
                getFileByFields(
                    req,
                    [
                        "file",
                        "calendarFile",
                        "calendar",
                        "image",
                        "calendarImage",
                        "upload",
                    ]
                );

            if (
                !newFile &&
                getFiles(req).length
            ) {
                newFile =
                    getFirstFile(req);
            }

            /*
               If a file was uploaded, it wins
               over the URL.
            */

            if (newFile) {
                url =
                    normalizeUploadUrl(
                        newFile
                    );
            }

            /*
               Do not save an empty calendar.
            */

            if (
                !url &&
                !current?.url
            ) {
                removeUploadedFiles(
                    req.files
                );

                return res
                    .status(400)
                    .json({
                        success:
                            false,
                        message:
                            "Please enter a calendar URL or upload a calendar file.",
                    });
            }

            /*
               If URL is empty but there was
               an existing calendar, keep it.
            */

            if (
                !url &&
                current?.url
            ) {
                url =
                    current.url;
            }

            /*
               Save first.

               Only after MongoDB succeeds do we
               remove the old local file.
            */

            const now =
                new Date();

            await collection.updateOne(
                {
                    _id: "main",
                },
                {
                    $set: {
                        label,
                        url,
                        updatedAt:
                            now,
                    },

                    $setOnInsert: {
                        createdAt:
                            now,
                    },
                },
                {
                    upsert: true,
                }
            );

            /*
               Delete old local calendar file
               only after successful database update.
            */

            if (
                current?.url &&
                current.url !==
                    url &&
                current.url.startsWith(
                    "/uploads/"
                )
            ) {
                deleteUploadedFile(
                    current.url
                );
            }

            notifyClients(
                "calendar-updated"
            );

            res.json({
                success: true,

                message:
                    "Calendar updated successfully",

                data: {
                    label,
                    url,
                },
            });
        } catch (error) {
            console.error(
                "Calendar PUT error:",
                error
            );

            /*
               If MongoDB failed after a new file
               was uploaded, remove that new file.
            */

            removeUploadedFiles(
                req.files
            );

            res.status(500).json({
                success: false,

                message:
                    "Failed to update calendar",

                error:
                    error.message,
            });
        }
    }
);

/* DELETE CALENDAR */

app.delete(
    "/api/calendar",
    async (req, res) => {
        try {
            const collection =
                getCalendarCollection();

            const current =
                await collection.findOne(
                    {
                        _id: "main",
                    }
                );

            if (
                current?.url &&
                current.url.startsWith(
                    "/uploads/"
                )
            ) {
                deleteUploadedFile(
                    current.url
                );
            }

            await collection.deleteOne(
                {
                    _id: "main",
                }
            );

            notifyClients(
                "calendar-updated"
            );

            res.json({
                success: true,
                message:
                    "Calendar removed successfully",
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
                    error.message,
            });
        }
    }
);

/* =========================================================
   OPTIONAL ALIAS
   Some older admin versions may use:

       /api/content/calendar

   Keep this alias so old admin code can also work.
========================================================= */

app.put(
    "/api/content/calendar",
    upload.any(),
    async (req, res) => {
        try {
            const collection =
                getCalendarCollection();

            const current =
                await collection.findOne(
                    {
                        _id: "main",
                    }
                );

            let url =
                req.body.url !==
                undefined
                    ? String(
                          req.body.url ||
                              ""
                      ).trim()
                    : current?.url ||
                      "";

            const label =
                String(
                    req.body.label ||
                        req.body.title ||
                        "Church Calendar"
                ).trim() ||
                "Church Calendar";

            const file =
                getFirstFile(req);

            if (file) {
                url =
                    normalizeUploadUrl(
                        file
                    );
            }

            if (!url) {
                removeUploadedFiles(
                    req.files
                );

                return res
                    .status(400)
                    .json({
                        success:
                            false,
                        message:
                            "Please provide a calendar URL or upload a file.",
                    });
            }

            await collection.updateOne(
                {
                    _id: "main",
                },
                {
                    $set: {
                        label,
                        url,
                        updatedAt:
                            new Date(),
                    },
                    $setOnInsert: {
                        createdAt:
                            new Date(),
                    },
                },
                {
                    upsert: true,
                }
            );

            if (
                current?.url &&
                current.url !==
                    url &&
                current.url.startsWith(
                    "/uploads/"
                )
            ) {
                deleteUploadedFile(
                    current.url
                );
            }

            notifyClients(
                "calendar-updated"
            );

            res.json({
                success: true,
                message:
                    "Calendar updated successfully",
                data: {
                    label,
                    url,
                },
            });
        } catch (error) {
            console.error(
                "Old calendar alias error:",
                error
            );

            removeUploadedFiles(
                req.files
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to update calendar",
                error:
                    error.message,
            });
        }
    }
);

/* =========================================================
   DATABASE SEED
========================================================= */

async function seedDatabase() {
    try {
        /*
           HOME
        */

        const homeExists =
            await Home.findOne();

        if (!homeExists) {
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

                logo: "",
            });

            console.log(
                "Default Home data created."
            );
        }

        /*
           EVENTS

           Only create defaults when the collection
           is completely empty.

           Existing admin data is NEVER overwritten.
        */

        const eventCount =
            await Event.countDocuments();

        if (
            eventCount === 0
        ) {
            await Event.insertMany([
                {
                    category:
                        "Morning",

                    day:
                        "Sunday",

                    service:
                        "Worship Service",

                    time:
                        "10:30 AM",

                    order: 0,
                },

                {
                    category:
                        "Evening",

                    day:
                        "Sunday",

                    service:
                        "Revival Service",

                    time:
                        "6:00 PM",

                    order: 1,
                },

                {
                    category:
                        "Midweek",

                    day:
                        "Wednesday",

                    service:
                        "Gospel Service",

                    time:
                        "7:30 PM",

                    order: 2,
                },
            ]);

            console.log(
                "Default Events created."
            );
        }

        /*
           SPECIAL EVENTS
        */

        const specialCount =
            await SpecialEvent.countDocuments();

        if (
            specialCount === 0
        ) {
            await SpecialEvent.insertMany([
                {
                    title:
                        "Men's Discipleship",

                    date:
                        "August 24",

                    time:
                        "7:30 PM",

                    link: "#",

                    image: "",

                    order: 0,
                },

                {
                    title:
                        "Youth Rally & Concert",

                    date:
                        "September 12",

                    time:
                        "6:30 PM",

                    link: "#",

                    image: "",

                    order: 1,
                },
            ]);

            console.log(
                "Default Special Events created."
            );
        }

        /*
           FEATURED
        */

        const featuredExists =
            await Featured.findOne();

        if (
            !featuredExists
        ) {
            await Featured.create({
                badge:
                    "Featured Message",

                title:
                    "Time Is Running Out",

                subtitle:
                    "Bible Conference 2026",

                backgroundImage:
                    "",

                watchLink:
                    "#",

                sermonsLink:
                    "#",
            });

            console.log(
                "Default Featured data created."
            );
        }

        /*
           WELCOME
        */

        const welcomeExists =
            await Welcome.findOne();

        if (
            !welcomeExists
        ) {
            await Welcome.create({
                badge:
                    "A Message From Leadership",

                title:
                    "Welcome To Church",

                paragraph1:
                    "Thank you for visiting us online. We invite you to join us and be part of what God is doing in our community.",

                paragraph2:
                    "Whether you are seeking a spiritual home or just visiting, we welcome you to one of our weekly services.",

                leaderName:
                    "Leadership Team",

                newHereText:
                    "New Here?",

                newHereLink:
                    "#",

                contactText:
                    "Contact Us",

                contactLink:
                    "#",

                image: "",
            });

            console.log(
                "Default Welcome data created."
            );
        }

        /*
           EXPLORE

           IMPORTANT:
           Only seed the three defaults if there
           are ZERO Explore records.

           Once the admin adds a fourth, fifth,
           sixth, etc., they remain.
        */

        const exploreCount =
            await Explore.countDocuments();

        if (
            exploreCount === 0
        ) {
            await Explore.insertMany([
                {
                    title:
                        "Staff",

                    description:
                        "Learn about our pastors, leaders, and history.",

                    buttonText:
                        "Meet Staff",

                    buttonLink:
                        "#",

                    order: 0,
                },

                {
                    title:
                        "Mission & Vision",

                    description:
                        "Reaching local communities and foreign mission fields.",

                    buttonText:
                        "Our Mission",

                    buttonLink:
                        "#",

                    order: 1,
                },

                {
                    title:
                        "About Us",

                    description:
                        "Part of a worldwide fellowship of over 2,800 churches.",

                    buttonText:
                        "Learn More",

                    buttonLink:
                        "#",

                    order: 2,
                },
            ]);

            console.log(
                "Default Explore items created."
            );
        }

        /*
           CALENDAR COLLECTION

           We don't create fake calendar data.
        */

        const calendarCollection =
            getCalendarCollection();

        const calendarExists =
            await calendarCollection.findOne(
                {
                    _id: "main",
                }
            );

        if (!calendarExists) {
            console.log(
                "Calendar collection ready."
            );
        }

        /*
           BACKGROUND COLLECTION
        */

        const backgroundCollection =
            getBackgroundCollection();

        const backgroundCount =
            await backgroundCollection.countDocuments();

        console.log(
            `Home background media: ${backgroundCount}`
        );

        /*
           NORMALIZE EXPLORE ORDERS
        */

        await normalizeExploreOrders();

        console.log(
            "Database initialization complete."
        );
    } catch (error) {
        console.error(
            "Database seed error:",
            error
        );
    }
}

/* =========================================================
   API 404 HANDLER

   IMPORTANT:

   DO NOT use:

       app.get("*", ...)

   Express 5 / path-to-regexp can throw:

       PathError
       Missing parameter name

   So this backend intentionally does not use wildcard
   route patterns.
========================================================= */

app.use(
    (req, res, next) => {
        if (
            req.path.startsWith(
                "/api/"
            )
        ) {
            return res
                .status(404)
                .json({
                    success:
                        false,
                    message:
                        `API endpoint not found: ${req.method} ${req.path}`,
                });
        }

        next();
    }
);

/* =========================================================
   PAGE ROUTES
========================================================= */

app.get(
    "/",
    (req, res) => {
        res.sendFile(
            path.join(
                __dirname,
                "public",
                "index.html"
            )
        );
    }
);

app.get(
    "/admin",
    (req, res) => {
        res.sendFile(
            path.join(
                __dirname,
                "public",
                "admin.html"
            )
        );
    }
);

/* =========================================================
   GENERAL 404
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

   IMPORTANT:

   Always return JSON for API errors.

   This prevents admin.html from receiving an HTML page
   such as:

       <!DOCTYPE html>
       <html>
       ...

   when it expects JSON.

   This was one of the reasons you were seeing:

       Server returned an invalid response
========================================================= */

app.use(
    (
        error,
        req,
        res,
        next
    ) => {
        console.error(
            "SERVER ERROR:",
            error
        );

        if (
            error instanceof
            multer.MulterError
        ) {
            return res
                .status(400)
                .json({
                    success:
                        false,

                    message:
                        "Upload error: " +
                        error.message,

                    code:
                        error.code ||
                        "MULTER_ERROR",
                });
        }

        const status =
            Number(
                error.status ||
                    error.statusCode
            ) || 500;

        res.status(
            status
        ).json({
            success:
                false,

            message:
                error.message ||
                "Internal server error",

            error:
                error.message ||
                "Internal server error",
        });
    }
);

/* =========================================================
   START SERVER
========================================================= */

async function startServer() {
    try {
        console.log("");
        console.log(
            "========================================"
        );
        console.log(
            "THE POTTER'S HOUSE CHURCH SERVER"
        );
        console.log(
            "========================================"
        );

        console.log(
            "Connecting to MongoDB..."
        );

        await mongoose.connect(
            MONGO_URI
        );

        console.log(
            "MongoDB connected successfully."
        );

        console.log(
            "Database:",
            mongoose.connection.name
        );

        await seedDatabase();

        app.listen(
            PORT,
            () => {
                console.log("");
                console.log(
                    "========================================"
                );

                console.log(
                    `Server running on port ${PORT}`
                );

                console.log(
                    `Website: http://localhost:${PORT}`
                );

                console.log(
                    `Admin:   http://localhost:${PORT}/admin`
                );

                console.log(
                    `Health:  http://localhost:${PORT}/api/health`
                );

                console.log(
                    "========================================"
                );

                console.log("");
            }
        );
    } catch (error) {
        console.error("");
        console.error(
            "========================================"
        );
        console.error(
            "SERVER START FAILED"
        );
        console.error(
            "========================================"
        );
        console.error(
            error
        );
        console.error("");
        console.error(
            "Check that MongoDB is running."
        );
        console.error("");

        process.exit(
            1
        );
    }
}

/* =========================================================
   GRACEFUL SHUTDOWN
========================================================= */

async function shutdown(
    signal
) {
    console.log(
        `\n${signal} received. Shutting down...`
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

    try {
        await mongoose.connection.close();

        console.log(
            "MongoDB connection closed."
        );
    } catch (
        error
    ) {
        console.error(
            "MongoDB close error:",
            error
        );
    }

    process.exit(
        0
    );
}

process.on(
    "SIGINT",
    () =>
        shutdown("SIGINT")
);

process.on(
    "SIGTERM",
    () =>
        shutdown("SIGTERM")
);

/* =========================================================
   START
========================================================= */

startServer();