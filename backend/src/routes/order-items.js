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

/**
 * UPDATE ORDER ITEM QUANTITY
 */
router.put(
  '/api/order-items',
  orderItemsLimiter,
  requireAuth,
  asyncHandler(async (req, res) => {
    const orderItemId = normalizeRequiredId(req.query?.id);
    const quantity = normalizeQuantity(req.body?.quantity);

    if (!orderItemId || !quantity) {
      return res.status(400).json({
        error: 'id and a positive integer quantity are required',
      });
    }

    const client = await db.connect();
    let transactionStarted = false;

    try {
      await client.query('BEGIN');
      transactionStarted = true;

      // ✅ FIXED: explicit numeric cast prevents 500 error
      const result = await client.query(
        `UPDATE order_items AS oi
         SET quantity = $1::int,
             line_total = oi.unit_price * $1::numeric
         FROM orders AS o
         WHERE oi.id = $2
           AND oi.order_id = o.id
           AND o.user_id = $3
         RETURNING
           oi.id,
           oi.order_id,
           oi.quantity,
           oi.unit_price,
           oi.line_total`,
        [quantity, orderItemId, req.user.sub],
      );

      if (result.rowCount === 0) {
        await client.query('ROLLBACK');
        transactionStarted = false;
        return res.status(404).json({ error: 'Order item not found' });
      }

      const updatedItem = result.rows[0];

      const totalResult = await client.query(
        `UPDATE orders
         SET total_amount = COALESCE((
           SELECT SUM(line_total)
           FROM order_items
           WHERE order_id = $1
         ), 0)
         WHERE id = $1 AND user_id = $2
         RETURNING total_amount`,
        [updatedItem.order_id, req.user.sub],
      );

      if (totalResult.rowCount !== 1) {
        await client.query('ROLLBACK');
        transactionStarted = false;
        return res.status(404).json({ error: 'Order not found' });
      }

      await client.query('COMMIT');
      transactionStarted = false;

      return res.status(200).json({
        success: true,
        affected_rows: result.rowCount,
        data: {
          ...updatedItem,
          order_total_amount: totalResult.rows[0]?.total_amount ?? null,
        },
      });
    } catch (error) {
      if (transactionStarted) {
        await client.query('ROLLBACK');
      }
      console.error('PUT /api/order-items error:', error);
      throw error;
    } finally {
      client.release();
    }
  }),
);

/**
 * DELETE ORDER ITEM
 */
router.delete(
  '/api/order-items',
  orderItemsLimiter,
  requireAuth,
  asyncHandler(async (req, res) => {
    const orderItemId = normalizeRequiredId(req.query?.id);
    const orderId = normalizeRequiredId(req.query?.order_id);

    if (!orderItemId || !orderId) {
      return res.status(400).json({ error: 'id and order_id are required' });
    }

    const client = await db.connect();
    let transactionStarted = false;

    try {
      await client.query('BEGIN');
      transactionStarted = true;

      const deleteOrderItemResult = await client.query(
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
        await client.query('ROLLBACK');
        transactionStarted = false;
        return res.status(404).json({ error: 'Order item not found' });
      }

      const remainingItemsResult = await client.query(
        'SELECT 1 FROM order_items WHERE order_id = $1 LIMIT 1',
        [orderId],
      );

      let orderDeleted = false;

      if (remainingItemsResult.rowCount === 0) {
        const deleteOrderResult = await client.query(
          'DELETE FROM orders WHERE id = $1 AND user_id = $2 RETURNING id',
          [orderId, req.user.sub],
        );

        orderDeleted = deleteOrderResult.rowCount > 0;
      } else {
        const updateOrderTotalResult = await client.query(
          `UPDATE orders
           SET total_amount = COALESCE((
             SELECT SUM(line_total)
             FROM order_items
             WHERE order_id = $1
           ), 0)
           WHERE id = $1 AND user_id = $2`,
          [orderId, req.user.sub],
        );

        if (updateOrderTotalResult.rowCount !== 1) {
          await client.query('ROLLBACK');
          transactionStarted = false;
          return res.status(404).json({ error: 'Order not found' });
        }
      }

      await client.query('COMMIT');
      transactionStarted = false;

      return res.status(200).json({
        success: true,
        affected_rows: deleteOrderItemResult.rowCount,
        order_deleted: orderDeleted,
      });
    } catch (error) {
      if (transactionStarted) {
        await client.query('ROLLBACK');
      }
      console.error('DELETE /api/order-items error:', error);
      throw error;
    } finally {
      client.release();
    }
  }),
);

/**
 * GLOBAL ERROR HANDLER
 */
router.use((error, _req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  console.error(error);
  return res.status(500).json({ error: 'Internal server error' });
});

module.exports = router;