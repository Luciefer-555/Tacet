#!/usr/bin/env node

// HTTP-only check. This script never connects to MongoDB or creates data.
// Run only against a local server you explicitly choose to test.
// Usage:
// BASE_URL=http://localhost:3000 \
// OWN_UPLOAD_URL=/uploads/submissions/student-a.pdf \
// OTHER_UPLOAD_URL=/uploads/submissions/student-b.pdf \
// OWN_COOKIE='tacet_session=...' OTHER_COOKIE='tacet_session=...' \
// SCOPE_COOKIE='tacet_session=...' LOGO_URL=/uploads/company-logos/acme.png \
// node scripts/verify-uploads-security.mjs

const base = process.env.BASE_URL || 'http://localhost:3000';
const ownUrl = process.env.OWN_UPLOAD_URL;
const otherUrl = process.env.OTHER_UPLOAD_URL;
const ownCookie = process.env.OWN_COOKIE;
const otherCookie = process.env.OTHER_COOKIE;
const scopeCookie = process.env.SCOPE_COOKIE;
const logoUrl = process.env.LOGO_URL;
if (!ownUrl || !otherUrl || !ownCookie || !otherCookie) {
  console.error('Set BASE_URL, OWN_UPLOAD_URL, OTHER_UPLOAD_URL, OWN_COOKIE, and OTHER_COOKIE; no requests made.');
  process.exitCode = 2;
  process.exit();
}

const traversal = [
  '/uploads/submissions/../company-logos/x.png',
  '/uploads/submissions/%2e%2e/company-logos/x.png',
  '/uploads/submissions/%252e%252e/company-logos/x.png',
  '/uploads//etc/passwd',
  '/uploads/C:%5cWindows%5cwin.ini',
  '/uploads/submissions/%00.png',
];

async function check(path, label, expected = [400, 403, 404]) {
  const response = await fetch(new URL(path, base), { redirect: 'manual' });
  console.log(`${label}: ${response.status} ${response.headers.get('content-type') || ''}`);
  if (!expected.includes(response.status)) process.exitCode = 1;
  return response;
}

for (const path of traversal) await check(path, `traversal ${path}`);

async function checkUpload(path, label, cookie, expected) {
  const response = await fetch(new URL(path, base), {
    headers: { Cookie: cookie },
    redirect: 'manual',
  });
  const contentType = response.headers.get('content-type') || '';
  console.log(`${label}: ${response.status} ${contentType}`);
  if (!expected.includes(response.status)) process.exitCode = 1;
  if (response.status === 200 && /(?:text\/html|javascript|x-httpd-php)/i.test(contentType)) {
    console.error(`${label}: executable/browser-rendered content type is not allowed`);
    process.exitCode = 1;
  }
}

await checkUpload(ownUrl, 'submitter reads own submission', ownCookie, [200]);
await checkUpload(otherUrl, 'student A reads student B submission', ownCookie, [403, 404]);
await checkUpload(otherUrl, 'student B reads own submission', otherCookie, [200]);
if (scopeCookie) await checkUpload(otherUrl, 'same-scope viewer reads submission', scopeCookie, [200]);
await checkUpload(otherUrl, 'anonymous reads submission', '', [401, 403, 404]);

if (logoUrl) {
  const logo = await check(logoUrl, 'company logo is public', [200]);
  const contentType = logo.headers.get('content-type') || '';
  if (logo.status === 200 && /(?:text\/html|javascript|x-httpd-php)/i.test(contentType)) {
    console.error('company logo: executable/browser-rendered content type is not allowed');
    process.exitCode = 1;
  }
}
