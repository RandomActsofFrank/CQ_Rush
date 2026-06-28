const test = require('node:test');
const assert = require('node:assert/strict');
const { getRefreshCooldownInfo } = require('./oneByOneCache');

test('getRefreshCooldownInfo allows refresh when cache is idle', () => {
  const info = getRefreshCooldownInfo({ status: 'idle' });
  assert.equal(info.canRefresh, true);
  assert.equal(info.cooldownBypassed, false);
  assert.equal(info.cooldownHours, 72);
});

test('getRefreshCooldownInfo blocks refresh within 72 hours of success', () => {
  const refreshedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const info = getRefreshCooldownInfo({ status: 'complete', refreshedAt });
  assert.equal(info.canRefresh, false);
  assert.ok(info.nextRefreshAt);
  assert.ok(info.remainingMs > 0);
});

test('getRefreshCooldownInfo allows refresh after 72 hours since success', () => {
  const refreshedAt = new Date(Date.now() - 73 * 60 * 60 * 1000).toISOString();
  const info = getRefreshCooldownInfo({ status: 'complete', refreshedAt });
  assert.equal(info.canRefresh, true);
});

test('getRefreshCooldownInfo bypasses cooldown after failed refresh', () => {
  const info = getRefreshCooldownInfo({
    status: 'error',
    message: '1×1 date-range search failed: 1x1 lookup HTTP 403',
    refreshedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString()
  });
  assert.equal(info.canRefresh, true);
  assert.equal(info.cooldownBypassed, true);
});
