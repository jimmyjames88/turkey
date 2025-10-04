#!/usr/bin/env node

import { Command } from 'commander';
import { tenantCommands } from './commands/tenant';
import { userCommands } from './commands/user';
import { dbCommands } from './commands/db';
import { tokenCommands } from './commands/token';
import { devCommands } from './commands/dev';

const program = new Command();

program
  .name('gravy')
  .description('🍗 Gravy - Turkey Authentication Service CLI')
  .version('1.0.0');

// Add command groups
program.addCommand(tenantCommands);
program.addCommand(userCommands);
program.addCommand(dbCommands);
program.addCommand(tokenCommands);
program.addCommand(devCommands);

// Parse arguments and execute
program.parse(process.argv);