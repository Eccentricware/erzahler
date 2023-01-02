import { DecodedIdToken } from "firebase-admin/auth";
import { Pool, Query, QueryResult } from "pg";
import { checkGameNameAvailabilityQuery } from "../../database/queries/game/check-game-name-availability-query";
import { insertAssignmentQuery } from "../../database/queries/game/insert-assignment-query";
import { insertCountryHistoryQuery } from "../../database/queries/game/insert-country-history-query";
import { insertCountryQuery } from "../../database/queries/game/insert-country-query";
import { insertNewGameQuery } from "../../database/queries/game/insert-game-query";
import { insertLabelQuery } from "../../database/queries/game/insert-label-query";
import { insertNodeAdjacencyQuery } from "../../database/queries/game/insert-node-adjacency-query";
import { insertNodeQuery } from "../../database/queries/game/insert-node-query";
import { insertInitialProvinceHistoryQuery } from "../../database/queries/game/insert-initial-province-history-query";
import { insertProvinceQuery } from "../../database/queries/game/insert-province-query";
import { insertRuleInGameQuery } from "../../database/queries/game/insert-rule-in-game-query";
import { insertTerrainQuery } from "../../database/queries/game/insert-terrain-query";
import { insertTurnQuery } from "../../database/queries/game/insert-turn-query";
import { insertUnitHistoryQuery } from "../../database/queries/game/insert-unit-history-query";
import { insertUnitQuery } from "../../database/queries/game/insert-unit-query";
import { victorCredentials } from "../../secrets/dbCredentials";
import { AccountService } from "./accountService";
import { getGameDetailsQuery } from "../../database/queries/game/get-game-details-query";
import { getRulesInGameQuery } from "../../database/queries/game/get-rules-in-game-query";
import { checkUserGameAdminQuery } from "../../database/queries/game/check-user-game-admin-query";
import { updateGameSettingsQuery } from "../../database/queries/game/update-game-settings-query";
import { updateTurnQuery } from "../../database/queries/game/update-turn-query";
import { SchedulerService } from "./scheduler-service";
import { StartScheduleObject } from "../../models/objects/start-schedule-object";
import { FormattingService } from "./formattingService";
import { getGamesQuery } from "../../database/queries/game/get-games-query";
import { GameSummaryBuilder } from "../../models/classes/game-summary-builder";
import { GameSummaryQueryObject } from "../../models/objects/game-summary-query-object";
import { GameDetailsBuilder } from "../../models/classes/game-details-builder";
import { startGameQuery } from "../../database/queries/game/start-game-query";
import { StartScheduleEvents } from "../../models/objects/start-schedule-events-object";
import schedule from 'node-schedule';
import { TurnStatus } from "../../models/enumeration/turn-status-enum";
import { StartDetails } from "../../models/objects/initial-times-object";
import { ResolutionService } from "./resolutionService";
import { GameStatus } from "../../models/enumeration/game-status-enum";
import { setAssignmentsActiveQuery } from "../../database/queries/assignments/set-assignments-active-query";
import { OptionsService } from "./orders-service";
import { TurnType } from "../../models/enumeration/turn-type-enum";
import { insertCoalitionScheduleQuery } from "../../database/queries/game/insert-coalition-schedule-query";
import { db } from "../../database/connection";
import { StartTiming } from "../../models/enumeration/start-timing-enum";

export class GameService {
  gameData: any = {};
  user: any = undefined;
  errors: string[] = [];

  async newGame(gameData: any, idToken: string): Promise<any> {
    const accountService: AccountService = new AccountService();
    const optionsService: OptionsService = new OptionsService();

    // const token: DecodedIdToken = await accountService.validateToken(idToken);
    this.user = await accountService.getUserProfile(idToken);
    if (!this.user.error) {
      const pool: Pool = new Pool(victorCredentials);
      this.gameData = gameData;

      const newGameResult = await this.addNewGame(pool, this.gameData, this.user.timeZone)
        .then(async (newGameId: any) => {
          return {
            success: true,
            gameId: newGameId,
            errors: this.errors
          };
        })
        .catch((error: Error) => {
          console.log('Game Response Failure:', error.message)
          this.errors.push('New Game Error' + error.message);
          return {
            success: false,
            gameId: 0,
            errors: this.errors
          }
        });

      return newGameResult;

    } else {
      console.log('Invalid Token UID attempting to save new game');
      return {
        success: false,
        error: 'Invalid Token UID'
      }
    }
  }

