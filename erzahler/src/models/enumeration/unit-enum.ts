export enum UnitStatus {
  ACTIVE = 'Active',
  DESTROYED_RETREAT = 'Destroyed in Retreat',
  DISBANDED_ADJUSTMENT = 'Disbanded as Adjustment',
  DISBANDED_RETREAT = 'Disbanded in Retreat',
  DETONATED = 'Detonated',
  NUKED = 'Nuked',
  RETREAT = 'Retreat',
  // DISCARDED = 'Discarded' // Not an in-game status but a db row being ignored
}

export enum UnitType {
  ARMY = 'Army',
  FLEET = 'Fleet',
  GARRISON = 'Garrison',
  NUKE = 'Nuke',
  WING = 'Wing'
}

export enum BuildType { // Build Types
  NUKE_START = 'Start Nuke', //-3
  RANGE = 'Nuke Range', //-2
  DISBAND = 'Disband', //-1
  BUILD = 'Banked Build', // 0
  ARMY = 'Army', // 1
  FLEET = 'Fleet', // 2
  WING = 'Wing', // 3
  NUKE_RUSH = 'Rush Nuke', // 4
  NUKE_FINISH = 'Finish Nuke' // 5
}
