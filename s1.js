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

const PORT = process.env.PORT || 5000;

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://127.0.0.1:27017/potters_house";

/* =========================================================
   UPLOAD FOLDERS
========================================================= */

const uploadFolders = [
  "uploads",
  "uploads/home",
  "uploads/events",
  "uploads/special-events",
  "uploads/featured",
  "uploads/welcome",
  "uploads/background",
  "uploads/calendar",
];

uploadFolders.forEach((folder) => {
  const fullPath = path.join(__dirname, folder);

  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, {
      recursive: true,
    });
  }
});

/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(cors());

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true,
  })
);

/* =========================================================
   STATIC FRONTEND
========================================================= */

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);

/* =========================================================
   STATIC UPLOADS
========================================================= */

app.use(
  "/uploads",
  express.static(
    path.join(__dirname, "uploads")
  )
);

/* =========================================================
   MONGODB
========================================================= */

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("");
    console.log("=================================");
    console.log("MongoDB connected successfully");
    console.log("=================================");
    console.log("");
  })
  .catch((error) => {
    console.error("");
    console.error("MongoDB connection error:");
    console.error(error);
    console.error("");
  });

mongoose.connection.on(
  "error",
  (error) => {
    console.error(
      "MongoDB error:",
      error
    );
  }
);

/* =========================================================
   MULTER STORAGE
========================================================= */

const storage =
  multer.diskStorage({
    destination: function (
      req,
      file,
      cb
    ) {
      /*
       * IMPORTANT:
       * The admin panel sends "section" before
       * the uploaded file.
       */

      const section =
        req.body.section || "";

      let folder =
        "uploads";

      switch (section) {
        case "home":
          folder =
            "uploads/home";
          break;

        case "event":
        case "events":
          folder =
            "uploads/events";
          break;

        case "special-event":
        case "special-events":
          folder =
            "uploads/special-events";
          break;

        case "featured":
          folder =
            "uploads/featured";
          break;

        case "welcome":
          folder =
            "uploads/welcome";
          break;

        case "background":
          folder =
            "uploads/background";
          break;

        case "calendar":
          folder =
            "uploads/calendar";
          break;

        default:
          folder =
            "uploads";
      }

      const destination =
        path.join(
          __dirname,
          folder
        );

      if (
        !fs.existsSync(
          destination
        )
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

      const filename =
        Date.now() +
        "-" +
        Math.round(
          Math.random() * 1e9
        ) +
        extension;

      cb(
        null,
        filename
      );
    },
  });

/* =========================================================
   FILE TYPES
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

const calendarTypes = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

const upload =
  multer({
    storage,

    limits: {
      fileSize:
        100 *
        1024 *
        1024,
    },

    fileFilter:
      function (
        req,
        file,
        cb
      ) {
        const allowed = [
          ...imageTypes,
          ...videoTypes,
          ...calendarTypes,
        ];

        if (
          allowed.includes(
            file.mimetype
          )
        ) {
          cb(
            null,
            true
          );
        } else {
          cb(
            new Error(
              "Unsupported file type."
            )
          );
        }
      },
  });

/* =========================================================
   SERVER SENT EVENTS
========================================================= */

let clients = [];

app.get(
  "/api/updates",
  (req, res) => {
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

    res.write(
      `data: ${JSON.stringify({
        type: "connected",
      })}\n\n`
    );

    clients.push(res);

    req.on(
      "close",
      () => {
        clients =
          clients.filter(
            (client) =>
              client !== res
          );
      }
    );
  }
);

function notifyClients(
  type
) {
  const message =
    `data: ${JSON.stringify({
      type:
        type ||
        "content-updated",
      timestamp:
        Date.now(),
    })}\n\n`;

  clients =
    clients.filter(
      (client) => {
        try {
          client.write(
            message
          );

          return true;
        } catch (
          error
        ) {
          return false;
        }
      }
    );
}

/* =========================================================
   HELPER - IMAGE URL
========================================================= */

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

/* =========================================================
   HELPER - DELETE IMAGE
========================================================= */

function deleteImage(
  imageUrl
) {
  if (!imageUrl) {
    return;
  }

  if (
    !imageUrl.startsWith(
      "/uploads/"
    )
  ) {
    return;
  }

  const relative =
    imageUrl.replace(
      /^\/uploads\//,
      ""
    );

  const fullPath =
    path.join(
      __dirname,
      "uploads",
      relative
    );

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
        "Could not delete file:",
        error
      );
    }
  }
}

