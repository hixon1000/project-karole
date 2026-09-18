from fastapi import APIRouter, Depends, HTTPException, status
from database import client
from models import OperationInput, OperationEntry, OperationID, NameChange, NameEntry, PlaylistEntry, PlaylistMove, PlaylistInput
from name import name
from playlist import playlist
from auth import require_admin
import pymongo, pymongo.errors

col = client["pending_operation"]
name_col = client["name"]

router = APIRouter(
    prefix="/operation",
    tags=["operation"],
    dependencies=[Depends(require_admin)],
    responses={404: {"description": "Not found"}}
)

async def find_last_id() -> int:
    last_doc = await col.find().sort("po_id", -1).limit(1).to_list(1)
    if last_doc:
        return last_doc[0]["po_id"] + 1
    return 0

"""
Remeber to unexpose
"""
@router.put("/add")
async def add_operation(body: OperationInput) -> OperationEntry:
    if await col.find_one({"name_alt": body.name_alt}):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Name already exists")
    
    insert_doc = {"name": body.name, "name_alt":body.name_alt, "score":body.score}
    for attempt in range(3):
        insert_doc["po_id"] = await find_last_id()
        try:
            await col.insert_one(insert_doc)
            break
        except pymongo.errors.DuplicateKeyError:
            existing = await col.find_one({"name_alt": body.name_alt})
            if existing:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Name already exists")
            if attempt == 2:
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to allocate unique po_id")
            continue
    return OperationEntry(**insert_doc)

@router.get("/")
async def get_opertation() -> list[OperationEntry]:
    data = await col.find().to_list()
    operations = []
    for i in data:
        operations.append(OperationEntry(**i))
    return operations
    
@router.delete("/flush")
async def delete_all() -> None:
    await col.drop()
    await col.create_index("po_id",unique=True)
    await col.create_index("name_alt",unique=True)
    
@router.delete("/delete")
async def delete(body: OperationID) -> None:
    result = await col.delete_one({"po_id": body.po_id})
    if (result.deleted_count == 0):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Operation not found")
    
@router.post("/handle")
async def handle_case(body: OperationID) -> NameEntry:
    operation = await col.find_one({"po_id": body.po_id})
    if operation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Operation not found")

    name_alt_entry = await name_col.find_one(
        {"name": operation["name_alt"]},
        {"name_id": 1},
    )
    if name_alt_entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alt name not found")

    songs_to_remove = await client["playlist"].find(
        {"name_id": name_alt_entry["name_id"]},
    ).sort("order_num", -1).to_list()
    for song in songs_to_remove:
        await playlist.delete(song["p_id"])

    name_entry = await name.name_to_alt(
        NameChange(name=operation["name"], name_alt=operation["name_alt"])
    )
    # Punish mode
    for song in sorted(songs_to_remove, key=lambda entry: entry["time"]):
        await playlist.add_song(PlaylistInput(url=song["url"], name=song["name"], author=song["author"]))
        
    
    # Forgive mode
    # target_songs = await client["playlist"].find(
    #     {},
    # ).sort("time", 1).to_list()
    # for song in sorted(songs_to_remove, key=lambda entry: entry["time"]):
    #     target_songs = await client["playlist"].find(
    #         {},
    #     ).sort("time", 1).to_list()
    #     latest_time = target_songs[-1]["time"] if target_songs else None
    #     song.pop("_id", None)
    #     song["name_id"] = name_entry.name_id
    #     if latest_time is None or song["time"] > latest_time:
    #         priority = await playlist.find_proirity_with_name_id(name_entry.name_id) + 1
    #         song.pop("p_id", None)
    #         song.pop("order_num", None)
    #         await playlist.add_song_in_priority(priority, song)
    #     else:
    #         later_target_songs = [
    #             target for target in target_songs
    #             if target["time"] > song["time"]
    #         ]
    #         next_song = min(later_target_songs, key=lambda target: target["time"])
    #         priority = next_song["priority_num"]
    #         order_id = next_song["order_num"]
    #         later_songs = [
    #             target for target in target_songs
    #             if target["priority_num"] == priority
    #             and target["order_num"] >= order_id
    #         ]
    #         for target in sorted(later_songs, key=lambda entry: entry["order_num"], reverse=True):
    #             await playlist.move(
    #                 PlaylistMove(
    #                     p_id=target["p_id"],
    #                     order_num=target["order_num"],
    #                 )
    #             )
    #             await client["playlist"].update_one(
    #                 {"p_id": target["p_id"]},
    #                 {"$inc": {"priority_num": 1}},
    #             )
    #         song.pop("p_id", None)
    #         song.pop("order_num", None)
    #         song.pop("priority_num", None)
    #         playlist_entry = PlaylistEntry(
    #             **song,
    #             p_id=await playlist.find_last_id(),
    #             order_num=order_id,
    #             priority_num=priority,
    #         )
    #         await playlist.add_song_in_order(
    #             order_id,
    #             playlist_entry,
    #         )
    await col.delete_one({"po_id": body.po_id})
    return name_entry

@router.post("/handle_all")
async def handle_all() -> list[NameEntry]:
    operations = await col.find({}, {"po_id": 1}).to_list()
    handled_entries = []
    for operation in operations:
        handled_entries.append(
            await handle_case(OperationID(po_id=operation["po_id"]))
        )
    return handled_entries