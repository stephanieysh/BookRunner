-- One-time backfill for existing books rows missing cover, page_count, release_date
-- Run this against the staging database manually, or rely on the startup migration
-- in backend/src/index.js which runs this automatically on every deploy.

UPDATE books AS b SET
  cover = v.cover,
  page_count = v.page_count,
  release_date = v.release_date
FROM (VALUES
  ('One Piece', 'Vol 1', 'images/one_piece_vol_1.jpg', 200, '1997-07-22'),
  ('One Piece', 'Vol 2', 'images/one_piece_vol_2.jpg', 192, '1997-10-22'),
  ('One Piece', 'Vol 3', 'images/one_piece_vol_3.jpg', 192, '1998-01-22'),
  ('Solo Leveling', 'Vol 1', 'images/sl_vol_1.jpg', 192, '2021-03-02'),
  ('Solo Leveling', 'Vol 2', 'images/sl_vol_2.jpg', 192, '2021-07-20'),
  ('Hunter x Hunter', 'Vol 1', 'images/hxh_vol_1.jpg', 192, '1998-06-04'),
  ('Hunter x Hunter', 'Vol 2', 'images/hxh_vol_2.jpg', 192, '1998-09-04'),
  ('Hunter x Hunter', 'Vol 3', 'images/hxh_vol_3.jpg', 192, '1998-12-04'),
  ('Made in Abyss', 'Vol 1', 'images/mia_vol_1.jpg', 192, '2012-10-01'),
  ('Made in Abyss', 'Vol 2', 'images/mia_vol_2.jpg', 192, '2013-02-01'),
  ('Classroom of the Elite', 'Vol 1', 'images/cote_vol_1.jpg', 192, '2019-02-07'),
  ('Classroom of the Elite', 'Vol 2', 'images/cote_vol_2.jpg', 192, '2019-06-11'),
  ('Moriarty the Patriot', 'Vol 1', 'images/moriarty_vol_1.jpg', 208, '2020-10-06'),
  ('Moriarty the Patriot', 'Vol 2', 'images/moriarty_vol_2.jpg', 200, '2021-01-05'),
  ('Moriarty the Patriot', 'Vol 3', 'images/moriarty_vol_3.jpg', 200, '2021-04-06'),
  ('Tokyo Revengers', 'Vol 1', 'images/tr_vol_1.jpg', 192, '2017-03-01'),
  ('Tokyo Revengers', 'Vol 2', 'images/tr_vol_2.jpg', 192, '2017-06-01'),
  ('Jujutsu Kaisen', 'Vol 1', 'images/jjk_vol_1.jpg', 192, '2018-03-05'),
  ('Jujutsu Kaisen', 'Vol 2', 'images/jjk_vol_2.jpg', 192, '2018-06-04'),
  ('Attack on Titan', 'Vol 1', 'images/aot_vol_1.jpg', 192, '2009-09-09'),
  ('Attack on Titan', 'Vol 2', 'images/aot_vol_2.jpg', 192, '2010-01-15'),
  ('Attack on Titan', 'Vol 3', 'images/aot_vol_3.jpg', 192, '2010-04-09'),
  ('Naruto', 'Vol 1', 'images/naruto_vol_1.jpg', 192, '1999-08-03'),
  ('Naruto', 'Vol 2', 'images/naruto_vol_2.jpg', 192, '1999-11-02'),
  ('Dragon Ball', 'Vol 1', 'images/db_vol_1.jpg', 192, '1984-09-20'),
  ('Dragon Ball', 'Vol 2', 'images/db_vol_2.jpg', 192, '1985-01-01'),
  ('Demon Slayer', 'Vol 1', 'images/ds_vol_1.jpg', 192, '2016-02-15'),
  ('Demon Slayer', 'Vol 2', 'images/ds_vol_2.jpg', 192, '2016-05-02'),
  ('The Quintessential Quintuplets', 'Vol 1', 'images/tqq_vol_1.jpg', 192, '2017-08-17'),
  ('The Quintessential Quintuplets', 'Vol 2', 'images/tqq_vol_2.jpg', 192, '2017-11-17'),
  ('The Quintessential Quintuplets', 'Vol 3', 'images/tqq_vol_3.jpg', 192, '2018-02-16'),
  ('Kaguya-sama: Love Is War', 'Vol 1', 'images/kaguya_vol_1.jpg', 192, '2015-05-19'),
  ('Kaguya-sama: Love Is War', 'Vol 2', 'images/kaguya_vol_2.jpg', 192, '2015-08-18'),
  ('Horimiya', 'Vol 1', 'images/horimiya_vol_1.jpg', 192, '2011-10-18'),
  ('Horimiya', 'Vol 2', 'images/horimiya_vol_2.jpg', 192, '2012-01-17'),
  ('Your Lie in April', 'Vol 1', 'images/ylia_vol_1.jpg', 192, '2011-04-06'),
  ('Your Lie in April', 'Vol 2', 'images/ylia_vol_2.jpg', 192, '2011-07-06'),
  ('The Dangers in My Heart', 'Vol 1', 'images/dimh_vol_1.jpg', 192, '2018-04-04'),
  ('Blue Box', 'Vol 1', 'images/bb_vol_1.jpg', 192, '2021-04-05'),
  ('Blue Box', 'Vol 2', 'images/bb_vol_2.jpg', 192, '2021-07-05'),
  ('Blue Box', 'Vol 3', 'images/bb_vol_3.jpg', 192, '2021-10-04'),
  ('Re:Zero - Starting Life in Another World', 'Vol 1', 'images/rezero_vol_1.jpg', 192, '2014-01-20'),
  ('Re:Zero - Starting Life in Another World', 'Vol 2', 'images/rezero_vol_2.jpg', 192, '2014-04-21'),
  ('Re:Zero - Starting Life in Another World', 'Vol 3', 'images/rezero_vol_3.jpg', 192, '2014-07-21')
) AS v(title, volume, cover, page_count, release_date)
WHERE b.title = v.title
  AND b.volume = v.volume
  AND (b.cover IS NULL OR BTRIM(b.cover) = ''
    OR b.page_count IS NULL OR b.page_count = 0
    OR b.release_date IS NULL OR BTRIM(b.release_date) = '');
