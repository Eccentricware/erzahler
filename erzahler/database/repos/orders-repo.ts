import { Pool, QueryResult } from "pg";
import { ColumnSet, IDatabase, IMain, queryResult } from "pg-promise";
import { AdjacenctMovement, AdjacenctMovementResult, AirAdjacency, AtRiskUnit, AtRiskUnitResult, BuildLoc, BuildLocResult, DestinationResult, NominatableCountry, NominatableCountryResult, Nomination, NominationResult, Order, OrderOption, OrderResult, OrderSet, OrderSetResult, SavedDestination, SavedOption, SavedOptionResult, TransferCountry, TransferCountryResult, TransferOption, TransferOptionResult, UnitAdjacyInfoResult, UnitOptions } from "../../models/objects/option-context-objects";
import { TransferBuildsCountry } from "../../models/objects/options-objects";
import { OrderSetFinal, OrderSetFinalResult, TransferBuildOrder, TransferBuildOrdersResults, TransferTechOrder, TransferTechOrderResult } from "../../models/objects/scheduler/upcoming-turns-object";
import { victorCredentials } from "../../secrets/dbCredentials";
import { getAirAdjQuery } from "../queries/orders/get-air-adj-query";
import { getAtRiskUnitsQuery } from "../queries/orders/get-at-risk-units-query";
import { getEmptySupplyCentersQuery } from "../queries/orders/get-empty-supply-centers-query";
import { getNominatableCountriesQuery } from "../queries/orders/get-nominatable-countries-query";
import { getNominationsQuery } from "../queries/orders/get-nominations-query";
import { getOrderOptionsQuery } from "../queries/orders/get-order-options-query";
import { getOrderSetQuery } from "../queries/orders/get-order-set-query";
import { getTransferBuildOptionsQuery } from "../queries/orders/get-transfer-build-options-query";
import { getTransferOptionsQuery } from "../queries/orders/get-transfer-options-query";
import { getTechOfferOptionsQuery } from "../queries/orders/get-transfer-tech-offer-options-query";
import { getTechReceiveOptionsQuery } from "../queries/orders/get-transfer-tech-receive-options-query";
import { getTurnUnitOrdersQuery } from "../queries/orders/get-turn-unit-orders";
import { getUnitAdjacentInfoQuery } from "../queries/orders/get-unit-adjacent-info-query";
import { insertTurnOrderSetsQuery } from "../queries/orders/insert-turn-order-sets";
import { getBuildTransferOrdersQuery } from "../queries/orders/orders-final/get-build-orders-query";
import { getTechTransferOrderQuery } from "../queries/orders/orders-final/get-tech-transfer-order-query";
import { setTurnDefaultsPreparedQuery } from "../queries/orders/set-turn-defaults-prepared-query";

export class OrdersRepository {
  orderSetCols: ColumnSet<unknown>;
  orderCols: ColumnSet<unknown>;
  orderOptionsCols: ColumnSet<unknown>;
  pool: Pool = new Pool(victorCredentials);
  /**
   * @param db
   * @param pgp
   */
  constructor(private db: IDatabase<any>, private pgp: IMain) {
    this.orderSetCols = new pgp.helpers.ColumnSet([
      'country_id',
      'turn_id',
      'message_id',
      'submission_time',
      'order_set_type',
      'order_set_name'
    ], { table: 'order_sets' });

    this.orderCols = new pgp.helpers.ColumnSet([
      'order_set_id',
      'order_type',
      'ordered_unit_id',
      'secondary_unit_id',
      'destination_id',
      'order_status',
      'order_success'
    ], { table: 'orders' });

    this.orderOptionsCols = new pgp.helpers.ColumnSet([
      'unit_id',
      'order_type',
      'secondary_unit_id',
      'secondary_order_type',
      'destinations',
      'turn_id'
    ], { table: 'order_options' });
  }

