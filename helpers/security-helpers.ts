import jwt from "jsonwebtoken";
import { keys } from "../config";
import bcrypt from "bcryptjs";
import express from "express";
import { JWTinfo } from "../types";

export const createToken = (id: string) => {
  const jwtDetails: JWTinfo = { id };
  return jwt.sign(jwtDetails, keys.jwtSecret, { expiresIn: 3600 });
};

export const encryptUserPayload = (payload: {
  password?: string;
  [key: string]: unknown;
}) => {
  if (!payload.password) {
    return payload;
  }
  const salt = bcrypt.genSaltSync(10);
  const password = bcrypt.hashSync(payload.password, salt);
  return { ...payload, password };
};

export const authMiddleware = (
  request: express.Request,
  response: express.Response,
  next: express.NextFunction
) => {
  const token = request.header("x-auth-token");
  if (!token) {
    return response.status(401).json({ message: "token not found" });
  }
  try {
    const decoded = jwt.verify(token, keys.jwtSecret) as JWTinfo;
    console.log(decoded);
    request.headers["user-id"] = decoded.id;
    next();
  } catch (e) {
    response.status(400).json({ message: "wtf dis jwt" });
  }
};