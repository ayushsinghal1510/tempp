import { navLinks } from "@/lib/content";
import s from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={`${s.footer} shell`}>
      <div className={s.inner}>
        <a href="#top" className={s.brand}>
          <span className={s.brandText}>Voxio<span className={s.brandDot}>.</span>Prep</span>
        </a>

        <nav className={s.links} aria-label="Footer">
          {navLinks.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>

        <p className={s.line}>
          © {new Date().getFullYear()} Voxio.Prep. The AI coaches and reports. The human decides.
        </p>
      </div>
    </footer>
  );
}
