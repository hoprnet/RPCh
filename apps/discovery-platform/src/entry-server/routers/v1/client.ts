import type { Request, Response } from "express";

export function index(req: Request, res: Response) {
  res.send(200).json({ entries: [], count: 0 });
}
