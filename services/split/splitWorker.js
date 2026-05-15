const { parentPort, workerData } = require('worker_threads');
const { runSplitTask } = require('./splitService');

(async () => {
  const result = await runSplitTask({
    ...workerData,
    onLog: (message) => parentPort.postMessage({ type: 'log', message })
  });
  parentPort.postMessage({ type: 'done', result });
})();
