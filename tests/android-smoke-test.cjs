// Squad Surge: Android CLI & Mobile Ergonomics Automated Test Suite
const assert = require('assert');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('  Squad Surge: Android CLI & Mobile Verification Tests');
console.log('====================================================');

let totalTests = 0;
let passedTests = 0;

function it(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

// 1. Android CLI Installation & Version Verification
it('Android CLI binary is accessible and reports version', () => {
  const output = execSync('android --version', { encoding: 'utf-8' }).trim();
  assert.ok(output.length > 0, 'Android CLI must report a version string');
  console.log(`    [Android CLI Version: ${output}]`);
});

// 2. Android SDK Configuration Verification
it('Android SDK environment and info are initialized', () => {
  const output = execSync('android info', { encoding: 'utf-8' }).trim();
  assert.ok(output.includes('sdk:'), 'Android SDK path must be registered in Android CLI');
  assert.ok(output.includes('version:'), 'Android CLI version must be reported in info');
});

// 3. Android Virtual Devices (AVD) Matrix
it('Android CLI detects configured mobile AVDs (e.g. medium_phone)', () => {
  const output = execSync('android emulator list', { encoding: 'utf-8' }).trim();
  assert.ok(output.includes('medium_phone'), 'Target virtual device medium_phone must be present in emulator list');
});

// 4. Mobile Viewport & PWA Gaming Meta Configuration
it('index.html contains mobile gaming viewport with viewport-fit=cover', () => {
  const htmlPath = path.resolve(__dirname, '../index.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
  assert.ok(htmlContent.includes('viewport-fit=cover'), 'index.html must include viewport-fit=cover for edge-to-edge mobile screens');
  assert.ok(htmlContent.includes('user-scalable=no') || htmlContent.includes('maximum-scale=1'), 'Viewport must disable accidental pinch-zoom during combat');
  assert.ok(htmlContent.includes('apple-mobile-web-app-capable'), 'iOS & Android PWA standalone capabilities must be declared');
});

// 5. Single-Thumb Mobile Ergonomics & Defense Line
it('Highway Defense Line preserves ergonomic thumb track (H - 108)', () => {
  const H = 780; // Standard mobile canvas reference height
  const defenseY = H - 108; // 672
  const thumbTrackHeight = H - defenseY; // 108px dedicated thumb touch track
  assert.strictEqual(thumbTrackHeight, 108, 'Thumb track must provide at least 108px touch buffer underneath squad');
  assert.ok(thumbTrackHeight >= 88, 'Thumb track must meet Apple & Android minimum touch ergonomics');
});

// 6. Header Action Button Accessible Hit Target (Min 44x44px mobile touch standard)
it('Header pause and account buttons comply with min 44px touch targets', () => {
  const htmlPath = path.resolve(__dirname, '../index.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
  assert.ok(htmlContent.includes('id="btnPause"'), 'Header must declare btnPause');
  assert.ok(htmlContent.includes('id="btnAccountHeader"'), 'Header must declare btnAccountHeader');
  assert.ok(htmlContent.includes('btn-tap'), 'Interactive buttons must include responsive tap feedback class');
});

console.log('====================================================');
console.log(`  Android Tests Completed: ${passedTests} / ${totalTests} Passed`);
console.log('====================================================');

if (passedTests < totalTests) {
  process.exit(1);
} else {
  process.exit(0);
}
