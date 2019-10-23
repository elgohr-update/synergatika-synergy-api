import { NextFunction, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import UnauthorizedException from '../exceptions/Unauthorized.exception';
import DataStoredInToken from '../authInterfaces/dataStoredInToken';
import RequestWithUser from '../interfaces/requestWithUser.interface';
import userModel from '../models/user.model';

async function authMiddleware(request: RequestWithUser, response: Response, next: NextFunction) {
  const token = request.headers;
  if (token && token.authorization) {
    const secret = process.env.JWT_SECRET;
    try {
      const verificationResponse = jwt.verify((token.authorization).replace('Bearer ', ''), secret) as DataStoredInToken;
      const id = verificationResponse._id;
      const user = await userModel.findById(id);
      if (user) {
        request.user = user;
        next();
      } else {
        next(new UnauthorizedException("Authorization Required."));
      }
    } catch (error) {
      next(new UnauthorizedException("Authorization Required."));
    }
  } else {
    next(new UnauthorizedException("Authorization Required."));
  }
}

export default authMiddleware;