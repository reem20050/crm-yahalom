const axios = require('axios');

/**
 * Geocode an address to lat/lng using Google Maps Geocoding API
 */
async function geocodeAddress(address, city) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error('Google Maps API key not configured');

  const fullAddress = city ? `${address}, ${city}, Israel` : `${address}, Israel`;
  const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
    params: { address: fullAddress, key: apiKey, language: 'he' }
  });

  if (response.data.status === 'OK' && response.data.results.length > 0) {
    const location = response.data.results[0].geometry.location;
    return {
      latitude: location.lat,
      longitude: location.lng,
      formatted_address: response.data.results[0].formatted_address
    };
  }
  return null;
}

/**
 * Calculate distance between two points using Haversine formula
 * @returns distance in meters
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

module.exports = { geocodeAddress, calculateDistance };
