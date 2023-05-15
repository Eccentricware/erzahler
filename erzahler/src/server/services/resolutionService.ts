import { db } from '../../database/connection';
import { CountryHistoryRow, GameRow, OrderRow, OrderSetRow, ProvinceHistoryRow, TurnRow, UnitHistoryRow, UnitRow } from '../../database/schema/table-fields';
import { OrderDisplay } from '../../models/enumeration/order-display-enum';
import { ProvinceStatus, ProvinceType, VoteType } from '../../models/enumeration/province-enums';
import { TurnStatus } from '../../models/enumeration/turn-status-enum';
import { TurnType } from '../../models/enumeration/turn-type-enum';
import { UnitStatus, UnitType } from '../../models/enumeration/unit-enum';
import { TurnTS } from '../../models/objects/database-objects';
import { CountryState } from '../../models/objects/games/country-state-objects';
import { GameSettings } from '../../models/objects/games/game-settings-object';
import { StartDetails } from '../../models/objects/initial-times-object';
import { GameState } from '../../models/objects/last-turn-info-object';
import {
  AdjacentTransport,
  OptionDestination,
  SecondaryUnit,
  TransportDestination,
  UnitOptionsFinalized
} from '../../models/objects/option-context-objects';
import { TransferBuildOrder, TransferTechOrder } from '../../models/objects/order-objects';
import {
  CountryTransferResources,
  OrderDependencies,
  OrderResolutionLocation,
  TransferResources,
  TransportAttempt,
  TransportNetworkUnit,
  UnitOrderGroups,
  UnitOrderResolution
} from '../../models/objects/resolution/order-resolution-objects';
import { UpcomingTurn } from '../../models/objects/scheduler/upcoming-turns-object';
import { OptionsService } from './options-service';

export class ResolutionService {
  optionService: OptionsService = new OptionsService();

  async startGame(gameData: GameSettings, startDetails: StartDetails): Promise<void> {
    const optionsService = new OptionsService();
    const turnNameSplit = TurnType.SPRING_ORDERS.split(' ');
    const firstTurn: TurnTS = {
      gameId: gameData.gameId,
      turnNumber: 1,
      turnName: `${turnNameSplit[0]} ${gameData.stylizedStartYear + 1} ${turnNameSplit[1]}`,
      turnType: TurnType.SPRING_ORDERS,
      turnStatus: TurnStatus.PENDING,
      yearNumber: 1,
      deadline: startDetails.firstTurn
    };
    const nextTurn: TurnTS = await db.schedulerRepo.insertTurn(firstTurn);

    if (nextTurn.turnId) {
      await optionsService.saveOptionsForNextTurn(gameData.gameId, nextTurn.turnId);
    }
    // Alert service call
  }

