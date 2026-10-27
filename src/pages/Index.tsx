import { Link, useNavigate } from "react-router-dom";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { FocusEvent, MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import useEmblaCarousel from "embla-carousel-react";
import SpotlightCard from "@/components/SpotlightCard";
import BrandMark from "@/components/BrandMark";
import { ThemeControl } from "@/components/ThemeControl";
import { Waves, ArrowLeft, ArrowRight, Settings2, LoaderCircle } from "lucide-react";
import heroImg from "@/assets/hero-water.jpg";
import waterQualityImg from "@/assets/feature-water-quality.png";
import growthImg from "@/assets/feature-growth-monitoring.png";
import alertsImg from "@/assets/feature-overview.png";
import accessImg from "@/assets/feature-role-access.png";
import { useAuth } from "@/contexts/AuthContext";
import FadeContent from "@/components/FadeContent";
const RippleDistortion = lazy(() => import("@/components/RippleDistortion"));
const PondScene = lazy(() => import("@/components/PondScene"));
const AquariumScene = lazy(() => import("@/components/AquariumScene"));

const featureCards = [
  {
    title: "Water quality monitoring",
    text: "Track dissolved oxygen, pH, temperature and turbidity from live sensor readings.",
    image: waterQualityImg,
  },
  {
    title: "Growth monitoring",
    text: "Track recorded fish weight, length and feeding notes over time.",
    image: growthImg,
  },
  {
    title: "Smart alerts",
    text: "Get plain-language warnings and recommendations the moment thresholds trip.",
    image: alertsImg,
  },
  {
    title: "Role-based access",
    text: "Operators monitor pond conditions. Admins manage sensors, thresholds and reports.",
    image: accessImg,
  },
];

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userInitial = String(user?.user_metadata?.full_name ?? user?.email ?? "U").trim().charAt(0).toUpperCase() || "U";
  const [ripple, setRipple] = useState(1);
  const [caustics, setCaustics] = useState(0.7);
  const [isStartingSignIn, setIsStartingSignIn] = useState(false);
  const [loadPond, setLoadPond] = useState(false);
  const [loadAquarium, setLoadAquarium] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);
  const [isCarouselDragging, setIsCarouselDragging] = useState(false);
  const [isCarouselFocused, setIsCarouselFocused] = useState(false);
  const [isCarouselVisible, setIsCarouselVisible] = useState(false);
  const [autoplayResetKey, setAutoplayResetKey] = useState(0);
  const [isMobileCarousel, setIsMobileCarousel] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isDocumentVisible, setIsDocumentVisible] = useState(true);
  const aquariumMountRef = useRef<HTMLDivElement>(null);
  const featureCarouselContainerRef = useRef<HTMLDivElement>(null);
  const lastInteractionWasKeyboardRef = useRef(false);
  const [featureCarouselRef, featureCarouselApi] = useEmblaCarousel({
    align: "start",
    loop: true,
    breakpoints: { "(min-width: 768px)": { active: false } },
  });

  useEffect(() => {
    if (!featureCarouselApi) return;

    const updateActiveFeature = () => setActiveFeature(featureCarouselApi.selectedScrollSnap());
    const handlePointerDown = () => setIsCarouselDragging(true);
    const handlePointerUp = () => {
      setIsCarouselDragging(false);
      setAutoplayResetKey((key) => key + 1);
    };

    updateActiveFeature();
    featureCarouselApi.on("select", updateActiveFeature);
    featureCarouselApi.on("pointerDown", handlePointerDown);
    featureCarouselApi.on("pointerUp", handlePointerUp);

    return () => {
      featureCarouselApi.off("select", updateActiveFeature);
      featureCarouselApi.off("pointerDown", handlePointerDown);
      featureCarouselApi.off("pointerUp", handlePointerUp);
    };
  }, [featureCarouselApi]);

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 767px)");
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreferences = () => {
      setIsMobileCarousel(mobileQuery.matches);
      setPrefersReducedMotion(reducedMotionQuery.matches);
    };

    syncPreferences();
    mobileQuery.addEventListener("change", syncPreferences);
    reducedMotionQuery.addEventListener("change", syncPreferences);

    return () => {
      mobileQuery.removeEventListener("change", syncPreferences);
      reducedMotionQuery.removeEventListener("change", syncPreferences);
    };
  }, []);

  useEffect(() => {
    const updateDocumentVisibility = () => setIsDocumentVisible(document.visibilityState === "visible");
    updateDocumentVisibility();
    document.addEventListener("visibilitychange", updateDocumentVisibility);
    return () => document.removeEventListener("visibilitychange", updateDocumentVisibility);
  }, []);

  useEffect(() => {
    const container = featureCarouselContainerRef.current;
    if (!container) return;

    if (!("IntersectionObserver" in window)) {
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      setIsCarouselVisible(entry.isIntersecting && entry.intersectionRatio >= 0.15);
    }, { threshold: 0.15 });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const markKeyboardInteraction = () => {
      lastInteractionWasKeyboardRef.current = true;
    };
    const markPointerInteraction = () => {
      lastInteractionWasKeyboardRef.current = false;
    };

    document.addEventListener("keydown", markKeyboardInteraction, true);
    document.addEventListener("pointerdown", markPointerInteraction, true);
    document.addEventListener("touchstart", markPointerInteraction, { capture: true, passive: true });

    return () => {
      document.removeEventListener("keydown", markKeyboardInteraction, true);
      document.removeEventListener("pointerdown", markPointerInteraction, true);
      document.removeEventListener("touchstart", markPointerInteraction, true);
    };
  }, []);

  const handleCarouselFocus = () => {
    setAutoplayResetKey((key) => key + 1);
    if (lastInteractionWasKeyboardRef.current) setIsCarouselFocused(true);
  };

  const handleCarouselBlur = (event: FocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;

    setIsCarouselFocused(false);
    setAutoplayResetKey((key) => key + 1);
  };

  const handleCarouselPointerDown = () => {
    lastInteractionWasKeyboardRef.current = false;
    setIsCarouselFocused(false);
  };

  useEffect(() => {
    if (
      !featureCarouselApi ||
      !isMobileCarousel ||
      !isCarouselVisible ||
      prefersReducedMotion ||
      isCarouselDragging ||
      isCarouselFocused ||
      !isDocumentVisible
    ) return;

    const timer = window.setTimeout(() => featureCarouselApi.scrollNext(), 7000);
    return () => window.clearTimeout(timer);
  }, [
    activeFeature,
    autoplayResetKey,
    featureCarouselApi,
    isCarouselDragging,
    isCarouselFocused,
    isCarouselVisible,
    isDocumentVisible,
    isMobileCarousel,
    prefersReducedMotion,
  ]);

  const scrollToSection = (event: MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    event.preventDefault();
    const section = document.getElementById(sectionId);
    if (!section) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    section.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  };

  const handleGetStarted = (event: MouseEvent<HTMLAnchorElement>) => {
    if (user) return;

    event.preventDefault();
    if (isStartingSignIn) return;

    setIsStartingSignIn(true);
    window.setTimeout(() => navigate("/auth"), 700);
  };

  useEffect(() => {
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (idleWindow.requestIdleCallback) {
      const handle = idleWindow.requestIdleCallback(() => setLoadPond(true), { timeout: 1200 });
      return () => idleWindow.cancelIdleCallback?.(handle);
    }

    const timer = window.setTimeout(() => setLoadPond(true), 150);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const mount = aquariumMountRef.current;
    if (!mount) return;

    if (!("IntersectionObserver" in window)) {
      setLoadAquarium(true);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setLoadAquarium(true);
        observer.disconnect();
      }
    }, { rootMargin: "240px 0px" });

    observer.observe(mount);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing-page min-h-screen bg-background">
      {/* Nav */}
      <header className="absolute top-0 inset-x-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-5 grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-3 md:flex md:justify-between">
          <div className="flex items-center gap-2 text-white">
            <BrandMark className="h-9 w-9 rounded-xl" />
            <span className="font-semibold tracking-tight">IntelliPond</span>
          </div>
          <nav className="col-span-2 row-start-2 hidden w-full items-center justify-between gap-3 text-xs text-white/90 sm:justify-center sm:gap-8 sm:text-sm md:col-auto md:row-auto md:flex md:w-auto">
            <a href="#features" onClick={(event) => scrollToSection(event, "features")} className="hover:text-white">Features</a>
            <a href="#how" onClick={(event) => scrollToSection(event, "how")} className="hover:text-white">How it works</a>
            <a href="#research" onClick={(event) => scrollToSection(event, "research")} className="hover:text-white">Research</a>
          </nav>
          <div className="col-start-2 row-start-1 md:col-auto md:row-auto flex items-center gap-2">
            <ThemeControl iconOnly className="h-9 w-9 border border-white/50 bg-white/10 p-0 text-white hover:bg-white/20 hover:text-white" />
            {!user && (
              <Button asChild variant="outline" size="sm" className="h-9 min-w-[4.25rem] whitespace-nowrap border-white/50 bg-white/10 px-2 text-sm text-white hover:bg-white/20 hover:text-white sm:min-w-0 sm:px-3">
                <Link to="/auth?tab=signup"><span className="sm:hidden">Sign up</span><span className="hidden sm:inline">Create an account</span></Link>
              </Button>
            )}
            {user ? (
              <Button asChild variant="secondary" size="icon" className="h-9 w-9 rounded-full bg-white p-0 text-primary shadow-sm hover:bg-white/90 dark:text-slate-900">
                <Link to="/dashboard" aria-label="Open console" title="Open console">
                  {userInitial}
                </Link>
              </Button>
            ) : (
              <Link to="/auth" onClick={handleGetStarted}>
                <Button variant="secondary" size="sm" disabled={isStartingSignIn} aria-busy={isStartingSignIn} className="h-9 min-w-[4.25rem] bg-white px-2 text-sm text-primary hover:bg-white/90 dark:text-slate-900 sm:min-w-0 sm:px-3">
                  {isStartingSignIn ? <><LoaderCircle aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />Loading</> : "Sign in"}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative min-h-[92vh] overflow-hidden flex items-center">
        <img src={heroImg} alt="" className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.55] dark:saturate-75" />
        <div className="absolute inset-0 gradient-deep opacity-85 dark:opacity-95" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,hsl(188_85%_55%/0.4),transparent_60%)] dark:opacity-25" />
        <div aria-hidden="true" className="absolute inset-0 overflow-hidden opacity-[0.58] mix-blend-screen pointer-events-none dark:opacity-20">
          <Suspense fallback={null}>
            <RippleDistortion
              src={heroImg}
              brushSize={128}
              strength={0.12}
              swirl={0.65}
              rings={3}
              spread={3.5}
              fade={2.5}
              spacing={28}
              glint={0.08}
              tint="#06B6D4"
              tintAmount={0.035}
              grayscale={false}
              quality="low"
              trigger="hover"
            />
          </Suspense>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-background opacity-0 dark:opacity-100" />
        <div className="relative mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-8 px-4 pt-36 pb-20 sm:px-6 sm:pb-24 md:gap-10 md:py-32 lg:grid-cols-12">
          <FadeContent className="lg:col-span-7 text-white" blur duration={900}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur border border-white/20 text-xs uppercase tracking-widest text-white/90 mb-6">
              <span className="ripple-dot bg-accent" /> Live aquaculture intelligence
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-semibold leading-[1.05] tracking-tight">
              <span className="bg-gradient-to-r from-white to-cyan-100 bg-clip-text text-transparent">Intellipond</span>: Smart Fishpond Monitoring System<br className="hidden lg:block" />
            </h1>
            <p className="mt-5 sm:mt-6 text-base sm:text-lg text-white/90 max-w-xl">
              Monitor water quality, fish growth, and pond conditions in real time with live IoT sensor data.
            </p>
            <div className="mt-8 sm:mt-10">
              <Link to={user ? "/dashboard" : "/auth"} onClick={handleGetStarted} className="inline-flex w-full sm:w-auto">
                <Button size="lg" disabled={isStartingSignIn} aria-busy={isStartingSignIn} className="w-full sm:w-auto bg-white text-primary hover:bg-white/90 dark:text-slate-900 h-12 px-6 hover-scale">
                  {isStartingSignIn ? "Preparing sign in" : user ? "Go to dashboard" : "Get started"}
                  {isStartingSignIn ? <LoaderCircle aria-hidden="true" className="ml-2 h-4 w-4 animate-spin" /> : <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
              </Link>
            </div>
          </FadeContent>
          <div className="lg:col-span-5 w-full">
            <div className="relative w-full mx-auto max-w-[520px] aspect-square sm:aspect-[4/3] lg:aspect-square h-[280px] sm:h-[360px] md:h-[420px] lg:h-[480px]">
              <div className="absolute -inset-4 gradient-aqua opacity-30 blur-3xl rounded-full pointer-events-none dark:opacity-15" />
              <div className="relative h-full w-full rounded-3xl overflow-hidden border border-white/15 bg-white/5 backdrop-blur-sm">
                {loadPond ? (
                  <Suspense fallback={<div className="h-full w-full grid place-items-center text-white/90 text-xs">Loading scene…</div>}>
                    <PondScene />
                  </Suspense>
                ) : (
                  <div className="h-full w-full grid place-items-center text-white/90 text-xs" role="status">
                    Loading scene…
                  </div>
                )}
                <div className="pointer-events-none absolute inset-0 dark:bg-slate-950/20" />
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white/90 text-[10px] sm:text-xs font-mono pointer-events-none">
                  <span className="flex items-center gap-2 rounded-full bg-slate-950/55 px-2.5 py-1"><span className="ripple-dot bg-accent" />IntelliPond 3D</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 sm:py-28 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <FadeContent className="max-w-2xl" blur duration={900}>
            <div className="text-xs uppercase tracking-widest text-accent font-medium mb-3">Built for operators</div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight">Everything that matters about your pond — nothing that doesn't.</h2>
          </FadeContent>
          <div
            ref={featureCarouselContainerRef}
            className="feature-carousel mt-14"
            role="region"
            aria-label="Platform features"
            aria-roledescription="carousel"
            onFocusCapture={handleCarouselFocus}
            onBlurCapture={handleCarouselBlur}
            onPointerDownCapture={handleCarouselPointerDown}
            onTouchStartCapture={handleCarouselPointerDown}
          >
            <div
              ref={featureCarouselRef}
              className="feature-carousel-track"
            >
              <div className="feature-carousel-slides">
                {featureCards.map((f, i) => (
                  <div
                    key={f.title}
                    className="feature-carousel-slide"
                    role="group"
                    aria-roledescription="slide"
                    aria-label={`${i + 1} of ${featureCards.length}: ${f.title}`}
                  >
                    <FadeContent className="w-full min-w-0" blur duration={850} delay={i * 100}>
                      <SpotlightCard
                        role="group"
                        aria-label={f.title + ". " + f.text}
                        tabIndex={0}
                        spotlightColor="rgba(0, 229, 255, 0.2)"
                        className="feature-card"
                      >
                        <img
                          src={f.image}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="feature-card__image"
                        />
                        <div aria-hidden="true" className="feature-card__gradient" />
                        <div className="feature-card__content">
                          <h3 className="feature-card__title">{f.title}</h3>
                          <FadeContent className="feature-card__description" slideUp={20} duration={700} delay={150}>
                            <p>{f.text}</p>
                          </FadeContent>
                        </div>
                      </SpotlightCard>
                    </FadeContent>
                  </div>
                ))}
              </div>
            </div>
            <div className="feature-carousel-controls md:hidden">
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 hover:bg-transparent hover:text-inherit [-webkit-tap-highlight-color:transparent]"
                aria-label="Previous feature"
                onClick={() => {
                  setAutoplayResetKey((key) => key + 1);
                  featureCarouselApi?.scrollPrev(prefersReducedMotion);
                }}
              >
                <ArrowLeft aria-hidden="true" />
              </Button>
              <div className="feature-carousel-indicators" role="group" aria-label="Choose a platform feature">
                {featureCards.map((feature, index) => (
                  <button
                    key={feature.title}
                    type="button"
                    className="feature-carousel-indicator"
                    aria-label={`Show ${feature.title}`}
                    aria-current={activeFeature === index ? "true" : undefined}
                    onClick={() => {
                      setAutoplayResetKey((key) => key + 1);
                      featureCarouselApi?.scrollTo(index, prefersReducedMotion);
                    }}
                  />
                ))}
                <span
                  className="sr-only"
                  aria-live={prefersReducedMotion ? "polite" : "off"}
                  aria-atomic="true"
                >
                  {featureCards[activeFeature]?.title}, slide {activeFeature + 1} of {featureCards.length}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 hover:bg-transparent hover:text-inherit [-webkit-tap-highlight-color:transparent]"
                aria-label="Next feature"
                onClick={() => {
                  setAutoplayResetKey((key) => key + 1);
                  featureCarouselApi?.scrollNext(prefersReducedMotion);
                }}
              >
                <ArrowRight aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* How */}
      <section id="how" className="py-20 sm:py-28 px-4 sm:px-6 bg-secondary/40">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <FadeContent blur duration={900}>
              <div className="text-xs uppercase tracking-widest text-accent font-medium mb-3">How it works</div>
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">From sensor signal to operator action — in seconds.</h2>
            </FadeContent>
            <div className="mt-10 space-y-6">
              {[
                { n: "01", t: "Sensors stream", d: "DO, pH, temperature and turbidity readings flow into IntelliPond continuously." },
                { n: "02", t: "Thresholds are checked", d: "Readings are compared with your configured water-quality ranges." },
                { n: "03", t: "Operators act", d: "A clean dashboard surfaces only what needs attention, with clear recommendations." },
              ].map((s, i) => (
                <FadeContent key={s.n} className="flex gap-5" blur duration={850} delay={i * 100}>
                  <div className="font-mono text-accent text-sm pt-1">{s.n}</div>
                  <div>
                    <div className="font-semibold">{s.t}</div>
                    <div className="text-sm text-muted-foreground mt-1">{s.d}</div>
                  </div>
                </FadeContent>
              ))}
            </div>
          </div>
          <div className="relative aspect-square rounded-3xl overflow-hidden gradient-deep text-white shadow-elevated">
            <div ref={aquariumMountRef} className="absolute inset-0">
              {loadAquarium && (
                <Suspense fallback={<div className="h-full w-full" />}>
                  <AquariumScene rippleIntensity={ripple} causticsBrightness={caustics} />
                </Suspense>
              )}
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-primary/70 pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(188_85%_55%/0.25),transparent_60%)] pointer-events-none" />
            <div className="relative h-full flex flex-col justify-between p-6 sm:p-10">
              <div className="flex items-center justify-between">
                <Waves className="h-8 w-8 drop-shadow" />
                <FadeContent className="flex items-center gap-3" blur duration={850}>
                  <span className="text-[10px] uppercase tracking-widest text-white/90 font-mono flex items-center gap-2 pointer-events-none">
                    <span className="ripple-dot bg-accent" /> Bangus aquarium
                  </span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        aria-label="Aquarium controls"
                        className="h-8 w-8 grid place-items-center rounded-full bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 transition"
                      >
                        <Settings2 className="h-4 w-4" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-64 bg-card/95 backdrop-blur">
                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-medium">Ripple intensity</label>
                            <span className="text-[10px] font-mono text-muted-foreground">{ripple.toFixed(2)}</span>
                          </div>
                          <Slider value={[ripple]} onValueChange={(v) => setRipple(v[0])} min={0} max={2} step={0.05} />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-medium">Caustics brightness</label>
                            <span className="text-[10px] font-mono text-muted-foreground">{caustics.toFixed(2)}</span>
                          </div>
                          <Slider value={[caustics]} onValueChange={(v) => setCaustics(v[0])} min={0} max={1.5} step={0.05} />
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </FadeContent>
              </div>
              <FadeContent className="pointer-events-none" blur duration={900}>
                <div className="text-4xl sm:text-5xl font-semibold tracking-tight drop-shadow-lg">Calm.<br />Clear.<br />Continuous.</div>
                <div className="mt-6 text-white/90 text-sm max-w-xs">An academic-grade platform designed for real fishpond operations.</div>
              </FadeContent>
            </div>
          </div>
        </div>
      </section>

      <section id="research" className="py-16 sm:py-20 px-4 sm:px-6 border-t border-border">
        <FadeContent className="max-w-4xl mx-auto text-center" blur duration={900}>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Ready to monitor your pond?</h2>
          <p className="text-muted-foreground mt-3">Sign in or create an operator account to access your dashboard.</p>
          <Link to={user ? "/dashboard" : "/auth"} onClick={handleGetStarted} className="inline-block w-full sm:w-auto mt-8">
            <Button size="lg" disabled={isStartingSignIn} aria-busy={isStartingSignIn} className="w-full sm:w-auto gradient-aqua text-white border-0 hover:opacity-90 h-12 px-8">
              {isStartingSignIn ? "Preparing sign in" : user ? "Open dashboard" : "Get started"}
              {isStartingSignIn ? <LoaderCircle aria-hidden="true" className="ml-2 h-4 w-4 animate-spin" /> : <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </Link>
        </FadeContent>
      </section>

      <footer className="border-t border-border py-8 px-4 sm:px-6">
        <FadeContent className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm text-muted-foreground" duration={800}>
          <div className="flex items-center gap-2"><BrandMark className="h-4 w-4 rounded" /> IntelliPond</div>
          <div>© {new Date().getFullYear()} · Capstone research project</div>
        </FadeContent>
      </footer>
    </div>
  );
};

export default Index;
