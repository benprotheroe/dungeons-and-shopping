import express from "express";
import { User, Shop, Stock, Item } from "../../models";
import {
  getMissingKeys,
  createToken,
  authMiddleware,
  validateUser,
  adminOnly,
  encryptUserPayload,
} from "../../helpers";

export const admin = express.Router();

// GET all users

admin.get(
  "/users",
  authMiddleware,
  validateUser,
  adminOnly,
  async (request, response) => {
    try {
      const users = await User.find({}, "-password").lean();
      response.json({ users });
    } catch (e) {
      response.status(400).json({ message: "something went wrong" });
    }
  }
);

// CREATE Admin User

admin.post(
  "/users",
  authMiddleware,
  validateUser,
  adminOnly,
  async (request, response) => {
    const { missingKeys, wrongKeys } = getMissingKeys(
      ["email", "password", "username"],
      request.body
    );
    if (missingKeys || wrongKeys) {
      return response
        .status(401)
        .json({ message: "payload malformed", missingKeys, wrongKeys });
    }
    const { username, email } = request.body;

    try {
      const usernameExists = !!(await User.findOne({ username }));
      const emailExists = !!(await User.findOne({ email }));
      switch (true) {
        case usernameExists && emailExists:
          return response.status(409).json({
            message: `listen pal, both ${username} and ${email} are taken`,
          });
        case emailExists:
          return response.status(409).json({
            message: `listen pal, ${email} is taken`,
          });
        case usernameExists:
          return response.status(409).json({
            message: `listen pal, ${username} is taken`,
          });
      }
      const newUser = new User(
        encryptUserPayload({ ...request.body, admin: true })
      );
      await newUser.save();
      const user = await newUser.toObject();
      delete user.password;
      response.json({
        token: createToken(user._id),
        user,
      });
    } catch (e) {
      response.status(400).json({ message: "something went wrong" });
    }
  }
);

// UPDATE User

admin.post(
  "/users/:id",
  authMiddleware,
  validateUser,
  adminOnly,
  async (request, response) => {
    const id = request.params.id;
    const { wrongKeys } = getMissingKeys(
      ["email", "password", "username", "admin"],
      request.body
    );
    if (wrongKeys) {
      return response.status(401).json({ message: "payload malformed" });
    }
    try {
      const user = await User.findByIdAndUpdate(
        id,
        encryptUserPayload(request.body),
        { new: true }
      );
      const userResponse = await user.toObject();
      delete userResponse.password;

      response.json(userResponse);
    } catch (e) {
      if (e.code === 11000) {
        return response.status(409).json({
          message: `an account for ${request.body.username} or ${request.body.email} (or both) already exists`,
        });
      }
      response.status(400).json({ message: "something went wrong" });
    }
  }
);

// DELETE User

admin.delete(
  "/users/:id",
  authMiddleware,
  validateUser,
  adminOnly,
  async (request, response) => {
    const id = request.params.id;
    // you cannot delete the original admin user (so someone can always do admin things)
    if (id === "5f47e9524f9cf34360540fc5") {
      return response
        .status(401)
        .json({ message: "this user cannot be deleted" });
    }
    try {
      const user = await User.findByIdAndDelete(id);
      if (!user) {
        return response.status(404).json({ message: "user not found" });
      }
      // delete all shops. items and stock for that user
      await Shop.deleteMany({ userId: id });
      await Stock.deleteMany({ userId: id });
      await Item.deleteMany({ userId: id, global: false });
      response.json({ message: "ya killed ham, an hus shaps" });
    } catch (e) {
      response.status(400).json({ message: "something went wrong" });
    }
  }
);
