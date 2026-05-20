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
    const result = await db.query(
      'SELECT book_id, title, author, genre, description, price, volume, cover, type, publisher, keywords, page_count, release_date FROM books ORDER BY title ASC, volume ASC'
    );

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
      grouped[row.title].volumes.push({
        volumeNumber: Number(row.volume.replace('Vol ', '')),
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
