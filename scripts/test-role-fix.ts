import * as dotenv from 'dotenv';
import path from 'path';
import { AUTH_STORAGE_KEY } from '../lib/constants/auth';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Simulation of browser's localStorage
class MockLocalStorage {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = value;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }
}

const localStorage = new MockLocalStorage();
const STORAGE_KEY = AUTH_STORAGE_KEY;

// Exact implementation of the verifySession effect inside app/providers.tsx
async function simulateMountVerifySession(cookie: string | null) {
  const headers: Record<string, string> = { 'Cache-Control': 'no-cache' };
  if (cookie) {
    headers['Cookie'] = cookie;
  }

  const res = await fetch('http://localhost:3000/api/user/me', {
    headers,
  });

  if (res.ok) {
    const data = await res.json();
    if (data.success && data.user) {
      const serverUser = {
        userId: data.user.userId,
        profileId: data.user.profileId,
        username: data.user.username,
        role: data.user.role,
        collegeId: data.user.collegeId,
        companyId: data.user.companyId,
        emailVerified: data.user.emailVerified,
      };

      let clientData: any = {};
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) clientData = JSON.parse(raw);
      } catch {}

      const mergedUser = {
        ...clientData,
        ...serverUser,
        role: serverUser.role,
        username: serverUser.username,
        profileId: serverUser.profileId,
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedUser));
      return { user: mergedUser, isLoggedIn: true };
    }
  }

  localStorage.removeItem(STORAGE_KEY);
  return { user: null, isLoggedIn: false };
}

async function runStep3() {
  console.log('================================================================');
  console.log('STEP 3A: P0 Item #4 Stale Mismatch & Tampering Test');
  console.log('================================================================');

  // 1. Log in as hiring_manager
  console.log('1. Logging in as hiring_manager...');
  const hmLogin = await fetch('http://localhost:3000/api/user/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profileId: 'syncin@VFYHM', password: process.env.TEST_ACCOUNT_PASSWORD_3 }),
  });
  const hmCookie = hmLogin.headers.get('set-cookie')?.split(';')[0]!;
  console.log('   Logged in. Cookie:', hmCookie.substring(0, 30) + '...');

  // Set initial localStorage upon login
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      username: 'VerifyHM',
      profileId: 'syncin@VFYHM',
      role: 'hiring_manager',
    })
  );
  console.log('   Initial localStorage:', localStorage.getItem(STORAGE_KEY));

  // 2. Manually mutate localStorage to tamper role: "student"
  console.log('\n2. Manually mutating localStorage to set role: "student" (tampered)...');
  const tampered = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
  tampered.role = 'student';
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tampered));
  console.log('   Tampered localStorage:', localStorage.getItem(STORAGE_KEY));

  // 3. Simulate Hard Reload (F5) -> calls mount effect in AuthProvider with the browser cookie
  console.log('\n3. Simulating Hard Reload (F5)... mounting AuthProvider and calling GET /api/user/me...');
  const reloadState = await simulateMountVerifySession(hmCookie);

  console.log('   Resolved User Role in UI React state:', reloadState.user?.role);
  console.log('   Is Logged In:', reloadState.isLoggedIn);
  console.log('   localStorage after reload verification:', localStorage.getItem(STORAGE_KEY));

  const roleFixed = reloadState.user?.role === 'hiring_manager';
  const lsFixed = JSON.parse(localStorage.getItem(STORAGE_KEY)!).role === 'hiring_manager';

  console.log('\n   Result:');
  console.log('   - UI Role re-derived as hiring_manager:', roleFixed ? 'PASS ✓' : 'FAIL ✗');
  console.log('   - localStorage silently corrected to hiring_manager:', lsFixed ? 'PASS ✓' : 'FAIL ✗');

  console.log('\n================================================================');
  console.log('STEP 3B: Normal Logout -> Login as Student (Role Switch) Test');
  console.log('================================================================');

  // 1. Logout: clears localStorage and state
  console.log('1. User clicks Logout...');
  localStorage.removeItem(STORAGE_KEY);
  console.log('   localStorage after logout:', localStorage.getItem(STORAGE_KEY));

  // 2. Login as student
  console.log('\n2. Logging in as student (syncin@VFYSTUDENT)...');
  const stuLogin = await fetch('http://localhost:3000/api/user/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profileId: 'syncin@VFYSTUDENT', password: process.env.TEST_ACCOUNT_PASSWORD_3 }),
  });
  const stuCookie = stuLogin.headers.get('set-cookie')?.split(';')[0]!;
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      username: 'VerifyStudent',
      profileId: 'syncin@VFYSTUDENT',
      role: 'student',
    })
  );
  console.log('   Logged in. Cookie:', stuCookie.substring(0, 30) + '...');
  console.log('   localStorage right after student login:', localStorage.getItem(STORAGE_KEY));

  // 3. Reload as student
  console.log('\n3. Reloading page as student...');
  const stuReloadState = await simulateMountVerifySession(stuCookie);
  console.log('   Resolved User Role in UI React state:', stuReloadState.user?.role);
  console.log('   localStorage after student reload:', localStorage.getItem(STORAGE_KEY));

  const stuRolePass = stuReloadState.user?.role === 'student';
  console.log('\n   Result:');
  console.log('   - Role after student login and reload is student:', stuRolePass ? 'PASS ✓' : 'FAIL ✗');

  console.log('\n================================================================');
  console.log('STEP 3C: Expired / Missing Session Cleanup Test');
  console.log('================================================================');
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ username: 'GhostUser', role: 'admin' }));
  console.log('   Simulating stale localStorage with expired/no cookie...');
  const noCookieReload = await simulateMountVerifySession(null);
  console.log('   Resolved User state:', noCookieReload.user);
  console.log('   Is Logged In:', noCookieReload.isLoggedIn);
  console.log('   localStorage purged on 401:', localStorage.getItem(STORAGE_KEY) === null ? 'PASS ✓' : 'FAIL ✗');
}

runStep3().catch(console.error);
