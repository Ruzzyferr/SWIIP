---
description: How to deploy code changes to the swiip.app production server
---

# Deploy to Production

## Prerequisites
- SSH access to server: `root@209.38.205.251`
- Code pushed to GitHub (`master` branch)

## Steps

// turbo-all

1. Push your code to GitHub:
```powershell
git add -A
git commit -m "your commit message"
git push origin master
```

2. SSH into the server and pull the code:
```bash
ssh root@209.38.205.251 "cd /opt/ConstChat && git pull origin master"
```

3. Rebuild and restart only the changed containers:

**If you changed frontend code (apps/web):**
```bash
ssh root@209.38.205.251 "cd /opt/ConstChat && docker compose -f infra/docker/docker-compose.deploy.yml --env-file .env.production up -d --build web"
```

**If you changed API code (services/api):**
```bash
ssh root@209.38.205.251 "cd /opt/ConstChat && docker compose -f infra/docker/docker-compose.deploy.yml --env-file .env.production up -d --build api"
```

**If you changed gateway code (services/gateway):**
```bash
ssh root@209.38.205.251 "cd /opt/ConstChat && docker compose -f infra/docker/docker-compose.deploy.yml --env-file .env.production up -d --build gateway"
```

**If you changed everything or want to rebuild all:**
```bash
ssh root@209.38.205.251 "cd /opt/ConstChat && docker compose -f infra/docker/docker-compose.deploy.yml --env-file .env.production up -d --build"
```

4. Verify the deployment:
```bash
ssh root@209.38.205.251 "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"
```

5. Check logs if something looks wrong:
```bash
ssh root@209.38.205.251 "docker logs swiip-api --tail 30"
ssh root@209.38.205.251 "docker logs swiip-web --tail 30"
ssh root@209.38.205.251 "docker logs swiip-gateway --tail 30"
```

## Quick One-Liner (Full Redeploy)

```powershell
git push origin master; ssh root@209.38.205.251 "cd /opt/ConstChat && git pull origin master && docker compose -f infra/docker/docker-compose.deploy.yml --env-file .env.production up -d --build"
```

## Troubleshooting

- **API 500 errors**: Check `docker logs swiip-api --tail 50`
- **Prisma/DB issues**: Migrations auto-run on API startup (via `entrypoint.sh`)
- **Container won't start**: Check `docker ps -a` and container logs
- **Caddy/SSL issues**: Check `docker logs swiip-caddy --tail 30` (Caddy is not in compose name by default, check container names with `docker ps`)
