const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isCanadianCallsign,
  parseFoxhollowHtml,
  parseIsedSearchHtml,
  latLonToGridSquare
} = require('./canadianCallsignLookup');

test('isCanadianCallsign matches VA/VE/VO/VY and CY prefixes', () => {
  assert.equal(isCanadianCallsign('VE3DC'), true);
  assert.equal(isCanadianCallsign('ve7up'), true);
  assert.equal(isCanadianCallsign('VA3PO'), true);
  assert.equal(isCanadianCallsign('VO1ABC'), true);
  assert.equal(isCanadianCallsign('VY0ZZ'), true);
  assert.equal(isCanadianCallsign('CY9AM'), true);
  assert.equal(isCanadianCallsign('K1FMK'), false);
  assert.equal(isCanadianCallsign('W5T'), false);
  assert.equal(isCanadianCallsign('VK2ABC'), false);
  assert.equal(isCanadianCallsign('CU8ABC'), false);
});

test('parseFoxhollowHtml reads individual and club records', () => {
  const individualHtml = `
    <font color=red><b>VE7UP</b></font>&nbsp;Terrence David Paton
    <br>10156 BLUE MOUNTAIN ROAD <br>
    VANDERHOOF, BC V0J3A2<br>
  `;
  const clubHtml = `
    <font color=red><b>VE3DC</b></font>&nbsp;HAMILTON AMATEUR RADIO CLUB<br>
    HAMILTON, ON L8H7S7<br><br>
  `;

  assert.deepEqual(parseFoxhollowHtml(individualHtml, 'VE7UP'), {
    callsign: 'VE7UP',
    name: 'Terrence David Paton',
    addressLine: '10156 BLUE MOUNTAIN ROAD',
    city: 'VANDERHOOF',
    province: 'BC',
    postalCode: 'V0J3A2',
    isClub: false
  });

  const club = parseFoxhollowHtml(clubHtml, 'VE3DC');
  assert.equal(club.callsign, 'VE3DC');
  assert.equal(club.name, 'HAMILTON AMATEUR RADIO CLUB');
  assert.equal(club.city, 'HAMILTON');
  assert.equal(club.province, 'ON');
  assert.equal(club.isClub, true);
});

test('parseFoxhollowHtml ignores partial prefix matches', () => {
  const html = `
    <font color=red><b>VE3DCA</b></font>&nbsp;Daren M Carrier<br>
    <font color=red><b>VE3DC</b></font>&nbsp;HAMILTON AMATEUR RADIO CLUB<br>
    HAMILTON, ON L8H7S7<br>
  `;

  const result = parseFoxhollowHtml(html, 'VE3DC');
  assert.equal(result.name, 'HAMILTON AMATEUR RADIO CLUB');
});

test('parseIsedSearchHtml extracts name and province', () => {
  const html = `
    <tr><td><a href="detail">VE7UP</a></td><td>Individual</td><td>Paton, Terrence David</td></tr>
    <tr><td colspan="4">Vanderhoof, BC</td></tr>
  `;

  const result = parseIsedSearchHtml(html, 'VE7UP');
  assert.equal(result.callsign, 'VE7UP');
  assert.ok(result.name.includes('Paton') || result.name.includes('Terrence'));
  assert.equal(result.province, 'BC');
});

test('latLonToGridSquare returns a four-character grid', () => {
  const grid = latLonToGridSquare(43.2557, -79.8711);
  assert.match(grid, /^[A-R][A-R][0-9][0-9]$/);
});