/* =========================================================
   HELPER - REMOVE UPLOADED FILE
========================================================= */

function removeUploadedFile(
  file
) {
  if (
    !file ||
    !file.path
  ) {
    return;
  }

  try {
    if (
      fs.existsSync(
        file.path
      )
    ) {
      fs.unlinkSync(
        file.path
      );
    }
  } catch (
    error
  ) {
    console.error(
      "Could not remove uploaded file:",
      error
    );
  }
}

/* =========================================================
   HELPER - REMOVE MULTIPLE FILES
========================================================= */

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

  list.forEach(
    (file) => {
      removeUploadedFile(
        file
      );
    }
  );
}

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

      res.json(home);
    } catch (
      error
    ) {
      console.error(
        "Home GET error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to load home data",

        error:
          error.message,
      });
    }
  }
);

/* =========================================================
   UPDATE HOME + LOGO
========================================================= */

app.put(
  "/api/home",
  upload.single("logo"),
  async (req, res) => {
    try {
      let home =
        await Home.findOne();

      if (!home) {
        home =
          new Home();
      }

      if (
        req.body.badge !==
        undefined
      ) {
        home.badge =
          req.body.badge;
      }

      if (
        req.body.title !==
        undefined
      ) {
        home.title =
          req.body.title;
      }

      if (
        req.body.subtitle !==
        undefined
      ) {
        home.subtitle =
          req.body.subtitle;
      }

      if (
        req.body.location !==
        undefined
      ) {
        home.location =
          req.body.location;
      }

      if (
        req.body.mapLink !==
        undefined
      ) {
        home.mapLink =
          req.body.mapLink;
      }

      if (req.file) {
        deleteImage(
          home.logo
        );

        home.logo =
          normalizeUploadUrl(
            req.file
          );
      }

      await home.save();

      notifyClients(
        "home-updated"
      );

      res.json({
        success: true,

        message:
          "Home updated successfully",

        data: home,
      });
    } catch (
      error
    ) {
      console.error(
        "Home PUT error:",
        error
      );

      if (req.file) {
        removeUploadedFile(
          req.file
        );
      }

      res.status(500).json({
        message:
          "Failed to update home",

        error:
          error.message,
      });
    }
  }
);

/* =========================================================
   HOME BACKGROUND MEDIA
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

/* ---------------------------------------------------------
   GET BACKGROUND MEDIA
--------------------------------------------------------- */

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

      res.json(items);
    } catch (
      error
    ) {
      console.error(
        "Background GET error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to load home background media",

        error:
          error.message,
      });
    }
  }
);

/* ---------------------------------------------------------
   UPLOAD BACKGROUND IMAGES / VIDEOS
--------------------------------------------------------- */

app.post(
  "/api/home-background",
  upload.array(
    "media",
    30
  ),
  async (req, res) => {
    try {
      const files =
        req.files || [];

      if (
        files.length === 0
      ) {
        return res
          .status(400)
          .json({
            message:
              "Please select at least one image or video.",
          });
      }

      const collection =
        getBackgroundCollection();

      const requestedOrder =
        Number(
          req.body.order
        );

      let order =
        Number.isFinite(
          requestedOrder
        )
          ? requestedOrder
          : 0;

      const documents =
        files.map(
          (
            file,
            index
          ) => {
            const isVideo =
              file.mimetype.startsWith(
                "video/"
              );

            return {
              title:
                req.body.title ||
                file.originalname,

              type:
                isVideo
                  ? "video"
                  : "image",

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
    } catch (
      error
    ) {
      console.error(
        "Background upload error:",
        error
      );

      removeUploadedFiles(
        req.files
      );

      res.status(500).json({
        message:
          "Failed to upload background media",

        error:
          error.message,
      });
    }
  }
);

/* ---------------------------------------------------------
   UPDATE BACKGROUND MEDIA
--------------------------------------------------------- */

app.put(
  "/api/home-background/:id",
  async (req, res) => {
    try {
      const {
        ObjectId,
      } = mongoose.mongo;

      if (
        !ObjectId.isValid(
          req.params.id
        )
      ) {
        return res
          .status(400)
          .json({
            message:
              "Invalid background media ID",
          });
      }

      const collection =
        getBackgroundCollection();

      const id =
        new ObjectId(
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
          req.body.title;
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

        data:
          updated,
      });
    } catch (
      error
    ) {
      console.error(
        "Background update error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to update background media",

        error:
          error.message,
      });
    }
  }
);

/* ---------------------------------------------------------
   DELETE BACKGROUND MEDIA
--------------------------------------------------------- */

app.delete(
  "/api/home-background/:id",
  async (req, res) => {
    try {
      const {
        ObjectId,
      } = mongoose.mongo;

      if (
        !ObjectId.isValid(
          req.params.id
        )
      ) {
        return res
          .status(400)
          .json({
            message:
              "Invalid background media ID",
          });
      }

      const collection =
        getBackgroundCollection();

      const id =
        new ObjectId(
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
            message:
              "Background media not found",
          });
      }

      await collection.deleteOne({
        _id: id,
      });

      deleteImage(
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
    } catch (
      error
    ) {
      console.error(
        "Background delete error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to delete background media",

        error:
          error.message,
      });
    }
  }
);

