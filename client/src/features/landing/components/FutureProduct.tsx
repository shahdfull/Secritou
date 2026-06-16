import { motion } from "motion/react";
import { ProductDashboard } from "@/components/dashboard/ProductDashboard";

export function FutureProduct() {
  return (
    <section className="relative overflow-hidden bg-background py-20 sm:py-28">
      <div
        aria-hidden
        className="absolute top-0 left-1/2 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-primary-soft opacity-30 blur-3xl"
      />
      <div className="container-page relative">
        <div className="mx-auto max-w-3xl text-center">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-xs font-semibold uppercase tracking-[0.18em] text-primary"
          >
            Future product vision
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="mt-3 font-display text-3xl font-bold text-ink sm:text-4xl lg:text-5xl"
          >
            The future operating system for growing businesses.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-5 text-base text-muted-foreground sm:text-lg"
          >
            Today we deliver this as a coordinated service. Tomorrow, it's a platform — your
            revenue, KPIs, marketing, tasks and automations, unified in one place.
          </motion.p>
        </div>

        <div className="mt-14">
          <ProductDashboard />
        </div>
      </div>
    </section>
  );
}
