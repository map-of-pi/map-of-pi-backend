import { Request, Response } from "express";
import * as userService from "../services/user.service";
import * as jwtHelper from "../helpers/jwt";

export const authenticateUser = async (req: Request, res: Response) => {
  const { authResult } = req.body;
  try {
    const user = await userService.authenticate(authResult);
    const token = jwtHelper.generateUserToken(user);

    console.log(user)

    return res.status(200).json({
      user,
      token,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const signoutUser = async (req: Request, res: Response) => {
  try {
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