  async resolveTurn(turn: UpcomingTurn): Promise<void> {
    const turnsWithUnitOrders = [
      TurnType.ORDERS_AND_VOTES,
      TurnType.SPRING_ORDERS,
      TurnType.SPRING_RETREATS,
      TurnType.FALL_ORDERS,
      TurnType.FALL_RETREATS
    ];
    const turnsWithTransfers = [TurnType.ORDERS_AND_VOTES, TurnType.SPRING_ORDERS];
    const turnsWithAdjustments = [TurnType.ADJUSTMENTS, TurnType.ADJ_AND_NOM];
    const turnsWithNominations = [TurnType.ADJ_AND_NOM, TurnType.NOMINATIONS];
    const turnsWithVotes = [TurnType.ORDERS_AND_VOTES, TurnType.VOTES];

    const gameState: GameState = await db.gameRepo.getGameState(turn.gameId);

    // DB Update
    const gameUpdate: GameRow = {};
    const turnUpdate: TurnRow = {}

    const orderSetUpdates: OrderSetRow[] = [];
    const orderUpdates: OrderRow[] = [];

    // DB Inserts
    const currentCountryHistories: CountryHistoryRow[] = await db.gameRepo.getCountryHistories(turn.gameId, gameState.turnNumber);
    const countryHistoryInserts: CountryHistoryRow[] = [];

    const unitInserts: UnitRow[] = []; // Builds

    const unitHistoryInserts: UnitHistoryRow[] = [];

    const provinceHistoryRows: ProvinceHistoryRow[] = [];

    if (turnsWithUnitOrders.includes(turn.turnType)) {
      const provinceHistories: ProvinceHistoryRow[] = [];
      // const currentUnitStates: UnitState[] = await db.gameRepo.getUnitStates(turn.gameId, gameState.turnNumber);
      const unitMovementResults: UnitOrderResolution[] = await this.resolveUnitOrders(gameState, turn);
      // provinceHistories.push(...unitMovementResults.contestedProvinces)

      unitMovementResults.forEach((result: UnitOrderResolution) => {
        const finalPosition: OrderResolutionLocation = this.getFinalPosition(result);
        let provinceHistory = provinceHistories.find(
          (province: ProvinceHistoryRow) => province.provinceId === finalPosition.provinceId
        );
        if (provinceHistory) {
          provinceHistory.controllerId = this.resolveControllerId(result, finalPosition, turn);
          provinceHistory.provinceStatus = this.resolveProvinceStatus(result, finalPosition, turn);
        } else {
          provinceHistory = this.createProvinceHistory(result, finalPosition, turn);
        }

        if (
          [OrderDisplay.DISBAND, OrderDisplay.NUKE].includes(result.orderType) ||
          result.unit.status === UnitStatus.NUKED
        ) {
          const countryHistory = currentCountryHistories.find(
            (country: CountryState) => country.countryId === result.unit.countryId
          );
          if (countryHistory) {
            countryHistory.adjustments++;
            countryHistory.unitCount--;
          }
        }

        if (result.orderType === OrderDisplay.NUKE) {
          const targetCountry = currentCountryHistories.find(
            (country: CountryState) => country.countryId === result.destination.controllerId
          );
          if (targetCountry && result.destination.provinceStatus === ProvinceStatus.ACTIVE) {
            targetCountry.adjustments--;
            targetCountry.cityCount--;
          }
        }

        if (
          [OrderDisplay.MOVE, OrderDisplay.MOVE_CONVOYED].includes(result.orderType) &&
          [UnitStatus.ACTIVE, UnitStatus.RETREAT].includes(result.unit.status) &&
          [UnitType.ARMY, UnitType.FLEET, UnitType.WING].includes(result.unit.type) &&
          result.orderSuccess === false
        ) {
          const bounceFound = provinceHistories.find(
            (province: ProvinceHistoryRow) => province.provinceId === result.destination.provinceId
          );
          if (!bounceFound) {
            provinceHistories.push({
              provinceId: result.destination.provinceId,
              controllerId: result.destination.controllerId,
              capitalOwnerId: result.destination.capitalOwnerId,
              provinceStatus: result.destination.provinceStatus,
              validRetreat: false
            });
          }
        }

        provinceHistories.push(provinceHistory);
      });
    }

    if (turnsWithTransfers.includes(turn.turnType)) {
      const transferResults = await this.resolveTransfers(gameState, turn);

      transferResults.techTransferResults?.forEach((result: TransferTechOrder) => {
        if (result.success && result.hasNukes) {
          const partnerHistory = currentCountryHistories.find(
            (country: CountryState) => country.countryId === result.techPartnerId
          );
          if (partnerHistory) {
            partnerHistory.nukeRange = gameState.defaultNukeRange;
          }
        }
      });

      transferResults.buildTransferResults?.forEach((result: TransferBuildOrder) => {
        if (result.builds > 0) {
          const playerCountry = currentCountryHistories.find(
            (country: CountryState) => country.countryId === result.playerCountryId
          );
          const partnerCountry = currentCountryHistories.find(
            (country: CountryState) => country.countryId === result.countryId
          );
          if (playerCountry && partnerCountry) {
            playerCountry.builds -= result.builds;
            partnerCountry.builds += result.builds;
          }
        }
      });
    }

    // if (turnsWithAdjustments.includes(turn.turnType)) {
    //   this.resolveAdjustments(gameState, turn);
    // }

    // if (turnsWithNominations.includes(turn.turnType)) {
    //   this.resolveNominations(gameState, turn);
    // }

    // if (turnsWithVotes.includes(turn.turnType)) {
    //   this.resolveVotes(gameState, turn);
    // }

    console.log('Db Write Time!');

    // DB Write

    ///////////

    // Fetch turn to filter compatible orders
    // New get query would be needed which includes detailed information
    // Game state and the orders for validation and broadcast

    // Validate possibility of moves
    // Options array query
    // Tech Possesion
    // Build Counts
    // Country Nomination Status
    // Coalition Integrity

    // Update Turn and Preliminary Status
    // Trigger Set Defaults
    // Check Preliminary invalidation
  }

