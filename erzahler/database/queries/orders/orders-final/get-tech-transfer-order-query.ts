export const getTechTransferOrderQuery = `
  SELECT c.country_id,
    c.country_name,
    os.tech_partner_id,
    pc.country_name tech_partner_name,
    CASE WHEN ch.nuke_range IS NOT NULL THEN true ELSE false END has_nukes
  FROM order_sets os
  INNER JOIN countries c ON c.country_id = os.country_id
  INNER JOIN country_histories ch ON ch.country_id = c.country_id
  LEFT JOIN countries pc ON pc.country_id = os.tech_partner_id
  WHERE os.turn_id = $1
    AND ch.turn_id = $2
    AND CASE WHEN 0 = $3 THEN true ELSE os.country_id = $3 END;
`;