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

  // Handle legacy combined IDs like:
  // "One Piece::12"
  if (normalizedBookId && normalizedBookId.includes('::')) {
    const [idTitle, idVolume] = normalizedBookId.split('::');

    if (!requestedTitle) {
      requestedTitle = normalizeText(idTitle);
    }

    if (!requestedVolume) {
      requestedVolume = normalizeText(idVolume);
    }
  }

  // Volume is always required
  if (!requestedVolume) {
    return null;
  }

  const parsedVolume = Number(
    String(requestedVolume)
      .replace(/^(?:Vol\s*)?/i, '')
      .trim()
  );

  if (!Number.isInteger(parsedVolume) || parsedVolume <= 0) {
    return null;
  }

<<<<<<< HEAD
  let queryText;
  let queryParams;

  // Lookup by book ID
  if (normalizedBookId && !requestedTitle) {
    queryText = `
      SELECT
        b.id AS book_id,
        b.title,
        b.price,
        bv.volume_number,
        COALESCE(bv.cover, '') AS cover
      FROM books AS b
      JOIN book_volumes AS bv
        ON bv.book_id = b.id
      WHERE b.id = $1
        AND bv.volume_number = $2
      LIMIT 1
    `;

    queryParams = [normalizedBookId, parsedVolume];
  }

  // Lookup by title
  else {
    queryText = `
      SELECT
        b.id AS book_id,
        b.title,
        b.price,
        bv.volume_number,
        COALESCE(bv.cover, '') AS cover
      FROM books AS b
      JOIN book_volumes AS bv
        ON bv.book_id = b.id
      WHERE LOWER(b.title) = LOWER($1)
        AND bv.volume_number = $2
        AND ($3 IS NULL OR b.id = $3)
      LIMIT 1
    `;

    queryParams = [
      requestedTitle,
      parsedVolume,
      normalizedBookId,
    ];
  }

  const result = await db.query(queryText, queryParams);

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];

=======
  const rowBookId = normalizeText(row.book_id);
  if (!rowBookId) {
    return null;
  }

>>>>>>> 5aacee9e675e6f9d5becebcf5d159356791714c5
  return {
    bookId: rowBookId,
    bookTitle: row.title,
<<<<<<< HEAD
    volume: String(row.volume_number),
    cover: row.cover,
=======
    volume: row.volume.replace('Vol ', ''),
    cover: normalizeText(row.cover) || '',
>>>>>>> 5aacee9e675e6f9d5becebcf5d159356791714c5
    price: Number(row.price),
  };
}

module.exports = {
  findCatalogItem,
};