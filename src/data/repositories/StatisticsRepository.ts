/** StatisticsRepository: сессии чтения (id привязан к документу). */

import type { ReadingSession } from '../../core/models/types';
import { getKv, kvGetJson, kvSetJson } from '../../storage/kv';

const key = (s: ReadingSession) => `session:${s.documentId}:${s.id}`;

export class StatisticsRepository {
  async add(session: ReadingSession): Promise<void> {
    await kvSetJson(key(session), session);
  }

  async listAll(): Promise<ReadingSession[]> {
    const kv = await getKv();
    const keys = await kv.keys('session:');
    const sessions = await Promise.all(keys.map((k) => kvGetJson<ReadingSession>(k)));
    return sessions
      .filter((s): s is ReadingSession => s !== null)
      .sort((a, b) => b.startedAt - a.startedAt);
  }
}
