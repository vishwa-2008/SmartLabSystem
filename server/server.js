import express from "express";
import dotenv from "dotenv";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const required = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "DEVICE_TOKEN"
];

for (const name of required) {
    if (!process.env[name]) {
        throw new Error(`Missing environment variable: ${name}`);
    }
}

const app = express();
app.disable("x-powered-by");

// Request size limit
app.use(express.json({ limit: "64kb" }));

// ----------------------------------------------------------------------------
// CORS Middleware (Configurable with local & production origin support)
// ----------------------------------------------------------------------------
const allowedOrigins = process.env.CORS_ORIGIN 
    ? process.env.CORS_ORIGIN.split(",").map(o => o.trim())
    : ["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001"];

app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
        let isAllowed = allowedOrigins.includes("*") || allowedOrigins.includes(origin);
        if (!isAllowed) {
            try {
                const host = new URL(origin).hostname;
                if (host.endsWith(".vercel.app") || host === "localhost" || host === "127.0.0.1") {
                    isAllowed = true;
                }
            } catch { /* ignore malformed origin */ }
        }

        if (isAllowed) {
            res.setHeader("Access-Control-Allow-Origin", origin);
        }
    } else {
        res.setHeader("Access-Control-Allow-Origin", "*");
    }

    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Device-Token, X-Request-Id");
    res.setHeader("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }
    next();
});

// ----------------------------------------------------------------------------
// Request ID & Logging Middleware
// ----------------------------------------------------------------------------
app.use((req, res, next) => {
    req.id = req.get("X-Request-Id") || crypto.randomUUID();
    res.setHeader("X-Request-Id", req.id);

    const start = Date.now();
    res.on("finish", () => {
        const duration = Date.now() - start;
        if (req.path !== "/health" && req.path !== "/api/device/heartbeat") {
            console.log(`[${new Date().toISOString()}] [${req.id}] ${req.method} ${req.path} -> ${res.statusCode} (${duration}ms)`);
        }
    });
    next();
});

// ----------------------------------------------------------------------------
// In-Memory Rate Limiting
// ----------------------------------------------------------------------------
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 120; // 120 reqs/min

function rateLimiter(req, res, next) {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const clientData = rateLimitMap.get(ip) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW_MS };

    if (now > clientData.resetTime) {
        clientData.count = 0;
        clientData.resetTime = now + RATE_LIMIT_WINDOW_MS;
    }

    clientData.count++;
    rateLimitMap.set(ip, clientData);

    if (clientData.count > MAX_REQUESTS_PER_WINDOW) {
        return res.status(429).json({
            error: "Too many requests. Please retry in a few moments."
        });
    }
    next();
}

app.use(rateLimiter);

// ----------------------------------------------------------------------------
// Supabase Client Initialization & Verification
// ----------------------------------------------------------------------------
const isSupabaseConfigured = !process.env.SUPABASE_URL.includes("YOUR_PROJECT_ID") &&
                             !process.env.SUPABASE_SERVICE_ROLE_KEY.includes("YOUR_PRIVATE");

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

// ----------------------------------------------------------------------------
// In-Memory Operational State (Hardware tracking, session buffers, fallbacks)
// ----------------------------------------------------------------------------
const inMemoryState = {
    latestHeartbeats: {},
    lastScanEvent: null,
    pendingEnrollmentTask: null,
    enrollmentSessions: {},
    inMemoryScans: []
};

// ----------------------------------------------------------------------------
// Device Authentication Helper
// ----------------------------------------------------------------------------
function safeEqual(a, b) {
    if (!a || !b) return false;
    const first = Buffer.from(String(a));
    const second = Buffer.from(String(b));

    return (
        first.length === second.length &&
        crypto.timingSafeEqual(first, second)
    );
}

function deviceAuthorized(req) {
    const supplied = req.get("X-Device-Token");
    return Boolean(
        supplied &&
        safeEqual(supplied, process.env.DEVICE_TOKEN)
    );
}

// ----------------------------------------------------------------------------
// ENDPOINTS
// ----------------------------------------------------------------------------

/**
 * 1. Health check endpoint (Preserved)
 */
app.get("/health", (_req, res) => {
    res.json({
        ok: true,
        service: "smart-lab-system-api",
        supabaseConfigured: isSupabaseConfigured,
        timestamp: new Date().toISOString()
    });
});

/**
 * 2. Fingerprint Scan Event endpoint (Preserved and enhanced with test flag)
 */
