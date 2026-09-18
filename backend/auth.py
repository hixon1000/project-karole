import hmac
import os
from datetime import datetime, timedelta, timezone

import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm

load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET")
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")
if not JWT_SECRET or not ADMIN_USERNAME or not ADMIN_PASSWORD:
    raise RuntimeError("JWT_SECRET, ADMIN_USERNAME, and ADMIN_PASSWORD must be set")

router = APIRouter(prefix="/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


async def require_admin(token: str = Depends(oauth2_scheme)) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from error


@router.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()) -> dict[str, str]:
    if not (
        hmac.compare_digest(form_data.username, ADMIN_USERNAME)
        and hmac.compare_digest(form_data.password, ADMIN_PASSWORD)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = jwt.encode(
        {
            "sub": form_data.username,
            "exp": datetime.now(timezone.utc) + timedelta(hours=2),
        },
        JWT_SECRET,
        algorithm="HS256",
    )
    return {"access_token": token, "token_type": "bearer"}