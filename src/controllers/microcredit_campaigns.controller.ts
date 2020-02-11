import * as express from 'express';
import to from 'await-to-ts';
import { ObjectId } from 'mongodb';

// Dtos
import CampaignDto from '../microcreditDtos/campaign.dto'
import MerchantID from '../usersDtos/merchant_id.params.dto'
import CampaignID from '../microcreditDtos/campaign_id.params.dto'
// Exceptions
import UnprocessableEntityException from '../exceptions/UnprocessableEntity.exception';
// Interfaces
import Controller from '../interfaces/controller.interface';
import RequestWithUser from '../interfaces/requestWithUser.interface';
import User from '../usersInterfaces/user.interface';
import Campaign from '../microcreditInterfaces/campaign.interface';
// Middleware
import validationBodyMiddleware from '../middleware/body.validation';
import validationParamsMiddleware from '../middleware/params.validation';
import validationBodyAndFileMiddleware from '../middleware/body_file.validation';
import authMiddleware from '../middleware/auth.middleware';
import accessMiddleware from '../middleware/access.middleware';
// Models
import userModel from '../models/user.model';

//Path
var path = require('path');

// Upload File
import multer from 'multer';
var storage = multer.diskStorage({
  destination: function(req: RequestWithUser, file, cb) {
    cb(null, path.join(__dirname, '../assets/items'));
  },
  filename: function(req: RequestWithUser, file, cb) {

    cb(null, (req.user._id).toString() + '_' + new Date().getTime());
  }
});
var upload = multer({ storage: storage });

// Remove File
const fs = require('fs')
const { promisify } = require('util')
const unlinkAsync = promisify(fs.unlink);

