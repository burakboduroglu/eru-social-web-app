import { Link } from "@tanstack/react-router";
import type { CommunitySummary } from "../../shared/types";
import { Avatar, Icon } from "../ui";
import { Illustration } from "./illustration";

export function DiscoverySidebar({ suggested, joined }: { suggested: CommunitySummary[]; joined: CommunitySummary[] }) {
  return <>
    <section className="x-suggestions discovery-sidebar">
      <div className="discovery-sidebar-heading"><Icon name="community" size={20} /><h2>Katılabileceğin topluluklar</h2></div>
      <p>İlgini çeken bir toplulukla başla.</p>
      {suggested.length ? suggested.slice(0, 4).map(community => (
        <Link key={community.id} to={`/communities/${community.id}`} className="x-community discovery-sidebar-row">
          <Avatar src={community.image} name={community.name} username={community.username} />
          <span><strong>{community.name}</strong><small>{community.memberCount} üye</small></span>
          <Icon name="back" size={16} />
        </Link>
      )) : <div className="discovery-sidebar-empty"><Illustration name="people" /><p>Henüz katılmadığın başka topluluk yok.</p><Link to="/communities/new">Topluluk oluştur</Link></div>}
      <Link to="/communities" className="x-more">Tüm toplulukları keşfet</Link>
    </section>
    {joined.length > 0 && <section className="x-suggestions discovery-sidebar">
      <div className="discovery-sidebar-heading"><h2>Toplulukların</h2><span>{joined.length}</span></div>
      {joined.slice(0, 4).map(community => (
        <Link key={community.id} to={`/communities/${community.id}`} className="x-community discovery-sidebar-row">
          <Avatar src={community.image} name={community.name} username={community.username} />
          <span><strong>{community.name}</strong><small>{community.memberCount} üye · Üyesin</small></span>
        </Link>
      ))}
    </section>}
  </>;
}
