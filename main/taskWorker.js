const { parentPort, workerData } = require("node:worker_threads");

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

  // Lazy require — only load the service for the current task type.
  // Avoids paying the ExcelJS load cost (820ms) for every Worker invocation.
  const taskRunner =
    taskType === "merge"
      ? require("../services/merge/mergeService").runMergeTask
      : taskType === "compress"
        ? require("../services/compress/compressService").runCompressTask
        : require("../services/split/splitService").runSplitTask;

  try {
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
