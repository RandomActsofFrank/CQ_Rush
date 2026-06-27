const fetch = require('node-fetch');
const { isLicenseExpired } = require('./callsignExpiry');
const { gridToLocation, getLocationFromCoords } = require('./geo');

async function lookupCallookCallsign(callsign) {
  const normalized = String(callsign || '').toUpperCase();
  const response = await fetch(`https://callook.info/${normalized}/json`);
  const data = await response.json();

  if (data.status !== 'VALID') {
    return null;
  }

  const gridSquare = data.location?.gridsquare || '';
  let locationData = {
    city: '',
    state: data.location?.state || '',
    country: data.location?.country || ''
  };

  if (gridSquare) {
    const coords = gridToLocation(gridSquare);
    if (coords) {
      const detailedLocation = await getLocationFromCoords(coords.lat, coords.lon);
      if (detailedLocation) {
        locationData = {
          city: detailedLocation.city,
          state: detailedLocation.state || locationData.state,
          country: detailedLocation.country || locationData.country
        };
      }
    }
  }

  const expiryDate = data.otherInfo?.expiryDate || '';
  const expired = isLicenseExpired(expiryDate);

  return {
    success: true,
    source: 'callook',
    name: data.name || '',
    callsign: data.current?.callsign || normalized,
    grid: gridSquare,
    city: locationData.city,
    state: locationData.state,
    country: locationData.country,
    expiryDate,
    isExpired: expired,
    cacheRecord: {
      callsign: data.current?.callsign || normalized,
      name: data.name || '',
      grid: gridSquare,
      city: locationData.city,
      state: locationData.state,
      country: locationData.country,
      timestamp: new Date()
    }
  };
}

module.exports = {
  lookupCallookCallsign
};
