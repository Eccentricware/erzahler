import { OrderDisplay, OrderSetType } from '../enumeration/order-display-enum';
import { ProvinceType } from '../enumeration/province-enums';
import { TurnStatus } from '../enumeration/turn-status-enum';

export interface OrderOption {
  turnId: number;
  unitId: number;
  orderType: string;
  secondaryUnitId?: number | undefined;
  secondaryOrderType?: string;
  destinations?: number[];
}

export interface OptionsContext {
  gameId: number;
  turnId: number;
  unitInfo: UnitOptions[];
  unitIdToIndexLib: any;
  sharedAdjProvinces: any;
  potentialConvoyProvinces: any;
  validConvoyAssistProvinces: [];
  transportPaths: any;
  transports: any;
  transportables: any;
  transportDestinations: any;
}

export interface UnitOptions {
  unitId: number;
  unitName: string;
  unitType: string;
  nodeId: number;
  nodeName: string;
  provinceId: number;
  provinceName: string;
  adjacencies: AdjacenctMovement[];
  moveTransported: number[];
  holdSupports: HoldSupport[];
  moveSupports: any;
  transportSupports: any;
  nukeTargets: number[];
  allTransports: any;
  adjacentTransports: AdjacentTransport[] | undefined;
  adjacentTransportables: AdjacentTransportable[] | undefined;
  transportDestinations: TransportDestination[] | undefined;
  nukeRange: number;
}

export interface AdjacenctMovement {
  nodeId: number;
  provinceId: number;
  provinceName: string;
  provinceType: ProvinceType;
}

export interface HoldSupport {
  unitId: number;
  unitName: string;
  provinceId: number;
}

export interface MoveSupport {
  unitId: number;
  nodeId: number[];
}

export interface AdjacentTransport {
  unitId: number;
  unitName: string;
}

export interface AdjacentTransportable {
  unitId: number;
  unitName: string;
}

export interface TransportDestination {
  nodeId: number;
  nodeName: string;
  provinceId: number;
}

export interface UnitAdjacyInfoResult {
  unit_id: number;
  unit_name: string;
  unit_type: string;
  node_id: number;
  node_name: string;
  province_id: number;
  province_name: string;
  adjacencies: AdjacenctMovementResult[];
  hold_supports: HoldSupportResult[] | undefined;
  adjacent_transports: AdjacentTransportResult[] | undefined;
  adjacent_transportables: AdjacentTransportableResult[] | undefined;
  transport_destinations: TransportDestinationResult[] | undefined;
  nuke_range: number;
}

export interface RetreatingUnitAdjacyInfoResult {
  unit_id: number;
  unit_name: string;
  unit_type: string;
  node_id: number;
  node_name: string;
  province_id: number;
  province_name: string;
  displacer_province_id: number;
  adjacencies: AdjacenctMovementResult[];
  unit_presence: HoldSupportResult[] | undefined;
}
export interface RetreatingUnitAdjacyInfo {
  unitId: number;
  unitName: string;
  unitType: string;
  nodeId: number;
  nodeName: string;
  provinceId: number;
  provinceName: string;
  displacerProvinceId: number;
  adjacencies: AdjacenctMovement[];
  unitPresence: HoldSupport[] | undefined;
}

export interface AdjacenctMovementResult {
  node_id: number;
  province_id: number;
  province_name: string;
  province_type: ProvinceType;
}

interface HoldSupportResult {
  unit_id: number;
  unit_name: string;
  province_id: number;
}

export interface AdjacentTransportResult {
  unit_id: number;
  unit_name: string;
}

export interface AdjacentTransportableResult {
  unit_id: number;
  unit_name: string;
}

export interface TransportDestinationResult {
  node_id: number;
  node_name: string;
  province_id: number;
}

export interface TransportPathLink {
  transports: number[];
  destinations: number[];
  contributions: any;
  transportOptions: number[];
  nextTransportLink: any;
}

export interface AirAdjacency {
  nodeId: number;
  provinceName: string;
  adjacencies: any[];
}

export interface SavedOptionResult {
  unit_id: number;
  unit_type: string;
  unit_country_id: string;
  unit_country_name: string;
  unit_country_rank: string;
  unit_flag_key: string;
  province_name: string;
  node_id: number;
  unit_loc: number[];
  can_hold: boolean;
  order_type: string;
  secondary_unit_id?: number;
  secondary_unit_type?: string;
  secondary_unit_country_name?: string;
  secondary_unit_flag_key?: string;
  secondary_province_name?: string;
  secondary_unit_loc?: number[];
  secondary_order_type?: string;
  destinations: DestinationResult[];
}

export interface SavedRetreatOptionResult {
  unit_id: number;
  unit_type: string;
  unit_country_id: string;
  unit_country_name: string;
  unit_country_rank: string;
  unit_flag_key: string;
  province_name: string;
  node_id: number;
  unit_loc: number[];
  order_type: string;
  destinations: DestinationResult[];
}

export interface DestinationResult {
  node_id: number;
  node_name: string;
  node_display: string;
  loc: number[];
}

