export const insertCountryQuery = `
  INSERT INTO countries (
    game_id,
    country_name,
    rank,
    color,
    flag_key
  ) VALUES (
    $1,
    $2,
    $3,
    $4,
    $5
  );
`;