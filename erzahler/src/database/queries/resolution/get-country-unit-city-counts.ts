export const getCountryUnitCityCountsQuery = `
  WITH unit_counts AS (
    SELECT u.country_id,
      COUNT(u.unit_id) AS unit_count
    FROM units u
    INNER JOIN unit_histories uh ON uh.unit_id = u.unit_id
    INNER JOIN get_last_unit_history($1, $2) luh
      ON luh.unit_id = uh.unit_id AND luh.turn_id = uh.turn_id
    WHERE uh.unit_status IN ('Active', 'Retreat')
    GROUP BY u.country_id
  ), city_counts AS (
    SELECT ph.controller_id,
      COUNT(ph.province_id) AS city_count
    FROM province_histories ph
    INNER JOIN get_last_province_history($1, $2) lph
      ON lph.province_id = ph.province_id AND lph.turn_id = ph.turn_id
    WHERE ph.province_status = 'active'
    GROUP BY ph.controller_id
  )
  SELECT c.country_id,
    uc.unit_count,
    cc.city_count
  FROM countries c
  INNER JOIN unit_counts uc ON uc.country_id = c.country_id
  INNER JOIN city_counts cc ON cc.controller_id = c.country_id;
`;
