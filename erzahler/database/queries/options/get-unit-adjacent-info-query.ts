export const getUnitAdjacentInfoQuery = `
  SELECT u.unit_id,
    u.unit_name,
    u.unit_type,
    uh.node_id,
    n.node_name,
    p.province_id,
    p.province_name,
    a.adjacencies,
    hs.hold_supports,
    tu.adjacent_transports,
    tt.adjacent_transportables,
    td.transport_destinations,
    t.turn_type
  FROM units u
  INNER JOIN unit_histories uh ON uh.unit_id = u.unit_id
  INNER JOIN nodes n ON n.node_id = uh.node_id
  INNER JOIN provinces p ON p.province_id = n.province_id
  INNER JOIN turns t ON t.turn_id = uh.turn_id
  INNER JOIN get_node_adjacencies($1, false) a ON a.node_id = uh.node_id
  LEFT JOIN get_hold_supports($2) hs ON hs.unit_id = u.unit_id
  LEFT JOIN get_adjacent_transports($2) tu ON tu.unit_id = u.unit_id
  LEFT JOIN get_transport_destinations($2) td ON td.unit_id = u.unit_id
  LEFT JOIN get_adjacent_transportables($2) tt ON tt.unit_id = u.unit_id
  WHERE u.unit_type != 'Garrison'
    AND uh.unit_status = 'active'
    AND t.turn_id = $2
  ORDER BY u.unit_type;
`;