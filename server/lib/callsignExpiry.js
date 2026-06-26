function parseCallookExpiryDate(expiryDateStr) {
  if (!expiryDateStr || typeof expiryDateStr !== 'string') {
    return null;
  }

  const match = expiryDateStr.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) {
    return null;
  }

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime())
    || date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function isLicenseExpired(expiryDateStr, now = new Date()) {
  const expiry = parseCallookExpiryDate(expiryDateStr);
  if (!expiry) {
    return false;
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const expiryDay = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
  return expiryDay < today;
}

module.exports = {
  isLicenseExpired,
  parseCallookExpiryDate
};
