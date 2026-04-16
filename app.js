const express = require("express");
const mysql = require("mysql2");
const multer = require("multer");
const AWS = require("aws-sdk");
const path = require("path");
require("dotenv").config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const upload = multer({ storage: multer.memoryStorage() });

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

app.get("/api/laporan", (req, res) => {
  db.query("SELECT * FROM laporan ORDER BY created_at DESC", (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

app.post("/api/laporan", upload.single("foto"), (req, res) => {
  const { judul, deskripsi, lokasi, lat, lng } = req.body;

  const latVal = lat ? parseFloat(lat) : null;
  const lngVal = lng ? parseFloat(lng) : null;

  const file = req.file;
  if (!file) return res.send("Foto wajib!");

  const fileName = Date.now() + "-" + file.originalname;

  s3.putObject(
    {
      Bucket: "cleancity-bucket-unik123",
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
    },
    (err) => {
      if (err) return res.send(err.message);

      const url = `https://cleancity-bucket-unik123.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;

      const sql = `
      INSERT INTO laporan (judul, deskripsi, lokasi, lat, lng, foto_url, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `;

      db.query(sql, [judul, deskripsi, lokasi, latVal, lngVal, url], (err) => {
        if (err) return res.send("DB Error");

        res.send("Berhasil 🚀");
      });
    },
  );
});

app.listen(3000, "0.0.0.0", () => {
  console.log("Server jalan di 3000");
});
