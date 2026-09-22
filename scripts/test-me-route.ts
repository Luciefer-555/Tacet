import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  console.log('=== TEST 1: Fresh Incognito GET /api/user/me (no cookie) ===');
  const noCookieRes = await fetch('http://localhost:3000/api/user/me');
  console.log('HTTP Status:', noCookieRes.status);
  const noCookieJson = await noCookieRes.json();
  console.log('Response Body:', JSON.stringify(noCookieJson));

  console.log('\n=== TEST 2: Login as hiring_manager & Verify GET /api/user/me ===');
  const hmLogin = await fetch('http://localhost:3000/api/user/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profileId: 'syncin@VFYHM', password: process.env.TEST_ACCOUNT_PASSWORD_3 })
  });
  console.log('Login Status:', hmLogin.status);
  const hmCookie = hmLogin.headers.get('set-cookie')?.split(';')[0];
  console.log('Cookie received:', hmCookie?.substring(0, 35) + '...');

  const hmMeRes = await fetch('http://localhost:3000/api/user/me', {
    headers: { Cookie: hmCookie! }
  });
  console.log('GET /api/user/me Status:', hmMeRes.status);
  const hmMeJson = await hmMeRes.json();
  console.log('GET /api/user/me Body:\n', JSON.stringify(hmMeJson, null, 2));

  console.log('\n=== TEST 3: Login as student & Verify GET /api/user/me ===');
  const stuLogin = await fetch('http://localhost:3000/api/user/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profileId: 'syncin@VFYSTUDENT', password: process.env.TEST_ACCOUNT_PASSWORD_3 })
  });
  console.log('Login Status:', stuLogin.status);
  const stuCookie = stuLogin.headers.get('set-cookie')?.split(';')[0];
  console.log('Cookie received:', stuCookie?.substring(0, 35) + '...');

  const stuMeRes = await fetch('http://localhost:3000/api/user/me', {
    headers: { Cookie: stuCookie! }
  });
  console.log('GET /api/user/me Status:', stuMeRes.status);
  const stuMeJson = await stuMeRes.json();
  console.log('GET /api/user/me Body:\n', JSON.stringify(stuMeJson, null, 2));
}

main().catch(console.error);
