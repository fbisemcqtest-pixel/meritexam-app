import type { IncomingMessage, ServerResponse } from 'node:http';

interface ApiResponse extends ServerResponse {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
}

export default function handler(_req: IncomingMessage, res: ApiResponse) {
  res.status(200).json({ status: 'ok' });
}
