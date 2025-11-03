#!/usr/bin/env node

import { Command } from 'commander'
import { userCommands } from './commands/user'
import { dbCommands } from './commands/db'
import { tokenCommands } from './commands/token'
import { devCommands } from './commands/dev'
import { sessionCommands } from './commands/session'
import { keyCommands } from './commands/key'
import { securityCommands } from './commands/security'
import { analyticsCommands } from './commands/analytics'

const program = new Command()

program.name('gravy').description('🍗 Gravy - Turkey Authentication Service CLI').version('1.0.0')

// Add command groups in logical order
program.addCommand(userCommands) // User management
program.addCommand(sessionCommands) // Session/refresh token management
program.addCommand(tokenCommands) // Access token management
program.addCommand(keyCommands) // Cryptographic key rotation
program.addCommand(securityCommands) // Security monitoring & audit
program.addCommand(analyticsCommands) // Analytics & reporting
program.addCommand(dbCommands) // Database operations
program.addCommand(devCommands) // Development tools

// Parse arguments and execute
program.parse(process.argv)
