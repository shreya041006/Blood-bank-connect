const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

// DB connection
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "Shreya@04",
    database: "bloodlink"
});

db.connect(err => {
    if (err) console.log("DB Error:", err);
    else console.log("Connected to MySQL");
});

// ---------------- ROUTES ----------------

// Test
app.get("/", (req, res) => {
    res.send("Server running");
});

// ---------------- SIGNUP ----------------
app.post("/signup", (req, res) => {
    const { name, email, password, role, city, state } = req.body;

    if (!name || !email || !password || !role || !city || !state) {
        return res.status(400).json({ message: "All fields required" });
    }

    const sql = `
        INSERT INTO users (name, email, password, role, city, state)
        VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [name, email, password, role, city, state], (err) => {
        if (err) return res.status(500).json({ message: "Database error" });
        res.json({ message: "User Registered" });
    });
});

// ---------------- LOGIN ----------------
app.post("/login", (req, res) => {
    const { email, password } = req.body;

    const sql = "SELECT * FROM users WHERE email=? AND password=?";

    db.query(sql, [email, password], (err, result) => {
        if (err) return res.send("Error");

        if (result.length > 0) {
            res.json({
                message: "Login successful",
                id: result[0].id,
                role: result[0].role
            });
        } else {
            res.json({ message: "Invalid credentials" });
        }
    });
});


// ---------------- SEARCH BLOOD ----------------
app.get("/search-blood", (req, res) => {
    const { city, state, group } = req.query;

    if (!city || !state || !group) {
        return res.status(400).json({ message: "City, State, and Blood Group are required" });
    }

    const map = {
        "A+": "A_pos", "A-": "A_neg",
        "B+": "B_pos", "B-": "B_neg",
        "O+": "O_pos", "O-": "O_neg",
        "AB+": "AB_pos", "AB-": "AB_neg"
    };

    const column = map[group];

    if (!column) {
        return res.status(400).json({ message: "Invalid blood group" });
    }

    const sql = `
    SELECT 
        u.id,
        u.name,
        u.city,
        u.state,
        b.${column} AS available
    FROM users u
    JOIN bloodstock b ON u.id = b.bloodbank_id
    WHERE u.role = 'bloodbank'
    AND LOWER(u.city) = LOWER(?)
    AND LOWER(u.state) = LOWER(?)
    AND b.${column} > 0
    `;

    db.query(sql, [city, state], (err, result) => {
        if (err) {
            console.error("Search SQL Error:", err);
            return res.status(500).json({ message: "Database error during search" });
        }

        res.json(result);
    });
});


// ---------------- UPDATE STOCK ----------------
app.post("/update-stock", (req, res) => {
    const {
        bloodbank_id,
        A_pos = 0, A_neg = 0,
        B_pos = 0, B_neg = 0,
        O_pos = 0, O_neg = 0,
        AB_pos = 0, AB_neg = 0
    } = req.body;

    const sql = `
INSERT INTO bloodstock
(bloodbank_id, A_pos, A_neg, B_pos, B_neg, O_pos, O_neg, AB_pos, AB_neg)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) AS new
ON DUPLICATE KEY UPDATE
    bloodstock.A_pos = bloodstock.A_pos + new.A_pos,
    bloodstock.A_neg = bloodstock.A_neg + new.A_neg,
    bloodstock.B_pos = bloodstock.B_pos + new.B_pos,
    bloodstock.B_neg = bloodstock.B_neg + new.B_neg,
    bloodstock.O_pos = bloodstock.O_pos + new.O_pos,
    bloodstock.O_neg = bloodstock.O_neg + new.O_neg,
    bloodstock.AB_pos = bloodstock.AB_pos + new.AB_pos,
    bloodstock.AB_neg = bloodstock.AB_neg + new.AB_neg
`;


    db.query(
        sql,
        [bloodbank_id, A_pos, A_neg, B_pos, B_neg, O_pos, O_neg, AB_pos, AB_neg],
        (err) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ message: "Error updating stock" });
            }

            res.json({ message: "Stock added/updated successfully ✅" });
        }
    );
});




// ---------------- SEND REQUEST ----------------
app.post("/request", (req, res) => {
    const { hospital_id, bloodbank_id, blood_group, quantity } = req.body;

    console.log("REQUEST DATA:", req.body); // 👈 debug

    // ✅ validation
    if (!hospital_id || !bloodbank_id || !blood_group || !quantity) {
        return res.status(400).send("Missing data ❌");
    }

    const sql = `
    INSERT INTO requests (hospital_id, bloodbank_id, blood_group, quantity, status)
    VALUES (?, ?, ?, ?, 'pending')
    `;

    db.query(sql, [hospital_id, bloodbank_id, blood_group, quantity], (err) => {
        if (err) {
            console.error("DB ERROR:", err); // 👈 IMPORTANT
            return res.status(500).send("Database error ❌");
        }

        res.send("Request Sent Successfully ✅");
    });
});



// ---------------- VIEW REQUESTS ----------------

// Hospital view (Path param)
app.get("/requests/hospital/:hospital_id", (req, res) => {
    const id = req.params.hospital_id;

    const sql = `
    SELECT r.*, u.name as bloodbank_name 
    FROM requests r
    JOIN users u ON r.bloodbank_id = u.id
    WHERE r.hospital_id = ?
    ORDER BY r.id DESC
    `;

    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "Database error" });
        }
        res.json(result);
    });
});

// Blood bank view (Query param)
app.get("/requests/bloodbank", (req, res) => {
    const bloodbank_id = req.query.bloodbank_id;

    if (!bloodbank_id) {
        return res.status(400).json({ message: "Blood Bank ID required" });
    }

    const sql = `
    SELECT r.*, u.name as hospital_name 
    FROM requests r
    JOIN users u ON r.hospital_id = u.id
    WHERE r.bloodbank_id = ?
    ORDER BY r.id DESC
    `;

    db.query(sql, [bloodbank_id], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "Database error" });
        }
        res.json(result);
    });
});

// ---------------- UPDATE REQUEST (ACCEPT/REJECT) ----------------
app.post("/update-request", (req, res) => {
    const { id, status } = req.body;

    if (!id || !status) {
        return res.status(400).json({ message: "ID and Status required" });
    }

    const getRequest = "SELECT * FROM requests WHERE id = ?";

    db.query(getRequest, [id], (err, result) => {
        if (err) return res.status(500).json({ message: "Database error" });
        if (result.length === 0) return res.status(404).json({ message: "Request not found" });

        const reqData = result[0];

        if (reqData.status !== "pending") {
            return res.json({ message: "Request already processed" });
        }

        if (status === "rejected") {
            return updateStatus(id, status, res);
        }

        if (status === "approved" || status === "accepted") {
            const finalStatus = "approved";
            const map = {
                "A+": "A_pos", "A-": "A_neg",
                "B+": "B_pos", "B-": "B_neg",
                "O+": "O_pos", "O-": "O_neg",
                "AB+": "AB_pos", "AB-": "AB_neg"
            };

            const column = map[reqData.blood_group];

            if (!column) return res.status(400).json({ message: "Invalid blood group" });

            const sql = `
            UPDATE bloodstock
            SET ${column} = ${column} - ?
            WHERE bloodbank_id = ? AND ${column} >= ?
            `;

            db.query(sql, [reqData.quantity, reqData.bloodbank_id, reqData.quantity], (err, result2) => {
                if (err) {
                    console.error("DB Update Error:", err);
                    return res.status(500).json({ message: "Database error during stock update" });
                }

                if (result2.affectedRows === 0) {
                    return res.json({ message: "Not enough stock available" });
                }

                updateStatus(id, finalStatus, res);
            });
        } else {
            res.status(400).json({ message: "Invalid status value" });
        }
    });
});

// helper
function updateStatus(id, status, res) {
    const sql = "UPDATE requests SET status=? WHERE id=?";

    db.query(sql, [status, id], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "Error updating request status" });
        }
        res.json({ message: "Request " + status + " successfully" });
    });
}

// ---------------- START SERVER ----------------
app.listen(5000, () => {
    console.log("Server running on port 5000");
});

