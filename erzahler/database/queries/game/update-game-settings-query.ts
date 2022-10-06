export const updateGameSettingsQuery = `
  UPDATE games
  SET game_name = $1,
    assignment_method = $2,
    stylized_start_year = $3,
    turn_1_timing = $4,
    deadline_type = $5,
    start_time = $6,
    game_time_zone = $7,
    observe_dst = $8,
    orders_day = $9,
    orders_time = $10,
    retreats_day = $11,
    retreats_time = $12,
    adjustments_day = $13,
    adjustments_time = $14,
    nominations_day = $15,
    nominations_time = $16,
    votes_day = $17,
    votes_time = $18,
    nmr_tolerance_total = $19,
    concurrent_games_limit = $20,
    private_game = $21,
    hidden_game = $22,
    blind_administrators = $23,
    final_readiness_check = $24,
    vote_delay_enabled = $25,
    partial_roster_start = $26,
    nomination_timing = $27,
    nomination_year = $28,
    automatic_assignments = $29,
    rating_limits_enabled = $30,
    fun_min = $31,
    fun_max = $32,
    skill_min = $33,
    skill_max = $34
  WHERE game_id = $35
`;