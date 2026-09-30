-- Sign-up eligibility is enforced in the Auth transaction, including direct SDK calls.
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  max_uses integer not null default 1 check (max_uses between 1 and 1000),
  uses integer not null default 0 check (uses >= 0 and uses <= max_uses),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.invitation_redemptions (
  invitation_id uuid not null references public.invitations,
  user_id uuid primary key references auth.users on delete cascade,
  redeemed_at timestamptz not null default now()
);
alter table public.invitations enable row level security;
alter table public.invitation_redemptions enable row level security;
revoke all on public.invitations, public.invitation_redemptions from anon, authenticated;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
declare invitation uuid; invite_code text;
begin
  invite_code := trim(coalesce(new.raw_user_meta_data ->> 'invite_code', ''));
  if length(invite_code) < 24 or length(invite_code) > 128 then raise exception 'A valid invitation is required'; end if;
  update public.invitations
    set uses = uses + 1
    where code_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(invite_code, 'UTF8')), 'hex')
      and uses < max_uses and expires_at > now() and revoked_at is null
    returning id into invitation;
  if invitation is null then raise exception 'A valid invitation is required'; end if;
  insert into public.profiles(id) values (new.id);
  insert into public.invitation_redemptions(invitation_id, user_id) values (invitation, new.id);
  return new;
end;
$$;
-- Do not retain the plaintext invitation in user metadata.
create function public.clear_signup_invite() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update auth.users set raw_user_meta_data = raw_user_meta_data - 'invite_code' where id = new.id;
  return new;
end;
$$;
-- PostgreSQL executes same-event triggers alphabetically; validation must run first.
create trigger zz_clear_signup_invite after insert on auth.users for each row execute function public.clear_signup_invite();
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.clear_signup_invite() from public, anon, authenticated;
