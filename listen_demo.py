#!/usr/local/bin/python3
# -*- coding: utf-8 -*-

"""
@File    : listen_demo.py
@Author  : Gyanano
@Time    : 2025/3/1 17:55
"""

from TikTokLive import TikTokLiveClient
from TikTokLive.events import ConnectEvent, CommentEvent, GiftEvent, ShareEvent, LikeEvent, FollowEvent, DisconnectEvent
from httpx import Proxy

client: TikTokLiveClient = TikTokLiveClient(
    unique_id="https://www.tiktok.com/@koyegameshopbago5/live",

    # You can configure a proxy for web requests
    web_proxy=Proxy("http://127.0.0.1:10809", auth=("", "")),
    # You can also configure a proxy for the websocket connection
    ws_proxy=Proxy("socks5://127.0.0.1:10808", auth=("", "")),
)


# Listen to an event with a decorator!
@client.on(ConnectEvent)
async def on_connect(event: ConnectEvent):
    print(f"Connected to @{event.unique_id} (Room ID: {client.room_id}")


@client.on(GiftEvent)
async def on_gift(event: GiftEvent):
    client.logger.info("Received a gift!")

    # Can have a streak and streak is over
    if event.gift.streakable and not event.streaking:
        print(f"{event.user.nickname} sent {event.repeat_count}x \"{event.gift.name}\"")
    # Cannot have a streak
    elif not event.gift.streakable:
        print(f"{event.user.nickname} sent \"{event.gift.name}\"")


@client.on(CommentEvent)
async def on_comment(event: CommentEvent):
    print(f"{event.user.nickname}: {event.comment}")


if __name__ == '__main__':
    # Run the client and block the main thread
    client.run()
