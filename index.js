const express = require('express');
const { Client } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { startAttendanceScheduler } = require('./attendance_scheduler'); 

const connectionString =process.env.DATABASE_URL || "postgres://postgres:sql@123@localhost:5432/Presense360"
const client = new Client({
  connectionString, 
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

client.connect()
    .then(() => {
        console.log('Connected to PostgreSQL database');
        startAttendanceScheduler(client);
    })
    .catch(err => console.error('Connection error', err.stack));

const app = express();
app.use(cors());
app.use(express.json());

const JWT_KEY='123456';
const AUTH_KEY='123456789';


const port = 3000;

const sendResponse = (res, status, message, data = null) => {
    res.status(status).json({ message, data });
};


async function verifyToken(req, res, next) {
    const bearerHeader = req.headers["authorization"];
    if (!bearerHeader) {
        return res.status(401).json({ message: "No token provided" });
    }
    
    const token = bearerHeader.split(" ")[1];
    if (!token) {
        return res.status(401).json({ message: "Token format invalid" });
    }

    try {
        const decoded = jwt.verify(token, JWT_KEY);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ message: "Invalid or expired token" });
    }
}

// Database Health Check Endpoint
app.get('/api/ping', async (req, res) => {
    // A simple, fast query that verifies the database connection is active.
    const DB_HEALTH_QUERY = 'SELECT 1;'; 
    
    try {
        // Execute the lightweight query against PostgreSQL.
        // This will throw an error if the connection is dead (ECONNRESET) or if the DB is down.
        await client.query(DB_HEALTH_QUERY);
        
        // If the query succeeds, the connection is healthy.
        // Send status 200 OK with a clear message.
        res.status(200).json({ 
            message: "Server and Database connection are healthy.",
            database: "OK"
        });

    } catch (error) {
        // If the query fails, the connection is broken.
        console.error("Health Check Failed: Database connection error.", error);
        
        // Send a 503 Service Unavailable or 500 Internal Server Error.
        // 503 is often better for monitoring tools as it indicates the dependency is down.
        res.status(503).json({ 
            message: "Database connection failed.",
            database: "ERROR",
            error: error.code || error.message
        });
    }
});

app.get('/api/pingpoint', async(req,res)=>{
    sendResponse(res,200,'OK');
})

// ====================================================================
// New Endpoint
// ====================================================================

// GET: Fetch all available departments
app.get('/api/departments', async (req, res) => {
    try {
        const result = await client.query('SELECT ID, label FROM Department;');
        sendResponse(res, 200, 'Departments fetched successfully', result.rows);
    } catch (error) {
        console.error('Error fetching departments:', error);
        sendResponse(res, 500, 'Internal Server Error');
    }
});

// ====================================================================
// Existing Endpoints (unchanged)
// ====================================================================

// GET: Fetch all employees
app.get('/api/employees', async (req, res) => {
    try {
        const query = `
            SELECT
                ui.ID,
                ui.Name,
                ui.mobile,
                ui.Dept,
                li.LOCID,
                fi.Status as face_status,
                d.label as dept_label
            FROM User_Info ui
            LEFT JOIN Location_Info li ON ui.ID = li.ID
            LEFT JOIN Face_Info fi ON ui.ID = fi.ID
            LEFT JOIN Department d ON ui.Dept = d.ID;
        `;
        const result = await client.query(query);
        sendResponse(res, 200, 'Employees fetched successfully', result.rows);
    } catch (error) {
        console.error('Error fetching employees:', error);
        sendResponse(res, 500, 'Internal Server Error');
    }
});

// GET: Fetch all available locations
app.get('/api/locations', async (req, res) => {
    try {
        const result = await client.query('SELECT ID FROM Locations;');
        sendResponse(res, 200, 'Locations fetched successfully', result.rows.map(row => row.id));
    } catch (error) {
        console.error('Error fetching locations:', error);
        sendResponse(res, 500, 'Internal Server Error');
    }
});