/* =========================================================
   EVENTS - COMING EVENTS
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

      res.json(events);
    } catch (
      error
    ) {
      console.error(
        "Events GET error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to load events",

        error:
          error.message,
      });
    }
  }
);

/* ---------------------------------------------------------
   ADD EVENT
--------------------------------------------------------- */

app.post(
  "/api/events",
  async (req, res) => {
    try {
      let nextOrder =
        Number(
          req.body.order
        );

      if (
        !Number.isFinite(
          nextOrder
        ) ||
        nextOrder <= 0
      ) {
        const last =
          await Event.findOne()
            .sort({
              order: -1,
            });

        nextOrder =
          last
            ? Number(
                last.order || 0
              ) + 1
            : 1;
      }

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
            nextOrder,
        });

      notifyClients(
        "events-updated"
      );

      res.status(201).json({
        success: true,

        message:
          "Event added successfully",

        data:
          event,
      });
    } catch (
      error
    ) {
      console.error(
        "Event POST error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to add event",

        error:
          error.message,
      });
    }
  }
);

/* ---------------------------------------------------------
   UPDATE EVENT
--------------------------------------------------------- */

app.put(
  "/api/events/:id",
  async (req, res) => {
    try {
      const event =
        await Event.findByIdAndUpdate(
          req.params.id,
          {
            category:
              req.body.category,

            day:
              req.body.day,

            service:
              req.body.service,

            time:
              req.body.time,

            order:
              Number(
                req.body.order
              ) || 0,
          },
          {
            new: true,
            runValidators: true,
          }
        );

      if (!event) {
        return res
          .status(404)
          .json({
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

        data:
          event,
      });
    } catch (
      error
    ) {
      console.error(
        "Event PUT error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to update event",

        error:
          error.message,
      });
    }
  }
);

/* ---------------------------------------------------------
   DELETE EVENT
--------------------------------------------------------- */

app.delete(
  "/api/events/:id",
  async (req, res) => {
    try {
      const event =
        await Event.findByIdAndDelete(
          req.params.id
        );

      if (!event) {
        return res
          .status(404)
          .json({
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
          "Event deleted successfully",
      });
    } catch (
      error
    ) {
      console.error(
        "Event DELETE error:",
        error
      );

      res.status(500).json({
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

      res.json(events);
    } catch (
      error
    ) {
      console.error(
        "Special events GET error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to load special events",

        error:
          error.message,
      });
    }
  }
);

/* ---------------------------------------------------------
   ADD SPECIAL EVENT
--------------------------------------------------------- */

app.post(
  "/api/special-events",
  upload.single("image"),
  async (req, res) => {
    try {
      let nextOrder =
        Number(
          req.body.order
        );

      if (
        !Number.isFinite(
          nextOrder
        ) ||
        nextOrder <= 0
      ) {
        const last =
          await SpecialEvent.findOne()
            .sort({
              order: -1,
            });

        nextOrder =
          last
            ? Number(
                last.order || 0
              ) + 1
            : 1;
      }

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
            req.file
              ? normalizeUploadUrl(
                  req.file
                )
              : "",

          order:
            nextOrder,
        });

      notifyClients(
        "special-events-updated"
      );

      res.status(201).json({
        success: true,

        message:
          "Special event added successfully",

        data:
          event,
      });
    } catch (
      error
    ) {
      console.error(
        "Special event POST error:",
        error
      );

      if (req.file) {
        removeUploadedFile(
          req.file
        );
      }

      res.status(500).json({
        message:
          "Failed to add special event",

        error:
          error.message,
      });
    }
  }
);

