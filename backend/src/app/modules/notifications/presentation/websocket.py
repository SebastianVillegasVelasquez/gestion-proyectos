from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.security import decode_token
from app.shared.connection_manager import ConnectionManager

router = APIRouter()


@router.websocket("/ws/notifications")
async def notification_ws(ws: WebSocket):
    user_id = await _authenticate_or_close(ws)
    if user_id is None:
        return
    await ws.accept()

    manager: ConnectionManager = ws.app.state.manager

    channel = f"notifications:user:{user_id}"

    await manager.connect(channel, ws)

    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(channel, ws)


async def _authenticate_or_close(ws: WebSocket) -> str | None:
    token = ws.query_params.get("token")
    if not token:
        await ws.close(code=4401, reason="Missing token")
        return None
    try:
        payload = decode_token(token)
        return payload["sub"]
    except Exception:
        await ws.close(code=4401, reason="Invalid token")
        return None
