/*
  Vitest custom reporter: buffer all console output during tests and
  only print logs for failed tests at the end (unless explicitly enabled).

  Works together with vitest.config.mts onConsoleLog hook which stores
  logs in globalThis.__VITEST_LOG_STORE.
*/

type AnyTask = any;

function visit(task: AnyTask, cb: (t: AnyTask) => void) {
  if (!task) return;
  if (Array.isArray(task.tasks)) {
    for (const sub of task.tasks) visit(sub, cb);
  }
  cb(task);
}

const FailLogsReporter = {
  onFinished(files: any[]) {
    const g: any = globalThis as any;
    const store = g.__VITEST_LOG_STORE as
      | { logs: Map<string, string[]>; meta: Map<string, { file: string; name: string }> }
      | undefined;

    if (!store || !files) return;

    let printedHeader = false;
    for (const f of files) {
      visit(f, (t) => {
        if (t?.type === 'test' && t?.result?.state === 'fail') {
          const id: string = t.id || `${t.filepath || f?.filepath}:${t.name}`;
          const logs = store.logs.get(id) || [];
          const meta = store.meta.get(id) || { file: f?.filepath || 'unknown', name: t.name || 'unknown' };
          if (logs.length > 0) {
            if (!printedHeader) {
              console.log('\n\n=== Logs for Failed Tests ===');
              printedHeader = true;
            }
            console.log(`\n[FAILED] ${meta.file} > ${meta.name}`);
            for (const line of logs) console.log(line);
          }
        }
      });
    }
  },
};

export default FailLogsReporter;


