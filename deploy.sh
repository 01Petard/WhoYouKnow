#!/usr/bin/env bash
# [INPUT]: 依赖当前分支的 Git 上游或指定提交、Docker Compose 和仓库的 data 目录。
# [OUTPUT]: 拉取更新，复用或强制重建镜像，保存切换前的数据副本。
# [POS]: 部署失败时尝试重启上一容器使用的镜像，共用同一数据目录。
# [PROTOCOL]: Update this header on change, then check AGENTS.md
set -euo pipefail

rebuild=false
if [[ "${1:-}" == --rebuild ]]; then
  rebuild=true
  shift
fi

if (( $# > 1 )) || [[ "${1:-}" == -* ]]; then
  printf '用法：bash deploy.sh [--rebuild] [Git 提交]\n' >&2
  exit 2
fi

cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
if (( $# == 0 )); then
  git pull --ff-only
  # 拉取也可能更新本脚本，用新版本继续部署。
  if [[ "$rebuild" == true ]]; then
    exec bash ./deploy.sh --rebuild HEAD
  fi
  exec bash ./deploy.sh HEAD
fi

revision=$(git rev-parse --verify --end-of-options "$1^{commit}")
image="whoyouknow:$revision"
WHOYOUKNOW_UID=$(id -u)
WHOYOUKNOW_GID=$(id -g)
export WHOYOUKNOW_UID WHOYOUKNOW_GID WHOYOUKNOW_IMAGE="$image"

if [[ "$rebuild" == true ]] || ! image_id=$(docker image inspect --format '{{.Id}}' "$image" 2>/dev/null); then
  build_options=(--pull)
  if [[ "$rebuild" == true ]]; then
    build_options+=(--no-cache)
  fi
  git archive "$revision" | docker build "${build_options[@]}" --tag "$image" \
    --label "org.opencontainers.image.revision=$revision" -
  image_id=$(docker image inspect --format '{{.Id}}' "$image")
fi

mkdir -p data
previous_container=$(docker compose ps --all --quiet app)
previous_image=''
previous_image_id=''
if [[ -n "$previous_container" ]]; then
  previous_image_details=$(docker inspect --format '{{.Config.Image}} {{.Image}}' "$previous_container")
  read -r previous_image previous_image_id <<< "$previous_image_details"
fi

image_changed=false
if [[ "$image" != "$previous_image" || "$image_id" != "$previous_image_id" ]]; then
  image_changed=true
fi

if [[ "$image_changed" == true && -f data/linkmap.json ]]; then
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
if [[ -n "$previous_image" && "$image_changed" == true ]]; then
  # 同一提交重建会移动标签，按旧容器的镜像 ID 恢复标签。
  if [[ "$previous_image" != "$image" ]] || docker image tag "$previous_image_id" "$previous_image"; then
    if WHOYOUKNOW_IMAGE="$previous_image" docker compose up --detach --wait --wait-timeout 30 app; then
      printf '已恢复上一镜像 %s。\n' "$previous_image" >&2
      exit 1
    fi
  fi
  printf '未能恢复上一镜像。\n' >&2
fi
docker compose stop app || true
exit 1
