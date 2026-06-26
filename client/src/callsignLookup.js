export function buildLicenseNotice(lookupData, callsign) {
  if (!lookupData?.isExpired) {
    return null;
  }

  return {
    callsign: lookupData.callsign || callsign,
    expiryDate: lookupData.expiryDate || ''
  };
}
