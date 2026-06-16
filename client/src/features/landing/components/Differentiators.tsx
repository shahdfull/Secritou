import { motion } from "motion/react";
import { Compass, LineChart, Users } from "lucide-react";

const items = [
  {
    icon: Compass,
    title: "Strategy First",
    body: "We don't execute blindly. Every initiative starts with a clear thesis and a measurable outcome.",
  },
  {
    icon: LineChart,
    title: "Data Driven",
    body: "Every decision is measured. If we can't track it, we don't ship it.",
  },
  {
    icon: Users,
    title: "One Coordinated Team",
    body: "One partner instead of five vendors — strategy, marketing, tech and AI under one roof.",
  },
];

export function Differentiators() {
  return (
    <section className="bg-background py-20 sm:py-28">
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            What makes Secritou different
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold text-ink sm:text-4xl lg:text-5xl">
            More than a service provider.
          </h2>
        </div>

        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {items.map((it, i) => (
            <motion.div
              key={it.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="rounded-3xl border border-border bg-card p-8 shadow-soft"
            >
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-ink text-white">
                <it.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-6 font-display text-xl font-bold text-ink">{it.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{it.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
