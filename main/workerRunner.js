const path = require("node:path");
const { Worker } = require("node:worker_threads");
const { EventEmitter } = require("node:events");

class WorkerRunner extends EventEmitter {
  constructor() {
    super();
    this.tasks = new Map();
  }

  startSplitTask(taskId, request) {
    const worker = new Worker(path.join(__dirname, "taskWorker.js"), {
      workerData: { taskId, request }
    });

    this.tasks.set(taskId, worker);

    worker.on("message", (event) => this.emit("event", event));
    worker.on("error", (error) =>
      this.emit("event", {
        type: "error",
        taskId,
        error: { code: "WORKER_CRASHED", message: error.message, details: {} }
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
