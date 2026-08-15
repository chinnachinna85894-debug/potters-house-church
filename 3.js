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
   FOLDERS
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

/*
  Serve public website
*/
app.use(
  express.static(
    path.join(__dirname, "public")
  )
);

/*
  Serve uploaded images/videos/files
*/
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
    console.log("========================================");
    console.log("MongoDB connected successfully");
    console.log("Database:", mongoose.connection.name);
    console.log("========================================");
    console.log("");

    seedDatabase();
  })
  .catch((error) => {
    console.error("");
    console.error("MongoDB connection error:");
    console.error(error);
    console.error("");
  });

mongoose.connection.on("error", (error) => {
  console.error("MongoDB error:", error);
});

/* =========================================================
   MULTER STORAGE
========================================================= */

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const section =
      req.body.section || "general";

    let folder = "uploads";

    if (section === "home") {
      folder = "uploads/home";
    }

    else if (section === "event") {
      folder = "uploads/events";
    }

    else if (section === "special-event") {
      folder = "uploads/special-events";
    }

    else if (section === "featured") {
      folder = "uploads/featured";
    }

    else if (section === "welcome") {
      folder = "uploads/welcome";
    }

    else if (section === "background") {
      folder = "uploads/background";
    }

    else if (section === "calendar") {
      folder = "uploads/calendar";
    }

    const destination = path.join(
      __dirname,
      folder
    );

    if (!fs.existsSync(destination)) {
      fs.mkdirSync(destination, {
        recursive: true,
      });
    }

    cb(null, destination);
  },

  filename: function (req, file, cb) {
    const extension = path.extname(
      file.originalname
    );

    const filename =
      Date.now() +
      "-" +
      Math.round(Math.random() * 1e9) +
      extension;

    cb(null, filename);
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

const allowedTypes = [
  ...imageTypes,
  ...videoTypes,
  ...calendarTypes,
];

/* =========================================================
   MULTER
========================================================= */

const upload = multer({
  storage,

  limits: {
    fileSize: 100 * 1024 * 1024,
  },

  fileFilter: function (req, file, cb) {
    /*
      Calendar can use PDF/image.
      Background can use image/video.
    */

    if (
      allowedTypes.includes(
        file.mimetype
      )
    ) {
      cb(null, true);
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
      "no-cache"
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

    req.on("close", () => {
      clients =
        clients.filter(
          (client) =>
            client !== res
        );
    });
  }
);

/* =========================================================
   NOTIFY FRONTEND
========================================================= */

function notifyClients(
  type = "content-updated"
) {
  const message =
    `data: ${JSON.stringify({
      type,
      timestamp: Date.now(),
    })}\n\n`;

  clients =
    clients.filter((client) => {
      try {
        client.write(message);
        return true;
      } catch (error) {
        return false;
      }
    });
}

/* =========================================================
   HELPERS
========================================================= */

function normalizeFileUrl(
  file
) {
  if (!file) {
    return "";
  }

  const relativePath =
    path.relative(
      path.join(
        __dirname,
        "uploads"
      ),
      file.path
    );

  return (
    "/uploads/" +
    relativePath.replace(
      /\\/g,
      "/"
    )
  );
}

/* =========================================================
   DELETE UPLOADED FILE
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
    fs.existsSync(fullPath)
  ) {
    try {
      fs.unlinkSync(fullPath);
    } catch (error) {
      console.error(
        "Could not delete file:",
        error
      );
    }
  }
}

/* =========================================================
   REMOVE NEWLY UPLOADED FILES
========================================================= */

function removeUploadedFiles(
  files
) {
  if (!files) {
    return;
  }

  const fileList =
    Array.isArray(files)
      ? files
      : Object.values(files).flat();

  fileList.forEach(
    (file) => {
      try {
        if (
          file &&
          file.path &&
          fs.existsSync(
            file.path
          )
        ) {
          fs.unlinkSync(
            file.path
          );
        }
      } catch (error) {
        console.error(
          "Could not remove uploaded file:",
          error
        );
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
      server: "online",
      mongodb:
        mongoose.connection.readyState ===
        1
          ? "connected"
          : "disconnected",
      time: new Date(),
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
            badge: "Welcome Home",

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

/* =========================================================
   UPDATE HOME
========================================================= */

app.put(
  "/api/home",
  upload.single("logo"),
  async (req, res) => {
    try {
      let home =
        await Home.findOne();

      if (!home) {
        home = new Home();
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
          normalizeFileUrl(
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
    } catch (error) {
      console.error(
        "Home update error:",
        error
      );

      if (req.file) {
        removeUploadedFiles(
          req.file
        );
      }

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
   HOME BACKGROUND COLLECTION
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

/* =========================================================
   GET HOME BACKGROUND
========================================================= */

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

/* =========================================================
   UPLOAD HOME BACKGROUND
========================================================= */

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
        return res.status(400).json({
          success: false,

          message:
            "Please select at least one image or video.",
        });
      }

      const collection =
        getBackgroundCollection();

      const startingOrder =
        Number(
          req.body.order
        ) || 0;

      const documents =
        files.map(
          (file, index) => {
            const isVideo =
              file.mimetype.startsWith(
                "video/"
              );

            return {
              title:
                req.body.title ||
                file.originalname,

              type: isVideo
                ? "video"
                : "image",

              url:
                normalizeFileUrl(
                  file
                ),

              originalName:
                file.originalname,

              mimeType:
                file.mimetype,

              order:
                startingOrder +
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

        data: documents,

        insertedCount:
          result.insertedCount,
      });
    } catch (error) {
      console.error(
        "Background upload error:",
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

/* =========================================================
   UPDATE HOME BACKGROUND
========================================================= */

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
        return res.status(400).json({
          success: false,

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
            $set: update,
          }
        );

      if (
        result.matchedCount ===
        0
      ) {
        return res.status(404).json({
          success: false,

          message:
            "Background media not found",
        });
      }

      const updated =
        await collection.findOne({
          _id: id,
        });

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
        "Background update error:",
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

/* =========================================================
   DELETE HOME BACKGROUND
========================================================= */

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
        return res.status(400).json({
          success: false,

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
        await collection.findOne({
          _id: id,
        });

      if (!item) {
        return res.status(404).json({
          success: false,

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
    } catch (error) {
      console.error(
        "Background delete error:",
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
   EVENTS
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

/* =========================================================
   ADD EVENT
========================================================= */

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
        "Event add error:",
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

/* =========================================================
   UPDATE EVENT
========================================================= */

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
        return res.status(404).json({
          success: false,

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
        "Event update error:",
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

/* =========================================================
   DELETE EVENT
========================================================= */

app.delete(
  "/api/events/:id",
  async (req, res) => {
    try {
      const event =
        await Event.findByIdAndDelete(
          req.params.id
        );

      if (!event) {
        return res.status(404).json({
          success: false,

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
    } catch (error) {
      console.error(
        "Event delete error:",
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

      res.json(events);
    } catch (error) {
      console.error(
        "Special Events GET error:",
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

/* =========================================================
   ADD SPECIAL EVENT
========================================================= */

app.post(
  "/api/special-events",
  upload.single("image"),
  async (req, res) => {
    try {
      const event =
        await SpecialEvent.create({
          title:
            req.body.title || "",

          date:
            req.body.date || "",

          time:
            req.body.time || "",

          link:
            req.body.link || "#",

          image:
            req.file
              ? normalizeFileUrl(
                  req.file
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
        "Special Event add error:",
        error
      );

      if (req.file) {
        removeUploadedFiles(
          req.file
        );
      }

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

/* =========================================================
   UPDATE SPECIAL EVENT
========================================================= */

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
          removeUploadedFiles(
            req.file
          );
        }

        return res.status(404).json({
          success: false,

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
          normalizeFileUrl(
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

        data: event,
      });
    } catch (error) {
      console.error(
        "Special Event update error:",
        error
      );

      if (req.file) {
        removeUploadedFiles(
          req.file
        );
      }

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

/* =========================================================
   DELETE SPECIAL EVENT
========================================================= */

app.delete(
  "/api/special-events/:id",
  async (req, res) => {
    try {
      const event =
        await SpecialEvent.findByIdAndDelete(
          req.params.id
        );

      if (!event) {
        return res.status(404).json({
          success: false,

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
    } catch (error) {
      console.error(
        "Special Event delete error:",
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

/* =========================================================
   UPDATE FEATURED
========================================================= */

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

      const fields = [
        "badge",
        "title",
        "subtitle",
        "watchLink",
        "sermonsLink",
      ];

      fields.forEach(
        (field) => {
          if (
            req.body[field] !==
            undefined
          ) {
            featured[field] =
              req.body[field];
          }
        }
      );

      if (req.file) {
        deleteImage(
          featured.backgroundImage
        );

        featured.backgroundImage =
          normalizeFileUrl(
            req.file
          );
      }
      else if (
        req.body.backgroundImage !==
          undefined &&
        req.body.backgroundImage.trim() !==
          ""
      ) {
        featured.backgroundImage =
          req.body.backgroundImage;
      }

      await featured.save();

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
        "Featured update error:",
        error
      );

      if (req.file) {
        removeUploadedFiles(
          req.file
        );
      }

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

/* =========================================================
   UPDATE WELCOME
========================================================= */

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
          normalizeFileUrl(
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

        data: welcome,
      });
    } catch (error) {
      console.error(
        "Welcome update error:",
        error
      );

      if (req.file) {
        removeUploadedFiles(
          req.file
        );
      }

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

/* =========================================================
   ADD EXPLORE
========================================================= */

app.post(
  "/api/explore",
  async (req, res) => {
    try {
      const item =
        await Explore.create({
          title:
            req.body.title || "",

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
            Number(
              req.body.order
            ) || 0,
        });

      notifyClients(
        "explore-updated"
      );

      res.status(201).json({
        success: true,

        message:
          "Explore item added successfully",

        data: item,
      });
    } catch (error) {
      console.error(
        "Explore add error:",
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

/* =========================================================
   UPDATE EXPLORE
========================================================= */

app.put(
  "/api/explore/:id",
  async (req, res) => {
    try {
      const item =
        await Explore.findByIdAndUpdate(
          req.params.id,
          {
            title:
              req.body.title,

            description:
              req.body.description,

            buttonText:
              req.body.buttonText,

            buttonLink:
              req.body.buttonLink,

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

      if (!item) {
        return res.status(404).json({
          success: false,

          message:
            "Explore item not found",
        });
      }

      notifyClients(
        "explore-updated"
      );

      res.json({
        success: true,

        message:
          "Explore item updated successfully",

        data: item,
      });
    } catch (error) {
      console.error(
        "Explore update error:",
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

/* =========================================================
   DELETE EXPLORE
========================================================= */

app.delete(
  "/api/explore/:id",
  async (req, res) => {
    try {
      const item =
        await Explore.findByIdAndDelete(
          req.params.id
        );

      if (!item) {
        return res.status(404).json({
          success: false,

          message:
            "Explore item not found",
        });
      }

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
        "Explore delete error:",
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
   CALENDAR MODEL
   Stored in MongoDB collection:
   calendar
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
    "calendar"
  );
}

/* =========================================================
   GET CALENDAR
========================================================= */

app.get(
  "/api/calendar",
  async (req, res) => {
    try {
      const collection =
        getCalendarCollection();

      let calendar =
        await collection.findOne({});

      if (!calendar) {
        calendar = {
          url: "",
          fileUrl: "",
          fileType: "",
          fileName: "",
          createdAt:
            new Date(),
          updatedAt:
            new Date(),
        };
      }

      res.json(calendar);
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

/* =========================================================
   SAVE CALENDAR
========================================================= */

app.put(
  "/api/calendar",
  upload.single("file"),
  async (req, res) => {
    try {
      const collection =
        getCalendarCollection();

      let calendar =
        await collection.findOne({});

      if (!calendar) {
        calendar = {
          url: "",
          fileUrl: "",
          fileType: "",
          fileName: "",
          createdAt:
            new Date(),
          updatedAt:
            new Date(),
        };
      }

      /*
        URL
      */

      if (
        req.body.url !==
        undefined
      ) {
        calendar.url =
          req.body.url.trim();
      }

      /*
        Uploaded file
      */

      if (req.file) {
        /*
          Delete old uploaded calendar
        */

        if (
          calendar.fileUrl
        ) {
          deleteImage(
            calendar.fileUrl
          );
        }

        calendar.fileUrl =
          normalizeFileUrl(
            req.file
          );

        calendar.fileType =
          req.file.mimetype;

        calendar.fileName =
          req.file.originalname;
      }

      calendar.updatedAt =
        new Date();

      if (
        !calendar.createdAt
      ) {
        calendar.createdAt =
          new Date();
      }

      /*
        Remove existing document
        and create one clean record.
      */

      await collection.deleteMany(
        {}
      );

      await collection.insertOne(
        calendar
      );

      notifyClients(
        "calendar-updated"
      );

      res.json({
        success: true,

        message:
          "Calendar saved successfully",

        data: calendar,
      });
    } catch (error) {
      console.error(
        "Calendar save error:",
        error
      );

      if (req.file) {
        removeUploadedFiles(
          req.file
        );
      }

      res.status(500).json({
        success: false,

        message:
          "Failed to save calendar",

        error:
          error.message,
      });
    }
  }
);

/* =========================================================
   DELETE CALENDAR
========================================================= */

app.delete(
  "/api/calendar",
  async (req, res) => {
    try {
      const collection =
        getCalendarCollection();

      const calendar =
        await collection.findOne({});

      if (!calendar) {
        return res.json({
          success: true,

          message:
            "Calendar already empty",
        });
      }

      if (
        calendar.fileUrl
      ) {
        deleteImage(
          calendar.fileUrl
        );
      }

      await collection.deleteMany(
        {}
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
        "Calendar delete error:",
        error
      );

      res.status(500).json({
        success: false,

        message:
          "Failed to delete calendar",

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

          order: 1,
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

          order: 2,
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

          order: 3,
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

          image: "",

          link: "#",

          order: 1,
        },

        {
          title:
            "Youth Rally & Concert",

          date:
            "September 12",

          time:
            "6:30 PM",

          image: "",

          link: "#",

          order: 2,
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

      console.log(
        "Default Welcome data created."
      );
    }

    /*
      EXPLORE
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

          order: 1,
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

          order: 2,
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

          order: 3,
        },
      ]);

      console.log(
        "Default Explore items created."
      );
    }

    /*
      BACKGROUND COLLECTION
    */

    const backgroundCollection =
      getBackgroundCollection();

    const backgroundCount =
      await backgroundCollection.countDocuments();

    if (
      backgroundCount === 0
    ) {
      console.log(
        "Home background collection ready."
      );
    }

    /*
      CALENDAR COLLECTION
    */

    const calendarCollection =
      getCalendarCollection();

    const calendarCount =
      await calendarCollection.countDocuments();

    if (
      calendarCount === 0
    ) {
      console.log(
        "Calendar collection ready."
      );
    }

    console.log(
      "Database seed check completed."
    );
  } catch (error) {
    console.error(
      "Database seed error:",
      error
    );
  }
}

/* =========================================================
   MULTER / SERVER ERROR HANDLER
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
      return res.status(400).json({
        success: false,

        message:
          error.message,
      });
    }

    res.status(500).json({
      success: false,

      message:
        error.message ||
        "Internal server error",
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