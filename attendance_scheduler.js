const cron = require('node-cron');
const crypto = require('crypto');

// ------------------------------------------------------------------
// CONFIG
// ------------------------------------------------------------------
const PRE_DAY_TYPE = 5;      // Not Checked In
const FINAL_ABSENT_TYPE = 4; // Absent

// MUST match main server
const SIGNING_KEY = process.env.SIGNING_KEY || "123456";

// ------------------------------------------------------------------
// CANONICAL SIGNATURE FUNCTION (MATCHES SERVER)
// ------------------------------------------------------------------
function generateAttendanceSignature({ id, currdate, checkin, checkout, type }) {
    let rawData;

    if (type === 0 && checkin && checkout) {
        rawData = `${id}|${currdate}|${checkin}|${checkout}|${type}`;
    }
    else if (type === 0 && checkin && !checkout) {
        rawData = `${id}|${currdate}|${checkin}|${type}`;
    }
    else {
        // ✅ PRE_DAY, ABSENT, LEAVE, HOLIDAY, etc.
        rawData = `${id}|${currdate}|${type}`;
    }

    return crypto
        .createHmac('sha256', SIGNING_KEY)
        .update(rawData)
        .digest('hex');
}

// ------------------------------------------------------------------
// PHASE 1: PRE-DAY SETUP (Type 5)
// ------------------------------------------------------------------
const runPreDaySetupJob = async (client) => {
    const today = new Date().toISOString().slice(0, 10);

    console.log(`[Scheduler] PHASE 1: Pre-day setup for ${today}`);

    try {
        const employeeResult = await client.query('SELECT ID FROM User_Info;');
        const employeeIDs = employeeResult.rows.map(r => r.id);

        if (employeeIDs.length === 0) {
            console.log('[Scheduler] No employees found.');
            return;
        }

        const values = employeeIDs.map(id => {
            const signature = generateAttendanceSignature({
                id,
                currdate: today,
                checkin: null,
                checkout: null,
                type: PRE_DAY_TYPE
            });

            return `(
                '${id}',
                '${today}',
                NULL,
                NULL,
                ${PRE_DAY_TYPE},
                '${signature}'
            )`;
        }).join(',');

        const insertQuery = `
            INSERT INTO user_attendance
            (ID, currdate, checkin, checkout, type, signature)
            VALUES ${values}
            ON CONFLICT (ID, currdate) DO NOTHING;
        `;

        const result = await client.query(insertQuery);
        console.log(`[Scheduler] Inserted ${result.rowCount} PRE-DAY records.`);

    } catch (err) {
        console.error('[Scheduler ERROR] Pre-day setup failed:', err);
    }
};

// ------------------------------------------------------------------
// PHASE 2: END-OF-DAY FINALIZATION (5 → 4)
// ------------------------------------------------------------------
const runEndOfDayFinalizationJob = async (client) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const targetDate = yesterday.toISOString().slice(0, 10);

    console.log(`[Scheduler] PHASE 2: Finalizing ${targetDate}`);

    try {
        const records = await client.query(
            `
            SELECT ID, currdate
            FROM user_attendance
            WHERE currdate = $1
              AND type = $2
              AND checkin IS NULL;
            `,
            [targetDate, PRE_DAY_TYPE]
        );

        if (records.rows.length === 0) {
            console.log('[Scheduler] No records to finalize.');
            return;
        }

        for (const row of records.rows) {
            const signature = generateAttendanceSignature({
                id: row.id,
                currdate: row.currdate,
                checkin: null,
                checkout: null,
                type: FINAL_ABSENT_TYPE
            });

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

    } catch (err) {
        console.error('[Scheduler ERROR] Finalization failed:', err);
    }
};

// ------------------------------------------------------------------
// START SCHEDULER
// ------------------------------------------------------------------
const startAttendanceScheduler = (client) => {
    runPreDaySetupJob(client);

    cron.schedule('1 0 * * *', () => runPreDaySetupJob(client), {
        timezone: 'Asia/Kolkata'
    });

    cron.schedule('0 3 * * *', () => runEndOfDayFinalizationJob(client), {
        timezone: 'Asia/Kolkata'
    });

    console.log('[Scheduler] Attendance scheduler started (integrity-safe)');
};

module.exports = { startAttendanceScheduler };
