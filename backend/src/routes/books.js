'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db');

const router = express.Router();

const booksLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

const BOOKS_QUERY = 'SELECT book_id, title, author, genre, description, price, volume, cover, type, publisher, keywords, page_count, release_date FROM books ORDER BY title ASC, volume ASC';
const BOOKS_QUERY_NO_BOOK_ID = 'SELECT title, author, genre, description, price, volume, cover, type, publisher, keywords, page_count, release_date FROM books ORDER BY title ASC, volume ASC';
const BOOKS_QUERY_LEGACY = 'SELECT title, author, genre, description, price, volume, cover, type, publisher FROM books ORDER BY title ASC, volume ASC';
const BOOKS_QUERY_LEGACY_NO_COVER = 'SELECT title, author, genre, description, price, volume, type, publisher FROM books ORDER BY title ASC, volume ASC';
const BOOKS_QUERY_LEGACY_NO_VOLUME = 'SELECT title, author, genre, description, price, cover, type, publisher FROM books ORDER BY title ASC';
const BOOKS_QUERY_LEGACY_NO_VOLUME_NO_COVER = 'SELECT title, author, genre, description, price, type, publisher FROM books ORDER BY title ASC';
const POSTGRES_UNDEFINED_COLUMN = '42703';

const toList = (value) => {
  if (value == null) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  return String(value).split(',').map((item) => item.trim()).filter(Boolean);
};

const queryBooks = async () => {
  const fallbackQueries = [
    BOOKS_QUERY,
    BOOKS_QUERY_NO_BOOK_ID,
    BOOKS_QUERY_LEGACY,
    BOOKS_QUERY_LEGACY_NO_COVER,
    BOOKS_QUERY_LEGACY_NO_VOLUME,
    BOOKS_QUERY_LEGACY_NO_VOLUME_NO_COVER,
  ];

  let latestError = null;
  for (const sql of fallbackQueries) {
    try {
      return await db.query(sql);
    } catch (error) {
      if (error?.code !== POSTGRES_UNDEFINED_COLUMN) {
        throw error;
      }
      latestError = error;
    }
  }

  throw latestError;
};

router.get('/api/books', booksLimiter, async (req, res) => {
  try {
<<<<<<< HEAD
    const result = await db.query(`
      SELECT 
        b.id AS book_id,
        b.title,
        b.author,
        b.type,
        b.genre,
        b.keywords,
        b.publisher,
        b.description,
        b.price,

        v.volume_number,
        v.cover,
        v.page_count,
        v.release_date

      FROM books b
      LEFT JOIN book_volumes v ON b.id = v.book_id
      ORDER BY b.title ASC, v.volume_number ASC
    `);
=======
    const result = await queryBooks();
>>>>>>> 5aacee9e675e6f9d5becebcf5d159356791714c5

    const grouped = {};

    for (const row of result.rows) {
      if (!grouped[row.book_id]) {
        grouped[row.book_id] = {
          id: row.book_id,
          title: row.title,
          author: row.author,
<<<<<<< HEAD
          genre: row.genre || [],
          type: row.type,
          publisher: row.publisher,
          keywords: row.keywords || [],
=======
          genre: toList(row.genre),
          type: row.type,
          publisher: row.publisher,
          keywords: toList(row.keywords),
>>>>>>> 5aacee9e675e6f9d5becebcf5d159356791714c5
          price: Number(row.price),
          description: row.description,
          volumes: [],
        };
      }
<<<<<<< HEAD

      if (row.volume_number !== null) {
        grouped[row.book_id].volumes.push({
          volumeNumber: row.volume_number,
          cover: row.cover,
          page_count: row.page_count,
          release_date: row.release_date,
        });
      }
=======
      const rawVolume = String(row.volume ?? '');
      const normalizedVolume = rawVolume.replace('Vol ', '').trim();
      const parsedVolume = Number(normalizedVolume);
      grouped[row.title].volumes.push({
        volumeNumber: normalizedVolume !== '' && Number.isFinite(parsedVolume) ? parsedVolume : null,
        cover: row.cover ?? null,
        page_count: row.page_count ?? null,
        release_date: row.release_date ?? null,
      });
>>>>>>> 5aacee9e675e6f9d5becebcf5d159356791714c5
    }

    const catalog = Object.values(grouped);
    return res.status(200).json(catalog);

  } catch (error) {
    console.error('Error fetching books catalog:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
});

module.exports = router;