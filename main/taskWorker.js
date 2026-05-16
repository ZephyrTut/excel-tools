const { parentPort, workerData } = require("node:worker_threads");
const { runSplitTask } = require("../services/split/splitService");

const emit = (payload) => parentPort.postMessage(payload);

async function run() {
  const { taskId, request } = workerData;
  const logger = {
    info(message, context = {}) {
      emit({ type: "log", taskId, level: "info", message, context });
    },
    warn(message, context = {}) {
      emit({ type: "log", taskId, level: "warn", message, context });
    },
    error(message, context = {}) {
      emit({ type: "log", taskId, level: "error", message, context });
    }
  };

  const reportProgress = (progress, stage) => {
    emit({ type: "progress", taskId, progress, stage });
  };

  try {
    const result = await runSplitTask(request, { logger, reportProgress });
    emit({ type: "done", taskId, result });
  } catch (error) {
    emit({
      type: "error",
      taskId,
      error: {
        message: error.message,
        code: error.code || "UNKNOWN_ERROR",
        details: error.details || {}
      }
    });
  }
}

run();
