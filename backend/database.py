import pymongo
from pymongo.errors import (
    DuplicateKeyError,
    OperationFailure,
    ConnectionFailure,
    ServerSelectionTimeoutError
)
client = pymongo.AsyncMongoClient("127.0.0.1",27017)["karole"]


try:
    client_init = pymongo.MongoClient("127.0.0.1",27017)
    col = client_init["karole"]["name"]
    col.create_index([("name_id",pymongo.DESCENDING)],unique=True)
    col.create_index("name",unique=True)
    col = client_init["karole"]["pending_operation"]
    col.create_index("po_id",unique=True)
    col.create_index("name_alt",unique=True)
    
except ConnectionFailure:
    print("Connection to mongodb failed")
    #484e50