import { build } from "vite";
import config from "../vite.config.mjs";

try {
  await build(config);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
