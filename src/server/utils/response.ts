import type { ApiResponse, ErrorResponse } from "../types.js";
import { ApiErrorType } from "../types.js";

export const success = <T>(
	data: T,
	meta?: ApiResponse<T>["meta"],
): ApiResponse<T> => {
	return {
		meta,
		data,
	};
};

export const error = (type: ApiErrorType, message: string): ErrorResponse => {
	return {
		error: {
			type,
			message,
		},
	};
};

export const notFound = (
	message: string = "Resource not found",
): ErrorResponse => {
	return error(ApiErrorType.NOT_FOUND, message);
};

export const validationError = (
	message: string = "Validation failed",
): ErrorResponse => {
	return error(ApiErrorType.VALIDATION_ERROR, message);
};

export const internalError = (
	message: string = "Internal server error",
): ErrorResponse => {
	return error(ApiErrorType.INTERNAL_ERROR, message);
};
