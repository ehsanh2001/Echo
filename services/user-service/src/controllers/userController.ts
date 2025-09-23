import { Request, Response } from "express";
import userService, { UserServiceError } from "../services/userService";
import type { CreateUserRequest } from "../types";

export const registerUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email, password, username, display_name } =
      req.body as CreateUserRequest;

    const newUser = await userService.createUser({
      email,
      password,
      username,
      display_name,
    });

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: newUser,
    });
  } catch (error) {
    if (error instanceof UserServiceError) {
      const statusCode =
        error.code === "EMAIL_EXISTS" || error.code === "USERNAME_EXISTS"
          ? 409
          : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message,
        code: error.code,
      });
      return;
    }

    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
