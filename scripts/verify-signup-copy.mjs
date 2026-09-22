import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  console.log("Navigating to http://localhost:3000/signup...");
  await page.goto("http://localhost:3000/signup", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  // Check 1: Student role initial message
  const headline1 = await page.locator(".morph-wrap h2").first().innerText();
  console.log("Student initial headline:", headline1);
  await page.screenshot({ path: "student_initial.png" });

  // Check 2: Wait 4.2s for auto-rotation
  console.log("Waiting 4.2s for auto-rotation...");
  await page.waitForTimeout(4200);
  const headlineAfterRotate = await page.locator(".morph-wrap h2").first().innerText();
  console.log("Student rotated headline:", headlineAfterRotate);
  await page.screenshot({ path: "student_rotated.png" });

  // Check 3: Click Hiring Team
  console.log("Clicking Hiring Team...");
  await page.getByRole("button", { name: "Hiring Team" }).click();
  await page.waitForTimeout(1000); // Allow morph transition
  const hiringHeadline = await page.locator(".morph-wrap h2").first().innerText();
  console.log("Hiring Team headline:", hiringHeadline);
  await page.screenshot({ path: "hiring_team.png" });

  // Check 4: Click Mentor
  console.log("Clicking Mentor...");
  await page.getByRole("button", { name: "Mentor" }).click();
  await page.waitForTimeout(1000); // Allow morph transition
  const mentorHeadline = await page.locator(".morph-wrap h2").first().innerText();
  console.log("Mentor headline:", mentorHeadline);
  await page.screenshot({ path: "mentor.png" });

  await browser.close();
  console.log("All verifications completed successfully!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