  async resolveUnitOrders(gameState: GameState, turn: UpcomingTurn): Promise<UnitOrderResolution[]> {
    const unitOptions = this.optionService.finalizeUnitOptions(
      await db.optionsRepo.getUnitOptions(gameState.gameId, gameState.turnNumber, turn.turnId, 0)
    );

    const unitOrders: UnitOrderResolution[] = await db.resolutionRepo.getUnitOrdersForResolution(
      gameState.gameId,
      gameState.turnNumber,
      turn.turnId
    );

    const remainingGarrisons: UnitOrderResolution[] = await db.resolutionRepo.getRemainingGarrisons(
      gameState.gameId,
      gameState.turnNumber
    );

    unitOrders.push(...remainingGarrisons);

    const orderGroups: UnitOrderGroups = {
      transport: [],
      hold: [],
      invalid: [],
      move: [],
      moveTransported: [],
      nuke: [],
      support: []
    };

    // If transported unit attempts, add key with initial link
    // Recursively expand all potential paths given compliant transports
    const transportAttempts: Record<string, TransportAttempt> = {};

    // For changes to province histories after resolution
    // const provinceEvents: ProvinceEvents = {
    //   contested: [],
    //   nuked: []
    // };
    // const contestedProvinces: ProvinceHistoryRow[] = [];

    const dependencies: OrderDependencies = {
      dependency: {},
      heads: []
    };

    // Order Possibility Verification
    unitOrders.forEach((order: UnitOrderResolution) => {
      this.sortAndValidateUnitOrder(order, unitOptions, orderGroups);
    });

    // Nukes detonate or invalidate if self-targetting
    // Will include MAD orders, some day
    orderGroups.nuke.forEach((order: UnitOrderResolution) => {
      this.resolveNuclearLaunch(order, unitOrders);
    });

    // Support Cuts and Compliance
    orderGroups.support
      .filter((order: UnitOrderResolution) => order.unit.status === UnitStatus.ACTIVE)
      .forEach((order: UnitOrderResolution) => {
        this.resolveSupport(order, unitOrders, dependencies);
      });

    // Convoy Compliance and success
    if (orderGroups.transport.length > 0 || orderGroups.moveTransported.length > 0) {
      const transportNetwork: TransportNetworkUnit[] = await db.resolutionRepo.getTransportNetworkInfo(
        gameState.gameId,
        gameState.turnNumber
      );

      // Stores filter logic for DRY operation
      const activeMoveTransported = orderGroups.moveTransported.filter(
        (order: UnitOrderResolution) => order.unit.status === UnitStatus.ACTIVE
      );
      const activeTransports = orderGroups.transport.filter(
        (order: UnitOrderResolution) => order.unit.status === UnitStatus.ACTIVE
      );

      // Creates full paths of all fully compliant routes
      activeMoveTransported.forEach((moveTransportedOrder: UnitOrderResolution) => {
        this.createTransportPaths(moveTransportedOrder, orderGroups.transport, transportNetwork, transportAttempts);
      });

      // Checks carried unit compliance and full path existence for transports
      activeTransports.forEach((transportOrder: UnitOrderResolution) => {
        const attemptKey = `${transportOrder.secondaryUnit.id}-${transportOrder.destination.nodeId}`;
        if (!transportAttempts[attemptKey]) {
          transportOrder.valid = false;
          transportOrder.primaryResolution = `Invalid Order: Noncompliance`;
        } else if (transportAttempts[attemptKey].paths.length === 0) {
          transportOrder.valid = false;
          transportOrder.primaryResolution = `Invalid Order: Insufficient Compliance`;
        } else {
          this.checkTransportSuccess(transportOrder, orderGroups.move);
        }
      });
    }

    // Movement
    const unresolvedMovement = orderGroups.move.filter(
      (order: UnitOrderResolution) => order.unit.status === UnitStatus.ACTIVE
    );
    const moveTransported = orderGroups.moveTransported.filter(
      (order: UnitOrderResolution) => order.unit.status === UnitStatus.ACTIVE
    );
    unresolvedMovement.push(...moveTransported);

    unresolvedMovement.forEach((order: UnitOrderResolution) => {
      this.resolveMovement(order, unitOrders, dependencies);
    });

    orderGroups.hold.forEach((holdOrder: UnitOrderResolution) => {
      this.resolveHold(holdOrder, unitOrders);
    });

    this.checkDependencies(dependencies, unitOrders);

    return unitOrders;
    // return <UnitMovementResults> {
    //   orderResults: unitOrders
    //   // contestedProvinces: contestedProvinces
    // };
  }

  sortAndValidateUnitOrder(
    order: UnitOrderResolution,
    unitOptions: UnitOptionsFinalized[],
    orderGroups: UnitOrderGroups
  ): void {
    const options: UnitOptionsFinalized | undefined = unitOptions.find(
      (option: UnitOptionsFinalized) => option.unitId === order.unit.id
    );

    if (options === undefined) {
      if (order.unit.type !== UnitType.GARRISON) {
        console.log(
          `orderId ${order.orderId} with unitId ${order.unit.id} doesn't even have matching options. This should be impossible but here we are!`
        );

        this.invalidateOrder(order, `Incredibly Invalid`);
      }
    } else if (!options.orderTypes.includes(order.orderType)) {
      this.invalidateOrder(order, `Invalid Order Type`);
    } else if (order.orderType === OrderDisplay.HOLD) {
      orderGroups.hold.push(order);
    } else if (order.orderType === OrderDisplay.MOVE) {
      const destinationIds = options.moveDestinations.map((destination: OptionDestination) => destination.nodeId);

      if (!destinationIds.includes(order.destination.nodeId)) {
        this.invalidateOrder(order, `Invalid Destination`);
      } else {
        orderGroups.move.push(order);
      }
    } else if (order.orderType === OrderDisplay.MOVE_CONVOYED) {
      const destinationIds = options.moveTransportedDestinations.map(
        (destination: OptionDestination) => destination.nodeId
      );

      if (!destinationIds.includes(order.destination.nodeId)) {
        this.invalidateOrder(order, `Invalid Destination`);
      } else {
        orderGroups.moveTransported.push(order);
      }
    } else if (order.orderType === OrderDisplay.NUKE) {
      const targetIds = options.nukeTargets.map((destination: OptionDestination) => destination.nodeId);

      if (!targetIds.includes(order.destination.nodeId)) {
        this.invalidateOrder(order, `Invalid Target`);
      } else {
        orderGroups.nuke.push(order);
      }
    } else if (order.orderType === OrderDisplay.SUPPORT) {
      const supportableUnitIds = options.supportStandardUnits.map((unit: SecondaryUnit) => unit.id);

      if (!supportableUnitIds.includes(order.secondaryUnit.id)) {
        this.invalidateOrder(order, 'Invalid Support Unit');
      } else {
        const supportDestinationIds = options.supportStandardDestinations[order.secondaryUnit.id].map(
          (destination: OptionDestination) => destination.nodeId
        );

        if (!supportDestinationIds.includes(order.destination.nodeId)) {
          this.invalidateOrder(order, 'Invalid Support Destination');
        } else {
          orderGroups.support.push(order);
        }
      }
    } else if (order.orderType === OrderDisplay.SUPPORT_CONVOYED) {
      const supportableUnitIds = options.supportTransportedUnits.map((unit: SecondaryUnit) => unit.id);

      if (!supportableUnitIds.includes(order.secondaryUnit.id)) {
        this.invalidateOrder(order, 'Invalid Support Unit');
      } else {
        const supportDestinationIds = options.supportTransportedDestinations[order.secondaryUnit.id].map(
          (destination: OptionDestination) => destination.nodeId
        );

        if (!supportDestinationIds.includes(order.destination.nodeId)) {
          this.invalidateOrder(order, 'Invalid Support Destination');
        } else {
          orderGroups.support.push(order);
        }
      }
    } else if ([OrderDisplay.AIRLIFT, OrderDisplay.CONVOY].includes(order.orderType)) {
      const transportableUnitIds = options.transportableUnits.map((unit: SecondaryUnit) => unit.id);

      if (!transportableUnitIds.includes(order.secondaryUnit.id)) {
        this.invalidateOrder(order, `Invalid ${order.orderType} Unit`);
      } else {
        const transportDestinationIds = options.transportDestinations[order.secondaryUnit.id].map(
          (destination: OptionDestination) => destination.nodeId
        );

        if (!transportDestinationIds.includes(order.destination.nodeId)) {
          this.invalidateOrder(order, `Invalid ${order.orderType} Destination`);
        } else {
          orderGroups.transport.push(order);
        }
      }
    }

    order.valid = true;
  }

