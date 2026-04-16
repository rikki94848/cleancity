const express = require("express");
const mysql = require("mysql2");
const multer = require("multer");
const AWS = require("aws-sdk");
const path = require("path"); // Tambahan untuk handling path

const app = express();
app.use(express.json());

// PENTING: Middleware untuk folder public harus di atas route API
// Agar saat buka http://localhost:3000 langsung muncul index.html
app.use(express.static(path.join(__dirname, "public")));

const upload = multer({ storage: multer.memoryStorage() });

/* =========================
   CONFIG S3
========================= */
const s3 = new AWS.S3({
  accessKeyId: "",
  secretAccessKey: "",
  region: "ap-southeast-2",
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
    console.log("❌ Koneksi RDS gagal:", err);
  } else {
    console.log("✅ Koneksi RDS berhasil 🚀");
  }
});

/* =========================
   API
========================= */

// GET: Ambil semua laporan
app.get("/api/laporan", (req, res) => {
  db.query("SELECT * FROM laporan ORDER BY created_at DESC", (err, result) => {
    if (err) return res.status(500).send(err);
    res.json(result);
  });
});

// POST: Upload ke S3 + Simpan ke RDS
app.post("/api/laporan", upload.single("foto"), (req, res) => {
  const { judul, deskripsi, lokasi } = req.body;
  const file = req.file;

  if (!file) return res.status(400).send("File tidak ada");

  const params = {
    Bucket: "cleancity-bucket-unik123",
    Key: Date.now() + "-" + file.originalname,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  s3.upload(params, (err, data) => {
    if (err) {
      console.log("❌ S3 Upload Error:", err);
      return res.status(500).send("Upload ke S3 gagal");
    }

    const fotoUrl = data.Location;

    db.query(
      "INSERT INTO laporan (judul, deskripsi, lokasi, foto_url, status) VALUES (?, ?, ?, ?, 'pending')",
      [judul, deskripsi, lokasi, fotoUrl],
      (err) => {
        if (err) {
          console.log("❌ RDS Insert Error:", err);
          return res.status(500).send("Gagal simpan ke database");
        }
        res.send("Laporan berhasil dikirim 🚀");
      },
    );
  });
});

// Route catch-all untuk melayani frontend (Opsional tapi berguna)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server jalan di http://localhost:${PORT}`);
});
