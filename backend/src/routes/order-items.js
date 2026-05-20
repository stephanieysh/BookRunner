'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { asyncHandler, requireAuth } = require('../middleware/auth');

const router = express.Router();
const orderItemsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

function normalizeQuantity(value) {
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized > 0 ? normalized : null;
}

function normalizeRequiredId(value) {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : null;
}

router.put('/resources/api_order_items.php', orderItemsLimiter, requireAuth, asyncHandler(async (req, res) => {
  const orderItemId = normalizeRequiredId(req.query?.id);
  const quantity = normalizeQuantity(req.body?.quantity);

  if (!orderItemId || !quantity) {
    return res.status(400).json({ error: 'id and a positive integer quantity are required' });
  }

  const result = await db.query(
    `UPDATE order_items AS oi
     SET quantity = $1, line_total = oi.unit_price * $1
     FROM orders AS o
     WHERE oi.id = $2
       AND oi.order_id = o.id
       AND o.user_id = $3
     RETURNING oi.id, oi.order_id, oi.quantity, oi.unit_price, oi.line_total`,
    [quantity, orderItemId, req.user.sub],
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'Order item not found' });
  }

  return res.status(200).json({ success: true, affected_rows: result.rowCount, data: result.rows[0] });
}));

router.delete('/resources/api_order_items.php', orderItemsLimiter, requireAuth, asyncHandler(async (req, res) => {
  const orderItemId = normalizeRequiredId(req.query?.id);
  const orderId = normalizeRequiredId(req.query?.order_id);

  if (!orderItemId || !orderId) {
    return res.status(400).json({ error: 'id and order_id are required' });
  }

  await db.query('BEGIN');

  try {
    const deleteOrderItemResult = await db.query(
      `DELETE FROM order_items AS oi
       USING orders AS o
       WHERE oi.id = $1
         AND oi.order_id = $2
         AND oi.order_id = o.id
         AND o.user_id = $3
       RETURNING oi.id`,
      [orderItemId, orderId, req.user.sub],
    );

    if (deleteOrderItemResult.rowCount === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Order item not found' });
    }

    const remainingItemsResult = await db.query(
      'SELECT 1 FROM order_items WHERE order_id = $1 LIMIT 1',
      [orderId],
    );

    let orderDeleted = false;
    if (remainingItemsResult.rowCount === 0) {
      const deleteOrderResult = await db.query(
        'DELETE FROM orders WHERE id = $1 AND user_id = $2 RETURNING id',
        [orderId, req.user.sub],
      );
      orderDeleted = deleteOrderResult.rowCount > 0;
    }

    await db.query('COMMIT');
    return res.status(200).json({
      success: true,
      affected_rows: deleteOrderItemResult.rowCount,
      order_deleted: orderDeleted,
    });
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}));

router.use((error, _req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  console.error(error);
  return res.status(500).json({ error: 'Internal server error' });
});

module.exports = router;
