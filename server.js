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
   APP
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
    "uploads/calendar"
];

for (const folder of uploadFolders) {
    fs.mkdirSync(
        path.join(__dirname, folder),
        {
            recursive: true
        }
    );
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

app.use(
    express.json({
        limit: "20mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "20mb"
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
            maxAge: "1h"
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
            "MongoDB connected successfully."
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
            "MongoDB disconnected."
        );
    }
);

/* =========================================================
   UPLOAD FOLDER
========================================================= */

function getUploadFolder(req) {

    const route = String(
        req.path || ""
    ).toLowerCase();

    if (
        route.startsWith(
            "/api/featured"
        )
    ) {
        return "uploads/featured";
    }

    if (
        route.startsWith(
            "/api/welcome"
        )
    ) {
        return "uploads/welcome";
    }

    if (
        route.startsWith(
            "/api/special-events"
        )
    ) {
        return "uploads/special-events";
    }

    if (
        route.startsWith(
            "/api/events"
        )
    ) {
        return "uploads/events";
    }

    if (
        route.startsWith(
            "/api/calendar"
        ) ||
        route.startsWith(
            "/api/content/calendar"
        )
    ) {
        return "uploads/calendar";
    }

    if (
        route.startsWith(
            "/api/home-background"
        )
    ) {
        return "uploads/background";
    }

    if (
        route.startsWith(
            "/api/home"
        )
    ) {
        return "uploads/home";
    }

    const section = String(
        req.body?.section || ""
    ).toLowerCase();

    if (
        section === "featured"
    ) {
        return "uploads/featured";
    }

    if (
        section === "welcome"
    ) {
        return "uploads/welcome";
    }

    if (
        section.includes(
            "special"
        )
    ) {
        return "uploads/special-events";
    }

    if (
        section === "events" ||
        section === "event"
    ) {
        return "uploads/events";
    }

    if (
        section.includes(
            "background"
        )
    ) {
        return "uploads/background";
    }

    if (
        section === "calendar"
    ) {
        return "uploads/calendar";
    }

    return "uploads";
}

/* =========================================================
   MULTER STORAGE
========================================================= */

const storage =
    multer.diskStorage({

        destination:
            function (
                req,
                file,
                cb
            ) {

                const folder =
                    getUploadFolder(
                        req
                    );

                cb(
                    null,
                    path.join(
                        __dirname,
                        folder
                    )
                );
            },

        filename:
            function (
                req,
                file,
                cb
            ) {

                const extension =
                    path.extname(
                        file.originalname ||
                        ""
                    ).toLowerCase();

                const filename =
                    Date.now() +
                    "-" +
                    Math.round(
                        Math.random() *
                        1000000000
                    ) +
                    extension;

                cb(
                    null,
                    filename
                );
            }
    });

/* =========================================================
   FILE TYPES
========================================================= */

const allowedExtensions =
    new Set([
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

const upload =
    multer({

        storage,

        limits: {
            fileSize:
                150 *
                1024 *
                1024,

            files: 50
        },

        fileFilter:
            function (
                req,
                file,
                cb
            ) {

                const extension =
                    path.extname(
                        file.originalname ||
                        ""
                    ).toLowerCase();

                const mime =
                    file.mimetype ||
                    "";

                const mimeAllowed =
                    mime.startsWith(
                        "image/"
                    ) ||
                    mime.startsWith(
                        "video/"
                    ) ||
                    mime ===
                        "application/pdf";

                if (
                    mimeAllowed ||
                    allowedExtensions.has(
                        extension
                    ) ||
                    mime ===
                        "application/octet-stream"
                ) {
                    return cb(
                        null,
                        true
                    );
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

    if (!req.files) {
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

    return (
        files.length
            ? files[0]
            : null
    );
}

function getFileByFields(
    req,
    names
) {

    const files =
        getFiles(req);

    for (
        const name of names
    ) {

        const found =
            files.find(
                file =>
                    file.fieldname ===
                    name
            );

        if (found) {
            return found;
        }
    }

    return (
        files[0] ||
        null
    );
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
            uploadsRoot +
            path.sep
        )
    ) {
        return;
    }

    if (
        fs.existsSync(
            fullPath
        )
    ) {

        try {

            fs.unlinkSync(
                fullPath
            );

        } catch (
            error
        ) {

            console.error(
                "File delete error:",
                error.message
            );
        }
    }
}

function removeNewFiles(
    req
) {

    const files =
        getFiles(req);

    for (
        const file of files
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

            } catch {}
        }
    }
}

function validObjectId(
    id
) {

    return mongoose.Types.ObjectId.isValid(
        id
    );
}

/* =========================================================
   SERVER SENT EVENTS
   FIXED
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
         * IMPORTANT:
         * No broken nested backticks here.
         */

        const connectedMessage =
            "data: " +
            JSON.stringify({
                type: "connected",
                timestamp:
                    Date.now()
            }) +
            "\n\n";

        res.write(
            connectedMessage
        );

        sseClients.push(
            res
        );

        req.on(
            "close",
            () => {

                sseClients =
                    sseClients.filter(
                        client =>
                            client !==
                            res
                    );
            }
        );
    }
);

/* =========================================================
   SSE HEARTBEAT
========================================================= */

const sseHeartbeat =
    setInterval(
        () => {

            sseClients =
                sseClients.filter(
                    client => {

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
                    }
                );

        },
        25000
    );

/* =========================================================
   NOTIFY CLIENTS
========================================================= */

function notifyClients(
    type
) {

    const message =
        "data: " +
        JSON.stringify({
            type:
                type ||
                "content-updated",

            timestamp:
                Date.now()
        }) +
        "\n\n";

    sseClients =
        sseClients.filter(
            client => {

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
   HEALTH
========================================================= */

app.get(
    "/api/health",
    (req, res) => {

        res.json({

            success: true,

            server:
                "running",

            mongodb:
                mongoose
                    .connection
                    .readyState ===
                1
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
    async (
        req,
        res
    ) => {

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

                        logo: ""
                    });
            }

            res.setHeader(
                "Cache-Control",
                "no-store"
            );

            res.json(
                home
            );

        } catch (
            error
        ) {

            console.error(
                "Home GET error:",
                error
            );

            res.status(
                500
            ).json({

                success:
                    false,

                message:
                    "Failed to load home data",

                error:
                    error.message
            });
        }
    }
);

/* =========================================================
   UPDATE HOME
========================================================= */

app.put(
    "/api/home",
    upload.any(),
    async (
        req,
        res
    ) => {

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
                "mapLink"
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
                oldLogo !==
                    home.logo
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

                data:
                    home
            });

        } catch (
            error
        ) {

            removeNewFiles(
                req
            );

            console.error(
                "Home PUT error:",
                error
            );

            res.status(
                500
            ).json({

                success:
                    false,

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

    if (
        !mongoose.connection.db
    ) {

        throw new Error(
            "MongoDB is not connected"
        );
    }

    return mongoose
        .connection
        .db
        .collection(
            "home_background_media"
        );
}

/* GET */

app.get(
    "/api/home-background",
    async (
        req,
        res
    ) => {

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

            res.json(
                items
            );

        } catch (
            error
        ) {

            res.status(
                500
            ).json({

                success:
                    false,

                message:
                    "Failed to load home background media",

                error:
                    error.message
            });
        }
    }
);

/* ADD */

app.post(
    "/api/home-background",
    upload.any(),
    async (
        req,
        res
    ) => {

        try {

            const files =
                getFiles(req);

            if (
                files.length ===
                0
            ) {

                return res
                    .status(
                        400
                    )
                    .json({

                        success:
                            false,

                        message:
                            "Please select at least one background image or video."
                    });
            }

            const collection =
                getBackgroundCollection();

            let order =
                Number(
                    req.body.order
                );

            if (
                !Number.isFinite(
                    order
                )
            ) {

                order =
                    await collection.countDocuments();
            }

            const documents =
                files.map(
                    (
                        file,
                        index
                    ) => {

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
                                String(
                                    req.body.title ||
                                    "Home Background"
                                ).trim(),

                            type:

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
                                order +
                                index,

                            createdAt:
                                new Date(),

                            updatedAt:
                                new Date()
                        };
                    }
                );

            await collection.insertMany(
                documents
            );

            notifyClients(
                "home-background-updated"
            );

            res.status(
                201
            ).json({

                success:
                    true,

                message:
                    `${documents.length} background media file(s) uploaded successfully.`,

                data:
                    documents
            });

        } catch (
            error
        ) {

            removeNewFiles(
                req
            );

            res.status(
                500
            ).json({

                success:
                    false,

                message:
                    "Failed to upload background media",

                error:
                    error.message
            });
        }
    }
);

/* UPDATE */

app.put(
    "/api/home-background/:id",
    async (
        req,
        res
    ) => {

        try {

            if (
                !validObjectId(
                    req.params.id
                )
            ) {

                return res
                    .status(
                        400
                    )
                    .json({

                        success:
                            false,

                        message:
                            "Invalid background media ID"
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
                    new Date()
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

                update.order =
                    Number(
                        req.body.order
                    ) || 0;
            }

            const result =
                await collection.updateOne(
                    {
                        _id:
                            id
                    },
                    {
                        $set:
                            update
                    }
                );

            if (
                result.matchedCount ===
                0
            ) {

                return res
                    .status(
                        404
                    )
                    .json({

                        success:
                            false,

                        message:
                            "Background media not found"
                    });
            }

            const updated =
                await collection.findOne(
                    {
                        _id:
                            id
                    }
                );

            notifyClients(
                "home-background-updated"
            );

            res.json({

                success:
                    true,

                message:
                    "Background media updated successfully",

                data:
                    updated
            });

        } catch (
            error
        ) {

            res.status(
                500
            ).json({

                success:
                    false,

                message:
                    "Failed to update background media",

                error:
                    error.message
            });
        }
    }
);

/* DELETE */

app.delete(
    "/api/home-background/:id",
    async (
        req,
        res
    ) => {

        try {

            if (
                !validObjectId(
                    req.params.id
                )
            ) {

                return res
                    .status(
                        400
                    )
                    .json({

                        success:
                            false,

                        message:
                            "Invalid background media ID"
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
                        _id:
                            id
                    }
                );

            if (!item) {

                return res
                    .status(
                        404
                    )
                    .json({

                        success:
                            false,

                        message:
                            "Background media not found"
                    });
            }

            await collection.deleteOne(
                {
                    _id:
                        id
                }
            );

            deleteUploadedFile(
                item.url
            );

            notifyClients(
                "home-background-updated"
            );

            res.json({

                success:
                    true,

                message:
                    "Background media deleted successfully"
            });

        } catch (
            error
        ) {

            res.status(
                500
            ).json({

                success:
                    false,

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
    async (
        req,
        res
    ) => {

        try {

            const events =
                await Event.find()
                    .sort({
                        order: 1,
                        createdAt: 1
                    });

            res.setHeader(
                "Cache-Control",
                "no-store"
            );

            res.json(
                events
            );

        } catch (
            error
        ) {

            res.status(
                500
            ).json({

                success:
                    false,

                message:
                    "Failed to load events",

                error:
                    error.message
            });
        }
    }
);

/* ADD EVENT */

app.post(
    "/api/events",
    upload.any(),
    async (
        req,
        res
    ) => {

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

            if (
                imageFile
            ) {

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

            res.status(
                201
            ).json({

                success:
                    true,

                message:
                    "Event added successfully",

                data:
                    event
            });

        } catch (
            error
        ) {

            removeNewFiles(
                req
            );

            res.status(
                500
            ).json({

                success:
                    false,

                message:
                    "Failed to add event",

                error:
                    error.message
            });
        }
    }
);

/* UPDATE EVENT */

app.put(
    "/api/events/:id",
    upload.any(),
    async (
        req,
        res
    ) => {

        try {

            if (
                !validObjectId(
                    req.params.id
                )
            ) {

                removeNewFiles(
                    req
                );

                return res
                    .status(
                        400
                    )
                    .json({

                        success:
                            false,

                        message:
                            "Invalid event ID"
                    });
            }

            const event =
                await Event.findById(
                    req.params.id
                );

            if (!event) {

                removeNewFiles(
                    req
                );

                return res
                    .status(
                        404
                    )
                    .json({

                        success:
                            false,

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

            if (
                imageFile
            ) {

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

                success:
                    true,

                message:
                    "Event updated successfully",

                data:
                    event
            });

        } catch (
            error
        ) {

            removeNewFiles(
                req
            );

            res.status(
                500
            ).json({

                success:
                    false,

                message:
                    "Failed to update event",

                error:
                    error.message
            });
        }
    }
);

/* DELETE EVENT */

app.delete(
    "/api/events/:id",
    async (
        req,
        res
    ) => {

        try {

            if (
                !validObjectId(
                    req.params.id
                )
            ) {

                return res
                    .status(
                        400
                    )
                    .json({

                        success:
                            false,

                        message:
                            "Invalid event ID"
                    });
            }

            const event =
                await Event.findByIdAndDelete(
                    req.params.id
                );

            if (!event) {

                return res
                    .status(
                        404
                    )
                    .json({

                        success:
                            false,

                        message:
                            "Event not found"
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
                "events-updated"
            );

            res.json({

                success:
                    true,

                message:
                    "Event deleted successfully"
            });

        } catch (
            error
        ) {

            res.status(
                500
            ).json({

                success:
                    false,

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
    async (
        req,
        res
    ) => {

        try {

            const events =
                await SpecialEvent.find()
                    .sort({
                        order: 1,
                        createdAt: 1
                    });

            res.setHeader(
                "Cache-Control",
                "no-store"
            );

            res.json(
                events
            );

        } catch (
            error
        ) {

            res.status(
                500
            ).json({

                success:
                    false,

                message:
                    "Failed to load special events",

                error:
                    error.message
            });
        }
    }
);

/* ADD SPECIAL EVENT */

app.post(
    "/api/special-events",
    upload.any(),
    async (
        req,
        res
    ) => {

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

            res.status(
                201
            ).json({

                success:
                    true,

                message:
                    "Special event added successfully",

                data:
                    event
            });

        } catch (
            error
        ) {

            removeNewFiles(
                req
            );

            res.status(
                500
            ).json({

                success:
                    false,

                message:
                    "Failed to add special event",

                error:
                    error.message
            });
        }
    }
);

/* UPDATE SPECIAL EVENT */

app.put(
    "/api/special-events/:id",
    upload.any(),
    async (
        req,
        res
    ) => {

        try {

            if (
                !validObjectId(
                    req.params.id
                )
            ) {

                removeNewFiles(
                    req
                );

                return res
                    .status(
                        400
                    )
                    .json({

                        success:
                            false,

                        message:
                            "Invalid special event ID"
                    });
            }

            const event =
                await SpecialEvent.findById(
                    req.params.id
                );

            if (!event) {

                removeNewFiles(
                    req
                );

                return res
                    .status(
                        404
                    )
                    .json({

                        success:
                            false,

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

            if (
                imageFile
            ) {

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

                success:
                    true,

                message:
                    "Special event updated successfully",

                data:
                    event
            });

        } catch (
            error
        ) {

            removeNewFiles(
                req
            );

            res.status(
                500
            ).json({

                success:
                    false,

                message:
                    "Failed to update special event",

                error:
                    error.message
            });
        }
    }
);

/* DELETE SPECIAL EVENT */

app.delete(
    "/api/special-events/:id",
    async (
        req,
        res
    ) => {

        try {

            if (
                !validObjectId(
                    req.params.id
                )
            ) {

                return res
                    .status(
                        400
                    )
                    .json({

                        success:
                            false,

                        message:
                            "Invalid special event ID"
                    });
            }

            const event =
                await SpecialEvent.findByIdAndDelete(
                    req.params.id
                );

            if (!event) {

                return res
                    .status(
                        404
                    )
                    .json({

                        success:
                            false,

                        message:
                            "Special event not found"
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

                success:
                    true,

                message:
                    "Special event deleted successfully"
            });

        } catch (
            error
        ) {

            res.status(
                500
            ).json({

                success:
                    false,

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
   =========================================================

   ADMIN CAN UPDATE:

   1. Badge
      Example:
      Featured Message

   2. Title
      Example:
      YOUTH47

   3. Subtitle
      Example:
      Bible Conference 2026

   4. Background Image

   5. Watch Now Link

   6. View All Sermons Link
========================================================= */

/* GET FEATURED */

app.get(
    "/api/featured",
    async (
        req,
        res
    ) => {

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
                            "#"
                    });
            }

            res.setHeader(
                "Cache-Control",
                "no-store"
            );

            res.json(
                featured
            );

        } catch (
            error
        ) {

            console.error(
                "Featured GET error:",
                error
            );

            res.status(
                500
            ).json({

                success:
                    false,

                message:
                    "Failed to load featured section",

                error:
                    error.message
            });
        }
    }
);

/* =========================================================
   UPDATE FEATURED
========================================================= */

app.put(
    "/api/featured",
    upload.any(),
    async (
        req,
        res
    ) => {

        try {

            let featured =
                await Featured.findOne();

            if (!featured) {

                featured =
                    new Featured();
            }

            /*
             * TEXT FIELDS
             */

            const textFields = [
                "badge",
                "title",
                "subtitle",
                "watchLink",
                "sermonsLink"
            ];

            for (
                const field of textFields
            ) {

                if (
                    req.body[field] !==
                    undefined
                ) {

                    featured[field] =
                        String(
                            req.body[field]
                        );
                }
            }

            /*
             * FEATURED BACKGROUND IMAGE
             *
             * Accept all of these:
             *
             * backgroundImage
             * backgroundImageFile
             * featuredBackground
             * featuredBackgroundImage
             * image
             * file
             */

            const backgroundFile =
                getFileByFields(
                    req,
                    [
                        "backgroundImage",
                        "backgroundImageFile",
                        "featuredBackground",
                        "featuredBackgroundImage",
                        "image",
                        "file"
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

                /*
                 * Delete old local image
                 */

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
                 * IMAGE URL SUPPORT
                 */

                let backgroundUrl;

                if (
                    req.body
                        .backgroundImageUrl !==
                    undefined
                ) {

                    backgroundUrl =
                        String(
                            req.body
                                .backgroundImageUrl ||
                            ""
                        ).trim();

                } else if (
                    req.body
                        .backgroundUrl !==
                    undefined
                ) {

                    backgroundUrl =
                        String(
                            req.body
                                .backgroundUrl ||
                            ""
                        ).trim();
                }

                /*
                 * Only replace the image if a new
                 * URL was actually provided.
                 *
                 * This prevents the admin form from
                 * accidentally deleting the existing
                 * background image.
                 */

                if (
                    backgroundUrl
                ) {

                    const oldImage =
                        featured.backgroundImage;

                    featured.backgroundImage =
                        backgroundUrl;

                    await featured.save();

                    if (
                        oldImage &&
                        oldImage !==
                            backgroundUrl
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

                success:
                    true,

                message:
                    "Featured section updated successfully",

                data:
                    featured
            });

        } catch (
            error
        ) {

            removeNewFiles(
                req
            );

            console.error(
                "Featured PUT error:",
                error
            );

            res.status(
                500
            ).json({

                success:
                    false,

                message:
                    "Failed to update featured section",

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
    async (
        req,
        res
    ) => {

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

                        image:
                            ""
                    });
            }

            res.setHeader(
                "Cache-Control",
                "no-store"
            );

            res.json(
                welcome
            );

        } catch (
            error
        ) {

            res.status(
                500
            ).json({

                success:
                    false,

                message:
                    "Failed to load welcome section",

                error:
                    error.message
            });
        }
    }
);

app.put(
    "/api/welcome",
    upload.any(),
    async (
        req,
        res
    ) => {

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
                "contactLink"
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
                        "welcomeImage"
                    ]
                );

            if (
                imageFile
            ) {

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

                success:
                    true,

                message:
                    "Welcome section updated successfully",

                data:
                    welcome
            });

        } catch (
            error
        ) {

            removeNewFiles(
                req
            );

            res.status(
                500
            ).json({

                success:
                    false,

                message:
                    "Failed to update welcome section",

                error:
                    error.message
            });
        }
    }
);

/* =========================================================
   EXPLORE
   UNLIMITED ITEMS
========================================================= */

async function normalizeExploreOrders() {

    const items =
        await Explore.find()
            .sort({
                order: 1,
                createdAt: 1
            });

    for (
        let i = 0;
        i < items.length;
        i++
    ) {

        if (
            items[i].order !==
            i
        ) {

            await Explore.updateOne(
                {
                    _id:
                        items[i]._id
                },
                {
                    $set: {
                        order:
                            i
                    }
                }
            );
        }
    }

    return items;
}

/* GET */

app.get(
    "/api/explore",
    async (
        req,
        res
    ) => {

        try {

            const items =
                await Explore.find()
                    .sort({
                        order: 1,
                        createdAt: 1
                    });

            res.setHeader(
                "Cache-Control",
                "no-store"
            );

            res.json(
                items
            );

        } catch (
            error
        ) {

            res.status(
                500
            ).json({

                success:
                    false,

                message:
                    "Failed to load explore items",

                error:
                    error.message
            });
        }
    }
);

/* ADD */

app.post(
    "/api/explore",
    async (
        req,
        res
    ) => {

        try {

            const count =
                await Explore.countDocuments();

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

                    order:
                        count
                });

            await normalizeExploreOrders();

            const saved =
                await Explore.findById(
                    item._id
                );

            notifyClients(
                "explore-updated"
            );

            res.status(
                201
            ).json({

                success:
                    true,

                message:
                    "Explore item added successfully",

                data:
                    saved
            });

        } catch (
            error
        ) {

            res.status(
                500
            ).json({

                success:
                    false,

                message:
                    "Failed to add explore item",

                error:
                    error.message
            });
        }
    }
);

/* UPDATE */

app.put(
    "/api/explore/:id",
    async (
        req,
        res
    ) => {

        try {

            if (
                !validObjectId(
                    req.params.id
                )
            ) {

                return res
                    .status(
                        400
                    )
                    .json({

                        success:
                            false,

                        message:
                            "Invalid explore item ID"
                    });
            }

            const item =
                await Explore.findById(
                    req.params.id
                );

            if (!item) {

                return res
                    .status(
                        404
                    )
                    .json({

                        success:
                            false,

                        message:
                            "Explore item not found"
                    });
            }

            for (
                const field of [
                    "title",
                    "description",
                    "buttonText",
                    "buttonLink"
                ]
            ) {

                if (
                    req.body[field] !==
                    undefined
                ) {

                    item[field] =
                        String(
                            req.body[field]
                        ).trim();
                }
            }

            await item.save();

            await normalizeExploreOrders();

            const saved =
                await Explore.findById(
                    item._id
                );

            notifyClients(
                "explore-updated"
            );

            res.json({

                success:
                    true,

                message:
                    "Explore item updated successfully",

                data:
                    saved
            });

        } catch (
            error
        ) {

            res.status(
                500
            ).json({

                success:
                    false,

                message:
                    "Failed to update explore item",

                error:
                    error.message
            });
        }
    }
);

/* DELETE */

app.delete(
    "/api/explore/:id",
    async (
        req,
        res
    ) => {

        try {

            if (
                !validObjectId(
                    req.params.id
                )
            ) {

                return res
                    .status(
                        400
                    )
                    .json({

                        success:
                            false,

                        message:
                            "Invalid explore item ID"
                    });
            }

            const item =
                await Explore.findByIdAndDelete(
                    req.params.id
                );

            if (!item) {

                return res
                    .status(
                        404
                    )
                    .json({

                        success:
                            false,

                        message:
                            "Explore item not found"
                    });
            }

            await normalizeExploreOrders();

            notifyClients(
                "explore-updated"
            );

            res.json({

                success:
                    true,

                message:
                    "Explore item deleted successfully"
            });

        } catch (
            error
        ) {

            res.status(
                500
            ).json({

                success:
                    false,

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
========================================================= */

function getCalendarCollection() {

    if (
        !mongoose.connection.db
    ) {

        throw new Error(
            "MongoDB is not connected"
        );
    }

    return mongoose
        .connection
        .db
        .collection(
            "calendar_settings"
        );
}

/* GET */

app.get(
    "/api/calendar",
    async (
        req,
        res
    ) => {

        try {

            const collection =
                getCalendarCollection();

            const calendar =
                await collection.findOne(
                    {
                        _id:
                            "main"
                    }
                );

            res.setHeader(
                "Cache-Control",
                "no-store"
            );

            res.json({

                success:
                    true,

                label:
                    calendar?.label ||
                    "Church Calendar",

                url:
                    calendar?.url ||
                    ""
            });

        } catch (
            error
        ) {

            res.status(
                500
            ).json({

                success:
                    false,

                message:
                    "Failed to load calendar",

                error:
                    error.message
            });
        }
    }
);

/* SAVE CALENDAR */

async function saveCalendar(
    req,
    res
) {

    try {

        const collection =
            getCalendarCollection();

        const current =
            await collection.findOne(
                {
                    _id:
                        "main"
                }
            );

        let url =
            current?.url ||
            "";

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
        }

        const label =
            String(
                req.body.label ||
                req.body.title ||
                req.body.calendarTitle ||
                current?.label ||
                "Church Calendar"
            ).trim() ||
            "Church Calendar";

        const file =
            getFileByFields(
                req,
                [
                    "file",
                    "calendarFile",
                    "calendar",
                    "image",
                    "calendarImage",
                    "upload"
                ]
            ) ||
            getFirstFile(req);

        if (file) {

            url =
                normalizeUploadUrl(
                    file
                );
        }

        if (!url) {

            removeNewFiles(
                req
            );

            return res
                .status(
                    400
                )
                .json({

                    success:
                        false,

                    message:
                        "Please enter a calendar URL or upload a calendar file."
                });
        }

        await collection.updateOne(
            {
                _id:
                    "main"
            },
            {
                $set: {

                    label:
                        label,

                    url:
                        url,

                    updatedAt:
                        new Date()
                },

                $setOnInsert: {

                    createdAt:
                        new Date()
                }
            },
            {
                upsert:
                    true
            }
        );

        if (
            current?.url &&
            current.url !==
                url
        ) {

            deleteUploadedFile(
                current.url
            );
        }

        notifyClients(
            "calendar-updated"
        );

        res.json({

            success:
                true,

            message:
                "Calendar updated successfully",

            data: {
                label,
                url
            }
        });

    } catch (
        error
    ) {

        removeNewFiles(
            req
        );

        res.status(
            500
        ).json({

            success:
                false,

            message:
                "Failed to update calendar",

            error:
                error.message
        });
    }
}

app.put(
    "/api/calendar",
    upload.any(),
    saveCalendar
);

app.put(
    "/api/content/calendar",
    upload.any(),
    saveCalendar
);

/* DELETE CALENDAR */

app.delete(
    "/api/calendar",
    async (
        req,
        res
    ) => {

        try {

            const collection =
                getCalendarCollection();

            const current =
                await collection.findOne(
                    {
                        _id:
                            "main"
                    }
                );

            if (
                current?.url
            ) {

                deleteUploadedFile(
                    current.url
                );
            }

            await collection.deleteOne(
                {
                    _id:
                        "main"
                }
            );

            notifyClients(
                "calendar-updated"
            );

            res.json({

                success:
                    true,

                message:
                    "Calendar removed successfully"
            });

        } catch (
            error
        ) {

            res.status(
                500
            ).json({

                success:
                    false,

                message:
                    "Failed to remove calendar",

                error:
                    error.message
            });
        }
    }
);

/* =========================================================
   DATABASE SEED
========================================================= */

async function seedDatabase() {

    /*
     * HOME
     */

    if (
        !(await Home.findOne())
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
                ""
        });
    }

    /*
     * EVENTS
     */

    if (
        (await Event.countDocuments()) ===
        0
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

                order:
                    0
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

                order:
                    1
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

                order:
                    2
            }
        ]);
    }

    /*
     * SPECIAL EVENTS
     */

    if (
        (await SpecialEvent.countDocuments()) ===
        0
    ) {

        await SpecialEvent.insertMany([

            {
                title:
                    "Men's Discipleship",

                date:
                    "August 24",

                time:
                    "7:30 PM",

                description:
                    "",

                link:
                    "#",

                image:
                    "",

                order:
                    0
            },

            {
                title:
                    "Youth Rally & Concert",

                date:
                    "September 12",

                time:
                    "6:30 PM",

                description:
                    "",

                link:
                    "#",

                image:
                    "",

                order:
                    1
            }
        ]);
    }

    /*
     * FEATURED
     *
     * IMPORTANT:
     * Existing Featured content is NEVER overwritten.
     */

    if (
        !(await Featured.findOne())
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
                "#"
        });
    }

    /*
     * WELCOME
     */

    if (
        !(await Welcome.findOne())
    ) {

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

            image:
                ""
        });
    }

    /*
     * EXPLORE
     *
     * UNLIMITED
     */

    if (
        (await Explore.countDocuments()) ===
        0
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

                order:
                    0
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

                order:
                    1
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

                order:
                    2
            }
        ]);
    }

    await normalizeExploreOrders();

    console.log(
        "Database initialization complete."
    );
}

/* =========================================================
   API 404
========================================================= */

app.use(
    (
        req,
        res,
        next
    ) => {

        if (
            req.path.startsWith(
                "/api/"
            )
        ) {

            return res
                .status(
                    404
                )
                .json({

                    success:
                        false,

                    message:
                        `API endpoint not found: ${req.method} ${req.path}`
                });
        }

        next();
    }
);

/* =========================================================
   WEBSITE
========================================================= */

app.get(
    "/",
    (
        req,
        res
    ) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "index.html"
            )
        );
    }
);

/* =========================================================
   ADMIN
========================================================= */

app.get(
    "/admin",
    (
        req,
        res
    ) => {

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
    (
        req,
        res
    ) => {

        res.status(
            404
        ).send(
            "Page not found"
        );
    }
);

/* =========================================================
   ERROR HANDLER
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
                .status(
                    400
                )
                .json({

                    success:
                        false,

                    message:
                        "Upload error: " +
                        error.message,

                    code:
                        error.code ||
                        "MULTER_ERROR"
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
                "Internal server error"
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
                    `Admin: http://localhost:${PORT}/admin`
                );

                console.log(
                    `Health: http://localhost:${PORT}/api/health`
                );

                console.log(
                    "========================================"
                );

                console.log("");
            }
        );

    } catch (
        error
    ) {

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

    try {

        await mongoose
            .connection
            .close();

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
        shutdown(
            "SIGINT"
        )
);

process.on(
    "SIGTERM",
    () =>
        shutdown(
            "SIGTERM"
        )
);

/* =========================================================
   START
========================================================= */

startServer();