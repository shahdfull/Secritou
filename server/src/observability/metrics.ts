import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from "prom-client";

export const registry = new Registry();

registry.setDefaultLabels({ service: "secritou-api" });

collectDefaultMetrics({
  register: registry,
  prefix: "nodejs_",
});

// ── HTTP ──────────────────────────────────────────────────────────────────────

export const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "Durée des requêtes HTTP (secondes)",
  labelNames: ["method", "route", "status_code"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

export const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Nombre total de requêtes HTTP",
  labelNames: ["method", "route", "status_code"] as const,
  registers: [registry],
});

export const httpErrorsTotal = new Counter({
  name: "http_errors_total",
  help: "Erreurs HTTP (status >= 400)",
  labelNames: ["method", "route", "status_code", "error_type"] as const,
  registers: [registry],
});

// ── Prisma / SQL ──────────────────────────────────────────────────────────────

export const prismaQueryDuration = new Histogram({
  name: "prisma_query_duration_seconds",
  help: "Durée des requêtes Prisma (secondes)",
  labelNames: ["model", "operation"] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [registry],
});

export const prismaQueriesTotal = new Counter({
  name: "prisma_queries_total",
  help: "Nombre total de requêtes Prisma",
  labelNames: ["model", "operation", "status"] as const,
  registers: [registry],
});

export const sqlQueryDuration = new Histogram({
  name: "sql_query_duration_seconds",
  help: "Durée des requêtes SQL brutes (secondes)",
  labelNames: ["operation"] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [registry],
});

// ── Erreurs applicatives ──────────────────────────────────────────────────────

export const appErrorsTotal = new Counter({
  name: "app_errors_total",
  help: "Erreurs applicatives non gérées",
  labelNames: ["type", "source"] as const,
  registers: [registry],
});

// ── Web Vitals (frontend) ─────────────────────────────────────────────────────

export const webVitalValue = new Histogram({
  name: "web_vital_value",
  help: "Valeurs Web Vitals rapportées par le frontend",
  labelNames: ["name", "rating", "route"] as const,
  buckets: [0, 50, 100, 200, 500, 1000, 2500, 4000, 8000, 16000],
  registers: [registry],
});

export const webVitalsTotal = new Counter({
  name: "web_vitals_total",
  help: "Nombre de rapports Web Vitals reçus",
  labelNames: ["name", "rating"] as const,
  registers: [registry],
});

// ── Redis ─────────────────────────────────────────────────────────────────────

export const redisConnected = new Gauge({
  name: "redis_connected",
  help: "État de connexion Redis (1 = connecté, 0 = déconnecté)",
  registers: [registry],
});

export const redisMemoryBytes = new Gauge({
  name: "redis_memory_used_bytes",
  help: "Mémoire utilisée par Redis (octets)",
  registers: [registry],
});

export const redisConnectedClients = new Gauge({
  name: "redis_connected_clients",
  help: "Nombre de clients connectés à Redis",
  registers: [registry],
});

export const redisCacheHits = new Counter({
  name: "redis_cache_hits_total",
  help: "Nombre de hits cache Redis",
  registers: [registry],
});

export const redisCacheMisses = new Counter({
  name: "redis_cache_misses_total",
  help: "Nombre de misses cache Redis",
  registers: [registry],
});

// ── BullMQ ────────────────────────────────────────────────────────────────────

export const bullmqJobsWaiting = new Gauge({
  name: "bullmq_jobs_waiting",
  help: "Jobs en attente dans la file BullMQ",
  labelNames: ["queue"] as const,
  registers: [registry],
});

export const bullmqJobsActive = new Gauge({
  name: "bullmq_jobs_active",
  help: "Jobs actifs dans la file BullMQ",
  labelNames: ["queue"] as const,
  registers: [registry],
});

export const bullmqJobsFailed = new Gauge({
  name: "bullmq_jobs_failed",
  help: "Jobs échoués dans la file BullMQ",
  labelNames: ["queue"] as const,
  registers: [registry],
});

export const bullmqJobsDelayed = new Gauge({
  name: "bullmq_jobs_delayed",
  help: "Jobs retardés dans la file BullMQ",
  labelNames: ["queue"] as const,
  registers: [registry],
});

export const bullmqJobDuration = new Histogram({
  name: "bullmq_job_duration_seconds",
  help: "Durée d'exécution des jobs BullMQ (secondes)",
  labelNames: ["queue", "job_name", "status"] as const,
  buckets: [0.1, 0.5, 1, 2.5, 5, 10, 30, 60, 120, 300],
  registers: [registry],
});

export const bullmqJobsProcessed = new Counter({
  name: "bullmq_jobs_processed_total",
  help: "Jobs BullMQ traités",
  labelNames: ["queue", "job_name", "status"] as const,
  registers: [registry],
});

// ── Système (complément aux default metrics) ───────────────────────────────────

export const processMemoryRss = new Gauge({
  name: "process_memory_rss_bytes",
  help: "Mémoire RSS du processus Node.js (octets)",
  registers: [registry],
});

export const processMemoryHeap = new Gauge({
  name: "process_memory_heap_bytes",
  help: "Heap utilisé par le processus Node.js (octets)",
  registers: [registry],
});

export const processCpuPercent = new Gauge({
  name: "process_cpu_usage_percent",
  help: "Utilisation CPU du processus Node.js (%)",
  registers: [registry],
});
