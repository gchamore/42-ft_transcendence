# Nom du projet
NAME = transcendence

# Commandes
DOCKER_COMPOSE = docker-compose
DOCKER = docker
MKDIR = mkdir -p
RM = rm -rf

# Variables des volumes
DB_VOLUME_DIR = ./backend/data

# Variables pour les logs colorés
GREEN = \033[1;32m
YELLOW = \033[1;33m
ORANGE = \033[38;5;214m
RESET = \033[0m
CHECK_MARK = \033[1;32m✔\033[0m

# Cibles principales
all: first_header run

# Vérification des dépendances
check_deps:
	@command -v docker >/dev/null 2>&1 || { echo "Docker n'est pas installé. Veuillez l'installer."; exit 1; }
	@command -v docker-compose >/dev/null 2>&1 || { echo "Docker Compose n'est pas installé. Veuillez l'installer."; exit 1; }

# Gestion des volumes
build_vol:
	test -d $(DB_VOLUME_DIR) || (sudo mkdir -p $(DB_VOLUME_DIR) && sudo chmod 777 $(DB_VOLUME_DIR))

# Lancer l'infrastructure
run: check_deps build_vol
	@$(DOCKER_COMPOSE) up --build -d
	@echo "$(GREEN)Application disponible sur : http://localhost$(RESET)"

# Arrêter les conteneurs
down:
	@echo "$(YELLOW)Arrêt des conteneurs...$(RESET)"
	@$(DOCKER_COMPOSE) down -v

up: check_deps
	@echo "$(YELLOW)Démarrage des conteneurs...$(RESET)"
	@$(DOCKER_COMPOSE) up -d

rm_vol: down
	sudo rm -rf $(DB_VOLUME_DIR) || true
	sudo rm -rf ./backend/node_modules || true

# Nettoyage
clean: down
	@echo "$(YELLOW)Nettoyage des ressources Docker...$(RESET)"
	@docker system prune -a --volumes -f
	@echo "$(GREEN)Nettoyage terminé$(RESET)"

# Afficher le status
status:
	@echo "\n$(YELLOW)Status des conteneurs:$(RESET)"
	@docker ps -a
	@echo "\n$(YELLOW)Status des volumes:$(RESET)"
	@docker volume ls
	@echo "\n$(YELLOW)Status des networks:$(RESET)"
	@docker network ls
	@echo ""

# Logs des services
logs:
#	@echo "$(YELLOW)Logs du frontend:$(RESET)"
#	@$(DOCKER_COMPOSE) logs frontend
	@echo "$(YELLOW)Logs du backend:$(RESET)"
	@$(DOCKER_COMPOSE) logs backend
	@echo "$(YELLOW)Logs de nginx:$(RESET)"
	@$(DOCKER_COMPOSE) logs nginx
	@echo "$(YELLOW)Logs de la base de données:$(RESET)"
	@$(DOCKER_COMPOSE) logs database

# Redémarrer un service spécifique
restart_service:
	@read -p "Nom du service à redémarrer (frontend/backend/nginx/database) : " service; \
	$(DOCKER_COMPOSE) restart $$service

# Rebuild complet
re: clean rm_vol run

define HEADER
$(ORANGE)████████╗██████╗  █████╗ ███╗   ██╗███████╗ ██████╗███████╗███╗   ██╗██████╗ ███████╗███╗   ██╗ ██████╗███████╗
╚══██╔══╝██╔══██╗██╔══██╗████╗  ██║██╔════╝██╔════╝██╔════╝████╗  ██║██╔══██╗██╔════╝████╗  ██║██╔════╝██╔════╝
   ██║   ██████╔╝███████║██╔██╗ ██║███████╗██║     █████╗  ██╔██╗ ██║██║  ██║█████╗  ██╔██╗ ██║██║     █████╗  
   ██║   ██╔══██╗██╔══██║██║╚██╗██║╚════██║██║     ██╔══╝  ██║╚██╗██║██║  ██║██╔══╝  ██║╚██╗██║██║     ██╔══╝  
   ██║   ██║  ██║██║  ██║██║ ╚████║███████║╚██████╗███████╗██║ ╚████║██████╔╝███████╗██║ ╚████║╚██████╗███████╗
   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝ ╚═════╝╚══════╝╚═╝  ╚═══╝╚═════╝ ╚══════╝╚═╝  ╚═══╝ ╚═════╝╚══════╝$(RESET)

$(YELLOW)ft_transcendence - Docker Project$(RESET)
endef
export HEADER

first_header:
	@echo "\n$$HEADER\n"

.PHONY: all build_vol check_deps run down up clean status logs restart_service re first_header