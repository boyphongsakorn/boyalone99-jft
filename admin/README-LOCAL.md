# Admin (local only) — http://localhost:4001
# Requires backend on http://localhost:3000
#
# 1) Start backend + DB (local):
#      docker compose -f docker-compose.admin.yml up --build backend db
#    or run backend directly:  cd backend && npm install && npm start (PORT=3000)
#
# 2) Serve admin locally (no Docker):
#      cd admin && pnpm install && pnpm start -- --port 4001
#    open http://localhost:4001
#
# 3) Or via Docker:
#      docker build -t boyalone99-admin ./admin
#      docker run --rm -p 4001:4001 -e PORT=4001 boyalone99-admin
#
# 4) Or everything (db + backend + admin):
#      docker compose -f docker-compose.admin.yml up --build
#
# NOTE: admin/src/environments/environment.ts points apiUrl to
# http://localhost:3000. When the admin runs inside Docker on Linux,
# localhost = the admin container itself, so prefer `--network host`:
#      docker run --rm --network host -e PORT=4001 boyalone99-admin
# or use the compose file above.