/* ---------------------------------------------------------
   UPDATE SPECIAL EVENT
--------------------------------------------------------- */

app.put(
  "/api/special-events/:id",
  upload.single("image"),
  async (req, res) => {
    try {
      const event =
        await SpecialEvent.findById(
          req.params.id
        );

      if (!event) {
        if (req.file) {
          removeUploadedFile(
            req.file
          );
        }

        return res
          .status(404)
          .json({
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

      if (req.file) {
        deleteImage(
          event.image
        );

        event.image =
          normalizeUploadUrl(
            req.file
          );
      }

      await event.save();

      notifyClients(
        "special-events-updated"
      );

      res.json({
        success: true,

        message:
          "Special event updated successfully",

        data:
          event,
      });
    } catch (
      error
    ) {
      console.error(
        "Special event PUT error:",
        error
      );

      if (req.file) {
        removeUploadedFile(
          req.file
        );
      }

      res.status(500).json({
        message:
          "Failed to update special event",

        error:
          error.message,
      });
    }
  }
);

/* ---------------------------------------------------------
   DELETE SPECIAL EVENT
--------------------------------------------------------- */

app.delete(
  "/api/special-events/:id",
  async (req, res) => {
    try {
      const event =
        await SpecialEvent.findByIdAndDelete(
          req.params.id
        );

      if (!event) {
        return res
          .status(404)
          .json({
            message:
              "Special event not found",
          });
      }

      deleteImage(
        event.image
      );

      notifyClients(
        "special-events-updated"
      );

      res.json({
        success: true,

        message:
          "Special event deleted successfully",
      });
    } catch (
      error
    ) {
      console.error(
        "Special event DELETE error:",
        error
      );

      res.status(500).json({
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
   IMPORTANT FIX
========================================================= */

/*
 * Admin sends:
 *
 * section = featured
 * badge
 * title
 * subtitle
 * watchLink
 * sermonsLink
 * backgroundImage = URL OR FILE
 *
 * Therefore this route MUST use:
 *
 * upload.single("backgroundImage")
 *
 * and NOT:
 *
 * upload.single("image")
 */

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
              "https://images.unsplash.com/photo-1438232992991-995b7058bbb3",

            watchLink:
              "#",

            sermonsLink:
              "#",
          });
      }

      res.json(featured);
    } catch (
      error
    ) {
      console.error(
        "Featured GET error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to load featured section",

        error:
          error.message,
      });
    }
  }
);

/* ---------------------------------------------------------
   UPDATE FEATURED
--------------------------------------------------------- */

app.put(
  "/api/featured",
  upload.single(
    "backgroundImage"
  ),
  async (req, res) => {
    try {
      let featured =
        await Featured.findOne();

      if (!featured) {
        featured =
          new Featured();
      }

      /*
       * IMPORTANT:
       * Use !== undefined so an admin can
       * intentionally save empty text.
       */

      if (
        req.body.badge !==
        undefined
      ) {
        featured.badge =
          req.body.badge;
      }

      if (
        req.body.title !==
        undefined
      ) {
        featured.title =
          req.body.title;
      }

      if (
        req.body.subtitle !==
        undefined
      ) {
        featured.subtitle =
          req.body.subtitle;
      }

      if (
        req.body.watchLink !==
        undefined
      ) {
        featured.watchLink =
          req.body.watchLink;
      }

      if (
        req.body.sermonsLink !==
        undefined
      ) {
        featured.sermonsLink =
          req.body.sermonsLink;
      }

      /*
       * FILE UPLOAD HAS PRIORITY
       */

      if (req.file) {
        /*
         * Delete old uploaded
         * Featured background.
         */

        if (
          featured.backgroundImage &&
          featured.backgroundImage.startsWith(
            "/uploads/"
          )
        ) {
          deleteImage(
            featured.backgroundImage
          );
        }

        featured.backgroundImage =
          normalizeUploadUrl(
            req.file
          );
      } else if (
        req.body.backgroundImage !==
        undefined
      ) {
        /*
         * URL background.
         *
         * Only delete an old uploaded
         * file when replacing it with
         * a different URL.
         */

        const newBackground =
          String(
            req.body.backgroundImage
          ).trim();

        if (
          newBackground
        ) {
          if (
            featured.backgroundImage &&
            featured.backgroundImage.startsWith(
              "/uploads/"
            ) &&
            featured.backgroundImage !==
              newBackground
          ) {
            deleteImage(
              featured.backgroundImage
            );
          }

          featured.backgroundImage =
            newBackground;
        }
      }

      await featured.save();

      notifyClients(
        "featured-updated"
      );

      res.json({
        success: true,

        message:
          "Featured section updated successfully",

        data:
          featured,
      });
    } catch (
      error
    ) {
      console.error(
        "Featured PUT error:",
        error
      );

      if (req.file) {
        removeUploadedFile(
          req.file
        );
      }

      res.status(500).json({
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
              "Thank you for visiting us online. My wife and I are dedicated to serving this community and reaching families with hope.",

            paragraph2:
              "Whether you are seeking a spiritual home or just passing through, we invite you to join us at any of our weekly services.",

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

      res.json(welcome);
    } catch (
      error
    ) {
      console.error(
        "Welcome GET error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to load welcome section",

        error:
          error.message,
      });
    }
  }
);

/* ---------------------------------------------------------
   UPDATE WELCOME
--------------------------------------------------------- */

app.put(
  "/api/welcome",
  upload.single("image"),
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

      fields.forEach(
        (field) => {
          if (
            req.body[field] !==
            undefined
          ) {
            welcome[field] =
              req.body[field];
          }
        }
      );

      if (req.file) {
        deleteImage(
          welcome.image
        );

        welcome.image =
          normalizeUploadUrl(
            req.file
          );
      }

      await welcome.save();

      notifyClients(
        "welcome-updated"
      );

      res.json({
        success: true,

        message:
          "Welcome section updated successfully",

        data:
          welcome,
      });
    } catch (
      error
    ) {
      console.error(
        "Welcome PUT error:",
        error
      );

      if (req.file) {
        removeUploadedFile(
          req.file
        );
      }

      res.status(500).json({
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
========================================================= */

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

      res.json(items);
    } catch (
      error
    ) {
      console.error(
        "Explore GET error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to load explore items",

        error:
          error.message,
      });
    }
  }
);

/* ---------------------------------------------------------
   ADD EXPLORE ITEM
--------------------------------------------------------- */

app.post(
  "/api/explore",
  async (req, res) => {
    try {
      /*
       * Display order is now automatic.
       * Admin does not need to provide it.
       */

      const last =
        await Explore.findOne()
          .sort({
            order: -1,
          });

      const nextOrder =
        last
          ? Number(
              last.order || 0
            ) + 1
          : 1;

      const item =
        await Explore.create({
          title:
            req.body.title ||
            "",

          description:
            req.body.description ||
            "",

          buttonText:
            req.body.buttonText ||
            "Learn More",

          buttonLink:
            req.body.buttonLink ||
            "#",

          order:
            nextOrder,
        });

      notifyClients(
        "explore-updated"
      );

      res.status(201).json({
        success: true,

        message:
          "Explore item added successfully",

        data:
          item,
      });
    } catch (
      error
    ) {
      console.error(
        "Explore POST error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to add explore item",

        error:
          error.message,
      });
    }
  }
);

