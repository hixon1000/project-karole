from models import PlaylistInput, NameInput, PlaylistEntry, PlaylistSwap, PlaylistMove, PlaylistJump
from fastapi import APIRouter, Depends, HTTPException, Request, status
from database import client
from name import name
import asyncio
import jwt
import os
import pymongo, pymongo.errors
import time
from typing import Any, cast
from html.parser import HTMLParser
from urllib.request import Request as UrlRequest, urlopen
from yt_dlp import YoutubeDL
from auth import JWT_SECRET, require_admin
from fastapi.responses import StreamingResponse

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
    last_priority_doc = await col.find(
        {"priority_num": {"$lte": priority}}
    ).sort(
        [("priority_num", -1), ("order_num", -1)]
    ).limit(1).to_list(1)
    if last_priority_doc:
        return last_priority_doc[0]["order_num"] + 1

    return 0

async def find_proirity_with_name_id(name_id: int) -> int:
    last_doc = await col.find({"name_id": name_id}).sort("priority_num", -1).limit(1).to_list(1)
    if last_doc:
        return last_doc[0]["priority_num"]
    return 0

async def add_song_in_priority(priority: int, song_info: dict) -> PlaylistEntry:
    for _ in range(3):
        songs_to_shift = []
        try:
            playlist_entry = PlaylistEntry(
                **song_info,
                p_id=await find_last_id(),
                order_num=await find_last_order_num(priority),
                priority_num=priority,
            )
            songs_to_shift = await col.find(
                {"order_num": {"$gte": playlist_entry.order_num}}
            ).sort("order_num", -1).to_list()
            for song in songs_to_shift:
                await col.update_one(
                    {"p_id": song["p_id"]},
                    {"$inc": {"order_num": 1}},
                )
            await col.insert_one(playlist_entry.model_dump())
            return playlist_entry
        except pymongo.errors.DuplicateKeyError:
            for song in reversed(songs_to_shift):
                await col.update_one(
                    {"p_id": song["p_id"]},
                    {"$inc": {"order_num": -1}},
                )
            continue

    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Playlist changed while adding the song; please retry",
    )

async def add_song_in_order(order_id: int, song_info: PlaylistEntry) -> PlaylistEntry:
    await col.update_many(
        {"order_num": {"$gte": order_id}},
        [{
            "$set": {
                "order_num": {
                    "$multiply": [-1, {"$add": ["$order_num", 1]}]
                }
            }
        }],
    )
    await col.update_many(
        {"order_num": {"$lt": 0}},
        [{
            "$set": {
                "order_num": {"$multiply": [-1, "$order_num"]}
            }
        }],
    )
    playlist_entry = song_info.model_copy(update={"order_num": order_id})
    await col.insert_one(playlist_entry.model_dump())
    return playlist_entry

def extract_video_info(url: str) -> dict:
    options = _yt_dlp_options()
    with YoutubeDL(cast(Any, options)) as downloader:
        return cast(dict, downloader.extract_info(url, download=False))

def extract_playback_url(url: str) -> str | None:
    options = _yt_dlp_options()
    options["format"] = "best[ext=mp4]/best"
    with YoutubeDL(cast(Any, options)) as downloader:
        video_info = cast(dict, downloader.extract_info(url, download=False))
    return video_info.get("url")

def extract_playback_formats(url: str) -> tuple[str, str | None]:
    options = _yt_dlp_options()
    options["format"] = "bestvideo+bestaudio/best"
    with YoutubeDL(cast(Any, options)) as downloader:
        video_info = cast(dict, downloader.extract_info(url, download=False))
    requested_formats = video_info.get("requested_formats") or []
    if len(requested_formats) >= 2:
        return requested_formats[0]["url"], requested_formats[1]["url"]
    if video_info.get("url"):
        return video_info["url"], None
    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail="No playable video stream was found",
    )

def _yt_dlp_options() -> dict:
    opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
    }
    cookie_file = os.getenv("YTDLP_COOKIE_FILE")
    if cookie_file and os.path.exists(cookie_file):
        opts["cookiefile"] = cookie_file
    return opts

class ChannelIconParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.icon_url: str | None = None

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == "meta" and attributes.get("property") == "og:image":
            self.icon_url = attributes.get("content")
        elif tag == "link" and attributes.get("rel") == "image_src":
            self.icon_url = attributes.get("href")

def extract_channel_icon_url(channel_url: str | None) -> str | None:
    if not channel_url:
        return None

    request = UrlRequest(channel_url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urlopen(request, timeout=10) as response:
            parser = ChannelIconParser()
            parser.feed(response.read().decode("utf-8", errors="ignore"))
            return parser.icon_url
    except OSError:
        return None

@router.post("/add")
async def add_song(body: PlaylistInput):
    date = time.time()
    
    if await col.find_one({"service":body.service, "url_id":body.url_id}):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Song exists in playlist")
    
    video_info = extract_video_info(body.url)
    channel_icon_url = extract_channel_icon_url(
        video_info.get("channel_url") or video_info.get("uploader_url")
    )
    name_result = await name.read_name(NameInput(name=body.name))
    playlist_entry = {
        "name_id": name_result["entry"].name_id,
        "time": date,
        "name": name_result["entry"].name,
        "author": body.author,
        "service": body.service,
        "url": body.url,
        "url_id": body.url_id,
        "url_creator": video_info.get("uploader") or video_info.get("channel"),
        "url_title": video_info.get("title"),
        "url_channel_icon": channel_icon_url,
        "file_loc": None,
        "is_downloaded": False,
    }
    if (name_result["found"]):
        priority_num = await find_proirity_with_name_id(playlist_entry["name_id"]) + 1
        await add_song_in_priority(priority_num, playlist_entry)
    else:
        await add_song_in_priority(1, playlist_entry)
    return playlist_entry

@router.get("/")
async def get_playlist() -> list[PlaylistEntry]:
    data = await col.find().to_list()
    songs = []
    for i in data:
        songs.append(PlaylistEntry(**i))
    return songs

@router.get("/now-playing")
async def now_playing(request: Request) -> PlaylistEntry | None: 
    return request.app.state.current_song["song"]

@router.get("/current-play", dependencies=[Depends(require_admin)])
async def playing_song(request: Request):
    return request.app.state.current_song

@router.get("/playback-source", dependencies=[Depends(require_admin)])
async def playback_source(request: Request) -> dict[str, str | None]:
    current_song = request.app.state.current_song["song"]
    if current_song is None:
        return {"url": None}
    playback_url = extract_playback_url(current_song.url)
    if playback_url is None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="No playable video stream was found",
        )
    return {"url": playback_url}

