const cron = require('node-cron');
const crypto = require('crypto');

// ------------------------------------------------------------------
// CONFIG
// ------------------------------------------------------------------
const PRE_DAY_TYPE = 5;      // Not Checked In (start of day)
const FINAL_ABSENT_TYPE = 4; // Absent (end of day)

// MUST be same as main server signing key
const SIGNING_KEY = process.env.SIGNING_KEY || "123456";

// ------------------------------------------------------------------
// DIGITAL SIGNATURE HELPER (HMAC-SHA256)
// ------------------------------------------------------------------
function generateAttendanceSignature(data) {
    return crypto
        .createHmac('sha256', SIGNING_KEY)
        .update(data)
        .digest('hex');
}

// ------------------------------------------------------------------
// PHASE 1: PRE-DAY SETUP
// Inserts "Not Checked In" (Type 5) for all users
// ------------------------------------------------------------------
const runPreDaySetupJob = async (client) => {
    const today = new Date().toISOString().slice(0, 10);

    console.log(`[Scheduler] PHASE 1: Pre-day setup for ${today}`);

    try {
        // Fetch all employees
        const employeeResult = await client.query('SELECT ID FROM User_Info;');
        const employeeIDs = employeeResult.rows.map(row => row.id);

        if (employeeIDs.length === 0) {
            console.log('[Scheduler] No employees found.');
            return;
        }

        // Build signed bulk insert
        const valuesToInsert = employeeIDs.map(id => {
            const rawData = `${id}|${today}|AUTO|PRE_DAY`;
            const signature = generateAttendanceSignature(rawData);

            return `(
                '${id}',
                '${today}',
                NULL,
                NULL,
                ${PRE_DAY_TYPE},
                '${signature}'
            )`;
        }).join(', ');

        const insertQuery = `
            INSERT INTO user_attendance
            (ID, currdate, checkin, checkout, type, signature)
            VALUES ${valuesToInsert}
            ON CONFLICT (ID, currdate) DO NOTHING;
        `;

        const result = await client.query(insertQuery);

        console.log(`[Scheduler] Inserted ${result.rowCount} PRE-DAY records.`);

    } catch (error) {
        console.error('[Scheduler ERROR] Pre-day setup failed:', error);
    }
};

// ------------------------------------------------------------------
// PHASE 2: END-OF-DAY FINALIZATION
// Converts remaining Type 5 → Type 4 (Absent)
// ------------------------------------------------------------------
const runEndOfDayFinalizationJob = async (client) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const targetDate = yesterday.toISOString().slice(0, 10);

    console.log(`[Scheduler] PHASE 2: Finalizing ${targetDate}`);

    try {
        // Fetch records that will be finalized
        const fetchQuery = `
            SELECT ID, currdate
            FROM user_attendance
            WHERE
                currdate = $1
                AND type = ${PRE_DAY_TYPE}
                AND checkin IS NULL;
        `;

        const records = await client.query(fetchQuery, [targetDate]);

        if (records.rows.length === 0) {
            console.log('[Scheduler] No records to finalize.');
            return;
        }

        // Update each record with a fresh signature
        for (const row of records.rows) {
            const rawData = `${row.id}|${row.currdate}|AUTO|ABSENT`;
            const signature = generateAttendanceSignature(rawData);

            await client.query(
                `
                UPDATE user_attendance
                SET
                    type = $1,
                    checkin = NULL,
                    checkout = NULL,
                    signature = $2
                WHERE ID = $3 AND currdate = $4;
                `,
                [FINAL_ABSENT_TYPE, signature, row.id, row.currdate]
            );
        }

        console.log(`[Scheduler] Finalized ${records.rowCount} ABSENT records.`);

    } catch (error) {
        console.error('[Scheduler ERROR] Finalization failed:', error);
    }
};

// ------------------------------------------------------------------
// SCHEDULER STARTUP
// ------------------------------------------------------------------
const startAttendanceScheduler = (client) => {
    // Run once on server start
    runPreDaySetupJob(client);

    // Daily pre-day setup (00:01 IST)
    cron.schedule('1 0 * * *', () => runPreDaySetupJob(client), {
        timezone: "Asia/Kolkata"
    });

    // Daily finalization (03:00 IST)
    cron.schedule('0 3 * * *', () => runEndOfDayFinalizationJob(client), {
        timezone: "Asia/Kolkata"
    });

    console.log('[Scheduler] Attendance scheduler started (Integrity-protected)');
};

module.exports = { startAttendanceScheduler };
