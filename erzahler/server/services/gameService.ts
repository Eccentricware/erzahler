import { error } from "console";
import { DecodedIdToken } from "firebase-admin/auth";
import { Pool } from "pg";
import { insertAssignmentQuery } from "../../database/queries/game/insert-assignment-query";
import { insertBridgeQuery } from "../../database/queries/game/insert-bridge-query";
import { insertCountryHistoryQuery } from "../../database/queries/game/insert-country-history-query";
import { insertCountryQuery } from "../../database/queries/game/insert-country-query";
import { insertNewGameQuery } from "../../database/queries/game/insert-game-query";
import { insertLabelQuery } from "../../database/queries/game/insert-label-query";
import { insertNodeAdjacencyQuery } from "../../database/queries/game/insert-node-adjacency-query";
import { insertNodeQuery } from "../../database/queries/game/insert-node-query";
import { insertProvinceHistoryQuery } from "../../database/queries/game/insert-province-history-query";
import { insertProvinceQuery } from "../../database/queries/game/insert-province-query";
import { insertRuleInGameQuery } from "../../database/queries/game/insert-rule-in-game-query";
import { insertTerrainQuery } from "../../database/queries/game/insert-terrain-query";
import { insertTurnQuery } from "../../database/queries/game/insert-turn-query";
import { insertUnitHistoryQuery } from "../../database/queries/game/insert-unit-history-query";
import { insertUnitQuery } from "../../database/queries/game/insert-unit-query";
import { victorCredentials } from "../../secrets/dbCredentials";
import { AccountService } from "./accountService";

export class GameService {

  async newGame(gameData: any, idToken: string): Promise<any> {
    const accountService: AccountService = new AccountService();

    const token: DecodedIdToken = await accountService.validateToken(idToken);
    if (token.uid) {
      const user: any = await accountService.getUserProfile(idToken);
      const pool: Pool = new Pool(victorCredentials);
      console.log('Game Data:', gameData);

      const newGameId: number = await this.addNewGame(pool, gameData);
      const newTurnId: number = await this.addInitialTurns(pool, gameData, newGameId);

      await this.addCreatorAssignment(pool, newGameId, user.user_id);
      await this.addRulesInGame(pool, gameData, newGameId);
      await this.addCountries(pool, gameData, newGameId);
      await this.addProvinces(pool, gameData, newGameId);
      const newProvinceId: number = 0;
      await this.addProvinceHistories(pool, gameData, newTurnId);
      await this.addTerrain(pool, gameData, newProvinceId);
      await this.addBridges(pool, gameData);
      await this.addLabels(pool, gameData);
      await this.addNodes(pool, gameData);
      await this.addNodeAdjacencies(pool, gameData);
      await this.addCountryInitialHistory(pool, gameData, 0);
      await this.addUnits(pool, gameData);
      await this.addUnitInitialHistory(pool, gameData, newTurnId);
    } else {
      console.log('Invalid Token UID');
    }
  }

  async addNewGame(pool: Pool, settings: any): Promise<number> {
    const settingsArray: any = [
      settings.gameName,
      settings.assignmentMethod,
      settings.stylizedStartYear,
      settings.turn1Timing,
      settings.deadlineType,
      settings.gameStart,
      settings.timeZone,
      settings.observeDst,
      settings.ordersDay,
      settings.ordersTime,
      settings.retreatsDay,
      settings.retreatsTime,
      settings.adjustmentsDay,
      settings.adjustmentsTime,
      settings.nominationsDay,
      settings.nominationsTime,
      settings.votesDay,
      settings.votesTime,
      settings.nmrTolerance,
      settings.concurrentGamesLimit,
      settings.privateGame,
      settings.hiddenGame,
      settings.blindCreator,
      settings.finalReadinessCheck
    ];

    const result: any = await pool.query({
      text: insertNewGameQuery,
      values: settingsArray
    })
    .then((results: any) => {
      return results;
    })
    .catch((error: Error) => {
      console.log('New game Error:', error.message);
      return 0;
    });

    console.log(result.rows[0].game_id);
    return result.rows[0].game_id;
  }

  async addCreatorAssignment(pool: Pool, gameId: number, userId: number): Promise<void> {
    console.log(`New assignment Entry: gameId (${gameId}), userId (${userId})`);
    pool.query(insertAssignmentQuery, [
      userId,
      gameId,
      'creator'
    ])
    .then((result: any) => {
      console.log('New Assignment', result)
    })
    .catch((error: Error) => {
      console.log('New Assignment Error:', error.message);
    });
  }

