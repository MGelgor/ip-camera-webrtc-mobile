FROM debian:bookworm-slim

RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    coturn \
    gettext-base \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/coturn

COPY turnserver.conf.template /opt/coturn/turnserver.conf.template

CMD ["/bin/sh", "-c", "envsubst < /opt/coturn/turnserver.conf.template > /tmp/turnserver.conf && exec turnserver -c /tmp/turnserver.conf -n"]
