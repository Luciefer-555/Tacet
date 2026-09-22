const PISTON_URL = process.env.PISTON_URL;
const JUDGE0_URL = process.env.JUDGE0_URL ?? 'https://ce.judge0.com/submissions?wait=true';

export const JUDGE0_LANGUAGE_IDS: Record<string, number> = {
  python: 71,
  java: 62,
  c: 50,
  cpp: 54,
};

export async function executeSnippet(
  language: string,
  code: string,
  stdin: string = ''
): Promise<{ output: string; time: number | null; memory: number | null }> {
  // 1. Try Piston only if a custom/self-hosted instance is configured (public emkc.org is whitelist-only)
  if (PISTON_URL && !PISTON_URL.includes('emkc.org')) {
    try {
      const pistonLangMap: Record<string, string> = { python: 'python', java: 'java', c: 'c', cpp: 'cpp' };
      const pistonLang = pistonLangMap[language] || 'python';
      const pistonRes = await fetch(PISTON_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: pistonLang,
          version: '*',
          files: [{ content: code }],
          stdin: stdin ?? '',
        }),
      });

      if (pistonRes.ok) {
        const pistonResult = await pistonRes.json();
        return {
          output: (pistonResult.run?.stdout ?? pistonResult.run?.stderr ?? '').trimEnd(),
          time: null,
          memory: null,
        };
      }
    } catch {
      // fallback to Judge0
    }
  }

  // 2. Fallback to Judge0 CE API (standard online judge execution)
  const languageId = JUDGE0_LANGUAGE_IDS[language] ?? 71;
  const judgeRes = await fetch(JUDGE0_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source_code: code,
      language_id: languageId,
      stdin: stdin ?? '',
    }),
  });

  if (!judgeRes.ok) {
    throw new Error(`Code execution service returned ${judgeRes.status}`);
  }

  const judgeResult = await judgeRes.json();
  const output = (judgeResult.stdout ?? judgeResult.stderr ?? judgeResult.compile_output ?? judgeResult.message ?? '').trimEnd();
  const time = judgeResult.time != null ? parseFloat(judgeResult.time) : null;
  const memory = judgeResult.memory != null ? Number(judgeResult.memory) : null;

  return { output, time, memory };
}
