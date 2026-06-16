import { app } from "./app.js";
import { env } from "./config/env.js";

app.listen(env.PORT, () => {
  console.log(`Secritou API listening on port ${env.PORT}`);
});
