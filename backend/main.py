from fastapi import FastAPI, Path
from typing import Annotated
from database import client
from name import name
from pending_operation import pending_operation
from playlist import playlist
app = FastAPI()
app.include_router(name.router)
app.include_router(pending_operation.router)
app.include_router(playlist.router)

@app.get("/ping")
async def root():
    return {"message": "pong"}

@app.get("/explode", tags=["Miku"])
async def miku():
    return "explosion"