  async saveOrderOptions(orderOptions: OrderOption[], turnId: number): Promise<void> {
    const orderOptionValues = orderOptions.map((option: OrderOption) => {
      return {
        unit_id: option.unitId,
        order_type: option.orderType,
        secondary_unit_id: option.secondaryUnitId,
        secondary_order_type: option.secondaryOrderType,
        destinations: option.destinations,
        turn_id: turnId
      }
    });

    const query = this.pgp.helpers.insert(orderOptionValues, this.orderOptionsCols);
    return this.db.query(query);
  }

  async saveDefaultOrders(defaultOrders: Order[]): Promise<void> {
    const orderValues = defaultOrders.map((order: Order) => {
      return {
        order_set_id: order.orderSetId,
        order_type: order.orderType,
        ordered_unit_id: order.orderedUnitId,
        destination_id: order.destinationId,
        secondary_unit_id: undefined,
        order_status: 'Default',
        order_success: undefined
      }
    });

    const query = this.pgp.helpers.insert(orderValues, this.orderCols);
    return this.db.query(query);
  }


  //// Legacy Functions ////

  async getUnitAdjacencyInfo(gameId: number, turnId: number): Promise<UnitOptions[]> {
    const unitAdjacencyInfoResult: UnitOptions[] = await this.pool.query(getUnitAdjacentInfoQuery, [gameId, turnId])
      .then((results: QueryResult<any>) => {
        return results.rows.map((result: UnitAdjacyInfoResult) => {
          return <UnitOptions>{
            unitId: result.unit_id,
            unitName: result.unit_name,
            unitType: result.unit_type,
            nodeId: result.node_id,
            nodeName: result.node_name,
            provinceId: result.province_id,
            provinceName: result.province_name,
            adjacencies: result.adjacencies.map((adjacency) => { return {
              nodeId: adjacency.node_id,
              provinceId: adjacency.province_id,
              provinceName: adjacency.province_name
            }}),
            moveTransported: [],
            holdSupports: result.hold_supports && result.hold_supports.map((unit) => { return { unitId: unit.unit_id, unitName: unit.unit_name }}),
            moveSupports: {},
            transportSupports: {},
            nukeTargets: [],
            adjacentTransports: result.adjacent_transports && result.adjacent_transports.map((unit) => { return { unitId: unit.unit_id, unitName: unit.unit_name }}),
            allTransports: {},
            nukeRange: result.nuke_range,
            adjacentTransportables: result.adjacent_transportables && result.adjacent_transportables.map((unit) => { return { unitId: unit.unit_id, unitName: unit.unit_name }}),
            transportDestinations: result.transport_destinations && result.transport_destinations.map((destination) => {
              return {
                nodeId: destination.node_id,
                nodeName: destination.node_name,
                provinceId: destination.province_id
              }
            })
          }
        })
      })
      .catch((error: Error) => {
        console.log('unitAdjacencyInfoResultError: ' + error.message);
        const dud: UnitOptions[] = []
        return dud;
      });

    return unitAdjacencyInfoResult;
  }



  async getAirAdjacencies(gameId: number): Promise<AirAdjacency[]> {
    const airAdjArray: AirAdjacency[] = await this.pool.query(getAirAdjQuery, [gameId])
      .then((results: QueryResult<any>) => {
        return results.rows.map((result: any) => {
          return <AirAdjacency>{
            nodeId: result.node_id,
            adjacencies: result.adjacencies.map((adjacency: AdjacenctMovementResult) => {
              return <AdjacenctMovement>{
                nodeId: adjacency.node_id,
                provinceId: adjacency.province_id,
                provinceName: adjacency.province_name
              }
            }),
            provinceName: result.province_name
          }
        });
      });

    return airAdjArray;
  }