  async addNewGame(pool: Pool, settings: any, userTimeZoneName: string): Promise<any> {
    const schedulerService: SchedulerService = new SchedulerService();
    const events: StartScheduleEvents = schedulerService.extractEvents(settings, userTimeZoneName);
    const schedule: StartScheduleObject = schedulerService.prepareStartSchedule(events);
    console.log('Schedule', schedule);

    const settingsArray: any = [
      settings.gameName,
      settings.assignmentMethod,
      settings.stylizedStartYear,
      settings.turn1Timing,
      settings.deadlineType,
      schedule.gameStart,
      settings.observeDst,
      schedule.orders.day,
      schedule.orders.time,
      schedule.retreats.day,
      schedule.retreats.time,
      schedule.adjustments.day,
      schedule.adjustments.time,
      schedule.nominations.day,
      schedule.nominations.time,
      schedule.votes.day,
      schedule.votes.time,
      settings.nmrTolerance,
      settings.concurrentGamesLimit,
      settings.privateGame,
      settings.hiddenGame,
      settings.blindCreator,
      settings.finalReadinessCheck,
      settings.voteDeadlineExtension,
      settings.partialRosterStart,
      settings.nominationTiming,
      settings.nominationYear,
      settings.automaticAssignments,
      settings.ratingLimits,
      settings.funRange[0],
      settings.funRange[1],
      settings.skillRange[0],
      settings.skillRange[1]
    ];

    return await db.gameRepo.insertGame(settingsArray)
      .then(async (results: QueryResult<any>) => {
        const newGame = results.rows[0];
        console.log('Game Row Added Successfully');

        return await Promise.all([
          await this.addCreatorAssignment(pool, this.user.userId),
          await this.addRulesInGame(pool),
          await this.addTurn0(pool, schedule),
          await this.addCoalitionSchedule(pool)
        ]).then(() => {
          return newGame.game_id;
        });

      })
      .catch((error: Error) => {
        console.log('New game Error:', error.message);
        this.errors.push('New Game Error: ' + error.message);
      });
  }

  async addCreatorAssignment(pool: Pool, userId: number): Promise<void> {
    await db.gameRepo.insertAssignment(userId, undefined, 'Creator', this.gameData.gameName);
  }

  async addCoalitionSchedule(pool: Pool): Promise<void> {
    await db.gameRepo.insertCoalitionScheduleQuery(this.gameData.gameName);
  }

  async addTurn0(pool: Pool, schedule: StartScheduleObject): Promise<void> {
    await db.gameRepo.insertTurn([
      schedule.gameStart,
      0,
      `Winter ${this.gameData.stylizedStartYear}`,
      TurnType.ADJUSTMENTS,
      TurnStatus.RESOLVED,
      this.gameData.gameName
    ])
    .then(async (result: any) => {
      console.log('Turn 0 Added Successfully');
      await this.addCountries(pool);
    })
    .catch((error: Error) => {
      console.log('Turn 0 Error: ', error.message);
      this.errors.push('Turn 0 Error: ' + error.message);
    });
  }

  async addTurn1(pool: Pool, schedule: StartScheduleObject): Promise<void> {
    console.log('trying turn 1');
    await db.gameRepo.insertTurn([
      schedule.firstTurnDeadline,
      1,
      `Spring ${this.gameData.stylizedStartYear + 1}`,
      TurnType.SPRING_ORDERS,
      TurnStatus.PAUSED,
      this.gameData.gameName
    ])
    .then(async (result: QueryResult<any>) => {
      console.log('Turn 1 Added Successfully');
      return result.rows[0].turn_id;
    })
    .catch((error: Error) => {
      console.log('Turn 1 Error: ', error.message);
      this.errors.push('Turn 1 Error: ' + error.message);
      return 0;
    });
  }

  async addRulesInGame(pool: Pool): Promise<any> {
    const rulePromises: Promise<QueryResult<any>>[] = await db.gameRepo.insertRulesInGame(
      this.gameData.rules,
      this.gameData.gameName
    );

    return Promise.all(rulePromises)
      .then((rules: any) => true)
      .catch((error: Error) => {
        console.log('Rule Promises Error: ' + error.message);
        this.errors.push('Rule Promises Error: ' + error.message);
      });
  }

  async addCountries(pool: Pool): Promise<void> {
    const newCountryPromises: Promise<any>[] = await db.gameRepo.insertCountries(
      this.gameData.dbRows.countries,
      this.gameData.gameName
    );

    // console.log('newCountryPromises', newCountryPromises);

    return await Promise.all(newCountryPromises)
      .then(async (newCountryResolved) => {
        await this.addProvinces(pool);
        await this.addCountryInitialHistories(pool);
      })
      .catch((error: Error) => {
        console.log('New Country Promises Error: ' + error.message);
        this.errors.push('New Country Promises Error: ' + error.message);
      });
  }