class MicrocreditCampaignsController implements Controller {
  public path = '/microcredit/campaigns';
  public router = express.Router();
  private user = userModel;

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/public`, this.readPublicCampaigns);
    this.router.get(`${this.path}/private`, authMiddleware, this.readPrivateCampaigns);
    this.router.post(`${this.path}/`, authMiddleware, accessMiddleware.onlyAsMerchant, upload.single('imageURL'), validationBodyAndFileMiddleware(CampaignDto), this.createCampaign);
    this.router.get(`${this.path}/public/:merchant_id`, validationParamsMiddleware(MerchantID), this.readPublicCampaignsByStore);
    this.router.get(`${this.path}/private/:merchant_id`, authMiddleware, validationParamsMiddleware(MerchantID), this.readPrivateCampaignsByStore);
    this.router.get(`${this.path}/:merchant_id/:campaign_id`, authMiddleware, accessMiddleware.onlyAsMerchant, validationParamsMiddleware(CampaignID), accessMiddleware.belongsTo, this.readCampaign);
    this.router.put(`${this.path}/:merchant_id/:campaign_id`, authMiddleware, accessMiddleware.onlyAsMerchant, validationParamsMiddleware(CampaignID), accessMiddleware.belongsTo, upload.single('imageURL'), validationBodyAndFileMiddleware(CampaignDto), this.updateCampaign);
    this.router.delete(`${this.path}/:merchant_id/:campaign_id`, authMiddleware, accessMiddleware.onlyAsMerchant, validationParamsMiddleware(CampaignID), accessMiddleware.belongsTo, this.deleteCampaign);
  }

  private readPrivateCampaigns = async (request: RequestWithUser, response: express.Response, next: express.NextFunction) => {
    const access = (request.user.access === 'merchant') ? 'partners' : 'random';

    let error: Error, campaigns: Campaign[];
    [error, campaigns] = await to(this.user.aggregate([{
      $unwind: '$microcredit'
    }, {
      $match: {
        'microcredit.access': { $in: ['public', 'private'] }
      }
    }, {
      $project: {
        _id: false,
        merchant_id: '$_id',
        merchant_name: '$name',
        merchant_imageURL: '$imageURL',

        campaign_id: '$microcredit._id',
        campaign_imageURL: '$microcredit.imageURL',
        title: '$microcredit.title',
        terms: '$microcredit.title',
        description: '$microcredit.title',
        category: '$microcredit.category',
        access: '$microcredit.access',

        quantitative: '$microcredit.quantitative',
        minAllowed: '$microcredit.minAllowed',
        maxAllowed: '$microcredit.maxAllowed',
        maxAmount: '$microcredit.maxAmount',

        redeemStarts: '$microcredit.redeemStarts',
        redeemEnds: '$microcredit.redeemEnds',
        expiresAt: '$microcredit.expiresAt',

        createdAt: '$microcredit.createdAt'
      }
    }, {
      $sort: {
        createdAt: -1
      }
    }
    ]).exec().catch());
    if (error) next(new UnprocessableEntityException('DB ERROR'));
    response.status(200).send({
      data: campaigns,
      code: 200
    });
  }

  private readPublicCampaigns = async (request: express.Request, response: express.Response, next: express.NextFunction) => {

    let error: Error, campaigns: Campaign[];
    [error, campaigns] = await to(this.user.aggregate([{
      $unwind: '$microcredit'
    }, {
      $match: {
        'microcredit.access': 'public'
      }
    }, {
      $project: {
        _id: false,
        merchant_id: '$_id',
        merchant_name: '$name',
        merchant_imageURL: '$imageURL',

        campaign_id: '$microcredit._id',
        campaign_imageURL: '$microcredit.imageURL',
        title: '$microcredit.title',
        terms: '$microcredit.title',
        description: '$microcredit.title',
        category: '$microcredit.category',
        access: '$microcredit.access',

        quantitative: '$microcredit.quantitative',
        minAllowed: '$microcredit.minAllowed',
        maxAllowed: '$microcredit.maxAllowed',
        maxAmount: '$microcredit.maxAmount',

        redeemStarts: '$microcredit.redeemStarts',
        redeemEnds: '$microcredit.redeemEnds',
        expiresAt: '$microcredit.expiresAt',

        createdAt: '$microcredit.createdAt'
      }
    }, {
      $sort: {
        createdAt: -1
      }
    }
    ]).exec().catch());
    if (error) next(new UnprocessableEntityException('DB ERROR'));
    response.status(200).send({
      data: campaigns,
      code: 200
    });
  }

  private createCampaign = async (request: RequestWithUser, response: express.Response, next: express.NextFunction) => {
    const data: CampaignDto = request.body;
    const user: User = request.user;
    let error: Error, results: Object; // {"n": 1, "nModified": 1, "ok": 1}
    [error, results] = await to(this.user.updateOne({
      _id: user._id
    }, {
        $push: {
          microcredit: {
            "imageURL": (request.file) ? `${process.env.API_URL}assets/items/${request.file.filename}` : '',
            "title": data.title,
            "terms": data.terms,
            "access": data.access,
            "description": data.description,
            "category": data.category,
            "quantitative": data.quantitative,
            "minAllowed": data.minAllowed,
            "maxAllowed": data.maxAllowed,
            "maxAmount": data.maxAmount,
            "redeemStarts": data.redeemStarts,
            "redeemEnds": data.redeemEnds,
            "expiresAt": data.expiresAt,
          }
        }
      }).catch());
    if (error) next(new UnprocessableEntityException('DB ERROR'));
    response.status(201).send({
      message: "Success! A new Microcredit Campaign has been created!",
      code: 201
    });
  }

  private readPrivateCampaignsByStore = async (request: RequestWithUser, response: express.Response, next: express.NextFunction) => {
    const merchant_id: MerchantID["merchant_id"] = request.params.merchant_id;
    const access = (request.user.access === 'merchant') ? 'partners' : 'random';

    let error: Error, campaigns: Campaign[];
    [error, campaigns] = await to(this.user.aggregate([{
      $unwind: '$microcredit'
    }, {
      $match: {
        $and: [
          { _id: new ObjectId(merchant_id) },
          { 'microcredit.access': { $in: ['public', 'private', access] } }
        ]
      }
    }, {
      $project: {
        _id: false,
        merchant_id: '$_id',
        merchant_name: '$name',
        merchant_imageURL: '$imageURL',

        campaign_id: '$microcredit._id',
        campaign_imageURL: '$microcredit.imageURL',
        title: '$microcredit.title',
        terms: '$microcredit.title',
        description: '$microcredit.title',
        category: '$microcredit.category',
        access: '$microcredit.access',

        quantitative: '$microcredit.quantitative',
        minAllowed: '$microcredit.minAllowed',
        maxAllowed: '$microcredit.maxAllowed',
        maxAmount: '$microcredit.maxAmount',

        redeemStarts: '$microcredit.redeemStarts',
        redeemEnds: '$microcredit.redeemEnds',
        expiresAt: '$microcredit.expiresAt',

        createdAt: '$microcredit.createdAt'
      }
    }, {
      $sort: {
        createdAt: -1
      }
    }
    ]).exec().catch());
    if (error) next(new UnprocessableEntityException('DB ERROR'));
    response.status(200).send({
      data: campaigns,
      code: 200
    });
  }

  private readPublicCampaignsByStore = async (request: express.Request, response: express.Response, next: express.NextFunction) => {
    const merchant_id: MerchantID["merchant_id"] = request.params.merchant_id;

    let error: Error, campaigns: Campaign[];
    [error, campaigns] = await to(this.user.aggregate([{
      $unwind: '$microcredit'
    }, {
      $match: {
        $and: [
          { _id: new ObjectId(merchant_id) },
          { 'microcredit.access': 'public' }
        ]
      }
    }, {
      $project: {
        _id: false,
        merchant_name: '$name',
        merchant_id: '$_id',
        merchant_imageURL: '$imageURL',

        campaign_id: '$microcredit._id',
        campaign_imageURL: '$microcredit.imageURL',
        title: '$microcredit.title',
        terms: '$microcredit.title',
        description: '$microcredit.title',
        category: '$microcredit.category',
        access: '$microcredit.access',

        quantitative: '$microcredit.quantitative',
        minAllowed: '$microcredit.minAllowed',
        maxAllowed: '$microcredit.maxAllowed',
        maxAmount: '$microcredit.maxAmount',

        redeemStarts: '$microcredit.redeemStarts',
        redeemEnds: '$microcredit.redeemEnds',
        expiresAt: '$microcredit.expiresAt',

        createdAt: '$microcredit.createdAt'
      }
    }, {
      $sort: {
        createdAt: -1
      }
    }
    ]).exec().catch());
    if (error) next(new UnprocessableEntityException('DB ERROR'));
    response.status(200).send({
      data: campaigns,
      code: 200
    });
  }

  private updateCampaign = async (request: RequestWithUser, response: express.Response, next: express.NextFunction) => {
    const merchant_id: CampaignID["merchant_id"] = request.params.merchant_id;
    const campaign_id: CampaignID["campaign_id"] = request.params.campaign_id;
    const data: CampaignDto = request.body;

    const previousImage: Campaign[] = await (this.user.aggregate([{
      $unwind: '$microcredit'
    }, {
      $match:
      {
        $and: [{
          _id: new ObjectId(merchant_id)
        }, {
          'microcredit._id': new ObjectId(campaign_id)
        }]
      }
    }, {
      $project: {
        _id: false,
        campaign_imageURL: '$microcredit.imageURL',
      }
    }]));

    if (previousImage[0].campaign_imageURL && request.file) {
      var imageFile = (previousImage[0].campaign_imageURL).split('assets/items/');
      await unlinkAsync(path.join(__dirname, '../assets/items/' + imageFile[1]));
    }

    let error: Error, results: Object; // results = {"n": 1, "nModified": 1, "ok": 1}
    [error, results] = await to(this.user.updateOne(
      {
        _id: merchant_id,
        'microcredit._id': campaign_id
      }, {
        '$set': {
          'microcredit.$._id': campaign_id,
          'microcredit.$.imageURL': (request.file) ? `${process.env.API_URL}assets/items/${request.file.filename}` : previousImage[0].campaign_imageURL,
          'microcredit.$.title': data.title,
          'microcredit.$.terms': data.terms,
          'microcredit.$.access': data.access,
          'microcredit.$.description': data.description,
          'microcredit.$.category': data.category,
          'microcredit.$.quantitative': data.quantitative,
          'microcredit.$.minAllowed': data.minAllowed,
          'microcredit.$.maxAllowed': data.maxAllowed,
          'microcredit.$.maxAmount': data.maxAmount,
          'microcredit.$.redeemStarts': data.redeemStarts,
          'microcredit.$.redeemEnds': data.redeemEnds,
          'microcredit.$.expiresAt': data.expiresAt,
        }
      }).catch());

    if (error) next(new UnprocessableEntityException('DB ERROR'));
    response.status(200).send({
      message: "Success! Campaign " + campaign_id + " has been updated!",
      code: 200
    });
  }

  private deleteCampaign = async (request: RequestWithUser, response: express.Response, next: express.NextFunction) => {
    const merchant_id: CampaignID["merchant_id"] = request.params.merchant_id;
    const campaign_id: CampaignID["campaign_id"] = request.params.campaign_id;

    const previousImage: Campaign[] = await (this.user.aggregate([{
      $unwind: '$microcredit'
    }, {
      $match:
      {
        $and: [{
          _id: new ObjectId(merchant_id)
        }, {
          'microcredit._id': new ObjectId(campaign_id)
        }]
      }
    }, {
      $project: {
        _id: false,
        campaign_imageURL: '$microcredit.imageURL',
      }
    }]));

    if (previousImage[0].campaign_imageURL) {
      var imageFile = (previousImage[0].campaign_imageURL).split('assets/items/');
      await unlinkAsync(path.join(__dirname, '../assets/items/' + imageFile[1]));
    }

    let error: Error, results: Object; // results = {"n": 1, "nModified": 1, "ok": 1}
    [error, results] = await to(this.user.updateOne({
      _id: merchant_id
    }, {
        $pull: {
          microcredit: {
            _id: campaign_id
          }
        }
      }).catch());
    if (error) next(new UnprocessableEntityException('DB ERROR'));
    response.status(200).send({
      message: "Success! Campaign " + campaign_id + " has been deleted!",
      code: 200
    });
  }

  private readCampaign = async (request: RequestWithUser, response: express.Response, next: express.NextFunction) => {
    const merchant_id: CampaignID["merchant_id"] = request.params.merchant_id;
    const campaign_id: CampaignID["campaign_id"] = request.params.campaign_id;

    let error: Error, campaigns: Campaign[];

    [error, campaigns] = await to(this.user.aggregate([{
      $unwind: '$microcredit'
    }, {
      $match:
      {
        $and: [{
          _id: new ObjectId(merchant_id)
        }, {
          'microcredit._id': new ObjectId(campaign_id)
        }]
      }
    }, {
      $project: {
        _id: false,
        merchant_name: '$name',
        merchant_id: '$_id',
        merchant_imageURL: '$imageURL',

        campaign_id: '$microcredit._id',
        campaign_imageURL: '$microcredit.imageURL',
        title: '$microcredit.title',
        terms: '$microcredit.title',
        description: '$microcredit.title',
        category: '$microcredit.category',
        access: '$microcredit.access',

        quantitative: '$microcredit.quantitative',
        minAllowed: '$microcredit.minAllowed',
        maxAllowed: '$microcredit.maxAllowed',
        maxAmount: '$microcredit.maxAmount',

        redeemStarts: '$microcredit.redeemStarts',
        redeemEnds: '$microcredit.redeemEnds',
        expiresAt: '$microcredit.expiresAt',

        supports: '$microcredit.supports',
        createdAt: '$microcredit.createdAt'
      }
    }]).exec().catch());

    if (error) next(new UnprocessableEntityException('DB ERROR'));
    response.status(200).send({
      data: campaigns[0],
      code: 200
    });
  }

  private readCampaignTotal = async (request: RequestWithUser, response: express.Response, next: express.NextFunction) => {
    const merchant_id: CampaignID["merchant_id"] = request.params.merchant_id;
    const campaign_id: CampaignID["campaign_id"] = request.params.campaign_id;

    let error: Error, campaigns: Campaign[];

    [error, campaigns] = await to(this.user.aggregate([{
      $unwind: '$microcredit'
    }, {
      $unwind: '$microcredit.supports'
    }, {
      $match: {
        $and: [{
          _id: new ObjectId(merchant_id)
        }, {
          'microcredit._id': new ObjectId(campaign_id)
        }, {
          'microcredit.supports.status': 'confirmation'
        }]
      }
    }, {
      "$group": {
        "_id": null,
        "initialTokens": { "$sum": "$microcredit.supports.initialTokens" },
        "redeemedTokens": { "$sum": "$microcredit.supports.redeemedTokens" }
      }
    }]).exec().catch());

    if (error) next(new UnprocessableEntityException('DB ERROR'));
    response.status(200).send({
      data: campaigns,
      code: 200
    });
  }
}

export default MicrocreditCampaignsController;