app.post("/api/scan-event", async (req, res) => {
    if (!deviceAuthorized(req)) {
        return res.status(401).json({
            error: "Device not authorized"
        });
    }

    const templateId = req.body?.templateId;

    if (
        !Number.isSafeInteger(templateId) ||
        templateId < 1 ||
        templateId > 1000000
    ) {
        return res.status(400).json({
            error: "Invalid template ID"
        });
    }

    const isTest = Boolean(req.body?.isTest);
    const deviceId = String(req.body?.deviceId || "esp32-lab-01");

    try {
        let studentId = null;
        let status = "not_found";

        if (isSupabaseConfigured) {
            const { data: mapping, error: lookupError } =
                await supabase
                    .from("fingerprint_templates")
                    .select("student_id")
                    .eq("template_id", templateId)
                    .eq("active", true)
                    .maybeSingle();

            if (lookupError) {
                console.error("Fingerprint lookup failed:", lookupError.message);
                return res.status(500).json({
                    error: "Fingerprint lookup failed"
                });
            }

            if (mapping) {
                const { data: student, error: studentError } =
                    await supabase
                        .from("students")
                        .select("id")
                        .eq("id", mapping.student_id)
                        .eq("active", true)
                        .maybeSingle();

                if (studentError) {
                    console.error("Student lookup failed:", studentError.message);
                    return res.status(500).json({
                        error: "Student lookup failed"
                    });
                }

                if (student) {
                    studentId = student.id;
                    status = "matched";
                }
            }

            const { data: event, error: insertError } =
                await supabase
                    .from("scan_events")
                    .insert({
                        template_id: templateId,
                        student_id: studentId,
                        status,
                        device_id: deviceId,
                        is_test: isTest
                    })
                    .select("id, template_id, status, created_at")
                    .single();

            if (insertError) {
                console.error("Scan insert failed:", insertError.message);
                return res.status(500).json({
                    error: "Could not record scan"
                });
            }

            inMemoryState.lastScanEvent = event;
            return res.status(201).json({
                success: true,
                event
            });
        } else {
            // Local fallback simulation when Supabase credentials are placeholder
            const simulatedEvent = {
                id: crypto.randomUUID(),
                template_id: templateId,
                status: templateId <= 5 ? "matched" : "not_found",
                student_id: templateId <= 5 ? `a0000001-0000-0000-0000-00000000000${templateId}` : null,
                device_id: deviceId,
                is_test: isTest,
                created_at: new Date().toISOString()
            };

            inMemoryState.lastScanEvent = simulatedEvent;
            inMemoryState.inMemoryScans.unshift(simulatedEvent);
            if (inMemoryState.inMemoryScans.length > 50) inMemoryState.inMemoryScans.pop();

            return res.status(201).json({
                success: true,
                event: simulatedEvent,
                note: "Operating in local test mode (Supabase URL is placeholder)"
            });
        }
    } catch (error) {
        console.error("Unexpected scan error:", error);
        return res.status(500).json({
            error: "Unexpected server error"
        });
    }
});

/**
 * 3. Device Telemetry Heartbeat endpoint
 */
app.post("/api/device/heartbeat", async (req, res) => {
    if (!deviceAuthorized(req)) {
        return res.status(401).json({ error: "Device not authorized" });
    }

    const { deviceId, uptimeSeconds, freeHeap, rssi, ipAddress, firmwareVersion } = req.body || {};
    const devId = String(deviceId || "esp32-lab-01");
    const heartbeatTimestamp = new Date().toISOString();

    const telemetry = {
        deviceId: devId,
        uptimeSeconds: Number(uptimeSeconds || 0),
        freeHeap: Number(freeHeap || 0),
        rssi: Number(rssi || 0),
        ipAddress: String(ipAddress || req.ip || "192.168.1.150"),
        firmwareVersion: String(firmwareVersion || "1.2.0"),
        lastSeen: heartbeatTimestamp,
        status: "online"
    };

    inMemoryState.latestHeartbeats[devId] = telemetry;

    if (isSupabaseConfigured) {
        try {
            await supabase.from("device_heartbeats").insert({
                device_id: devId,
                ip_address: telemetry.ipAddress,
                status: "online",
                uptime_seconds: telemetry.uptimeSeconds,
                free_heap: telemetry.freeHeap,
                firmware_version: telemetry.firmwareVersion
            });
        } catch (err) {
            console.error("Failed to persist heartbeat:", err.message);
        }
    }

    return res.status(200).json({
        ok: true,
        acknowledgedAt: heartbeatTimestamp
    });
});

/**
 * 4. Device and System Status endpoint
 */
app.get("/api/device/status", async (_req, res) => {
    const defaultDeviceId = "esp32-lab-01";
    const telemetry = inMemoryState.latestHeartbeats[defaultDeviceId];

    const now = Date.now();
    let isOnline = false;
    let lastSeen = null;

    if (telemetry) {
        lastSeen = telemetry.lastSeen;
        const timeDiff = now - new Date(telemetry.lastSeen).getTime();
        // Considered online if heartbeat received in the last 60 seconds
        isOnline = timeDiff < 60000;
    }

    res.json({
        api: {
            status: "healthy",
            uptimeSeconds: Math.floor(process.uptime()),
            timestamp: new Date().toISOString(),
            supabaseConfigured: isSupabaseConfigured
        },
        device: {
            id: defaultDeviceId,
            online: isOnline,
            lastSeen: lastSeen,
            telemetry: telemetry || null
        },
        lastScan: inMemoryState.lastScanEvent
    });
});

