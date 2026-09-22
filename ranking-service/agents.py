import os
import json
import autogen
from dotenv import load_dotenv

import requests
from openai import OpenAI

load_dotenv()

llm_config = {
    "config_list": [
        {
            "model": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
            "base_url": "https://integrate.api.nvidia.com/v1",
            "api_key": os.environ.get("NVIDIA_API_KEY"),
        }
    ],
    "temperature": 0.2,
}


def run_in_sandbox(code: str, language: str, stdin: str) -> dict:
    """
    Executes code in the sandbox. Tries Piston first, falls back to Judge0 CE API.
    Returns: {"status": "success" | "error", "stdout": str, "stderr": str, "time": float, "memory": int}
    """
    piston_url = os.environ.get("PISTON_URL")
    judge0_url = os.environ.get("JUDGE0_URL", "https://ce.judge0.com/submissions?wait=true")

    # 1. Try Piston only if a custom/self-hosted instance is configured (public emkc.org is whitelist-only)
    if piston_url and "emkc.org" not in piston_url:
        try:
            piston_lang = {"python": "python", "java": "java", "c": "c", "cpp": "cpp"}.get(language, "python")
            res = requests.post(
                piston_url,
                json={
                    "language": piston_lang,
                    "version": "*",
                    "files": [{"content": code}],
                    "stdin": stdin or "",
                },
                timeout=10,
            )
            if res.status_code == 200:
                data = res.json()
                run_data = data.get("run", {})
                stdout = run_data.get("stdout", "").rstrip()
                stderr = run_data.get("stderr", "").rstrip()
                exit_code = run_data.get("code", 0)
                status = "success" if (exit_code == 0 and not stderr) else "error"
                return {
                    "status": status,
                    "stdout": stdout,
                    "stderr": stderr,
                    "time": None,
                    "memory": None,
                }
        except Exception:
            pass

    # 2. Fallback to Judge0 CE
    language_map = {"python": 71, "java": 62, "c": 50, "cpp": 54}
    language_id = language_map.get(language, 71)
    try:
        res = requests.post(
            judge0_url,
            json={
                "source_code": code,
                "language_id": language_id,
                "stdin": stdin or "",
            },
            timeout=15,
        )
        if res.status_code in (200, 201):
            data = res.json()
            stdout = (data.get("stdout") or "").rstrip()
            stderr = (data.get("stderr") or data.get("compile_output") or "").rstrip()
            status_id = data.get("status", {}).get("id")
            # 3 = "Accepted"
            status = "success" if (status_id == 3 and not stderr) else "error"
            time_val = float(data["time"]) if data.get("time") is not None else None
            mem_val = int(data["memory"]) if data.get("memory") is not None else None
            return {
                "status": status,
                "stdout": stdout,
                "stderr": stderr,
                "time": time_val,
                "memory": mem_val,
            }
    except Exception as e:
        return {"status": "error", "stdout": "", "stderr": str(e), "time": None, "memory": None}

    return {"status": "error", "stdout": "", "stderr": "Sandbox unavailable", "time": None, "memory": None}


