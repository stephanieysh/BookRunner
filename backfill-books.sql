-- One-time backfill for existing books rows missing cover, page_count, release_date
-- Run this against the staging database manually, or rely on the startup migration
-- in backend/src/index.js which runs this automatically on every deploy.

UPDATE books AS b SET
  cover = v.cover,
  page_count = v.page_count,
  release_date = v.release_date
FROM (VALUES
  ('OP001', 'images/one_piece_vol_1.jpg', 200, '1997-07-22'),
  ('OP002', 'images/one_piece_vol_2.jpg', 192, '1997-10-22'),
  ('OP003', 'images/one_piece_vol_3.jpg', 192, '1998-01-22'),
  ('SL001', 'images/sl_vol_1.jpg', 192, '2021-03-02'),
  ('SL002', 'images/sl_vol_2.jpg', 192, '2021-07-20'),
  ('HXH001', 'images/hxh_vol_1.jpg', 192, '1998-06-04'),
  ('HXH002', 'images/hxh_vol_2.jpg', 192, '1998-09-04'),
  ('HXH003', 'images/hxh_vol_3.jpg', 192, '1998-12-04'),
  ('MIA001', 'images/mia_vol_1.jpg', 192, '2012-10-01'),
  ('MIA002', 'images/mia_vol_2.jpg', 192, '2013-02-01'),
  ('COTE001', 'images/cote_vol_1.jpg', 192, '2019-02-07'),
  ('COTE002', 'images/cote_vol_2.jpg', 192, '2019-06-11'),
  ('MOR001', 'images/moriarty_vol_1.jpg', 208, '2020-10-06'),
  ('MOR002', 'images/moriarty_vol_2.jpg', 200, '2021-01-05'),
  ('MOR003', 'images/moriarty_vol_3.jpg', 200, '2021-04-06'),
  ('TR001', 'images/tr_vol_1.jpg', 192, '2017-03-01'),
  ('TR002', 'images/tr_vol_2.jpg', 192, '2017-06-01'),
  ('JJK001', 'images/jjk_vol_1.jpg', 192, '2018-03-05'),
  ('JJK002', 'images/jjk_vol_2.jpg', 192, '2018-06-04'),
  ('AOT001', 'images/aot_vol_1.jpg', 192, '2009-09-09'),
  ('AOT002', 'images/aot_vol_2.jpg', 192, '2010-01-15'),
  ('AOT003', 'images/aot_vol_3.jpg', 192, '2010-04-09'),
  ('NAR001', 'images/naruto_vol_1.jpg', 192, '1999-08-03'),
  ('NAR002', 'images/naruto_vol_2.jpg', 192, '1999-11-02'),
  ('DB001', 'images/db_vol_1.jpg', 192, '1984-09-20'),
  ('DB002', 'images/db_vol_2.jpg', 192, '1985-01-01'),
  ('DS001', 'images/ds_vol_1.jpg', 192, '2016-02-15'),
  ('DS002', 'images/ds_vol_2.jpg', 192, '2016-05-02'),
  ('QQ001', 'images/tqq_vol_1.jpg', 192, '2017-08-17'),
  ('QQ002', 'images/tqq_vol_2.jpg', 192, '2017-11-17'),
  ('QQ003', 'images/tqq_vol_3.jpg', 192, '2018-02-16'),
  ('KAG001', 'images/kaguya_vol_1.jpg', 192, '2015-05-19'),
  ('KAG002', 'images/kaguya_vol_2.jpg', 192, '2015-08-18'),
  ('HOR001', 'images/horimiya_vol_1.jpg', 192, '2011-10-18'),
  ('HOR002', 'images/horimiya_vol_2.jpg', 192, '2012-01-17'),
  ('YLIA001', 'images/ylia_vol_1.jpg', 192, '2011-04-06'),
  ('YLIA002', 'images/ylia_vol_2.jpg', 192, '2011-07-06'),
  ('DIMH001', 'images/dimh_vol_1.jpg', 192, '2018-04-04'),
  ('BB001', 'images/bb_vol_1.jpg', 192, '2021-04-05'),
  ('BB002', 'images/bb_vol_2.jpg', 192, '2021-07-05'),
  ('BB003', 'images/bb_vol_3.jpg', 192, '2021-10-04'),
  ('REZ001', 'images/rezero_vol_1.jpg', 192, '2014-01-20'),
  ('REZ002', 'images/rezero_vol_2.jpg', 192, '2014-04-21'),
  ('REZ003', 'images/rezero_vol_3.jpg', 192, '2014-07-21')
) AS v(book_id, cover, page_count, release_date)
WHERE b.book_id = v.book_id
  AND (b.cover IS NULL OR BTRIM(b.cover) = ''
    OR b.page_count IS NULL OR b.page_count = 0
    OR b.release_date IS NULL OR BTRIM(b.release_date) = '');