  async addProvinces(pool: Pool): Promise<void> {
    const provincePromises: Promise<any>[] = await db.gameRepo.insertProvinces(
      this.gameData.dbRows.provinces,
      this.gameData.gameName
    );

    return await Promise.all(provincePromises)
      .then(async () => {
        console.log('Provinces Added');
        await this.addProvinceHistories(pool);
        await this.addTerrain(pool);
        await this.addLabels(pool);
        await this.addNodes(pool);
      });
  }

  async addProvinceHistories(pool: Pool): Promise<any> {
    const provinceHistoryPromises: Promise<any>[] = await db.gameRepo.insertProvinceHistories(
      this.gameData.dbRows.provinces,
      this.gameData.gameName
    );

    return await Promise.all(provinceHistoryPromises)
      .catch((error: Error) => {
        console.log('Province History Promises Error: ' + error.message);
        this.errors.push('Province History Promises Error: ' + error.message);
      })
  }

  async addTerrain(pool: Pool): Promise<any> {
    const terrainPromises: Promise<any>[] = await db.gameRepo.insertTerrain(
      this.gameData.dbRows.terrain,
      this.gameData.gameName
    );

    return await Promise.all(terrainPromises)
      .catch((error: Error) => {
        console.log('Terrain Promises Error: ' + error.message);
        this.errors.push('Terrain Promises Error: ' + error.message);
      })
  }

  async addLabels(pool: Pool): Promise<any> {
    db.gameRepo.insertLabels(this.gameData.dbRows.labels, this.gameData.gameName);
  }

  async addNodes(pool: Pool): Promise<any> {
    const nodePromises: Promise<any>[] = await db.gameRepo.insertNodes(
      this.gameData.dbRows.nodes,
      this.gameData.gameName
    );

    return await Promise.all(nodePromises).then(async (nodes: any) => {
      await this.addNodeAdjacencies(pool);
      await this.addUnits(pool);
    });
  }

  async addNodeAdjacencies(pool: Pool): Promise<any> {
    const nodeAdjacencyPromises: Promise<any>[] = await db.gameRepo.insertNodeAdjacencies(
      this.gameData.dbRows.links,
      this.gameData.gameName
    );

    return await Promise.all(nodeAdjacencyPromises)
      .catch((error: Error) => {
        console.log('Node Adjacies Error ' + error.message);
        this.errors.push('Node Adjacies Error ' + error.message);
      });
  }

  async addCountryInitialHistories(pool: Pool): Promise<any> {
    const countryHistoryPromises: Promise<any>[] = await db.gameRepo.insertCountryHistories(
      this.gameData.dbRows.countries,
      this.gameData.gameName
    );

    return await Promise.all(countryHistoryPromises)
      .catch((error: Error) => {
        console.log('Country History Promise Error: ' + error.message);
        this.errors.push('Country History Promise Error: ' + error.message);
      })
  }

  async addUnits(pool: Pool): Promise<any> {
    const unitPromises: Promise<any>[] = await db.gameRepo.insertUnits(
      this.gameData.dbRows.units,
      this.gameData.gameName
    );

    return await Promise.all(unitPromises).then(async (units: any) => {
      await this.addInitialUnitHistories(pool);
    });
  }

  async addInitialUnitHistories(pool: Pool): Promise<any> {
    const initialHistoryPromises: Promise<any>[] = await db.gameRepo.insertUnitHistories(
      this.gameData.dbRows.units,
      this.gameData.gameName
    );

    return await Promise.all(initialHistoryPromises)
      .catch((error: Error) => {
        console.log('Initial History Promise Error: ' + error.message);
        this.errors.push('Initial History Promise Error: ' + error.message);
      });
  }

  async checkGameNameAvailability(gameName: string): Promise<boolean> {
    const gameNameResults: QueryResult<any> = await db.gameRepo.checkGameNameAvailable(gameName);

    return gameNameResults.rowCount === 0;
  }

  async findGames(idToken: string): Promise<any> {
    const accountService: AccountService = new AccountService();
    const formattingService: FormattingService  = new FormattingService();
    const schedulerService: SchedulerService = new SchedulerService();
    let userId = 0;
    let userTimeZone = 'Africa/Monrovia';
    let meridiemTime = false;

    if (idToken) {
      // const token: DecodedIdToken = await accountService.validateToken(idToken);

      this.user = await accountService.getUserProfile(idToken);
      if (!this.user.error) {
        userId = this.user.userId;
        userTimeZone = this.user.timeZone;
        meridiemTime = this.user.meridiemTime;
      }
    }

    const gameResults: any = await db.gameRepo.getGames(userTimeZone, meridiemTime);

    return gameResults;
  }

