const cron = require('node-cron');
// NOTE: Assuming 'client' (PostgreSQL client) is initialized and connected 
// from your main server.js file.

// --- STATUS CODE DEFINITIONS ---
const PRE_DAY_TYPE = 5;      // Status for 'Not Checked In' (placeholder at start of day)
const FINAL_ABSENT_TYPE = 4; // Final status for 'Absent' (confirmed at end of day)
// --- END STATUS CODE DEFINITIONS ---


/**
 * PHASE 1: Pre-Day Setup
 * Inserts a default 'Not Checked In' record (type 5) for all employees for the current day.
 */
const runPreDaySetupJob = async (client) => {
    // Get the current date (which is the start of the new day)
    const today = new Date().toISOString().slice(0, 10);

    console.log(`[Scheduler] PHASE 1: Inserting PRE-DAY records (Type ${PRE_DAY_TYPE}) for date: ${today}`);

    try {
        // 1. Get IDs of ALL active employees
        const employeeQuery = 'SELECT ID FROM User_Info;';
        const employeeResult = await client.query(employeeQuery);
        const employeeIDs = employeeResult.rows.map(row => row.id);

        if (employeeIDs.length === 0) {
            console.log('[Scheduler] No employees found for pre-day setup. Job finished.');
            return;
        }

        // 2. Prepare the list of values to insert
        const valuesToInsert = employeeIDs.map(id => 
            // Insert ID, date, checkin=NULL, checkout=NULL, type=5
            `('${id}', '${today}', NULL, NULL, ${PRE_DAY_TYPE})`
        ).join(', ');

        // 3. Perform a bulk INSERT operation
        const insertQuery = `
            INSERT INTO user_attendance (ID, currdate, checkin, checkout, type) 
            VALUES ${valuesToInsert}
            -- Conflict logic prevents double inserts if a manual record exists
            ON CONFLICT (ID, currdate) DO NOTHING;
        `;

        const insertResult = await client.query(insertQuery);

        console.log(`[Scheduler] Inserted ${insertResult.rowCount} new 'Not Checked In' records (Type ${PRE_DAY_TYPE}).`);

    } catch (error) {
        console.error(`[Scheduler ERROR] PHASE 1 Failed for ${today}:`, error);
    }
};


/**
 * PHASE 2: End-of-Day Finalization
 * Scans the ledger for the PREVIOUS day and changes all remaining Type 5 records 
 * (which were never checked in) to Type 4 (FINAL ABSENT).
 */
const runEndOfDayFinalizationJob = async (client) => {
    // Calculate the PREVIOUS day's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const targetDate = yesterday.toISOString().slice(0, 10);

    console.log(`[Scheduler] PHASE 2: Finalizing attendance for date: ${targetDate}`);

    try {
        const updateQuery = `
            UPDATE user_attendance
            SET 
                type = ${FINAL_ABSENT_TYPE}, -- Change to final Absent (4)
                -- Optional: Also set checkin/checkout to NULL if they aren't already
                checkin = NULL,
                checkout = NULL
            WHERE 
                currdate = $1 AND 
                type = ${PRE_DAY_TYPE} AND -- Target only records still marked as PRE_DAY_TYPE (5)
                checkin IS NULL;           -- Ensure we don't accidentally mark a check-in as absent
        `;
        
        const updateResult = await client.query(updateQuery, [targetDate]);

        console.log(`[Scheduler] Finalized ${updateResult.rowCount} records to FINAL ABSENT (Type ${FINAL_ABSENT_TYPE}) for ${targetDate}.`);

    } catch (error) {
        console.error(`[Scheduler ERROR] PHASE 2 Finalization Failed for ${targetDate}:`, error);
    }
};


/**
 * Schedule the two jobs.
 */
const startAttendanceScheduler = (client) => {
    // 1. Run SETUP immediately on server start for today
    runPreDaySetupJob(client); 
    
    // 2. Schedule PRE-DAY SETUP job (Runs every day at 00:01 for the NEW day)
    cron.schedule('1 0 * * *', () => runPreDaySetupJob(client), {
        timezone: "Asia/Kolkata" 
    });
    
    // 3. Schedule FINALIZATION job (Runs every day at 03:00 for the PREVIOUS day)
    // Running at 3 AM ensures all legitimate late check-outs from the previous day have been recorded.
    cron.schedule('0 3 * * *', () => runEndOfDayFinalizationJob(client), {
        timezone: "Asia/Kolkata" 
    });

    console.log('[Scheduler] Two-Phase Attendance Job Scheduled: Setup (00:01) and Finalization (03:00).');
};

module.exports = { startAttendanceScheduler };
