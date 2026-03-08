/**
 * Skillify CLI — main entry point
 *
 * Usage:
 *   skillify record start
 *   skillify record stop
 *   skillify record list
 *   skillify generate <sessionId>
 *   skillify validate <path>
 *   skillify pack <path>
 */

import { Command } from "commander";
import {
  registerRecordCommand,
  registerGenerateCommand,
  registerValidateCommand,
  registerPackCommand,
} from "./commands/index.js";

const program = new Command();

program
  .name("skillify")
  .description("Convert real workflows into Claude Skills — record, extract, generate, validate.")
  .version("0.1.0");

registerRecordCommand(program);
registerGenerateCommand(program);
registerValidateCommand(program);
registerPackCommand(program);

program.parse();
