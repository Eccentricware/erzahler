export enum ProvinceType {
  COAST = 'coast',
  SEA = 'sea',
  INLAND = 'inland',
  ISLAND = 'island',
  IMPASSIBLE = 'impassible',
  DECORATIVE = 'decorative',
  POLE = 'pole'
}

export enum VoteType {
  CAPITAL = 'capital',
  VOTE = 'vote',
  NONE = 'none'
}

export enum ProvinceStatus {
  ACTIVE = 'active',
  BOMBARDED = 'bombarded',
  DORMANT = 'dormant',
  NUKED = 'nuked',
  INERT = 'inert'
}

export enum ResolutionEvent {
  CONTESTED = 'contested',
  NUKED = 'nuked',
  PERPETUATION = 'perpetuation',
  PRESENCE = 'presence',
  VACATION = 'vacation'
}