@router.get("/playback-stream")
async def playback_stream(request: Request, token: str):
    try:
        jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from error

    current_song = request.app.state.current_song["song"]
    if current_song is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No song is currently selected",
        )
    video_url, audio_url = extract_playback_formats(current_song.url)
    command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", video_url]
    if audio_url:
        command.extend(["-i", audio_url, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac"])
    else:
        command.extend(["-c", "copy"])
    command.extend(["-f", "mp4", "-movflags", "frag_keyframe+empty_moov", "pipe:1"])

    async def stream():
        process = await asyncio.create_subprocess_exec(
            *command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            if process.stdout is None:
                raise RuntimeError("FFmpeg stdout is not available")
            while chunk := await process.stdout.read(1024 * 1024):
                yield chunk
        finally:
            if process.returncode is None:
                process.terminate()
            await process.wait()

    return StreamingResponse(stream(), media_type="video/mp4")

@router.post("/play_pause", dependencies=[Depends(require_admin)])
async def play_pause(request: Request) -> bool: 
    if request.app.state.current_song["song"] is None:
        next_song = await col.find_one({}, sort=[("order_num", 1)])
        if next_song is None:
            return False
        next_song.pop("_id", None)
        request.app.state.current_song["song"] = PlaylistEntry(**next_song)
    if request.app.state.current_song["playing"]:
        request.app.state.current_song["playing"] = False
        return False
    else: 
        request.app.state.current_song["playing"] = True
        return True

@router.post("/skip", dependencies=[Depends(require_admin)])
async def skip(request: Request):
    current_song = request.app.state.current_song["song"]
    next_song_filter = {}
    if current_song is not None:
        next_song_filter = {"order_num": {"$gt": current_song.order_num}}

    next_song = await col.find_one(
        next_song_filter,
        sort=[("order_num", 1)],
    )
    if next_song is None:
        request.app.state.current_song = {"playing": False, "song": None}
        return request.app.state.current_song

    next_song.pop("_id", None)
    request.app.state.current_song = {
        "playing": True,
        "song": PlaylistEntry(**next_song),
    }
    return request.app.state.current_song

@router.post("/back", dependencies=[Depends(require_admin)])
async def back(request: Request):
    current_song = request.app.state.current_song["song"]
    prev_song_filter = {}
    if current_song is not None:
        prev_song_filter = {"order_num": {"$lt": current_song.order_num}}
    prev_song = await col.find_one(prev_song_filter, sort=[("order_num", -1)])
    
    if prev_song is None:
        request.app.state.current_song = {"playing": False, "song": None}
        return request.app.state.current_song
    
    prev_song.pop("_id", None)
    request.app.state.current_song = {
        "playing": True, 
        "song": PlaylistEntry(**prev_song)
    }
    
    return request.app.state.current_song

@router.post("/jump", dependencies=[Depends(require_admin)])
async def jump(body: PlaylistJump, request: Request):
    song = await col.find_one({"order_num": body.order_num})
    if song is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Playlist entry not found",
        )
    song.pop("_id", None)
    request.app.state.current_song = {
        "playing": True,
        "song": PlaylistEntry(**song),
    }
    return request.app.state.current_song

@router.delete("/flush", dependencies=[Depends(require_admin)])
async def flush_playlist() -> dict[str, str]:
    await col.delete_many({})
    return {"message": "Playlist flushed"}

@router.delete("/delete", dependencies=[Depends(require_admin)])
async def delete(playlist_id: int) -> PlaylistEntry:
    result = await col.find_one_and_delete({"p_id": playlist_id})
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Playlist entry not found",
        )
    await col.update_many(
        {"order_num": {"$gt": result["order_num"]}},
        {"$inc": {"order_num": -1}},
    )
    result.pop("_id", None)
    return PlaylistEntry(**result)

@router.post("/swap", dependencies=[Depends(require_admin)])
async def swap(body: PlaylistSwap) -> list[PlaylistEntry]:
    if body.original == body.swap:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The songs must have different order numbers",
        )

    first = await col.find_one({"order_num": body.original})
    second = await col.find_one({"order_num": body.swap})
    if first is None or second is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="One or both playlist entries were not found",
        )

    temporary_order_num = -(first["p_id"] + 1)
    await col.bulk_write([
        pymongo.UpdateOne(
            {"p_id": first["p_id"]},
            {"$set": {"order_num": temporary_order_num}},
        ),
        pymongo.UpdateOne(
            {"p_id": second["p_id"]},
            {"$set": {"order_num": body.original}},
        ),
        pymongo.UpdateOne(
            {"p_id": first["p_id"]},
            {"$set": {"order_num": body.swap}},
        ),
    ])

    first["order_num"] = body.swap
    second["order_num"] = body.original
    first.pop("_id", None)
    second.pop("_id", None)
    return [PlaylistEntry(**first), PlaylistEntry(**second)]

@router.post("/move", dependencies=[Depends(require_admin)])
async def move(body: PlaylistMove) -> PlaylistEntry:
    song = await col.find_one({"p_id": body.p_id})
    if song is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Playlist entry not found",
        )
    if body.order_num < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="order_num must be non-negative",
        )

    song.pop("_id", None)
    playlist_entry = PlaylistEntry(**song)
    await delete(body.p_id)
    playlist_entry = playlist_entry.model_copy(update={"order_num": body.order_num})
    return await add_song_in_order(body.order_num, playlist_entry)

