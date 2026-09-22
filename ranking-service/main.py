import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import re
import json
import sqlite3
from fastapi import FastAPI, UploadFile, File, Form
from pydantic import BaseModel
from typing import List, Optional, Any
from agents import score_submission, generate_variants, generate_and_verify_test_cases
from sand_flea import extract_document

app = FastAPI()


class Problem(BaseModel):
    title: str
    description: str
    requiredSkills: Optional[list] = []
    problemFormat: Optional[str] = "open_ended"
    language: Optional[str] = None


class Submission(BaseModel):
    id: str
    content: Optional[str] = ""
    code: Optional[str] = None
    language: Optional[str] = None
    testResults: Optional[list] = []


class RankRequest(BaseModel):
    problem: Problem
    submissions: List[Submission]


@app.post("/rank")
def rank(req: RankRequest):
    results = []
    all_submissions = [s.dict() for s in req.submissions]

    for i, submission in enumerate(req.submissions):
        siblings = [s for j, s in enumerate(all_submissions) if j != i]
        score_result = score_submission(req.problem.dict(), submission.dict(), siblings)
        results.append({
            "submissionId": submission.id,
            "finalScore": score_result.get("finalScore"),
            "rationale": score_result.get("rationale"),
            "flags": score_result.get("flags", []),
        })

    return {"results": results}


class VariantRequest(BaseModel):
    rawData: str
    variantCount: int
    problemFormat: Optional[str] = "open_ended"
    language: Optional[str] = "python"


@app.post("/generate-variants")
def generate_variants_endpoint(req: VariantRequest):
    result = generate_variants(req.rawData, req.variantCount)
    if req.problemFormat == "coding":
        test_cases, ref_solution = generate_and_verify_test_cases(req.rawData, req.language or "python")
        result["problemFormat"] = "coding"
        result["language"] = req.language or "python"
        result["testCases"] = test_cases
        result["referenceSolution"] = ref_solution
    return result


class TestCaseRequest(BaseModel):
    rawBrief: str
    language: Optional[str] = "python"
    nCases: Optional[int] = 5


@app.post("/generate-test-cases")
def generate_test_cases_endpoint(req: TestCaseRequest):
    test_cases, ref_solution = generate_and_verify_test_cases(req.rawBrief, req.language or "python", req.nCases or 5)
    return {
        "testCases": test_cases,
        "referenceSolution": ref_solution,
    }


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/extract-document")
async def extract_document_endpoint(file: UploadFile = File(...), file_type: str = Form(...)):
    file_bytes = await file.read()
    extracted_text = extract_document(file_bytes, file_type)
    return {"extractedText": extracted_text}


def validate_read_only_query(query: str) -> tuple[bool, Optional[str]]:
    """
    Validates single-statement and read-only status by stripping string literals and comments.
    Does not rely on naive split(';').
    """
    # Strip string literals ('...' and escaped '')
    no_strings = re.sub(r"'(''|[^'])*'", "''", query)
    # Strip line comments --
    no_comments = re.sub(r"--[^\n]*", "", no_strings)
    # Strip block comments /* ... */
    no_block_comments = re.sub(r"/\*.*?\*/", "", no_comments, flags=re.DOTALL)
    cleaned = no_block_comments.strip()

    # Check for multiple statements (semicolon followed by non-whitespace characters)
    parts = [p.strip() for p in cleaned.split(";") if p.strip()]
    if len(parts) > 1:
        return False, "Multiple SQL statements are not permitted."

    # Prohibit mutation keywords at word boundaries
    mutation_pattern = r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|ATTACH|DETACH|PRAGMA|REPLACE)\b"
    match = re.search(mutation_pattern, cleaned, re.IGNORECASE)
    if match:
        return False, f"Mutation statement '{match.group(1).upper()}' is not permitted in read-only queries."

    return True, None


def normalize_rows(rows: list) -> list:
    return sorted([json.dumps(row, sort_keys=True, default=str) for row in rows])


class SqlExecuteRequest(BaseModel):
    schemaDefinition: str
    query: str


@app.post("/execute-sql")
def execute_sql_endpoint(req: SqlExecuteRequest):
    conn = sqlite3.connect(":memory:")
    try:
        conn.executescript(req.schemaDefinition)
        is_valid, validation_error = validate_read_only_query(req.query)
        if not is_valid:
            return {"success": False, "results": [], "error": f"Security validation failed: {validation_error}"}
        conn.execute("PRAGMA query_only = 1;")
        cursor = conn.cursor()
        cursor.execute(req.query)
        cols = [desc[0] for desc in cursor.description] if cursor.description else []
        rows = cursor.fetchall()
        results = [dict(zip(cols, row)) for row in rows]
        return {"success": True, "results": results, "error": None}
    except Exception as e:
        return {"success": False, "results": [], "error": str(e)}
    finally:
        conn.close()


class SqlGradeRequest(BaseModel):
    schemaDefinition: str
    studentQuery: str
    expectedResult: Optional[Any] = None
    referenceQuery: Optional[str] = None
    comparisonMode: Optional[str] = "unordered"


@app.post("/grade-sql")
def grade_sql_endpoint(req: SqlGradeRequest):
    # 1. First line of defense: AST / regex-level validation
    is_valid, validation_error = validate_read_only_query(req.studentQuery)
    if not is_valid:
        return {
            "passed": False,
            "actualResult": [],
            "error": f"Security validation failed: {validation_error}"
        }

    conn = sqlite3.connect(":memory:")
    try:
        # Seed schema definition (DDL + fixtures)
        conn.executescript(req.schemaDefinition)

        # Compute expected result if not provided
        expected = req.expectedResult
        if expected is None and req.referenceQuery:
            ref_cursor = conn.cursor()
            ref_cursor.execute(req.referenceQuery)
            ref_cols = [desc[0] for desc in ref_cursor.description] if ref_cursor.description else []
            expected = [dict(zip(ref_cols, r)) for r in ref_cursor.fetchall()]

        # 2. Second line of defense: Engine-level PRAGMA query_only = 1 lock
        conn.execute("PRAGMA query_only = 1;")

        # Execute student query
        cursor = conn.cursor()
        cursor.execute(req.studentQuery)
        cols = [desc[0] for desc in cursor.description] if cursor.description else []
        actual = [dict(zip(cols, row)) for row in cursor.fetchall()]

        # Compare results
        if req.comparisonMode == "ordered":
            passed = (actual == expected)
        else:
            passed = (normalize_rows(actual) == normalize_rows(expected if expected is not None else []))

        return {
            "passed": passed,
            "actualResult": actual,
            "expectedResult": expected,
            "error": None
        }
    except sqlite3.OperationalError as oe:
        # Catches engine-level read-only violations like "attempt to write a readonly database"
        return {
            "passed": False,
            "actualResult": [],
            "expectedResult": req.expectedResult,
            "error": f"Database operational error: {str(oe)}"
        }
    except Exception as e:
        return {
            "passed": False,
            "actualResult": [],
            "expectedResult": req.expectedResult,
            "error": f"Execution error: {str(e)}"
        }
    finally:
        conn.close()