  async getGameData(idToken: string, gameId: number): Promise<any> {
    const accountService: AccountService = new AccountService();
    const schedulerService: SchedulerService = new SchedulerService();
    const formattingService: FormattingService = new FormattingService();
    const pool: Pool = new Pool(victorCredentials);
    let userId = 0;
    let userTimeZone = 'Africa/Monrovia';
    let meridiemTime = false;

    if (idToken) {
      // const token: DecodedIdToken = await accountService.validateToken(idToken);

      this.user = await accountService.getUserProfile(idToken);
      if (!this.user.error) {
        userId = this.user.userId;
        userTimeZone = this.user.timeZone;
        meridiemTime = this.user.meridiemTime;
      }
    }

    const gameData: any = await db.gameRepo.getGameDetails(gameId, userId, userTimeZone, meridiemTime);
    const ruleData: any = await db.gameRepo.getRulesInGame(gameId);
    const playerRegistration: any = await db.gameRepo.getPlayerRegistrationStatus(gameId, userId);

    gameData.rules = ruleData;
    gameData.playerRegistration = playerRegistration;

    gameData.ordersTime = schedulerService.timeIdentity(gameData.ordersTime);
    return gameData;
  }

  async updateGameSettings(idToken: string, gameData: any): Promise<any> {
    console.log('triggering save');
    const accountService: AccountService = new AccountService();
    const schedulerService: SchedulerService = new SchedulerService();

    const token: DecodedIdToken = await accountService.validateToken(idToken);
    if (token.uid) {
      const pool: Pool = new Pool(victorCredentials);

      const isAdmin = await db.gameRepo.isGameAdmin(token.uid, gameData.gameId);
      if (isAdmin) {
        this.user = await accountService.getUserProfile(idToken);
        const events = schedulerService.extractEvents(gameData, this.user.timeZone);
        const schedule: StartScheduleObject = schedulerService.prepareStartSchedule(events);

        const gameSettings = [
          gameData.gameName,
          gameData.assignmentMethod,
          gameData.stylizedStartYear,
          gameData.turn1Timing,
          gameData.deadlineType,
          schedule.gameStart,
          gameData.observeDst,
          schedule.orders.day,
          schedule.orders.time,
          schedule.retreats.day,
          schedule.retreats.time,
          schedule.adjustments.day,
          schedule.adjustments.time,
          schedule.nominations.day,
          schedule.nominations.time,
          schedule.votes.day,
          schedule.votes.time,
          gameData.nmrTolerance,
          gameData.concurrentGamesLimit,
          gameData.privateGame,
          gameData.hiddenGame,
          gameData.blindCreator,
          gameData.finalReadinessCheck,
          gameData.voteDeadlineExtension,
          gameData.partialRosterStart,
          gameData.nominationTiming,
          gameData.nominationYear,
          gameData.automaticAssignments,
          gameData.ratingLimits,
          gameData.funRange[0],
          gameData.funRange[1],
          gameData.skillRange[0],
          gameData.skillRange[1],
          gameData.gameId
        ];
        const errors: string[] = [];

        // console.log('Internal Game Data:', gameData);
        await db.gameRepo.updateGameSettings(gameSettings)
          .then((result: any) => {
            return {
              success: true,
              message: 'Game Updated'
            }
          })
          .catch((error: Error) => {
            errors.push('Update Game Settings Error: ' + error.message);
            console.log('Update Game Settings Error: ' + error.message);
            return {
              success: false,
              errors: errors
            };
          });

      } else {
        return 'Not admin!';
      }
    }
  }

  /**
   * Top level route handler at the request of a game administrator.
   * Initializes a game into an actionable state.
   * Adds first turn, processes and saves unit options.
   * Sets time for game start and assignments reveal.
   * Sets time for first turn orders deadline.
   *
   * @param idToken
   * @param gameId
   */
  async declareReady(idToken: string, gameId: number): Promise<any> {
    const schedulerService: SchedulerService = new SchedulerService();

    const gameData = await this.getGameData(idToken, gameId);

    // TO-DO Restore to registration clause after troubleshooting && gameData.gameStatus === GameStatus.REGISTRATION
    if (gameData.isAdmin ) {
      await schedulerService.prepareGameStart(gameData);
    }
  }
}