  invalidateOrder(order: UnitOrderResolution, failureDescription: string) {
    order.valid = false;
    order.primaryResolution = failureDescription;
    // order.orderType = OrderDisplay.HOLD;
    // order.destination = {
    //   id: 0,
    //   provinceId: 0,
    //   provinceName: 'Invalid',
    //   nodeName: 'Invalid',
    //   nodeType: 'Invalid'
    // };
  }

  resolveNuclearLaunch(order: UnitOrderResolution, orders: UnitOrderResolution[]) {
    const victim: UnitOrderResolution | undefined = orders.find(
      (victim: UnitOrderResolution) => victim.origin.provinceId === order.destination.provinceId
    );

    if (victim && victim.unit.countryId === order.unit.countryId) {
      order.valid = false;
      order.primaryResolution = `Invalid order: No self nuking`;
    } else {
      order.unit.status = UnitStatus.DETONATED;
    }

    if (victim && victim.unit.countryId !== order.unit.countryId) {
      victim.unit.status = UnitStatus.NUKED;
      victim.primaryResolution = `Invalid order: Nuked`;
    }
  }

  /**
   * Checks compliance, cuts, risk of self-dislodge.
   * @param order
   * @param orders
   */
  resolveSupport(order: UnitOrderResolution, orders: UnitOrderResolution[], dependencies: OrderDependencies) {
    const supportedUnit: UnitOrderResolution | undefined = orders.find(
      (unit: UnitOrderResolution) => unit.unit.id === order.secondaryUnit.id
    );
    if (supportedUnit) {
      if (supportedUnit.destination.nodeId !== order.destination.nodeId) {
        order.primaryResolution = `Invalid Order: Noncompliance`;
        return;
      }

      if (supportedUnit.unit.status === UnitStatus.NUKED) {
        order.valid = false;
        order.orderSuccess = false;
        order.primaryResolution = `Invalid Order: Supported Unit Nuked`;
        return;
      }

      const destinationNuked = orders.find(
        (strike: UnitOrderResolution) =>
          strike.orderType === OrderDisplay.NUKE && strike.destination.provinceId === order.destination.provinceId
      );
      if (destinationNuked) {
        order.valid = false;
        order.orderSuccess = false;
        order.primaryResolution = `Invalid Order: Can't Support Into Nuclear Fallout`;
        return;
      }

      const validCuts = orders.filter(
        (attack: UnitOrderResolution) =>
          attack.destination.provinceId === order.origin.provinceId &&
          attack.unit.countryId !== order.unit.countryId &&
          attack.origin.provinceId !== supportedUnit.destination.provinceId
      );

      if (validCuts.length > 0) {
        order.primaryResolution = order.primaryResolution
          ? `${order.primaryResolution}. Failed: Support Cut`
          : 'Failed: Support Cut';
        order.supportCut = true;
      }

      if (!order.supportCut) {
        const defender: UnitOrderResolution | undefined = orders.find(
          (defender: UnitOrderResolution) => defender.origin.provinceId === order.destination.provinceId
        );
        if (defender) {
          if (
            [
              OrderDisplay.HOLD,
              OrderDisplay.AIRLIFT,
              OrderDisplay.CONVOY,
              OrderDisplay.SUPPORT,
              OrderDisplay.SUPPORT_CONVOYED
            ].includes(defender.orderType) &&
            defender.unit.countryId === order.unit.countryId
          ) {
            order.valid = false;
            order.primaryResolution = `Invalid Order: Can't Self-Dislodge`;
          }

          if (
            [OrderDisplay.MOVE, OrderDisplay.MOVE_CONVOYED].includes(defender.orderType) &&
            defender.unit.countryId === order.unit.countryId &&
            order.valid
          ) {
            this.setDependency(dependencies, order.orderId, defender.orderId, `Can't Self-Dislodge`);
          }
        }

        if (order.valid && !order.supportCut) {
          order.orderSuccess = true;
          supportedUnit.power++;
          order.primaryResolution = `Supported Unit Power: ${supportedUnit.power}`;
        }
      } else {
        this.resolveHold(order, orders, true);
      }
    }
  }

