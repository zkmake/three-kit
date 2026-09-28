#!/usr/bin/env node
/** The `three-audit` bin. The work is in `cli/main.ts`, which the tests import. */
import { main } from "./cli/main.ts";

process.exitCode = await main(process.argv.slice(2));
