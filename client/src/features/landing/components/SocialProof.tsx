import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { Star, Quote, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import useEmblaCarousel from "embla-carousel-react";

type Testimonial = { quote: string; author: string; role: string };

function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function SocialProof() {
  const { t, i18n } = useTranslation();

  const lang = (i18n.resolvedLanguage ?? i18n.language ?? "fr").split("-")[0];
  const rawTestimonials = i18n.getResource(
    lang,
    "translation",
    "home.socialProof.testimonials"
  ) as Testimonial[] | undefined;
  const testimonials: Testimonial[] = Array.isArray(rawTestimonials)
    ? rawTestimonials
    : [
        {
          quote: t("home.socialProof.testimonial"),
          author: t("home.socialProof.testimonialAuthor"),
          role: t("home.socialProof.testimonialRole"),
        },
      ];

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: "start",
    slidesToScroll: 1,
  });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo = useCallback((i: number) => emblaApi?.scrollTo(i), [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    setScrollSnaps(emblaApi.scrollSnapList());
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", () => {
      setScrollSnaps(emblaApi.scrollSnapList());
      onSelect();
    });
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  // Autoplay
  useEffect(() => {
    if (!emblaApi) return;
    const id = setInterval(() => emblaApi.scrollNext(), 6000);
    return () => clearInterval(id);
  }, [emblaApi]);

  return (
    <section className="relative border-t border-border bg-background py-12 lg:py-16">
      <div className="container-page">
        {/* Trusted by */}
        <div className="text-center">
          <h2 className="font-display text-2xl font-bold uppercase tracking-wider text-ink sm:text-3xl">
            {t("home.socialProof.trustedBy")}
          </h2>
        </div>

        {/* Testimonials carousel */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="relative mx-auto mt-12 max-w-6xl"
        >
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex -ml-4">
              {testimonials.map((item, i) => (
                <div
                  key={i}
                  className="min-w-0 flex-[0_0_100%] pl-4 sm:flex-[0_0_50%] lg:flex-[0_0_33.333%]"
                >
                  <figure className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-accent/15 p-6 shadow-card sm:p-8">
                    <div
                      aria-hidden
                      className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/20 blur-2xl"
                    />
                    <div
                      aria-hidden
                      className="absolute -bottom-12 -left-10 h-36 w-36 rounded-full bg-accent/25 blur-2xl"
                    />

                    <Quote aria-hidden className="relative h-8 w-8 text-primary/40" fill="currentColor" />

                    <div className="relative mt-3 flex gap-1">
                      {[...Array(5)].map((_, s) => (
                        <Star key={s} className="h-4 w-4 fill-accent text-accent" aria-hidden />
                      ))}
                    </div>

                    <blockquote className="relative mt-4 flex-1 font-display text-base font-medium leading-relaxed text-ink">
                      "{item.quote}"
                    </blockquote>

                    <figcaption className="relative mt-6 flex items-center gap-3">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground">
                        {initialsOf(item.author)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-ink">{item.author}</p>
                        <p className="text-xs text-muted-foreground">{item.role}</p>
                      </div>
                    </figcaption>
                  </figure>
                </div>
              ))}
            </div>
          </div>

          {/* Arrows */}
          <button
            type="button"
            onClick={scrollPrev}
            aria-label={t("home.socialProof.prev")}
            className="absolute left-0 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-ink shadow-soft transition-colors hover:bg-surface lg:flex lg:items-center lg:justify-center"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={scrollNext}
            aria-label={t("home.socialProof.next")}
            className="absolute right-0 top-1/2 hidden -translate-y-1/2 translate-x-1/2 grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-ink shadow-soft transition-colors hover:bg-surface lg:flex lg:items-center lg:justify-center"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          {/* Dots */}
          <div className="mt-6 flex justify-center gap-2">
            {scrollSnaps.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => scrollTo(i)}
                aria-label={t("home.socialProof.testimonialN", { n: i + 1 })}
                className={`h-2 rounded-full transition-all ${
                  i === selectedIndex ? "w-6 bg-primary" : "w-2 bg-border hover:bg-muted-foreground/40"
                }`}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
