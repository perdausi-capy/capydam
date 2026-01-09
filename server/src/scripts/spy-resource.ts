import mysql from 'mysql2/promise';

const oldDbConfig = {
    host: 'localhost',
    user: 'resourcespace_rw',
    password: 'your_rw_password',
    database: 'resourcespace'
};

async function spyOnResource(resourceId: number) {
    console.log(`🕵️‍♂️ Spying on Resource ${resourceId}...`);
    const connection = await mysql.createConnection(oldDbConfig);

    try {
        // 1. Get ALL data from the Node table (V10 System)
        const [rows]: any = await connection.execute(
            `SELECT n.resource_type_field, f.title as field_name, n.name as value
             FROM node n
             JOIN resource_node rn ON n.ref = rn.node
             JOIN resource_type_field f ON n.resource_type_field = f.ref
             WHERE rn.resource = ?`,
            [resourceId]
        );

        if (rows.length === 0) {
            console.log("❌ No data found in 'node' table.");
        } else {
            console.table(rows);
        }

    } catch (error: any) {
        console.error("❌ Error:", error.message);
    } finally {
        await connection.end();
    }
}

// Spy on Resource 634 (one of the files that failed)
spyOnResource(634);
