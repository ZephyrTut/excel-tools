const path = require('path');
const { Worker } = require('worker_threads');

function runSplitTask({ sourceFile, outputDir, rulesPath, onLog, onProgress, onStateChange, onWorker }) {
  return new Promise((resolve, reject) => {
    const workerPath = path.join(__dirname, 'splitWorker.js');
    const worker = new Worker(workerPath, {
      workerData: { sourceFile, outputDir, rulesPath }
    });

    if (onWorker) onWorker(worker);
    if (onStateChange) onStateChange('running');

    worker.on('message', (msg) => {
      if (msg.type === 'log' && onLog) onLog(msg.message);
      if (msg.type === 'progress' && onProgress) onProgress(msg);
      if (msg.type === 'result') resolve({ worker, ...msg.result });
    });

    worker.on('error', (error) => {
      if (onStateChange) onStateChange('failed');
      reject(error);
    });

    worker.on('exit', (code) => {
      if (code !== 0 && code !== 1) {
        reject(new Error(`split worker exited with code ${code}`));
      }
    });
  });
}

module.exports = { runSplitTask };
