const express = require("express");
const mysql = require("mysql2");
const multer = require("multer");
const AWS = require("aws-sdk");
const path = require("path");

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const upload = multer({ storage: multer.memoryStorage() });

/* =========================
   CONFIG AWS S3
========================= */
require("dotenv").config();
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

/* =========================
   KONEKSI RDS
========================= */
const db = mysql.createConnection({
  host: "cleancity-db.cbyyk0kkin4o.ap-southeast-2.rds.amazonaws.com",
  user: "rikki",
  password: "itenas123456",
  database: "cleancity",
});

db.connect((err) => {
  if (err) {
    console.error("❌ Koneksi RDS gagal:", err);
  } else {
    console.log("✅ Koneksi RDS berhasil 🚀");
  }
});

/* =========================
   API ROUTES
========================= */

// GET: Ambil laporan
app.get("/api/laporan", (req, res) => {
  db.query("SELECT * FROM laporan ORDER BY created_at DESC", (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(result);
  });
});

// POST: Upload ke S3 + Insert ke RDS
app.post("/api/laporan", upload.single("foto"), (req, res) => {
  console.log("DEBUG: Menerima request POST /api/laporan");

  const { judul, deskripsi, lokasi } = req.body;
  const file = req.file;

  if (!file) {
    console.log("❌ Upload Gagal: File tidak ditemukan");
    return res.status(400).send("File foto wajib diunggah!");
  }

  const params = {
    Bucket: "cleancity-bucket-unik123",
    Key: Date.now() + "-" + file.originalname,
    Body: file.buffer,
    ContentType: file.mimetype,
    ACL: "public-read", // Memastikan file bisa diakses publik
  };

  console.log("DEBUG: Memulai proses upload ke S3...");
  s3.upload(params, (err, data) => {
    if (err) {
      console.error("❌ S3 Upload Error:", err);
      return res.status(500).send("Gagal upload ke S3: " + err.message);
    }

    console.log("✅ Berhasil upload ke S3. URL:", data.Location);

    const fotoUrl = data.Location;
    const sql =
      "INSERT INTO laporan (judul, deskripsi, lokasi, foto_url, status) VALUES (?, ?, ?, ?, 'pending')";

    db.query(sql, [judul, deskripsi, lokasi, fotoUrl], (err) => {
      if (err) {
        console.error("❌ RDS Insert Error:", err);
        return res.status(500).send("Gagal simpan ke database");
      }
      console.log("✅ Data berhasil disimpan ke RDS");
      res.send("Laporan berhasil dikirim 🚀");
    });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server jalan di http://localhost:${PORT}`);
});