  /**
   * Fetches options for a turn
   * @param turnId    - Turn's ID
   * @returns Promise<SavedOption[]>
   */
  async getUnitOptions(turnTurnId: number, orderTurnId: number, countryId: number = 0): Promise<SavedOption[]> {
    const savedOptions: SavedOption[] = await this.pool.query(getOrderOptionsQuery, [turnTurnId, orderTurnId, countryId])
      .then((result: QueryResult<any>) => {
        return result.rows.map((result: SavedOptionResult) => {
          return <SavedOption> {
            unitId: result.unit_id,
            unitType: result.unit_type,
            unitCountryId: result.unit_country_id,
            unitCountryName: result.unit_country_name,
            unitCountryRank: result.unit_country_rank,
            unitFlagKey: result.unit_flag_key,
            provinceName: result.province_name,
            unitLoc: result.unit_loc,
            canHold: result.can_hold,
            orderType: result.order_type,
            secondaryUnitId: result.secondary_unit_id,
            secondaryUnitType: result.secondary_unit_type,
            secondaryUnitCountryName: result.secondary_unit_country_name,
            secondaryUnitFlagKey: result.secondary_unit_flag_key,
            secondaryProvinceName: result.secondary_province_name,
            secondaryUnitLoc: result.secondary_unit_loc,
            secondaryOrderType: result.secondary_order_type,
            destinations: result.destinations[0] !== null
              ? result.destinations.map((destination: DestinationResult) => {
                return <SavedDestination> {
                  nodeId: destination.node_id,
                  nodeName: this.formatDestinationNodeName(destination.node_name),
                  loc: destination.loc
                };
              })
              : undefined
          };
        });
      });

    return savedOptions;
  }

  async getBuildTransferOptions(gameId: number, turnId: number): Promise<TransferCountry[]> {
    const transferOptions: TransferCountry[] = await this.pool.query(getTransferBuildOptionsQuery, [gameId, turnId])
      .then((result: QueryResult<any>) => result.rows.map((countryResult: TransferCountryResult) => {
        return <TransferCountry> {
          countryId: countryResult.country_id,
          countryName: countryResult.country_name
        };
      }))

    return transferOptions;
  }

  async getTechOfferOptions(gameId: number, turnId: number): Promise<TransferCountry[]> {
    const transferOptions: TransferCountry[] = await this.pool.query(getTechOfferOptionsQuery, [gameId, turnId])
      .then((result: QueryResult<any>) => result.rows.map((countryResult: TransferCountryResult) => {
        return <TransferCountry> {
          countryId: countryResult.country_id,
          countryName: countryResult.country_name
        };
      }))

    return transferOptions;
  }

  async getTechReceiveOptions(gameId: number, turnId: number): Promise<TransferCountry[]> {
    const transferOptions: TransferCountry[] = await this.pool.query(getTechReceiveOptionsQuery, [gameId, turnId])
      .then((result: QueryResult<any>) => result.rows.map((countryResult: TransferCountryResult) => {
        return <TransferCountry> {
          countryId: countryResult.country_id,
          countryName: countryResult.country_name
        };
      }))

    return transferOptions;
  }

  async getTransferOptions(gameId: number, turnId: number): Promise<TransferOption[]> {
    const transferOptions: TransferOption[] = await this.pool.query(getTransferOptionsQuery, [gameId, turnId])
      .then((result: QueryResult<any>) => {
        return result.rows.map((game: TransferOptionResult) => {
          return <TransferOption> {
            gameId: game.game_id,
            giveTech: game.give_tech.map((country: TransferCountryResult) => {
              return <TransferCountry> {
                countryId: country.country_id,
                countryName: country.country_name
              }
            }),
            receiveTech: game.receive_tech.map((country: TransferCountryResult) => {
              return <TransferCountry> {
                countryId: country.country_id,
                countryName: country.country_name
              }
            }),
            receiveBuilds: game.receive_builds.map((country: TransferCountryResult) => {
              return <TransferCountry> {
                countryId: country.country_id,
                countryName: country.country_name
              }
            })
          }
        })
      })
      .catch((error: Error) => {
        console.log('getTransferOptions Error: ' + error.message);
        return [];
      });

    return transferOptions;
  }

