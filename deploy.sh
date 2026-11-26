#!/usr/bin/env bash
# [INPUT]: 依赖当前分支的 Git 上游或指定提交、Docker Compose 和仓库的 data 目录。
# [OUTPUT]: 拉取更新、构建并切换镜像，保存切换前的数据副本。
# [POS]: 部署失败时尝试重启上一容器使用的镜像，共用同一数据目录。
# [PROTOCOL]: Update this header on change, then check AGENTS.md
set -euo pipefail

if (( $# > 1 )); then
  printf '用法：bash deploy.sh [Git 提交]\n' >&2
  exit 2
fi

cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
if (( $# == 0 )); then
  git pull --ff-only
  # 拉取也可能更新本脚本，用新版本继续部署。
  exec bash ./deploy.sh HEAD
fi

revision=$(git rev-parse --verify --end-of-options "$1^{commit}")
image="whoyouknow:$revision"
WHOYOUKNOW_UID=$(id -u)
WHOYOUKNOW_GID=$(id -g)
export WHOYOUKNOW_UID WHOYOUKNOW_GID WHOYOUKNOW_IMAGE="$image"

if ! docker image inspect "$image" >/dev/null 2>&1; then
  git archive "$revision" | docker build --pull --tag "$image" \
    --label "org.opencontainers.image.revision=$revision" -
fi

mkdir -p data
previous_container=$(docker compose ps --all --quiet app)
previous_image=''
if [[ -n "$previous_container" ]]; then
  previous_image=$(docker inspect --format '{{.Config.Image}}' "$previous_container")
fi

if [[ "$image" != "$previous_image" && -f data/linkmap.json ]]; then
  backup=$(mktemp data/.before-deploy.XXXXXX)
  if ! cp data/linkmap.json "$backup" || ! mv -f "$backup" data/.before-deploy.json; then
    rm -f "$backup"
    printf '无法保存切换前的数据副本，部署已中止。\n' >&2
    exit 1
  fi
fi

if docker compose up --detach --wait --wait-timeout 30 app; then
  printf '已部署 %s，访问 http://127.0.0.1:4173\n' "$revision"
  exit 0
fi

printf '部署未通过健康检查。\n' >&2
docker compose logs --tail 30 app >&2 || true
if [[ -n "$previous_image" && "$previous_image" != "$image" ]]; then
  if WHOYOUKNOW_IMAGE="$previous_image" docker compose up --detach --wait --wait-timeout 30 app; then
    printf '已恢复上一镜像 %s。\n' "$previous_image" >&2
    exit 1
  fi
  printf '上一镜像也未通过健康检查。\n' >&2
fi
docker compose stop app || true
exit 1
