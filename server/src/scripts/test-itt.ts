import axios from 'axios';

const BASE_URL = 'http://localhost:5000/api';

// Default seeded admin from your README
const ADMIN_EMAIL = 'admin@capytech.com';
const ADMIN_PASS = 'admin';

// Terminal color helpers for clean IDE output
const log = {
    info: (msg: string) => console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`),
    success: (msg: string) => console.log(`\x1b[32m[OK]\x1b[0m ${msg}`),
    error: (msg: string) => console.log(`\x1b[31m[ERROR]\x1b[0m ${msg}`),
    divider: () => console.log('\x1b[90m--------------------------------------------------\x1b[0m')
};

async function testITTSystem() {
    log.info('Starting ITT System End-to-End API Diagnostics...');
    log.divider();

    let token = '';

    // -----------------------------------------------------
    // 1. AUTHENTICATION
    // -----------------------------------------------------
    try {
        log.info(`Authenticating as ${ADMIN_EMAIL}...`);
        const authRes = await axios.post(`${BASE_URL}/auth/login`, {
            email: ADMIN_EMAIL,
            password: ADMIN_PASS
        });
        token = authRes.data.token;
        log.success('Authentication successful. Admin JWT acquired.');
    } catch (err: any) {
        log.error(`Auth Failed: ${err.response?.data?.message || err.message}`);
        log.error('Cannot proceed. Ensure the Express server is running on port 5000 and the DB is seeded.');
        return;
    }

    // Create an authenticated client
    const client = axios.create({
        baseURL: BASE_URL,
        headers: { Authorization: `Bearer ${token}` }
    });

    log.divider();

    // -----------------------------------------------------
    // 2. READ (GET) OPERATIONS
    // -----------------------------------------------------
    const endpoints = [
        { name: 'Workstations', path: '/itt/workstations' },
        { name: 'Maintenance Ledgers', path: '/itt/ledgers' },
        { name: 'Daily Reports', path: '/itt/reports' },
        { name: 'Support Tickets', path: '/itt/tickets' }
    ];

    for (const ep of endpoints) {
        try {
            const start = performance.now();
            const res = await client.get(ep.path);
            const latency = (performance.now() - start).toFixed(2);
            log.success(`${ep.name} GET (${latency}ms) - Retrieved ${res.data.length} records.`);
        } catch (err: any) {
            log.error(`${ep.name} GET Failed - HTTP ${err.response?.status}: ${err.response?.data?.error || err.message}`);
        }
    }

    log.divider();

    // -----------------------------------------------------
    // 3. WRITE (CRUD) LIFECYCLE ON WORKSTATIONS
    // -----------------------------------------------------
    log.info('Initiating Workstation CRUD Lifecycle Test (Database Write Check)...');
    let testWsId = '';

    // A. Create (POST)
    try {
        const start = performance.now();
        const createRes = await client.post('/itt/workstations', {
            unitId: `TEST-DIAG-${Date.now()}`,
            mobo: 'Diagnostic Mobo',
            cpu: 'Diagnostic CPU',
            ram: '16GB',
            storage: '1TB NVMe',
            status: 'active'
        });
        testWsId = createRes.data.id;
        const latency = (performance.now() - start).toFixed(2);
        log.success(`Workstation POST   (${latency}ms) - Created dummy unit ID: ${testWsId}`);
    } catch (err: any) {
        log.error(`Workstation POST Failed: ${err.response?.data?.error || err.message}`);
    }

    // B. Update (PUT)
    if (testWsId) {
        try {
            const start = performance.now();
            await client.put(`/itt/workstations/${testWsId}`, {
                unitId: `TEST-DIAG-UPDATED`,
                status: 'maintenance'
            });
            const latency = (performance.now() - start).toFixed(2);
            log.success(`Workstation PUT    (${latency}ms) - Updated status to 'maintenance'.`);
        } catch (err: any) {
            log.error(`Workstation PUT Failed: ${err.response?.data?.error || err.message}`);
        }

        // C. Delete (DELETE)
        try {
            const start = performance.now();
            await client.delete(`/itt/workstations/${testWsId}`);
            const latency = (performance.now() - start).toFixed(2);
            log.success(`Workstation DELETE (${latency}ms) - Cleaned up dummy unit successfully.`);
        } catch (err: any) {
            log.error(`Workstation DELETE Failed: ${err.response?.data?.error || err.message}`);
        }
    }

    log.divider();
    log.info('✅ ITT Diagnostics Complete.');
}

testITTSystem();