def generate_and_verify_test_cases(raw_brief: str, language: str = "python", n_cases: int = 5) -> tuple[list[dict], str]:
    """
    1. ReferenceSolutionAgent generates a reference solution and proposed candidate test inputs (never outputs).
    2. Executes the reference solution against each proposed input in the sandbox.
    3. The sandbox's real stdout becomes expectedOutput.
    4. If execution fails, attempts regeneration of the input once; drops and logs if it fails again.
    5. Returns verified test cases and the reference solution string.
    """
    client = OpenAI(
        base_url=llm_config["config_list"][0].get("base_url", "https://integrate.api.nvidia.com/v1"),
        api_key=llm_config["config_list"][0].get("api_key") or os.environ.get("NVIDIA_API_KEY"),
    )
    model_name = llm_config["config_list"][0].get("model", "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning")

    system_prompt = (
        "You are generating a reference solution and candidate test inputs "
        "for a coding problem. You must NOT state expected outputs — only "
        "propose inputs. Outputs will be computed by actually running your code.\n"
        "Return ONLY a valid JSON object in this exact shape:\n"
        "{\n"
        '  "referenceSolution": "<complete runnable code in target language that reads from stdin and prints to stdout>",\n'
        '  "candidateInputs": ["<input string 1>", "<input string 2>", ...]\n'
        "}"
    )

    user_prompt = (
        f"Problem: {raw_brief}\n"
        f"Language: {language}\n"
        f"Generate {n_cases} candidate test inputs (with varying edge cases) and a correct, complete reference solution."
    )

    reference_solution = ""
    candidate_inputs = []

    for attempt in range(2):
        try:
            resp = client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0.2,
            )
            raw_text = resp.choices[0].message.content
            parsed = _extract_json(raw_text)
            reference_solution = parsed.get("referenceSolution", "")
            candidate_inputs = parsed.get("candidateInputs", [])
            # LLMs frequently double-escape newlines inside JSON code strings
            # (literal "\\n" instead of "\n"). Unescape so the code is runnable.
            if "\\n" in reference_solution:
                reference_solution = reference_solution.replace("\\n", "\n").replace("\\t", "\t")
            candidate_inputs = [
                ci.replace("\\n", "\n") if isinstance(ci, str) else ci
                for ci in candidate_inputs
            ]
            if reference_solution and candidate_inputs:
                break
        except Exception as e:
            print(f"[generate_and_verify_test_cases] Generation attempt {attempt+1} failed: {e}", flush=True)

    if not reference_solution or not candidate_inputs:
        raise ValueError("Failed to generate valid reference solution and candidate inputs.")

    verified_cases = []

    for idx, input_str in enumerate(candidate_inputs):
        result = run_in_sandbox(code=reference_solution, language=language, stdin=input_str)
        if result["status"] == "success" and not result["stderr"]:
            verified_cases.append({
                "input": input_str,
                "expectedOutput": result["stdout"],
                "hidden": len(verified_cases) >= 2,
            })
        else:
            print(f"[generate_and_verify_test_cases] Candidate input {idx+1} failed ({result['stderr']}). Regenerating once...", flush=True)
            try:
                regen_resp = client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {"role": "system", "content": "You provide ONE alternative test input string for the given problem that satisfies problem constraints. Output valid JSON: {\"input\": \"<stdin string>\"}"},
                        {"role": "user", "content": f"Problem: {raw_brief}\nPrevious input failed with error: {result['stderr']}\nProvide 1 valid, clean input:"}
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.3,
                )
                regen_parsed = _extract_json(regen_resp.choices[0].message.content)
                new_input = regen_parsed.get("input", "")
                if new_input:
                    regen_result = run_in_sandbox(code=reference_solution, language=language, stdin=new_input)
                    if regen_result["status"] == "success" and not regen_result["stderr"]:
                        verified_cases.append({
                            "input": new_input,
                            "expectedOutput": regen_result["stdout"],
                            "hidden": len(verified_cases) >= 2,
                        })
                    else:
                        print(f"[generate_and_verify_test_cases] Regenerated input also failed. Dropping.", flush=True)
            except Exception as re:
                print(f"[generate_and_verify_test_cases] Regeneration error: {re}. Dropping.", flush=True)

    return verified_cases, reference_solution


