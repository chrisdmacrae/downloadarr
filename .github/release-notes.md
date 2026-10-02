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

{{COMPOSE_CHANGES}}```bash
curl -fsSL https://raw.githubusercontent.com/{{REPOSITORY}}/{{TAG}}/upgrade.sh -o upgrade.sh && chmod +x upgrade.sh
./upgrade.sh {{VERSION}}
```

`upgrade.sh` backs up the database to `backups/`, pulls this release, restarts the stack and waits for
it to come up healthy. It works out whether your install runs with the VPN overlay and uses the same
compose files, so aria2 stays behind the VPN. Leave the version off to follow `latest`; add `--compose`
to refresh the compose files first.

<details>
<summary>By hand</summary>

With the VPN overlay, add `-f docker-compose.yml -f docker-compose.vpn.yml` after `docker compose` in
**every** command below. Without it, aria2 is restarted outside the VPN.

1. Back up the database. Migrations run when the new container starts and are not undone by going back to an older image.

   ```bash
   docker compose exec -T postgres pg_dump -U downloadarr downloadarr > downloadarr-backup.sql
   ```

2. Set `APP_VERSION={{VERSION}}` in `.env` (or leave it as `latest`), then pull and start.

   ```bash
   docker compose pull
   docker compose up -d --remove-orphans
   ```

3. Check it came up.

   ```bash
   docker compose ps
   docker compose logs --tail 50 downloadarr
   ```

</details>

## Roll back

Set `APP_VERSION` in `.env` to the version you were on{{PREVIOUS_VERSION_HINT}}, then:

```bash
docker compose up -d
```

With the VPN overlay, add `-f docker-compose.yml -f docker-compose.vpn.yml` after `docker compose` here too.

If the newer version changed the database and the older one will not start, restore the backup the upgrade made (`backups/downloadarr-<date>.sql`):

```bash
docker compose stop downloadarr
docker compose exec -T postgres psql -U downloadarr -d postgres -c 'DROP DATABASE downloadarr' -c 'CREATE DATABASE downloadarr'
docker compose exec -T postgres psql -U downloadarr downloadarr < backups/downloadarr-<date>.sql
docker compose up -d
```