/**
 * 5. Hardware Enrollment Handshake endpoints
 */
// Staff initiates enrollment for student
app.post("/api/enrollment/start", (req, res) => {
    const { studentId, targetTemplateId } = req.body || {};

    if (!studentId || !targetTemplateId) {
        return res.status(400).json({ error: "studentId and targetTemplateId are required" });
    }

    const sessionId = crypto.randomUUID();
    const session = {
        sessionId,
        studentId,
        targetTemplateId: Number(targetTemplateId),
        status: "waiting_device",
        createdAt: new Date().toISOString()
    };

    inMemoryState.pendingEnrollmentTask = session;
    inMemoryState.enrollmentSessions[sessionId] = session;

    return res.status(201).json({
        success: true,
        sessionId,
        status: "waiting_device",
        targetTemplateId: Number(targetTemplateId)
    });
});

// ESP32 checks for pending enrollment work
app.get("/api/device/enrollment-task", (req, res) => {
    if (!deviceAuthorized(req)) {
        return res.status(401).json({ error: "Device not authorized" });
    }

    if (inMemoryState.pendingEnrollmentTask) {
        return res.json({
            hasTask: true,
            sessionId: inMemoryState.pendingEnrollmentTask.sessionId,
            targetTemplateId: inMemoryState.pendingEnrollmentTask.targetTemplateId
        });
    }

    return res.json({ hasTask: false });
});

// ESP32 reports completion of enrollment
app.post("/api/device/enrollment-complete", async (req, res) => {
    if (!deviceAuthorized(req)) {
        return res.status(401).json({ error: "Device not authorized" });
    }

    const { sessionId, templateId, status, errorMessage } = req.body || {};
    const session = inMemoryState.enrollmentSessions[sessionId];

    if (session) {
        session.status = status === "enrolled" ? "enrolled" : "failed";
        session.errorMessage = errorMessage || null;
        session.completedAt = new Date().toISOString();

        if (status === "enrolled" && isSupabaseConfigured) {
            try {
                await supabase.from("fingerprint_templates").upsert({
                    template_id: templateId,
                    student_id: session.studentId,
                    active: true,
                    enrolled_at: new Date().toISOString()
                }, { onConflict: "template_id" });
            } catch (err) {
                console.error("Failed to persist enrolled template:", err.message);
            }
        }
    }

    inMemoryState.pendingEnrollmentTask = null;
    return res.json({ success: true });
});

// Staff portal polls enrollment status
app.get("/api/enrollment/status/:sessionId", (req, res) => {
    const session = inMemoryState.enrollmentSessions[req.params.sessionId];
    if (!session) {
        return res.status(404).json({ error: "Enrollment session not found" });
    }
    return res.json(session);
});

/**
 * 6. Test Scan Simulator (Safe development endpoint marked with isTest flag)
 */
app.post("/api/test/simulate-scan", (req, res) => {
    const templateId = Number(req.body?.templateId || 1);
    const studentName = req.body?.studentName || "Simulated Student";
    const status = req.body?.status || (templateId > 0 && templateId <= 5 ? "matched" : "not_found");

    const event = {
        id: crypto.randomUUID(),
        template_id: templateId,
        student_id: templateId <= 5 ? `a0000001-0000-0000-0000-00000000000${templateId}` : null,
        status: status,
        device_id: "esp32-lab-01",
        is_test: true,
        created_at: new Date().toISOString(),
        student: status === "matched" ? {
            full_name: studentName,
            reg_number: `992100400${templateId}`
        } : null
    };

    inMemoryState.lastScanEvent = event;
    inMemoryState.inMemoryScans.unshift(event);
    if (inMemoryState.inMemoryScans.length > 50) inMemoryState.inMemoryScans.pop();

    return res.status(201).json({
        success: true,
        isTest: true,
        event
    });
});

// ============================================================================
// AUTHENTICATED PORTAL API ROUTES
// ============================================================================

/**
 * Middleware: Validate Supabase JWT and load staff profile.
 * Attaches req.actor (profile row) to every protected request.
 */
async function requireAuth(req, res, next) {
    const authHeader = req.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing authorization header" });
    }

    const token = authHeader.slice(7);

    try {
        // Verify the JWT with Supabase Auth admin
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) {
            return res.status(401).json({ error: "Invalid or expired session" });
        }

        // Load profile and check active status
        const { data: profile, error: profErr } = await supabase
            .from("profiles")
            .select("id, email, full_name, role, active")
            .eq("id", user.id)
            .single();

        if (profErr || !profile) {
            return res.status(403).json({ error: "Staff profile not found" });
        }

        if (!profile.active) {
            return res.status(403).json({ error: "Account has been deactivated. Contact the HOD." });
        }

        req.actor = profile;
        next();
    } catch (err) {
        console.error("Auth middleware error:", err);
        return res.status(500).json({ error: "Authentication error" });
    }
}

