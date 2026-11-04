import { BarChart3, ClipboardList, Dumbbell, Trophy, UsersRound } from "lucide-react";
import { NavLink } from "react-router-dom";

const links = [
  { to: "/drills", label: "Drills", icon: Dumbbell },
  { to: "/training", label: "Training", icon: ClipboardList },
  { to: "/tournaments", label: "Tournaments", icon: Trophy },
  { to: "/assessment-sessions", label: "Assessments", icon: UsersRound },
  { to: "/analysis", label: "Analysis", icon: BarChart3 },
];

export default function MobileBottomNav() {
  return (
    <nav className="mobile-bottom-nav" aria-label="Primary mobile navigation">
      {links.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} className={({ isActive }) => isActive ? "mobile-bottom-nav-link active" : "mobile-bottom-nav-link"}>
          <Icon size={19} aria-hidden="true" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}