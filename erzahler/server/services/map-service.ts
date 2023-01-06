import { db } from "../../database/connection";
import { RenderCategory } from "../../models/enumeration/render-category-enum";
import { City, Terrain } from "../../models/objects/map-objects";

export class MapService {
  async getCurrentMap(gameId: number): Promise<any> {
    const gameState = await db.gameRepo.getGameState(gameId);

    const terrain = await db.mapRepo.getTerrain(gameId, 61);

    const seaTerrain = terrain.filter((terrain: Terrain) => terrain.renderCategory === RenderCategory.SEA);
    const landTerrain = terrain.filter((terrain: Terrain) => terrain.renderCategory === RenderCategory.LAND);
    const canalTerrain = terrain.filter((terrain: Terrain) => terrain.renderCategory === RenderCategory.CANAL);
    const lineTerrain = terrain.filter((terrain: Terrain) => terrain.renderCategory === RenderCategory.LINE);

    const cities = await db.mapRepo.getCities(gameId, 61);

    const supplyCenters = cities.filter((city: City) => city.voteColor === null)
    const votingCenters = cities.filter((city: City) => city.voteColor !== null)

    return {
      terrain: {
        sea: seaTerrain,
        land: landTerrain,
        canal: canalTerrain,
        line: lineTerrain,
      },
      cities: {
        supplyCenters: supplyCenters,
        votingCenters: votingCenters
      },
      units: [],
      labels: [],
      labelLines: []
    };
  }
}