def build_agents(is_coding: bool = False):
    if is_coding:
        tech_sys_msg = (
            "You evaluate a CODING submission where correctness is already verified — "
            "all test cases passed (given baseline, do not re-judge correctness).\n"
            "Score technical performance (0-100) weighing:\n"
            "1. Execution efficiency — based on the REAL measured telemetry provided (time in seconds, memory in KB)\n"
            "2. Code quality / readability — naming, structure, comments where warranted\n"
            "3. Simplicity / appropriate complexity — penalize needless over-engineering AND "
            "naive brute-force where a clearly better approach exists.\n"
            "Be specific about the code structure and real runtime numbers.\n"
            "End your message with: TECHNICAL_SCORE: <number>"
        )
        judge_sys_msg = (
            "You are the final judge. You receive evaluations from Technical, Business Impact, and Originality. "
            "Synthesize them into a single final assessment. Weight: 45% technical, 35% business impact, 20% originality.\n"
            "For this CODING submission, your final rationale MUST explicitly cite:\n"
            "- The real execution time and memory telemetry provided (actual numbers, e.g. '0.03s', '3200KB')\n"
            "- A specific, genuine code-quality observation from the code itself (naming, structure, algorithmic efficiency)\n"
            "If you cannot cite a real number and a real code observation, say so explicitly rather than fabricating specifics.\n"
            "Output ONLY valid JSON in this exact shape, nothing else:\n"
            '{"finalScore": <0-100 integer>, "rationale": "<2-3 sentence summary citing real telemetry numbers and code observation>", '
            '"flags": ["<short flag strings, e.g. high_efficiency, clean_code>"]}'
        )
    else:
        tech_sys_msg = (
            "You evaluate the technical correctness and depth of a student's submission "
            "against the problem's required skills. Score 0-100. Be specific about what's "
            "correct, what's missing, and how deep the solution goes. "
            "End your message with: TECHNICAL_SCORE: <number>"
        )
        judge_sys_msg = (
            "You are the final judge. You receive scores and reasoning from three "
            "evaluators: Technical, Business Impact, and Originality. Synthesize them "
            "into a single final assessment. Weight: 45% technical, 35% business impact, "
            "20% originality. Output ONLY valid JSON in this exact shape, nothing else:\n"
            '{"finalScore": <0-100 integer>, "rationale": "<2-3 sentence summary>", '
            '"flags": ["<short flag strings, e.g. low_originality, strong_technical>"]}'
        )

    technical_evaluator = autogen.AssistantAgent(
        name="TechnicalEvaluator",
        system_message=tech_sys_msg,
        llm_config=llm_config,
    )

    business_evaluator = autogen.AssistantAgent(
        name="BusinessImpactEvaluator",
        system_message=(
            "You evaluate whether this solution would actually work in the real-world "
            "scenario the problem describes — practicality, not just technical correctness. "
            "Consider: would a real company ship this? Does it solve the actual business "
            "problem, not just the literal technical ask? Score 0-100. "
            "End your message with: BUSINESS_SCORE: <number>"
        ),
        llm_config=llm_config,
    )

    originality_checker = autogen.AssistantAgent(
        name="OriginalityChecker",
        system_message=(
            "You compare this submission against other submissions to the SAME problem "
            "(provided to you as sibling submissions). Flag if this looks templated, "
            "generic, or suspiciously similar to another submission. Score 0-100 where "
            "100 = clearly original approach, 0 = near-identical to another submission. "
            "End your message with: ORIGINALITY_SCORE: <number>"
        ),
        llm_config=llm_config,
    )

    judge = autogen.AssistantAgent(
        name="RankingJudge",
        system_message=judge_sys_msg,
        llm_config=llm_config,
    )

    user_proxy = autogen.UserProxyAgent(
        name="Orchestrator",
        human_input_mode="NEVER",
        max_consecutive_auto_reply=0,
        code_execution_config=False,
    )

    return technical_evaluator, business_evaluator, originality_checker, judge, user_proxy