export interface SavedOption {
  unitId: number;
  unitType: string;
  unitCountryId: string;
  unitCountryName: string;
  unitCountryRank: string;
  unitFlagKey: string;
  provinceName: string;
  nodeId: number;
  unitLoc: number[];
  canHold: boolean;
  orderType: OrderDisplay;
  secondaryUnitId?: number;
  secondaryUnitType?: string;
  secondaryUnitCountryId?: string;
  secondaryUnitCountryName?: string;
  secondaryUnitFlagKey?: string;
  secondaryProvinceName?: string;
  secondaryUnitLoc?: number[];
  secondaryOrderType?: OrderDisplay;
  destinations: OptionDestination[];
}

export interface SavedDestination {
  nodeId: number;
  nodeName: string;
  nodeDisplay: string;
  loc: number[];
}

export interface UnitOptionsFinalized {
  unitId: number;
  unitType: string;
  unitDisplay: string;
  unitLoc: number[];
  nodeId: number;
  orderTypes: OrderDisplay[];
  moveDestinations: OptionDestination[];
  moveTransportedDestinations: OptionDestination[];
  nukeTargets: OptionDestination[];
  supportStandardUnits: SecondaryUnit[];
  supportStandardDestinations: Record<string, OptionDestination[]>;
  supportTransportedUnits: SecondaryUnit[];
  supportTransportedDestinations: Record<string, OptionDestination[]>;
  transportableUnits: SecondaryUnit[];
  transportDestinations: Record<string, OptionDestination[]>;
}

export interface SecondaryUnit {
  id: number | undefined;
  displayName: string;
  loc: number[] | undefined;
}

export interface OptionDestination {
  nodeId: number;
  nodeName: string;
  nodeDisplay: string;
  loc: number[];
}

export interface TransferOption {
  gameId: number;
  giveTech: TransferCountry[];
  receiveTech: TransferCountry[];
  receiveBuilds: TransferCountry[];
}

export interface TransferCountry {
  countryId: number;
  countryName: string;
}

export interface TransferOptionResult {
  game_id: number;
  give_tech: TransferCountryResult[];
  receive_tech: TransferCountryResult[];
  receive_builds: TransferCountryResult[];
}
export interface TransferOptionCountryResult {
  country_id: number;
  country_name: string;
}
export interface TransferOptionCountry {
  id: number;
  name: string;
}

export interface TransferCountryResult {
  country_id: number;
  country_name: string;
}

export interface BuildLocResult {
  country_id: number;
  country_name: string;
  province_name: string;
  city_loc: number[];
  land_node_id: number;
  land_node_loc: number[];
  sea_node_id: number;
  sea_node_loc: number[];
  sea_node_name: string;
  air_node_id: number;
  air_node_loc: number[];
}

export interface BuildLocResult {
  countryId: number;
  countryName: string;
  provinceName: string;
  cityLoc: number[];
  landNodeId: number;
  landNodeLoc: number[];
  seaNodeId?: number;
  seaNodeLoc?: number[];
  seaNodeName?: string;
  airNodeId: number;
  airNodeLoc: number[];
}

export interface BuildLoc {
  province: string;
  display: string;
  nodeId: number;
  loc: number[];
}

export interface AtRiskUnitResult {
  unit_id: number;
  unit_type: string;
  province_name: string;
  loc: number[];
  nuke_locs: number[];
}
export interface AtRiskUnit {
  unitId: number;
  unitType: string;
  provinceName: string;
  loc: number[];
}

export interface NominatableCountryResult {
  country_id: number;
  country_name: string;
  rank: string;
}

export interface NominatableCountry {
  countryId: number;
  countryName: string;
  rank: string;
  penalty?: number;
}

export interface NominationResult {
  nomination_id: number;
  signature: string;
  countries: NominatableCountryResult[];
  votes_required: number;
}

export interface Nomination {
  nominationId: number;
  signature: string;
  countries: NominatableCountry[];
  votesRequired: number;
}

export interface OrderSetResult {
  order_set_id: number;
  country_id: number;
}

export interface OrderSet {
  orderSetId: number;
  countryId: number;
  turnId?: number;
  messageId?: number;
  submissionTime?: Date | string;
  orderSetType?: OrderSetType | string;
  orderSetName?: string;
}

export interface OrderResult {
  order_id: number;
  order_set_id: number;
  ordered_unit_id: number;
  ordered_unit_loc: number[];
  order_type: string;
  secondary_unit_id?: number | undefined;
  secondary_unit_loc?: number[];
  destination_id?: number;
  event_loc?: number[];
  order_status?: string;
}

export interface Order {
  orderId?: number;
  orderSetId: number;
  orderedUnitId: number;
  loc?: number[];
  orderType: string;
  description: string;
  secondaryUnitId?: number | undefined;
  secondaryUnitLoc?: number[];
  destinationId?: number;
  eventLoc?: number[];
  orderStatus?: string;
}

export interface OrderPrepping {
  countryId: number;
  unitId: number;
  orderType: string;
  description: string;
  secondaryUnitId?: number | undefined;
  secondaryOrderType?: string;
  destinationId?: number;
}

export interface DisbandOptions {
  disbandCount: number;
  cityCount: number;
  unitCount: number;
  units: AtRiskUnit[];
  nukesInProduction: number;
  nukeLocs: BuildLoc[];
}

export interface NominationOptions {
  victoryBase: number;
  countries: NominatableCountry[];
}