  async getAvailableBuildLocs(gameId: number, turnId: number, countryId: number = 0): Promise<BuildLocResult[]> {
    const buildLocs: BuildLocResult[] = await this.pool.query(getEmptySupplyCentersQuery, [gameId, turnId, countryId])
      .then((result: QueryResult<any>) => result.rows.map((province: BuildLocResult) => {
        return <BuildLocResult> {
          countryId: province.country_id,
          countryName: province.country_name,
          provinceName: province.province_name,
          cityLoc: province.city_loc,
          landNodeId: province.land_node_id,
          landNodeLoc: province.land_node_loc,
          seaNodeId: province.sea_node_id,
          seaNodeLoc: province.sea_node_loc,
          seaNodeName: province.sea_node_name,
          airNodeId: province.air_node_id,
          airNodeLoc: province.air_node_loc
        };
      }))
      .catch((error: Error) => {
        console.log('getAvailableBuildLocs Error: ' + error.message);
        return [];
      });

    return buildLocs;
  }

  async getAtRiskUnits(turnId: number, countryId: number = 0): Promise<AtRiskUnit[]> {
    const atRiskUnits: AtRiskUnit[] = await this.pool.query(getAtRiskUnitsQuery, [turnId, countryId])
      .then((result: QueryResult<any>) => result.rows.map((unit: AtRiskUnitResult) => {
        return <AtRiskUnit> {
          unitId: unit.unit_id,
          unitType: unit.unit_type,
          loc: unit.loc,
          countryId: unit.country_id,
          countryName: unit.country_name,
          rank: unit.rank,
          flagKey: unit.flag_key
        }
      }))
      .catch((error: Error) => {
        console.log('getAtRiskUnits Error: ' + error.message);
        return [];
      });

      return atRiskUnits;
  }

  async getNominatableCountries(turnId: number): Promise<NominatableCountry[]> {
    const nominatableCountries: NominatableCountry[]
      = await this.pool.query(getNominatableCountriesQuery, [turnId])
        .then((result: QueryResult) => result.rows.map((country: NominatableCountryResult) => {
          return <NominatableCountry> {
            countryId: country.country_id,
            countryName: country.country_name,
            rank: country.rank
          };
        }))
        .catch((error: Error) => {
          console.log('getNominatableCountries Error: ' + error.message);
          return [];
        });

    return nominatableCountries;
  }

  async getNominations(turnId: number): Promise<Nomination[]> {
    const nominations: Nomination[] = await this.pool.query(getNominationsQuery, [turnId])
      .then((result: QueryResult<any>) => result.rows.map((nomination: NominationResult) => {
        return <Nomination> {
          nominationId: nomination.nomination_id,
          rankSignature: nomination.rank_signature,
          countries: nomination.countries.map((country: NominatableCountryResult) => {
            return <NominatableCountry> {
              countryId: country.country_id,
              countryName: country.country_name,
              rank: country.rank
            };
          }),
          votesRequired: nomination.votes_required
        };
      }))
      .catch((error: Error) => {
        console.log('getNominations Error: ' + error.message);
        return [];
      });

    return nominations;
  }

  formatDestinationNodeName(nodeName: string): string {
    const nameSplit: string[] = nodeName.toUpperCase().split('_');
    return nameSplit.length === 3 ? nameSplit[0] + nameSplit[2] : nameSplit[0];
  }

  async insertTurnOrderSets(currentTurnId: number, nextTurnId: number): Promise<OrderSet[]> {
    const orderSets: OrderSet[] = await this.pool.query(insertTurnOrderSetsQuery, [nextTurnId, currentTurnId])
      .then((result: QueryResult<any>) => result.rows.map((orderSetResult: OrderSetResult) => {
        return <OrderSet> {
          orderSetId: orderSetResult.order_set_id,
          countryId: orderSetResult.country_id,
          turnId: nextTurnId
        }
      }));

    return orderSets;
  }

