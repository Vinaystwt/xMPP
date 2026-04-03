#!/usr/bin/env python3

import json
import urllib.request

GATEWAY_URL = "http://localhost:4300/fetch"


def xmpp_fetch(url: str, service_id: str, projected_requests: int = 1, streaming: bool = False):
    payload = {
        "url": url,
        "method": "GET",
        "options": {
            "serviceId": service_id,
            "projectedRequests": projected_requests,
            "streaming": streaming,
        },
    }
    request = urllib.request.Request(
        GATEWAY_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"content-type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request) as response:
        return json.loads(response.read().decode("utf-8"))


if __name__ == "__main__":
    result = xmpp_fetch(
        "http://localhost:4101/research?q=stellar",
        service_id="research-api",
        projected_requests=1,
    )
    print(json.dumps(result, indent=2))
