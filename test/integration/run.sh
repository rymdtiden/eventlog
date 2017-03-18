#!/bin/bash
pushd "$(dirname "$0")" >/dev/null
docker-compose up --abort-on-container-exit --build --force-recreate --remove-orphans
exitstatus="$(docker-compose ps 2>&1)"
# Zookeeper always(?) exits with an error, so don't include it when counting errors.
unsuccessful="$(echo "$exitstatus" | grep -v rabbitmq | grep "Exit [1-9]" | wc -l)"
popd >/dev/null
if [ "$unsuccessful" != "0" ]; then
  echo -e "\n$unsuccessful container(s) exited with an error code:\n"
  echo "$exitstatus"
  exit 1
fi
exit 0
