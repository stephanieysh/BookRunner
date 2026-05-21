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

router.get('/resources/api_books.php', booksLimiter, async (req, res) => {
  try {
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

    const grouped = {};

    for (const row of result.rows) {
      if (!grouped[row.book_id]) {
        grouped[row.book_id] = {
          id: row.book_id,
          title: row.title,
          author: row.author,
          genre: row.genre || [],
          type: row.type,
          publisher: row.publisher,
          keywords: row.keywords || [],
          price: Number(row.price),
          description: row.description,
          volumes: [],
        };
      }

      if (row.volume_number !== null) {
        grouped[row.book_id].volumes.push({
          volumeNumber: row.volume_number,
          cover: row.cover,
          page_count: row.page_count,
          release_date: row.release_date,
        });
      }
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