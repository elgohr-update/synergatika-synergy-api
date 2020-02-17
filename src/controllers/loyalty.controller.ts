import * as express from 'express';
import to from 'await-to-ts'
var path = require('path');
// Eth
import { BlockchainService } from '../utils/blockchainService';
const serviceInstance = new BlockchainService(process.env.ETH_REMOTE_API, path.join(__dirname, process.env.ETH_CONTRACTS_PATH), process.env.ETH_API_ACCOUNT_PRIVKEY);

// Dtos
import IdentifierDto from '../loyaltyDtos/identifier.params.dto';
import EarnPointsDto from '../loyaltyDtos/earnPoints.dto';
import RedeemPointsDto from '../loyaltyDtos/redeemPoints.dto';
// Exceptions
import UnprocessableEntityException from '../exceptions/UnprocessableEntity.exception'
// Interfaces
import Controller from '../interfaces/controller.interface';
import RequestWithUser from '../interfaces/requestWithUser.interface';
import User from '../usersInterfaces/user.interface';
import LoyaltyTransaction from '../loyaltyInterfaces/transaction.interface';
// Middleware
import validationBodyMiddleware from '../middleware/body.validation';
import validationParamsMiddleware from '../middleware/params.validation';
import authMiddleware from '../middleware/auth.middleware';
import accessMiddleware from '../middleware/access.middleware';
import customerMiddleware from '../middleware/customer.middleware';
// Models
import userModel from '../models/user.model';
import transactionModel from '../models/loyalty.transaction.model';

class LoyaltyController implements Controller {
  public path = '/loyalty';
  public router = express.Router();
  private user = userModel;
  private transaction = transactionModel;

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(`${this.path}/earn`, authMiddleware, /*accessMiddleware.confirmPassword,*//*accessMiddleware.onlyAsMerchant,*/ validationBodyMiddleware(EarnPointsDto), customerMiddleware, this.earnTokens);
    this.router.post(`${this.path}/redeem`, authMiddleware, accessMiddleware.onlyAsMerchant, /*accessMiddleware.confirmPassword,*/ validationBodyMiddleware(RedeemPointsDto), customerMiddleware, this.redeemTokens);
    this.router.get(`${this.path}/balance`, authMiddleware, this.readBalance);
    this.router.get(`${this.path}/balance/:_to`, authMiddleware, accessMiddleware.onlyAsMerchant, validationParamsMiddleware(IdentifierDto), customerMiddleware, this.readBalanceByMerchant);
    this.router.get(`${this.path}/badge`, authMiddleware, this.readBadge);
    this.router.get(`${this.path}/badge/:_to`, authMiddleware, accessMiddleware.onlyAsMerchant, validationParamsMiddleware(IdentifierDto), customerMiddleware, this.readBadgeByMerchant);
    this.router.get(`${this.path}/transactions`, authMiddleware, this.readTransactions);

