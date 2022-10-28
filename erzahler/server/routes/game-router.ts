import express from "express";
import { GameService } from "../services/gameService";

export const gameRouter = express.Router();
const gameService = new GameService();

gameRouter.get('/check-name/:gameName', (request, response) => {
  const { gameName } = request.params;
  gameService.checkGameNameAvailability(gameName)
    .then((gameNameAvailable: boolean) => {
      response.send(gameNameAvailable);
    })
    .catch((error: Error) => response.send('Game availability check error: ' + error.message))
});

gameRouter.get('/search', (request, response) => {
  const idToken: any = request.headers.idtoken;

  gameService.findGames(idToken)
    .then((result: any) => {
      response.send(result);
    })
    .catch((error: Error) => {
      response.send('Game find error: ' + error.message);
    });
});

gameRouter.get('/details/:gameId', (request, response) => {
  const idToken: any = request.headers.idtoken;
  const gameId: number = Number(request.params.gameId);

  gameService.getGameData(idToken, gameId)
    .then((result: any) => {
      response.send(result);
    })
    .catch((error: Error) => {
      console
      response.send('Get game data error: ' + error.message);
    });
});

gameRouter.post('/create', (request, response) => {
  gameService.newGame(request.body.gameData, <string>request.body.idToken)
    .then((result: any) => {
      response.send(result);
    })
    .catch((error: Error) => {
      response.send({error: error.message});
    });
});

gameRouter.put('/update', (request, response) => {
  const idToken = <string>request.headers.idtoken;
  const gameData = request.body.gameData;

  gameService.updateGameSettings(idToken, gameData)
    .then((result: any) => {
      response.send(result);
    })
    .catch((error: Error) => {
      response.send({error: error.message});
    });
});