  async addInitialTurns(pool: Pool, settings: any, gameId: number): Promise<number> {
    return pool.query(insertTurnQuery, [
      settings.deadline,
      1,
      'Spring 2001',
      'orders',
      'active'
    ])
    .then((result: any) => {
      return result.rows[0].turn_id;
    })
    .catch((error: Error) => {
      return 0;
    });
  }

  async addRulesInGame(pool: Pool, settings: any, gameId: number): Promise<any> {
    settings.rules.forEach(async (rule: any) => {
      const ruleId: number = await this.getRuleId(rule.name);
      pool.query(insertRuleInGameQuery, [
        ruleId,
        gameId,
        rule.ruleEnabled
      ]);
    });
  }

  async getRuleId(name: string): Promise<number> {
    return 13;
  }

  async addCountries(pool: Pool, gameData: any, gameId: number): Promise<any> {
    gameData.countries.forEach(async (country: any) => {
      pool.query(insertCountryQuery, [
        gameId,
        country.name,
        country.rank,
        country.color,
        country.flagKey
      ]);
    })
  }

  async addProvinces(pool: Pool, settings: any, gameId: number): Promise<any> {
    settings.provinces.forEach(async (province: any) => {
      pool.query(insertProvinceQuery, [
        gameId,
        province.name,
        province.fullName,
        province.type,
        province.voteType
      ]);
    });
  }

  async addProvinceHistories(pool: Pool, gameData: any, turnId: number): Promise<any> {
    gameData.provinces.forEach(async (province: any) => {
      pool.query(insertProvinceHistoryQuery, [
        province.province_id,
        turnId,
        province.controller_id,
        province.status,
        province.vote_color,
        province.status_color
      ]);
    });
  }

  async addTerrain(pool: Pool, gameData: any, newProvinceId: number): Promise<any> {
    gameData.provinces.terrain.forEach(async (terrain: any) => {
      pool.query(insertTerrainQuery, [
        newProvinceId,
        terrain.renderCategory,
        terrain.points,
        terrain.topBound,
        terrain.leftBound,
        terrain.rightBound,
        terrain.bottomBound
      ]);
    });
  }

  async addBridges(pool: Pool,  gameData: any): Promise<any>{
    gameData.bridges.forEach(async (bridge: any) => {
      pool.query(insertBridgeQuery, [
        bridge.province1,
        bridge.province2,
        bridge.points
      ]);
    });
  }

  async addLabels(pool: Pool, gameData: any): Promise<any> {
    gameData.labels.forEach(async (label: any) => {
      pool.query(insertLabelQuery, [
        label.provinceId,
        label.loc,
        label.labelText
      ]);
    });
  }

  async addNodes(pool: Pool, gameData: any): Promise<any> {
    gameData.provinces.nodes.forEach(async (node: any) => {
      pool.query(insertNodeQuery, [
        node.province_id,
        node.node_type,
        node.loc
      ]);
    });
  }

  async addNodeAdjacencies(pool: Pool, gameData: any): Promise<any> {
    gameData.nodeAdjacencies.forEach(async (link: any) => {
      pool.query(insertNodeAdjacencyQuery, [
        link.node1,
        link.node2
      ]);
    });
  }

  async addCountryInitialHistory(pool: Pool, gameData: any, newTurnId: number): Promise<any> {
    gameData.nodeAdjacencies.forEach(async (country: any) => {
      pool.query(insertCountryHistoryQuery, [
        country.country_id,
        newTurnId,
        country.status,
        country.city_count,
        country.unit_count,
        country.banked_builds,
        country.nuked_range,
        country.adjustments
      ]);
    });
  }

  async addUnits(pool: Pool, gameData: any): Promise<any> {
    gameData.units.forEach(async (unit: any) => {
      pool.query(insertUnitQuery, [
        unit.country,
        unit.type
      ]);
    });
  }

  async addUnitInitialHistory(pool: Pool, gameData: any, turnId: number): Promise<any> {
    gameData.units.forEach(async (unit: any) => {
      pool.query(insertUnitHistoryQuery, [
        unit.id,
        turnId,
        unit.node,
        'active'
      ]);
    });
  }
}