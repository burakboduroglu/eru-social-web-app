import type { Community, Profile, ResourcePage } from "./types";

export type Subject = {
  id: string;
  communityId: string;
  title: string;
  createdBy: string | null;
  status: "open" | "locked";
  version: number;
  createdAt: string;
  updatedAt: string;
  community: Community;
  joined: boolean;
  canModerate: boolean;
  entryCount: number;
  latestEntryAt: string | null;
  following: boolean;
  saved: boolean;
};

export type SubjectEntry = {
  id: string;
  subjectId: string;
  authorId: string;
  body: string;
  createdAt: string;
  author: Profile;
};

export type SubjectPage = ResourcePage<Subject>;
export type SubjectEntryPage = ResourcePage<SubjectEntry>;
export type SubjectDetailData = { subject: Subject; entries: SubjectEntryPage };
export type CreateSubjectResult = { subject: Subject; reused: boolean };
