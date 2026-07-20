/**
 * Database service layer.
 *
 * Provides typed helpers for common database operations using the
 * Supabase admin client (bypasses RLS – server-only).
 *
 * Usage (server-side only – import dynamically in function handlers):
 *   const { db } = await import("@/lib/db");
 *   const profile = await db.profiles.get(userId);
 */

import { type SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

/* ------------------------------------------------------------------ */
/*   Dynamic client loader                                             */
/* ------------------------------------------------------------------ */

let _admin: SupabaseClient<Database> | null = null;

async function getAdmin(): Promise<SupabaseClient<Database>> {
  if (_admin) return _admin;

  // Dynamic import so this module never ships to the client
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  _admin = supabaseAdmin as unknown as SupabaseClient<Database>;
  return _admin;
}

/* ------------------------------------------------------------------ */
/*   Generic table helpers                                             */
/* ------------------------------------------------------------------ */

function table<T extends keyof Database["public"]["Tables"]>(name: T) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Row = any;

  return {
    /** Fetch a single row by primary key (assumed `id`). */
    async get(id: string): Promise<Tables<T> | null> {
      const client = await getAdmin();
      const { data } = await client
        .from(name)
        .select("*")
        .eq("id" as never, id as never)
        .maybeSingle();
      return data as Tables<T> | null;
    },

    /** List all rows, with optional filters. */
    async list(opts?: {
      column?: string;
      value?: unknown;
      orderBy?: { column: string; ascending?: boolean };
      limit?: number;
    }): Promise<Tables<T>[]> {
      const client = await getAdmin();
      let q = client.from(name).select("*");
      if (opts?.column && opts?.value !== undefined) {
        q = q.eq(opts.column as never, opts.value as never);
      }
      if (opts?.orderBy) {
        q = q.order(opts.orderBy.column as never, { ascending: opts.orderBy.ascending ?? false });
      }
      if (opts?.limit) {
        q = q.limit(opts.limit);
      }
      const { data } = await q;
      return (data ?? []) as Tables<T>[];
    },

    /** Insert a new row. */
    async insert(row: TablesInsert<T>): Promise<Tables<T>> {
      const client = await getAdmin();
      const { data, error } = await client
        .from(name)
        .insert(row as never)
        .select("*")
        .single();
      if (error) throw new Error(`Failed to insert into ${name}: ${error.message}`);
      return data as Tables<T>;
    },

    /** Update a row by primary key (assumed `id`). */
    async update(id: string, changes: TablesUpdate<T>): Promise<Tables<T>> {
      const client = await getAdmin();
      const { data, error } = await client
        .from(name)
        .update(changes as never)
        .eq("id" as never, id as never)
        .select("*")
        .single();
      if (error) throw new Error(`Failed to update ${name}: ${error.message}`);
      return data as Tables<T>;
    },

    /** Delete a row by primary key (assumed `id`). */
    async remove(id: string): Promise<void> {
      const client = await getAdmin();
      const { error } = await client.from(name).delete().eq("id" as never, id as never);
      if (error) throw new Error(`Failed to delete from ${name}: ${error.message}`);
    },

    /** Count rows matching an optional filter. */
    async count(column?: string, value?: unknown): Promise<number> {
      const client = await getAdmin();
      let q = client.from(name).select("*", { count: "exact", head: true });
      if (column && value !== undefined) {
        q = q.eq(column as never, value as never);
      }
      const { count, error } = await q;
      if (error) throw new Error(`Failed to count ${name}: ${error.message}`);
      return count ?? 0;
    },
  };
}

/* ------------------------------------------------------------------ */
/*   Domain-specific helpers                                           */
/* ------------------------------------------------------------------ */

export const db = {
  /** Generic table accessors */
  tables: {
    profiles: table("profiles"),
    institutions: table("institutions"),
    applications: table("applications"),
    subjects: table("subjects"),
    documents: table("documents"),
    updates: table("updates"),
  },

  /** Domain helpers */

  profiles: {
    /** Get a user's full profile (joined with auth). */
    async get(userId: string) {
      const client = await getAdmin();
      const { data, error } = await client
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw new Error(`Failed to get profile: ${error.message}`);
      return data;
    },

    /** Create a profile for a newly signed-up user. */
    async ensure(userId: string, email: string) {
      const client = await getAdmin();
      const existing = await this.get(userId);
      if (existing) return existing;

      const { data, error } = await client
        .from("profiles")
        .insert({ id: userId, email } as never)
        .select("*")
        .single();
      if (error) throw new Error(`Failed to create profile: ${error.message}`);
      return data;
    },
  },

  institutions: {
    /** Get institutions matching a user's APS and province. */
    async recommend(opts: { minAps?: number | null; province?: string | null }) {
      const client = await getAdmin();
      let q = client.from("institutions").select("*");

      if (opts.minAps) {
        q = q.or(`min_aps.is.null,min_aps.lte.${opts.minAps}`);
      }
      if (opts.province) {
        q = q.or(`province.is.null,province.eq.${opts.province}`);
      }

      const { data, error } = await q.order("name");
      if (error) throw new Error(`Failed to query institutions: ${error.message}`);
      return data ?? [];
    },
  },

  applications: {
    /** Get all applications for a user with institution details. */
    async listForUser(userId: string) {
      const client = await getAdmin();
      const { data, error } = await client
        .from("applications")
        .select("*, institution:institutions(*)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(`Failed to list applications: ${error.message}`);
      return data ?? [];
    },
  },
};

/** Raw admin client access (use sparingly – prefer `db` helpers). */
export async function getAdminClient(): Promise<SupabaseClient<Database>> {
  return getAdmin();
}