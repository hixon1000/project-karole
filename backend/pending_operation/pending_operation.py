from fastapi import APIRouter, HTTPException, status
from database import client
from models import OperationInput, OperationEntry, OperationID
import pymongo, pymongo.errors

col = client["pending_operation"]

router = APIRouter(
    prefix="/operation",
    tags=["operation"],
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