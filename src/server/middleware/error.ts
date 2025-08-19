import type { NextFunction, Request, Response } from "express";
import type { ApiErrorType } from "../types.js";
import {
	internalError,
	notFound,
	error as responseError,
} from "../utils/response.js";

export class ApiError extends Error {
	public readonly type: ApiErrorType;

	constructor(type: ApiErrorType, message: string) {
		super(message);
		this.type = type;
		this.name = "ApiError";
	}
}

export const errorHandler = (
	err: Error,
	_req: Request,
	res: Response,
	_next: NextFunction,
): void => {
	console.error(`Error occurred: ${err.message}`);

	if (err instanceof ApiError) {
		const response = responseError(err.type, err.message);
		res.status(400).json(response);
		return;
	}

	const response = internalError("An unexpected error occurred");
	res.status(500).json(response);
};

export const notFoundHandler = (req: Request, res: Response): void => {
	const response = notFound(`Route ${req.originalUrl} not found`);
	res.status(404).json(response);
};