// POST: Add a new employee
app.post('/api/employees', async (req, res) => {
    const { ID, Name, mobile, Dept, LOCID } = req.body;
    
    if (!ID || !Name || !mobile || !Dept || !LOCID) {
        return sendResponse(res, 400, 'Missing required fields');
    }

    try {
        await client.query('BEGIN');
        const userInsert = `INSERT INTO User_Info (ID, Name, mobile, Dept) VALUES ($1, $2, $3, $4) RETURNING *;`;
        const userResult = await client.query(userInsert, [ID, Name, mobile, Dept]);
        const loginInsert=`INSERT INTO Login_Info (ID,password) VALUES ($1,$2);`
        const faceInsert = `INSERT INTO Face_Info (ID, Status) VALUES ($1, 0);`;
        await client.query(faceInsert, [ID]);
        const locationInsert = `INSERT INTO Location_Info (ID, LOCID) VALUES ($1, $2);`;
        await client.query(locationInsert, [ID, LOCID]);
        await client.query(loginInsert, [ID, '12345']);
        await client.query('COMMIT');
        
        sendResponse(res, 201, 'Employee added successfully', userResult.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error adding employee:', error);
        sendResponse(res, 500, 'Internal Server Error');
    }
});

// Update an employee

// New PUT route for updating an existing employee
app.put('/api/employees/:id', async (req, res) => {
    const { Name, mobile, Dept, LOCID } = req.body;
    const { id } = req.params; // Extract ID from the URL

    // Validate that all required fields are present
    if (!id || !Name || !mobile || !Dept || !LOCID) {
        return sendResponse(res, 400, 'Missing required fields');
    }

    try {
        await client.query('BEGIN'); // Start a transaction

        // Update User_Info table
        const userUpdateQuery = `UPDATE User_Info SET Name = $1, mobile = $2, Dept = $3 WHERE ID = $4;`;
        await client.query(userUpdateQuery, [Name, mobile, Dept, id]);

        // Update Location_Info table
        const locationUpdateQuery = `UPDATE Location_Info SET LOCID = $1 WHERE ID = $2;`;
        await client.query(locationUpdateQuery, [LOCID, id]);

        await client.query('COMMIT'); // Commit the transaction if successful

        sendResponse(res, 200, 'Employee updated successfully');
    } catch (error) {
        await client.query('ROLLBACK'); // Rollback the transaction on error
        console.error('Error updating employee:', error);
        sendResponse(res, 500, 'Internal Server Error');
    }
});

// DELETE: Remove an employee
app.delete('/api/employees/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM Location_Info WHERE ID = $1;', [id]);
        await client.query('DELETE FROM Face_Info WHERE ID = $1;', [id]);
        await client.query('DELETE FROM Login_Info WHERE ID = $1;', [id]);
        await client.query('DELETE FROM Device_ID WHERE ID = $1;', [id]);
        await client.query('DELETE FROM User_Attendance WHERE ID = $1;', [id]);
        await client.query('DELETE FROM User_Info WHERE ID = $1;', [id]);
        await client.query('COMMIT');
        sendResponse(res, 200, 'Employee deleted successfully');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error deleting employee:', error);
        sendResponse(res, 500, 'Internal Server Error');
    }
});

// PATCH: Update the face registration status
app.patch('/api/employees/face/:id', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (status === undefined || (status !== 0 && status !== 1 && status !== 2)) {
        return sendResponse(res, 400, 'Invalid status value. Must be 0 or 1.');
    }

    try {
        const query = `UPDATE Face_Info SET Status = $1 WHERE ID = $2;`;
        await client.query(query, [status, id]);
        sendResponse(res, 200, `Face status updated to ${status} for ID ${id}`);
    } catch (error) {
        console.error('Error updating face status:', error);
        sendResponse(res, 500, 'Internal Server Error');
    }
});



