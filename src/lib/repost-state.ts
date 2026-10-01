import { responseVersion } from "./response-version";

export type RepostEntry = { reposted: boolean; repostCount: number; pending: boolean };
type Listener = () => void;

const users = new Map<string, Map<string, RepostEntry>>();
const sources = new Map<string, Map<string, { source?: unknown; signature: string; version: number; value: { reposted: boolean; repostCount: number } }>>();
const listeners = new Map<string, Set<Listener>>();
const generations = new Map<string, number>();

function key(userId: string, postId: string) { return `${userId}:${postId}`; }

function stateFor(userId: string) {
  let state = users.get(userId);
  if (!state) { state = new Map(); users.set(userId, state); }
  return state;
}

function sourceMapFor(userId: string) {
  let state = sources.get(userId);
  if (!state) { state = new Map(); sources.set(userId, state); }
  return state;
}

export function getRepostSnapshot(userId: string, postId: string, reposted: boolean, repostCount: number, serverSource?: unknown): RepostEntry {
  const state = stateFor(userId);
  const sourceState = sourceMapFor(userId);
  const signature = JSON.stringify([reposted, repostCount]);
  const version = responseVersion(serverSource);
  const previousSource = sourceState.get(postId);
  let entry = state.get(postId);
  if (!entry) {
    entry = { reposted, repostCount, pending: false };
    state.set(postId, entry);
    sourceState.set(postId, { source: serverSource, signature, version, value: { reposted, repostCount } });
  } else if (!previousSource) {
    if (serverSource !== undefined) sourceState.set(postId, { source: serverSource, signature, version, value: { reposted, repostCount } });
  } else if (serverSource !== undefined && version > 0) {
    if (version > previousSource.version) {
      sourceState.set(postId, { source: serverSource, signature, version, value: { reposted, repostCount } });
      if (!entry.pending) {
        entry = { reposted, repostCount, pending: false };
        state.set(postId, entry);
      }
    }
  } else if (serverSource !== undefined && previousSource.version === 0 && previousSource.signature !== signature) {
    sourceState.set(postId, { source: serverSource, signature, version: 0, value: { reposted, repostCount } });
    if (!entry.pending) {
      entry = { reposted, repostCount, pending: false };
      state.set(postId, entry);
    }
  } else if (serverSource !== undefined && previousSource.source !== serverSource) {
    sourceState.set(postId, { ...previousSource, source: serverSource });
  }
  return entry;
}

export function peekRepostSnapshot(userId: string, postId: string): RepostEntry | undefined {
  return users.get(userId)?.get(postId);
}

export function subscribeRepost(userId: string, postId: string, listener: Listener) {
  const id = key(userId, postId);
  let bucket = listeners.get(id);
  if (!bucket) { bucket = new Set(); listeners.set(id, bucket); }
  bucket.add(listener);
  return () => {
    bucket?.delete(listener);
    if (!bucket?.size) listeners.delete(id);
  };
}

function publish(userId: string, postId: string, entry: RepostEntry) {
  stateFor(userId).set(postId, entry);
  for (const listener of listeners.get(key(userId, postId)) ?? []) listener();
}

export async function updateRepost(
  userId: string,
  postId: string,
  reposted: boolean,
  repostCount: number,
  request: () => Promise<{ reposted: boolean; repostCount: number }>,
) {
  const current = peekRepostSnapshot(userId, postId) ?? getRepostSnapshot(userId, postId, false, 0);
  if (current.pending) return false;
  const generation = generations.get(userId) ?? 0;
  publish(userId, postId, { reposted, repostCount, pending: true });
  try {
    const result = await request();
    if ((generations.get(userId) ?? 0) !== generation) return false;
    const resultVersion = responseVersion(result);
    const prior = sources.get(userId)?.get(postId);
    if (resultVersion > 0 && prior && prior.version > resultVersion) {
      publish(userId, postId, { ...prior.value, pending: false });
    } else {
      if (prior && resultVersion > 0) sources.get(userId)?.set(postId, {
        source: prior.source,
        signature: JSON.stringify([result.reposted, result.repostCount]),
        version: Math.max(resultVersion, prior.version),
        value: { reposted: result.reposted, repostCount: result.repostCount },
      });
      publish(userId, postId, { reposted: result.reposted, repostCount: result.repostCount, pending: false });
    }
    return true;
  } catch (error) {
    if ((generations.get(userId) ?? 0) !== generation) return false;
    publish(userId, postId, { reposted: current.reposted, repostCount: current.repostCount, pending: false });
    throw error;
  }
}

export function clearRepostState(userId?: string) {
  if (userId) {
    generations.set(userId, (generations.get(userId) ?? 0) + 1);
    users.delete(userId);
    sources.delete(userId);
    const notify: Listener[] = [];
    for (const [id, bucket] of listeners) if (id.startsWith(`${userId}:`)) {
      notify.push(...bucket);
      listeners.delete(id);
    }
    for (const listener of notify) listener();
    return;
  }
  const userIds = new Set([...users.keys(), ...sources.keys(), ...[...listeners.keys()].map(value => value.slice(0, value.indexOf(":")))]);
  for (const id of userIds) generations.set(id, (generations.get(id) ?? 0) + 1);
  const notify = [...listeners.values()].flatMap(bucket => [...bucket]);
  users.clear();
  sources.clear();
  listeners.clear();
  for (const listener of notify) listener();
}
