function serializeRecord(record) {
  if (record === null || record === undefined) {
    return record;
  }

  const serialized = JSON.parse(
    JSON.stringify(record, (_, value) =>
      typeof value === 'bigint' ? Number(value) : value
    )
  );

  // Contacts store the logging operator in createdBy; expose as operator for the client.
  if (
    serialized
    && typeof serialized === 'object'
    && Object.prototype.hasOwnProperty.call(serialized, 'callsign')
    && Object.prototype.hasOwnProperty.call(serialized, 'createdBy')
  ) {
    serialized.operator = serialized.createdBy || serialized.lastEditedBy || null;
  }

  return serialized;
}

function serializeRecords(records) {
  return records.map(serializeRecord);
}

module.exports = { serializeRecord, serializeRecords };
