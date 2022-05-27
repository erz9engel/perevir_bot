THIS_FILE := $(lastword $(MAKEFILE_LIST))
.PHONY: help build up start down stop restart logs ps db-shell
help:
	make -pRrq  -f $(THIS_FILE) : 2>/dev/null | awk -v RS= -F: '/^# File/,/^# Finished Make data base/ {if ($$1 !~ "^[#.]") {print $$1}}' | sort | egrep -v -e '^[^[:alnum:]]' -e '^$@$$'
build:
	docker-compose -f docker-compose.yml build $(c)
up:
	docker-compose -f docker-compose.yml up -d $(c)
start:
	docker-compose -f docker-compose.yml start $(c)
down:
	docker-compose -f docker-compose.yml down $(c)
stop:
	docker-compose -f docker-compose.yml stop $(c)
restart:
	docker-compose -f docker-compose.yml stop bot
	docker-compose -f docker-compose.yml up -d bot
logs:
	docker-compose -f docker-compose.yml logs --tail=500 -f bot
ps:
	docker-compose -f docker-compose.yml ps
db-shell:
	docker-compose -f docker-compose.yml exec mongo mongo