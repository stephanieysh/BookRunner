'use strict';

const db = require('./db');

function normalizeText(value) {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : null;
}

async function findCatalogItem({ bookId, bookTitle, volume }) {
  const normalizedBookId = normalizeText(bookId);
  let requestedTitle = normalizeText(bookTitle);
  let requestedVolume = normalizeText(volume);

  if (normalizedBookId && normalizedBookId.includes('::')) {
    const [idTitle, idVolume] = normalizedBookId.split('::');
    requestedTitle = normalizeText(idTitle);
    if (!requestedVolume) {
      requestedVolume = normalizeText(idVolume);
    }
  }

  if (!requestedTitle || !requestedVolume) {
    return null;
  }

  const parsedVolume = Number(String(requestedVolume).replace(/^(?:Vol\s*)?/i, '').trim());
  if (!Number.isInteger(parsedVolume) || parsedVolume <= 0) {
    return null;
  }

  let queryText = null;
  let queryParams = null;
  const selectedVolumeField = 'volume_number';

  if (normalizedBookId && !requestedTitle) {
    queryText = `SELECT b.id AS book_id,
                        b.title,
                        b.price,
                        bv.volume_number,
                        COALESCE(bv.cover, '') AS cover
                 FROM books AS b
                 JOIN book_volumes AS bv ON bv.book_id = b.id
                 WHERE b.id = $1
                   AND bv.volume_number = $2
                 LIMIT 1`;
    queryParams = [normalizedBookId, parsedVolume];
  } else {
    queryText = `SELECT b.id AS book_id,
                        b.title,
                        b.price,
                        bv.volume_number,
                        COALESCE(bv.cover, '') AS cover
                 FROM books AS b
                 JOIN book_volumes AS bv ON bv.book_id = b.id
                 WHERE LOWER(b.title) = LOWER($1)
                   AND bv.volume_number = $2
                   AND ($3 IS NULL OR b.id = $3)
                 LIMIT 1`;
    queryParams = [requestedTitle, parsedVolume, normalizedBookId];
  }

  let row = null;
  const result = await db.query(queryText, queryParams);
  if (result.rows.length > 0) {
    row = result.rows[0];
  }

  if (!row) {
    return null;
  }

  return {
    bookId: row.book_id,
    bookTitle: row.title,
    volume: String(row[selectedVolumeField] ?? parsedVolume),
    cover: row.cover,
    price: Number(row.price),
  };
}

module.exports = {
  findCatalogItem,
};
