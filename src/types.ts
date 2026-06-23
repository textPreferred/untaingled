export type UserRow = {
  id: number;
  auth0_sub: string | null;
  password_hash: string | null;
  encrypted_db_key: string;
  key_salt: string;
  kdf_params: string | null;
};

export type EventKind = "event" | "date";

export type EventRow = {
  id: number;
  title: string;
  description: string | null;
  kind: EventKind;
};

export type EventWithRoots = EventRow & { root_event_ids: number[] };
