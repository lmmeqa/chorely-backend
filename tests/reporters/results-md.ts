/*
  Vitest reporter that writes a RESULTS.md artifact with pass/fail per test.
*/
import { writeFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

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

const ResultsMdReporter = {
  onFinished(files: any[]) {
    try {
      const all: Array<{ file: string; name: string; duration?: number; state?: string }>=[];
      for (const f of files || []) {
        const filePath = f?.filepath || f?.name || 'unknown';
        collectTests(f, filePath, all);
      }
      const byFile = new Map<string, Array<{ name: string; duration?: number; state?: string }>>();
      for (const t of all) {
        if (!byFile.has(t.file)) byFile.set(t.file, []);
        byFile.get(t.file)!.push({ name: t.name, duration: t.duration, state: t.state });
      }
      const filesSorted = Array.from(byFile.entries()).sort((a, b) => a[0].localeCompare(b[0]));
      for (const [, tests] of filesSorted) tests.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      let md = '# Test Results\n\n';
      for (const [file, tests] of filesSorted) {
        md += `## ${file}\n`;
        for (const t of tests) {
          const status = (t.state === 'pass') ? '✅' : (t.state === 'fail' ? '❌' : '⚪');
          const dur = typeof t.duration === 'number' ? ` (${t.duration}ms)` : '';
          md += `- ${status} ${t.name}${dur}\n`;
        }
        md += '\n';
      }
      const outPath = resolve(process.cwd(), 'tests', 'RESULTS.md');
      mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(outPath, md, 'utf8');
      console.log(`\n[results-md] Wrote ${outPath}`);
    } catch (e) {
      console.error('[results-md] reporter error:', e);
    }
  },
};

export default ResultsMdReporter;


