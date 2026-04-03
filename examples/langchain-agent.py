import json
import os

import requests

try:
    from langchain.agents import AgentType, initialize_agent
    from langchain.tools import tool
    from langchain_openai import ChatOpenAI
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "Install langchain, langchain-openai, and openai to run this example."
    ) from exc


XMPP_GATEWAY_URL = os.getenv("XMPP_GATEWAY_URL", "http://localhost:4300")


def gateway_fetch(url: str, *, service_id: str, projected_requests: int, streaming: bool = False):
    response = requests.post(
        f"{XMPP_GATEWAY_URL}/fetch",
        timeout=60,
        headers={"content-type": "application/json"},
        json={
            "url": url,
            "method": "GET",
            "options": {
                "serviceId": service_id,
                "projectedRequests": projected_requests,
                "streaming": streaming,
            },
        },
    )
    response.raise_for_status()
    return response.json()


@tool
def paid_research(query: str) -> str:
    """Run a paid research lookup through xMPP."""
    result = gateway_fetch(
        f"http://localhost:4101/research?q={query}",
        service_id="research-api",
        projected_requests=1,
    )
    return json.dumps(result, indent=2)


@tool
def paid_market_quote(symbol: str) -> str:
    """Fetch a premium market quote through xMPP."""
    result = gateway_fetch(
        f"http://localhost:4102/quote?symbol={symbol}",
        service_id="market-api",
        projected_requests=1,
    )
    return json.dumps(result, indent=2)


if __name__ == "__main__":
    llm = ChatOpenAI(model=os.getenv("OPENAI_MODEL", "gpt-4.1-mini"))
    agent = initialize_agent(
        [paid_research, paid_market_quote],
        llm,
        agent=AgentType.OPENAI_FUNCTIONS,
        verbose=True,
    )
    print(
        agent.run(
            "Research Stellar agent payments, then get a premium XLM market quote and summarize both results."
        )
    )
