import { responseVersion } from "./response-version";

export type BookmarkEntry = { bookmarked: boolean; pending: boolean };

type UserState = Map<string, BookmarkEntry>;
type Listener = () => void;

const users = new Map<string, UserState>();
const listeners = new Map<string, Set<Listener>>();
const sources = new Map<string, Map<string, { source?: unknown; signature: string; version: number; value: boolean }>>();
const generations = new Map<string, number>();

function key(userId: string, postId: string) {
  return `${userId}:${postId}`;
}

function stateFor(userId: string) {
  let state = users.get(userId);
  if (!state) {
    state = new Map();
    users.set(userId, state);
  }
  return state;
}

export function getBookmarkSnapshot(userId: string, postId: string, initial: boolean, serverSource?: unknown): BookmarkEntry {
  const state = stateFor(userId);
  let userSources = sources.get(userId);
  if (!userSources) { userSources = new Map(); sources.set(userId, userSources); }
  const signature = String(initial);
  const version = responseVersion(serverSource);
  const previousSource = userSources.get(postId);
  let entry = state.get(postId);
  if (!entry) {
    entry = { bookmarked: initial, pending: false };
    state.set(postId, entry);
    userSources.set(postId, { source: serverSource, signature, version, value: initial });
  } else if (!previousSource) {
    // The component may mount after a mutation store entry already exists.
    // Treat its incoming value as a baseline instead of overwriting that state.
    if (serverSource !== undefined) userSources.set(postId, { source: serverSource, signature, version, value: initial });
  } else if (serverSource !== undefined && version > 0) {
    if (version > previousSource.version) {
      userSources.set(postId, { source: serverSource, signature, version, value: initial });
      if (!entry.pending) {
        entry = { bookmarked: initial, pending: false };
        state.set(postId, entry);
      }
    }
  } else if (serverSource !== undefined && previousSource.version === 0 && previousSource.signature !== signature) {
    // Untagged fixtures retain semantic reconciliation for isolated components.
    userSources.set(postId, { source: serverSource, signature, version: 0, value: initial });
    if (!entry.pending) {
      entry = { bookmarked: initial, pending: false };
      state.set(postId, entry);
    }
  } else if (serverSource !== undefined && previousSource.source !== serverSource) {
    // Keep the newest equivalent source reference while preserving shared
    // optimistic state across duplicate instances.
    userSources.set(postId, { ...previousSource, source: serverSource });
  }
  return entry;
}

export function peekBookmarkSnapshot(userId: string, postId: string): BookmarkEntry | undefined {
  return users.get(userId)?.get(postId);
}

export function subscribeBookmark(userId: string, postId: string, listener: Listener) {
  const id = key(userId, postId);
  let bucket = listeners.get(id);
  if (!bucket) {
    bucket = new Set();
    listeners.set(id, bucket);
  }
  bucket.add(listener);
  return () => {
    bucket?.delete(listener);
    if (!bucket?.size) listeners.delete(id);
  };
}

function publish(userId: string, postId: string, entry: BookmarkEntry) {
  stateFor(userId).set(postId, entry);
  for (const listener of listeners.get(key(userId, postId)) ?? []) listener();
}

export async function updateBookmark(
  userId: string,
  postId: string,
  bookmarked: boolean,
  request: () => Promise<{ bookmarked: boolean }>,
) {
  const current = peekBookmarkSnapshot(userId, postId) ?? getBookmarkSnapshot(userId, postId, false);
  if (current.pending) return false;
  const generation = generations.get(userId) ?? 0;

  publish(userId, postId, { bookmarked, pending: true });
  try {
    const result = await request();
    if ((generations.get(userId) ?? 0) !== generation) return false;
    const resultVersion = responseVersion(result);
    const userSources = sources.get(userId);
    const prior = userSources?.get(postId);
    if (resultVersion > 0 && prior && prior.version > resultVersion) {
      publish(userId, postId, { bookmarked: prior.value, pending: false });
    } else {
      if (userSources && resultVersion > 0) userSources.set(postId, {
        source: prior?.source,
        signature: String(result.bookmarked),
        version: Math.max(resultVersion, prior?.version ?? 0),
        value: result.bookmarked,
      });
      publish(userId, postId, { bookmarked: result.bookmarked, pending: false });
    }
    return true;
  } catch (error) {
    if ((generations.get(userId) ?? 0) !== generation) return false;
    publish(userId, postId, { bookmarked: current.bookmarked, pending: false });
    throw error;
  }
}

export function clearBookmarkState(userId?: string) {
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
  for (const id of new Set([...users.keys(), ...sources.keys(), ...[...listeners.keys()].map(value => value.slice(0, value.indexOf(":")))])) {
    generations.set(id, (generations.get(id) ?? 0) + 1);
  }
  const notify = [...listeners.values()].flatMap(bucket => [...bucket]);
  users.clear();
  sources.clear();
  listeners.clear();
  for (const listener of notify) listener();
}
