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
const BOOKS_QUERY_LEGACY = 'SELECT title, author, genre, description, price, volume, cover, type, publisher FROM books ORDER BY title ASC, volume ASC';
const BOOKS_QUERY_LEGACY_NO_VOLUME = 'SELECT title, author, genre, description, price, cover, type, publisher FROM books ORDER BY title ASC';

const queryBooks = async () => {
  try {
    return await db.query(BOOKS_QUERY);
  } catch (error) {
    if (error?.code !== '42703') {
      throw error;
    }

    try {
      return await db.query(BOOKS_QUERY_LEGACY);
    } catch (legacyError) {
      if (legacyError?.code !== '42703') {
        throw legacyError;
      }
      return db.query(BOOKS_QUERY_LEGACY_NO_VOLUME);
    }
  }
};

router.get('/api/books', booksLimiter, async (req, res) => {
  try {
    const result = await queryBooks();

    const grouped = {};
    for (const row of result.rows) {
      if (!grouped[row.title]) {
        grouped[row.title] = {
          title: row.title,
          author: row.author,
          genre: row.genre ? row.genre.split(',').map(g => g.trim()) : [],
          type: row.type,
          publisher: row.publisher,
          keywords: row.keywords ? row.keywords.split(',').map(k => k.trim()) : [],
          price: Number(row.price),
          description: row.description,
          volumes: [],
        };
      }
      const rawVolume = String(row.volume ?? '');
      const normalizedVolume = rawVolume.replace('Vol ', '').trim();
      const parsedVolume = Number(normalizedVolume);
      grouped[row.title].volumes.push({
        volumeNumber: normalizedVolume !== '' && Number.isFinite(parsedVolume) ? parsedVolume : null,
        cover: row.cover,
        page_count: row.page_count,
        release_date: row.release_date,
      });
    }

    const catalog = Object.values(grouped);
    return res.status(200).json(catalog);
  } catch (error) {
    console.error('Error fetching books catalog:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