/**
 * Middleware: HOD-only gate (must run after requireAuth)
 */
function requireHOD(req, res, next) {
    if (req.actor?.role !== "HOD") {
        return res.status(403).json({ error: "This action requires HOD authorization" });
    }
    next();
}

/**
 * 7. GET /api/me — authenticated user profile + lab assignments
 */
app.get("/api/me", requireAuth, async (req, res) => {
    try {
        const { data: assignments } = await supabase
            .from("lab_assignments")
            .select("lab_id, laboratories(id, name, lab_code, department, location)")
            .eq("user_id", req.actor.id)
            .eq("is_active", true);

        return res.json({
            ...req.actor,
            lab_assignments: assignments || []
        });
    } catch (err) {
        return res.status(500).json({ error: "Failed to load user profile" });
    }
});

/**
 * 8. GET /api/dashboard/stats — real-time stats (role-scoped)
 */
app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    try {
        const { data, error } = await supabase.rpc("rpc_get_dashboard_stats");
        if (error) throw error;
        return res.json(data);
    } catch (err) {
        return res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
});

// ============================================================================
// LABORATORIES
// ============================================================================

/**
 * 9. GET /api/labs — list authorized labs
 */
app.get("/api/labs", requireAuth, async (req, res) => {
    try {
        let query = supabase
            .from("laboratories")
            .select("*, created_by_profile:profiles!created_by(full_name)")
            .order("name");

        if (req.actor.role !== "HOD") {
            // Lab In-charge: only their assigned labs
            const { data: assignments } = await supabase
                .from("lab_assignments")
                .select("lab_id")
                .eq("user_id", req.actor.id)
                .eq("is_active", true);
            const labIds = (assignments || []).map(a => a.lab_id);
            if (labIds.length === 0) return res.json([]);
            query = query.in("id", labIds);
        }

        const { data, error } = await query;
        if (error) throw error;
        return res.json(data || []);
    } catch (err) {
        return res.status(500).json({ error: "Failed to fetch laboratories" });
    }
});

/**
 * 10. POST /api/labs — HOD creates a lab
 */
app.post("/api/labs", requireAuth, requireHOD, async (req, res) => {
    const { name, lab_code, department, location, description } = req.body || {};
    if (!name || !lab_code || !department) {
        return res.status(400).json({ error: "name, lab_code, and department are required" });
    }

    try {
        const { data, error } = await supabase
            .from("laboratories")
            .insert({ name, lab_code: lab_code.toUpperCase().trim(), department, location: location || "", description, created_by: req.actor.id })
            .select()
            .single();
        if (error) {
            if (error.code === "23505") return res.status(409).json({ error: "Lab code already exists" });
            throw error;
        }

        await supabase.from("audit_logs").insert({
            actor_id: req.actor.id, action: "CREATE_LAB",
            entity_type: "laboratories", entity_id: data.id,
            details: { lab_code: data.lab_code, name: data.name }
        });

        return res.status(201).json(data);
    } catch (err) {
        return res.status(500).json({ error: "Failed to create laboratory" });
    }
});

/**
 * 11. PATCH /api/labs/:id — HOD updates a lab
 */
app.patch("/api/labs/:id", requireAuth, requireHOD, async (req, res) => {
    const { name, department, location, description, is_active } = req.body || {};
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (department !== undefined) updates.department = department;
    if (location !== undefined) updates.location = location;
    if (description !== undefined) updates.description = description;
    if (is_active !== undefined) updates.is_active = Boolean(is_active);

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
    }

    try {
        const { data, error } = await supabase
            .from("laboratories")
            .update(updates)
            .eq("id", req.params.id)
            .select()
            .single();
        if (error) throw error;
        if (!data) return res.status(404).json({ error: "Laboratory not found" });

        await supabase.from("audit_logs").insert({
            actor_id: req.actor.id, action: "UPDATE_LAB",
            entity_type: "laboratories", entity_id: req.params.id,
            details: updates
        });

        return res.json(data);
    } catch (err) {
        return res.status(500).json({ error: "Failed to update laboratory" });
    }
});

// ============================================================================
// LAB IN-CHARGE MANAGEMENT (HOD ONLY)
// ============================================================================

/**
 * 12. GET /api/lab-incharges — HOD lists all lab in-charges with assignments
 */
app.get("/api/lab-incharges", requireAuth, requireHOD, async (req, res) => {
    try {
        const { data: profiles, error } = await supabase
            .from("profiles")
            .select(`
                id, email, full_name, role, active, created_at,
                lab_assignments(lab_id, is_active, laboratories(id, name, lab_code))
            `)
            .eq("role", "lab_incharge")
            .order("full_name");
        if (error) throw error;
        return res.json(profiles || []);
    } catch (err) {
        return res.status(500).json({ error: "Failed to fetch lab in-charges" });
    }
});

/**
 * 13. POST /api/lab-incharges — HOD creates/invites a lab in-charge account
 */
