"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const GROUPS: { title: string; items: { href: string; label: string }[] }[] = [
  {
    title: "Plan",
    items: [
      { href: "/", label: "Overview" },
      { href: "/projects", label: "Projects" },
      { href: "/planning", label: "Capacity & workload" },
      { href: "/planner", label: "New project planner" },
    ],
  },
  {
    title: "Report",
    items: [
      { href: "/time", label: "Time tracking" },
      { href: "/risks", label: "Risks & milestones" },
      { href: "/quality", label: "Data quality" },
      { href: "/reports", label: "Report catalogue" },
    ],
  },
];

export default function NavLinks() {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Main">
      {GROUPS.map((g) => (
        <div key={g.title}>
          <div className="nav-group">{g.title}</div>
          {g.items.map((i) => (
            <Link key={i.href} href={i.href} aria-current={(i.href === "/" ? path === "/" : path.startsWith(i.href)) ? "page" : undefined}>
              {i.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
