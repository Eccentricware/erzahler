import { TurnStatus } from "../../enumeration/turn-status-enum";
import { TurnType } from "../../enumeration/turn-type-enum";
import { Order, UnitOptionsFinalized } from "../option-context-objects";

export interface UpcomingTurn {
  gameId: number;
  turnId: number;
  gameName: string;
  turnName: string;
  turnType: TurnType;
  turnStatus: TurnStatus;
  deadline: string | Date;
  defaultsReady: boolean;
}

export interface UpcomingTurnResult {
  game_id: number;
  turn_id: number;
  game_name: string;
  turn_name: string;
  turn_type: string;
  turn_status: string;
  deadline: string | Date;
  defaults_ready: boolean;
}

export interface TurnOrders {
  playerId: number;
  countryId: number;
  countryName: string;
  pending?: SingleTurnOrders,
  preliminary?: SingleTurnOrders
}

interface SingleTurnOrders {
  turnType: string;
  name: string;
  deadline: Date | string;
  options: {
    units?: UnitOptionsFinalized[]; // If (spring orders/retreats or fall orders/retreats)
    transfers?: any;
    builds?: any;
    disbands?: any;
    nominations?: any;
    votes?: any;
  }
  orders: {
    units?: Order[]; // If (spring orders/retreats or fall orders/retreats)
    transfers?: any;
    builds?: any;
    disbands?: any;
    nominations?: any;
    votes?: any;
  }
}