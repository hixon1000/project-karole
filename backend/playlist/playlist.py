from fastapi import APIRouter, HTTPException, status
from database import client
from models import PlaylistInput, NameInput
from name import name
import pymongo, pymongo.errors
import time

col = client["playlist"]

router = APIRouter(
    prefix="/playlist",
    tags=["playlist"],
    responses={404: {"description": "Not found"}}
)

async def find_last_id() -> int:
    last_doc = await col.find().sort("p_id", -1).limit(1).to_list(1)
    if last_doc:
        return last_doc[0]["p_id"] + 1
    return 0

async def find_last_order_num(priority: int) -> int:
    last_doc = await col.find({"priority_num":priority}).sort("order_num", -1).limit(1).to_list(1)
    if last_doc:
        return last_doc[0]["order_num"] + 1
    return 0

@router.post("/add")
async def add_song(body: PlaylistInput):
    date = time.time()
    
    if await col.find_one({"service":body.service, "url_id":body.url_id}):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Song exists in playlist")
    
    name_dat = await name.read_name(NameInput(name=body.name))
    
    
    
    return body, date