/* ---------------------------------------------------------
   UPDATE EXPLORE ITEM
--------------------------------------------------------- */

app.put(
  "/api/explore/:id",
  async (req, res) => {
    try {
      const item =
        await Explore.findById(
          req.params.id
        );

      if (!item) {
        return res
          .status(404)
          .json({
            message:
              "Explore item not found",
          });
      }

      if (
        req.body.title !==
        undefined
      ) {
        item.title =
          req.body.title;
      }

      if (
        req.body.description !==
        undefined
      ) {
        item.description =
          req.body.description;
      }

      if (
        req.body.buttonText !==
        undefined
      ) {
        item.buttonText =
          req.body.buttonText;
      }

      if (
        req.body.buttonLink !==
        undefined
      ) {
        item.buttonLink =
          req.body.buttonLink;
      }

      /*
       * If an old admin sends order,
       * preserve compatibility.
       *
       * New admin can omit order.
       */

      if (
        req.body.order !==
        undefined &&
        req.body.order !== ""
      ) {
        item.order =
          Number(
            req.body.order
          ) || item.order;
      }

      await item.save();

      notifyClients(
        "explore-updated"
      );

      res.json({
        success: true,

        message:
          "Explore item updated successfully",

        data:
          item,
      });
    } catch (
      error
    ) {
      console.error(
        "Explore PUT error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to update explore item",

        error:
          error.message,
      });
    }
  }
);

