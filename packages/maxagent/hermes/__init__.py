# maxagent plugin for Hermes Agent. All the logic lives in the shared hook ~/.maxagent/hooks/maxagent-hook.js;
# this file only translates Hermes events to it:
#   system prompt section → core rules, once per session
#   pre_llm_call          → experience for this message
#   pre_tool_call         → destructive commands are blocked; experience is only a memory
#   transform_tool_result → that memory is added to the result of the same tool call
#   pre_verify            → one more pass after code edits, only if something is really missing
# A failing hook never breaks the agent: no output means no decision.
import json
import shutil
import subprocess
from pathlib import Path

HOOK = Path.home() / ".maxagent" / "hooks" / "maxagent-hook.js"
TOOLS = {"terminal": "terminal", "web_search": "web_search", "web_extract": "web_fetch"}
NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)
memories = {}


def run_hook(event, data, timeout=12):
    node = shutil.which("node")
    if not node or not HOOK.exists():
        return ""
    try:
        r = subprocess.run(
            [node, str(HOOK), "hermes", event],
            input=json.dumps(data, ensure_ascii=False),
            capture_output=True,
            encoding="utf-8",
            timeout=timeout,
            creationflags=NO_WINDOW,
        )
    except Exception:
        return ""
    return (r.stdout or "").strip() if r.returncode == 0 else ""


def parsed(text):
    try:
        value = json.loads(text)
    except ValueError:
        return None
    return value if isinstance(value, dict) else None


def rules(_session_info):
    return run_hook("start", {"source": "startup"})[:3900]


def on_prompt(session_id="", user_message="", **_):
    hint = run_hook("prompt", {"session_id": session_id or "hermes", "prompt": str(user_message or "")})
    return {"context": hint} if hint else None


def on_tool(tool_name="", args=None, session_id="", task_id="", turn_id="", tool_call_id="", **_):
    name = TOOLS.get(tool_name)
    if not name:
        return None
    args = args or {}
    tool_input = dict(args)
    urls = args.get("urls")
    if isinstance(urls, list) and urls:
        tool_input["url"] = urls[0]
    out = parsed(run_hook("pretool", {
        "session_id": session_id or task_id or "hermes",
        "turn_id": turn_id or None,
        "tool_name": name,
        "tool_input": tool_input,
    }, timeout=10))
    specific = (out or {}).get("hookSpecificOutput") or {}
    if specific.get("permissionDecision") == "deny":
        return {"action": "block", "message": specific.get("permissionDecisionReason") or "maxagent"}
    if specific.get("additionalContext") and tool_call_id:
        memories[tool_call_id] = specific["additionalContext"]
    return None


def with_memory(result=None, tool_call_id="", **_):
    text = memories.pop(tool_call_id, None)
    if not text:
        return None
    body = result if isinstance(result, str) else json.dumps(result, ensure_ascii=False)
    return f"{body}\n\n{text}"


def on_verify(session_id="", attempt=0, final_response="", **_):
    if attempt:
        return None  # one more pass at most
    out = parsed(run_hook("stop", {
        "session_id": session_id or "hermes",
        "stop_hook_active": False,
        "last_assistant_message": str(final_response or ""),
    }))
    if out and out.get("decision") == "block" and out.get("reason"):
        return {"action": "continue", "message": out["reason"]}
    return None


def register(ctx):
    ctx.register_system_prompt_section("maxagent.core-rules", rules, position="after_memory", max_chars=4000)
    ctx.register_hook("pre_llm_call", on_prompt)
    ctx.register_hook("pre_tool_call", on_tool)
    ctx.register_hook("transform_tool_result", with_memory)
    ctx.register_hook("pre_verify", on_verify)
