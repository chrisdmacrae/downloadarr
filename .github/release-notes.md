## Install

```bash
curl -fsSL https://raw.githubusercontent.com/{{REPOSITORY}}/refs/heads/main/setup.sh | bash
```

`setup.sh` checks for Docker, downloads `docker-compose.yml` and a `.env`, and starts the stack on the
latest release. The web UI is then at http://localhost:3001. To install this release rather than the
latest, set `APP_VERSION={{VERSION}}` in `.env` and run `docker compose up -d`.

Image: `{{IMAGE}}:{{VERSION}}` (linux/amd64, linux/arm64)

## Upgrade

From the folder that holds your `docker-compose.yml`:

{{COMPOSE_CHANGES}}1. Back up the database. Migrations run when the new container starts and are not undone by going back to an older image.

   ```bash
   docker compose exec -T postgres pg_dump -U downloadarr downloadarr > downloadarr-backup.sql
   ```

2. Pull and start this release.

   ```bash
   docker compose pull
   docker compose up -d --remove-orphans
   ```

   With the VPN overlay, pass both files to each command: `-f docker-compose.yml -f docker-compose.vpn.yml`.

3. Check it came up on this version.

   ```bash
   docker compose ps downloadarr
   docker compose logs --tail 50 downloadarr
   ```

`docker compose pull` follows `APP_VERSION` in `.env`, which is `latest` unless you changed it. To stay on this release until you choose to move, set `APP_VERSION={{VERSION}}`.

## Roll back

Set `APP_VERSION` in `.env` to the version you were on{{PREVIOUS_VERSION_HINT}}, then:

```bash
docker compose up -d
```

If the newer version changed the database and the older one will not start, restore the backup from step 1:

```bash
docker compose stop downloadarr
docker compose exec -T postgres psql -U downloadarr -d postgres -c 'DROP DATABASE downloadarr' -c 'CREATE DATABASE downloadarr'
docker compose exec -T postgres psql -U downloadarr downloadarr < downloadarr-backup.sql
docker compose up -d
```