app.post("/api/lab-incharges", requireAuth, requireHOD, async (req, res) => {
    const { email, full_name, password, lab_ids, role } = req.body || {};
    if (!email || !full_name || !password) {
        return res.status(400).json({ error: "email, full_name, and password are required" });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    try {
        let targetLabIds = Array.isArray(lab_ids) && lab_ids.length > 0 ? lab_ids : [];
        if (targetLabIds.length === 0) {
            const { data: defaultLabs } = await supabase.from("laboratories").select("id").eq("is_active", true).limit(1);
            if (defaultLabs && defaultLabs.length > 0) {
                targetLabIds = [defaultLabs[0].id];
            }
        }

        const targetRole = role === "HOD" ? "HOD" : "lab_incharge";

        // Create auth user via Supabase Admin API
        const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true  // auto-confirm for admin-created accounts
        });
        if (authErr) {
            if (authErr.message?.includes("already")) {
                return res.status(409).json({ error: "An account with this email already exists" });
            }
            throw authErr;
        }

        const userId = authData.user.id;

        // Insert profile row
        const { error: profileErr } = await supabase
            .from("profiles")
            .insert({ id: userId, email, full_name, role: targetRole, active: true });
        if (profileErr) {
            // Rollback: delete the auth user
            await supabase.auth.admin.deleteUser(userId);
            throw profileErr;
        }

        // Insert lab assignments if lab ids present
        if (targetLabIds.length > 0) {
            const assignmentRows = targetLabIds.map(labId => ({
                lab_id: labId, user_id: userId,
                assigned_by: req.actor.id, is_active: true
            }));
            await supabase.from("lab_assignments").upsert(assignmentRows, { onConflict: "lab_id,user_id" });
        }

        await supabase.from("audit_logs").insert({
            actor_id: req.actor.id, action: "CREATE_LAB_INCHARGE",
            entity_type: "profiles", entity_id: userId,
            details: { email, full_name, lab_ids }
        });

        return res.status(201).json({
            success: true,
            user_id: userId,
            email,
            full_name,
            message: "Lab In-charge account created. They can now sign in with the provided credentials."
        });
    } catch (err) {
        console.error("Create lab-incharge error:", err);
        return res.status(500).json({ error: err.message || "Failed to create lab in-charge account" });
    }
});

/**
 * 14. PATCH /api/lab-incharges/:id — HOD updates status or lab assignments
 */
app.patch("/api/lab-incharges/:id", requireAuth, requireHOD, async (req, res) => {
    const { active, lab_ids } = req.body || {};
    const userId = req.params.id;

    // Prevent modifying another HOD
    const { data: target } = await supabase
        .from("profiles").select("role").eq("id", userId).single();
    if (target?.role === "HOD") {
        return res.status(403).json({ error: "Cannot modify another HOD account" });
    }

    try {
        if (active !== undefined) {
            const { error } = await supabase
                .from("profiles")
                .update({ active: Boolean(active) })
                .eq("id", userId);
            if (error) throw error;

            await supabase.from("audit_logs").insert({
                actor_id: req.actor.id,
                action: active ? "ACTIVATE_STAFF" : "DEACTIVATE_STAFF",
                entity_type: "profiles", entity_id: userId,
                details: { active: Boolean(active) }
            });
        }

        if (Array.isArray(lab_ids)) {
            // Deactivate all current assignments then re-create
            await supabase.from("lab_assignments")
                .update({ is_active: false })
                .eq("user_id", userId);

            if (lab_ids.length > 0) {
                const rows = lab_ids.map(labId => ({
                    lab_id: labId, user_id: userId,
                    assigned_by: req.actor.id, is_active: true
                }));
                await supabase.from("lab_assignments").upsert(rows, { onConflict: "lab_id,user_id" });
            }

            await supabase.from("audit_logs").insert({
                actor_id: req.actor.id, action: "UPDATE_LAB_ASSIGNMENTS",
                entity_type: "profiles", entity_id: userId,
                details: { lab_ids }
            });
        }

        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: "Failed to update lab in-charge" });
    }
});

// ============================================================================
// STUDENTS
// ============================================================================

/**
 * 15. GET /api/students — authorized student listing
 */
