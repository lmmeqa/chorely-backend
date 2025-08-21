/*
  Vitest custom reporter: prints a consolidated end-of-run summary
  with all test files and their tests, regardless of other logs.
*/

type AnyTask = any;

function collectTests(task: AnyTask, filePath: string, out: Array<{ file: string; name: string; duration?: number; state?: string }>) {
  if (!task) return;
  if (task.type === 'test') {
    out.push({
      file: filePath,
      name: task.name || '',
      duration: task.result?.duration,
      state: task.result?.state || task.mode || 'unknown',
    });
  }
  if (Array.isArray(task.tasks)) {
    for (const sub of task.tasks) collectTests(sub, filePath, out);
  }
}

const EndSummaryReporter = {
  onFinished(files: any[]) {
    try {
      const all: Array<{ file: string; name: string; duration?: number; state?: string }> = [];
      for (const f of files || []) {
        const filePath = f?.filepath || f?.name || 'unknown';
        collectTests(f, filePath, all);
      }

      // Group, then deterministically sort files and tests for stable output
      const byFile = new Map<string, Array<{ name: string; duration?: number; state?: string }>>();
      for (const t of all) {
        if (!byFile.has(t.file)) byFile.set(t.file, []);
        byFile.get(t.file)!.push({ name: t.name, duration: t.duration, state: t.state });
      }
      const filesSorted = Array.from(byFile.entries()).sort((a, b) => a[0].localeCompare(b[0]));
      for (const [, tests] of filesSorted) tests.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      const filesCount = byFile.size;
      const testsCount = all.length;

      // Print at the very end
      console.log('\n\n=== Consolidated Test Summary ===');
      for (const [file, tests] of filesSorted) {
        console.log(`\n${file}`);
        for (const t of tests) {
          const dur = typeof t.duration === 'number' ? ` (${t.duration}ms)` : '';
          console.log(`  - ${t.state ?? 'unknown'}: ${t.name}${dur}`);
        }
      }
      console.log(`\nTotals: ${testsCount} tests across ${filesCount} files`);
    } catch (e) {
      // Never fail the run due to reporter
      console.error('[end-summary] reporter error:', e);
    }
  },
};

export default EndSummaryReporter;


