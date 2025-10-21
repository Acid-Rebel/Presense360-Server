const cron = require('node-cron');
// NOTE: Assuming 'client' (PostgreSQL client) is initialized and connected 
// from your main server.js file.

/**
 * Inserts a default 'Absent' record (type 4) for all active users 
 * for the current day where no record yet exists.
 * * This should run immediately after midnight to prepare the attendance ledger.
 */
const runEndOfDayAttendanceJob = async () => {
    // Get the current date in 'YYYY-MM-DD' format
    const today = new Date().toISOString().slice(0, 10);
    const ABSENT_TYPE = 4; // 4 is the status code for Absent

    console.log(`[Scheduler] Starting End-of-Day attendance check for date: ${today}`);

    try {
        // 1. Get IDs of ALL active employees from User_Info
        const employeeQuery = 'SELECT ID FROM User_Info;';
        const employeeResult = await client.query(employeeQuery);
        const employeeIDs = employeeResult.rows.map(row => row.id);

        if (employeeIDs.length === 0) {
            console.log('[Scheduler] No employees found. Job finished.');
            return;
        }

        // 2. Prepare the list of values to insert
        // The values format will be: ('UserID1', 'YYYY-MM-DD', NULL, NULL, 4), ('UserID2', 'YYYY-MM-DD', NULL, NULL, 4), ...
        const valuesToInsert = employeeIDs.map(id => 
            `('${id}', '${today}', NULL, NULL, ${ABSENT_TYPE})`
        ).join(', ');

        // 3. Perform a bulk INSERT operation
        // Uses ON CONFLICT DO NOTHING to safely ignore rows where attendance for the day already exists.
        // This is necessary if a user checked in/out late yesterday or has an 'On Leave' entry already created.
        const insertQuery = `
            INSERT INTO user_attendance (ID, currdate, checkin, checkout, type) 
            VALUES ${valuesToInsert}
            ON CONFLICT (ID, currdate) DO NOTHING;
        `;

        const insertResult = await client.query(insertQuery);

        console.log(`[Scheduler] Successfully inserted ${insertResult.rowCount} new 'Absent' records for ${today}.`);

    } catch (error) {
        console.error(`[Scheduler ERROR] Failed to run attendance job for ${today}:`, error);
    }
};


/**
 * Schedule the job to run every day at 00:00 (midnight).
 * CRON format: minute hour day-of-month month day-of-week
 */
const startAttendanceScheduler = () => {
    // Ensure the job runs once immediately at service start for testing and alignment
    runEndOfDayAttendanceJob(); 
    
    // Schedule to run every day at 1 minute past midnight (to ensure the date has definitely rolled over)
    cron.schedule('1 0 * * *', runEndOfDayAttendanceJob, {
        timezone: "Asia/Kolkata" // Set to your required timezone (e.g., India Standard Time)
    });

    console.log('[Scheduler] Attendance job scheduled to run daily at 00:01.');
};

module.exports = { startAttendanceScheduler };