  setDependency(dependencies: OrderDependencies, orderId: number, dependendentId: number, explanation: string) {
    dependencies.dependency[dependendentId] = {
      orderId: orderId,
      explanation: explanation
    };
    const depIndex = dependencies.heads.indexOf(orderId);
    if (depIndex > -1) {
      dependencies.heads[depIndex] = dependendentId;
    } else {
      dependencies.heads.push(dependendentId);
    }
  }

  createTransportPaths(
    order: UnitOrderResolution,
    transportOrders: UnitOrderResolution[],
    transportNetwork: TransportNetworkUnit[],
    transportAttempts: Record<string, TransportAttempt>
  ) {
    const attemptId = `${order.unit.id}-${order.destination.nodeId}`;
    transportAttempts[attemptId] = {
      success: false,
      paths: []
    };

    const compliantTransportsIds = transportOrders
      .filter(
        (transport: UnitOrderResolution) =>
          transport.secondaryUnit.id === order.unit.id && transport.destination.nodeId === order.destination.nodeId
      )
      .map((transport: UnitOrderResolution) => transport.unit.id);

    const compliantTransports = transportNetwork.filter((transport: TransportNetworkUnit) =>
      compliantTransportsIds.includes(transport.unitId)
    );

    let initialTransportIds = transportNetwork
      .find((transported: TransportNetworkUnit) => transported.unitId === order.unit.id)
      ?.transports.map((transport: AdjacentTransport) => transport.unitId);

    if (initialTransportIds === undefined) {
      initialTransportIds = [];
    }

    initialTransportIds.forEach((transportId: number) => {
      this.extendTransportPath(transportId, [], order, compliantTransports, transportAttempts[attemptId]);
    });
  }

  extendTransportPath(
    currentLinkId: number,
    committed: number[],
    order: UnitOrderResolution,
    compliantTransports: TransportNetworkUnit[],
    transportAttempt: TransportAttempt
  ) {
    const currentTransport = compliantTransports.find(
      (transport: TransportNetworkUnit) => transport.unitId === currentLinkId
    );
    if (currentTransport) {
      const newCommitted = committed.slice();
      newCommitted.push(currentLinkId);

      const destination = currentTransport.destinations.find(
        (destination: TransportDestination) => destination.nodeId === order.destination.nodeId
      );
      if (destination) {
        if (transportAttempt.paths) {
          transportAttempt.paths.push({
            transports: newCommitted,
            success: true
          });
        } else {
          transportAttempt.paths = [
            {
              transports: newCommitted,
              success: true
            }
          ];
        }
      } else {
        const nextTransports = this.getNextTransports(order.unit.id, newCommitted, compliantTransports);
        nextTransports.forEach((transportId: number) => {
          this.extendTransportPath(transportId, newCommitted, order, compliantTransports, transportAttempt);
        });
      }
    }
  }

  getNextTransports(
    currentUnitId: number,
    committedTransportIds: number[],
    compliantTransports: TransportNetworkUnit[]
  ): number[] {
    const nextTransports = compliantTransports
      .find((transport: TransportNetworkUnit) => transport.unitId === currentUnitId)
      ?.transports.filter((transport: AdjacentTransport) => !committedTransportIds.includes(transport.unitId))
      .map((transport: AdjacentTransport) => transport.unitId);

    return nextTransports ? nextTransports : [];
  }

