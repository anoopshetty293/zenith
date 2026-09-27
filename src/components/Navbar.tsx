import { useEffect, useState } from "react";
import ZenithLogo from "./ZenithLogo";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled ? "bg-[#05070cd9] backdrop-blur-md" : "bg-transparent"
      }`}
      style={{ borderBottom: "1px solid var(--zen-line)" }}
    >
      <nav
        id="top"
        className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6 md:px-10"
        aria-label="Primary"
      >
        <a href="#top" className="shrink-0">
          <ZenithLogo size={26} withWordmark withSubtitle />
        </a>

        <div
          className="hidden items-center gap-2 rounded-full py-1.5 pl-3 pr-3.5 md:flex"
          style={{ border: "1px solid var(--zen-line)", background: "var(--zen-panel)" }}
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--zen-cyan)] opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--zen-cyan)]" />
          </span>
          <span
            className="text-[10.5px] font-medium tracking-[0.18em] text-[var(--zen-mute)]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            SYSTEM ONLINE
          </span>
        </div>
      </nav>
    </header>
  );
}
