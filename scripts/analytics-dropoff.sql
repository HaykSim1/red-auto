-- Red Auto — метрики отвала по существующим данным
--
-- Что это: набор запросов, отвечающих на «где мы теряем пользователей»,
-- по данным, которые уже накоплены. Ничего не пишет, только читает.
-- Запуск:  psql "$DATABASE_URL" -f api/scripts/analytics-dropoff.sql
-- Или по одному запросу за раз — так удобнее читать.
--
-- ВАЖНО, чего эти запросы НЕ могут:
--   * на каком поле формы человек бросил создание запроса
--   * сколько людей открыли приложение и не дошли до логина
--   * сколько OTP не долетело
--   * купил ли покупатель в итоге
-- Всё это не оставляет строк в БД. Нужен событийный слой на клиенте.
--
-- Правила подсчёта совпадают с api/src/analytics (иначе цифры разойдутся):
--   видимый оффер  = moderation_state = 'visible' AND interaction_state <> 'mutually_cancelled'
--   видимый запрос = moderation_state = 'visible'
--   живой юзер     = deleted_at IS NULL

\timing on
\pset null '—'

-- ============================================================
-- 1. АКТИВАЦИЯ: сколько зарегистрировавшихся так и не создали запрос
-- ============================================================
-- Самая большая дыра почти в любом маркетплейсе. Если тут 70% —
-- проблема не в офферах, а в том, что до создания запроса не доходят.

SELECT
  count(*)                                                   AS всего_юзеров,
  count(*) FILTER (WHERE r.cnt IS NULL)                      AS без_единого_запроса,
  round(100.0 * count(*) FILTER (WHERE r.cnt IS NULL) / nullif(count(*), 0), 1)
                                                             AS доля_без_запросов_pct,
  count(*) FILTER (WHERE r.cnt = 1)                          AS ровно_один_запрос,
  count(*) FILTER (WHERE r.cnt >= 2)                         AS два_и_больше
FROM users u
LEFT JOIN (
  SELECT author_id, count(*) AS cnt
  FROM part_requests
  GROUP BY author_id
) r ON r.author_id = u.id
WHERE u.deleted_at IS NULL
  AND u.role <> 'admin';


-- ============================================================
-- 2. АКТИВАЦИЯ ПО НЕДЕЛЯМ РЕГИСТРАЦИИ (когорты)
-- ============================================================
-- Улучшается ли активация со временем. Смотреть на тренд, не на одну неделю.

SELECT
  date_trunc('week', u.created_at)::date                     AS неделя_регистрации,
  count(*)                                                   AS зарегистрировалось,
  count(*) FILTER (WHERE r.first_at IS NOT NULL)             AS создали_запрос,
  round(100.0 * count(*) FILTER (WHERE r.first_at IS NOT NULL) / nullif(count(*), 0), 1)
                                                             AS активация_pct,
  round(avg(EXTRACT(EPOCH FROM (r.first_at - u.created_at)) / 3600.0)
        FILTER (WHERE r.first_at IS NOT NULL)::numeric, 1)   AS ср_часов_до_первого_запроса
FROM users u
LEFT JOIN (
  SELECT author_id, min(created_at) AS first_at
  FROM part_requests
  GROUP BY author_id
) r ON r.author_id = u.id
WHERE u.deleted_at IS NULL
  AND u.role <> 'admin'
GROUP BY 1
ORDER BY 1 DESC
LIMIT 20;


-- ============================================================
-- 3. ЗАПРОСЫ БЕЗ ОФФЕРОВ — главный показатель дефицита предложения
-- ============================================================
-- Покупатель, не получивший ни одного оффера, не вернётся.

