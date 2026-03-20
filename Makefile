.PHONY: up down logs build migrate seed health

up:
	docker-compose up -d

down:
	docker-compose down

logs:
	docker-compose logs -f

build:
	docker-compose build

migrate:
	docker-compose exec backend alembic upgrade head

seed:
	docker-compose exec backend python -m app.seed

health:
	@echo "--- Postgres ---"
	@docker-compose exec postgres pg_isready -U training -d training_app
	@echo "--- Backend ---"
	@curl -sf http://localhost:8000/health | python -m json.tool || echo "Backend not ready"
