import {
  ClipboardList,
  Dumbbell,
  Trophy,
  Home,
  PlayCircle,
} from "lucide-react";
import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "Home", icon: Home },
  { to: "/drills", label: "Drills", icon: Dumbbell },
  { to: "/training", label: "Training", icon: ClipboardList },
  { to: "/tournaments", label: "Tournaments", icon: Trophy },
  { to: "/videos", label: "Videos", icon: PlayCircle },
];

export default function MobileBottomNav() {
  return (
    <nav className="mobile-bottom-nav" aria-label="Primary mobile navigation">
      {links.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            isActive
              ? "mobile-bottom-nav-link active"
              : "mobile-bottom-nav-link"
          }
        >
          <Icon size={19} aria-hidden="true" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
