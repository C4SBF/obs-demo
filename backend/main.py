"""OBS Discovery — FastAPI backend."""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from endpoints import router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    datefmt="%H:%M:%S",
)
# Silence noisy BAC0/bacpypes loggers
for _name in ("BAC0", "BAC0_Root", "bacpypes", "bacpypes3"):
    logging.getLogger(_name).setLevel(logging.WARNING)

app = FastAPI(title="Open Building Stack", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
