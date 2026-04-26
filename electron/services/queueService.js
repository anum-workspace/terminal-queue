const kill = require("tree-kill");
const ptyService = require("./ptyService");
const {
    insertHistory,
    listQueue,
    listStartup,
    updateQueueStatus,
    updateStartupStatus,
} = require("./dbService");

const runningJobs = new Map();

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildJobScript(job = {}) {
    const lines = [
        `printf '\\nDirectory: %s\\n' ${JSON.stringify(ptyService.resolveCwd(job.dir))}`,
        "printf 'Command will be executed here:\\n'",
    ];

    if (job.header) {
        lines.push(`printf '> %s\\n' ${JSON.stringify(job.header)}`);
    }

    lines.push(`printf '> %s\\n\\n' ${JSON.stringify(job.command || "")}`);

    if (job.footer) {
        lines.push(`printf '> %s\\n\\n' ${JSON.stringify(job.footer)}`);
    }

    if (job.header) {
        lines.push(job.header);
    }

    if (job.command) {
        lines.push(job.command);
    }

    if (job.footer) {
        lines.push(job.footer);
    }

    lines.push("exit");

    return `${lines.join("\n")}\r`;
}

function stop(sessionId) {
    if (sessionId) {
        const jobState = runningJobs.get(sessionId);
        if (jobState?.proc?.pid) {
            kill(jobState.proc.pid);
        } else {
            ptyService.closeSession(sessionId);
        }
        return;
    }

    for (const [id, jobState] of runningJobs.entries()) {
        if (jobState?.proc?.pid) {
            kill(jobState.proc.pid);
        } else {
            ptyService.closeSession(id);
        }
    }
}

function executeJob(job, options = {}) {
    return new Promise((resolve) => {
        let log = "";
        const session = ptyService.createSession({
            cwd: job.dir,
            name: options.name || job.command || "Job",
            persistent: false,
            autoClose: true,
        });

        const sessionState = ptyService.getSession(session.sessionId);
        runningJobs.set(session.sessionId, {
            proc: sessionState?.proc,
            kind: options.kind || "adhoc",
            jobId: job.id || null,
        });

        const unsubscribe = options.subscribe(session.sessionId, (data) => {
            log += data;
        });

        setTimeout(() => {
            ptyService.writeToSession(session.sessionId, buildJobScript(job));
        }, 80);

        options.onSession?.(session);

        const sessionProc = sessionState?.proc;
        if (!sessionProc) {
            unsubscribe?.();
            runningJobs.delete(session.sessionId);
            resolve({ status: "failed", log, sessionId: session.sessionId });
            return;
        }

        sessionProc.onExit((exitCode, signal) => {
            unsubscribe?.();
            runningJobs.delete(session.sessionId);

            resolve({
                status: signal != null ? "terminated" : exitCode === 0 ? "success" : "failed",
                log,
                sessionId: session.sessionId,
            });
        });
    });
}

async function executePersistedJob(kind, job, helpers) {
    if (kind === "queue") {
        await updateQueueStatus(job.id, "running");
    } else {
        await updateStartupStatus(job.id, "running");
    }

    if (kind === "startup" && Number(job.delay) > 0) {
        await delay(Number(job.delay) * 1000);
    }

    const result = await executeJob(job, {
        kind,
        name: job.command || `${kind} job`,
        subscribe: helpers.subscribe,
        onSession: helpers.onSession,
    });

    if (kind === "queue") {
        await updateQueueStatus(job.id, result.status);
    } else {
        await updateStartupStatus(job.id, result.status);
    }

    await insertHistory(job, result.status, result.log);
    return result;
}

async function runQueue(helpers) {
    const jobs = await listQueue();
    const runnableJobs = jobs.filter((job) => job.status !== "running");
    const results = await Promise.allSettled(
        runnableJobs.map((job) => executePersistedJob("queue", job, helpers)),
    );

    return {
        started: results.length > 0,
        count: results.length,
    };
}

async function runStartup(helpers) {
    const jobs = await listStartup();
    const runnableJobs = jobs.filter((job) => job.status !== "running");

    for (const job of runnableJobs) {
        await executePersistedJob("startup", job, helpers);
    }

    return {
        started: runnableJobs.length > 0,
        count: runnableJobs.length,
    };
}

async function executeNow(job, helpers) {
    const result = await executeJob(job, {
        kind: "adhoc",
        name: job.command || "Command",
        subscribe: helpers.subscribe,
        onSession: helpers.onSession,
    });
    await insertHistory(job, result.status, result.log);
    return result;
}

function getState() {
    return {
        running: runningJobs.size > 0,
        sessions: [...runningJobs.keys()],
    };
}

module.exports = {
    runQueue,
    runStartup,
    executeNow,
    stop,
    getState,
};
