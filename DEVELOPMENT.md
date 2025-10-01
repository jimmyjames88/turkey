# Development Setup

## Prerequisites

- Node.js 18+ 
- PostgreSQL 14+
- npm or yarn

## Initial Setup

1. **Clone and install:**
   ```bash
   git clone <repository>
   cd turkey
   npm install
   ```

2. **Database setup:**
   ```bash
   # Create PostgreSQL database
   createdb turkey_dev
   
   # Copy environment file
   cp .env.example .env
   
   # Edit .env with your database URL:
   # DATABASE_URL=postgresql://username:password@localhost:5432/turkey_dev
   ```

3. **Generate database schema:**
   ```bash
   npm run db:generate
   npm run db:migrate
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

## Development Workflow

### Database Changes
1. Modify `src/db/schema.ts`
2. Generate migration: `npm run db:generate`
3. Apply migration: `npm run db:migrate`
4. View data: `npm run db:studio`

### Testing the API
- Health check: `curl http://localhost:3000/health`
- The server runs on port 3000 by default

### Code Quality
- Lint: `npm run lint`
- Fix linting: `npm run lint:fix`
- Build: `npm run build`

## Next Steps

1. Implement JWT key generation utilities
2. Create authentication middleware
3. Build auth routes (/login, /refresh, /logout)
4. Add rate limiting
5. Implement JWKS endpoint

See `MVP_TODO.md` for the complete development roadmap.