  async setTurnDefaultsPrepped(turnId: number): Promise<void> {
    await this.pool.query(setTurnDefaultsPreparedQuery, [turnId]);
  }

  async getTurnUnitOrders(countryId: number, orderTurnId: number, historyTurnId: number): Promise<Order[]> {
    const orders: Order[] = await this.pool.query(getTurnUnitOrdersQuery, [countryId, orderTurnId, historyTurnId])
      .then((result: QueryResult<any>) => result.rows.map((orderResult: OrderResult) => {
        return <Order> {
          orderId: orderResult.order_id,
          orderSetId: orderResult.order_set_id,
          orderedUnitId: orderResult.ordered_unit_id,
          orderedUnitLoc: orderResult.ordered_unit_loc,
          orderType: orderResult.order_type,
          secondaryUnitId: orderResult.secondary_unit_id,
          secondaryUnitLoc: orderResult.secondary_unit_loc,
          destinationId: orderResult.destination_id,
          eventLoc: orderResult.event_loc,
          orderStatus: orderResult.order_status
        }
      }));

    return orders;
  }

  // async getTurnOrderSet(countryId: number, turnId: number): Promise<OrderSetFinalIntermediary> {
  //   const orderSet: OrderSetFinalIntermediary[] = await this.pool.query(getOrderSetQuery, [turnId, countryId])
  //     .then((queryResult: QueryResult<any>) => queryResult.rows.map((result: OrderSetFinalResult) => {
  //       return <OrderSetFinalIntermediary> {
  //         orderSetId: result.order_set_id,
  //         countryId: result.country_id,
  //         countryName: result.country_name,
  //         defaultOrders: result.default_orders,
  //         techPartnerId: result.tech_partner_id,
  //         newUnitTypes: result.new_unit_types,
  //         newUnitLocs: result.new_unit_locs,
  //         unitsDisbanding: result.units_disbanding,
  //         buildTransferRecipients: result.build_transfer_recipients,
  //         buildTransferAmountTouplets: result.build_transfer_amounts
  //       };
  //     }))
  //     .catch((error: Error) => {
  //       console.log('getTurnOrderSet Error:', error.message);
  //       return [];
  //     });

  //     return orderSet[0];
  // }

  async getBuildTransferOrders(countryId: number, turnId: number): Promise<TransferBuildOrder[]> {
    const transferBuildOrderResults: TransferBuildOrdersResults[] = await this.pool.query(getBuildTransferOrdersQuery, [turnId, countryId])
      .then((result: QueryResult) => result.rows);

      const transferBuildOrders: TransferBuildOrder[] = [];
    if (transferBuildOrderResults.length > 0) {
      const tuples = transferBuildOrderResults[0].build_transfer_tuples;
      const recipients = transferBuildOrderResults[0].build_transfer_recipients;

      for (let index = 0; index < tuples.length; index += 2) {
        let recipient = recipients.find((country: TransferCountryResult) => country.country_id === tuples[index]);
        if (recipient) {
          transferBuildOrders.push({
            countryId: recipient.country_id,
            countryName: recipient.country_name,
            builds: tuples[index + 1]
          });
        }
      }
    }

    return transferBuildOrders;
  }

  async getTechTransferPartner(nextTurnId: number, currentTurnId: number, countryId: number): Promise<TransferTechOrder[]> {
    return await this.pool.query(getTechTransferOrderQuery, [nextTurnId, currentTurnId, countryId])
     .then((result: QueryResult) => result.rows.map((order: TransferTechOrderResult) => {
      return <TransferTechOrder> {
        countryId: order.country_id,
        countryName: order.country_name,
        techPartnerId: order.tech_partner_id,
        techPartnerName: order.tech_partner_name,
        hasNukes: order.has_nukes
      };
     }));
  }
};