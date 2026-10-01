import type { FollowState as SharedFollowState } from "../../shared/types";
import { responseVersion } from "./response-version";

export type FollowState = SharedFollowState & { pending: boolean };
export type FollowResult = SharedFollowState;
type UserState = Map<string, FollowState>;
type Listener = () => void;

const users = new Map<string, UserState>();
const listeners = new Map<string, Set<Listener>>();
const sources = new Map<string, Map<string, { source?: unknown; signature: string; version: number; value: SharedFollowState }>>();
const generations = new Map<string, number>();

function key(userId: string, profileId: string) {
  return JSON.stringify([userId, profileId]);
}

function stateFor(userId: string) {
  let state = users.get(userId);
  if (!state) {
    state = new Map();
    users.set(userId, state);
  }
  return state;
}

function sourceSignature(following: boolean, followerCount: number, followingCount: number) {
  return JSON.stringify([following, followerCount, followingCount]);
}

export function getFollowSnapshot(
  userId: string,
  profileId: string,
  following: boolean,
  followerCount: number,
  followingCount: number,
  serverSource?: unknown,
): FollowState {
  const state = stateFor(userId);
  const signature = sourceSignature(following, followerCount, followingCount);
  const version = responseVersion(serverSource);
  let entry = state.get(profileId);
  let userSources = sources.get(userId);
  if (!userSources) {
    userSources = new Map();
    sources.set(userId, userSources);
  }
  const previousSource = userSources.get(profileId);

  if (!entry) {
    entry = { following, followerCount, followingCount, pending: false };
    state.set(profileId, entry);
    userSources.set(profileId, { source: serverSource, signature, version, value: { following, followerCount, followingCount } });
  } else if (serverSource !== undefined && version > 0) {
    if (!previousSource || version > previousSource.version) {
      userSources.set(profileId, { source: serverSource, signature, version, value: { following, followerCount, followingCount } });
      if (!entry.pending) {
        entry = { following, followerCount, followingCount, pending: false };
        state.set(profileId, entry);
      }
    }
  } else if (serverSource !== undefined && (previousSource?.version ?? 0) === 0 && previousSource?.signature !== signature) {
    userSources.set(profileId, { source: serverSource, signature, version: 0, value: { following, followerCount, followingCount } });
    if (!entry.pending) {
      entry = { following, followerCount, followingCount, pending: false };
      state.set(profileId, entry);
    }
  } else if (serverSource === undefined && previousSource?.signature !== signature && !entry.pending) {
    userSources.set(profileId, { source: undefined, signature, version: 0, value: { following, followerCount, followingCount } });
    entry = { following, followerCount, followingCount, pending: false };
    state.set(profileId, entry);
  } else if (serverSource !== undefined && previousSource && previousSource.source !== serverSource) {
    userSources.set(profileId, { ...previousSource, source: serverSource });
  }
  return entry;
}

export function subscribeFollow(userId: string, profileId: string, listener: Listener) {
  const id = key(userId, profileId);
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

function publish(userId: string, profileId: string, entry: FollowState) {
  stateFor(userId).set(profileId, entry);
  for (const listener of listeners.get(key(userId, profileId)) ?? []) listener();
}

export async function updateFollow(
  userId: string,
  profileId: string,
  following: boolean,
  request: () => Promise<FollowResult>,
) {
  const current = stateFor(userId).get(profileId) ?? {
    following: false,
    followerCount: 0,
    followingCount: 0,
    pending: false,
  };
  if (current.pending) return false;
  const generation = generations.get(userId) ?? 0;
  const delta = following === current.following ? 0 : following ? 1 : -1;

  publish(userId, profileId, {
    ...current,
    following,
    followerCount: Math.max(0, current.followerCount + delta),
    pending: true,
  });

  try {
    const result = await request();
    if ((generations.get(userId) ?? 0) !== generation) return false;
    const resultVersion = responseVersion(result);
    const userSources = sources.get(userId);
    const prior = userSources?.get(profileId);
    if (resultVersion > 0 && prior && prior.version > resultVersion) {
      publish(userId, profileId, { ...prior.value, pending: false });
    } else {
      if (userSources && resultVersion > 0) userSources.set(profileId, {
        source: prior?.source,
        signature: sourceSignature(result.following, result.followerCount, result.followingCount),
        version: Math.max(resultVersion, prior?.version ?? 0),
        value: { ...result },
      });
      publish(userId, profileId, { ...result, pending: false });
    }
    return true;
  } catch (error) {
    if ((generations.get(userId) ?? 0) !== generation) return false;
    publish(userId, profileId, { ...current, pending: false });
    throw error;
  }
}

export function clearFollowState(userId?: string) {
  if (userId) {
    generations.set(userId, (generations.get(userId) ?? 0) + 1);
    users.delete(userId);
    sources.delete(userId);
    const notify: Listener[] = [];
    for (const [id, bucket] of listeners) {
      if (id.startsWith(`[${JSON.stringify(userId)},`)) {
        notify.push(...bucket);
        listeners.delete(id);
      }
    }
    for (const listener of notify) listener();
    return;
  }

  for (const userIdToClear of new Set([...users.keys(), ...sources.keys()])) {
    generations.set(userIdToClear, (generations.get(userIdToClear) ?? 0) + 1);
  }
  const notify = [...listeners.values()].flatMap(bucket => [...bucket]);
  users.clear();
  sources.clear();
  listeners.clear();
  for (const listener of notify) listener();
}
