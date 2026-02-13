.PHONY: demo demo-ai stop logs clean network

# Default network for BACnet communication
NETWORK ?= bacnet_net

# Ensure the Docker network exists
network:
	@docker network inspect $(NETWORK) >/dev/null 2>&1 || \
		docker network create $(NETWORK)

# Run demo without AI dependencies
demo: network
	INSTALL_AI=false docker compose up --build -d

# Run demo with AI dependencies (torch + transformers)
demo-ai: network
	INSTALL_AI=true docker compose up --build -d

# Stop all services
stop:
	docker compose down

# View logs
logs:
	docker compose logs -f

# Clean up containers and images
clean: stop
	docker compose down --rmi local --volumes
