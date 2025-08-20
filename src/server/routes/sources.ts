import type { Request, Response } from "express";
import { sources } from "@/config/sources/index.js";
import { ApiError } from "@/server/middleware/error";
import { ApiErrorType } from "@/server/types";

export const getSourcesHandler = () => {
	return async (_: Request, res: Response): Promise<void> => {
		try {
			const sourceList = sources.map((source) => ({
				id: source.id,
				name: source.name,
			}));

			res.json(sourceList);
		} catch (error) {
			if (error instanceof Error) {
				throw new ApiError(ApiErrorType.INTERNAL_ERROR, error.message);
			}
			throw new ApiError(
				ApiErrorType.INTERNAL_ERROR,
				"Failed to fetch content",
			);
		}
	};
};
