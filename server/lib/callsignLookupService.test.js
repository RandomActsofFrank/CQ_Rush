const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getLookupDisplayName,
  isContactNameMissing,
  toPublicLookupResponse
} = require('./callsignLookupService');

test('isContactNameMissing detects blank names', () => {
  assert.equal(isContactNameMissing(''), true);
  assert.equal(isContactNameMissing('   '), true);
  assert.equal(isContactNameMissing(null), true);
  assert.equal(isContactNameMissing('Terrence Paton'), false);
});

test('getLookupDisplayName prefers operator name over event fields', () => {
  assert.equal(getLookupDisplayName({ name: 'Jane Operator', eventName: 'Field Day' }), 'Jane Operator');
  assert.equal(getLookupDisplayName({ eventName: 'Field Day' }), 'Field Day');
});

test('toPublicLookupResponse maps lookup result for API clients', () => {
  const response = toPublicLookupResponse({
    success: true,
    callsign: 'VE7UP',
    name: 'Terrence David Paton',
    source: 'ised-mirror',
    country: 'Canada'
  });

  assert.equal(response.success, true);
  assert.equal(response.callsign, 'VE7UP');
  assert.equal(response.source, 'ised-mirror');
});