WITH req AS (
  SELECT
    pr.id,
    pr.created_at,
    pr.status,
    (SELECT count(*)
       FROM offers o
      WHERE o.request_id = pr.id
        AND o.moderation_state = 'visible'
        AND o.interaction_state <> 'mutually_cancelled') AS offers_cnt
  FROM part_requests pr
  WHERE pr.moderation_state = 'visible'
)
SELECT
  date_trunc('week', created_at)::date                       AS неделя,
  count(*)                                                   AS запросов,
  count(*) FILTER (WHERE offers_cnt = 0)                     AS без_офферов,
  round(100.0 * count(*) FILTER (WHERE offers_cnt = 0) / nullif(count(*), 0), 1)
                                                             AS без_офферов_pct,
  round(avg(offers_cnt)::numeric, 2)                         AS ср_офферов_на_запрос,
  max(offers_cnt)                                            AS макс_офферов
FROM req
GROUP BY 1
ORDER BY 1 DESC
LIMIT 20;


-- ============================================================
-- 4. ЧТО ВЛИЯЕТ НА ПОЛУЧЕНИЕ ОФФЕРА — прямая подсказка для формы запроса
-- ============================================================
-- Если запросы с фото получают офферы заметно чаще, чем без —
-- значит фото надо поднимать в форме, а не прятать в конце.
-- Если разницы нет — не мучайте пользователя лишним шагом.

WITH req AS (
  SELECT
    pr.id,
    (pr.vehicle_id IS NOT NULL)                              AS есть_авто,
    (nullif(trim(coalesce(pr.vin_text, '')), '') IS NOT NULL
     OR nullif(trim(coalesce(v.vin, '')), '') IS NOT NULL)   AS есть_vin,
    (nullif(trim(coalesce(pr.part_number, '')), '') IS NOT NULL) AS есть_артикул,
    EXISTS (SELECT 1 FROM request_photos rp WHERE rp.request_id = pr.id) AS есть_фото,
    length(pr.description)                                   AS длина_описания,
    EXISTS (SELECT 1 FROM offers o
             WHERE o.request_id = pr.id
               AND o.moderation_state = 'visible'
               AND o.interaction_state <> 'mutually_cancelled') AS получил_оффер
  FROM part_requests pr
  LEFT JOIN vehicles v ON v.id = pr.vehicle_id
  WHERE pr.moderation_state = 'visible'
)
SELECT признак, значение, запросов, получили_оффер,
       round(100.0 * получили_оффер / nullif(запросов, 0), 1) AS конверсия_pct
FROM (
  SELECT 'фото'    AS признак, есть_фото::text    AS значение,
         count(*) AS запросов, count(*) FILTER (WHERE получил_оффер) AS получили_оффер
    FROM req GROUP BY 2
  UNION ALL
  SELECT 'авто из профиля', есть_авто::text,
         count(*), count(*) FILTER (WHERE получил_оффер) FROM req GROUP BY 2
  UNION ALL
  SELECT 'VIN', есть_vin::text,
         count(*), count(*) FILTER (WHERE получил_оффер) FROM req GROUP BY 2
  UNION ALL
  SELECT 'артикул', есть_артикул::text,
         count(*), count(*) FILTER (WHERE получил_оффер) FROM req GROUP BY 2
  UNION ALL
  SELECT 'длина описания',
         CASE WHEN длина_описания < 20 THEN 'до 20 симв.'
              WHEN длина_описания < 60 THEN '20-60'
              ELSE '60+' END,
         count(*), count(*) FILTER (WHERE получил_оффер) FROM req GROUP BY 2
) t
ORDER BY признак, значение;


-- ============================================================
-- 5. ЗАПРОСЫ БЕЗ ОФФЕРОВ ПО МАРКАМ — где именно нет предложения
-- ============================================================
-- Список марок, по которым вы не можете обслужить спрос.
-- Это готовый план, кого звать в продавцы.

SELECT
  coalesce(nullif(trim(v.brand), ''), '(авто не указано)')   AS марка,
  count(*)                                                   AS запросов,
  count(*) FILTER (WHERE NOT EXISTS (
     SELECT 1 FROM offers o
      WHERE o.request_id = pr.id
        AND o.moderation_state = 'visible'
        AND o.interaction_state <> 'mutually_cancelled'))     AS без_офферов,
  round(100.0 * count(*) FILTER (WHERE NOT EXISTS (
     SELECT 1 FROM offers o
      WHERE o.request_id = pr.id
        AND o.moderation_state = 'visible'
        AND o.interaction_state <> 'mutually_cancelled')) / nullif(count(*), 0), 1)
                                                             AS без_офферов_pct
