const path = require("node:path");
const { Worker } = require("node:worker_threads");
const { EventEmitter } = require("node:events");

function resolveWorkerMemoryMb() {
  const parsed = Number.parseInt(process.env.SPLIT_WORKER_MEMORY_MB || "", 10);
  if (Number.isFinite(parsed) && parsed >= 512) {
    return parsed;
  }
  return 3072;
}

class WorkerRunner extends EventEmitter {
  constructor() {
    super();
    this.tasks = new Map();
  }

  startSplitTask(taskId, request) {
    const memoryMb = resolveWorkerMemoryMb();
    const worker = new Worker(path.join(__dirname, "taskWorker.js"), {
      workerData: { taskId, request },
      resourceLimits: { maxOldGenerationSizeMb: memoryMb }
    });

    this.tasks.set(taskId, worker);

    worker.on("message", (event) => this.emit("event", event));
    worker.on("error", (error) =>
      this.emit("event", {
        type: "error",
        taskId,
        error: {
          code: "WORKER_CRASHED",
          message: error.message,
          details: { stack: error.stack, memoryMb }
        }
      })
    );
    worker.on("exit", (code) => {
      this.tasks.delete(taskId);
      if (code !== 0) {
        this.emit("event", {
          type: "error",
          taskId,
          error: {
            code: "WORKER_EXITED",
            message: `Worker exited with code ${code}`,
            details: {}
          }
        });
      }
    });
  }

  async cancelTask(taskId) {
    const worker = this.tasks.get(taskId);
    if (!worker) return false;
    this.tasks.delete(taskId);
    await worker.terminate();
    this.emit("event", {
      type: "cancelled",
      taskId,
      result: { message: "Task cancelled by user." }
    });
    return true;
  }
}

module.exports = {
  WorkerRunner
};
