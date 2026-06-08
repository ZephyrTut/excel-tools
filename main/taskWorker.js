const { parentPort, workerData } = require("node:worker_threads");
const { runSplitTask } = require("../services/split/splitService");
const { runMergeTask } = require("../services/merge/mergeService");
const { runCompressTask } = require("../services/compress/compressService");

const emit = (payload) => parentPort.postMessage(payload);

async function run() {
  const { taskId, request, taskType = "split" } = workerData;
  const logger = {
    info(message, context = {}) {
      emit({ type: "log", taskId, level: "info", message, context });
    },
    warn(message, context = {}) {
      emit({ type: "log", taskId, level: "warn", message, context });
    },
    error(message, context = {}) {
      emit({ type: "log", taskId, level: "error", message, context });
    },
  };

  const reportProgress = (progress, stage) => {
    emit({ type: "progress", taskId, progress, stage });
  };

  try {
    const taskRunner = taskType === "merge" ? runMergeTask
      : taskType === "compress" ? runCompressTask
      : runSplitTask;
    const result = await taskRunner(request, { logger, reportProgress });
    emit({ type: "done", taskId, result });
  } catch (error) {
    emit({
      type: "error",
      taskId,
      error: {
        message: error.message,
        code: error.code || "UNKNOWN_ERROR",
        details: {
          ...(error.details || {}),
          stack: error.stack,
        },
      },
    });
  }
}

run();
