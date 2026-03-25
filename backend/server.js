const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();

app.use(express.json());
app.use(cors());

// MySQL connection
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "Shreya@04",
    database: "bloodlink"
});

db.connect((err) => {
    if (err) {
        console.log("DB Error:", err);
    } else {
        console.log("Connected to MySQL");
    }
});

// ------------------ ROUTES ------------------

// Test route
app.get("/", (req, res) => {
    res.send("Server is running");
});

// Signup
app.post("/signup", (req, res) => {
    const { name, email, password, role, latitude, longitude } = req.body;

    const sql = `
    INSERT INTO users (name, email, password, role, latitude, longitude)
    VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [name, email, password, role, latitude, longitude], (err) => {
        if (err) res.send("Error");
        else res.send("User Registered");
    });
});


// Login
app.post("/login", (req, res) => {
    const { email, password } = req.body;

    const sql = "SELECT * FROM users WHERE email = ? AND password = ?";

    db.query(sql, [email, password], (err, result) => {
        if (err) {
            console.log(err);
            res.send("Error");
        } else {
            if (result.length > 0) {
                res.json({
                    message: "Login successful",
                    role: result[0].role,
                    id: result[0].id
                });
            } else {
                res.json({
                    message: "Invalid credentials"
                });
            }
        }
    });
});

// Search blood
app.get("/search", (req, res) => {
    const group = req.query.group;

    const sql = `SELECT * FROM bloodstock WHERE ${group} > 0`;

    db.query(sql, (err, result) => {
        if (err) {
            console.log(err);
            res.send("Error");
        } else {
            res.json(result);
        }
    });
});

// Update stock
app.post("/update-stock", (req, res) => {
    const { bloodbank_id, A_pos, B_pos, O_pos } = req.body;

    const sql = `
    INSERT INTO bloodstock (bloodbank_id, A_pos, B_pos, O_pos)
    VALUES (?, ?, ?, ?)
    `;

    db.query(sql, [bloodbank_id, A_pos, B_pos, O_pos], (err) => {
        if (err) {
            console.log(err);
            res.send("Error");
        } else {
            res.send("Stock Updated");
        }
    });
});

// Send request (IMPORTANT)
app.post("/request", (req, res) => {
    const { hospital_id, bloodbank_id, blood_group, quantity } = req.body;

    const sql = `
    INSERT INTO requests (hospital_id, bloodbank_id, blood_group, quantity, status)
    VALUES (?, ?, ?, ?, 'pending')
    `;

    db.query(sql, [hospital_id, bloodbank_id, blood_group, quantity], (err) => {
        if (err) {
            console.log(err);
            res.send("Error");
        } else {
            res.send("Request Sent");
        }
    });
});

// Get requests (blood bank dashboard)
app.get("/requests", (req, res) => {
    const hospital_id = req.query.hospital_id;

    let sql;
    let values = [];

    if (hospital_id) {
        sql = "SELECT * FROM requests WHERE hospital_id = ?";
        values = [hospital_id];
    } else {
        sql = "SELECT * FROM requests";
    }

    db.query(sql, values, (err, result) => {
        if (err) {
            console.log(err);
            res.send("Error");
        } else {
            res.json(result);
        }
    });
});


// Update request status (approve/reject)
app.post("/update-request", (req, res) => {
    const { id, status } = req.body;

    const sql = "UPDATE requests SET status = ? WHERE id = ?";

    db.query(sql, [status, id], (err) => {
        if (err) {
            console.log(err);
            res.send("Error");
        } else {
            res.send("Updated");
        }
    });
});

// ------------------ START SERVER ------------------

app.listen(5000, () => {
    console.log("Server running on port 5000");
});

app.get("/nearest-blood", (req, res) => {
    const { lat, long, group } = req.query;

    const sql = `
    SELECT 
        u.id,
        u.name,
        b.${group},
        (
            6371 * acos(
                cos(radians(?)) *
                cos(radians(u.latitude)) *
                cos(radians(u.longitude) - radians(?)) +
                sin(radians(?)) *
                sin(radians(u.latitude))
            )
        ) AS distance
    FROM users u
    JOIN bloodstock b ON u.id = b.bloodbank_id
    WHERE u.role = 'bloodbank' AND b.${group} > 0
    ORDER BY distance ASC, b.${group} DESC
    `;

    db.query(sql, [lat, long, lat], (err, result) => {
        if (err) {
            console.log(err);
            res.send("Error");
        } else {
            res.json(result);
        }
    });
});
