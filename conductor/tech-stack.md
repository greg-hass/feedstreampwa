# Tech Stack: FeedStream PWA

## Frontend
- **Framework:** [SvelteKit](https://kit.svelte.dev/) - For building a fast, modern PWA with SSR/SSG capabilities.
- **Language:** [TypeScript](https://www.typescriptlang.org/) - For type safety and better developer experience.
- **Styling:** [TailwindCSS](https://tailwindcss.com/) - For utility-first CSS and rapid UI development.
- **Icons:** [Lucide Svelte](https://lucide.dev/) - For a consistent and modern icon set.
- **Build Tool:** [Vite](https://vitejs.dev/) - For fast development and optimized production builds.
- **Testing:** [Vitest](https://vitest.dev/) - For unit and integration testing.

## Backend
- **Runtime:** [Node.js](https://nodejs.org/) - Using `tsx` for direct execution of TypeScript files.
- **Framework:** [Fastify](https://www.fastify.io/) - A low-overhead web framework for high-performance APIs.
- **Language:** [TypeScript](https://www.typescriptlang.org/) - Shared types between frontend and backend.

## Database
- **Engine:** [SQLite](https://www.sqlite.org/) - Lightweight, file-based database.
- **Driver:** [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) - The fastest and simplest library for SQLite in Node.js.

## Infrastructure & Deployment
- **Containerization:** [Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/) - For consistent environments and easy deployment.
- **Reverse Proxy:** [Caddy](https://caddyserver.com/) - Automatically handles SSL/TLS and proxies traffic to the web and api services.

## Key Libraries
- **AI Integration:** `@google/generative-ai` - For advanced content analysis and recommendations.
- **Content Extraction:** `@mozilla/readability` & `jsdom` - For converting web pages into a clean reader view.
- **Parsing:** `fast-xml-parser` & `rss-parser` - For robust handling of various feed formats.