const fetch = require('node-fetch');

function gridToLocation(gridSquare) {
  if (!gridSquare || gridSquare.length < 4) return null;

  const grid = gridSquare.toUpperCase();
  const field1 = grid.charCodeAt(0) - 65;
  const field2 = grid.charCodeAt(1) - 65;
  const square1 = parseInt(grid.charAt(2), 10);
  const square2 = parseInt(grid.charAt(3), 10);

  let lon = (field1 * 20) + (square1 * 2) - 180;
  let lat = (field2 * 10) + square2 - 90;

  if (grid.length >= 6) {
    const subsquare1 = grid.charCodeAt(4) - 65;
    const subsquare2 = grid.charCodeAt(5) - 65;
    lon += (subsquare1 * 5 / 60);
    lat += (subsquare2 * 2.5 / 60);
  }

  return { lat, lon };
}

async function getLocationFromCoords(lat, lon) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=6&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'HamRadioContestLogger/1.0'
        }
      }
    );

    if (!response.ok) {
      throw new Error('Reverse geocoding failed');
    }

    const data = await response.json();
    if (data.error) {
      return null;
    }

    const address = data.address || {};
    return {
      city: address.city || address.town || address.village || address.county || '',
      state: address.state || address.province || '',
      country: address.country || ''
    };
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}

module.exports = {
  gridToLocation,
  getLocationFromCoords
};
