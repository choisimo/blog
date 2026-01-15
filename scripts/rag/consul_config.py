import consul
import os
import json
from functools import lru_cache
from typing import Optional, Any, Dict

CONSUL_HOST = os.getenv("CONSUL_HOST", "consul")
CONSUL_PORT = int(os.getenv("CONSUL_PORT", "8500"))
CONFIG_PREFIX = "blog"

_consul_client: Optional[consul.Consul] = None


def get_consul() -> consul.Consul:
    global _consul_client
    if _consul_client is None:
        _consul_client = consul.Consul(host=CONSUL_HOST, port=CONSUL_PORT)
    return _consul_client


@lru_cache(maxsize=100)
def get_service_url(service_name: str) -> str:
    c = get_consul()
    key = f"{CONFIG_PREFIX}/services/{service_name}/url"

    _, data = c.kv.get(key)
    if data and data.get("Value"):
        return data["Value"].decode("utf-8")

    _, services = c.health.service(service_name, passing=True)
    if services:
        addr = services[0]["Service"]["Address"]
        port = services[0]["Service"]["Port"]
        return f"http://{addr}:{port}"

    raise ValueError(f"Service not found: {service_name}")


def get_config(key: str, default: Any = None) -> Any:
    c = get_consul()
    full_key = f"{CONFIG_PREFIX}/config/{key}"

    _, data = c.kv.get(full_key)
    if data and data.get("Value"):
        value = data["Value"].decode("utf-8")
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value

    return default


def get_service_config(service_name: str, key: str, default: Any = None) -> Any:
    c = get_consul()
    full_key = f"{CONFIG_PREFIX}/services/{service_name}/{key}"

    _, data = c.kv.get(full_key)
    if data and data.get("Value"):
        value = data["Value"].decode("utf-8")
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value

    return default


def is_service_healthy(service_name: str) -> bool:
    c = get_consul()
    try:
        _, services = c.health.service(service_name, passing=True)
        return len(services) > 0
    except Exception:
        return False


def get_all_service_urls() -> Dict[str, Optional[str]]:
    services = [
        "backend",
        "ai-gateway",
        "ai-backend",
        "ai-serve",
        "chromadb",
        "embedding",
        "redis",
        "n8n",
        "terminal",
    ]

    urls = {}
    for name in services:
        try:
            urls[name] = get_service_url(name)
        except ValueError:
            urls[name] = None

    return urls


def clear_cache():
    get_service_url.cache_clear()


def health_check() -> Dict[str, Any]:
    try:
        c = get_consul()
        leader = c.status.leader()
        return {"healthy": bool(leader), "leader": leader}
    except Exception as e:
        return {"healthy": False, "error": str(e)}


if __name__ == "__main__":
    print("Consul Health:", health_check())
    print("\nService URLs:")
    for name, url in get_all_service_urls().items():
        print(f"  {name}: {url}")
