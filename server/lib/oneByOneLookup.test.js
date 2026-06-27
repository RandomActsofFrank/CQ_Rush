const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isOneByOneCallsign,
  parseOneByOneDetailPage,
  parseOneByOneSearchResultsPage,
  extractDetailIds,
  pickBestReservation,
  reservationToLookupResult,
  listAllOneByOneCallsigns,
  buildOneByOneDateRangeSearchUrl,
  isValidDateRange,
  suggestedFieldDayDateRange
} = require('./oneByOneLookup');

test('isOneByOneCallsign matches FCC 1x1 format', () => {
  assert.equal(isOneByOneCallsign('K6T'), true);
  assert.equal(isOneByOneCallsign('w1a'), true);
  assert.equal(isOneByOneCallsign('N4S'), true);
  assert.equal(isOneByOneCallsign('K6X'), false);
  assert.equal(isOneByOneCallsign('K1FMK'), false);
});

test('listAllOneByOneCallsigns returns 750 combinations', () => {
  assert.equal(listAllOneByOneCallsigns().length, 750);
});

test('parseOneByOneDetailPage reads detail table fields', () => {
  const html = `
    <table>
      <tr><td>1x1call</td><td>W5T</td></tr>
      <tr><td>Coordinator</td><td>W5YI</td></tr>
      <tr><td>Event</td><td>ARRL Field Day</td></tr>
      <tr><td>Requestor</td><td>WEST FORK AMATEUR RADIO CLUB Trustee:WQ5A</td></tr>
      <tr><td>Requestor call</td><td>W5WFR</td></tr>
      <tr><td>Requestor addr</td><td>PO Box 1134 BRIDGEPORT, TX 76426</td></tr>
      <tr><td>Start</td><td>2025-06-28</td></tr>
      <tr><td>End</td><td>2025-06-29</td></tr>
    </table>
  `;

  assert.deepEqual(parseOneByOneDetailPage(html, '12345'), {
    id: 12345,
    callsign: 'W5T',
    coordinator: 'W5YI',
    eventName: 'ARRL Field Day',
    requestor: 'WEST FORK AMATEUR RADIO CLUB Trustee:WQ5A',
    requestorCall: 'W5WFR',
    requestorAddr: 'PO Box 1134 BRIDGEPORT, TX 76426',
    startDate: '2025-06-28',
    endDate: '2025-06-29'
  });
});

test('buildOneByOneDateRangeSearchUrl uses startd and endd parameters', () => {
  assert.equal(
    buildOneByOneDateRangeSearchUrl('2025-06-28', '2025-06-29'),
    'https://www.1x1callsigns.org/1x1search.php?startd=2025-06-28&endd=2025-06-29'
  );
});

test('isValidDateRange validates YYYY-MM-DD inputs', () => {
  assert.equal(isValidDateRange('2025-06-28', '2025-06-29'), true);
  assert.equal(isValidDateRange('2025-06-30', '2025-06-29'), false);
  assert.equal(isValidDateRange('', '2025-06-29'), false);
});

test('parseOneByOneSearchResultsPage reads date-range search table', () => {
  const html = `
    <table>
      <tr><th>Call</th><th>Start</th><th>End</th><th>Event</th><th>ID</td></tr>
      <tr><td>W5T</td><td>2025-06-28</td><td>2025-06-29</td><td>Arrl Field Day</td><td><a href=/1x1search.php?byid=25470>details</a></td></tr>
      <tr><td>K6T</td><td>2025-06-25</td><td>2025-06-30</td><td>Arrl Field Day</td><td><a href=/1x1search.php?byid=25783>details</a></td></tr>
    </table>
  `;

  const rows = parseOneByOneSearchResultsPage(html);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].callsign, 'W5T');
  assert.equal(rows[0].id, 25470);
  assert.equal(rows[1].callsign, 'K6T');
});

test('suggestedFieldDayDateRange is two days before and after Field Day weekend', () => {
  const range2026 = suggestedFieldDayDateRange(new Date('2026-03-01T00:00:00Z'));
  assert.equal(range2026.fieldDayStart, '2026-06-27');
  assert.equal(range2026.fieldDayEnd, '2026-06-28');
  assert.equal(range2026.startDate, '2026-06-25');
  assert.equal(range2026.endDate, '2026-06-30');

  const range2025 = suggestedFieldDayDateRange(new Date('2025-03-01T00:00:00Z'));
  assert.equal(range2025.fieldDayStart, '2025-06-28');
  assert.equal(range2025.fieldDayEnd, '2025-06-29');
  assert.equal(range2025.startDate, '2025-06-26');
  assert.equal(range2025.endDate, '2025-07-01');
});

test('extractDetailIds finds reservation links on search page', () => {
  const html = `
    <a href="1x1search.php?byid=100">Details</a>
    <a href="https://www.1x1callsigns.org/1x1search.php?byid=26578">Details</a>
  `;

  assert.deepEqual(extractDetailIds(html), ['100', '26578']);
});

test('pickBestReservation prefers in-range reservation', () => {
  const reservations = [
    {
      callsign: 'K8O',
      eventName: 'Older Event',
      startDate: '2024-01-01',
      endDate: '2024-01-02'
    },
    {
      callsign: 'K8O',
      eventName: 'Ohio QSO Party 2026',
      startDate: '2026-05-16',
      endDate: '2026-05-17'
    }
  ];

  const best = pickBestReservation(reservations, new Date('2026-05-16T12:00:00Z'));
  assert.equal(best.eventName, 'Ohio QSO Party 2026');
});

test('reservationToLookupResult uses requestor call enrichment fields', () => {
  const result = reservationToLookupResult({
    callsign: 'W5T',
    eventName: 'ARRL Field Day',
    requestor: 'WEST FORK AMATEUR RADIO CLUB',
    requestorCall: 'W5WFR',
    licenseName: 'JANE OPERATOR',
    grid: 'EM13',
    startDate: '2025-06-28',
    endDate: '2025-06-29'
  }, '1x1-cache');

  assert.equal(result.name, 'JANE OPERATOR');
  assert.equal(result.holderCallsign, 'W5WFR');
  assert.equal(result.grid, 'EM13');
  assert.equal(result.source, '1x1-cache');
});
