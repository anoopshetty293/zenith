import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import FeatureSection from "../components/FeatureSection";
import StarField from "../components/StarField";
import ZenithLogo from "../components/ZenithLogo";

export default function ZenithHome() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <StarField />
      <div className="relative z-10">
        <Navbar />
        <main>
          <Hero />
          <FeatureSection />
        </main>
        <footer
          id="about"
          className="relative mx-auto max-w-[1400px] px-6 py-10 md:px-10"
          style={{ borderTop: "1px solid var(--zen-line)" }}
        >
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <ZenithLogo size={20} withWordmark />
            <p className="text-[12.5px] text-[var(--zen-mute-2)]">
              A simulation environment for free-space optical communication research.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
