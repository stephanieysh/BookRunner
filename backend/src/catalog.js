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

  const queryVariants = [
    {
      text: `SELECT b.id AS book_id,
                    b.title,
                    b.price,
                    bv.volume_number,
                    COALESCE(bv.cover, '') AS cover
             FROM books AS b
             JOIN book_volumes AS bv ON bv.book_id = b.id
             WHERE LOWER(b.title) = LOWER($1)
               AND bv.volume_number = $2
             LIMIT 1`,
      params: [requestedTitle, parsedVolume],
      volumeField: 'volume_number',
    },
    {
      text: `SELECT b.id AS book_id,
                    b.title,
                    b.price,
                    b.volume,
                    COALESCE(b.cover, '') AS cover
             FROM books AS b
             WHERE LOWER(b.title) = LOWER($1)
               AND b.volume = $2
             LIMIT 1`,
      params: [requestedTitle, String(parsedVolume)],
      volumeField: 'volume',
    },
    {
      text: `SELECT b.id AS book_id,
                    b.title,
                    b.price,
                    b.volume,
                    COALESCE(b.cover, '') AS cover
             FROM books AS b
             WHERE LOWER(b.title) = LOWER($1)
               AND b.volume = $2
             LIMIT 1`,
      params: [requestedTitle, `Vol ${parsedVolume}`],
      volumeField: 'volume',
    },
  ];

  let row = null;
  let selectedVolumeField = null;

  for (const variant of queryVariants) {
    try {
      const result = await db.query(variant.text, variant.params);
      if (result.rows.length > 0) {
        row = result.rows[0];
        selectedVolumeField = variant.volumeField;
        break;
      }
    } catch (error) {
      if (error.code === '42703') {
        continue;
      }
      throw error;
    }
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