  /**
   * Primary difference between convoy success and move success is that convoys are non-transported only.
   * This prevents.
   */
  checkTransportSuccess(transportOrder: UnitOrderResolution, moveStandardOrders: UnitOrderResolution[]) {
    const challengers = moveStandardOrders.filter(
      (challengingOrder: UnitOrderResolution) =>
        challengingOrder.destination.nodeId === transportOrder.origin.nodeId && challengingOrder.valid
    );
    if (challengers.length === 0) {
      transportOrder.orderSuccess = true;
      transportOrder.primaryResolution = `Success`;
      return;
    }
    const challenges: Record<number, number[]> = {};
    let maxPower = transportOrder.power;
    challengers.forEach((challenger: UnitOrderResolution) => {
      if (challenges[challenger.power]) {
        challenges[challenger.power].push(challenger.unit.id);
      } else {
        challenges[challenger.power] = [challenger.unit.id];
      }

      maxPower = challenger.power > maxPower ? challenger.power : maxPower;
    });

    const transportPowerSummary = this.createTransportPowerConflictSummary(transportOrder.power, challenges, maxPower);

    if (maxPower > transportOrder.power && challenges[maxPower].length === 1) {
      transportOrder.orderSuccess = false;
      transportOrder.primaryResolution = `Hold Failed: ${transportPowerSummary}`;
      transportOrder.unit.status = UnitStatus.RETREAT;
    } else if (maxPower > transportOrder.power) {
      transportOrder.orderSuccess = true;
      transportOrder.primaryResolution = `Hold Victory: Bouncing Challengers ${transportPowerSummary}`;
    } else if (maxPower === transportOrder.power) {
      transportOrder.orderSuccess = true;
      transportOrder.primaryResolution = `Hold Victory: ${transportPowerSummary}`;
    }

    challengers.forEach((challenger: UnitOrderResolution) => {
      this.resolveTransportChallenge(transportOrder.power, challenger, challenges, maxPower);
    });
  }

  createTransportPowerConflictSummary(
    transportOrderPower: number,
    challenges: Record<number, number[]>,
    maxPower: number
  ): string {
    let powerSummary = `${transportOrderPower}`;

    let currentPower = maxPower;
    while (currentPower > 0) {
      challenges[currentPower].forEach(() => {
        powerSummary += `v${currentPower}`;
      });
      currentPower--;
    }

    return powerSummary;
  }

  resolveTransportChallenge(
    transportOrderPower: number,
    challenger: UnitOrderResolution,
    challenges: Record<number, number[]>,
    maxPower: number
  ) {
    const victory = challenger.power === maxPower && challenges[maxPower].length === 1;
    let summary = victory ? `Victory: ` : `Bounce: `;
    challenger.orderSuccess = victory;

    let currentPower = maxPower;
    while (currentPower > 0) {
      challenges[currentPower].forEach((challengerId: number) => {
        if (challenger.unit.id !== challengerId) {
          summary += `v${currentPower}`;
        }
      });
      if (transportOrderPower === currentPower) {
        summary += `v${transportOrderPower}`;
      }
      currentPower--;
    }

    challenger.primaryResolution = summary;
  }

  resolveMovement(order: UnitOrderResolution, unitOrders: UnitOrderResolution[], dependencies: OrderDependencies) {
    const nuclearStrike = unitOrders.find(
      (strike: UnitOrderResolution) =>
        strike.orderType === OrderDisplay.NUKE && strike.destination.provinceId === order.destination.provinceId
    );
    if (nuclearStrike) {
      order.valid = false;
      order.orderSuccess = false;
      order.primaryResolution = `Invalid Order: Can't Enter Nuclear Fallout`;
      return;
    }

    const holdingChallenger = unitOrders.find(
      (challenger: UnitOrderResolution) =>
        challenger.origin.provinceId === order.destination.provinceId &&
        [OrderDisplay.AIRLIFT, OrderDisplay.CONVOY, OrderDisplay.HOLD].includes(challenger.orderType) &&
        challenger.orderSuccess === null &&
        challenger.valid === true
    );

    const incomingChallengers = unitOrders.filter(
      (challenger: UnitOrderResolution) =>
        challenger.destination.provinceId === order.destination.provinceId &&
        [OrderDisplay.MOVE, OrderDisplay.MOVE_CONVOYED].includes(challenger.orderType) &&
        challenger.unit.id !== order.unit.id &&
        challenger.valid === true
    );

    if (holdingChallenger) {
      if (holdingChallenger.unit.countryId === order.unit.countryId) {
        order.valid = false;
        order.primaryResolution = `Invalid Order: Can't Self-Dislodge`;
        return;
      }
      incomingChallengers.push(holdingChallenger);
    }

    if (incomingChallengers.length > 0) {
      this.resolveMovementChallenge(order, incomingChallengers);
    } else {
      order.orderSuccess = true;
      order.primaryResolution = 'Success';
    }

    if (order.orderSuccess) {
      const leavingUnit = unitOrders.find(
        (leavingUnit: UnitOrderResolution) => leavingUnit.origin.provinceId === order.destination.provinceId
      );
      if (leavingUnit && order.power === 1) {
        this.setDependency(dependencies, leavingUnit.orderId, order.orderId, `Failed: Bounce 1v1`);
      } else if (leavingUnit && leavingUnit.unit.countryId === order.unit.countryId) {
        this.setDependency(dependencies, leavingUnit.orderId, order.orderId, `Invalid Order: Can't Self-Dislodge`);
      }
    } else {
      this.resolveHold(order, unitOrders, true, 1);
    }
  }

  resolveMovementChallenge(movementOrder: UnitOrderResolution, challengers: UnitOrderResolution[]) {
    const challenges: Record<number, number[]> = {};
    let maxPower = movementOrder.power;

    challengers.forEach((challenger: UnitOrderResolution) => {
      if (challenges[challenger.power]) {
        challenges[challenger.power].push(challenger.power);
      } else {
        challenges[challenger.power] = [challenger.power];
      }
      maxPower = challenger.power > maxPower ? challenger.power : maxPower;
    });

    const victory = movementOrder.power === maxPower && !challenges[maxPower];
    let summary = victory ? `Victory: ${movementOrder.power}` : `Bounce: ${movementOrder.power}`;
    movementOrder.orderSuccess = victory;

    let currentPower = maxPower;
    while (currentPower > 0) {
      if (challenges[currentPower]) {
        challenges[currentPower].forEach(() => {
          summary += `v${currentPower}`;
        });
      }
      currentPower--;
    }

    movementOrder.primaryResolution = summary;
  }

