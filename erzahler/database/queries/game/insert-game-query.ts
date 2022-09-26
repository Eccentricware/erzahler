export const insertNewGameQuery = `
  INSERT INTO games (
    game_name,
    game_status,
    assignment_method,
    stylized_start_year,
    current_year,
    turn_1_timing,
    deadline_type,
    start_time,
    game_time_zone,
    observe_dst,
    orders_day,
    orders_time,
    retreats_day,
    retreats_time,
    adjustments_day,
    adjustments_time,
    nominations_day,
    nominations_time,
    votes_day,
    votes_time,
    nmr_tolerance_total,
    concurrent_games_limit,
    private_game,
    hidden_game,
    blind_administrators,
    final_readiness_check,
    vote_delay_enabled,
    partial_roster_start,
    nomination_timing,
    nomination_year,
    automatic_assignments,
    rating_limits_enabled,
    fun_min,
    fun_max,
    skill_min,
    skill_max
  ) VALUES (
    $1,
    'registration',
    $2,
    $3,
    0,
    $4,
    $5,
    $6,
    $7,
    $8,
    $9,
    $10,
    $11,
    $12,
    $13,
    $14,
    $15,
    $16,
    $17,
    $18,
    $19,
    $20,
    $21,
    $22,
    $23,
    $24,
    $25,
    $26,
    $27,
    $28,
    $29,
    $30,
    $31,
    $32,
    $33,
    $34
  ) RETURNING game_id;
`;