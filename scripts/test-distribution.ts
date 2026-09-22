import crypto from 'crypto';

const problemId = '6aa2366dff87c22a37bdeee2';

// 1. Current djb2Hash function
function djb2Hash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash >>> 0;
}

// 2. Proposed sha256 function
function sha256Variant(studentId: string, probId: string, variantCount: number): string {
  const hash = crypto.createHash('sha256').update(`${studentId}:${probId}`).digest('hex');
  const index = parseInt(hash.slice(0, 8), 16) % variantCount;
  return `v${index + 1}`;
}

const N = 300;
const djb2Counts: Record<string, number> = { v1: 0, v2: 0, v3: 0 };
const sha256Counts: Record<string, number> = { v1: 0, v2: 0, v3: 0 };

// Generate fixed simulated students
for (let i = 0; i < N; i++) {
  const fakeStudentId = `test_student_${i}_${Math.random().toString(36).slice(2)}`;
  
  // djb2
  const dHash = djb2Hash(fakeStudentId + problemId);
  const dIndex = dHash % 3;
  djb2Counts[`v${dIndex + 1}`]++;

  // sha256
  const sVariant = sha256Variant(fakeStudentId, problemId, 3);
  sha256Counts[sVariant]++;
}

console.log('--- N = 300 DISTRIBUTION RESULTS ---');
console.log('djb2 counts:  ', djb2Counts);
console.log('sha256 counts:', sha256Counts);