def score_submission(problem: dict, submission: dict, sibling_submissions: list) -> dict:
    is_coding = (problem.get("problemFormat") == "coding")
    technical_evaluator, business_evaluator, originality_checker, judge, user_proxy = build_agents(is_coding=is_coding)

    sibling_texts = "\n---\n".join(
        [f"Sibling submission {i+1}: {s.get('content', '')[:500]}" for i, s in enumerate(sibling_submissions)]
    )

    if is_coding:
        # Build telemetry summary from real testResults captured during correctness gate
        test_results = submission.get("testResults") or []
        telemetry_lines = []
        for i, tc in enumerate(test_results):
            t_val = f"{tc['time']}s" if tc.get("time") is not None else "N/A"
            m_val = f"{tc['memory']}KB" if tc.get("memory") is not None else "N/A"
            p_val = tc.get("passed", True)
            telemetry_lines.append(f"Test {i+1}: {t_val}, {m_val}, passed={p_val}")
        telemetry_summary = "\n".join(telemetry_lines) if telemetry_lines else "Test telemetry: Passed all correctness cases (time/memory: nominal)"

        code_text = submission.get("code") or submission.get("content") or ""
        context = f"""
PROBLEM (CODING):
Title: {problem['title']}
Description: {problem['description']}
Language: {problem.get('language', submission.get('language', 'python'))}

SUBMISSION CODE TO EVALUATE:
```{submission.get('language', 'python')}
{code_text}
```

REAL EXECUTION TELEMETRY (Measured in sandbox during correctness gate — DO NOT ESTIMATE):
{telemetry_summary}

SIBLING SUBMISSIONS (for originality comparison):
{sibling_texts if sibling_texts else "No other submissions to compare against yet."}
"""
    else:
        context = f"""
PROBLEM:
Title: {problem['title']}
Description: {problem['description']}
Required Skills: {json.dumps(problem.get('requiredSkills', []))}

SUBMISSION TO EVALUATE:
{submission.get('content', '')}

SIBLING SUBMISSIONS (for originality comparison):
{sibling_texts if sibling_texts else "No other submissions to compare against yet."}
"""

    groupchat = autogen.GroupChat(
        agents=[user_proxy, technical_evaluator, business_evaluator, originality_checker, judge],
        messages=[],
        max_round=6,
        speaker_selection_method="round_robin",
    )
    manager = autogen.GroupChatManager(groupchat=groupchat, llm_config=llm_config)

    user_proxy.initiate_chat(manager, message=context)

    last_judge_message = None
    for msg in reversed(groupchat.messages):
        if msg.get("name") == "RankingJudge":
            last_judge_message = msg["content"]
            break

    if not last_judge_message:
        return {"finalScore": None, "rationale": "Judge failed to produce output.", "flags": ["error"]}

    try:
        start = last_judge_message.find("{")
        end = last_judge_message.rfind("}") + 1
        parsed = json.loads(last_judge_message[start:end])
        return parsed
    except Exception:
        return {"finalScore": None, "rationale": "Failed to parse judge output.", "flags": ["parse_error"]}


def _extract_json(text: str):
    """Extract the first JSON object or array from a possibly-verbose LLM response."""
    # Try object first, then array
    for open_ch, close_ch in [('{', '}'), ('[', ']')]:
        start = text.find(open_ch)
        end = text.rfind(close_ch)
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(text[start:end + 1])
            except Exception:
                pass
    raise ValueError(f"No valid JSON found in LLM output: {text[:300]}")


