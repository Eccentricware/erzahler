import express from "express";
import { db } from "../../database/connection";
import { SavedOption } from "../../models/objects/option-context-objects";
import { OptionsFinal } from "../../models/objects/options-objects";
import { TurnOrders } from "../../models/objects/order-objects";
import { AccountService } from "../services/accountService";
import { AssignmentService } from "../services/assignmentService";
import { OrdersService } from "../services/orders-service";

export const ordersRouter = express.Router();
const ordersService = new OrdersService();

ordersRouter.get(`/:gameId/options`, (request, response) => {
  const idToken = <string>request.headers.idtoken;
  const gameId = Number(request.params.gameId);

  ordersService.getTurnOptions(idToken, gameId)
    .then((options: OptionsFinal | string) => {
      response.send(options);
    });
});

ordersRouter.get(`/:gameId/orders`, (request, response) => {
  const idToken = <string>request.headers.idtoken;
  const gameId = Number(request.params.gameId);

  ordersService.getTurnOrders(idToken, gameId)
    .then((orders: TurnOrders) => {
      response.send(orders);
    });
});

ordersRouter.post(`/submit`, (request, response) => {
  const idToken = <string>request.headers.idtoken;
  const orders = request.body.orders;
  console.log(orders);


  response.send({sucess: true});
});