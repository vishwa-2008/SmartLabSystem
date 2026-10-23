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
        if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
            res.setHeader("Access-Control-Allow-Origin", origin);
        } else {
            // Allow all local development origins dynamically
            if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
                res.setHeader("Access-Control-Allow-Origin", origin);
            }
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