def generate_variants(raw_data: str, n: int) -> dict:
    """
    Two-stage pipeline:
      Stage 1 — IngestionAgent extracts canonical structure from raw brief.
      Stage 2 — VariantGeneratorAgent produces N differently-framed problem statements.

    Returns merged dict so the caller can return everything to Next.js and let the
    HM review/override requiredSkills before finalising.
    """
    n = min(n, 5)  # hard cap

    user_proxy = autogen.UserProxyAgent(
        name="Orchestrator",
        human_input_mode="NEVER",
        max_consecutive_auto_reply=1,
        code_execution_config=False,
    )

    # ── Stage 1: Ingestion ────────────────────────────────────────────────────
    ingestion_agent = autogen.AssistantAgent(
        name="IngestionAgent",
        system_message=(
            "You extract the canonical problem structure from a raw business brief.\n"
            "Output ONLY valid JSON — no prose, no markdown, just the JSON object:\n"
            '{"coreChallenge": "<1-2 sentence core challenge>", '
            '"requiredSkills": [{"name": "<skill>", "weight": <1-5 integer>}], '
            '"rubric": "<3-5 sentence grading rubric>", '
            '"datasetSummary": "<1-2 sentence description of the underlying data/scenario>"}'
        ),
        llm_config=llm_config,
    )

    def _chat_with_retry(proxy, agent, message):
        import time
        max_retries = 4
        for attempt in range(max_retries):
            try:
                proxy.initiate_chat(agent, message=message, silent=True)
                return
            except Exception as e:
                err_str = str(e)
                if "503" in err_str or "ResourceExhausted" in err_str or "Worker local total" in err_str:
                    if attempt < max_retries - 1:
                        time.sleep(3 * (attempt + 1))
                        continue
                raise

    _chat_with_retry(
        user_proxy,
        ingestion_agent,
        f"Extract the canonical problem structure from this brief:\n\n{raw_data}",
    )

    ingestion_raw = None
    for msg in reversed(ingestion_agent.chat_messages.get(user_proxy, [])):
        if msg.get("role") == "assistant":
            ingestion_raw = msg["content"]
            break

    if not ingestion_raw:
        raise ValueError("IngestionAgent produced no output.")

    ingestion = _extract_json(ingestion_raw)

    # ── Stage 2: Variant Generation (sequential, anti-repetition) ─────────────
    variants = []
    previous_variants_text = ""

    for i in range(n):
        variant_agent = autogen.AssistantAgent(
            name=f"VariantGeneratorAgent_{i+1}",
            system_message=(
                "You write ONE differently-framed problem statement from a canonical "
                "problem structure. This is variant "
                f"{i+1} of {n}.\n\n"
                "CRITICAL RULES:\n"
                "- Use a genuinely different narrative setup than any previous variant "
                "shown to you — different role, different company archetype, different "
                "opening sentence structure, different order of information.\n"
                "- Do NOT reuse the same sentence template with only nouns swapped. "
                "Rewrite the framing, tone, and structure meaningfully.\n"
                "- You MUST preserve the same underlying challenge, numeric targets, "
                "required skills, and grading rubric — only the narrative wrapper changes.\n"
                "- Vary sentence length and structure noticeably from prior variants.\n\n"
                "Output ONLY valid JSON, no prose:\n"
                '{"title": "<short title>", "description": "<3-5 sentence problem description>"}'
            ),
            llm_config=llm_config,
        )

        prior_block = (
            f"\n\nPREVIOUSLY GENERATED VARIANTS (do not repeat this phrasing or structure):\n{previous_variants_text}"
            if previous_variants_text else ""
        )

        prompt = (
            f"Canonical problem:\n"
            f"Core Challenge: {ingestion.get('coreChallenge', '')}\n"
            f"Required Skills: {json.dumps(ingestion.get('requiredSkills', []))}\n"
            f"Rubric: {ingestion.get('rubric', '')}\n"
            f"Dataset/Scenario: {ingestion.get('datasetSummary', '')}"
            f"{prior_block}"
        )

        proxy_i = autogen.UserProxyAgent(
            name=f"Orchestrator_v{i+1}",
            human_input_mode="NEVER",
            max_consecutive_auto_reply=1,
            code_execution_config=False,
        )
        parsed = None
        max_attempts = 3
        for attempt in range(max_attempts):
            _chat_with_retry(proxy_i, variant_agent, prompt)
            raw = None
            for msg in reversed(variant_agent.chat_messages.get(proxy_i, [])):
                if msg.get("role") == "assistant":
                    raw = msg["content"]
                    break

            if raw:
                try:
                    candidate = _extract_json(raw)
                    if isinstance(candidate, dict) and candidate.get("description"):
                        parsed = candidate
                        break
                except Exception:
                    pass

        if parsed and isinstance(parsed, dict):
            variant_entry = {
                "variantId": f"v{i+1}",
                "title": parsed.get("title", f"Variant {i+1}"),
                "description": parsed.get("description", ""),
                "generationFailed": False,
            }
            previous_variants_text += f"\n[{variant_entry['variantId']}] {variant_entry['title']}: {variant_entry['description']}\n"
        else:
            print(f"[WARNING] VariantGeneratorAgent failed all {max_attempts} attempts for variant {i+1}. Raw output:\n{raw}\n", flush=True)
            variant_entry = {
                "variantId": f"v{i+1}",
                "title": f"Variant {i+1} (Generation Failed)",
                "description": "",
                "generationFailed": True,
            }

        variants.append(variant_entry)

    return {
        "coreChallenge": ingestion.get("coreChallenge"),
        "requiredSkills": ingestion.get("requiredSkills", []),
        "rubric": ingestion.get("rubric"),
        "datasetSummary": ingestion.get("datasetSummary"),
        "variants": variants,
    }