/* ---------------------------------------------------------
   DELETE EXPLORE ITEM
--------------------------------------------------------- */

app.delete(
  "/api/explore/:id",
  async (req, res) => {
    try {
      const item =
        await Explore.findByIdAndDelete(
          req.params.id
        );

      if (!item) {
        return res
          .status(404)
          .json({
            message:
              "Explore item not found",
          });
      }

      /*
       * Re-number remaining Explore items
       * automatically.
       */

      const remaining =
        await Explore.find()
          .sort({
            order: 1,
            createdAt: 1,
          });

      for (
        let i = 0;
        i <
        remaining.length;
        i++
      ) {
        remaining[i].order =
          i + 1;

        await remaining[
          i
        ].save();
      }

      notifyClients(
        "explore-updated"
      );

      res.json({
        success: true,

        message:
          "Explore item deleted successfully",
      });
    } catch (
      error
    ) {
      console.error(
        "Explore DELETE error:",
        error
      );

      res.status(500).json({
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

/* ---------------------------------------------------------
   GET CALENDAR
--------------------------------------------------------- */

app.get(
  "/api/calendar",
  async (req, res) => {
    try {
      const collection =
        getCalendarCollection();

      let calendar =
        await collection.findOne({
          key: "main",
        });

      if (!calendar) {
        calendar = {
          key: "main",

          label:
            "View Calendar",

          url: "",

          type: "",

          createdAt:
            new Date(),

          updatedAt:
            new Date(),
        };
      }

      res.json(
        calendar
      );
    } catch (
      error
    ) {
      console.error(
        "Calendar GET error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to load calendar",

        error:
          error.message,
      });
    }
  }
);

/* ---------------------------------------------------------
   COMPATIBILITY:
   /api/content/calendar
--------------------------------------------------------- */

app.get(
  "/api/content/calendar",
  async (req, res) => {
    try {
      const collection =
        getCalendarCollection();

      let calendar =
        await collection.findOne({
          key: "main",
        });

      if (!calendar) {
        calendar = {
          key: "main",
          label:
            "View Calendar",
          url: "",
          type: "",
        };
      }

      res.json({
        success: true,

        data:
          calendar,
      });
    } catch (
      error
    ) {
      console.error(
        "Calendar compatibility GET error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to load calendar",

        error:
          error.message,
      });
    }
  }
);

/* ---------------------------------------------------------
   SAVE CALENDAR
--------------------------------------------------------- */

async function saveCalendar(
  req,
  res
) {
  try {
    const collection =
      getCalendarCollection();

    let oldCalendar =
      await collection.findOne({
        key: "main",
      });

    const update = {
      key: "main",

      label:
        req.body.label !==
        undefined
          ? req.body.label
          : oldCalendar?.label ||
            "View Calendar",

      updatedAt:
        new Date(),
    };

    /*
     * FILE UPLOAD
     */

    if (req.file) {
      /*
       * Delete old uploaded calendar.
       */

      if (
        oldCalendar &&
        oldCalendar.url &&
        oldCalendar.url.startsWith(
          "/uploads/"
        )
      ) {
        deleteImage(
          oldCalendar.url
        );
      }

      update.url =
        normalizeUploadUrl(
          req.file
        );

      update.type =
        req.file.mimetype;
    } else if (
      req.body.url !==
      undefined
    ) {
      /*
       * URL input
       */

      const newUrl =
        String(
          req.body.url
        ).trim();

      if (
        oldCalendar &&
        oldCalendar.url &&
        oldCalendar.url.startsWith(
          "/uploads/"
        ) &&
        oldCalendar.url !==
          newUrl
      ) {
        deleteImage(
          oldCalendar.url
        );
      }

      update.url =
        newUrl;

      update.type =
        "url";
    } else if (
      oldCalendar
    ) {
      /*
       * No new URL/file:
       * keep existing calendar.
       */

      update.url =
        oldCalendar.url ||
        "";

      update.type =
        oldCalendar.type ||
        "";
    } else {
      update.url =
        "";

      update.type =
        "";
    }

    update.createdAt =
      oldCalendar?.createdAt ||
      new Date();

    const saved =
      await collection.findOneAndUpdate(
        {
          key: "main",
        },
        {
          $set:
            update,
        },
        {
          upsert: true,
          returnDocument:
            "after",
        }
      );

    notifyClients(
      "calendar-updated"
    );

    res.json({
      success: true,

      message:
        "Calendar settings updated successfully",

      data:
        saved,
    });
  } catch (
    error
  ) {
    console.error(
      "Calendar PUT error:",
      error
    );

    if (req.file) {
      removeUploadedFile(
        req.file
      );
    }

    res.status(500).json({
      message:
        "Failed to save calendar",

      error:
        error.message,
    });
  }
}

/* ---------------------------------------------------------
   MAIN CALENDAR SAVE API
--------------------------------------------------------- */

app.put(
  "/api/calendar",
  upload.single("file"),
  saveCalendar
);

/* ---------------------------------------------------------
   COMPATIBILITY CALENDAR SAVE API
--------------------------------------------------------- */

app.put(
  "/api/content/calendar",
  upload.single("file"),
  saveCalendar
);

/* ---------------------------------------------------------
   DELETE CALENDAR
--------------------------------------------------------- */

app.delete(
  "/api/calendar",
  async (req, res) => {
    try {
      const collection =
        getCalendarCollection();

      const calendar =
        await collection.findOne({
          key: "main",
        });

      if (!calendar) {
        return res.json({
          success: true,

          message:
            "Calendar already empty",
        });
      }

      if (
        calendar.url &&
        calendar.url.startsWith(
          "/uploads/"
        )
      ) {
        deleteImage(
          calendar.url
        );
      }

      await collection.deleteOne({
        key: "main",
      });

      notifyClients(
        "calendar-updated"
      );

      res.json({
        success: true,

        message:
          "Calendar deleted successfully",
      });
    } catch (
      error
    ) {
      console.error(
        "Calendar DELETE error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to delete calendar",

        error:
          error.message,
      });
    }
  }
);

/* =========================================================
   CALENDAR COMPATIBILITY DELETE
========================================================= */

app.delete(
  "/api/content/calendar",
  async (req, res) => {
    try {
      const collection =
        getCalendarCollection();

      const calendar =
        await collection.findOne({
          key: "main",
        });

      if (
        calendar &&
        calendar.url &&
        calendar.url.startsWith(
          "/uploads/"
        )
      ) {
        deleteImage(
          calendar.url
        );
      }

      await collection.deleteOne({
        key: "main",
      });

      notifyClients(
        "calendar-updated"
      );

      res.json({
        success: true,

        message:
          "Calendar deleted successfully",
      });
    } catch (
      error
    ) {
      console.error(
        "Calendar compatibility DELETE error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to delete calendar",

        error:
          error.message,
      });
    }
  }
);

/* =========================================================
   SERVER STATUS
========================================================= */

app.get(
  "/api/status",
  (req, res) => {
    res.json({
      success: true,

      server:
        "running",

      mongodb:
        mongoose.connection.readyState ===
        1
          ? "connected"
          : "disconnected",

      port:
        PORT,

      timestamp:
        new Date().toISOString(),
    });
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
   MULTER / GENERAL ERROR HANDLER
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
          success: false,

          message:
            error.message ||
            "File upload error",
        });
    }

    res
      .status(500)
      .json({
        success: false,

        message:
          error.message ||
          "Internal server error",
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
        req.originalUrl,
    });
  }
);

/* =========================================================
   START SERVER
========================================================= */

async function startServer() {
  try {
    await mongoose.connection.asPromise();

    app.listen(
      PORT,
      () => {
        console.log("");
        console.log(
          "================================="
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
          "MongoDB: Connected"
        );

        console.log(
          "================================="
        );

        console.log("");
      }
    );
  } catch (
    error
  ) {
    console.error(
      "Server startup failed:",
      error
    );

    process.exit(1);
  }
}

startServer();