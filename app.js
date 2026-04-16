const express = require("express");
const mysql = require("mysql2");
const multer = require("multer");
const AWS = require("aws-sdk");
const path = require("path");
require("dotenv").config();

const app = express();

/* =========================
   MIDDLEWARE
========================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const upload = multer({ storage: multer.memoryStorage() });

/* =========================
   CONFIG S3
========================= */
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

/* =========================
   KONEKSI RDS
========================= */
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

db.getConnection((err, conn) => {
  if (err) {
    console.error("❌ Koneksi RDS gagal:", err);
  } else {
    console.log("✅ Koneksi RDS berhasil 🚀");
    conn.release();
  }
});

/* =========================
   API
========================= */

// GET laporan
app.get("/api/laporan", (req, res) => {
  db.query("SELECT * FROM laporan ORDER BY created_at DESC", (err, result) => {
    if (err) {
      console.error("❌ DB Error:", err);
      return res.status(500).json({ error: err.message });
    }
    res.json(result);
  });
});

// POST laporan
app.post("/api/laporan", upload.single("foto"), (req, res) => {
  console.log("📥 Request masuk /api/laporan");

  const { judul, deskripsi, lokasi, lat, lng } = req.body;

  const latVal = lat ? parseFloat(lat) : null;
  const lngVal = lng ? parseFloat(lng) : null;

  const file = req.file;

  if (!file) {
    return res.status(400).send("File foto wajib diunggah!");
  }

  const fileName = Date.now() + "-" + file.originalname;

  const params = {
    Bucket: "cleancity-bucket-unik123",
    Key: fileName,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  console.log("⬆️ Upload ke S3...");

  s3.putObject(params, (err) => {
    if (err) {
      console.error("❌ S3 Error:", err);
      return res.status(500).send("Gagal upload ke S3: " + err.message);
    }

    const fotoUrl = `https://${params.Bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;

    console.log("✅ S3 OK:", fotoUrl);

    const sql = `
      INSERT INTO laporan 
      (judul, deskripsi, lokasi, lat, lng, foto_url, status) 
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `;

    db.query(
      sql,
      [judul, deskripsi, lokasi, latVal, lngVal, fotoUrl],
      (err) => {
        if (err) {
          console.error("❌ DB Error:", err);
          return res.status(500).send("Gagal simpan ke database");
        }

        console.log("✅ Data masuk DB");
        res.send("Laporan berhasil dikirim 🚀");
      },
    );
  });
});

/* =========================
   RUN SERVER
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server jalan di port ${PORT}`);
});