FROM part_requests pr
LEFT JOIN vehicles v ON v.id = pr.vehicle_id
WHERE pr.moderation_state = 'visible'
GROUP BY 1
HAVING count(*) >= 3
ORDER BY запросов DESC
LIMIT 30;


-- ============================================================
-- 6. СКОРОСТЬ ПЕРВОГО ОТВЕТА — сколько покупатель ждёт
-- ============================================================
-- Медиана и p90. Если p90 больше суток, покупатель уже купил в другом месте.

WITH first_offer AS (
  SELECT pr.id,
         pr.created_at,
         min(o.created_at) AS first_offer_at
  FROM part_requests pr
  JOIN offers o ON o.request_id = pr.id
   AND o.moderation_state = 'visible'
   AND o.interaction_state <> 'mutually_cancelled'
  WHERE pr.moderation_state = 'visible'
  GROUP BY pr.id, pr.created_at
)
SELECT
  date_trunc('week', created_at)::date                       AS неделя,
  count(*)                                                   AS запросов_с_оффером,
  round((percentile_cont(0.5) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (first_offer_at - created_at)) / 60.0))::numeric, 0)
                                                             AS медиана_минут,
  round((percentile_cont(0.9) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (first_offer_at - created_at)) / 60.0))::numeric, 0)
                                                             AS p90_минут
FROM first_offer
GROUP BY 1
ORDER BY 1 DESC
LIMIT 20;


-- ============================================================
-- 7. ВРЕМЯ СУТОК: когда спрос есть, а продавцов нет
-- ============================================================
-- Часы указаны в UTC. Ереван = UTC+4, прибавьте 4.
-- Если ночные запросы систематически без офферов — нужен отложенный пуш утром.

SELECT
  EXTRACT(HOUR FROM pr.created_at)::int                      AS час_utc,
  (EXTRACT(HOUR FROM pr.created_at)::int + 4) % 24           AS час_еревана,
  count(*)                                                   AS запросов,
  round(100.0 * count(*) FILTER (WHERE NOT EXISTS (
     SELECT 1 FROM offers o
      WHERE o.request_id = pr.id
        AND o.moderation_state = 'visible'
        AND o.interaction_state <> 'mutually_cancelled')) / nullif(count(*), 0), 1)
                                                             AS без_офферов_pct
FROM part_requests pr
WHERE pr.moderation_state = 'visible'
GROUP BY 1, 2
ORDER BY 1;


-- ============================================================
-- 8. ПРОДАВЦЫ: кто работает, а кто мёртвая душа
-- ============================================================
-- Одобрили продавца — а он ни разу не ответил. Это отвал на стороне предложения,
-- и он не менее важен, чем покупательский.

SELECT
  count(*)                                                   AS одобренных_продавцов,
  count(*) FILTER (WHERE o.total IS NULL)                    AS ни_одного_оффера_никогда,
  count(*) FILTER (WHERE o.last_at >= now() - interval '30 days')
                                                             AS активны_за_30_дней,
  count(*) FILTER (WHERE o.last_at <  now() - interval '30 days')
                                                             AS замолчали,
  round(avg(o.total) FILTER (WHERE o.total IS NOT NULL)::numeric, 1)
                                                             AS ср_офферов_на_активного
FROM users u
LEFT JOIN (
  SELECT seller_id, count(*) AS total, max(created_at) AS last_at
  FROM offers
  GROUP BY seller_id
) o ON o.seller_id = u.id
WHERE u.role = 'seller'
  AND u.deleted_at IS NULL
  AND u.blocked_at IS NULL;


-- ============================================================
-- 9. ЗАЯВКИ В ПРОДАВЦЫ: не слишком ли тяжёлая форма
-- ============================================================