app.get("/api/students", requireAuth, async (req, res) => {
    const { search, lab_id, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    try {
        let query = supabase
            .from("students")
            .select(`
                *, created_by_profile:profiles!created_by(full_name),
                fingerprint_templates(template_id, active, enrolled_at)
            `, { count: "exact" })
            .order("created_at", { ascending: false })
            .range(offset, offset + Number(limit) - 1);

        if (search) {
            query = query.or(`full_name.ilike.%${search}%,reg_number.ilike.%${search}%`);
        }

        if (lab_id) {
            // Filter via student_lab_access join
            const { data: studentIds } = await supabase
                .from("student_lab_access")
                .select("student_id")
                .eq("lab_id", lab_id)
                .eq("is_active", true);
            const ids = (studentIds || []).map(s => s.student_id);
            if (ids.length === 0) return res.json({ data: [], count: 0 });
            query = query.in("id", ids);
        } else if (req.actor.role !== "HOD") {
            // Lab In-charge: only students in their assigned labs
            const { data: assignments } = await supabase
                .from("lab_assignments")
                .select("lab_id")
                .eq("user_id", req.actor.id)
                .eq("is_active", true);
            const labIds = (assignments || []).map(a => a.lab_id);
            if (labIds.length === 0) return res.json({ data: [], count: 0 });

            const { data: studentIds } = await supabase
                .from("student_lab_access")
                .select("student_id")
                .in("lab_id", labIds)
                .eq("is_active", true);
            const ids = (studentIds || []).map(s => s.student_id);
            if (ids.length === 0) return res.json({ data: [], count: 0 });
            query = query.in("id", ids);
        }

        const { data, count, error } = await query;
        if (error) throw error;
        return res.json({ data: data || [], count: count || 0 });
    } catch (err) {
        return res.status(500).json({ error: "Failed to fetch students" });
    }
});

/**
 * 16. POST /api/students — register a student
 */
app.post("/api/students", requireAuth, async (req, res) => {
    const { reg_number, full_name, department, section, year, phone, lab_id } = req.body || {};
    if (!reg_number || !full_name || !department || !section || !year) {
        return res.status(400).json({ error: "reg_number, full_name, department, section, and year are required" });
    }
    if (!Number.isInteger(Number(year)) || Number(year) < 1 || Number(year) > 5) {
        return res.status(400).json({ error: "year must be between 1 and 5" });
    }

    // Lab In-charge must provide a lab_id they are assigned to
    if (req.actor.role !== "HOD" && !lab_id) {
        return res.status(400).json({ error: "lab_id is required when registering a student" });
    }

    try {
        const { data: student, error } = await supabase
            .from("students")
            .insert({
                reg_number: reg_number.trim(),
                full_name: full_name.trim(),
                department, section: section.trim(),
                year: Number(year), phone: phone || null,
                active: true, created_by: req.actor.id
            })
            .select()
            .single();

        if (error) {
            if (error.code === "23505") {
                return res.status(409).json({ error: "Registration number already exists" });
            }
            throw error;
        }

        // Create lab access if lab_id provided
        if (lab_id) {
            await supabase.from("student_lab_access").insert({
                student_id: student.id, lab_id,
                granted_by: req.actor.id, is_active: true
            });
        }

        await supabase.from("audit_logs").insert({
            actor_id: req.actor.id, action: "REGISTER_STUDENT",
            entity_type: "students", entity_id: student.id,
            details: { reg_number: student.reg_number, full_name: student.full_name, lab_id }
        });

        return res.status(201).json(student);
    } catch (err) {
        return res.status(500).json({ error: "Failed to register student" });
    }
});

/**
 * 17. PATCH /api/students/:id — update student record
 */
app.patch("/api/students/:id", requireAuth, async (req, res) => {
    const allowed = ["full_name", "department", "section", "year", "phone", "active"];
    const updates = {};
    for (const key of allowed) {
        if (req.body?.[key] !== undefined) updates[key] = req.body[key];
    }

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
    }

    try {
        const { data, error } = await supabase
            .from("students")
            .update(updates)
            .eq("id", req.params.id)
            .select()
            .single();
        if (error) throw error;
        if (!data) return res.status(404).json({ error: "Student not found" });

        await supabase.from("audit_logs").insert({
            actor_id: req.actor.id, action: "UPDATE_STUDENT",
            entity_type: "students", entity_id: req.params.id,
            details: updates
        });

        return res.json(data);
    } catch (err) {
        return res.status(500).json({ error: "Failed to update student" });
    }
});

// ============================================================================
// EQUIPMENT
// ============================================================================

/**
 * 18. GET /api/equipment — authorized equipment listing
 */