  checkDependencies(dependencies: OrderDependencies, unitOrders: UnitOrderResolution[]) {
    dependencies.heads.forEach((orderId: number) => {
      this.checkDependency(orderId, dependencies, unitOrders);
    });
  }

  /**
   * Checks holds and supports when attacked. Supporting check follows after support description.
   * @param holdOrder
   * @param unitOrders
   * @param supporting
   */
  resolveHold(holdOrder: UnitOrderResolution, unitOrders: UnitOrderResolution[], secondary?: boolean, power?: number) {
    holdOrder.orderSuccess = secondary ? false : true;
    holdOrder.power = power ? power : holdOrder.power;
    // holdOrder.primaryResolution = 'Success';;

    const challenges: Record<number, number[]> = {};
    let maxPower = holdOrder.power;

    const challengers = unitOrders.filter(
      (challenger: UnitOrderResolution) =>
        challenger.destination.provinceId === holdOrder.origin.provinceId &&
        [OrderDisplay.MOVE, OrderDisplay.MOVE_CONVOYED].includes(challenger.orderType)
    );

    challengers.forEach((challenger: UnitOrderResolution) => {
      if (challenges[challenger.power]) {
        challenges[challenger.power].push(challenger.power);
      } else {
        challenges[challenger.power] = [challenger.power];
      }
      maxPower = challenger.power > maxPower ? challenger.power : maxPower;
    });

    if (challengers.length > 0) {
      const victory = holdOrder.power === maxPower;
      let summary = victory ? `Victory: ` : `Dislodged: `;
      holdOrder.orderSuccess = victory;

      let currentPower = maxPower;
      while (currentPower > 0) {
        if (challenges[currentPower]) {
          challenges[currentPower].forEach(() => {
            summary += `v${currentPower}`;
          });
        }
        currentPower--;
      }

      if (secondary) {
        holdOrder.secondaryResolution = summary;
      } else {
        holdOrder.primaryResolution = summary;
      }
    }
  }

  checkDependency(orderId: number, dependencies: OrderDependencies, unitOrders: UnitOrderResolution[]) {
    const independency = unitOrders.find((order: UnitOrderResolution) => order.orderId === orderId);
    if (independency) {
      const dependency = unitOrders.find(
        (order: UnitOrderResolution) => order.orderId === dependencies.dependency[orderId].orderId
      );
      if (dependency) {
        if (!independency.orderSuccess) {
          dependency.orderSuccess = false;
          dependency.primaryResolution = dependencies.dependency[orderId].explanation;
        }

        if (dependencies.dependency[dependency.orderId]) {
          this.checkDependency(dependency.orderId, dependencies, unitOrders);
        }
      }
    }
  }

  async resolveTransfers(gameState: GameState, turn: UpcomingTurn): Promise<TransferResources> {
    const transferResources: TransferResources = {
      countryResources: await db.resolutionRepo.getTransferResourceValidation(gameState.gameId, gameState.turnNumber),
      handshakes: {
        offers: {},
        requests: {}
      }
    };
    transferResources.techTransferResults = await this.validateTechTransfers(
      gameState.gameId,
      gameState.turnNumber,
      turn.turnId,
      transferResources
    );
    transferResources.buildTransferResults = await this.validateBuildTransfers(turn.turnId, transferResources);
    return transferResources;
  }

  async validateTechTransfers(
    gameId: number,
    turnNumber: number,
    orderTurnId: number,
    transferResources: TransferResources
  ): Promise<TransferTechOrder[]> {
    const techTransferOrders: TransferTechOrder[] = await db.ordersRepo.getTechTransferPartner(
      gameId,
      turnNumber,
      orderTurnId,
      0
    );

    techTransferOrders.forEach((order: TransferTechOrder) => {
      const partnerCountry = techTransferOrders.find(
        (resource: TransferTechOrder) => resource.countryId === order.techPartnerId
      );
      if (partnerCountry) {
        const playerCountry = techTransferOrders.find(
          (resource: TransferTechOrder) => resource.countryId === order.countryId
        );
        if (playerCountry) {
          if (playerCountry.hasNukes && !partnerCountry.hasNukes) {
            transferResources.handshakes.offers[playerCountry.countryId] = partnerCountry.countryId;
            if (transferResources.handshakes.requests[partnerCountry.countryId] === playerCountry.countryId) {
              playerCountry.success = true;
              partnerCountry.success = true;
            }
          } else if (!playerCountry.hasNukes && partnerCountry.hasNukes) {
            transferResources.handshakes.requests[playerCountry.countryId] = partnerCountry.countryId;
            if (transferResources.handshakes.offers[partnerCountry.countryId] === playerCountry.countryId) {
              playerCountry.success = true;
              partnerCountry.success = true;
            }
          }
        }
      }
    });

    return techTransferOrders;
  }

