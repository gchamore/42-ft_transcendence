# Nom du projet
NAME = transcendence

# Commandes
DOCKER_COMPOSE = docker-compose
DOCKER = docker

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

# Lancer l'infrastructure
run: check_deps
	@$(DOCKER_COMPOSE) up --build -d
	@echo "$(GREEN)Application disponible sur : http://localhost$(RESET)"

# Arrêter les conteneurs et supprimer les volumes
down:
	@echo "$(YELLOW)Arrêt des conteneurs...$(RESET)"
	@read -p "Voulez-vous supprimer le volume persistant? (y/n) " answer; \
    if [ "$$answer" = "y" ]; then \
        $(DOCKER_COMPOSE) down -v; \
        echo "$(GREEN)Volume supprimé$(RESET)"; \
    else \
        echo "$(YELLOW)Conservation du volume$(RESET)"; \
        $(DOCKER_COMPOSE) down; \
    fi

up: check_deps
	@echo "$(YELLOW)Démarrage des conteneurs...$(RESET)"
	@$(DOCKER_COMPOSE) up -d

# Nettoyage complet
clean: down
	@echo "$(YELLOW)Nettoyage des ressources Docker...$(RESET)"
	@docker system prune -a --volumes -f;
	@rm -rf ./backend/tools/database.db
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

# ...existing code...

# Get database backup copy to check inside
BACKEND_DOCKER_NAME = $(shell docker ps --format "{{.Names}}" | grep backend)

database:
	@echo "$(YELLOW)Création d'une copie de la base de données...$(RESET)"
	@if [ -f ./backend/tools/database.db ]; then \
        rm ./backend/tools/database.db && \
        echo "$(GREEN)✓ Ancienne copie supprimée$(RESET)"; \
    fi
	@if [ $$(docker ps -q -f name=$(BACKEND_DOCKER_NAME)) ]; then \
        docker cp $(BACKEND_DOCKER_NAME):/data/database.db ./backend/tools/ && \
        echo "$(GREEN)✓ Base de données copiée dans ./backend/tools/database.db$(RESET)"; \
    else \
        echo "$(ORANGE)⚠ Le conteneur backend n'est pas en cours d'exécution$(RESET)"; \
        echo "$(YELLOW)→ Démarrez d'abord les conteneurs avec 'make up'$(RESET)"; \
    fi
	@code ./backend/tools/database.db

# Logs des services
logs:
	@echo "$(YELLOW)Logs du backend:$(RESET)"
	@$(DOCKER_COMPOSE) logs backend
	@echo "$(YELLOW)Logs de nginx:$(RESET)"
	@$(DOCKER_COMPOSE) logs nginx

# Redémarrer un service spécifique
restart_service:
	@read -p "Nom du service à redémarrer (backend/nginx) : " service; \
	$(DOCKER_COMPOSE) restart $$service

# Rebuild complet
re: clean run

define HEADER
$(ORANGE)████████╗██████╗  █████╗ ███╗   ██╗███████╗ ██████╗███████╗███╗   ██╗██████╗ ███████╗███╗   ██╗ ██████╗███████╗
╚══██╔══╝██╔══██╗██╔══██╗████╗  ██║██╔════╝██╔════╝██╔════╝████╗  ██║██╔══██╗██╔════╝████╗  ██║██╔════╝██╔════╝
   ██║   ██████╔╝███████║██╔██╗ ██║███████╗██║     █████╗  ██╔██╗ ██║██║  ██║█████╗  ██╔██╗ ██║██║     █████╗  
   ██║   ██╔══██╗██╔══██║██║╚██╗██║╚════██║██║     ██╔══╝  ██║╚██╗██║██║  ██║██╔══╝  ██║╚██╗██║██║     ██╔══╝  
   ██║   ██║  ██║██║  ██║██║ ╚████║███████║╚██████╗███████╗██║ ╚████║██████╔╝███████╗██║ ╚████║╚██████╗███████╗
   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝ ╚═════╝╚══════╝╚═╝  ╚═══╝╚══════╝╚═╝  ╚═══╝ ╚═════╝╚══════╝$(RESET)

$(YELLOW)ft_transcendence - Docker Project$(RESET)
endef
export HEADER

first_header:
	@echo "\n$$HEADER\n"

.PHONY: all check_deps run down up clean status logs restart_service re first_header get_database