app.get("/api/equipment", requireAuth, async (req, res) => {
    const { search, status, lab_id, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    try {
        let query = supabase
            .from("equipment")
            .select("*, lab:laboratories(id, name, lab_code)", { count: "exact" })
            .order("created_at", { ascending: false })
            .range(offset, offset + Number(limit) - 1);

        if (search) {
            query = query.or(`name.ilike.%${search}%,asset_id.ilike.%${search}%`);
        }
        if (status) query = query.eq("status", status);

        if (lab_id) {
            query = query.eq("lab_id", lab_id);
        } else if (req.actor.role !== "HOD") {
            const { data: assignments } = await supabase
                .from("lab_assignments")
                .select("lab_id")
                .eq("user_id", req.actor.id)
                .eq("is_active", true);
            const labIds = (assignments || []).map(a => a.lab_id);
            if (labIds.length === 0) return res.json({ data: [], count: 0 });
            query = query.in("lab_id", labIds);
        }

        const { data, count, error } = await query;
        if (error) throw error;
        return res.json({ data: data || [], count: count || 0 });
    } catch (err) {
        return res.status(500).json({ error: "Failed to fetch equipment" });
    }
});

/**
 * 19. POST /api/equipment — register equipment
 */
app.post("/api/equipment", requireAuth, async (req, res) => {
    const { asset_id, name, category, location, status, condition, description, lab_id } = req.body || {};
    if (!asset_id || !name || !category) {
        return res.status(400).json({ error: "asset_id, name, and category are required" });
    }

    try {
        const { data, error } = await supabase
            .from("equipment")
            .insert({
                asset_id: asset_id.trim().toUpperCase(),
                name: name.trim(), category, location: location || "",
                status: status || "available",
                condition: condition || "good",
                description: description || null,
                lab_id: lab_id || null,
                created_by: req.actor.id
            })
            .select()
            .single();

        if (error) {
            if (error.code === "23505") return res.status(409).json({ error: "Asset ID already exists" });
            throw error;
        }

        await supabase.from("audit_logs").insert({
            actor_id: req.actor.id, action: "ADD_EQUIPMENT",
            entity_type: "equipment", entity_id: data.id,
            details: { asset_id: data.asset_id, name: data.name, lab_id }
        });

        return res.status(201).json(data);
    } catch (err) {
        return res.status(500).json({ error: "Failed to register equipment" });
    }
});

/**
 * 20. PATCH /api/equipment/:id — update equipment
 */
app.patch("/api/equipment/:id", requireAuth, async (req, res) => {
    const allowed = ["name", "category", "location", "condition", "description", "status", "lab_id"];
    const updates = {};
    for (const key of allowed) {
        if (req.body?.[key] !== undefined) updates[key] = req.body[key];
    }
    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
    }

    try {
        const { data, error } = await supabase
            .from("equipment")
            .update(updates)
            .eq("id", req.params.id)
            .select()
            .single();
        if (error) throw error;
        if (!data) return res.status(404).json({ error: "Equipment not found" });
        return res.json(data);
    } catch (err) {
        return res.status(500).json({ error: "Failed to update equipment" });
    }
});

/**
 * 20b. DELETE /api/equipment/:id — remove equipment (guarded against active loans)
 */
app.delete("/api/equipment/:id", requireAuth, async (req, res) => {
    try {
        // Check for active loan
        const { data: activeLoans } = await supabase
            .from("equipment_transactions")
            .select("id")
            .eq("equipment_id", req.params.id)
            .eq("status", "active")
            .limit(1);

        if (activeLoans && activeLoans.length > 0) {
            return res.status(409).json({ error: "Cannot delete equipment with an active loan. Return the item first." });
        }

        const { error } = await supabase
            .from("equipment")
            .delete()
            .eq("id", req.params.id);

        if (error) throw error;

        await supabase.from("audit_logs").insert({
            actor_id: req.actor.id,
            action: "DELETE_EQUIPMENT",
            entity_type: "equipment",
            entity_id: req.params.id,
            details: { deleted_at: new Date().toISOString() }
        });

        return res.json({ success: true, message: "Equipment removed successfully" });
    } catch (err) {
        return res.status(500).json({ error: "Failed to delete equipment: " + (err.message || "") });
    }
});

// ============================================================================
// EQUIPMENT TRANSACTIONS (ISSUE / RETURN)
// ============================================================================

/**
 * 21. POST /api/equipment/issue — issue equipment via RPC
 */
app.post("/api/equipment/issue", requireAuth, async (req, res) => {
    const { student_id, equipment_id, due_at, remarks, lab_id } = req.body || {};
    if (!student_id || !equipment_id) {
        return res.status(400).json({ error: "student_id and equipment_id are required" });
    }

    try {
        const { data, error } = await supabase.rpc("rpc_issue_equipment", {
            p_student_id: student_id,
            p_equipment_id: equipment_id,
            p_due_at: due_at || null,
            p_remarks: remarks || null,
            p_lab_id: lab_id || null
        });
        if (error) {
            const msg = error.message || "";
            if (msg.includes("EQUIPMENT_UNAVAILABLE")) return res.status(409).json({ error: "Equipment is not available" });
            if (msg.includes("STUDENT_INACTIVE")) return res.status(409).json({ error: "Student account is inactive" });
            if (msg.includes("EQUIPMENT_UNUSABLE")) return res.status(409).json({ error: "Equipment condition prevents issuing" });
            throw error;
        }
        return res.status(201).json(data);
    } catch (err) {
        return res.status(500).json({ error: err.message || "Failed to issue equipment" });
    }
});

/**
 * 22. POST /api/equipment/return — return equipment via RPC
 */
