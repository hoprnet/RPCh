import type { Request } from "express";
import { ClientDB } from "./client";

export type RequestWithClient = Request & { client: ClientDB };