  async validateBuildTransfers(turnId: number, transferResources: TransferResources): Promise<TransferBuildOrder[]> {
    const buildTransferOrders: TransferBuildOrder[] = await db.ordersRepo.getBuildTransferOrders(0, turnId);

    buildTransferOrders.forEach((transferOrder: TransferBuildOrder) => {
      const playerCountry = transferResources.countryResources.find(
        (country: CountryTransferResources) => country.countryId === transferOrder.playerCountryId
      );

      if (playerCountry) {
        if (playerCountry.buildsRemaining >= transferOrder.builds) {
          playerCountry.buildsRemaining -= transferOrder.builds;
        } else {
          transferOrder.builds = playerCountry?.buildsRemaining;
          playerCountry.buildsRemaining -= transferOrder.builds;
        }
      }
    });
    return buildTransferOrders;
  }

  // async resolveAdjustments(gameState: GameState, turn: UpcomingTurn): Promise<void> {

  // }

  // async resolveNominations(gameState: GameState, turn: UpcomingTurn): Promise<void> {

  // }

  // async resolveVotes(gameState: GameState, turn: UpcomingTurn): Promise<void> {

  // }

  getFinalPosition(result: UnitOrderResolution): OrderResolutionLocation {
    let finalPosition: OrderResolutionLocation = result.origin;
    if (
      (result.unit.status === UnitStatus.ACTIVE ||
        result.unit.status === UnitStatus.RETREAT ||
        result.unit.status === UnitStatus.DETONATED) &&
      (result.orderType === OrderDisplay.MOVE ||
        result.orderType === OrderDisplay.MOVE_CONVOYED ||
        result.orderType === OrderDisplay.NUKE) &&
      result.orderSuccess
    ) {
      finalPosition = result.destination;
    }
    return finalPosition;
  }

  createProvinceHistory(
    result: UnitOrderResolution,
    finalPosition: OrderResolutionLocation,
    turn: UpcomingTurn
  ): ProvinceHistoryRow {
    return {
      provinceId: finalPosition.provinceId,
      controllerId: this.resolveControllerId(result, finalPosition, turn),
      capitalOwnerId: finalPosition.capitalOwnerId,
      provinceStatus: this.resolveProvinceStatus(result, finalPosition, turn),
      validRetreat: false
    };
  }

  resolveControllerId(result: UnitOrderResolution, finalPosition: OrderResolutionLocation, turn: UpcomingTurn): number {
    if (
      ([ProvinceType.COAST, ProvinceType.INLAND, ProvinceType.ISLAND].includes(finalPosition.provinceType) &&
        turn.hasCaptures &&
        result.unit.canCapture) ||
      ([ProvinceType.COAST, ProvinceType.INLAND, ProvinceType.ISLAND].includes(finalPosition.provinceType) &&
        finalPosition.provinceStatus === ProvinceStatus.INERT)
    ) {
      return result.unit.countryId;
    } else {
      return finalPosition.controllerId;
    }
  }

  resolveProvinceStatus(
    result: UnitOrderResolution,
    finalPosition: OrderResolutionLocation,
    turn: UpcomingTurn
  ): ProvinceStatus {
    if (result.orderType === OrderDisplay.NUKE && [VoteType.CAPITAL, VoteType.VOTE].includes(finalPosition.voteType)) {
      return ProvinceStatus.NUKED;
    } else if (result.orderType === OrderDisplay.NUKE) {
      return ProvinceStatus.INERT;
    }

    if (
      [ProvinceType.COAST, ProvinceType.INLAND, ProvinceType.ISLAND].includes(finalPosition.provinceType) && [
        ProvinceStatus.ACTIVE,
        ProvinceStatus.DORMANT,
        ProvinceStatus.BOMBARDED
      ] &&
      turn.hasCaptures &&
      result.unit.canCapture
    ) {
      return ProvinceStatus.ACTIVE;
    }

    if (
      [ProvinceType.COAST, ProvinceType.INLAND, ProvinceType.ISLAND].includes(finalPosition.provinceType) && [
        ProvinceStatus.ACTIVE,
        ProvinceStatus.DORMANT,
        ProvinceStatus.BOMBARDED
      ] &&
      turn.hasCaptures &&
      result.unit.type === UnitType.WING
    ) {
      return ProvinceStatus.BOMBARDED;
    }

    return ProvinceStatus.INERT;
  }

  getOrCreateProvinceHistory(
    provinceHistories: ProvinceHistoryRow[],
    finalPosition: OrderResolutionLocation
  ): ProvinceHistoryRow {
    let provinceHistory = provinceHistories.find(
      (province: ProvinceHistoryRow) => province.provinceId === finalPosition.provinceId
    );
    if (provinceHistory === undefined) {
      provinceHistory = {
        // resolutionEvent: ResolutionEvent.PERPETUATION,
        provinceId: finalPosition.provinceId,
        controllerId: finalPosition.capitalOwnerId,
        capitalOwnerId: finalPosition.capitalOwnerId,
        provinceStatus: finalPosition.provinceStatus,
        validRetreat: true
      };
    }
    return provinceHistory;
  }
}