app.post('/api/settings/locations', async (req, res) => {
    const { id, coordinates } = req.body;

    if (!id || !coordinates || !Array.isArray(coordinates)) {
        return res.status(400).json({ error: 'Missing location ID or valid coordinates array' });
    }

    try {
        // Upsert logic: Insert new location or update coordinates if ID exists
        const query = `
            INSERT INTO locations (id, coordinates) 
            VALUES ($1, $2)
            ON CONFLICT (id) 
            DO UPDATE SET coordinates = EXCLUDED.coordinates
            RETURNING *;
        `;
        
        // coordinates is stored as jsonb, so we pass it directly (pg handles the conversion)
        const values = [id, JSON.stringify(coordinates)];
        const result = await client.query(query, values);

        res.status(200).json({
            message: 'Location saved successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error saving location:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * GET: Fetch all saved geofences
 * Endpoint: /api/locations
 */
app.get('/api/settings/locations', async (req, res) => {
    try {
        const result = await client.query('SELECT * FROM locations ORDER BY id ASC;');
        res.status(200).json({
            message: 'Locations retrieved successfully',
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching locations:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * DELETE: Remove a geofence by ID
 * Endpoint: /api/locations/:id
 */
app.delete('/api/settings/locations/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await client.query('DELETE FROM locations WHERE id = $1 RETURNING id;', [id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Location not found' });
        }

        res.status(200).json({
            message: 'Location deleted successfully',
            id: id
        });
    } catch (error) {
        // Handle foreign key constraint errors (e.g. location_info referencing this location)
        if (error.code === '23503') {
            return res.status(409).json({ 
                error: 'Cannot delete location as it is currently assigned to employees.' 
            });
        }
        console.error('Error deleting location:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


app.get('/api/settings/shift/:deptId', async (req, res) => {
    let { deptId } = req.params;
    const targetId = deptId === 'all' ? 0 : parseInt(deptId, 10);

    if (isNaN(targetId) && deptId !== 'all') {
        return sendResponse(res, 400, 'Invalid Department ID. Expected a number.');
    }

    try {
        const result = await client.query(
            'SELECT entry_cap AS "entryCap", exit_cap AS "exitCap" FROM ShiftSettings WHERE department_id = $1',
            [targetId]
        );

        if (result.rows.length === 0) {
            return sendResponse(res, 200, 'Default settings returned', { entryCap: '09:00', exitCap: '18:00' });
        }

        sendResponse(res, 200, 'Shift settings retrieved', result.rows[0]);
    } catch (error) {
        console.error('Error fetching shift settings:', error);
        sendResponse(res, 500, 'Internal Server Error');
    }
});

/**
 * Update shift settings (Upsert logic)
 */
app.post('/api/settings/shift', async (req, res) => {
    const { department_id, entryCap, exitCap } = req.body;
    const targetId = department_id === 'all' ? 0 : parseInt(department_id, 10);

    if (isNaN(targetId) && department_id !== 'all') {
        return sendResponse(res, 400, 'Invalid Department ID. Expected a number.');
    }

    try {
        const query = `
            INSERT INTO ShiftSettings (department_id, entry_cap, exit_cap)
            VALUES ($1, $2, $3)
            ON CONFLICT (department_id)
            DO UPDATE SET 
                entry_cap = EXCLUDED.entry_cap,
                exit_cap = EXCLUDED.exit_cap
            RETURNING department_id, entry_cap AS "entryCap", exit_cap AS "exitCap";
        `;
        const result = await client.query(query, [targetId, entryCap, exitCap]);
        sendResponse(res, 200, 'Shift settings updated successfully', result.rows[0]);
    } catch (error) {
        console.error('Error updating shift settings:', error);
        sendResponse(res, 500, 'Internal Server Error');
    }
});

app.get("/geocoordinates", verifyToken, async (req, res) => {
    const userID = req.user.rollno;
    console.log("Acquiring coordinates for user ID:", userID);

    try {
        const queryText = `
            SELECT T3.coordinates
            FROM User_Info AS T1
            INNER JOIN Location_Info AS T2
                ON T1.ID = T2.ID
            INNER JOIN Locations AS T3
                ON T2.LOCID = T3.ID
            WHERE T1.ID = $1;
        `;
        const result = await client.query(queryText, [userID]);

        if (result.rows.length === 0) {
            // 404 Not Found: No coordinates found for this user.
            return res.status(404).json({ message: "No coordinates found for this user." });
        }

        console.log("Found coordinates:", result.rows);
        // 200 OK: The request has succeeded.
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error acquiring coordinates:", err);
        // 500 Internal Server Error: The server has encountered a situation it doesn't know how to handle.
        res.status(500).json({ message: "Internal server error", error: err.message });
    }
});



app.post('/login', async (req, res) => {
    const { user, pass, id } = req.body;

    if (!user || !pass || !id) {
        return res.status(400).json({ message: "Missing required fields" });
    }

    try {
        // 1. Check if the user exists and the password is correct
        const userResult = await client.query('SELECT * FROM Login_Info WHERE id = $1', [user]);
        const loginData = userResult.rows[0];

        if (!loginData) {
            console.log("Wrong user");
            return res.status(401).json({ message: "Invalid username or password" });
        }

        if (loginData.password !== pass) {
            console.log("Wrong password");
            return res.status(401).json({ message: "Invalid username or password" });
        }

        // 2. Check the device ID
        const deviceResult = await client.query('SELECT * FROM device_id WHERE id = $1', [user]);
        const deviceData = deviceResult.rows[0];

        // Case A: First-time login from a new device
        if (!deviceData) {
            await client.query('INSERT INTO device_id (id, dev_id) VALUES ($1, $2)', [user, id]);
            console.log("Login successful, new device registered");
            const token = jwt.sign({ rollno: user, id: id }, JWT_KEY, { expiresIn: "1Y" });
            return res.status(201).json({ message: "Login successful, new device registered", token });
        }

        // Case B: Login from the already-registered device
        if (deviceData.dev_id === id) {
            console.log("Login successful");
            const token = jwt.sign({ rollno: user, id: id }, JWT_KEY, { expiresIn: "1Y" });
            return res.status(200).json({ message: "Login successful", token });
        }

        // Case C: Login from a different device
        console.log("Account already registered on another device");
        return res.status(403).json({ message: "Account already registered on another device. Please use the original device." });

    } catch (error) {
        console.error("Database or server error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
});

app.get("/verify", verifyToken, (req, res) => {
    // If we get here, the token has been successfully verified by the middleware.
    console.log("Token is valid for user:", req.user.rollno); // Log the user for server-side clarity
    res.status(200).json({ message: "Token is valid", status: "success" });
});




function getFormattedDateTime() {
    const now = new Date();

    // IST Offset is UTC + 5.5 hours (330 minutes)
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const istTime = new Date(utcTime + (330 * 60000));

    // Helper to pad numbers (e.g., 9 -> 09)
    const pad = (num) => num.toString().padStart(2, '0');

    const year = istTime.getFullYear();
    const month = pad(istTime.getMonth() + 1);
    const day = pad(istTime.getDate());
    
    const hours = pad(istTime.getHours());
    const minutes = pad(istTime.getMinutes());
    const seconds = pad(istTime.getSeconds());

    const date = `${year}-${month}-${day}`;
    const time = `${hours}:${minutes}:${seconds}`;

    return `${date} ${time}`;
}


// ====================================================================
// New Endpoint for Face Status
// ====================================================================

// GET: Fetch the user's face registration status
app.get("/face-status", verifyToken, async (req, res) => {
    const userID = req.user.rollno;
    try {
        const result = await client.query('SELECT Status FROM Face_Info WHERE ID = $1;', [userID]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Face status not found for this user." });
        }
        res.status(200).json({ status: result.rows[0].status });
    } catch (err) {
        console.error("Error fetching face status:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// POST: Update the user's face registration status
app.post("/face-status/update", verifyToken, async (req, res) => {
    const userID = req.user.rollno;
    const { status } = req.body;
    if (status === undefined || (status !== 0 && status !== 1 && status !== 2)) {
        return res.status(400).json({ message: "Invalid status value. Must be 0, 1, or 2." });
    }

    try {
        await client.query('UPDATE Face_Info SET Status = $1 WHERE ID = $2;', [status, userID]);
        res.status(200).json({ message: "Face status updated successfully." });
    } catch (err) {
        console.error("Error updating face status:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// ====================================================================
// Check-in and Check-out Endpoints
// ====================================================================

// GET: Get user's check-in status
app.get("/dashboard/status/stat", verifyToken, async (req, res) => {
    const user = req.user.rollno;
    const today = getFormattedDateTime().slice(0, 10);

    try {
        const result = await client.query('SELECT * FROM user_attendance WHERE ID = $1 AND currdate = $2', [user, today]);

        if (result.rows.length === 0) {
            // User has no entry for today, so they are not checked in
            return res.status(200).json({ message: "No entry found for today" });
        }

        // Return the existing entry
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error("Error fetching check-in status:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// POST: Check-in logic
app.post("/dashboard/status/checkin", verifyToken, async (req, res) => {
    const user = req.user.rollno;
    const datetime = getFormattedDateTime();
    const date = datetime.slice(0, 10);
    const time = datetime.slice(11, 19);

    try {
        const existingEntry = await client.query('SELECT * FROM user_attendance WHERE ID = $1 AND currdate = $2', [user, date]);

        if (existingEntry.rows.length === 0) {
            // No entry exists, insert a new one
            await client.query('INSERT INTO user_attendance (ID, currdate, checkin, checkout, type) VALUES ($1, $2, $3, NULL, 0)', [user, date, time]);
            return res.status(201).json({ message: "Checked in successfully" });
        } else if (existingEntry.rows[0].checkin === null) {
            // Entry exists but no check-in time is recorded (e.g., from a leave request)
            await client.query('UPDATE user_attendance SET type = 0, checkin = $1 WHERE ID = $2 AND currdate = $3', [time, user, date]);
            return res.status(200).json({ message: "Checked in successfully" });
        } else {
            // User is already checked in
            return res.status(400).json({ message: "Already checked in" });
        }
    } catch (err) {
        console.error("Error during checkin:", err);
        return res.status(500).json({ message: "Internal server error" });
    }
});

// POST: Checkout logic
app.post("/dashboard/status/checkout", verifyToken, async (req, res) => {
    const user = req.user.rollno;
    const datetime = getFormattedDateTime();
    const date = datetime.slice(0, 10);
    const time = datetime.slice(11, 19);

    try {
        const existingEntry = await client.query('SELECT * FROM user_attendance WHERE ID = $1 AND currdate = $2', [user, date]);

        if (existingEntry.rows.length === 0 || existingEntry.rows[0].checkin === null) {
            // User has no entry for today or has not checked in
            return res.status(400).json({ message: "Not checked in for today" });
        } else if (existingEntry.rows[0].checkout !== null) {
            // User has already checked out
            return res.status(400).json({ message: "Already checked out" });
        } else {
            // Update the existing entry with checkout time
            await client.query('UPDATE user_attendance SET checkout = $1 WHERE ID = $2 AND currdate = $3', [time, user, date]);
            return res.status(200).json({ message: "Checked out successfully" });
        }
    } catch (err) {
        console.error("Error during checkout:", err);
        return res.status(500).json({ message: "Internal server error" });
    }
});



app.get("/dashboard", verifyToken, async (req, res) => {
    const userID = req.user.rollno; // Assuming rollno maps to ID

    try {
        const queryText = `
            SELECT 
                ui.ID, 
                ui.Name, 
                ui.mobile, 
                d.label AS Dept
            FROM User_Info ui
            INNER JOIN Department d ON ui.Dept = d.ID
            WHERE ui.ID = $1;
        `;

        const result = await client.query(queryText, [userID]);

        if (result.rows.length === 0) {
            console.log(`User with ID ${userID} not found.`);
            return res.status(404).json({ message: 'User not found.' });
        }

        console.log("Dashboard data fetched:", result.rows[0]);
        res.status(200).json(result.rows[0]);

    } catch (err) {
        console.error("Error fetching dashboard data:", err);
        res.status(500).json({ message: "Internal server error", error: err.message });
    }
});

app.get("/attendance", verifyToken, async (req, res) => {
    // Assuming 'rollno' from the JWT token maps to 'ID' in the database.
    const userID = req.user.rollno;
    
    try {
        const queryText = `
            SELECT 
                currdate, 
                checkin, 
                checkout, 
                type
            FROM user_attendance
            WHERE ID = $1
            ORDER BY currdate DESC;
        `;
        
        const result = await client.query(queryText, [userID]);

        // 200 OK: Return the array of attendance records.
        res.status(200).json({ 
            message: "Attendance records fetched successfully",
            data: result.rows 
        });

    } catch (err) {
        console.error("Error fetching attendance for user", userID, ":", err);
        
        // 500 Internal Server Error: Send a detailed JSON error response.
        res.status(500).json({ 
            message: "Internal server error while retrieving attendance data",
            error: err.message 
        });
    }
});


const SHIFT_START_TIME = '09:00:00'; // Define the standard shift start time here

app.get("/api/attendance/report", async (req, res) => {
    
    try {
        const queryText = `
            SELECT 
                ua.ID,
                ui.Name AS employee_name, 
                ua.currdate, 
                ua.checkin, 
                ua.checkout, 
                ua.type,
                li.LOCID, -- NEW: Location ID
                d.label AS dept_label, -- NEW: Department Label
                
                -- 1. Infer final status label
                CASE
                    -- Type-based statuses (highest priority)
                    WHEN ua.type = 1 THEN 'On Leave (Standard)'
                    WHEN ua.type = 2 THEN 'On Leave (Medical)'
                    WHEN ua.type = 3 THEN 'Public Holiday'
                    WHEN ua.type = 4 THEN 'Absent'
                    WHEN ua.type = 5 AND ua.checkin IS NULL AND ua.checkout IS NULL THEN 'Not Checked In'

                    -- Attendance-based statuses (type 0 = Present)
                    WHEN ua.type = 0 AND ua.checkin IS NOT NULL AND ua.checkout IS NOT NULL THEN
                        CASE
                            WHEN ua.checkin > TIME '${SHIFT_START_TIME}' THEN 'Late'
                            ELSE 'Present'
                        END
                    WHEN ua.type = 0 AND ua.checkin IS NOT NULL AND ua.checkout IS NULL THEN 
                        'Present (Clocked In)'
                    
                    -- Catch-all
                    ELSE 'Unresolved'
                END AS final_status,
                
                -- 2. Infer Exception Reason
                CASE
                    WHEN ua.type = 4 THEN 'Confirmed Absence'
                    WHEN ua.type = 0 AND ua.checkout IS NULL AND ua.checkin IS NOT NULL THEN 'Missing Checkout'
                    WHEN ua.type = 0 AND ua.checkin > TIME '${SHIFT_START_TIME}' AND ua.checkout IS NOT NULL THEN 'Late Checkin'
                    ELSE NULL
                END AS exception_reason,

                -- 3. Calculate duration
                CASE
                    WHEN ua.checkin IS NOT NULL AND ua.checkout IS NOT NULL THEN
                        EXTRACT(EPOCH FROM (ua.checkout - ua.checkin)) / 3600
                    ELSE 
                        0
                END AS duration_hours,

                -- 4. Get Face Status (Assumed from a join to User_Info in the full service)
                fi.Status AS face_status
                
            FROM user_attendance ua
            -- REQUIRED JOINS
            INNER JOIN User_Info ui ON ua.ID = ui.ID
            LEFT JOIN Location_Info li ON ui.ID = li.ID -- Get Location ID (LOCID)
            LEFT JOIN Department d ON ui.Dept = d.ID     -- Get Department Label
            LEFT JOIN Face_Info fi ON ui.ID = fi.ID      -- Get Face Status
            -- END REQUIRED JOINS
            
            ORDER BY ua.currdate DESC, ui.Name ASC;
        `;
        
        const result = await client.query(queryText);

        res.status(200).json({ 
            message: "All attendance records fetched for admin report",
            data: result.rows 
        });

    } catch (err) {
        console.error("Error fetching admin report attendance data:", err);
        
        res.status(500).json({ 
            message: "Internal server error while retrieving attendance data",
            error: err.message 
        });
    }
});



app.listen(port,'0.0.0.0',() => {
    console.log(`Server is running on http://localhost:${port}`);
});



const { spawn } = require('child_process');

app.get('/backup-database', (req, res) => {
    // 1. Get your internal URL from environment variables
    // Format: postgres://user:password@internal-host:5432/db_name
    const dbUrl = connectionString;

    if (!dbUrl) {
        return res.status(500).send('Internal Database URL not found.');
    }

    // 2. Set headers so the browser treats the response as a file download
    const date = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Disposition', `attachment; filename="dump-${date}.sql"`);
    res.setHeader('Content-Type', 'application/sql');

    // 3. Spawn the pg_dump process
    // We use the full URL to pass credentials automatically
    const dump = spawn('pg_dump', [dbUrl]);

    // 4. Pipe the output directly to the Express response
    dump.stdout.pipe(res);

    // 5. Handle potential errors
    dump.stderr.on('data', (data) => {
        console.error(`pg_dump error: ${data}`);
    });

    dump.on('close', (code) => {
        if (code !== 0) {
            console.log(`pg_dump process exited with code ${code}`);
            if (!res.headersSent) {
                res.status(500).send('Backup failed');
            }
        }
    });
});