    this.router.get(`${this.path}/partners_info`, authMiddleware, this.partnersInfoLength);
    this.router.get(`${this.path}/transactions_info`, authMiddleware, this.transactionInfoLength);
  }

  private earnTokens = async (request: RequestWithUser, response: express.Response, next: express.NextFunction) => {
    const data: EarnPointsDto = request.body;
    data._amount = Math.round(data._amount);
    const _partner = '0x' + request.user.account.address; //(serviceInstance.unlockWallet(request.user.account, data.password)).address;
    const customer = response.locals.customer;

    await serviceInstance.getLoyaltyAppContract()
      .then((instance) => {
        return instance.earnPoints(this.amountToPoints(data._amount), customer.account.address, _partner, serviceInstance.address)
          .then(async (result: any) => {
            await this.transaction.create({
              ...result, type: "EarnPoints",
              from_id: request.user._id, to_id: customer._id,
              info: {
                from_name: request.user.name, from_email: request.user.email,
                to_email: customer.email, points: this.amountToPoints(data._amount)
              }
            });
            response.status(201).send({
              data: result,
              code: 201
            });
          })
          .catch((error: Error) => {
            next(new UnprocessableEntityException("Error: " + error.toString() + "/n" + customer + "/n" + request.user))
          })
      })
      .catch((error) => {
        next(new UnprocessableEntityException("Error: " + error.toString() + "/n" + customer + "/n" + request.user))
      })
  }

  private redeemTokens = async (request: RequestWithUser, response: express.Response, next: express.NextFunction) => {
    const data: RedeemPointsDto = request.body;
    data._points = Math.round(data._points);
    const _partner = '0x' + request.user.account.address; //(serviceInstance.unlockWallet(request.user.account, data.password)).address;
    const customer = response.locals.customer;

    await serviceInstance.getLoyaltyAppContract()
      .then((instance) => {
        return instance.usePoints(data._points, customer.account.address, _partner, serviceInstance.address)
          .then(async (result: any) => {
            await this.transaction.create({
              ...result, type: "RedeemPoints",
              from_id: request.user._id, to_id: customer._id,
              info: {
                from_name: request.user.name, from_email: request.user.email,
                to_email: customer.email, points: data._points, offer_id: data.offer_id
              }
            });
            response.status(201).send({
              data: result,
              code: 201
            });
          })
          .catch((error: Error) => {
            next(new UnprocessableEntityException('Blockchain Error'))
          })
      })
      .catch((error) => {
        next(new UnprocessableEntityException('Blockchain Error'))
      });
  }

  private readBalance = async (request: RequestWithUser, response: express.Response, next: express.NextFunction) => {
    const _member = request.user.account.address;

    await serviceInstance.getLoyaltyAppContract()
      .then((instance) => {
        return instance.members(_member)
          .then((results: any) => {
            response.status(200).send({
              data: {
                address: results.address,
                points: results.points
              },
              code: 200
            });
          })
          .catch((error: Error) => {
            next(new UnprocessableEntityException('Blockchain Error'))
          })
      })
      .catch((error) => {
        next(new UnprocessableEntityException('Blockchain Error'))
      })
  }

  private readBalanceByMerchant = async (request: RequestWithUser, response: express.Response, next: express.NextFunction) => {
    const customer: User = response.locals.customer;

    await serviceInstance.getLoyaltyAppContract()
      .then((instance) => {
        return instance.members(customer.account.address)
          .then((results: any) => {
            response.status(200).send({
              data: {
                address: results.address,
                points: results.points
              },
              code: 200
            });
          })
          .catch((error: Error) => {
            next(new UnprocessableEntityException('Blockchain Error'))
          })
      })
      .catch((error) => {
        next(new UnprocessableEntityException('Blockchain Error'))
      })
  }

  private readBadge = async (request: RequestWithUser, response: express.Response, next: express.NextFunction) => {
    const _member = request.user.account.address;

    await serviceInstance.getLoyaltyAppContract()
      .then((instance) => {
        return instance.getLoyaltyScore(_member)
          .then((results: any) => {
            response.status(200).send({
              data: {
                address: _member,
                points: results
              },
              code: 200
            });
          })
          .catch((error: Error) => {
            next(new UnprocessableEntityException('Blockchain Error'))
          })
      })
      .catch((error) => {
        next(new UnprocessableEntityException('Blockchain Error'))
      })
  }

  private readBadgeByMerchant = async (request: RequestWithUser, response: express.Response, next: express.NextFunction) => {
    const customer: User = response.locals.customer;

    await serviceInstance.getLoyaltyAppContract()
      .then((instance) => {
        return instance.getLoyaltyScore(customer.account.address)
          .then((results: any) => {
            response.status(200).send({
              data: {
                address: customer.account.address,
                points: results
              },
              code: 200
            });
          })
          .catch((error: Error) => {
            next(new UnprocessableEntityException('Blockchain Error'))
          })
      })
      .catch((error) => {
        next(new UnprocessableEntityException('Blockchain Error'))
      })
  }

  private readTransactions = async (request: RequestWithUser, response: express.Response, next: express.NextFunction) => {

    let error: Error, transactions: LoyaltyTransaction[];
    [error, transactions] = await to(this.transaction.find({
      $and: [
        { $or: [{ to_id: request.user._id }, { from_id: request.user._id }] },
        { $or: [{ type: "EarnPoints" }, { type: "RedeemPoints" }] }
      ]
    }).select({
      "_id": 1, "type": 1,
      "from_id": 1, "to_id": 1,
      "info": 1, "tx": 1,
      "createdAt": 1
    }).sort('-createdAt').catch());
    if (error) next(new UnprocessableEntityException('DB ERROR'));
    response.status(200).send({
      data: transactions,
      code: 200
    });
  }

  private partnersInfoLength = async (request: RequestWithUser, response: express.Response, next: express.NextFunction) => {
    await serviceInstance.getLoyaltyAppContract()
      .then((instance) => {
        return instance.partnersInfoLength()
          .then((results: any) => {
            response.status(200).send({
              data: results,
              code: 200
            });
          })
          .catch((error: Error) => {
            next(new UnprocessableEntityException('Blockchain Error'))
          })
      })
      .catch((error) => {
        next(new UnprocessableEntityException('Blockchain Error'))
      })
  }

  private transactionInfoLength = async (request: RequestWithUser, response: express.Response, next: express.NextFunction) => {
    await serviceInstance.getLoyaltyAppContract()
      .then((instance) => {
        return instance.transactionsInfoLength()
          .then((results: any) => {
            response.status(200).send({
              data: results,
              code: 200
            });
          })
          .catch((error: Error) => {
            next(new UnprocessableEntityException('Blockchain Error'))
          })
      })
      .catch((error) => {
        next(new UnprocessableEntityException('Blockchain Error'))
      })
  }

  private amountToPoints(_amount: number): number {
    const _points: number = _amount;
    return _points;
  }
}

export default LoyaltyController;
