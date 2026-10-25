# Game of the Year
A Express + Nunjuks + PostgreSQL application allowing users to search for and rate video games.

## Setup and Running the App

1. Copy `.env.example` to `.env` and fill in the IGDB (Twitch) credentials, the Postgres credentials, and `DATABASE_URL`.
2. Open a terminal in the project directory.
3. Install the dependencies:

   ```bash
   npm install
   ```

4. Make sure the PostgresDB is running, you can use the bundled `compose.yml` with:

    ```bash
    docker compose up -d
    ```

5. Initialize the database schema and seed the `genre` and `platform` tables with:

   ```bash
   npm run db:init
   npm run db:seed
   ```

6. Start the development server:

   ```bash
   npm run dev
   ```

7. Open Game of the Year:

   ```text
   http://localhost:3000/
   ```