SELECT
  status                                                     AS статус,
  count(*)                                                   AS заявок,
  round(avg(EXTRACT(EPOCH FROM (reviewed_at - created_at)) / 3600.0)
        FILTER (WHERE reviewed_at IS NOT NULL)::numeric, 1)  AS ср_часов_до_решения
FROM seller_applications
GROUP BY 1
ORDER BY 2 DESC;


-- ============================================================
-- 10. ВОЗВРАЩАЕМОСТЬ ПОКУПАТЕЛЕЙ — работает ли продукт вообще
-- ============================================================
-- Один запрос и исчез = продукт не сработал. Второй запрос = сработал.
-- Это честнее любой воронки.

WITH per_author AS (
  SELECT author_id,
         count(*)                AS cnt,
         min(created_at)         AS first_at,
         max(created_at)         AS last_at
  FROM part_requests
  WHERE moderation_state = 'visible'
  GROUP BY author_id
)
SELECT
  count(*)                                                   AS авторов_запросов,
  count(*) FILTER (WHERE cnt >= 2)                           AS создали_2_и_больше,
  round(100.0 * count(*) FILTER (WHERE cnt >= 2) / nullif(count(*), 0), 1)
                                                             AS возвращаемость_pct,
  count(*) FILTER (WHERE cnt >= 2 AND last_at - first_at <= interval '30 days')
                                                             AS вернулись_за_30_дней
FROM per_author;


-- ============================================================
-- 11. СВОДКА ЗА 30 ДНЕЙ — одной строкой, для регулярного взгляда
-- ============================================================

WITH win AS (SELECT now() - interval '30 days' AS since),
req AS (
  SELECT pr.id,
         EXISTS (SELECT 1 FROM offers o
                  WHERE o.request_id = pr.id
                    AND o.moderation_state = 'visible'
                    AND o.interaction_state <> 'mutually_cancelled') AS has_offer
  FROM part_requests pr, win
  WHERE pr.moderation_state = 'visible'
    AND pr.created_at >= win.since
)
SELECT
  (SELECT count(*) FROM users u, win
    WHERE u.created_at >= win.since AND u.deleted_at IS NULL AND u.role <> 'admin')
                                                             AS новых_юзеров,
  (SELECT count(*) FROM req)                                 AS запросов,
  (SELECT count(*) FROM req WHERE has_offer)                 AS с_офферами,
  (SELECT round(100.0 * count(*) FILTER (WHERE has_offer) / nullif(count(*), 0), 1) FROM req)
                                                             AS покрытие_pct,
  (SELECT count(*) FROM offers o, win
    WHERE o.created_at >= win.since
      AND o.moderation_state = 'visible'
      AND o.interaction_state <> 'mutually_cancelled')       AS офферов,
  (SELECT count(DISTINCT o.seller_id) FROM offers o, win WHERE o.created_at >= win.since)
                                                             AS активных_продавцов,
  (SELECT count(*) FROM seller_ratings sr, win WHERE sr.created_at >= win.since)
                                                             AS оценок;


-- ============================================================
-- 12. ПРОВЕРКА: мёртвая часть воронки
-- ============================================================
-- Напоминание, что accept/selection никто не вызывает. Ожидаемо нули —
-- если тут не ноль, значит какой-то клиент всё-таки ведёт сделку.

SELECT
  (SELECT count(*) FROM selections)                          AS всего_selections,
  (SELECT count(*) FROM selections WHERE selected_at >= now() - interval '30 days')
                                                             AS selections_за_30_дней,
  (SELECT count(*) FROM offers WHERE interaction_state <> 'none')
                                                             AS офферов_не_в_none,
  (SELECT count(*) FROM part_requests WHERE active_acceptance_offer_id IS NOT NULL)
                                                             AS запросов_с_принятым_оффером,
  (SELECT count(*) FROM part_requests WHERE status = 'closed')
                                                             AS закрытых_запросов,
  (SELECT count(*) FROM part_requests WHERE status = 'cancelled')
                                                             AS отменённых_запросов;
