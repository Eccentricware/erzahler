export interface OrderOption {
  unitId: number;
  orderType: string;
  secondaryUnitId?: number | undefined;
  destinationChoices?: number[];
  turnId: number;
}

export interface OptionsContext {
  unitInfo: UnitOptions[]
  unitIdToIndexLib: any;
  sharedAdjProvinces: any;
  potentialConvoyProvinces: any;
  validConvoyAssistProvinces: []
  transportPaths: any;
  transports: any;
  transportables: any;
  transportDestinations: any;
  turnId: number;
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
}

export interface HoldSupport {
  unitId: number;
  unitName: string;
}

export interface MoveSupport {
  unitId: number;
  nodeId: number[];
}

interface AdjacentTransport {
  unitId: number;
  unitName: string;
}

interface AdjacentTransportable {
  unitId: number;
  unitName: string;
}

interface TransportDestination {
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


export interface AdjacenctMovementResult {
  node_id: number;
  province_id: number;
  province_name: string;
}

interface HoldSupportResult {
  unit_id: number;
  unit_name: string;
}

interface AdjacentTransportResult {
  unit_id: number;
  unit_name: string;
}

interface AdjacentTransportableResult {
  unit_id: number;
  unit_name: string;
}

interface TransportDestinationResult {
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
  adjacencies: any[]
}