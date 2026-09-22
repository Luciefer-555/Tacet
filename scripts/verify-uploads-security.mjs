#!/usr/bin/env node

// HTTP-only check. Anonymous cases do not need MongoDB or cookies.
// Authenticated cases use cookies supplied by the caller.
const base = process.env.BASE_URL || 'http://localhost:3000';
const ownUrl = process.env.OWN_UPLOAD_URL;
const otherUrl = process.env.OTHER_UPLOAD_URL;
const ownCookie = process.env.OWN_COOKIE;
const otherCookie = process.env.OTHER_COOKIE;
const scopeCookie = process.env.SCOPE_COOKIE;
const logoUrl = process.env.LOGO_URL;
let failed = false;

async function check(path, label, expected, cookie = '') {
  const response = await fetch(new URL(path, base), { headers: cookie ? { Cookie: cookie } : {}, redirect: 'manual' });
  const actual = response.status;
  console.log(`${label}: expected ${expected.join('|')}, actual ${actual}`);
  if (!expected.includes(actual)) failed = true;
  return response;
}

for (const path of [
  '/uploads/submissions/../company-logos/x.png',
  '/uploads/submissions/%2e%2e/company-logos/x.png',
  '/uploads/submissions/%252e%252e/company-logos/x.png',
  '/uploads/submissions/x%5cy.png',
  '/uploads/submissions/%00.png',
  '/uploads/company-logos/logo.svg',
]) await check(path, `anonymous ${path}`, [401]);

if (logoUrl) await check(logoUrl, 'authenticated company logo', [200], ownCookie || otherCookie || '');

if (ownUrl && otherUrl && ownCookie && otherCookie) {
  await check(ownUrl, 'submitter reads own submission', [200], ownCookie);
  await check(otherUrl, 'other student is denied', [404], ownCookie);
  await check(otherUrl, 'other submitter reads own submission', [200], otherCookie);
  if (scopeCookie) await check(otherUrl, 'same-scope viewer reads submission', [200], scopeCookie);
} else {
  console.log('authenticated cases: skipped; set OWN_UPLOAD_URL, OTHER_UPLOAD_URL, OWN_COOKIE, and OTHER_COOKIE to run them');
}

if (failed) process.exitCode = 1;