app.post("/api/equipment/return", requireAuth, async (req, res) => {
    const { transaction_id, condition, remarks } = req.body || {};
    if (!transaction_id) {
        return res.status(400).json({ error: "transaction_id is required" });
    }

    try {
        const { data, error } = await supabase.rpc("rpc_return_equipment", {
            p_transaction_id: transaction_id,
            p_condition: condition || "good",
            p_remarks: remarks || null
        });
        if (error) {
            const msg = error.message || "";
            if (msg.includes("TRANSACTION_ALREADY_CLOSED")) return res.status(409).json({ error: "This transaction is already closed" });
            if (msg.includes("TRANSACTION_NOT_FOUND")) return res.status(404).json({ error: "Transaction not found" });
            throw error;
        }
        return res.json(data);
    } catch (err) {
        return res.status(500).json({ error: err.message || "Failed to return equipment" });
    }
});

/**
 * 23. GET /api/transactions — transaction history
 */
app.get("/api/transactions", requireAuth, async (req, res) => {
    const { status, lab_id, student_id, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    try {
        let query = supabase
            .from("equipment_transactions")
            .select(`
                *,
                student:students(id, reg_number, full_name, department, section),
                equipment:equipment(id, asset_id, name, category),
                issuer:profiles!issued_by(full_name, role),
                returner:profiles!returned_by(full_name, role)
            `, { count: "exact" })
            .order("issued_at", { ascending: false })
            .range(offset, offset + Number(limit) - 1);

        if (status) query = query.eq("status", status);
        if (student_id) query = query.eq("student_id", student_id);

        if (lab_id) {
            query = query.eq("lab_id", lab_id);
        } else if (req.actor.role !== "HOD") {
            const { data: assignments } = await supabase
                .from("lab_assignments").select("lab_id")
                .eq("user_id", req.actor.id).eq("is_active", true);
            const labIds = (assignments || []).map(a => a.lab_id);
            if (labIds.length > 0) query = query.in("lab_id", labIds);
        }

        const { data, count, error } = await query;
        if (error) throw error;
        return res.json({ data: data || [], count: count || 0 });
    } catch (err) {
        return res.status(500).json({ error: "Failed to fetch transactions" });
    }
});

// ============================================================================
// REPORTS
// ============================================================================

/**
 * 24. GET /api/reports — permission-checked report data
 */
app.get("/api/reports", requireAuth, async (req, res) => {
    const { type, lab_id, from_date, to_date } = req.query;

    try {
        let response = {};

        const dateFilter = (q) => {
            if (from_date) q = q.gte("created_at", from_date);
            if (to_date) q = q.lte("created_at", to_date);
            return q;
        };

        if (type === "inventory" || !type) {
            let q = supabase.from("equipment").select("*, lab:laboratories(name, lab_code)");
            if (lab_id) q = q.eq("lab_id", lab_id);
            else if (req.actor.role !== "HOD") {
                const { data: a } = await supabase.from("lab_assignments").select("lab_id").eq("user_id", req.actor.id).eq("is_active", true);
                const ids = (a || []).map(x => x.lab_id);
                if (ids.length > 0) q = q.in("lab_id", ids);
            }
            const { data } = await q.order("name");
            response.inventory = data || [];
        }

        if (type === "overdue" || !type) {
            let q = supabase.from("equipment_transactions")
                .select("*, student:students(reg_number, full_name), equipment:equipment(asset_id, name, lab:laboratories(name))")
                .eq("status", "active")
                .lt("due_at", new Date().toISOString());
            if (lab_id) q = q.eq("lab_id", lab_id);
            const { data } = await q.order("due_at");
            response.overdue = data || [];
        }

        if (type === "audit" && req.actor.role === "HOD") {
            let q = supabase.from("audit_logs")
                .select("*, actor:profiles!actor_id(full_name, role)");
            q = dateFilter(q);
            if (lab_id) q = q.eq("lab_id", lab_id);
            const { data } = await q.order("created_at", { ascending: false }).limit(500);
            response.audit_logs = data || [];
        }

        return res.json(response);
    } catch (err) {
        return res.status(500).json({ error: "Failed to generate report" });
    }
});

/**
 * 25. GET /api/audit-logs — HOD-only audit log viewer
 */
app.get("/api/audit-logs", requireAuth, requireHOD, async (req, res) => {
    const { page = 1, limit = 100 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    try {
        const { data, count, error } = await supabase
            .from("audit_logs")
            .select("*, actor:profiles!actor_id(full_name, role, email)", { count: "exact" })
            .order("created_at", { ascending: false })
            .range(offset, offset + Number(limit) - 1);
        if (error) throw error;
        return res.json({ data: data || [], count: count || 0 });
    } catch (err) {
        return res.status(500).json({ error: "Failed to fetch audit logs" });
    }
});

// Global 404 handler
app.use((_req, res) => {
    res.status(404).json({ error: "Endpoint not found" });
});

// Global error handler
app.use((err, req, res, _next) => {
    console.error(`[Error] [${req.id}]`, err);
    res.status(500).json({
        error: "Internal server error",
        requestId: req.id
    });
});

const port = Number(process.env.PORT || 3000);

app.listen(port, "0.0.0.0", () => {
    console.log(`Smart Lab API listening on port ${port} [PID: ${process.pid}]`);
});